---
id: cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior
topic: Azure Functions and Durable Functions
subtopic: Cold starts, hosting plan choices, timeout configuration, and scaling behavior
category: Azure
---

## Overview

Azure Functions hosting determines how compute is allocated, how quickly an idle application becomes ready, how executions time out, how instances scale, which network features are available, and how billing works.

Current hosting options include:

- Flex Consumption.
- Premium.
- Dedicated App Service plans.
- Azure Container Apps.
- Consumption, which is now the legacy consumption hosting option.

For new serverless function applications, Microsoft recommends Flex Consumption when it meets the workload requirements. It provides event-driven scaling, configurable memory, virtual-network integration, and optional always-ready instances.

Four concepts must be distinguished:

- **Cold start:** Delay while an inactive or new instance initializes.
- **Execution timeout:** Maximum time the Functions host permits one invocation to run.
- **Concurrency:** Number of invocations processed simultaneously on one instance.
- **Scale-out:** Number of running instances.

Changing one affects the others. Increasing per-instance concurrency may reduce instance count but increase CPU, memory, and downstream pressure. Keeping always-ready instances reduces cold starts but increases baseline cost. Allowing unbounded execution time does not make a long-running HTTP request reliable because HTTP responses still have a platform limit of approximately 230 seconds.

For interviews, candidates should be able to:

- Choose a hosting plan from workload requirements.
- Explain cold-start causes and mitigation.
- State current timeout defaults and limits.
- Explain why HTTP has a separate response limit.
- Describe event-driven and target-based scaling.
- Tune concurrency and maximum scale around downstream capacity.
- Explain Flex per-function scaling and scale groups.
- Design long-running work as asynchronous or durable workflows.

## Core Concepts

### Current Hosting Options

| Hosting option | Primary fit | Scaling model |
| --- | --- | --- |
| Flex Consumption | New serverless apps with variable demand | Fast event-driven scaling and per-function scaling |
| Premium | Warm dynamic scale, larger compute, shared plan capacity | Event-driven scaling with prewarmed workers |
| Dedicated | Existing App Service capacity and predictable always-on hosting | Manual or App Service autoscale |
| Container Apps | Containerized Functions and cloud-native integration | Container Apps replica scaling |
| Consumption | Legacy Windows consumption compatibility | Event-driven host scaling |

The correct plan depends on latency, utilization, network, runtime, container, cost, and support requirements.

### Flex Consumption

Flex Consumption is the recommended serverless starting point for new function apps when supported. It provides:

- Event-driven horizontal scaling.
- Per-function scaling for most triggers.
- Configurable memory sizes.
- Virtual-network integration.
- Optional always-ready instances.
- Pay-as-you-go serverless billing.
- A high potential scale-out limit subject to configured maximum and regional quota.

Flex runs Linux code deployments and has documented trigger, region, quota, and feature constraints that must be verified for the application.

### Flex Per-Function Scaling

Most Flex triggers can scale independently, reducing interference between unrelated workloads in one function app. Some trigger types scale together in groups:

- All HTTP-triggered functions in an app scale together.
- Blob Event Grid-triggered functions form a scale group.
- Durable Functions triggers form a scale group.

Functions still share deployment, configuration, identity, and worker resources. Per-function scaling does not remove every reason to separate function apps.

### Flex Instance Size and HTTP Concurrency

Flex supports configurable instance memory. HTTP per-instance concurrency defaults are linked to instance size:

| Instance memory | Default HTTP concurrency |
| --- | --- |
| 512 MB | 4 |
| 2,048 MB | 16 |
| 4,096 MB | 32 |

Python HTTP apps use a different documented default. Explicitly configuring HTTP concurrency overrides the default behavior.

Larger memory can improve CPU and working set but costs more per active time. Choose through load testing rather than assuming the largest instance is most efficient.

### Premium Plan

Premium provides dynamic event-driven scaling with:

- At least one warm instance.
- Prewarmed workers that reduce activation delay.
- Larger compute options.
- Virtual-network connectivity.
- Longer execution support.
- Multiple function apps on one Premium plan.
- Linux container support.

Premium is a strong fit when workloads run continuously or nearly continuously, require predictable warm capacity, need more CPU or memory, or can share plan capacity economically.

Because applications can share the plan, one application's resource consumption can affect others. Capacity and app placement need active management.

### Dedicated App Service Plan

Dedicated hosting runs Functions on provisioned App Service plan workers. It fits when:

- An organization already has suitable App Service capacity.
- Workloads run continuously.
- Predictable allocated instances are preferred.
- App Service features and plan sharing are useful.
- Event-driven serverless billing is not required.

