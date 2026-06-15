---
id: durable-functions-orchestrators-activities-timers-external-events-and-entities
topic: Azure Functions and Durable Functions
subtopic: Durable Functions orchestrators, activity functions, durable timers, external events, and durable entities
category: Azure
---

## Overview

Durable Functions extends Azure Functions with stateful, fault-tolerant workflows defined in code. The Durable runtime records workflow history, checkpoints progress, replays orchestrator code, schedules work, and recovers from process restarts.

The main building blocks are:

- **Client functions:** Start and manage workflow instances.
- **Orchestrator functions:** Describe workflow control flow.
- **Activity functions:** Perform side effects and units of work.
- **Durable timers:** Persist delays and timeouts without holding compute.
- **External events:** Deliver asynchronous signals to running workflows.
- **Durable entities:** Manage small pieces of addressable state through serialized operations.

Durable Functions is useful for:

- Long-running business processes.
- Human approval.
- Multi-step integrations.
- Retryable workflows.
- Fan-out/fan-in processing.
- Monitoring loops.
- Stateful coordination.
- Compensation after partial completion.

It is not a replacement for every message consumer or database transaction. The value is durable coordination across time, failures, and multiple function executions.

For interviews, candidates should explain:

- Event sourcing and orchestrator replay.
- Deterministic orchestrator constraints.
- Why side effects belong in activities.
- Activity at-least-once behavior.
- Durable timers versus thread sleeps.
- External event correlation and timeouts.
- Entity identity and serialized operations.
- Task hubs and storage providers.
- Instance management, observability, versioning, and cleanup.

## Core Concepts

### Durable Application Roles

| Component | Responsibility |
| --- | --- |
| Client | Starts, queries, signals, suspends, resumes, or terminates instances |
| Orchestrator | Coordinates workflow order, branches, loops, and error handling |
| Activity | Performs I/O, computation, and side effects |
| Entity | Maintains small addressable state through operations |

The roles use specialized Durable Functions triggers and bindings.

### Starting an Orchestration

A non-orchestrator function can use `DurableTaskClient`:

```csharp
public sealed class StartOrderWorkflow
{
    [Function("StartOrderWorkflow")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(
            AuthorizationLevel.Function,
            "post",
            Route = "orders/workflows")]
        HttpRequestData request,
        [DurableClient] DurableTaskClient client)
    {
        var input =
            await request.ReadFromJsonAsync<OrderWorkflowInput>();

        string instanceId =
            await client.ScheduleNewOrchestrationInstanceAsync(
                nameof(OrderOrchestrator),
                input);

        return await client.CreateCheckStatusResponseAsync(
            request,
            instanceId);
    }
}
```

The HTTP response normally returns `202 Accepted` and management URLs for status, events, termination, and cleanup.

### Instance IDs

Every orchestration has an instance ID. It is used to:

- Query status.
- Raise external events.
- Terminate or suspend the workflow.
- Correlate telemetry.
- Prevent duplicate workflow starts.

A caller can supply a meaningful instance ID such as an order ID when one active workflow per business object is required. Validate instance state and handle start races; an ID alone does not automatically implement every idempotency requirement.

### Orchestrator Functions

An isolated-worker orchestrator receives `TaskOrchestrationContext`:

```csharp
[Function(nameof(OrderOrchestrator))]
public static async Task<OrderWorkflowResult> OrderOrchestrator(
    [OrchestrationTrigger]
    TaskOrchestrationContext context)
{
    var input =
        context.GetInput<OrderWorkflowInput>()
        ?? throw new InvalidOperationException(
            "Workflow input is required.");

    await context.CallActivityAsync(
        nameof(ReserveInventory),
        input);

    await context.CallActivityAsync(
        nameof(CapturePayment),
        input);

    return new OrderWorkflowResult("Completed");
}
```

The code looks like ordinary asynchronous C#, but its awaited tasks are durable tasks controlled by the orchestration runtime.

### Event Sourcing and Replay

The runtime persists an event history containing scheduled activities, results, timers, events, and decisions. When an orchestrator resumes:

1. The orchestrator starts from the beginning.
2. The runtime replays recorded results.
3. The code reconstructs local state deterministically.
4. Execution proceeds when it reaches new work.

