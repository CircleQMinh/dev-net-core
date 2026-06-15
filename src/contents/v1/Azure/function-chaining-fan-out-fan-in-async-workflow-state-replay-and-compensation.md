---
id: function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation
topic: Azure Functions and Durable Functions
subtopic: Function chaining, fan-out/fan-in, async workflow state, replay-safe orchestrator code, and compensation
category: Azure
---

## Overview

Durable Functions provides code-based patterns for workflows that span several operations, run in sequence or parallel, wait for external events, and recover from process failures. The runtime persists workflow history and replays orchestrator code to reconstruct local state.

Important workflow patterns include:

- **Function chaining:** Run activities in a defined sequence and pass results between steps.
- **Fan-out/fan-in:** Schedule independent work in parallel and aggregate the results.
- **Asynchronous workflow:** Start work, return immediately, and query or receive status later.
- **Human interaction:** Wait for an external event with a durable deadline.
- **Monitor:** Poll an external condition with durable delays.
- **Compensation:** Undo or mitigate completed steps after a later failure.

The runtime makes workflow state durable, but it does not make external side effects exactly once or automatically transactional. Activity functions execute with at-least-once semantics. A workflow that reserves inventory, charges a payment, and creates a shipment needs idempotency, retry classification, and explicit compensation for partial completion.

For interviews, candidates should be able to:

- Write sequential and parallel orchestrator code.
- Explain how awaited durable tasks become checkpoints.
- Explain replay and determinism.
- Bound fan-out to protect dependencies.
- Distinguish transient retry from compensation.
- Design compensating operations in reverse order.
- Handle partial fan-out failure.
- Use sub-orchestrations and `ContinueAsNew`.
- Version long-running workflows safely.
- Describe limits of exactly-once claims.

## Core Concepts

### Workflow State Is Event-Sourced

An orchestrator's local variables appear to persist:

```csharp
decimal total = 0;

foreach (OrderLine line in input.Lines)
{
    total +=
        await context.CallActivityAsync<decimal>(
            nameof(PriceLine),
            line);
}
```

The process does not hold the local variable for the entire workflow. The runtime stores activity scheduling and results in history. On resume, it replays the code and supplies recorded results so `total` is reconstructed.

### Checkpoints

Durable operations create durable progress:

- Activity scheduling and completion.
- Sub-orchestration calls.
- Durable timers.
- External events.
- Entity calls.

Ordinary local assignments are not independently persisted, but replay reconstructs them from deterministic code and durable results.

### Function Chaining

Function chaining runs activities in sequence:

```csharp
[Function(nameof(ProvisionCustomer))]
public static async Task<CustomerResult> ProvisionCustomer(
    [OrchestrationTrigger]
    TaskOrchestrationContext context)
{
    var input =
        context.GetInput<CustomerRequest>()!;

    Customer customer =
        await context.CallActivityAsync<Customer>(
            nameof(CreateCustomer),
            input);

    Account account =
        await context.CallActivityAsync<Account>(
            nameof(CreateAccount),
            customer);

    await context.CallActivityAsync(
        nameof(SendWelcomeMessage),
        new WelcomeRequest(customer, account));

    return new CustomerResult(
        customer.Id,
        account.Id);
}
```

Each step starts only after the previous step completes. Results are persisted in orchestration history.

### Chaining Trade-Offs

Chaining is appropriate when:

- A step depends on a prior result.
- Ordering matters.
- Later work must not begin before a prerequisite.
- Each step needs an independent retry or compensation boundary.

It increases latency because independent work is serialized. Do not chain steps that can execute safely in parallel.

### Activity Input and Output

Activities accept one serializable input and return one serializable output. Use records or DTOs for multiple values:

```csharp
public sealed record ChargePaymentInput(
    string OrderId,
    decimal Amount,
    string IdempotencyKey);
```

Avoid passing:

- Open streams.
- Database connections.
- SDK clients.
- Very large object graphs.
- Secrets that need not be persisted.

Inputs and outputs can be stored in durable history, so consider size, privacy, retention, and serialization compatibility.

### Fan-Out/Fan-In

Fan-out schedules independent activities without awaiting each one immediately. Fan-in awaits all results:

```csharp
var tasks =
    input.Files
        .Select(file =>
            context.CallActivityAsync<FileResult>(
                nameof(ProcessFile),
                file))
        .ToList();

FileResult[] results =
    await Task.WhenAll(tasks);

return await context.CallActivityAsync<Summary>(
    nameof(BuildSummary),
    results);
```

The runtime can distribute activities across available workers and persist each result.

### Parallelism Is Not Free

A large fan-out can overwhelm:

- Databases.
- External APIs.
- Storage accounts.
- Network connections.
- Function app memory.
- Durable backend throughput.

For large workloads:

- Partition into batches.
- Use sub-orchestrations.
- Limit concurrent waves.
- Rate-limit activities.
- Match function scale to dependency capacity.
- Keep fan-in result size bounded.

The orchestrator can schedule thousands of activities, but the downstream system may support only dozens of safe concurrent operations.

### Bounded Fan-Out

One approach is deterministic batching:

```csharp
const int batchSize = 25;

for (int offset = 0;
     offset < input.Items.Count;
     offset += batchSize)
{
    Item[] batch =
        input.Items
            .Skip(offset)
            .Take(batchSize)
            .ToArray();

    Task<Result>[] tasks =
        batch.Select(item =>
            context.CallActivityAsync<Result>(
                nameof(ProcessItem),
                item))
        .ToArray();

    await Task.WhenAll(tasks);
}
```

The item collection and ordering must be deterministic across replay.

### Partial Fan-Out Failure

`Task.WhenAll` fails when one or more activities fail. Some sibling activities may already have completed side effects.

Decide:

- Retry only failed items.
- Retry the entire idempotent batch.
- Accept partial success.
- Compensate completed items.
- Record failed items for manual review.

Do not assume a failed fan-in means no fan-out work occurred.

### Sub-Orchestrations

Sub-orchestrations encapsulate reusable workflow sections:

```csharp
RegionResult result =
    await context.CallSubOrchestratorAsync<RegionResult>(
        nameof(ProcessRegion),
        regionInput);
```

They help:

- Reduce parent history complexity.
- Isolate retries and failures.
- Organize ownership.
- Reuse workflow logic.
- Partition high-cardinality processing.

They add scheduling and storage overhead, so do not create one for every trivial activity.

### Asynchronous HTTP Workflow

Long-running workflows should not keep an HTTP request open:

1. An HTTP client function starts an orchestration.
2. It returns `202 Accepted`.
3. The response contains a status-query URL.
4. The client polls status or receives a notification.
5. The workflow completes independently.

This pattern avoids the approximately 230-second HTTP response limit.

### Runtime Status

Typical orchestration states include:

- Pending.
- Running.
- Completed.
- Failed.
- Terminated.
- Suspended.

Status APIs can return:

- Input.
- Output.
- Custom status.
- Created and updated times.
- Failure details, subject to settings and security.

Do not expose sensitive workflow payloads through public status endpoints.

### Custom Status

Expose compact progress:

```csharp
context.SetCustomStatus(
    new
    {
        Stage = "ProcessingFiles",
        Completed = offset,
        Total = input.Items.Count
    });
```

Custom status is persisted. Keep it small and avoid updating it on every tiny operation in high-volume workflows.

### Monitor Pattern

A monitor workflow checks a condition repeatedly:

```csharp
while (true)
{
    bool ready =
        await context.CallActivityAsync<bool>(
            nameof(CheckDeployment),
            input);

    if (ready)
    {
        break;
    }

    await context.CreateTimer(
        context.CurrentDateTimeUtc
            .AddMinutes(5),
        CancellationToken.None);
}
```

Use durable timers so the workflow unloads between checks. Define a deadline or maximum attempts to prevent unbounded forgotten instances.

### External Events and Workflow State

External events allow workflows to wait for:

- Approval.
- Callback.
- Payment settlement.
- Device response.
- Manual remediation.

Combine them with timers for deadlines. Treat events as commands against an instance:

- Authenticate and authorize the sender.
- Validate expected current state.
- Deduplicate repeated event IDs.
- Handle events arriving after timeout or completion.

### Replay-Safe Code

Replay-safe orchestrator code should:

- Use only deterministic branching data.
- Use `context.CurrentDateTimeUtc`.
- Use `context.NewGuid()`.
- Schedule I/O through activities.
- Use durable timers.
- Use replay-safe loggers.
- Avoid mutable static state.
- Avoid reading changing environment configuration.
- Avoid unsupported asynchronous APIs.

