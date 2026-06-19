---
id: global-loading-error-unauthorized-and-network-failure-ux-patterns
topic: Production data access, API clients, and frontend auth
subtopic: Global loading, error, unauthorized, and network-failure UX patterns
category: React
---

## Overview

Global loading, error, unauthorized, and network-failure UX patterns define how a React application behaves when data is being fetched, requests fail, authentication expires, permissions are missing, or the browser cannot reach the server. These patterns decide whether users see a skeleton, inline error, toast, route error page, sign-in redirect, stale data warning, retry button, or offline banner.

This topic matters because production apps are mostly asynchronous. Real users see slow networks, expired sessions, background refetch failures, authorization changes, service outages, request timeouts, and partial data. A strong React app makes those states understandable and recoverable instead of leaving users staring at a spinner or blank page.

In interviews, this topic tests whether a candidate can distinguish local versus global errors, foreground versus background loading, authentication versus authorization, safe versus unsafe retry, and expected versus unexpected failures. It also reveals whether the candidate understands how React Router, TanStack Query, RTK Query, API clients, and error boundaries fit together.

The practical goal is to design a request state model that users can trust: clear status, preserved context, safe recovery actions, and no misleading success states.

## Core Concepts

### Global vs Local UX State

Not every loading or error state should be global.

Local states belong near the feature:

- A field validation error.
- A failed save button.
- A table row action failure.
- A missing optional widget.
- A background refresh warning for one panel.

Global states affect the whole app:

- Initial app session loading.
- Route-level data loading.
- App-wide offline state.
- Expired session.
- Maintenance or service outage.
- Unhandled route error.
- Unauthorized access to a protected area.

The key interview point: global UX should be reserved for states that truly affect navigation or the whole shell. Overusing global spinners and global toasts makes the app noisy and harder to use.

### Loading State Types

Loading is not one state.

Common types:

- Initial app loading: checking session, bootstrapping config, loading critical shell data.
- Route loading: navigating to a route that requires data.
- Component loading: loading a specific panel or widget.
- Mutation pending: saving, deleting, submitting, uploading, or retrying.
- Background fetching: stale data is visible while fresh data loads.
- Blocking loading: user cannot continue until the request completes.
- Non-blocking loading: user can keep working while data refreshes.

Each type needs different UX. A full-page spinner may be acceptable for app bootstrap, but it is usually poor for background refresh.

### Skeletons, Spinners, and Progress

Use loading indicators based on user context.

Skeletons are useful when:

- The layout is known.
- Content is loading for the first time.
- The user benefits from seeing page structure.

Spinners are useful when:

- The wait is short.
- The area is small.
- The layout is not predictable.

Progress bars are useful when:

- Progress is measurable.
- Upload or download size is known.
- A long operation has meaningful stages.

Avoid full-screen spinners for every request. They remove context and can make the app feel slower.

Example:

```tsx
function UserPage() {
  const { data, isPending, isFetching, error } = useUser();

  if (isPending) {
    return <UserPageSkeleton />;
  }

  if (error) {
    return <InlineError message="Could not load user." />;
  }

  return (
    <>
      {isFetching ? <SmallStatus text="Refreshing..." /> : null}
      <UserDetails user={data} />
    </>
  );
}
```

This preserves the loaded UI during background refresh.

### Foreground Loading vs Background Fetching

Foreground loading means the app does not have the data needed to render the screen. Background fetching means the app already has data and is checking for updates.

Foreground loading UX:

- Skeleton.
- Route pending UI.
- Disabled submit button.
- Blocking modal for critical operation.

Background fetching UX:

- Subtle refresh indicator.
- "Updated just now" timestamp.
- Non-blocking spinner near the data region.
- Stale data remains visible.

The mistake is replacing existing data with a spinner during every refetch. That creates flicker and loses user context.

### Error State Types

Different errors need different UX.

Common categories:

- Validation error: user can edit input.
- Authentication error: user needs to sign in again.
- Authorization error: user does not have permission.
- Not found error: resource no longer exists or URL is wrong.
- Conflict error: data changed or action is no longer valid.
- Rate limit error: user or client should wait.
- Network error: browser could not reach the server.
- Server error: backend failed.
- Unexpected app error: React rendering or route module failed.

Each category should map to a clear action: edit, retry, sign in, request access, go back, refresh, wait, or contact support.

### Local Errors

Local errors should appear where the user can act.

Examples:

- Field validation error under the field.
- Save failure near the save button.
- Failed table row action on that row.
- Failed widget inside the widget card.

Example:

```tsx
function SaveButton() {
  const mutation = useSaveProfile();

  return (
    <div>
      <button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? "Saving..." : "Save"}
      </button>
      {mutation.isError ? (
        <p role="alert">Could not save. Check your connection and try again.</p>
      ) : null}
    </div>
  );
}
```

Local errors keep the message close to the failed action.

### Global Errors

Global errors are for failures that affect the whole app or route.

Examples:

- App cannot load configuration.
- The current route failed to load required data.
- The user's session expired.
- The whole API is unavailable.
- A React error boundary caught an unexpected rendering failure.

Global error UX should include:

- Clear title.
- Plain-language explanation.
- Recovery action.
- Optional support code or correlation ID.
- Navigation escape hatch.

Avoid generic "Something went wrong" screens with no action. That is not a recovery path; it is a shrug wearing a trench coat.

### Route Error Boundaries

Route error boundaries are useful when a route-level loader, action, or component fails. They let the app show a scoped fallback instead of crashing the whole application.

Example shape:

```tsx
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <ErrorPage
      title="We could not load this page"
      actionLabel="Try again"
      onAction={() => window.location.reload()}
    />
  );
}
```

Good route boundaries distinguish:

- `404` not found.
- `401` unauthenticated.
- `403` forbidden.
- Unexpected server or rendering errors.

### Unauthorized vs Forbidden

Unauthorized and forbidden are different UX states.

`401 Unauthorized` usually means:

- The user is not signed in.
- The session expired.
- The access token is invalid.
- Reauthentication or token refresh may fix it.

UX examples:

- Refresh token and retry original request.
- Show session expired message.
- Redirect to sign-in with return URL.

`403 Forbidden` usually means:

- The user is signed in but lacks permission.
- Refreshing the token usually will not help.

UX examples:

- Show "You do not have access."
- Offer request-access workflow.
- Link back to a safe page.

Treating every `403` as a sign-in problem creates loops and confuses users.

### Session Expiration UX

When a session expires, the app should preserve user context when possible.

Good behavior:

- Stop retry loops.
- Clear sensitive cached data.
- Show a clear session-expired message.
- Redirect to sign-in with a safe return URL.
- Preserve unsaved non-sensitive form data when appropriate.
- Resume the original route after successful sign-in if allowed.

Example:

```ts
function handleUnauthorized() {
  queryClient.clear();
  authStore.clear();
  navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
}
```

Do not silently redirect users away from unsaved work without warning if the product can avoid it.

### Network Failure UX

Network failure is different from a server error. The browser may be offline, DNS may fail, a request may time out, or a device may switch networks.

Good network UX:

- Keep previously loaded data visible when safe.
- Show an offline or connection banner.
- Offer retry for foreground requests.
- Queue safe offline actions only if the product supports it.
- Avoid blaming the user with vague errors.
- Revalidate when connectivity returns.

Example:

```tsx
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  return isOnline;
}
```

Browser online/offline signals are useful hints, not perfect proof that the API is reachable.

### Retry UX

Retries should match the operation.

Safe retry candidates:

- Idempotent reads.
- Search requests.
- Background refetch.
- Failed GET after network loss.
- Upload chunks designed for retry.

Risky retry candidates:

- Payments.
- Creating orders.
- Sending messages.
- Deleting data.
- Any mutation without idempotency support.

Good retry UX:

- Shows what failed.
- Explains whether retry is safe.
- Disables duplicate submissions while pending.
- Uses backoff for automatic retries.
- Stops after a reasonable limit.
- Preserves user input.

Automatic retry is not a substitute for a visible recovery action when the final attempt fails.

### Global Loading State Aggregation

Some apps show a top progress bar or app-shell loading indicator when route navigation or critical requests are pending.

Example:

```tsx
function GlobalProgress() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  return isNavigating ? <div className="top-progress" /> : null;
}
```

For query libraries, aggregate fetching state carefully. A global spinner for every background refetch can make the app look permanently busy.

Better patterns:

- Top progress bar for navigation.
- Local skeletons for first load.
- Subtle "Refreshing" for background fetch.
- Button-level pending state for mutations.

### Global Error Notifications

Global toasts are useful for cross-cutting events, but they are easy to overuse.

Good toast candidates:

- Background refresh failed while stale data remains visible.
- Save succeeded.
- Network connection lost.
- Session will expire soon.
- User lacks permission for an attempted action.

Poor toast candidates:

- Field validation errors.
- Every failed query on initial page load.
- Repeated identical network failures.
- Errors already shown inline.

A good global notification system should deduplicate repeated messages and avoid covering important controls.

### Data Library State Mapping

TanStack Query and RTK Query expose request states that should map to UX deliberately.

Common mapping:

- First load pending: skeleton or route loading.
- Existing data plus fetching: subtle refresh indicator.
- Error with no data: inline or route error fallback.
- Error with stale data: keep stale data and show warning.
- Mutation pending: disable relevant action and show button state.
- Mutation error: show local error near the action.
- Unauthorized: trigger auth flow or session-expired handling.

Do not blindly turn every `isFetching` into a full-page spinner.

### Accessibility

Loading and error UX should be accessible.

Practices:

- Use `aria-busy` for regions being updated.
- Use `role="alert"` for important errors.
- Move focus to route-level errors when navigation fails.
- Keep button labels meaningful during pending state.
- Do not rely only on color.
- Preserve keyboard focus when retrying.
- Avoid spinner-only states with no text for long waits.

Example:

```tsx
<section aria-busy={isFetching}>
  {error ? <p role="alert">Could not load invoices.</p> : null}
  <InvoiceTable invoices={invoices} />
</section>
```

Accessibility is not decoration here. It determines whether users can recover from failure.

### Observability and Support

Global failures should be debuggable.

Useful context:

- Route.
- Request URL pattern.
- HTTP status.
- Error code.
- Correlation ID.
- User/session ID where allowed.
- Retry count.
- Network status.
- App version.

User-facing errors should avoid leaking internal details, but support teams need enough context to find the issue.

Example:

```tsx
<ErrorPage
  title="We could not load your dashboard"
  description="Try again. If this keeps happening, contact support."
  supportCode={correlationId}
/>
```

### Common Mistakes

Common mistakes include:

- Showing a full-page spinner for every refetch.
- Clearing stale data during background refresh.
- Treating `401` and `403` the same.
- Showing global toasts for field validation errors.
- Retrying unsafe mutations automatically.
- Losing user input after a failed request.
- Hiding retry actions.
- Swallowing errors in an API client and leaving UI stuck.
- Showing technical stack traces to users.
- Forgetting accessibility for loading and errors.
- Failing to clear sensitive data after session expiration.

### Best Practices

Best practices include:

- Classify loading as initial, route, component, mutation, or background.
- Keep stale data visible during background refresh when safe.
- Show local errors near local actions.
- Use route error boundaries for route failures.
- Separate unauthenticated from forbidden states.
- Preserve user input on failed submissions.
- Retry only safe operations automatically.
- Provide visible retry actions after final failure.
- Use offline banners for network-wide failure.
- Deduplicate global notifications.
- Clear sensitive cache on logout or definitive auth failure.
- Log enough diagnostic context without exposing secrets.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between local and global loading state?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q01 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Local loading state belongs to a specific component or action, such as a save button, table, or widget. Global loading state affects the whole page or app shell, such as initial app bootstrap, route navigation, or a protected session check.

Good UX uses the smallest loading indicator that explains what is happening. A full-page spinner should not be used for every small request.

##### Key Points to Mention

- Local loading is scoped to a feature.
- Global loading affects the app or route.
- Use skeletons for first load.
- Use button pending state for mutations.
- Avoid full-screen spinners for background refresh.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q01 -->

#### What should a good error state include?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q02 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A good error state should explain what failed in plain language, preserve useful context, and offer a recovery action such as retry, edit input, sign in, go back, or contact support. It should avoid exposing stack traces or raw internal errors to users.

For important failures, it may include a support code or correlation ID.

##### Key Points to Mention

- Clear message.
- Recovery action.
- Context preserved.
- No sensitive internal details.
- Support code when useful.
- Accessible announcement for important errors.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q02 -->

#### What is the difference between `401` and `403` in UX?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q03 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`401` usually means the user is not authenticated or the session expired, so the app may refresh the token, show a session-expired message, or redirect to sign in. `403` means the user is authenticated but does not have permission, so the app should show a forbidden or request-access experience.

Refreshing a token usually does not fix missing permission.

##### Key Points to Mention

- `401` is authentication-related.
- `403` is authorization-related.
- `401` may trigger sign-in or token refresh.
- `403` should explain missing access.
- Do not handle them the same way.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q03 -->

#### What should the UI do when the network is unavailable?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q04 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The UI should keep existing data visible when safe, show a clear offline or connection problem message, and offer retry for failed foreground requests. For background failures, a non-blocking banner or toast may be better than replacing the screen with an error.

The app should revalidate data when connectivity returns.

##### Key Points to Mention

- Keep stale data visible when safe.
- Show offline or network banner.
- Offer retry.
- Avoid destructive automatic retries.
- Revalidate when connection returns.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should background refetch failures be displayed?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q01 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