The orchestrator is not one thread or process that remains alive for days. It can unload while waiting and resume on another worker.

### Determinism

During replay, orchestrator code must make the same decisions from the same history.

Do not directly use:

- `DateTime.UtcNow` or `DateTime.Now`.
- `Guid.NewGuid()`.
- Random values.
- HTTP calls.
- Database queries.
- File access.
- Environment values that can change.
- Threads, delays, or arbitrary asynchronous APIs.
- Input or output bindings.

Use orchestration APIs:

```csharp
DateTime now =
    context.CurrentDateTimeUtc;

Guid id =
    context.NewGuid();
```

Move nondeterministic work and external I/O into activities.

### Replay-Safe Logging

Normal log calls in an orchestrator can repeat during replay. Use a replay-safe logger:

```csharp
ILogger logger =
    context.CreateReplaySafeLogger(
        nameof(OrderOrchestrator));

logger.LogInformation(
    "Coordinating order {OrderId}",
    input.OrderId);
```

Activity logs are not replayed in the same way, although an activity itself can execute more than once.

### Orchestrator Dependency Injection

Do not inject services that perform I/O or return changing values into orchestrator logic. Replay can call the orchestrator repeatedly, and injected behavior can break determinism.

Use dependency injection freely in:

- Client functions.
- Activity functions.
- Entity implementations where supported and appropriate.

Keep orchestrators focused on durable context operations and deterministic transformation.

### Activity Functions

Activities perform actual work:

```csharp
public sealed class ReserveInventory
{
    private readonly InventoryClient inventory;

    public ReserveInventory(
        InventoryClient inventory)
    {
        this.inventory = inventory;
    }

    [Function(nameof(ReserveInventory))]
    public Task Run(
        [ActivityTrigger]
        OrderWorkflowInput input,
        CancellationToken cancellationToken)
    {
        return inventory.ReserveAsync(
            input.OrderId,
            input.Items,
            cancellationToken);
    }
}
```

Activities can:

- Call APIs.
- Query or update databases.
- Use SDK clients.
- Generate random values.
- Read current time.
- Send notifications.

### Activity At-Least-Once Execution

An activity can execute more than once. For example, the activity might finish its side effect but the worker could fail before the result is durably recorded.

Make activities idempotent:

- Use a unique business operation ID.
- Use upserts or conditional writes.
- Record completed operations.
- Reuse previous results.
- Make external APIs accept idempotency keys.

The orchestrator's durable history prevents normal repeated scheduling during replay, but it cannot guarantee exactly-once external side effects inside an activity.

### Activity Granularity

Activities should represent meaningful, retryable units:

- `ReserveInventory`.
- `CapturePayment`.
- `SendConfirmation`.
- `GenerateReport`.

Too-small activities create storage and scheduling overhead. Too-large activities have poor checkpoint granularity and repeat more work after failure.

Choose boundaries around:

- One external side effect.
- One independent retry policy.
- One compensation boundary.
- One result useful to later workflow decisions.

### Activity Retry Policies

Use durable retry APIs for transient failures:

```csharp
var retry =
    TaskOptions.FromRetryPolicy(
        new RetryPolicy(
            maxNumberOfAttempts: 4,
            firstRetryInterval:
                TimeSpan.FromSeconds(5)));

await context.CallActivityAsync(
    nameof(CapturePayment),
    input,
    retry);
```

The exact overloads depend on current Durable packages. Retry only transient failures. Validation, authorization, and permanent business rejection should not be retried blindly.

### Durable Timers

Use durable timers instead of `Task.Delay`:

```csharp
DateTime due =
    context.CurrentDateTimeUtc
        .AddHours(24);

await context.CreateTimer(
    due,
    CancellationToken.None);
```

While waiting:

- The orchestrator state is persisted.
- No thread remains blocked.
- The app can scale to zero.
- A timer message reactivates the workflow.

### Durable Timeouts

Race work against a timer:

```csharp
using var cancellation =
    new CancellationTokenSource();

Task<bool> approval =
    context.WaitForExternalEventAsync<bool>(
        "Approval");

Task timeout =
    context.CreateTimer(
        context.CurrentDateTimeUtc.AddDays(3),
        cancellation.Token);

Task winner =
    await Task.WhenAny(
        approval,
        timeout);

if (winner == approval)
{
    cancellation.Cancel();
    return await approval;
}

return false;
```

