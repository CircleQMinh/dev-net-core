---
id: error-states-and-retry-ux-for-failed-requests
topic: Routing, forms, and server communication
subtopic: Error states and retry UX for failed requests
category: React
---

## Overview

Error states and retry UX are about what users experience when a request fails. A React app should not collapse into a blank page, hide the failure, or force users to guess whether retrying is safe. Good error UX explains what happened, preserves useful context, offers the right recovery action, and avoids making the situation worse.

Failed requests can happen for many reasons:

- The user is offline.
- The server is temporarily unavailable.
- A request times out.
- Authentication expired.
- Authorization failed.
- A resource was not found.
- Validation failed.
- A mutation conflict occurred.
- The client sent invalid data.
- A background refetch failed while stale data is still available.

For interviews, this topic matters because error handling reveals engineering maturity. Strong candidates distinguish validation errors from route errors, expected 404s from unexpected exceptions, foreground failures from background refresh failures, and safe retries from dangerous duplicate mutations.

The practical goal is to design recovery paths: retry, edit and resubmit, sign in again, go back, refresh data, contact support, or keep using stale data while the app recovers.

## Core Concepts

### Types of Request Failures

Not all failed requests are the same.

Common categories:

- Validation errors: the user can fix input.
- Authentication errors: the user needs to sign in again.
- Authorization errors: the user does not have permission.
- Not found errors: the resource does not exist or is no longer available.
- Conflict errors: the data changed or the action is no longer valid.
- Rate limit errors: the user or app should slow down.
- Network errors: the client could not reach the server.
- Server errors: the server failed unexpectedly.

The UI should respond differently to each category. A field validation error belongs near the field. A missing route resource belongs in a route error boundary. A background refresh failure may only need a toast or stale-data indicator.

### Expected Errors vs Unexpected Errors

Expected errors are part of normal product flow:

- Invalid email.
- Missing required field.
- Password too short.
- Username already taken.
- Permission denied for a known action.
- Resource not found.

Unexpected errors are bugs or infrastructure failures:

- Unhandled exception.
- Server crash.
- Invalid response shape.
- Failed route module.
- Unknown thrown value.

Expected validation errors should usually be returned as structured data. Unexpected errors should be logged and handled by an error boundary or generic fallback.

### Field Errors, Form Errors, and Page Errors

Match the error location to the scope of the problem.

Field error:

```tsx
<input
  id="email"
  name="email"
  aria-invalid={Boolean(errors.email)}
  aria-describedby={errors.email ? "email-error" : undefined}
/>
{errors.email && (
  <p id="email-error" role="alert">
    {errors.email}
  </p>
)}
```

Form-level error:

```tsx
{formError && (
  <p role="alert">
    {formError}
  </p>
)}
```

Page-level error:

```tsx
function ProjectErrorBoundary() {
  const error = useRouteError();

  return <ErrorPanel error={error} />;
}
```

Do not show every error as a full-page failure. Keep the error as local as possible.

### Route Error Boundaries

Route error boundaries catch route-level failures from route components, loaders, actions, and route APIs.

```tsx
const router = createBrowserRouter([
  {
    path: "/projects/:projectId",
    loader: projectLoader,
    Component: ProjectPage,
    ErrorBoundary: ProjectErrorBoundary,
  },
]);
```

Use route error boundaries for:

- Not found resources.
- Unauthorized or forbidden route access.
- Loader failures that prevent the page from rendering.
- Unexpected route component failures.

Do not use route error boundaries for normal form validation. Validation errors are expected user-correctable states and should be returned to the form.

### Local Error States

Local components often need local error states for small interactions.

```tsx
function InlineSave({ task }: { task: Task }) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function saveTitle(title: string) {
    setStatus("saving");
    setError(null);

    try {
      await updateTask(task.id, { title });
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Could not save. Try again.");
    }
  }

  return (
    <>
      <button disabled={status === "saving"}>Save</button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
```

Use local errors when the failure affects one widget, row, or action. Use route boundaries when the route cannot render correctly.

### Retry UX

Retry UX gives the user a clear way to attempt the request again.

```tsx
function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section role="alert">
      <h2>Something went wrong</h2>
      <p>{message}</p>
      <button onClick={onRetry}>Try again</button>
    </section>
  );
}
```

Good retry UX:

- Explains what failed in plain language.
- Keeps user input when possible.
- Shows whether retry is in progress.
- Avoids duplicate unsafe mutations.
- Uses backoff for automatic retries.
- Gives alternatives when retry will not help.

