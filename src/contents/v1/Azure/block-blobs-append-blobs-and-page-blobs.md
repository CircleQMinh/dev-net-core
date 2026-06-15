---
id: block-blobs-append-blobs-and-page-blobs
topic: Azure Blob Storage and file handling
subtopic: Block blobs, append blobs, and page blobs
category: Azure
---

## Overview

Azure Blob Storage supports three blob types:

- **Block blobs:** Optimized for uploading, downloading, streaming, and managing ordinary files and large objects.
- **Append blobs:** Optimized for adding new blocks to the end of an object.
- **Page blobs:** Optimized for random reads and writes to fixed 512-byte pages.

The blob type is selected when the blob is created and cannot be changed in place. Each type has a different API and update model:

```text
Block blob  -> stage blocks, then commit a block list
Append blob -> append a new block to the end
Page blob   -> write aligned byte ranges in place
```

Most application files should be block blobs. Append blobs are specialized for append-only records such as logs. Page blobs primarily support virtual hard disks and other sparse random-access workloads.

For interviews, candidates should explain the operational differences, choose a type from the write pattern, discuss concurrency and integrity, and avoid using specialized blob types where ordinary block blobs are simpler.

## Core Concepts

### Blob Type Is Immutable

The blob type is set at creation. A block blob cannot later become an append or page blob through a metadata change.

To change type:

1. Create a new blob of the desired type.
2. Copy or transform the content.
3. Validate the result.
4. Update references.
5. Delete the old object when policy permits.

The selection should follow the mutation pattern, not the file extension.

### Shared Blob Capabilities

All blob types support common object-storage concepts such as:

- Unique names within a container.
- HTTP properties and metadata.
- ETags.
- Conditional requests.
- Leases.
- Snapshots in supported scenarios.
- Encryption.
- Azure RBAC and SAS authorization.

The update operations and feature compatibility differ by blob type.

### Strong Consistency and ETags

Committed changes are visible immediately. Every committed state has an ETag.

Use conditions such as:

```http
If-Match: "etag-value"
```

to prevent lost updates. A failed precondition tells the client that another writer changed the object.

Leases provide stronger exclusive-write coordination where needed, but applications must handle lease expiration, renewal, and abandoned owners.

### Block Blobs

Block blobs are the default for:

- Documents.
- Images.
- Videos.
- Backups.
- Exports.
- Data lake objects.
- Application packages.
- User uploads.

They are composed of individually identified blocks. A client can:

1. Stage blocks in any order.
2. Upload blocks in parallel.
3. Retry failed blocks independently.
4. Commit an ordered block list atomically.

Only committed blocks form the visible blob content.

### Single-Request Block Blob Upload

Small objects can be uploaded with one request. This is simple and reduces coordination overhead.

The SDK chooses single-request or staged upload according to payload size and transfer options. Do not hardcode assumptions based on an old SDK threshold.

Use a single upload when:

- The object is small.
- Network reliability is good.
- Resumability is unnecessary.
- Memory and request limits are acceptable.

### Staged Block Upload

Large uploads use staged blocks:

```text
Stage block A
Stage block B
Stage block C
Commit [A, B, C]
```

Benefits include:

- Parallel transfer.
- Per-block retry.
- Resume support.
- Ordered final assembly.
- Atomic visibility at commit.

Block IDs must have a consistent encoded length within one blob. Applications often derive them from a zero-padded sequence number.

### Uncommitted Blocks

Staged blocks are uncommitted until included in a committed block list. They:

- Do not form visible blob content.
- Can be listed for resume logic.
- Are discarded after the service retention window if never committed.
- Can be replaced by uploading the same block ID.

The application should persist upload state or deterministically regenerate block IDs. After interruption, list uncommitted blocks and continue missing parts.

### Atomic Block List Commit

Committing the block list creates or replaces the visible block blob as one operation. If a referenced block is missing, the commit fails and the previous committed blob remains unchanged.

Use conditional headers to avoid replacing an object modified by another writer.