Code review for orchestrators should explicitly check determinism.

### Deterministic Collections

Iteration order can affect scheduled activity order. Use stable ordered inputs:

- Sort items by a stable key.
- Avoid iteration over collections with nondeterministic order.
- Persist decisions through activity results.
- Do not query a changing source directly from the orchestrator.

If an activity discovers work, return the fixed work list to the orchestrator. The result is then stored in history.

### Replay and Logging

The orchestrator executes repeatedly during replay. Use:

```csharp
ILogger logger =
    context.CreateReplaySafeLogger(
        nameof(Workflow));
```

Otherwise, a single logical step can generate repeated log entries. Use activity logs for actual side-effect attempts and orchestrator logs for durable workflow decisions.

### Retry Policies

Retries are appropriate for transient failures such as:

- Temporary network failure.
- Service throttling.
- Short service outage.
- Optimistic concurrency conflict.

Configure bounded attempts and delay:

```csharp
var options =
    TaskOptions.FromRetryPolicy(
        new RetryPolicy(
            maxNumberOfAttempts: 5,
            firstRetryInterval:
                TimeSpan.FromSeconds(10)));

await context.CallActivityAsync(
    nameof(CallPartner),
    input,
    options);
```

Do not retry:

- Invalid input.
- Authorization denial.
- Business rejection.
- Unsupported operation.
- Permanently missing data.

### Retry Versus Compensation

Retry tries to make an intended step succeed. Compensation responds after a prior step succeeded but the overall workflow cannot complete.

Example:

```text
Reserve inventory -> succeeds
Capture payment -> succeeds
Create shipment -> permanently fails

Compensate:
Refund payment
Release inventory
```

Compensation is a business action, not a database rollback.

### Compensation Stack

Track completed compensable steps deterministically:

```csharp
var completed =
    new List<string>();

try
{
    await context.CallActivityAsync(
        nameof(ReserveInventory),
        input);
    completed.Add("inventory");

    await context.CallActivityAsync(
        nameof(CapturePayment),
        input);
    completed.Add("payment");

    await context.CallActivityAsync(
        nameof(CreateShipment),
        input);
}
catch
{
    foreach (string step in
        completed.AsEnumerable().Reverse())
    {
        await context.CallActivityAsync(
            nameof(CompensateStep),
            new CompensationRequest(
                input.OrderId,
                step));
    }

    throw;
}
```

In a real workflow, use typed compensation records rather than string dispatch.

### Reverse-Order Compensation

Compensate in reverse order because later effects often depend on earlier effects:

```text
Do A
Do B
Do C

Undo C
Undo B
Undo A
```

Business rules can require a different order. Document dependencies and make compensation activities independently retryable.

### Compensation Is Not Perfect Undo

Some actions cannot be fully reversed:

- An email was read.
- A package already shipped.
- A market price changed.
- A third party charged a fee.
- A deadline passed.

Compensation may:

- Issue a refund.
- Create a return request.
- Send a correction.
- Mark for manual review.
- Record a financial adjustment.

Model the real business consequence instead of pretending all work is reversible.

### Idempotent Compensation

Compensation activities can also execute more than once. Use:

- Stable compensation IDs.
- State-machine guards.
- Conditional refunds or releases.
- Existing-result lookup.
- Audit records.

Record both the original action and compensation outcome.

### Compensation Failure

If compensation fails:

- Retry transient errors.
- Persist the unresolved state.
- Alert an owning team.
- Expose custom status.
- Provide manual recovery.
- Resume or signal the workflow after correction.

Never swallow compensation failure and mark the workflow fully recovered.

### Saga-Like Coordination

A Durable workflow can implement an orchestrated saga:

- Each activity owns a local transaction.
- The orchestrator determines the next step.
- Failures trigger compensating activities.
- State and decisions are durably recorded.

This does not create a distributed ACID transaction. Temporary inconsistency is part of the design.

### Continue as New

Long-running loops accumulate history. `ContinueAsNew` completes the current execution history and starts the same instance with new input:

```csharp
context.ContinueAsNew(
    new MonitorState(
        input.ResourceId,
        iteration + 1));
```

Use it for:

- Eternal orchestrations.
- Long monitors.
- Periodic aggregation.
- Workflows with repeated event cycles.

Carry forward only the state needed by the next generation.

### History and Payload Size