Retry should be available when the failure is likely temporary. It should not be the main answer for validation, authorization, or not-found errors.

### Safe vs Unsafe Retries

Retrying a read is usually safe:

```tsx
await fetchProject(projectId);
```

Retrying a mutation may be unsafe if the server could have completed the first request but the client did not receive the response.

Risky examples:

- Creating an order.
- Charging a payment.
- Sending an email.
- Deleting a record.
- Submitting a one-time action.

Safer mutation retries often require:

- Idempotency keys.
- Server-side duplicate detection.
- Clear confirmation state.
- User confirmation.
- A way to reconcile unknown outcomes.

Interview answer: do not blindly retry all failed requests.

### Automatic Retries

Client cache libraries often provide automatic retry for failed queries. Automatic retries are useful for transient network or server issues, especially for reads.

Good automatic retry candidates:

- Temporary network failure.
- 502, 503, or 504 style transient server errors.
- Background refresh.

Poor automatic retry candidates:

- 400 validation errors.
- 401 unauthenticated.
- 403 forbidden.
- 404 not found.
- Non-idempotent mutations.

Use retry limits and backoff. Infinite rapid retries create poor UX and unnecessary load.

### Backoff and Retry Delay

Backoff means waiting longer between retry attempts.

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

Backoff helps avoid hammering a failing service. It also gives transient problems time to recover.

For user-triggered retry, show a button. For automatic retry, consider showing subtle feedback such as "Reconnecting..." or "Retrying...".

### Background Refresh Failures

A background refetch failure is different from an initial page load failure. If the UI already has data, it may be better to keep showing stale data and display a small warning.

```tsx
function UsersPanel({ users, refreshError }: Props) {
  return (
    <section>
      {refreshError && (
        <p role="status">
          Could not refresh. Showing the last loaded data.
        </p>
      )}
      <UserList users={users} />
    </section>
  );
}
```

Do not replace useful stale content with a full-page error just because a background refresh failed.

### Error Boundaries and Reset

When errors are thrown to a boundary, the retry action often needs to reset that boundary and re-run the request.

```tsx
function BoundaryFallback({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h2>Could not load this section</h2>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
```

With query libraries and suspense/error-boundary integrations, a reset boundary can tell failed queries to try again on the next render.

Route-level errors may retry through navigation, revalidation, or a route-specific retry button.

### Preserving User Input

When a form submission fails, keep the user's input whenever possible.

Good:

- Preserve field values.
- Show field errors.
- Keep focus near the failed field or summary.
- Let the user correct and resubmit.

Bad:

- Clear the whole form on server validation failure.
- Replace the form with a generic error page for fixable input.
- Hide which field failed.

For route actions, return validation data and re-render the same form. For controlled forms, keep local field state unless the submit succeeds.

### Retry Buttons and Duplicate Work

Retry buttons should be disabled while retrying.

```tsx
function RetryButton({
  retrying,
  onRetry,
}: {
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <button disabled={retrying} onClick={onRetry}>
      {retrying ? "Trying again..." : "Try again"}
    </button>
  );
}
```

For mutations, make sure retrying will not duplicate a successful operation. If the outcome is unknown, show a safer message:

```text
We could not confirm whether the payment completed. Please check your orders before trying again.
```

### Offline and Network-Aware UI

Network failures may need different UX from server errors.

Examples:

- "You appear to be offline. Check your connection and try again."
- "Your changes are saved locally and will sync when you reconnect."
- "Could not refresh. Showing cached data."

Offline-capable apps may queue mutations and replay them later. That requires careful conflict handling and user-visible sync state.

Do not promise offline saving unless the app actually persists and synchronizes changes reliably.

### Authentication and Authorization Failures

Authentication and authorization failures need specific recovery paths.

401 or expired session:

- Prompt sign-in.
- Preserve intended destination.
- Avoid losing unsaved form data when possible.

403 forbidden:

- Explain that the user lacks permission.
- Do not show a retry button unless permissions might change.
- Offer navigation back to a safe area.

Retrying a forbidden request usually will not help.

### Observability and Support

Good error UX is not just frontend state. Production failures need observability.

Useful practices:

- Log unexpected errors.
- Capture request IDs or correlation IDs.
- Show a support-safe error code when appropriate.
- Avoid leaking stack traces or sensitive server details to users.
- Preserve enough context for debugging.

