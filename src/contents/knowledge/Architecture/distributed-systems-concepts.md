---
id: distributed-systems-concepts
topic: Distributed Systems Concepts (CAP Theorem, Event Sourcing, Load Balancing, Consistent Hashing)
category: Design & Architecture
---

## Overview

Modern cloud systems are typically **distributed systems**, meaning they run across multiple machines or nodes.

Understanding key distributed system concepts helps design systems that are:

- scalable
- resilient
- fault tolerant
- highly available

Important foundational concepts include:

- CAP Theorem
- Event Sourcing
- Load Balancing
- Consistent Hashing

---

#  CAP Theorem

The **CAP theorem** is a fundamental principle describing the trade-offs distributed systems must make when network failures occur.

CAP stands for:

- **C — Consistency**
- **A — Availability**
- **P — Partition Tolerance**

### Definition

When a **network partition occurs**, a distributed system must choose between:

- **Consistency** — all nodes return the same latest data
- **Availability** — every request receives a response

Both cannot be guaranteed simultaneously during a partition.

When a partition happens:
choose C or A


---

## What Each Property Means

### Consistency

All nodes return the **same, most recent data**.

Example:

```

User updates balance to 100
All nodes immediately return 100

```

---

### Availability

The system **always returns a response**, even if some nodes have outdated data.

Example:

```

Node A returns balance = 90
Node B returns balance = 100
System still responds

```

---

### Partition Tolerance

The system **continues operating despite network failures between nodes**.

Example:

```

Node A cannot communicate with Node B
System must still function

```

---

## Easy Memory Trick

```

C = Correct data
A = Always responds
P = Network survives failures

```

During network partitions:

```

Choose C or A

```

---

#  CAP in Real Systems

## Redis Cache (AP-Leaning System)

Redis commonly favors:

```

Availability + Partition Tolerance

```

Why?

Caches can tolerate **temporary inconsistencies**.

Example:

```

Cache returns slightly outdated value
but system remains responsive

```

---

## Message Queues (AP-Leaning Systems)

Examples:

- Azure Service Bus
- RabbitMQ
- Kafka

They prioritize:

```

Availability + Partition Tolerance

```

Messages may arrive **later or temporarily out of order**, but the system continues operating.

---

## SQL vs NoSQL (Classic CAP Example)

### Traditional SQL Databases (CP-Leaning)

Examples:

- SQL Server
- PostgreSQL

Focus:

```

Consistency + Partition Tolerance

```

If replication breaks:

```

Database may reject writes

```

Goal: protect **data correctness**.

---

### Distributed NoSQL Databases (AP-Leaning)

Examples:

- Cassandra
- DynamoDB
- Azure Cosmos DB (eventual consistency)

Behavior:

```

Always accept writes
Synchronize later

```

Result:

```

System stays available
Reads may temporarily differ

```

---

#  Event Sourcing

Event Sourcing is an architectural pattern where **system state is derived from a sequence of events** rather than storing the current state directly.

Core idea:

```

State = replay(events)

```

---

## Traditional CRUD Model

Databases store **only the current state**.

Example table:

| Id | Status | Total |
|----|--------|------|
| 123 | Paid | 50 |

Update example:

```

UPDATE Orders
SET Status = 'Paid'

```

Problem:

Historical state is lost unless **audit logging** is implemented.

---

## Event Sourcing Model

Instead of storing the current state, the system stores **events**.

Event store example:

| EventId | AggregateId | EventType | Data |
|--------|------------|-----------|------|
| 1 | 123 | OrderCreated | {...} |
| 2 | 123 | ItemAdded | {...} |
| 3 | 123 | OrderPaid | {...} |

State is reconstructed by replaying events.

```

OrderCreated
ItemAdded
OrderPaid
→ Final state = Paid

```

---

#  Why Use Event Sourcing

## Full Audit History

You know exactly:

```

Who changed what
When
Why

```

No additional audit tables required.

---

## Time Travel

You can reconstruct system state at any point in time.

Example:

```

Order state at 10:01 AM

```

---

## Debugging Power

Production events can be **replayed locally** for debugging.

---

## Natural Fit for Event-Driven Systems

Events already represent business activity.

---

## Enables CQRS Naturally

Typical architecture:

```

Command → Event → Read Model Projection

```

- Write model = events
- Read model = projections

---

#  Load Balancing

Load balancing distributes incoming requests across multiple servers to improve:

- performance
- scalability
- availability

Without load balancing:

```

Client → Server A

```

With load balancing:

```

Client → Load Balancer
↓
Server A
Server B
Server C

```

Requests are distributed across servers.

---

## Common Load Balancing Algorithms

### Round Robin

Requests rotate sequentially between servers.

```

Request1 → ServerA
Request2 → ServerB
Request3 → ServerC

```

---

### Least Connections

Requests are sent to the server with the **fewest active connections**.

---

### Weighted Routing

More powerful servers receive **a larger share of traffic**.

---

## Azure Example

Azure API Management (APIM) can distribute requests across multiple APIs.

However:

**APIM is primarily an API Gateway**, not a dedicated load balancer.

Better load balancing options in Azure:

- **Azure Application Gateway (Layer 7)**
- **Azure Front Door (global load balancing)**

Typical architecture:

```

Client
↓
Azure Front Door
↓
API Management
↓
Multiple .NET APIs

```

---

# Consistent Hashing

Consistent hashing distributes keys across nodes while **minimizing key redistribution when nodes change**.

Common uses:

- distributed caches
- load balancing
- distributed databases

Examples:

- Redis Cluster
- Cassandra
- DynamoDB
- CDN routing

---

## Problem with Traditional Hashing

Classic hashing:

```

server = hash(key) % number_of_servers

```

If the number of servers changes:

```

Most keys must be reassigned

```

This causes large-scale cache invalidation.

---

## Consistent Hashing Solution

Servers and keys are placed on a **circular hash ring**.

Example ring:

```

0 ---------------------- 2^32

```

Servers:


hash(ServerA) → position 20
hash(ServerB) → position 70
hash(ServerC) → position 140



Keys are assigned to the **next server clockwise**.

Example:

![Unit test example](../knowledge-images/conhash.png)

Key(60) → ServerB
Key(160) → ServerA (wrap-around)



Rule:



A key belongs to the first server clockwise on the ring



---

## Major Benefit

When a server is added or removed:



Only a small subset of keys move



This allows **highly scalable distributed systems**.

---

# Quick Interview Summary

### CAP Theorem


Distributed systems must choose between
Consistency and Availability during network partitions.



---

### Event Sourcing


Store state changes as events instead of storing current state.



---

### Load Balancing



Distribute requests across multiple servers.


---

### Consistent Hashing



Distribute keys across nodes while minimizing redistribution.

---

## Notes

1. **Redis consistency**

Redis is typically **AP-leaning**, but Redis Cluster configurations can provide stronger consistency guarantees depending on replication and failover settings.

2. **Cosmos DB consistency levels**

Azure Cosmos DB supports multiple consistency levels:

* Strong
* Bounded Staleness
* Session
* Consistent Prefix
* Eventual

This allows systems to choose different trade-offs between consistency and availability.

3. **Event sourcing integrations**

Event sourcing is often used together with:

* CQRS
* event-driven architecture
* messaging platforms (Kafka, Azure Service Bus, EventStoreDB)

However, **CQRS does not require event sourcing**.