History stores activity inputs, outputs, exceptions, events, timers, and decisions. Large payloads cause:

- More storage.
- Slower replay.
- Higher latency.
- Greater exposure of sensitive data.

Store large artifacts externally and pass secure identifiers or references. Protect external data with retention and authorization.

### Workflow Versioning

Running instances replay against deployed code. Incompatible changes include:

- Reordering activity calls.
- Adding a call on only one replay path based on changing data.
- Removing historical steps.
- Renaming activities still referenced by old instances.
- Changing serialized types incompatibly.

Strategies:

- Keep changes replay-compatible.
- Create `WorkflowV2`.
- Route new starts to V2.
- Keep V1 code while old instances drain.
- Use supported versioning features where appropriate.

### Deployment Slots

Slots sharing a task hub can both process the same orchestration messages. Use separate task hubs when both deployments are active and potentially incompatible.

Plan:

- Which version starts new instances.
- Which version owns old instances.
- How events reach the correct version.
- How rollback affects workflow history.

### Failure Observability

Monitor:

- Failed orchestration count.
- Activity retries and duration.
- Compensation attempts and failures.
- Oldest running workflow.
- External event wait age.
- Fan-out width and completion rate.
- History size and replay time.
- Backend queue depth and throttling.
- Manual recovery backlog.

Use instance and business IDs for correlation.

### Testing Workflow Patterns

Test:

- Happy-path sequence.
- Transient retry.
- Permanent failure at every step.
- Compensation after each completed prefix.
- Duplicate activity execution.
- Partial fan-out completion.
- External event before and after timeout.
- Replay determinism.
- Version upgrade with active instances.
- Restart during long waits.

Unit-test deterministic decision logic separately, but also run integration tests with the Durable runtime and configured backend.

### Common Mistakes

- Awaiting activities inside a fan-out loop and accidentally serializing them.
- Fanning out without a dependency concurrency limit.
- Assuming `Task.WhenAll` failure means no work completed.
- Performing I/O in orchestrator code.
- Reading current time or random values directly.
- Logging repeatedly during replay.
- Retrying permanent business failures.
- Treating compensation as automatic rollback.
- Writing non-idempotent compensation.
- Ignoring compensation failure.
- Passing large payloads through workflow history.
- Growing eternal history without `ContinueAsNew`.
- Deploying incompatible orchestrator changes over active instances.

### Practical Best Practices

- Chain only genuinely dependent steps.
- Use bounded fan-out for independent work.
- Make every activity and compensation idempotent.
- Keep orchestrator decisions deterministic.
- Use durable timers and external events for async waits.
- Separate retry policy from compensation policy.
- Compensate completed effects in a deliberate order.
- Expose compact custom status.
- Use sub-orchestrations for meaningful workflow boundaries.
- Use `ContinueAsNew` to control history.
- Version workflows with active instances in mind.
- Test partial failure and recovery, not only the happy path.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is function chaining in Durable Functions?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q01 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Function chaining is an orchestrator calling activities in sequence, commonly passing one activity's output to the next. Each awaited activity is durably recorded, so the workflow can resume after restart without rerunning completed scheduling decisions as new work.

##### Key Points to Mention

- Use chaining when order or dependency matters.
- Activities perform the actual side effects.
- Results become part of orchestration history.
- Independent work should not be serialized unnecessarily.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q01 -->

#### What is fan-out/fan-in?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q02 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Fan-out schedules several independent activities before awaiting them. Fan-in waits for the activities and aggregates their results. Durable Functions persists each activity result and can distribute the work across available workers.

##### Key Points to Mention

- Create tasks first, then use `Task.WhenAll`.
- Parallel work must be independent.
- Bound concurrency around dependencies.
- Handle partial success and failure.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q02 -->

#### How does Durable Functions preserve workflow state?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q03 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The runtime records an event history containing scheduled work, results, timers, and external events. When the workflow resumes, it replays orchestrator code from the beginning and supplies recorded outcomes, reconstructing local variables and control flow deterministically.

##### Key Points to Mention

- State is event-sourced.
- No thread remains alive during long waits.
- Replay requires deterministic code.
- Durable task results act as checkpoints.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q03 -->

#### What is compensation?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q04 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Compensation is a business action that reverses or mitigates a previously completed step after the overall workflow cannot finish. Examples include refunding a payment or releasing inventory. It is not an automatic database rollback and may not perfectly undo the original action.