Example user-facing copy:

```text
We could not load this invoice. Try again or contact support with code INV-LOAD-2026.
```

The code should map to logs or telemetry.

### Common Mistakes

Common mistakes include:

- Showing a generic full-page error for field validation.
- Retrying every failure automatically.
- Retrying unsafe mutations without idempotency.
- Clearing user input after validation fails.
- Hiding background refresh failures completely.
- Replacing stale usable data with an error page.
- Showing technical stack traces to users.
- Giving users a retry button for 403 or validation errors.
- Not disabling retry while it is already running.
- Treating route error boundaries as normal control flow.
- Failing to log unexpected request errors.

### Best Practices

Use these rules of thumb:

- Classify the error before choosing UX.
- Keep errors as local as possible.
- Use field errors for fixable input.
- Use route boundaries for route-blocking failures.
- Preserve useful stale data during background refresh failures.
- Offer retry for transient read failures.
- Use backoff for automatic retries.
- Be careful retrying mutations.
- Preserve user input on failed submit.
- Provide clear recovery actions and accessible error messages.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What should a good error state include?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-beginner-q01 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A good error state should explain what failed in language the user can understand, keep useful context visible, and provide a recovery action when one exists. For example, a failed read might show "Could not load projects" with a "Try again" button.

It should not expose raw stack traces or vague messages like "Error." It should also be scoped correctly: field errors near fields, local widget errors near the widget, and full-page errors only when the page cannot render.

##### Key Points to Mention

- Use clear user-facing language.
- Keep errors scoped to the affected area.
- Provide recovery actions when useful.
- Avoid leaking technical details.
- Preserve context and user input when possible.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-beginner-q01 -->

#### What is the difference between a validation error and a request failure?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-beginner-q02 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A validation error means the user's input does not meet requirements and can usually be fixed by editing the form. A request failure means the request could not complete successfully because of network, server, permission, not-found, or other problems.

Validation errors should usually be displayed near the fields. Request failures may need form-level, widget-level, or route-level error UI depending on scope.

##### Key Points to Mention

- Validation errors are expected and user-correctable.
- Request failures may be network, server, auth, or not-found issues.
- Field validation belongs near fields.
- Route-blocking failures may use route error boundaries.
- Retry is not useful for most validation errors.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-beginner-q02 -->

#### When should a UI show a retry button?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-beginner-q03 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A retry button is useful when the failure may be temporary and repeating the request is safe. Examples include failed reads, temporary network errors, or server availability issues.

Retry is less useful for validation errors, forbidden access, or not-found resources. Retrying mutations needs extra care because it may duplicate the operation if the first request actually succeeded but the response was lost.

##### Key Points to Mention

- Retry is good for transient failures.
- Reads are usually safer to retry than writes.
- Validation and 403 errors need correction or permission changes.
- Mutation retries may need idempotency.
- Disable the retry button while retry is in progress.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-beginner-q03 -->

#### Why should failed forms preserve user input?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-beginner-q04 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Failed forms should preserve user input because losing typed data is frustrating and can cause real work loss. If validation fails, users should be able to correct the invalid fields without retyping everything.

The form should show field-level errors, keep valid fields intact, and let the user resubmit after fixing the problem.

##### Key Points to Mention

- Preserve user effort.
- Show field-specific errors.
- Do not clear the form on validation failure.
- Keep focus and accessibility in mind.
- Clear or redirect only after successful submit when appropriate.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should route error boundaries be used for failed requests?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-intermediate-q01 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Route error boundaries should handle failures that prevent a route from rendering correctly, such as a loader failing, a resource not being found, an authorization failure, or an unexpected exception in a route component.

Place boundaries where the failure should be isolated. A child route boundary can show an invoice-specific error while keeping the app layout visible. A root boundary catches global failures.

Normal form validation should be returned as action data and rendered in the form, not thrown to a route boundary.

##### Key Points to Mention

- Boundaries handle route-blocking failures.
- The closest boundary catches the error.
- Local boundaries preserve broader layout.
- Root boundaries catch global failures.
- Validation errors should not usually use boundaries.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-intermediate-q01 -->

#### How should background refresh errors be displayed?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-intermediate-q02 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

If the app already has usable data and a background refresh fails, keep showing the stale data and show a small warning or status message. Do not replace useful content with a full-page error unless the data is no longer safe or meaningful.