Cancel unused timers. An orchestration does not complete while an outstanding durable timer remains incomplete or uncanceled.

### Timer Cancellation Does Not Cancel Activities

Winning a `Task.WhenAny` race and ignoring an activity result does not terminate the activity. It might continue running and produce side effects.

Design cancelable business operations explicitly:

- Pass a cancellation command through a supported channel.
- Check operation state before committing.
- Use compensation when a side effect completed.
- Avoid assuming orchestration task cancellation stops remote work.

### External Events

External events let a running workflow receive a one-way asynchronous signal:

```csharp
ApprovalDecision decision =
    await context
        .WaitForExternalEventAsync<ApprovalDecision>(
            "Approval");
```

A client raises the named event for a specific instance:

```csharp
await client.RaiseEventAsync(
    instanceId,
    "Approval",
    decision);
```

Events support:

- Human approval.
- Webhook callback.
- Device signal.
- Payment confirmation.
- External process completion.

### External Event Design

Validate:

- Caller identity and authorization.
- Instance ID ownership.
- Event name.
- Payload schema and version.
- Current workflow state.
- Duplicate and late events.

External events are not synchronous request-response operations. The sender should receive acceptance, then query workflow status or receive a separate completion notification.

### Event Buffering and Ordering

Durable runtime can buffer an external event until the orchestrator waits for it. However:

- Duplicate events can exist.
- Different event names can race.
- Business-level ordering assumptions need explicit design.
- Events sent after instance completion cannot continue the completed workflow.

Include an event ID and validate state transitions inside deterministic workflow logic.

### Durable Entities

A durable entity is identified by:

- Entity name.
- Entity key.

Example identities:

```text
InventoryItem / product-123
RateLimiter / tenant-42
ApprovalCounter / workflow-981
```

Each operation for one entity instance executes serially, avoiding concurrent updates to that entity's state.

### Entity Operations

Entities expose named operations such as:

- `Add`.
- `Remove`.
- `Set`.
- `Reset`.
- `Acquire`.
- `Release`.

Clients and orchestrators can signal operations. Orchestrators can also call entities when they need a returned result.

Entities are useful for:

- Counters.
- Small aggregations.
- Coordination flags.
- Shopping-cart-like state.
- Lightweight distributed semaphores.

### Entity State Design

Keep entity state:

- Small.
- Serializable.
- Focused on one identity.
- Quick to update.
- Free from large object graphs.

An entity is not a replacement for a relational database, analytics store, or large document repository. High contention on one entity key serializes all operations and can become a hotspot.

### Entity Signals Versus Calls

A signal is one-way and does not wait for a result. A call waits for the entity operation result and is available from orchestration contexts in supported models.

Use signals for commands where eventual processing is sufficient. Use calls when workflow decisions need the resulting state.

### Entities Versus Orchestrators

| Concern | Orchestrator | Entity |
| --- | --- | --- |
| Main abstraction | Workflow over time | Stateful object |
| State model | Implicit through history and local variables | Explicit entity state |
| Concurrency | Workflow task scheduling | Serialized per entity key |
| Best fit | Multi-step process | Small addressable state |
| Time and waits | Timers and external events | Usually operation-focused |

An orchestration can coordinate several entities, but excessive entity calls increase history and storage work.

### Task Hubs

A task hub isolates Durable runtime state for a set of orchestrations and entities. It includes queues, history, control state, and instance metadata in the selected backend.

Use distinct task hubs for:

- Separate applications sharing a storage resource.
- Deployment slots when both slots may run.
- Test and production.
- Versioned side-by-side deployments when required.

Two incompatible applications using the same task hub can process each other's messages and corrupt workflow behavior.

### Storage Providers

Durable Functions supports pluggable backends. Current Microsoft guidance identifies Durable Task Scheduler as the recommended backend for new Durable Functions scenarios where its availability and requirements fit. Azure Storage remains a common and established provider, and other supported providers have different performance and operational characteristics.

Evaluate:

- Regional availability.
- Throughput and latency.
- Networking.
- Cost.
- Operational visibility.
- Migration support.
- Required features and quotas.

Do not change a backend as if it were a transparent connection-string switch.

### Instance Management

Durable clients can:

- Start an instance.
- Query status.
- Raise events.
- Suspend and resume.
- Terminate.
- Purge history.

Termination stops future orchestration progress but does not undo completed side effects or necessarily stop activities already running. Compensation must be explicit.

### Custom Status

Orchestrators can expose compact custom status:

```csharp
context.SetCustomStatus(
    new
    {
        Stage = "AwaitingApproval",
        input.OrderId
    });
```

Use it for progress visible to clients. Keep it small because it is persisted and returned by status APIs.

### History Growth

Every activity, timer, event, and decision adds history. Very long or frequently looping orchestrations can accumulate large histories and replay cost.

Use:

- Sub-orchestrations.
- Sensible activity granularity.
- `ContinueAsNew` for eternal loops.
- Instance completion and restart when business semantics allow it.
- History purge according to retention policy.

### Versioning

Running instances replay old history against deployed orchestrator code. Incompatible code changes can make replay diverge.

Safe strategies include:

- Keep changes replay-compatible.
- Deploy a new orchestrator name.
- Route new instances to a new version.
- Let old instances drain.
- Use supported orchestration versioning features where appropriate.

Never casually reorder, remove, or conditionally change historical activity calls in a long-running orchestrator.

### Observability

Monitor:

- Instance runtime status.
- Orchestration and activity failures.
- Activity duration and retries.
- External event wait age.
- Timer backlog.
- Task-hub queue depth and latency.
- Storage-provider throttling.
- History size and replay duration.
- Entity operation backlog and hot keys.

Correlate through instance ID and business ID. Use replay-safe orchestrator logs.

### Common Mistakes

- Performing HTTP or database I/O in an orchestrator.
- Using nondeterministic time, GUID, or random APIs.
- Assuming activities execute exactly once.
- Injecting changing services into orchestrator decisions.
- Using `Task.Delay` instead of a durable timer.
- Forgetting to cancel a losing timeout timer.
- Assuming timeout races cancel running activities.
- Trusting external events without authorization.
- Storing large state in entities.
- Creating a hot entity key.
- Sharing a task hub across incompatible apps or slots.
- Changing orchestrator control flow without a versioning plan.
- Keeping infinite history without `ContinueAsNew` or purge.

### Practical Best Practices

- Keep orchestrators deterministic and side-effect free.
- Put external work in small idempotent activities.
- Use durable timers for all orchestration waits.
- Pair external events with deadlines and authorization.
- Use meaningful instance IDs and correlation.
- Keep entity state small and operations focused.
- Separate task hubs across incompatible deployments.
- Monitor backend health and history growth.
- Version long-running workflows deliberately.
- Purge completed history according to retention policy.
- Test restart, duplicate activity execution, late events, and replay.
- Verify current storage-provider and SDK guidance before new deployments.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What problem does Durable Functions solve?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q01 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Durable Functions coordinates stateful workflows that can survive waits, restarts, and failures. The runtime records history, checkpoints progress, schedules activities, and rebuilds orchestrator state through replay. Developers express workflow order and error handling in code instead of manually persisting every state transition.

##### Key Points to Mention

- It extends Azure Functions.
- Workflows can run for long periods.
- State is persisted by a Durable backend.
- Side effects still require careful design.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q01 -->

#### What is the difference between an orchestrator and an activity?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q02 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An orchestrator deterministically coordinates workflow steps, branches, timers, and events. It must not perform direct external I/O. An activity performs a unit of real work such as an API call or database update. Activities can use normal APIs but can execute more than once and should be idempotent.

##### Key Points to Mention

- Orchestrators replay.
- Activities perform side effects.
- Activities have at-least-once semantics.
- Use orchestration context APIs for durable work.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q02 -->

#### Why should an orchestrator use a durable timer instead of `Task.Delay`?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q03 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A durable timer records the wait in workflow history and allows the orchestrator to unload without holding a thread or compute instance. It can survive restart and reactivate after scale to zero. `Task.Delay` is not a durable orchestration operation and can break replay behavior.

##### Key Points to Mention

- Durable timers survive restarts.
- Use orchestration-context time.
- Waiting does not consume an active thread.
- Cancel unused timeout timers.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q03 -->

#### What is a durable entity?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q04 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A durable entity is a small addressable stateful object identified by an entity name and key. Clients or orchestrators send named operations that read or update its state. Operations for one entity instance execute serially, reducing concurrency conflicts for that identity.

