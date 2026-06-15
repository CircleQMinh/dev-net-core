---
id: matching-storage-choices-to-relational-object-and-cache-workloads
topic: Azure data, storage, and caching services
subtopic: Matching storage choices to relational, object, and cache workloads
category: Azure
---

## Overview

Storage selection should begin with the shape, access patterns, consistency requirements, retention rules, and failure consequences of the data. It should not begin with a preferred Azure product.

Three common storage roles are:

- **Relational database:** Structured records, relationships, constraints, transactions, indexes, and flexible queries. Azure SQL Database is a common managed choice.
- **Object storage:** Large unstructured binary objects accessed primarily by object name, metadata, or tags. Azure Blob Storage is a common choice.
- **Distributed cache:** Low-latency key-based access to temporary, derived, or short-lived state. Azure Managed Redis is the current managed Redis choice.

A production application often uses all three:

```text
Azure SQL Database
  -> authoritative product, order, and payment records

Azure Blob Storage
  -> product images, invoices, exports, and uploaded documents

Azure Managed Redis
  -> cached product projections, sessions, counters, and temporary state
```

The stores are complementary, not interchangeable. A relational database is usually a poor place for large videos. Blob Storage is a poor fit for cross-record transactional constraints. Redis is a risky only copy of an order or financial ledger.

For interviews, candidates should be able to:

- Identify the source of truth.
- Explain transaction and consistency boundaries.
- Match query patterns to indexes and data models.
- Separate binary content from searchable metadata.
- Use caching without losing correctness.
- Discuss durability, availability, recovery, retention, and cost.
- Recognize when polyglot persistence is justified and when it creates unnecessary complexity.
- Design data movement, invalidation, reconciliation, and failure behavior across stores.

## Core Concepts

### Start with Data Requirements

Before selecting a store, answer:

- What is the data shape?
- How large is each item?
- How quickly does data grow?
- Which operations are most common?
- Are reads by exact key, range, relationship, filter, or full scan?
- Which fields need indexes?
- What must be updated atomically?
- How much staleness is acceptable?
- What are the RPO and RTO?
- How long must data be retained?
- Can data be rebuilt?
- Which identities may access it?
- What network paths are allowed?
- How will backup, restore, and disaster recovery work?
- What is the total cost of storage, operations, retrieval, compute, and egress?

The most important question is often:

> What happens to the business if this data disappears or is stale?

That answer distinguishes authoritative records from disposable acceleration data.

### System of Record

The system of record is the authoritative store for a piece of business data.

Examples:

- Azure SQL Database is the source of truth for an order.
- Blob Storage is the source of truth for the immutable invoice PDF.
- Redis contains a cached order summary that can be rebuilt.

Every important datum should have one clearly defined authority. If two stores can both accept independent authoritative updates, the system needs explicit conflict resolution and reconciliation.

A derived copy can be:

- A Redis cache entry.
- A search index document.
- A denormalized reporting table.
- A generated thumbnail.
- A materialized read model.

Derived data should have a rebuild path and freshness expectation.

### Relational Workloads

A relational database organizes data into tables with a declared schema. Relationships and constraints can be enforced through:

- Primary keys.
- Foreign keys.
- Unique constraints.
- Check constraints.
- Transactions.
- Isolation levels.

Relational storage is appropriate when the workload needs:

- Multi-row or multi-table transactions.
- Strong consistency.
- Referential integrity.
- Flexible filtering and joins.
- Aggregation over structured records.
- Mature SQL query tooling.
- Concurrency controls.
- Auditable schema evolution.

Typical examples include:

- Orders and order lines.
- Payments and financial ledgers.
- Inventory reservations.
- Users, roles, and permissions.
- Contracts and billing records.
- Product metadata with structured relationships.

### Azure SQL Database

Azure SQL Database provides managed relational storage with:

- SQL Server compatibility.
- ACID transactions.
- Indexes and Query Store.
- Automated backups.
- Point-in-time restore.
- Built-in high availability.
- Zone redundancy and geo-replication options.
- Microsoft Entra authentication.
- Private networking.

It is a good fit when the main problem is structured transactional data.

It is a poor fit when:

- Most data consists of multi-megabyte or gigabyte binary objects.
- The dominant access pattern is whole-object upload and download.
- The workload requires massive low-cost archival capacity.
- Data is only a disposable key-value copy.