Committing a new block list can also replace properties and metadata, so callers must set the intended final values.

### Block Blob Size and Scale

Current REST service versions support up to 50,000 committed blocks, with modern maximum block sizes producing block blobs of approximately 190.7 TiB.

Practical limits are often reached earlier through:

- Client memory.
- Network throughput.
- Request duration.
- Application retry behavior.
- Account throughput.
- Downstream processing.

Use SDK transfer options and production-like tests rather than targeting theoretical maximums without measurement.

### Parallelism

Parallel block upload improves throughput until constrained by:

- Client CPU and memory.
- Network bandwidth.
- Storage account limits.
- Server throttling.
- Proxy limits.

Excessive concurrency causes throttling and unstable tail latency. Tune block size and concurrency together.

For example, larger blocks reduce request count but increase retry cost and memory use. Smaller blocks improve retry granularity but increase transactions.

### Integrity Checks

Validate transport and content using supported checksums such as MD5 or CRC64 for transfer operations, plus an application-level checksum when long-term integrity or deduplication requires it.

A robust workflow stores:

- Expected length.
- Checksum algorithm.
- Checksum value.
- Upload completion state.
- Content validation result.

Do not assume a successful HTTP response proves that the uploaded bytes represent a safe or expected file.

### Block Blob Updates

A block blob is not a general random-write file. Updating content typically means:

- Uploading a complete replacement.
- Staging changed and reused blocks, then committing a new list.
- Creating a new immutable version.

For application documents, immutable versioned blob names are often safer than in-place replacement.

### Access Tiers and Block Blobs

Hot, cool, cold, archive, and smart tier behavior applies to eligible block blobs in supported accounts.

Block blobs are therefore appropriate for lifecycle-managed documents and archives. Append and page blobs do not use these access tiers in the same way.

### Append Blobs

Append blobs are block-based but expose only append operations. A writer adds blocks to the end:

```text
Existing content
+ new append block
= longer content
```

Existing blocks cannot be updated or deleted individually. Append blob block IDs are managed by the service rather than exposed to the client.

Use cases include:

- Append-only application logs.
- Audit trails where storage-level immutability is separately designed.
- Sequential telemetry batches.
- Event records from controlled writers.

### Append Blob Limits

An append block is limited to 4 MiB in the documented REST model, and an append blob supports up to 50,000 blocks, resulting in a maximum slightly above 195 GiB.

Applications should rotate append blobs before reaching limits:

```text
logs/2026/06/15/00.log
logs/2026/06/15/01.log
```

Rotation also improves lifecycle management, parallel processing, and fault isolation.

### Append Concurrency

Multiple writers can race to append. Conditional append operations can enforce:

- Expected append position.
- Maximum blob size.
- ETag conditions.
- Lease ownership.

If strict global ordering is required across many producers, Blob Storage alone may not provide the desired event semantics. Use a messaging service or partitioned event log, then write batches to storage.

An append completing successfully means its bytes were added, but application-level ordering still depends on producer coordination.

### Append Blobs Are Not a Message Broker

Append blobs lack features expected from a messaging system:

- Consumer offsets.
- Per-message acknowledgement.
- Dead-letter queues.
- Delivery attempts.
- Ordered competing consumers.
- Message locks.

Use Service Bus or Event Hubs for messaging. Persist logs or event archives to append or block blobs as a separate concern.

### Page Blobs

Page blobs are sparse collections of 512-byte pages optimized for random reads and writes.

Creation specifies a maximum size. Writes:

- Specify an offset and range.
- Must align to 512-byte page boundaries.
- Modify content in place.
- Are committed immediately.

The maximum documented page blob size is 8 TiB.

### Page Blob Use Cases

Page blobs are designed primarily for:

- Virtual hard disks.
- Azure VM disk backing.
- Specialized random-access data.

Most application files should not use page blobs. A page blob adds alignment and sparse-file semantics that are unnecessary for documents, media, and ordinary uploads.