Example copy: "Could not refresh. Showing last loaded data." This is less disruptive and tells the user what is happening.

##### Key Points to Mention

- Background failures differ from initial-load failures.
- Keep stale data visible when useful.
- Show a subtle warning or retry option.
- Avoid full-page errors for background refresh.
- Make stale state understandable.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-intermediate-q02 -->

#### How should automatic retries be configured?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-intermediate-q03 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Automatic retries should be limited and should use backoff. They are most useful for transient failures such as network issues or temporary server errors. They should usually not retry validation errors, forbidden access, not-found responses, or unsafe mutations.

Backoff prevents the client from hammering a failing service. For example, retry after one second, then two seconds, then four seconds, up to a maximum.

##### Key Points to Mention

- Use retry limits.
- Use exponential or capped backoff.
- Retry transient read failures.
- Do not retry permanent client errors.
- Be cautious with mutation retries.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-intermediate-q03 -->

#### How should authentication and authorization errors differ in UX?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-intermediate-q04 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

An authentication error means the user is not signed in or the session expired. The UI should guide them to sign in again and ideally preserve the intended destination or unsaved work.

An authorization error means the user is signed in but lacks permission. Retrying usually will not help. The UI should explain that access is not allowed and offer a safe next step, such as going back or requesting access.

##### Key Points to Mention

- 401 usually means sign in again.
- Preserve intended destination when possible.
- 403 means lack of permission.
- Retry is usually not useful for 403.
- Avoid exposing sensitive resource details.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design retry UX for a failed mutation?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-advanced-q01 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

First determine whether retrying is safe. If the mutation is idempotent, such as saving a profile with a stable ID, retry can be straightforward. If the mutation could duplicate work, such as charging a card or creating an order, retry needs idempotency keys, duplicate detection, or a confirmation flow.

The UI should explain the failure, keep user input, disable the retry button while retrying, and reconcile with server state after retry. If the outcome is unknown, avoid encouraging blind repeated submits.

##### Key Points to Mention

- Reads are safer to retry than writes.
- Mutation retry requires idempotency thinking.
- Preserve input and pending state.
- Disable duplicate retries.
- Reconcile with server state after retry.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-advanced-q01 -->

#### How do error boundaries and query retry/reset boundaries work together?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-advanced-q02 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

When a query is configured to throw errors to an error boundary, the boundary renders fallback UI. A retry action needs to reset the boundary and tell the query layer that it can try again. Libraries such as TanStack Query provide reset-boundary patterns for this.

The key idea is that the visible error boundary and the data layer's internal error state must both be reset. Otherwise, re-rendering may immediately show the same error state again.

##### Key Points to Mention

- Error boundaries catch thrown render/data errors.
- Query libraries may store error state internally.
- Retry often needs both boundary reset and query reset.
- The fallback should include a clear retry action.
- Scope boundaries to meaningful page or widget areas.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-advanced-q02 -->

#### How would you classify errors before choosing UI?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-advanced-q03 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Classify by cause, scope, and recoverability. Cause asks whether it is validation, auth, permission, not found, conflict, network, server, or unknown. Scope asks whether it affects one field, one widget, one route, or the whole app. Recoverability asks whether the user can edit input, sign in, retry, go back, refresh, or contact support.

This classification prevents generic full-page errors for small problems and prevents useless retry buttons for permanent failures.

##### Key Points to Mention

- Classify by cause.
- Classify by UI scope.
- Classify by recoverability.
- Choose local, form, route, or global error UI.
- Match retry actions to recoverable failures.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-advanced-q03 -->

#### What observability should support failed request UX?

<!-- question:start:error-states-and-retry-ux-for-failed-requests-advanced-q04 -->
<!-- question-id:error-states-and-retry-ux-for-failed-requests-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Unexpected request failures should be logged with enough context to debug them: route, operation, status code, request or correlation ID, user/session context where appropriate, and sanitized error details. The UI can show a support-safe error code that maps to logs.

Do not expose stack traces, SQL errors, secrets, or internal server details to users. Good observability lets support and engineering diagnose the failure while the UI gives the user a clear recovery path.

##### Key Points to Mention

- Log unexpected failures.
- Capture correlation or request IDs.
- Sanitize user-facing error messages.
- Avoid leaking internal details.
- Support-safe codes can connect UI reports to telemetry.

<!-- question:end:error-states-and-retry-ux-for-failed-requests-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