Azure SQL can store binary data, but technical possibility does not make it operationally or economically appropriate.

### Relational Modeling

Normalize transactional data enough to maintain integrity and avoid conflicting copies. Denormalize only for measured performance or read-model needs.

For example:

```sql
CREATE TABLE Orders
(
    OrderId uniqueidentifier NOT NULL PRIMARY KEY,
    CustomerId uniqueidentifier NOT NULL,
    Status varchar(30) NOT NULL,
    TotalAmount decimal(18, 2) NOT NULL,
    InvoiceBlobName nvarchar(500) NULL,
    CreatedAt datetime2 NOT NULL,
    RowVersion rowversion NOT NULL
);

CREATE TABLE OrderLines
(
    OrderId uniqueidentifier NOT NULL,
    LineNumber int NOT NULL,
    ProductId uniqueidentifier NOT NULL,
    Quantity int NOT NULL,
    UnitPrice decimal(18, 2) NOT NULL,
    CONSTRAINT PK_OrderLines PRIMARY KEY (OrderId, LineNumber),
    CONSTRAINT FK_OrderLines_Orders
        FOREIGN KEY (OrderId) REFERENCES Orders(OrderId)
);
```

The database stores the invoice object's name or identifier, not necessarily the invoice bytes.

### Object Workloads

Object storage treats each item as an opaque byte sequence plus metadata. Access is primarily by account, container, and object name.

Azure Blob Storage is appropriate for:

- Images and videos.
- Documents and invoices.
- User uploads.
- Backups.
- Logs and exports.
- Data lake files.
- Large immutable datasets.
- Long-term archive.

Blob Storage provides:

- Very large scale.
- Low capacity cost.
- Streaming upload and download.
- Access tiers.
- Lifecycle management.
- Redundancy choices.
- Versioning and soft delete.
- WORM immutability.
- Metadata and blob index tags.

It does not provide relational joins, foreign keys, or arbitrary SQL transactions across business records.

### Store Metadata Separately from Content

A common pattern is:

- Store binary content in Blob Storage.
- Store searchable business metadata in Azure SQL Database.

Example metadata includes:

- Document ID.
- Owner and tenant.
- Blob name.
- Original filename.
- Content type.
- Size.
- Checksum.
- Processing status.
- Retention classification.
- Created timestamp.
- Authorization attributes.

Do not trust user-provided blob names or content types as authoritative metadata. Generate server-controlled object names and validate uploads.

### Blob Naming and Identity

A blob name is a storage identifier, not necessarily the business identity.

Prefer:

```text
documents/{tenant-id}/{document-id}/{version-id}
```

Avoid using a mutable filename as the only identity. Business metadata can map a user-visible name to an immutable object identifier.

This design supports:

- Duplicate filenames.
- Versioning.
- Tenant isolation.
- Renaming without copying large objects.
- Stable links between SQL records and Blob Storage.

### Cache Workloads

A cache is appropriate for data that:

- Is read frequently.
- Can be located by a stable key.
- Is expensive to calculate or fetch repeatedly.
- Can tolerate bounded staleness.
- Can be rebuilt or reloaded.
- Benefits from sub-millisecond or low-millisecond access.

Examples include:

- Product summaries.
- Configuration projections.
- Authorization-independent reference data.
- Rendered fragments.
- Rate-limit counters.
- Session state.
- Short-lived idempotency markers.

Azure Managed Redis is the current Azure managed Redis service. Azure Cache for Redis has announced retirement timelines and should not be the default for new designs.

### Cache Is Not a Database Replacement

Redis provides powerful data structures and persistence options, but a cache role should remain distinguishable from an authoritative role.

For a product cache:

```text
Source of truth: Azure SQL Database
Derived copy: Azure Managed Redis
Rebuild path: query SQL and repopulate Redis
Freshness: 10-minute TTL plus invalidation on writes
Failure behavior: bypass Redis with source protection
```

For an order:

```text
Source of truth: Azure SQL Database
Cached summary: optional Redis projection
Invoice bytes: Blob Storage
```

Do not commit an order only to Redis and plan to "write it to SQL later" unless the system deliberately implements durable messaging, idempotency, and recovery for every failure window.

### Access Patterns Drive Selection