If the app already has usable data and a background refetch fails, it should usually keep the stale data visible and show a subtle warning, toast, or refresh indicator. Replacing the whole screen with an error is usually too disruptive.

The UI can provide a manual retry action and show when the data was last updated.

##### Key Points to Mention

- Preserve existing data.
- Show non-blocking warning.
- Distinguish stale data from no data.
- Provide retry.
- Avoid flicker and full-screen errors.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q01 -->

#### When should an error be handled by a route error boundary?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q02 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A route error boundary is appropriate when route-level data or route rendering fails and the route cannot display normally. Examples include loader failures, missing route resources, unauthorized route access, and unexpected component errors.

Local action failures, such as a failed save button, usually belong near the action instead of in a route boundary.

##### Key Points to Mention

- Route-level failures belong in route boundaries.
- Loader/action/rendering errors can be scoped by route.
- Local mutation errors should stay local.
- Boundaries should distinguish `404`, `401`, `403`, and unexpected errors.
- Recovery actions should be route-aware.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q02 -->

#### How should automatic retry be designed?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q03 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Automatic retry should be limited to failures likely to be transient and operations that are safe to repeat. Reads are usually safer to retry than mutations. Retry should have a maximum count, delay or backoff, and should stop on non-retryable errors such as validation, forbidden, or many business-rule failures.

After retries are exhausted, the UI should show a clear error and a manual recovery action.

##### Key Points to Mention

- Retry transient failures.
- Prefer idempotent reads.
- Limit retry count.
- Use backoff.
- Do not blindly retry unsafe mutations.
- Show final failure clearly.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q03 -->

#### How should a session-expired flow preserve user context?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q04 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

When a session expires, the app should stop retry loops, clear sensitive auth state and caches, and redirect to sign-in with a safe return URL. If possible, it should preserve non-sensitive unsaved work or warn the user before navigating away.

After sign-in, the app can return the user to the original route if they still have permission.

##### Key Points to Mention

- Stop retries.
- Clear sensitive cache.
- Show session-expired message.
- Preserve safe return URL.
- Avoid losing unsaved work.
- Recheck permission after sign-in.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a global request UX strategy for a React app?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q01 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would define categories for request states: app bootstrap, route loading, component loading, background fetching, mutation pending, local errors, route errors, unauthorized, forbidden, offline, and unexpected failures. Each category would have a standard UI pattern.

For example, route loads get skeletons or route pending UI, background fetching gets subtle indicators, mutations get button-level pending state, session expiration triggers auth handling, and route failures go to route error boundaries. I would also define logging, retry, accessibility, and cache-clearing rules.

##### Key Points to Mention

- Classify states first.
- Match UX to scope and severity.
- Keep stale data visible during background refresh.
- Separate auth from authorization.
- Define retry and cache-clearing rules.
- Include accessibility and observability.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q01 -->

#### How should global error handling interact with API clients or interceptors?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q02 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

The API client should normalize errors and trigger global events only for cross-cutting concerns such as session expiration or network-wide failure. It should not swallow errors or show a global toast for every failure. Feature code should still receive the error so it can show local validation or action-specific messages.

This keeps the API layer consistent without hiding feature-specific UX decisions.

##### Key Points to Mention

- Normalize errors centrally.
- Emit global events for auth or network cases.
- Reject errors so callers can handle them.
- Avoid global toasts for local validation.
- Keep feature-specific UX near the feature.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q02 -->

#### How do you avoid misleading users during background refresh?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q03 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep the previous data visible while showing that it is refreshing or may be stale. If refresh succeeds, update the data. If refresh fails, keep the stale data if it is safe and show a warning or retry option. Do not replace useful content with a spinner unless the data is no longer safe to show.

For sensitive or permission-dependent data, revalidate authorization and clear data if the user no longer has access.

##### Key Points to Mention

- Preserve previous data when safe.
- Show refresh status.
- Show stale-data warning on failure.
- Avoid flicker.
- Revalidate permissions.
- Clear data when access is no longer valid.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q03 -->

#### What observability should support global failure UX?

<!-- question:start:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q04 -->
<!-- question-id:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Global failure UX should be backed by logs and telemetry that include route, request category, status code, normalized error code, correlation ID, retry count, network status, app version, and whether stale data was shown. User-facing errors should include a safe support code when helpful.

The goal is to make production failures diagnosable without exposing secrets or internal stack traces to users.

##### Key Points to Mention

- Log route and request context.
- Include status and error code.
- Include correlation ID.
- Track retry count and network state.
- Avoid logging secrets.
- Show safe support code to users.

<!-- question:end:global-loading-error-unauthorized-and-network-failure-ux-patterns-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
