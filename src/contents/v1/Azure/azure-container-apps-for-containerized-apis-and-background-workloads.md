---
id: azure-container-apps-for-containerized-apis-and-background-workloads
topic: Azure compute choices and hosting models
subtopic: Azure Container Apps for containerized APIs and background workloads
category: Azure
---

## Overview

Azure Container Apps is a managed, serverless container platform for running APIs, web applications, microservices, continuously running background services, event-driven workers, and finite-duration jobs. It is built on Kubernetes and technologies such as KEDA, Envoy, and optional Dapr integration, but it hides the Kubernetes control plane and native Kubernetes APIs from application teams.

The platform is intended for teams that want container packaging and cloud-native deployment features without operating a Kubernetes cluster. Azure manages operating-system updates, orchestration infrastructure, replica placement, load balancing, environment maintenance, and much of the scaling mechanism. The application team remains responsible for the container image, application behavior, resource configuration, scale rules, security configuration, observability, data, and downstream capacity.

Common uses include:

- Public or internal ASP.NET Core APIs.
- Backend-for-frontend services.
- Independently deployable microservices.
- Queue and event consumers.
- Long-running background processors.
- Scheduled reports and maintenance tasks.
- On-demand data migration or processing jobs.
- Event-triggered batch work.
- Containerized Azure Functions.
- Applications that benefit from revision-based deployments and traffic splitting.

Container Apps provides two related compute resource types:

- **Container apps** run continuously as services. They can still scale to zero when their scale rules permit it, but the service is conceptually available whenever traffic or events arrive.
- **Container Apps jobs** start, perform finite work, and stop. Jobs can be triggered manually, on a schedule, or by an event.

This distinction matters. An HTTP API belongs in a container app with ingress. A continuously polling queue consumer can also be an app. A nightly report that exits when complete is usually a scheduled job. A process that handles one message or a small batch and then exits can be an event-driven job.

For interviews, candidates should be able to explain not only that Container Apps runs containers, but also:

- How environments, apps, revisions, replicas, jobs, and executions relate.
- When to use an app versus a job.
- How ingress and service discovery support APIs and microservices.
- How HTTP, TCP, CPU, memory, and KEDA-based event scaling work.
- Why scale to zero affects latency and reliability design.
- How Consumption, Dedicated, and preview Flexible workload profiles differ.
- How revisions enable rollout and rollback.
- How managed identity, networking, secrets, and observability fit into production.
- When App Service, Azure Functions, AKS, Azure Container Instances, or virtual machines are a better choice.

## Core Concepts

### What Azure Container Apps Manages

Azure Container Apps manages the orchestration layer that would otherwise require direct Kubernetes or virtual-machine operations. The platform handles:

- Replica creation and removal.
- Container restart after failure.
- Managed ingress and TLS termination.
- Internal service discovery.
- Revision lifecycle.
- Traffic splitting.
- Environment infrastructure.
- KEDA integration for autoscaling.
- Runtime and infrastructure maintenance.

The team still owns:

- Building, scanning, and publishing container images.
- Application and framework patching inside the image.
- CPU and memory requests.
- Scale limits and trigger thresholds.
- Identity and authorization.
- Network exposure and egress requirements.
- Health probes and graceful termination.
- Logs, metrics, traces, alerts, and runbooks.
- Data consistency, retries, idempotency, and poison-message handling.

Managed infrastructure reduces operational work; it does not remove application operations.

### Resource Model

Important Container Apps concepts are:

| Resource | Meaning |
| --- | --- |
| Environment | Secure boundary containing apps and jobs, with shared networking and logging configuration |
| Container app | Continuously available service definition |
| Revision | Immutable versioned snapshot of an app's revision-scoped configuration |
| Replica | Running instance of one revision |
| Job | Definition for finite-duration containerized work |
| Job execution | One triggered run of a job |
| Job replica | Container instance participating in one job execution |
| Workload profile | Compute and billing model available within an environment |

Multiple apps in one environment share the environment network and log destination. They can communicate by app name using built-in service discovery. Use separate environments when workloads require stronger isolation, separate networks or logging destinations, or separation between production and nonproduction.

### Container Requirements

Container Apps supports Linux `linux/amd64` images from public or private registries. The application can use any language or runtime that works in that container format.

A production image should:

- Use a pinned, supported base image.
- Run as a non-root user where practical.
- Be small enough to start quickly.
- Write logs to standard output and standard error.
- Receive configuration through environment variables or mounted configuration.
- Avoid storing durable state in the writable container filesystem.
- Handle termination signals and stop accepting work before shutdown.
- Expose meaningful startup, readiness, and liveness endpoints.
- Be scanned and rebuilt when dependencies or the base image need patches.

Containers improve packaging consistency, but the image is only one part of the deployed system.

### Hosting HTTP APIs

Enable HTTP ingress for APIs and web applications. Managed ingress can provide:

- External or internal exposure.
- TLS termination.
- HTTP/1.1 and HTTP/2.
- WebSocket and gRPC support.
- A platform-provided fully qualified domain name.
- Custom domains and certificates.
- Authentication features and IP restrictions.
- Traffic splitting across revisions.
- Session affinity when required.

External ingress can expose the app through the environment's inbound address. Internal ingress restricts direct access to other apps in the environment. A common design exposes only an API gateway or edge-facing app publicly and keeps backend services internal.

The standard managed HTTP ingress has a request timeout, so work that can take longer than the supported request window should normally be converted into an asynchronous operation:

1. Validate and accept the request.
2. Persist or publish a work item.
3. Return `202 Accepted` and an operation identifier.
4. Process the work in a background app or job.
5. Expose status or notify the caller on completion.

### Stateless API Design

Replicas are created and removed dynamically. APIs should therefore be stateless between requests:

- Store durable business state in external databases or storage.
- Put shared cache state in an external cache.
- Do not depend on local files surviving replica replacement.
- Avoid in-memory session affinity unless there is a justified temporary requirement.
- Make startup repeatable.
- Make operations idempotent where retries are possible.

Session affinity can route a client to the same replica, but it reduces flexibility and does not make local state durable.

### Health Probes

Container Apps supports startup, readiness, and liveness probes:

- **Startup:** Determines whether a slow-starting process has initialized.
- **Readiness:** Determines whether the replica should receive traffic.
- **Liveness:** Determines whether the process should be restarted.

Readiness should fail when the app cannot safely serve requests. Liveness should not fail for every temporary dependency outage, because restarting every replica can make an external incident worse. Health endpoints should be fast and should not expose sensitive diagnostics.

### Container Apps Versus Container Apps Jobs

Use a container app when the process is a service:

- HTTP or TCP server.
- Continuously available queue consumer.
- Event processor that should remain available between events.
- Long-running worker with ongoing state coordination.

Use a job when each execution has a finite end:

- Nightly report.
- Data backfill.
- One-time migration.
- Scheduled cleanup.
- Event-triggered batch.
- On-demand administrative process.
- Ephemeral CI runner.

An app that scales to zero and an event-driven job can appear similar. The difference is lifecycle semantics. An app scales replicas of a continuously defined service. A job creates distinct executions that succeed or fail and then stop.

### Manual, Scheduled, and Event-Driven Jobs

Container Apps jobs support:

- **Manual jobs:** Started through the portal, CLI, or management API.
- **Scheduled jobs:** Started by a five-field cron expression.
- **Event-driven jobs:** Started when a KEDA-supported event source reaches a configured threshold.

Scheduled job expressions use UTC unless the current platform documentation explicitly states otherwise for a selected feature. Account for daylight-saving and business-time requirements in the schedule design.

Job settings include:

- Replica timeout.
- Retry limit.
- Parallelism.
- Required completion count.
- Polling interval for event triggers.
- Minimum and maximum executions for event-driven jobs.

The job's command must return an appropriate exit code. A non-zero exit marks a replica as failed and can trigger configured retries.

### Continuously Running Workers

A queue consumer can run as a normal container app with a custom KEDA rule. This is appropriate when:

- The process continuously listens and handles many messages.
- Connections or in-memory batching are valuable.
- The worker has a long-lived service lifecycle.
- Scaling replicas is a better model than creating separate executions.

The worker must still:

- Use message locks or acknowledgments correctly.
- Renew locks for long processing.
- Be idempotent because delivery can be duplicated.
- Abandon or dead-letter poison messages.
- Stop receiving new messages during graceful shutdown.
- Limit concurrency to protect dependencies.

### KEDA-Based Autoscaling

Container Apps uses KEDA for declarative horizontal scaling. Each active revision can have minimum and maximum replica limits plus one or more scale rules.

Scale rule categories include:

- **HTTP:** Concurrent HTTP requests.
- **TCP:** Concurrent TCP connections.
- **Custom:** CPU, memory, Azure Service Bus, Azure Queue Storage, Event Hubs, Kafka, Redis, and other KEDA-supported event sources.

If several rules exist, a rule reaching its threshold can cause scale-out. Scaling configuration is revision-scoped, so changing it creates a new revision.

A simplified CLI example for an HTTP API is:

```bash
az containerapp create \
  --name orders-api \
  --resource-group rg-commerce \
  --environment commerce-env \
  --image contoso.azurecr.io/orders-api:2026.06.14 \
  --ingress external \
  --target-port 8080 \
  --min-replicas 1 \
  --max-replicas 20 \
  --scale-rule-http-concurrency 50
```

Infrastructure as code should normally define the production configuration instead of relying on one-off commands.

### Minimum and Maximum Replicas

`minReplicas` controls warm capacity:

- `0` permits scale to zero for compatible rules.
- `1` or more avoids zero-replica activation delay and provides baseline capacity.

`maxReplicas` is both a cost and protection boundary. A high platform maximum is not automatically safe. The database, message broker, external APIs, connection pools, and quota limits may fail long before the app reaches the platform limit.

Load testing should determine:

- Sustainable concurrency per replica.
- Startup time.
- Downstream capacity.
- Queue-drain rate.
- Safe maximum replica count.
- Scale-out lag and scale-in behavior.

### Scale to Zero

Scale to zero is useful for sporadic workloads because no replica remains active while idle. It introduces an activation path:

- An event or request must be detected.
- A replica must be scheduled.
- The image and process must start.
- Startup probes must pass.

Use a non-zero minimum for latency-sensitive APIs or workloads with expensive startup. Reduce activation time by keeping images small, avoiding unnecessary startup I/O, and delaying nonessential initialization.

CPU- or memory-only scaling cannot determine demand when no replica is running, so those rules cannot scale an app from zero. Use an external signal such as HTTP traffic or queue depth when scale-to-zero behavior is required.

### Queue Scaling and Backpressure

Queue depth is a useful demand signal, but aggressive scaling can overload downstream systems. Configure scaling around the entire processing path:

- Messages processed per replica.
- Average and tail processing duration.
- Database connection limits.
- External API quotas.
- Lock duration.
- Retry and dead-letter policy.
- Maximum useful parallelism.

Autoscaling increases consumers; it does not increase the capacity of dependencies. Backpressure and bounded concurrency remain application responsibilities.

### Revisions

A revision is an immutable snapshot of revision-scoped app configuration, including the container image, resources, environment variables, probes, and scale rules. Configuration changes create a new revision.

Container Apps supports:

- **Single revision mode:** The platform provisions the new revision and switches traffic after it is ready. The old active revision is deprovisioned.
- **Multiple revision mode:** Several revisions can remain active and receive configured traffic percentages.

Multiple revisions enable:

- Canary releases.
- Blue-green deployment.
- A/B testing.
- Controlled rollback.

Database and message-schema compatibility must span all active versions. Traffic splitting cannot protect a deployment if the new version applies an irreversible incompatible migration.

### Replica Identity and Diagnostics

Each replica belongs to a revision. Include revision and replica context in logs and traces so operators can compare versions during rollout. Important deployment signals include:

- Revision provisioning failures.
- Image pull errors.
- Startup and readiness failures.
- HTTP error rate and latency by revision.
- Replica count and scale events.
- Queue backlog and message age.
- Job execution success, failure, timeout, and retry counts.

### Workload Profiles

Current workload profile environments can provide different compute models:

- **Consumption:** Serverless, per-replica usage, elastic scaling, and optional scale to zero.
- **Dedicated:** Reserved compute in a dedicated pool, billed by workload-profile instance, with general-purpose, memory-optimized, confidential, or GPU options where available.
- **Flexible profile:** A preview option in selected regions that combines consumption-style resource allocation with single-tenant characteristics and dedicated networking. It has availability and scale-to-zero constraints that must be verified before selection.

Consumption is a common starting point for bursty APIs and workers. Dedicated profiles can be more economical or predictable for steady workloads, larger resource requirements, or specialized hardware. Preview features require explicit risk acceptance and should not be assumed available in every region.

### Environment Design

An environment is a network and operational boundary. Apps and jobs in one environment:

- Share a virtual network.
- Share a logging destination.
- Can use built-in name-based communication.
- Can share Dapr configuration when Dapr is enabled.