| Access pattern | Best starting model |
| --- | --- |
| Join customers, orders, and payments | Relational |
| Atomically reserve inventory and create an order | Relational |
| Download a known PDF by ID | Object |
| Stream a large video | Object |
| Keep seven years of immutable reports | Object with immutability |
| Read product summary by ID at very high frequency | Cache backed by durable store |
| Share short-lived session state | Cache |
| Query arbitrary fields inside millions of objects | Store indexed metadata or use a search/document model |

The table identifies a starting point. Security, scale, latency, compliance, and cost can change the final choice.

### Transaction Boundaries

Azure SQL Database can enforce a transaction across related rows within the database. Blob Storage and Redis participate in different consistency models and cannot be casually added to that SQL transaction.

Consider:

1. Insert document metadata into SQL.
2. Upload content to Blob Storage.
3. Add a Redis cache entry.

If step 2 fails after step 1 commits, the system has metadata without content. If the upload succeeds but SQL fails, the system has an orphaned blob.

The architecture needs a workflow rather than pretending there is one distributed transaction.

Options include:

- Upload first to a temporary blob, then commit metadata and finalize asynchronously.
- Commit metadata with a `PendingUpload` status and reconcile.
- Use an outbox event after the SQL transaction commits.
- Run a cleanup job for orphaned temporary blobs.
- Make each step idempotent.

Business state should represent partial progress explicitly.

### Example Document Upload Workflow

A robust workflow can be:

1. Authenticate and authorize the user.
2. Create a SQL document record in `PendingUpload`.
3. Issue a short-lived, narrowly scoped upload authorization.
4. Upload to a quarantine container.
5. Validate size, checksum, type, and malware scan result.
6. Copy or move the approved content to its final location.
7. Update SQL state to `Available`.
8. Publish an outbox event.
9. Invalidate or populate Redis projections.
10. Delete abandoned uploads after a retention window.

Each step should tolerate retries without creating duplicate records or exposing unscanned content.

### Consistency Models

Different stores can expose different consistency behavior:

- SQL transactions can provide strong consistency inside their boundary.
- Blob reads support object-level consistency, but workflows across SQL and Blob are not one atomic transaction.
- Redis cache-aside is usually eventually consistent with its source.
- Geo-replication introduces additional lag and failover considerations.

Classify operations:

- **Must be current:** Payment state, authorization, inventory reservation.
- **Can be briefly stale:** Product description, rendered content, recommendations.
- **Can be asynchronous:** Thumbnail generation, search indexing, analytics export.

Do not use a stale cache for a decision that requires current authoritative data.

### Cache Invalidation

For a SQL-backed cache:

1. Commit the SQL update.
2. Delete or update the Redis key.
3. Allow cache-aside to repopulate on the next read.

If invalidation fails after SQL commits, the old value remains until TTL. The system should choose:

- A sufficiently short TTL.
- An outbox event to retry invalidation.
- Versioned keys using a source version.
- Direct cache update where concurrency is controlled.

There is no universal perfect invalidation strategy. The answer depends on freshness requirements and failure tolerance.

### Write-Through and Write-Behind

**Write-through** updates the durable store and cache as part of the write path. It can improve immediate cache freshness but adds latency and partial-failure handling.

**Write-behind** accepts changes in a cache or queue and writes to the durable store later. It can improve write throughput but risks data loss, ordering problems, and complex recovery.

For critical business data, prefer writing the authoritative transactional store first and deriving caches asynchronously or through invalidation. Write-behind requires a durable event log, idempotent consumers, and explicit consistency guarantees.

### Performance and Latency

Match performance expectations to the storage role:

- Redis provides the lowest key lookup latency but limited memory and richer operational constraints.
- Azure SQL provides indexed transactional queries but costs more per operation than a cache.
- Blob Storage provides scalable object throughput, not relational query latency.

Network location matters. A fast store in another region can be slower than a suitable store near the application.

Measure:

- P50, P95, and P99 latency.
- Throughput.
- Concurrency.
- Payload size.
- Database query plans.
- Redis hit ratio and network bandwidth.
- Blob transaction and egress cost.

### Scalability

Azure SQL scales through:

- Compute and service-tier changes.
- Elastic pools.
- Read replicas.
- Hyperscale.
- Partitioning and sharding when justified.