Managed disks abstract page blob management for most Azure VM scenarios. Applications should generally use managed disks rather than manipulating VHD page blobs directly.

### Sparse Allocation

Only written pages consume storage capacity in the sparse representation, subject to service billing rules. Unwritten ranges read as zeros.

This makes page blobs useful for large logical files with allocated regions, such as virtual disks.

Clearing page ranges can deallocate them. Applications need careful concurrency because writes happen in place.

### Page Ranges and Incremental Snapshots

Page-range APIs identify populated or changed ranges. Incremental snapshots can capture changes efficiently for supported disk and backup workflows.

These capabilities are specialized. Avoid rebuilding an application database or file system on page blobs unless the team is prepared to implement consistency, locking, indexing, and recovery.

### Choosing a Blob Type

| Workload | Blob type | Reason |
| --- | --- | --- |
| PDF, image, video, ZIP | Block | Whole-object transfer and streaming |
| Large resumable upload | Block | Parallel staged blocks and commit |
| Lifecycle-managed archive | Block | Access tier support |
| Append-only log | Append | End-only writes |
| Virtual hard disk | Page | Random aligned page updates |
| Mutable JSON document | Block, often immutable versions | Simple replacement and versioning |
| Event queue | Neither | Use a messaging service |

Start with block blobs unless the workload clearly requires append-only or random page writes.

### Leases

A blob lease grants exclusive write or delete access to a lease holder for a duration or indefinitely until released.

Use leases for:

- Coordinating one writer.
- Preventing deletion during processing.
- Leadership for a simple storage-based process.

Do not use a lease as the only business lock when:

- Work can outlive the lease.
- Network partitions are possible.
- Database state also changes.
- Fencing tokens are required.

Lease loss must cause the worker to stop or validate ownership before committing.

### Snapshots and Versions

A snapshot is a read-only point-in-time copy. Versioning automatically creates versions for supported block blob changes.

Use them for recovery, but account for:

- Additional storage.
- Lifecycle cleanup.
- Authorization.
- Interactions with immutability.

Snapshots and versions do not replace tested backup and disaster-recovery procedures.

### Idempotency

Blob operations should be retry-safe.

Patterns include:

- Deterministic blob names from operation IDs.
- `If-None-Match: *` for create-only upload.
- Stable block IDs for resumable transfer.
- ETags for update-if-current.
- Append position conditions.
- Persisted upload state.

Without idempotency, a retry can create duplicate objects, overwrite newer data, or append the same record twice.

### Security

All blob types use the same core authorization approaches:

- Microsoft Entra ID and Azure RBAC.
- Managed identity.
- SAS.
- Shared Key where still permitted.

Use private endpoints, TLS, restricted public network access, and data-plane least privilege. Blob type does not alter the need for authorization and content validation.

### Monitoring

Monitor:

- Request latency.
- Success and error status codes.
- Throttling.
- Ingress and egress.
- Transaction count.
- Capacity.
- Uncommitted block accumulation.
- Append failures and blob rotation.
- Page write patterns.
- Authentication failures.

Application metrics should track upload completion, checksum failures, retry count, and orphan cleanup.

### Common Mistakes

Common mistakes include:

- Using append blobs for ordinary files.
- Using page blobs for application documents.
- Assuming append blobs provide message-queue semantics.
- Creating random block IDs that cannot support resume.
- Retrying append without duplicate protection.
- Ignoring ETags during concurrent replacement.
- Using excessive parallel upload concurrency.
- Failing to commit or clean uncommitted blocks.
- Applying block-blob access tier assumptions to append or page blobs.
- Editing mutable content in place when immutable versions are safer.
- Manipulating page blobs instead of using managed disks.

### Best-Practice Selection Checklist

A production design should normally:

- Choose block blobs by default.
- Use append blobs only for controlled append-only workloads.
- Use page blobs only for genuine random-write or VHD scenarios.
- Define idempotent names and conditional writes.
- Use staged blocks for large resumable uploads.
- Tune block size and concurrency using realistic tests.
- Validate checksums and content.
- Rotate append blobs before limits.
- Use messaging services for delivery semantics.
- Apply ETags or leases where writers compete.
- Monitor retries, throttling, and incomplete uploads.
- Secure every type with identity and network controls.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are the three Azure blob types?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-beginner-q01 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Block blobs are optimized for ordinary object upload, download, and streaming. Append blobs allow blocks to be added only at the end and suit append-only logs. Page blobs provide random reads and writes to aligned 512-byte pages and primarily back virtual hard disks.

The type is chosen when the blob is created and cannot be changed in place.

##### Key Points to Mention

- Block blobs are the default for files and objects.
- Append blobs support end-only writes.
- Page blobs support sparse random access.
- Changing type requires creating a new blob.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-beginner-q01 -->

#### How does a staged block blob upload work?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-beginner-q02 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The client splits data into blocks, gives each block an ID, and uploads the blocks independently. Blocks can be transferred in parallel and retried. The client then commits an ordered block list, which atomically defines the visible blob.

Uncommitted blocks are not part of the visible content and are eventually discarded if never committed.

##### Key Points to Mention

- Blocks can upload in any order.
- Commit order defines final content.
- Per-block retry supports large resumable uploads.
- The blob becomes visible at block-list commit.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-beginner-q02 -->

#### When should you use an append blob?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-beginner-q03 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Use an append blob when data is only added to the end, such as a controlled application log or sequential telemetry archive. Existing blocks cannot be edited or deleted individually.

Do not use it as a message queue because it lacks acknowledgements, consumer locks, dead-lettering, and delivery semantics. Rotate append blobs according to size, time, or record count.

##### Key Points to Mention

- Append operations add data only at the end.
- Existing content is not randomly updated.
- It suits logs, not arbitrary files.
- Messaging services are better for queues and events.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-beginner-q03 -->

#### What is a page blob used for?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-beginner-q04 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A page blob is a sparse object divided into 512-byte pages that can be read and written at random aligned offsets. It is primarily used for virtual hard disks and specialized random-access workloads.

Ordinary documents and media should generally use block blobs. Azure VM workloads should usually use managed disks rather than directly managing page blobs.

##### Key Points to Mention

- Writes are aligned to 512-byte pages.
- Updates happen in place.
- Page blobs support sparse allocation.
- VHDs are the main scenario.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you make a large block blob upload resumable?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-intermediate-q01 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Split the file into deterministic blocks with stable, equal-length block IDs. Persist the upload operation ID, expected size, block size, checksum, and target blob name. Upload blocks in parallel with bounded retries.

After interruption, list uncommitted blocks and resend only missing blocks. Commit the complete ordered list with a create-only or ETag condition, then verify final length and checksum. Expire abandoned upload records and clean orphaned data.

##### Key Points to Mention

- Stable block IDs enable resume.
- Persist upload state outside process memory.
- Retry individual blocks, not the whole file.
- Commit conditionally and verify integrity.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-intermediate-q01 -->

#### How do ETags and leases differ for blob concurrency?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-intermediate-q02 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

ETags support optimistic concurrency. A client reads the blob and updates only if the ETag is unchanged. Conflicts fail and the client decides whether to reload or retry.

A lease provides exclusive write and delete access to the holder. It suits single-writer coordination but requires acquisition, renewal, release, and lease-loss handling. ETags are simpler when conflicts are uncommon; leases are useful when exclusive ownership is necessary.

##### Key Points to Mention

- ETags detect concurrent modification.
- Leases establish exclusive ownership.
- Lease holders must handle expiration and failure.
- Neither replaces business transactions across other stores.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-intermediate-q02 -->

#### How would you handle several writers appending to one append blob?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-intermediate-q03 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use conditional append operations with expected append position or a lease when one writer must own the stream. Include an application record ID so retries can be detected, because a timeout can leave uncertainty about whether an append succeeded.

If strict ordering, acknowledgements, replay, or many producers are required, use Service Bus or Event Hubs and write batches to storage. One append blob can also become a contention and scale bottleneck.