Dedicated plans use manual scale or App Service autoscale rather than Functions event-driven scale. Enable Always On for production so the host remains active and unbounded timeout behavior is supported as documented.

### Azure Container Apps Hosting

Container Apps hosting fits containerized Functions that need:

- A custom Linux image.
- Container Apps environments and networking.
- KEDA-based replica scaling.
- Dapr or adjacent microservices.
- Workload profiles.

Scaling follows Container Apps rules rather than native Functions plan scaling. The application team must understand both the Functions host and Container Apps replica model.

### Legacy Consumption

The Consumption plan is now identified as legacy for new serverless designs. Existing applications should evaluate migration to Flex Consumption.

Consumption can remain relevant for documented compatibility cases, particularly existing Windows-hosted applications. It has:

- Scale to zero.
- Event-driven scaling.
- A five-minute default execution timeout.
- A ten-minute maximum execution timeout.
- Fewer current networking and warm-capacity capabilities than Flex.

Plan migration requires testing; it is not merely changing a billing setting.

### Plan Selection Questions

Ask:

- Is first-request latency important?
- Can the app scale to zero?
- Is demand sporadic or continuous?
- Does the app need private networking?
- Does it require a custom container?
- How much memory does each execution need?
- Is execution longer than ten minutes?
- Can multiple apps share reserved capacity safely?
- Are required triggers supported by the plan?
- What are regional quotas and availability?

### What Causes a Cold Start

A cold start can include:

1. The scale controller detects demand.
2. The platform allocates an instance.
3. The Functions host starts.
4. Language worker processes start.
5. Assemblies and extensions load.
6. Dependency injection is built.
7. Application initialization runs.
8. Trigger listeners or HTTP handling become ready.

Additional instances created during scale-out can also have startup delay, even if the app was not at zero.

### Cold Start Is Workload-Specific

Cold-start duration depends on:

- Hosting plan.
- Language and worker model.
- Package and image size.
- Number and version of extensions.
- Assembly count.
- Dependency registration.
- Startup network calls.
- Virtual-network and DNS dependencies.
- App configuration access.
- Runtime version.
- Instance size.

Measure p50, p95, and p99 first-invocation latency in a deployed environment.

### Mitigating Cold Starts

Options include:

- Flex always-ready instances.
- Premium minimum and prewarmed instances.
- Dedicated Always On.
- Non-zero minimum replicas in Container Apps.
- Current runtime, worker, and extension packages.
- .NET isolated placeholders where supported.
- Smaller deployment packages and images.
- Deferred optional initialization.
- No unnecessary network calls during startup.
- Reused SDK and HTTP clients.
- Splitting very heavy functions from latency-sensitive HTTP functions.

Do not use artificial timer pings as the primary warm strategy when the hosting plan provides supported warm capacity.

### Always-Ready Versus Prewarmed

Always-ready instances in Flex reserve warm capacity for configured scale groups or functions. Premium has minimum active and prewarmed workers that support dynamic scaling.

Both reduce activation latency but create baseline cost. They do not eliminate all scale-out delay when demand exceeds warm capacity.

### Function Timeout Configuration

`functionTimeout` is configured in `host.json`:

```json
{
  "version": "2.0",
  "functionTimeout": "00:10:00"
}
```

Current default and maximum execution time guidance:

| Plan | Default | Maximum |
| --- | --- | --- |
| Flex Consumption | 30 minutes | Unbounded |
| Premium | 30 minutes | Unbounded |
| Dedicated | 30 minutes | Unbounded with required plan configuration |
| Container Apps | 30 minutes | Unbounded |
| Consumption | 5 minutes | 10 minutes |

Unbounded means the host does not enforce a fixed maximum. Executions can still be interrupted by scale-in, platform updates, deployment, process failure, or infrastructure failure.

### HTTP Response Limit

Regardless of `functionTimeout`, an HTTP-triggered function has approximately 230 seconds to respond because of the default Azure Load Balancer idle timeout.

For work longer than that:

- Return `202 Accepted`.
- Put work on a queue.
- Use the Durable Functions asynchronous HTTP pattern.
- Store operation status.
- Make completion retryable and observable.

Increasing `functionTimeout` does not change the HTTP response limit.

### Scale-In and Update Grace

Unbounded executions do not guarantee infinite uninterrupted compute. Microsoft documents:

- A 60-minute grace period during scale-in for Flex Consumption and Premium.
- A 10-minute grace period during platform updates.
- A 10-minute platform-update grace period for Dedicated hosting.