##### Key Points to Mention

- State should remain small.
- Each entity key is an independent instance.
- Signals are one-way.
- Hot keys can become bottlenecks.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why must orchestrator code be deterministic?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q01 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The runtime re-executes orchestrator code from the beginning and supplies previously recorded results to reconstruct state. The same history must produce the same scheduling decisions. Current time, random values, external I/O, changing configuration, or arbitrary asynchronous operations can produce a different decision and cause nondeterminism failures.

##### Key Points to Mention

- Replay is event-sourced state reconstruction.
- Use `CurrentDateTimeUtc` and `NewGuid`.
- Put I/O in activities.
- Use replay-safe logging.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q01 -->

#### How would you implement a human approval with a deadline?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q02 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Have the orchestrator wait for a named external event and race it against a durable timer using `Task.WhenAny`. If approval arrives, cancel the timer and continue. If the timer wins, follow the timeout path. The client endpoint that raises the event must authenticate the caller and authorize access to the workflow instance.

##### Key Points to Mention

- External events are asynchronous and one-way.
- Include a schema and event ID.
- Handle duplicate and late events.
- Cancel the losing timer.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q02 -->

#### How do you make an activity function idempotent?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q03 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Pass a stable operation ID, store completion with a unique constraint, and make the side effect conditional or retrievable. Repeated execution should return the existing outcome rather than creating another charge, reservation, or notification. Use external provider idempotency keys where supported.

##### Key Points to Mention

- Activities are at least once.
- In-memory deduplication is insufficient.
- Store outputs needed by retries.
- Define idempotency retention.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q03 -->

#### How do task hubs affect deployment design?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q04 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A task hub is the Durable runtime state boundary containing orchestration and entity work for an application. Incompatible apps, environments, or simultaneously active deployment slots should use different hubs. Sharing one hub can let one deployment consume another deployment's work or replay history against incompatible code.

##### Key Points to Mention

- Hub names must be unique within a backend.
- Production and test must be isolated.
- Slots need deliberate configuration.
- Backend health affects every instance in the hub.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you version an orchestrator that has instances running for months?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q01 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Avoid replay-incompatible changes to the existing orchestrator. Introduce a new orchestrator name or supported version, route new instances to it, and allow old instances to drain under compatible code. Keep old activities available while historical instances can schedule them, and monitor the population before removal.

##### Key Points to Mention

- History replays against deployed code.
- Reordering activity calls can break replay.
- Side-by-side versions reduce risk.
- Data and event schemas also need compatibility.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q01 -->

#### When would you use a durable entity instead of a database row?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q02 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use an entity for small workflow-oriented state that benefits from serialized operations and direct orchestration integration, such as a counter, coordination flag, or lightweight semaphore. Use a database when the state needs rich queries, transactions across records, reporting, large payloads, independent access patterns, or strict database governance.

##### Key Points to Mention

- Entities are addressed by name and key.
- Per-key serialization can create hot spots.
- Entities are not general-purpose databases.
- Consider operational and query requirements.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q02 -->

#### How would you diagnose a Durable workflow that becomes progressively slower?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q03 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Inspect history size, replay duration, activity latency, retry volume, task-hub queue depth, backend throttling, worker scale, and hot entity keys. Large loops or frequent events can produce expensive replay. Use `ContinueAsNew`, sub-orchestrations, coarser but meaningful activities, and history purge where appropriate.

##### Key Points to Mention

- Workflow history grows with durable actions.
- Backend throughput can bottleneck execution.
- Replay-safe logs help separate replay from new work.
- Measure oldest control and work-item messages.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q03 -->

#### What does terminating an orchestration guarantee?

<!-- question:start:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q04 -->
<!-- question-id:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Termination prevents the orchestration from scheduling future progress and marks the instance terminated. It does not reverse completed side effects and does not necessarily stop activities or external operations already running. Business rollback requires explicit compensation or cancellation mechanisms.

##### Key Points to Mention

- Termination is not transactional rollback.
- Activities can outlive orchestration decisions.
- Compensation must be idempotent.
- Preserve audit and final state.

<!-- question:end:durable-functions-orchestrators-activities-timers-external-events-and-entities-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