Blob Storage scales by partitioning object names internally and supports very large object counts and capacity. Applications should use parallel transfers and avoid a single request bottleneck.

Redis scales through:

- Larger memory and compute tiers.
- Clustering and shards.
- Key distribution.
- Read and write pattern optimization.

Scaling one store does not solve a poor model. Large videos do not become relational because the SQL tier is larger, and unbounded cache values do not become safe because Redis has more memory.

### Durability and Recovery

Durability requirements differ by role:

- SQL requires backups, point-in-time restore, high availability, and regional DR according to RPO and RTO.
- Blob requires redundancy, soft delete, versioning, lifecycle, and possibly immutability.
- Redis cache data may be rebuilt, while session or state use can justify HA and persistence.

Create a data recovery matrix:

| Data | Authority | RPO | RTO | Recovery method |
| --- | --- | --- | --- | --- |
| Orders | SQL | Minutes or lower | Business-defined | Failover or restore |
| Invoice PDF | Blob | Business-defined | Business-defined | Redundant copy or version |
| Product cache | Redis | No guaranteed retention | Seconds to rebuild | Reload from SQL |
| User session | Redis | Session loss may be accepted | Reauthenticate | New session |

The matrix prevents accidental overengineering of disposable data and underprotection of critical records.

### Availability and Dependency Chains

Adding stores adds dependencies. A request that requires SQL, Blob Storage, and Redis can fail when any one is unavailable.

Design the request path deliberately:

- Product page can load SQL data if Redis fails.
- Document metadata can load without downloading the blob.
- An unavailable thumbnail should not block order submission.
- A failed cache invalidation can be retried asynchronously.

Do not put every store on every synchronous request path.

### Security and Authorization

Each store needs independent controls:

**Azure SQL Database**

- Microsoft Entra authentication.
- Managed identity.
- Least-privilege database roles.
- Private endpoint.
- Restricted public access.
- Auditing and threat detection.

**Blob Storage**

- Data-plane RBAC.
- Managed identity.
- User delegation SAS for temporary delegated access.
- Private endpoint.
- Disabled public container access.
- Safe content-disposition and scanning for uploads.

**Azure Managed Redis**

- Microsoft Entra ID authentication.
- Private endpoint.
- TLS.
- Separate instances for trust boundaries.
- No sensitive values without a clear protection design.

Authorization should be checked using authoritative business rules before issuing a blob download or returning cached tenant data. A hard-to-guess key or blob name is not authorization.

### Tenant Isolation

Multi-tenant design should include the tenant in:

- SQL ownership and query filters.
- Blob container or object naming strategy.
- Redis key namespace.
- Authorization checks.
- Monitoring dimensions.

Example:

```text
SQL: Documents.TenantId
Blob: documents/{tenant-id}/{document-id}
Redis: prod:documents:{tenant-id}:{document-id}:v2
```

Never rely only on a client-provided tenant ID. Derive tenant context from authenticated identity and enforce it at every data-access boundary.

### Data Lifecycle

Different stores have different lifecycle mechanisms:

- SQL uses retention jobs, archival tables, temporal history, and backup policies.
- Blob Storage uses access tiers, lifecycle management, soft delete, versioning, and immutability.
- Redis uses TTL and eviction.

These concepts are not equivalent:

- A Redis TTL is not a compliance retention policy.
- Blob archive is not a relational archive table.
- SQL backup retention does not provide an online object archive.

Use the lifecycle feature that matches the business requirement.

### Cost Model

Consider:

**Azure SQL Database**

- Provisioned or serverless compute.
- Storage and backup retention.
- Read replicas and geo-secondaries.
- Licensing benefits and reservations.

**Blob Storage**

- Capacity by tier.
- Operations.
- Retrieval.
- Early deletion.
- Replication and egress.
- Versions, snapshots, and soft-deleted data.

**Azure Managed Redis**

- Provisioned memory and compute.
- HA replicas.
- Persistence.
- Geo-replication.
- Network throughput and tier.

Caching can reduce database compute cost, but a large Redis instance with a low hit ratio can cost more than the queries it avoids.

### Polyglot Persistence

Polyglot persistence means using different storage models for different workload needs.

It is justified when:

- Access patterns materially differ.
- Data lifecycle differs.
- One store cannot meet scale or cost requirements.
- A derived store creates measurable performance value.