Design long-running processing with checkpoints, cancellation, idempotency, and restartability.

### Long-Running Work

Use plain long-running functions only when interruption and retry are safe. Prefer:

- Durable Functions for orchestrated, stateful workflows.
- Queue-based decomposition for independent work units.
- Container Apps jobs for finite containerized processing.
- Azure Batch for high-scale parallel batch workloads.

Break work into steps when it needs checkpoints, compensation, human approval, or reliable recovery.

### Event-Driven Scaling

Flex Consumption, Premium, and Consumption use event-driven scaling. The scale controller monitors trigger-specific demand:

- HTTP request load.
- Queue depth.
- Service Bus backlog.
- Event Hub partition lag.
- Other supported trigger signals.

It adds or removes host instances according to the plan and trigger behavior.

Dedicated plans require manually configured capacity or App Service autoscale. Container Apps uses KEDA and Container Apps replica rules.

### Concurrency Before Scale

One instance normally processes multiple invocations concurrently. Before or while the platform adds instances, the current instance consumes work up to its concurrency behavior.

Concurrency and scale trade off:

- Higher concurrency can improve utilization and reduce instance count.
- Excessive concurrency can cause CPU, memory, connection, or dependency saturation.
- Lower concurrency can keep instances healthy and encourage scale-out.

Tune the end-to-end system, not just the function host.

### Fixed Concurrency

Most triggers have fixed per-instance concurrency settings in `host.json`, such as:

- Queue `batchSize` and `newBatchThreshold`.
- Service Bus `maxConcurrentCalls`.
- Service Bus `maxConcurrentSessions`.
- HTTP concurrency in Flex.

Settings apply per instance. If ten instances each process 16 messages concurrently, potential application concurrency is roughly 160 before considering other trigger-specific behavior.

### Dynamic Concurrency

Dynamic concurrency is an opt-in model for supported triggers. The Functions host learns a sustainable concurrency level using instance health signals and adjusts it over time.

Benefits:

- Less manual tuning.
- Adaptation to instance size and workload.
- Better use of resources for changing workloads.

Limitations:

- Only supported triggers participate.
- The learned value cannot understand every downstream business limit.
- Maximum scale and dependency protection are still required.

### Target-Based Scaling

Target-based scaling estimates desired instance count from backlog and target work per instance. Conceptually:

```text
desired instances =
    outstanding work / target concurrency per instance
```

Exact behavior is trigger- and plan-specific. Per-instance concurrency settings therefore influence scale decisions. Reducing target concurrency can cause more instances to be requested; increasing it can pack more work onto each instance.

### Scale Controller Visibility

The scale controller must access trigger demand. Network restrictions, invalid connection settings, unsupported custom configuration sources, or insufficient identity permissions can prevent accurate scaling even if application code can access the resource after startup.

Validate:

- Trigger connection settings are platform-visible.
- Private network paths support the selected plan.
- Required data-plane roles exist.
- Monitoring detects listener and scaling errors.

### Function App Boundaries

Functions in one app share:

- Hosting plan.
- Deployment.
- Identity.
- Application settings.
- `host.json`.
- Worker process and resources on an instance.

Separate applications when functions have:

- Different latency requirements.
- Different concurrency settings.
- Different security identities.
- Different deployment cadence.
- Very different memory or CPU behavior.
- Different availability or ownership requirements.

Flex per-function scaling helps but does not eliminate shared worker and configuration concerns.

### Protect Downstream Systems

The platform might support hundreds or thousands of instances, but safe scale is often much lower.

Calculate constraints for:

- Database connection limits.
- Service Bus throughput units.
- Storage account throughput.
- External API quotas.
- SNAT ports.
- Broker partitions.
- Legacy systems.

Use:

- Maximum instance limits.
- Per-instance concurrency limits.
- Queues and backpressure.
- Rate limits.
- Circuit breakers.
- Retry budgets with jitter.
- Load shedding.

### Storage Account Effects

Functions uses storage for host coordination and trigger state. Durable Functions can use storage heavily. Sharing a storage account among high-scale applications can create throughput, contention, and reliability risks.

Use:

- Same-region storage.
- Separate production storage where scale or isolation warrants it.
- Current redundancy and recovery design.
- Managed identity where supported.
- Monitoring for throttling and latency.

Do not delete or casually replace the host storage account.

### Cost Trade-Offs

Compare:

- Execution and resource billing.
- Always-ready or minimum instances.
- Premium or Dedicated allocated capacity.
- Memory size.
- Number of function apps sharing a plan.
- Network and private endpoint cost.
- Storage and Application Insights ingestion.
- Scale-out caused by low concurrency.
- Engineering and support effort.

A warm Premium plan may cost less than high-volume consumption executions in some steady workloads. A consumption plan may be far cheaper for sporadic work. Use measured traffic and pricing calculations.

### Monitoring Cold Start and Scale

Monitor:

- First-request and warm-request latency.
- Instance count.
- Execution concurrency.
- Queue and Service Bus backlog age.
- Scale-controller and listener errors.
- Worker restarts.
- Memory and CPU pressure.
- Dependency throttling.
- Timeout and cancellation count.
- Cost by app and plan.

Tag telemetry with function name, plan, region, worker version, and deployment version.

### Load and Failure Testing

Test:

- Scale from zero.
- Sudden and gradual bursts.
- Sustained load.
- Downstream throttling.
- Poison messages.
- Worker restart.
- Deployment during execution.
- Scale-in cancellation.
- Regional quota exhaustion.
- Recovery after backlog.

Measure whether backlog drains within the service objective without destabilizing dependencies.

### Common Mistakes

- Choosing a plan only from execution price.
- Using legacy Consumption for a new app without a compatibility reason.
- Assuming unbounded timeout means uninterrupted execution.
- Increasing `functionTimeout` to solve the HTTP limit.
- Ignoring cold starts in latency objectives.
- Using CPU as the only signal for event backlog.
- Raising concurrency without dependency load testing.
- Treating maximum platform scale as a target.
- Sharing one plan or app across incompatible workloads.
- Performing network calls during startup.
- Ignoring scale-controller network access.
- Running long work without checkpoints.
- Monitoring queue depth but not oldest-message age.

### Practical Best Practices

- Prefer Flex Consumption for new serverless apps when it fits.
- Use warm capacity for strict latency.
- Keep startup small and deterministic.
- Treat the 230-second HTTP response limit separately from `functionTimeout`.
- Design long work for interruption and restart.
- Match concurrency to CPU, memory, and dependencies.
- Cap scale by end-to-end capacity.
- Separate functions with conflicting operational profiles.
- Verify network and identity access for trigger monitoring.
- Measure cold, warm, burst, and sustained behavior.
- Monitor backlog age, throttling, and timeouts.
- Reevaluate plan choice as traffic becomes steadier or requirements change.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a cold start in Azure Functions?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q01 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A cold start is the additional latency when the platform must allocate or initialize an instance before executing the function. It can include starting the Functions host and language worker, loading assemblies and extensions, building dependency injection, and running application initialization.

##### Key Points to Mention

- Scale from zero is a common cause.
- New scale-out instances can also start cold.
- Package size and startup work affect duration.
- Measure deployed first-invocation latency.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q01 -->

#### Which hosting plan is recommended for new serverless Function apps?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q02 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Flex Consumption is the recommended starting point when its supported regions, triggers, runtime, and feature set meet the requirements. It provides event-driven scaling, configurable memory, virtual-network integration, and optional always-ready instances. The older Consumption plan is considered legacy for new designs.

##### Key Points to Mention

- Plan choice still depends on workload requirements.
- Premium can provide warm shared capacity.
- Dedicated fits existing App Service capacity.
- Container Apps fits containerized Functions.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q02 -->

#### What is the HTTP execution timeout for an Azure Function?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q03 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The function execution timeout depends on the plan, but an HTTP-triggered function has approximately 230 seconds to return a response regardless of `functionTimeout`. The limit comes from the Azure Load Balancer idle timeout. Longer work should use asynchronous processing or the Durable Functions async HTTP pattern.

##### Key Points to Mention

- HTTP response limit and host timeout are different.
- Increasing `functionTimeout` does not remove 230 seconds.
- Return `202 Accepted` for long work.
- Persist operation status.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q03 -->

#### What is the difference between concurrency and scale-out?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q04 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Concurrency is the number of invocations processed simultaneously on one instance. Scale-out is the number of running instances. Higher concurrency can process more work per instance, while scale-out distributes work across additional instances. Both consume downstream capacity and must be tuned together.

##### Key Points to Mention

- Trigger settings influence per-instance concurrency.
- Hosting plan determines scale behavior.
- Total potential concurrency multiplies across instances.
- More concurrency can reduce instance health.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you reduce cold-start latency for a .NET isolated Function app?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q01 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use Flex always-ready or Premium warm capacity when the latency objective requires it. Keep Worker, Worker SDK, runtime, and extensions current; enable documented isolated placeholders where supported; reduce package size; avoid startup network calls; defer optional initialization; and reuse clients through dependency injection. Measure cold and warm latency separately.