##### Key Points to Mention

- Concurrent append needs conditions or ownership.
- Retried appends can duplicate records.
- One blob can become a hot object.
- Messaging services provide stronger event semantics.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-intermediate-q03 -->

#### What determines block size and upload concurrency?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-intermediate-q04 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose them based on file size, network bandwidth and reliability, client memory, transaction cost, account throughput, proxy limits, and acceptable retry granularity. Larger blocks reduce request count but cost more to retry and buffer. More concurrency improves throughput until the client or service saturates.

Benchmark realistic networks and payloads. Use bounded parallelism and honor throttling with exponential backoff and jitter rather than continually increasing threads.

##### Key Points to Mention

- Block size trades transaction count against retry cost.
- Concurrency is limited by client, network, and service capacity.
- Excess concurrency causes throttling.
- Tune through production-like measurement.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design a reliable direct-to-Blob large file upload workflow.

<!-- question:start:block-blobs-append-blobs-and-page-blobs-advanced-q01 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The API authenticates the user, authorizes tenant and quota, creates an upload record, generates a server-controlled blob name, and issues a short-lived user delegation SAS limited to create or stage operations on that object. The browser stages deterministic blocks and reports progress.

The API or client commits the expected ordered block list using a create-only condition. A completion worker verifies length, checksum, content type, and malware scan before moving the business record from pending to available. Abandoned uploads expire and are reconciled.

Use bounded parallelism, per-block retry, private or controlled network paths where appropriate, diagnostic correlation, and no broad container write SAS.

##### Key Points to Mention

- Separate authorization from high-volume data transfer.
- Use deterministic blocks and short scoped SAS.
- Verify content before publication.
- Persist state and clean abandoned uploads.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-advanced-q01 -->

#### Why might immutable block blob versions be safer than modifying one blob?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-advanced-q02 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Writing a new version under a new identifier avoids lost updates, makes rollback and auditing simpler, and allows readers to continue using the previous object until metadata atomically points to the new one. It also avoids exposing partial replacement workflows.

The trade-offs are additional capacity, lifecycle cleanup, and reference management. A database can store the current version ID, while old versions follow retention policy.

##### Key Points to Mention

- Immutable writes simplify concurrency.
- Readers never observe a partial replacement.
- Database metadata can switch the active version.
- Lifecycle must manage old versions and cost.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-advanced-q02 -->

#### When would page blobs be justified in an application design?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-advanced-q03 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Use page blobs when the workload genuinely requires sparse, random in-place reads and writes to aligned byte ranges, such as virtual disk formats or specialized storage engines. The team must understand 512-byte alignment, maximum size, concurrency, page-range tracking, snapshots, and recovery.

For VM disks, managed disks are normally the better abstraction. For files, block blobs are simpler. For structured records, use a database rather than implementing indexing and transactions over page blobs.

##### Key Points to Mention

- Page blobs solve random aligned write workloads.
- Managed disks abstract the common VHD scenario.
- They are not general application databases.
- Complexity must be justified by the access pattern.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-advanced-q03 -->

#### How would you recover from an uncertain result after a blob write times out?

<!-- question:start:block-blobs-append-blobs-and-page-blobs-advanced-q04 -->
<!-- question-id:block-blobs-append-blobs-and-page-blobs-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Do not assume the operation failed. Query the blob or block state using the deterministic operation ID, ETag, expected length, block list, append position, or checksum. If the intended state already exists, treat the retry as success. Otherwise, repeat only the missing idempotent operation.

For append blobs, include a record ID and expected append position because blindly retrying can duplicate data. For replacement block blobs, use ETags or versioned names. Persist workflow state so another process can reconcile after the client disappears.

##### Key Points to Mention

- Timeouts create unknown outcomes.
- Verify state before retrying.
- Deterministic IDs and conditions enable idempotency.
- Reconciliation is required for abandoned workflows.

<!-- question:end:block-blobs-append-blobs-and-page-blobs-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