It adds:

- More infrastructure.
- More identities and network rules.
- Data synchronization.
- More failure combinations.
- More monitoring and backup procedures.
- More developer expertise.

Use the fewest stores that meet the requirements. A small application with moderate structured data can often begin with Azure SQL and Blob Storage, adding Redis only after repeated reads or shared state justify it.

### Decision Matrix

| Requirement | Azure SQL Database | Blob Storage | Azure Managed Redis |
| --- | --- | --- | --- |
| Strong multi-record transaction | Strong fit | Poor fit | Limited and model-specific |
| Relational joins and constraints | Strong fit | No | No |
| Large binary objects | Possible but usually inefficient | Strong fit | Poor fit |
| Low-cost archive | Poor fit | Strong fit | Poor fit |
| Key lookup latency | Moderate to low with indexes | Object lookup | Strong fit |
| Disposable derived data | Possible but wasteful | Possible | Strong fit |
| Shared session state | Possible but heavier | Poor fit | Strong fit |
| WORM retention | Not the primary object feature | Strong fit | Poor fit |
| Arbitrary SQL querying | Strong fit | No | No |
| Rebuildable cache | Source can rebuild it | Source can rebuild it | Destination |

### Example E-Commerce Architecture

**Azure SQL Database**

- Products and prices.
- Customers.
- Orders and order lines.
- Inventory reservations.
- Payment state.
- Document metadata.

**Blob Storage**

- Product media.
- User-uploaded attachments.
- Generated invoices.
- Export files.
- Audit archives.

**Azure Managed Redis**

- Product summary cache.
- Distributed sessions.
- Temporary carts when loss is acceptable, or a cache over durable carts.
- Rate-limit counters.
- Idempotency records with suitable durability analysis.

Request flow for a product page:

1. Read product projection from Redis.
2. On miss, query SQL.
3. Cache the projection with TTL and jitter.
4. Return image URLs that resolve to Blob Storage through an authorized delivery path.

Order submission bypasses cached prices for final validation and writes the authoritative SQL transaction.

### Example Reporting Workflow

1. A scheduled process queries structured data from SQL.
2. It writes a CSV or Parquet report to Blob Storage.
3. It stores report metadata and status in SQL.
4. It caches report-list summaries in Redis.
5. Lifecycle policy moves old reports to cooler tiers.
6. Immutability protects finalized regulatory reports.

Redis never becomes the only copy of the report or its legal status.

### Reconciliation

Cross-store workflows need reconciliation:

- Find SQL document rows whose blob does not exist.
- Find old temporary blobs without SQL ownership.
- Detect stale Redis projections using version numbers.
- Retry failed cache invalidation from an outbox.
- Verify generated files using checksums.

Reconciliation turns partial failures from silent corruption into detectable, repairable states.

### Observability

Track end-to-end metrics:

- SQL query latency, resource use, and failures.
- Blob operation latency, status codes, throughput, and cost.
- Redis hit ratio, latency, evictions, and timeouts.
- Cache fallback rate.
- Cross-store workflow backlog.
- Orphan and reconciliation counts.
- Data freshness.

Use correlation IDs so a request can be traced across database, object storage, cache, and asynchronous processing.

### Common Mistakes

Common mistakes include:

- Selecting a product before defining access patterns.
- Storing large binaries in SQL without a measured reason.
- Storing business metadata only in blob names.
- Treating Redis as the only copy of critical data.
- Using Blob Storage as if it supports relational filtering and transactions.
- Caching authorization decisions too broadly.
- Updating SQL, Blob, and Redis as if one distributed transaction exists.
- Adding Redis before measuring a latency or database-load problem.
- Using one store for every microservice despite different ownership.
- Using too many stores without operational maturity.
- Failing to define rebuild and reconciliation paths.
- Ignoring backup, restore, retention, and cost for derived copies.

### Best-Practice Selection Process

A practical process is:

1. Identify the authoritative business records.
2. Document data shape, size, queries, writes, consistency, RPO, RTO, and retention.
3. Choose relational storage for structured transactional integrity.
4. Choose object storage for large binary or archival content.
5. Add Redis only for measured low-latency, shared-state, or throughput requirements.
6. Define transaction boundaries and partial-failure states.
7. Make derived copies rebuildable.
8. Implement idempotency, outbox processing, and reconciliation where stores interact.
9. Apply independent identity, network, encryption, and retention controls.
10. Load-test realistic payloads and failure modes.
11. Measure total cost and operational complexity.
12. Re-evaluate the model when access patterns change.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### When should you choose a relational database?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q01 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Choose a relational database when data has a structured schema, related entities, integrity constraints, and operations that must commit atomically. It is also appropriate for flexible filtering, joins, aggregation, and strong consistency.

Azure SQL Database is a common managed Azure choice for orders, payments, inventory, users, and other transactional business records. It should usually be the source of truth for these records.

##### Key Points to Mention

- Relational stores support ACID transactions.
- Keys and constraints enforce integrity.
- SQL supports joins and indexed queries.
- Structured business records are a strong fit.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q01 -->

#### When should you choose Azure Blob Storage?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q02 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Choose Blob Storage for large unstructured objects such as images, videos, documents, backups, logs, and exports. It provides scalable object upload and download, low-cost capacity, access tiers, lifecycle management, redundancy, and immutability.

Store searchable business metadata and relationships in a database when needed. Blob Storage does not provide foreign keys, joins, or multi-record relational transactions.

##### Key Points to Mention

- Blob Storage is optimized for opaque object content.
- It supports streaming and large scale.
- Access tiers reduce long-term capacity cost.
- Use a separate indexed store for rich metadata queries.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q02 -->

#### When should you use Azure Managed Redis?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q03 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Use Azure Managed Redis for low-latency key lookups, frequently read derived data, shared session state, counters, leaderboards, and other short-lived state. It is most valuable when it measurably reduces database load or request latency.

Redis should usually contain rebuildable or intentionally temporary data. Critical business records should remain in a durable authoritative store. Azure Managed Redis is the current service direction because Azure Cache for Redis has announced retirement timelines.

##### Key Points to Mention

- Redis is an in-memory low-latency store.
- It is well suited to cache and session scenarios.
- Cached data should have an authoritative rebuild source.
- New Azure designs should evaluate Azure Managed Redis.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q03 -->

#### What is a system of record?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q04 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A system of record is the authoritative store for a piece of business data. Other copies can be caches, search indexes, reports, or projections, but they should be derived from or reconciled with that authority.

For example, SQL can be authoritative for an order, Blob Storage for the final invoice PDF, and Redis for a disposable cached order summary. Defining authority prevents conflicting updates and clarifies recovery.

##### Key Points to Mention

- Important data needs one clear authority.
- Derived stores require rebuild or reconciliation paths.
- Different parts of one business object can have different authorities.
- Redis cache entries are usually not authoritative.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you store uploaded documents and their metadata?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q01 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Store the binary file in Blob Storage and store business metadata in Azure SQL Database. The SQL record can include document ID, tenant, owner, storage object name, checksum, size, content type, status, retention class, and timestamps.

Use server-generated object names, quarantine and scan untrusted uploads, and expose downloads only after authorization. Handle partial failure with statuses, idempotent steps, temporary blobs, and cleanup or reconciliation jobs rather than assuming SQL and Blob Storage share one transaction.

##### Key Points to Mention

- Blob Storage holds bytes; SQL holds indexed business metadata.
- Generate object identifiers rather than trusting filenames.
- Upload workflows need explicit partial-failure states.
- Authorization must be checked before issuing access.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q01 -->

#### How do you keep a Redis cache consistent with Azure SQL Database?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q02 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use cache-aside. Read Redis first, load from SQL on a miss, and cache with a TTL. On a write, commit the SQL transaction first and then invalidate the Redis key.

Because invalidation can fail, use a TTL as a safety boundary and consider an outbox event, retries, or source-versioned keys when freshness requirements are stricter. Do not use stale cached data for decisions such as final price validation or authorization.

##### Key Points to Mention

- SQL remains authoritative.
- Commit the database update before invalidation.
- TTL bounds stale-data duration.
- Outbox or versioning can improve invalidation reliability.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q02 -->

#### Why is storing large files in a relational database often a poor choice?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q03 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Large binary values increase database storage, backup size, restore time, transaction-log pressure, memory use, and compute cost. They can interfere with the performance and operational lifecycle of transactional records.

