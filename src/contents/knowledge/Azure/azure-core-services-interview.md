---
id: azure-core-services-interview
topic: Azure Core Services Interview Notes
category: Azure
---

# Azure Blob Storage

## What is Azure Blob Storage?

Azure Blob Storage is Microsoft’s object storage service for storing large amounts of unstructured data such as:

- Images
- Videos
- Documents
- Backups
- Logs
- Binary files

It is optimized for:

- Massive scalability
- High durability
- HTTP-based access

---

## Types of Blobs

| Type        | Use Case                                      |
|------------|-----------------------------------------------|
| Block Blob | Files, images, documents (most common)       |
| Append Blob| Logging scenarios (append-only)              |
| Page Blob  | Random read/write (used by Azure VM disks)   |

---

## Storage Hierarchy

```

Storage Account
└── Container
└── Blob

```

Conceptually similar to:

```

Account + Folder + File

````

---

## What is a Container?

A container is a logical grouping of blobs, similar to a folder or bucket.

---

## Authentication Methods

1. Account Key (not recommended for applications)
2. Shared Access Signature (SAS) ✓ Common
3. Azure AD / Managed Identity ✓ Best practice
4. Public access (optional)

---

## Uploading Large Files Efficiently

Use **Block Blob upload**.

Process:

1. Split file into blocks
2. Upload blocks
3. Commit block list

The Azure SDK handles this automatically.

---

## Blob Clients in .NET

```csharp
// BlobServiceClient → Storage account
// BlobContainerClient → Container operations
// BlobClient → Blob operations

var service = new BlobServiceClient(conn);
var container = service.GetBlobContainerClient("files");
var blob = container.GetBlobClient("a.pdf");
````

---

# Azure Functions

## What is Azure Functions?

Azure Functions is a serverless compute service that allows you to run code triggered by events without managing servers.

### Key Characteristics

* Event-driven
* Auto-scaling
* Pay-per-execution
* Managed infrastructure

### Common Use Cases

* Background jobs
* File processing
* Integrations
* APIs
* Message processing

---

## What is Serverless?

Serverless means:

* No server management
* Automatic scaling
* Billing based on execution time

You still write backend code — Azure manages the runtime and scaling.

---

## Cold Start

Cold start is the delay that occurs when Azure starts a new function instance after inactivity.

Occurs primarily in:

* Consumption plan

### Solutions

* Premium plan
* Keep-alive ping
* Warm-up trigger

---

## In-Process vs Isolated Worker Model

### In-Process

* Runs inside the Functions host
* Older model
* Less flexible

### Isolated Worker (Recommended for .NET 8+)

* Runs in a separate process
* Full control over .NET features (DI, config, logging)
* Decoupled from host runtime
* Uses `Microsoft.Azure.Functions.Worker` SDK

### Typical Setup

* Create `Program.cs`
* Call `ConfigureFunctionsWorkerDefaults()`
* Register services via `builder.Services`
* Use constructor injection

---

## Function Timeout

### Consumption Plan

* Default: 5 minutes
* Maximum: 10 minutes

```json
{
  "functionTimeout": "00:05:00"
}
```

Can increase to:

```json
{
  "functionTimeout": "00:10:00"
}
```

Cannot exceed 10 minutes.

---

### Premium Plan

* Default: 30 minutes
* Maximum: Practically configurable (no fixed hard limit)

---

# Azure Service Bus

## What is Azure Service Bus?

Azure Service Bus is a fully managed message broker used for reliable communication between distributed systems using asynchronous messaging.

Enables:

* Decoupled services
* Reliable message delivery
* Background processing
* Event-driven architecture

---

## Main Messaging Entities

| Entity       | Purpose                             |
| ------------ | ----------------------------------- |
| Queue        | One consumer processes each message |
| Topic        | Publish/Subscribe model             |
| Subscription | Virtual queue inside a topic        |

---

## Queue vs Topic

### Queue (Point-to-Point)

```
Producer → Queue → ONE consumer
```

Used for:

* Background jobs
* Task processing

### Topic (Publish/Subscribe)

```
Producer → Topic → Multiple subscriptions
```

Used for:

* Event distribution
* Microservices communication

---

## Sessions

A session is a logical grouping of related messages.

Each message can include:

```
SessionId = "some-key"
```

Guarantee:

Messages with the same `SessionId` are delivered sequentially to one consumer at a time.

---

# Azure Cosmos DB

## What is Azure Cosmos DB?

Azure Cosmos DB is a globally distributed, multi-model NoSQL database designed for:

* Low latency (single-digit ms)
* Massive scalability
* Automatic indexing
* Multi-region replication

### Supported APIs

* Core (SQL API) ✓ Most common
* MongoDB API
* Cassandra API
* Table API
* Gremlin API

---

## Example Document

```json
{
  "id": "order-1",
  "customerId": "c1",
  "total": 120
}
```

---

## Is Cosmos DB Relational?

No.

Cosmos DB is a NoSQL document database storing JSON documents.

---

## Storage Terminology Mapping

| SQL      | Cosmos DB |
| -------- | --------- |
| Database | Database  |
| Table    | Container |
| Row      | Document  |

---

## What is RU/s?

RU = Request Units

Represents the normalized cost of operations.

Approximate costs:

* Point read → ~1 RU
* Insert → 5–10 RU
* Complex query → Higher RU

Throughput is provisioned in RU/s.

---

## Choosing a Good Partition Key

This is the **biggest cost factor** in Cosmos DB.

### Good Characteristics

* High cardinality
* Even distribution
* Frequently used in queries

Good examples:

* userId
* orderId
* tenantId

Bad examples:

* country
* status
* boolean flag

Bad partition keys create hot partitions:

* One partition overloaded
* 429 throttling
* Need higher RU/s
* Increased cost

---

## Prefer Point Reads Over Queries

Point read requires:

* `id`
* `partitionKey`

Cost:

~1 RU

```csharp
await container.ReadItemAsync<Order>(
    id,
    new PartitionKey(tenantId));
```

---

## Query (More Expensive)

```sql
SELECT * FROM c WHERE c.customerId = "A"
```

Cost:

5–100+ RU depending on data and indexing.

---

## Avoid Cross-Partition Queries

Bad:

```sql
SELECT * FROM c WHERE c.status = "Active"
```

Scans all partitions.

Better:

```sql
SELECT * FROM c
WHERE c.tenantId = "T1"
AND c.status = "Active"
```

Scans a single partition.

---

## Customize Indexing Policy

Default behavior:

* Everything is indexed.

Example customization:

```json
{
  "indexingMode": "consistent",
  "includedPaths": [
    { "path": "/id/?" },
    { "path": "/tenantId/?" }
  ],
  "excludedPaths": [
    { "path": "/*" }
  ]
}
```

Benefits:

* Cheaper writes
* Lower RU consumption

---

## Reduce Document Size

RU cost increases with document size.

Bad design:

```json
{
  "id": "1",
  "hugeAuditHistory": [...]
}
```

Better approaches:

* Split large data
* Archive old data
* Store large payloads in Blob Storage

Common pattern:

* Cosmos DB → Metadata
* Blob Storage → Large payload

---

## Notes

1. Consumption plan timeout (5 default, 10 max) is accurate.
2. Premium plan can exceed 30 minutes; practically configurable.
3. RU examples are approximate and workload-dependent.
4. Indexing policy examples require correct included/excluded path ordering in real deployments.
5. Partition key guidance is correct but always workload-specific.
```