##### Key Points to Mention

- Warm capacity trades cost for latency.
- Startup should be deterministic.
- Split heavy workers from latency-sensitive HTTP functions.
- Validate configuration in Azure.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q01 -->

#### When would you choose Premium instead of Flex Consumption?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q02 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose Premium when workloads run continuously or nearly continuously, require warm shared capacity, need larger compute options, use containers, or benefit from hosting multiple apps on one event-scaled plan. Compare baseline cost and resource contention with Flex always-ready capacity. Flex remains attractive for variable serverless demand and per-function scaling.

##### Key Points to Mention

- Premium keeps at least one warm instance.
- Several apps can share a Premium plan.
- Shared capacity needs governance.
- Cost depends on measured utilization.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q02 -->

#### How should Service Bus concurrency be tuned?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q03 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Measure CPU, memory, processing duration, lock behavior, and downstream capacity. Configure `maxConcurrentCalls`, session concurrency, prefetch, and maximum instances so total load remains safe. Lower per-instance concurrency can preserve health and encourage scale-out; higher concurrency can improve utilization for I/O-bound work until dependencies throttle.

##### Key Points to Mention

- Settings apply per instance.
- Prefetch can increase lock pressure.
- Monitor oldest-message age and dead letters.
- Retry storms can amplify overload.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q03 -->

#### How should work longer than the plan timeout be designed?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q04 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Break it into restartable steps using Durable Functions or durable queue messages. Persist checkpoints and idempotency state, place large or parallel batch processing on a suitable compute service, and expose asynchronous status for callers. A longer timeout alone does not provide recovery from restarts, scale-in, deployment, or platform updates.

##### Key Points to Mention

- Timeout is not durability.
- Long work must tolerate interruption.
- Durable Functions stores orchestration state.
- Choose Batch or container jobs when appropriate.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you choose and size a plan for a latency-sensitive HTTP API with burst traffic?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q01 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Define latency and throughput objectives, startup time, request resource use, and dependency limits. Test Flex memory sizes and HTTP concurrency with enough always-ready instances to absorb expected baseline and initial burst, then compare with Premium prewarmed capacity. Set maximum scale from database and external-service capacity, and use API Management rate limits or admission control for extreme bursts.

##### Key Points to Mention

- Warm capacity covers only part of a burst.
- Instance size affects default HTTP concurrency.
- Measure p95 and p99 cold and warm latency.
- Protect dependencies before raising maximum scale.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q01 -->

#### How does per-instance concurrency affect target-based scaling?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q02 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Target-based scaling estimates required instances from pending work and a target amount of work per instance. Lower configured concurrency reduces the target capacity of each instance and can request more instances. Higher concurrency packs more work onto each instance and can reduce instance count, but may increase resource pressure and dependency saturation.

##### Key Points to Mention

- Concurrency is part of scale calculation.
- Settings apply to every instance.
- Trigger behavior varies.
- Optimize total throughput and health, not instance count.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q02 -->

#### How would you diagnose a queue backlog that grows even though the app is scaling?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q03 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Compare arrival and completion rates, instance count, per-instance concurrency, execution duration, failures, retries, and oldest-message age. Check regional quotas, configured maximum instances, trigger-listener health, storage or broker throttling, network access, worker CPU and memory, and downstream latency. Scaling can be healthy while processing capacity remains below arrival rate.

##### Key Points to Mention

- Backlog is a rate imbalance.
- Check poison and retry loops.
- Verify scale-controller visibility.
- Downstream bottlenecks often dominate.
- Use load testing to establish drain rate.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q03 -->

#### How would you prevent rapid Functions scale-out from causing a cascading failure?

<!-- question:start:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q04 -->
<!-- question-id:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Set maximum instances and per-instance concurrency from end-to-end capacity tests. Use queues to absorb bursts, connection-pool limits, rate limiting, circuit breakers, load shedding, and retry budgets with jitter. Monitor dependency saturation and throttling alongside function scale. During incidents, reduce consumption safely rather than allowing retries and new instances to multiply pressure.

##### Key Points to Mention

- Platform maximum is not safe maximum.
- Autoscaling does not provide backpressure.
- Retries need limits and jitter.
- Degraded operation can protect critical paths.
- Test dependency failure under load.

<!-- question:end:cold-starts-hosting-plan-choices-timeout-configuration-and-scaling-behavior-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