Use separate environments for:

- Production versus nonproduction.
- Different trust zones.
- Independent network policies.
- Teams requiring separate log destinations.
- Workloads that must not share compute resources.
- Regional deployments.

An environment is regional. A multiregion design requires an environment in each region plus an external global routing layer such as Azure Front Door or Traffic Manager, depending on protocol and requirements.

### Networking

The default workload profiles environment supports Consumption and Dedicated profiles and offers the current networking feature set. Supplying an existing virtual network enables:

- Private endpoint access.
- Network security groups.
- User-defined routes.
- Azure Firewall integration.
- NAT Gateway for controlled outbound addresses.
- Connectivity to private resources.
- Application Gateway integration.

The delegated subnet belongs exclusively to the Container Apps environment. Network type is an important creation-time choice and cannot simply be changed in place later.

At the app level, ingress can be:

- Disabled.
- Internal to the environment.
- External through the environment.

Keep backend workers and services private unless they need direct inbound access.

### Managed Identity and Secrets

Container apps and jobs can use system-assigned or user-assigned managed identities to access Microsoft Entra-protected services. Prefer managed identity over embedded credentials for:

- Azure Container Registry image pulls.
- Azure Key Vault.
- Azure Service Bus.
- Azure Storage.
- Azure SQL and other supported services.
- KEDA scaler authentication where supported.

Grant the smallest required Azure role at the narrowest practical scope.

Container Apps also supports secrets and Key Vault secret references. Secret changes and revision behavior must be understood: application code should tolerate secret rotation, and operational procedures should verify that replicas consume the intended version.

### Dapr Is Optional

Dapr can provide service invocation, pub/sub abstractions, state access, bindings, secret access, and observability integration. It can reduce repeated infrastructure code across polyglot microservices.

Dapr also adds:

- A sidecar and resource overhead.
- Another configuration and versioning surface.
- Dapr-specific APIs and operational knowledge.
- An abstraction that may hide provider-specific behavior.

Use Dapr when its capabilities solve repeated problems across services, not merely because it is available.

### State and Storage

The container filesystem is ephemeral. Durable state should normally be external. Azure Files can be mounted for supported shared-file scenarios, but a mounted file share does not automatically make a horizontally scaled application safe.

Consider:

- Concurrent file access.
- Locking semantics.
- Latency and throughput.
- Regional availability.
- Backup and recovery.
- Migration portability.

Databases, object storage, and queues are generally better fits for cloud-native state than treating replicas as durable servers.

### Observability

Container Apps can send environment, system, console, and HTTP logs through Azure Monitor and Log Analytics. Application code should also emit structured telemetry.

Monitor:

- Request rate, latency, errors, and saturation.
- Replica count and scale events.
- CPU and memory.
- Restart and probe failures.
- Revision deployment health.
- Queue depth and oldest-message age.
- Job execution state and duration.
- Dependency latency and throttling.
- Cost and workload-profile utilization.

Distributed tracing and correlation IDs are important when requests cross several container apps, Dapr sidecars, brokers, or external services.

### Deployment and Infrastructure as Code

Use Bicep, ARM, Terraform, or another controlled infrastructure workflow to define:

- Environment and network.
- Workload profiles.
- App and job configuration.
- Identities and role assignments.
- Registry access.
- Ingress and domains.
- Secrets or Key Vault references.
- Scale rules and limits.
- Diagnostic settings.

Use immutable image tags or digests. A mutable `latest` tag makes rollback and audit difficult because the same configuration can resolve to different image content.

### When Container Apps Is a Strong Fit

Container Apps is a strong candidate when:

- The workload is already containerized.
- The team wants managed orchestration.
- APIs and workers need independent scaling.
- Event-driven scale or scale to zero is useful.
- Revision traffic splitting is valuable.
- Linux containers meet the runtime requirements.
- Direct Kubernetes API access is unnecessary.
- The team wants microservice capabilities without operating clusters.

### When Another Service May Be Better

Consider another option when:

- **App Service:** The workload is primarily a conventional web app or API and App Service deployment slots and web-hosting features provide a simpler model.
- **Azure Functions:** The workload fits the Functions programming model and triggers, bindings, or Durable Functions are more valuable than arbitrary container control.
- **AKS:** The team requires Kubernetes APIs, custom controllers, operators, daemon sets, specialized networking, or cluster-level scheduling control.
- **Azure Container Instances:** The need is a simple isolated container group without application orchestration.
- **Azure Batch:** The workload is large-scale parallel or high-performance batch computing.
- **Virtual machines:** The application requires operating-system access, unsupported software, custom drivers, or full machine control.