Blob Storage is designed for scalable object transfer, tiering, lifecycle management, and archive. The relational database can retain metadata and a stable blob identifier. A measured requirement for atomic binary-and-row transactions can justify alternatives, but it should be explicit.

##### Key Points to Mention

- Binary content affects database backup and log behavior.
- Blob Storage provides object-specific scale and cost features.
- Keep searchable metadata in the database.
- Technical support for binary columns is not the same as good fit.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q03 -->

#### When is polyglot persistence justified?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q04 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

It is justified when access patterns, data shapes, lifecycle, scale, or latency requirements materially differ and one storage model cannot meet them cost-effectively. For example, orders need relational transactions, media needs object storage, and product summaries benefit from caching.

It is not justified merely because multiple technologies are available. Every additional store adds synchronization, identity, networking, monitoring, backup, recovery, and team-skill requirements. Use the fewest stores that meet measured needs.

##### Key Points to Mention

- Different workload models can justify different stores.
- Each store needs a clear responsibility.
- More stores increase operational and consistency complexity.
- Avoid premature fragmentation.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design the data layer for an e-commerce application using relational, object, and cache storage.

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q01 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use Azure SQL Database as the authority for customers, products, prices, inventory reservations, orders, order lines, and payment state. Use transactions and constraints for order creation and inventory consistency.

Use Blob Storage for product media, user attachments, generated invoices, and exports. Store blob identifiers, ownership, checksum, status, and retention metadata in SQL. Use lifecycle and immutability for finalized records where required.

Use Azure Managed Redis for product projections, distributed sessions, rate-limit counters, and temporary carts only when their loss model is acceptable. Cache product reads with TTL, jitter, invalidation after SQL commits, and stampede protection. Final order submission must revalidate authoritative prices and inventory in SQL.

##### Key Points to Mention

- SQL owns transactional business records.
- Blob Storage owns large object content.
- Redis accelerates reads and temporary state.
- Order correctness must not depend on stale cache data.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q01 -->

#### How do you handle a workflow that writes both Azure SQL Database and Blob Storage?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q02 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Do not assume a distributed ACID transaction. Model the operation as a state machine with idempotent steps. For example, create a SQL record in `PendingUpload`, upload to a temporary or quarantine blob, validate it, finalize the object, then mark the record `Available`.

Use an outbox for downstream events, retry failed steps, and run reconciliation for metadata without blobs and orphaned blobs without metadata. Generate stable operation IDs so a retry does not create duplicate records or objects.

##### Key Points to Mention

- Cross-service operations have partial-failure windows.
- Persist workflow state explicitly.
- Make every step idempotent.
- Outbox, cleanup, and reconciliation repair incomplete work.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q02 -->

#### How would you decide whether a new Redis cache is worth adding?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q03 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Measure the current bottleneck: repeated query rate, source latency, CPU or I/O load, data reuse, acceptable staleness, and expected hit ratio. Estimate Redis memory, throughput, network, HA, and operational cost, then compare it with database tuning, indexes, read replicas, local caching, or precomputed SQL projections.

Prototype cache-aside and load-test warm cache, cold cache, mass expiration, Redis failure, and source fallback. Add Redis only if it improves an end-to-end objective without creating unacceptable consistency or availability risk.

##### Key Points to Mention

- Start from a measured performance or scaling problem.
- Compare caching with simpler database optimizations.
- Include failure and fallback behavior in testing.
- Evaluate total cost and operational ownership.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q03 -->

#### How would you define disaster recovery across SQL, Blob Storage, and Redis?

<!-- question:start:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q04 -->
<!-- question-id:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Classify each dataset and define independent RPO and RTO. Azure SQL may use backups and a failover group. Blob Storage may use zone or geo redundancy, versioning, soft delete, and immutable retention. A disposable Redis cache can be rebuilt, while session or state workloads may justify HA, persistence, or geo-replication.

The runbook must preserve references between stores. After regional failover, SQL metadata must point to reachable blob content, identities and private DNS must work, and cache entries may need rebuilding. Test complete application failover and failback rather than testing each resource in isolation.

##### Key Points to Mention

- Recovery requirements differ by data role.
- Disposable cache does not need the same RPO as orders.
- Cross-store references and networking must work in the recovery region.
- Test application-level recovery, reconciliation, and failback.

<!-- question:end:matching-storage-choices-to-relational-object-and-cache-workloads-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