##### Key Points to Mention

- Retry and compensation solve different problems.
- Compensation is often applied in reverse order.
- Compensation activities must be idempotent.
- Manual recovery may be necessary.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you limit a fan-out that processes thousands of items?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q01 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Partition items into deterministic batches or sub-orchestrations and await one bounded wave at a time. Configure function concurrency and scale limits around database, API, and storage capacity. Keep each fan-in result compact and monitor backend queue depth, completion rate, and throttling.

##### Key Points to Mention

- Platform scale is not dependency capacity.
- Deterministic ordering matters during replay.
- Sub-orchestrations can partition history.
- Use load testing to choose batch size.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q01 -->

#### How should partial failure in `Task.WhenAll` be handled?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q02 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Assume some sibling activities may already have succeeded. Decide whether failed items can be retried independently, whether partial success is acceptable, or whether completed side effects require compensation. Activities and retry paths must be idempotent, and failed item identities should remain observable for replay or manual handling.

##### Key Points to Mention

- Failure is not atomic cancellation.
- Sibling activities can continue.
- Preserve per-item outcomes.
- Avoid rerunning successful non-idempotent work.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q02 -->

#### What makes orchestrator code replay-safe?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q03 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The same input and history must produce the same durable task schedule. Use orchestration-context time and GUID APIs, stable collection ordering, durable timers, replay-safe logging, and activities for external I/O. Do not read changing configuration or call arbitrary asynchronous APIs in the orchestrator.

##### Key Points to Mention

- Replay starts code from the beginning.
- Activity results are deterministic history.
- Static mutable state is unsafe.
- Determinism should be reviewed explicitly.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q03 -->

#### How would you design a compensation sequence?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q04 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Record which compensable steps completed, then on permanent failure call compensation activities in the required order, commonly reverse order. Give each compensation a stable ID, bounded transient retry, audit record, and manual-recovery path. Preserve the workflow as failed or compensation-incomplete until recovery is verified.

##### Key Points to Mention

- Compensate only completed effects.
- Business dependencies determine order.
- Compensation itself can fail or duplicate.
- Do not hide unresolved recovery.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you implement an order saga with Durable Functions?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q01 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use an orchestrator to call idempotent local-transaction activities such as reserve inventory, capture payment, and create shipment. Apply bounded retries only to transient failures. Track completed steps and invoke idempotent compensation such as refund and release in the correct order after permanent failure. Expose status and alert if compensation cannot complete.

##### Key Points to Mention

- This is not distributed ACID.
- Temporary inconsistency is expected.
- Use stable operation and compensation IDs.
- Persist audit and manual-recovery information.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q01 -->

#### How would you control history growth in a long-running workflow?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q02 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use meaningful activity granularity, sub-orchestrations to partition complex work, external storage for large payloads, and `ContinueAsNew` for repeated cycles. Purge completed history according to retention requirements. Monitor history size, replay duration, backend queues, and storage throttling.

##### Key Points to Mention

- Every durable action adds history.
- Large payloads slow replay.
- `ContinueAsNew` resets history for the same logical instance.
- Retention must consider audit requirements.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q02 -->

#### How would you safely deploy a changed fan-out workflow while old instances are running?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q03 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep the old orchestrator and activity contracts available for existing history. Introduce a new orchestrator name or supported version for new instances, use separate task hubs or controlled routing when deployments are incompatible, and let old instances drain. Validate serialization and external-event compatibility before removing old code.

##### Key Points to Mention

- Replay uses deployed code.
- Reordered schedules can be nondeterministic.
- Activities referenced by old history must remain.
- Monitor active instance populations.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q03 -->

#### Can Durable Functions guarantee exactly-once business side effects?

<!-- question:start:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q04 -->
<!-- question-id:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

No. Durable history prevents normal replay from scheduling recorded work again as new work, but an activity can complete an external side effect and fail before its result is recorded. The activity may then run again. Exactly-once business behavior requires idempotency keys, conditional writes, deduplication, or provider-supported transactional semantics.

##### Key Points to Mention

- Activities have at-least-once execution.
- Workflow durability is not external transactionality.
- Compensation also needs idempotency.
- Avoid claiming exactly once across distributed systems.

<!-- question:end:function-chaining-fan-out-fan-in-async-workflow-state-replay-and-compensation-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