### Common Mistakes

- Treating Container Apps as Kubernetes with all Kubernetes APIs available.
- Using jobs for an HTTP service or using a permanent app for work that should end.
- Scaling only on CPU for a queue-driven workload.
- Setting a high replica maximum without checking dependency limits.
- Allowing a latency-sensitive API to scale to zero unintentionally.
- Keeping state in the local container filesystem.
- Exposing every microservice publicly.
- Omitting startup, readiness, or liveness probes.
- Using mutable image tags.
- Assuming traffic splitting solves database compatibility.
- Ignoring duplicate messages and retries.
- Enabling Dapr without a concrete requirement.
- Putting unrelated trust zones and lifecycle environments together.
- Treating platform logs as sufficient application observability.

### Practical Best Practices

- Choose app or job from the process lifecycle.
- Keep API replicas stateless.
- Use event signals that represent real demand.
- Bound maximum scale by downstream capacity.
- Use managed identity and least privilege.
- Keep internal services private.
- Define health probes and graceful shutdown.
- Use revisions with backward-compatible data and contracts.
- Instrument scale, deployment, queue, and dependency behavior.
- Define production configuration as code.
- Test cold starts, load, retries, and rollback.
- Verify current regional availability, quotas, and preview status before committing to a profile or feature.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Azure Container Apps?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q01 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Azure Container Apps is a managed, serverless platform for running Linux containers without directly managing Kubernetes infrastructure. It supports APIs, microservices, continuously running workers, event-driven applications, and finite jobs. It provides managed ingress, revisions, service discovery, workload profiles, and KEDA-based autoscaling while hiding the Kubernetes API and control plane.

##### Key Points to Mention

- Runs general-purpose Linux containers.
- Abstracts cluster and node operations.
- Supports apps and jobs.
- Provides managed ingress and autoscaling.
- AKS is required for direct Kubernetes control.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q01 -->

#### What is the difference between a container app and a Container Apps job?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q02 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A container app represents a continuously available service such as an API or long-running worker. Its replicas can scale in and out and may scale to zero. A job represents finite work: an execution starts, completes or fails, and stops. Jobs can be manual, scheduled, or event-driven.

##### Key Points to Mention

- APIs belong in apps.
- Finite batch work belongs in jobs.
- Apps scale service replicas.
- Jobs create separately tracked executions.
- Lifecycle semantics should drive the choice.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q02 -->

#### How does Azure Container Apps scale an HTTP API?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q03 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

An HTTP scaling rule observes concurrent requests and adds or removes replicas within configured minimum and maximum limits. A minimum of zero permits scale to zero, while a minimum of one or more maintains warm capacity. The threshold and maximum should be selected through load testing and the capacity of downstream dependencies.

##### Key Points to Mention

- Scaling is horizontal through replicas.
- Configure minimum, maximum, and concurrency threshold.
- Scale to zero can add startup latency.
- Maximum platform scale is not necessarily safe scale.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q03 -->

#### What is a revision in Azure Container Apps?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q04 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A revision is an immutable versioned snapshot of revision-scoped app configuration, including its image, resources, environment variables, probes, and scale settings. Single revision mode replaces the active version after the new revision is ready. Multiple revision mode can keep several versions active and split traffic for canary, blue-green, or A/B scenarios.

##### Key Points to Mention

- Revisions are immutable.
- Configuration changes can create a new revision.
- Replicas belong to a revision.
- Multiple revisions support controlled rollout.
- Data and contracts must remain compatible.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you host an API and a queue worker in Azure Container Apps?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q01 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Deploy them as separate container apps so they can be versioned, secured, and scaled independently. Give the API HTTP ingress and an HTTP concurrency rule. Keep the worker without public ingress and use a queue-based KEDA rule. Use separate managed identities and least-privilege roles, externalize state, and cap worker replicas according to database or downstream capacity.

##### Key Points to Mention

- Separate independently scaling workloads.
- Public or edge ingress only for the API.
- Queue depth should drive worker scale.
- Use managed identity.
- Design the worker for duplicate delivery and shutdown.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q01 -->

#### When should a background workload use an event-driven job instead of a continuously running app?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q02 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use an event-driven job when each trigger should create finite, independently tracked work that exits after processing one unit or batch. Use an app when a long-lived consumer should maintain connections, process a stream continuously, or reuse in-memory batching. Consider startup cost, execution duration, parallelism, retry semantics, and how success or failure should be observed.

##### Key Points to Mention

- Jobs have completion semantics.
- Apps have service semantics.
- Startup overhead matters for frequent short events.
- Both approaches require idempotency.
- Monitoring differs between replicas and executions.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q02 -->

#### How do you prevent autoscaling workers from overwhelming a database?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q03 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Measure sustainable work per replica and database capacity, then set bounded concurrency and a safe maximum replica count. Configure connection pools, retries with jitter, and queue visibility or lock behavior. Monitor throttling, latency, backlog age, and database saturation. Autoscaling should respond to demand while backpressure protects the dependency.

##### Key Points to Mention

- Downstream capacity sets safe scale.
- Limit per-replica and total concurrency.
- Queue depth alone is insufficient.
- Retries can amplify overload.
- Load test the full processing path.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q03 -->

#### How would you secure a private Container Apps environment?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q04 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Create a workload profiles environment in an appropriately sized delegated subnet, use internal environment access or disable public network access as required, and expose only intended entry points. Apply network security groups, user-defined routes, Azure Firewall or NAT Gateway when needed, private endpoints for dependencies, managed identities with least privilege, private registry access, and centralized monitoring.

##### Key Points to Mention

- Network design is an environment-level decision.
- Use internal ingress for backend services.
- Control both inbound and outbound traffic.
- Prefer identity over stored credentials.
- Separate trust zones when necessary.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a zero-downtime Container Apps deployment with a database change?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q01 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use expand-contract. First deploy a backward-compatible schema expansion, then deploy a new revision that can coexist with the old version. Validate readiness and telemetry, shift a small traffic percentage, and increase it only when error and latency signals remain healthy. Migrate data separately, stop old usage, and remove the obsolete schema in a later deployment. Keep a tested rollback path until the change becomes irreversible.

##### Key Points to Mention

- Revisions do not solve incompatible data changes.
- Old and new versions must coexist safely.
- Use canary traffic and revision-specific telemetry.
- Separate expansion, migration, and contraction.
- Define rollback and stopping criteria.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q01 -->

#### How would you choose between Consumption and Dedicated workload profiles?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q02 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Choose Consumption for bursty or unpredictable workloads that benefit from per-replica billing and scale to zero. Evaluate Dedicated for steady utilization, larger or specialized compute, stronger resource predictability, or cases where packing several apps onto reserved profile instances is economical. Compare measured load, minimum capacity, startup latency, isolation, hardware, regional availability, and the total environment management and instance cost.

##### Key Points to Mention

- Billing unit differs.
- Consumption favors elasticity.
- Dedicated can favor steady utilization.
- Hardware and isolation requirements matter.
- Use measured cost rather than labels.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q02 -->

#### When should a team move from Azure Container Apps to AKS?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q03 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Move when requirements genuinely depend on direct Kubernetes APIs or cluster-level control, such as custom operators, controllers, daemon sets, unsupported networking, custom admission policy, specialized scheduling, or a broader Kubernetes platform strategy. Do not move solely because the number of services increased. Compare the value of the missing capability with the operational cost of clusters, nodes, upgrades, security, policy, and platform engineering.

##### Key Points to Mention

- Container Apps intentionally hides Kubernetes.
- AKS provides control with added responsibility.
- Service count alone is not a decision criterion.
- Team Kubernetes capability is required.
- Validate migration and portability assumptions.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q03 -->

#### How would you design a resilient event-driven processing system on Container Apps?

<!-- question:start:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q04 -->
<!-- question-id:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a durable broker, queue-based KEDA scaling, bounded concurrency, and a safe replica maximum. Consumers should be idempotent, renew message locks when needed, use retry policies that distinguish transient from permanent failures, and dead-letter poison messages. Persist business state transactionally, use an outbox when publishing follows a database change, emit backlog and processing telemetry, and test scale, shutdown, duplicate delivery, and dependency outages.

##### Key Points to Mention

- Assume at-least-once delivery.
- Protect dependencies through backpressure.
- Separate transient retries from poison handling.
- Monitor oldest-message age, not only queue depth.
- Plan recovery and replay.

<!-- question:end:azure-container-apps-for-containerized-apis-and-background-workloads-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
