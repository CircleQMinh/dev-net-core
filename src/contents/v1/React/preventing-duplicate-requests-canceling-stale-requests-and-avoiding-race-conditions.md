---
id: preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions
topic: Forms, validation, and frontend performance in production
subtopic: Preventing duplicate requests, canceling stale requests, and avoiding race conditions
category: React
---

## Overview

Preventing duplicate requests, canceling stale requests, and avoiding race conditions are core skills for building reliable React applications. These problems happen when user input, route changes, effects, retries, form submissions, and background refetches overlap.

Duplicate requests waste bandwidth and can create inconsistent loading states. Stale requests are requests that were useful when started but no longer match the current UI state. Race conditions happen when multiple async operations complete in an unexpected order and the wrong result wins.

This topic matters in search boxes, route loaders, autosave flows, form submissions, dependent dropdowns, authentication refresh, optimistic updates, pagination, and background data refresh. It is especially important when latency is variable.

For interviews, this topic tests whether a candidate understands React effects, cleanup, `AbortController`, request identity, data library deduplication, route data behavior, and safe mutation handling.

## Core Concepts

### Duplicate Requests

Duplicate requests happen when the same request is started more times than needed.

Common causes:

- Fetching in multiple components that need the same data.
- Effects running again because dependencies are unstable.
- Button double-clicks.
- Search input firing on every keystroke.
- Route component fetch plus route loader fetch.
- Strict Mode exposing missing cleanup in development.
- Retrying without a clear policy.

Duplicate requests are not always bugs. Sometimes a route and a widget intentionally fetch different projections. The problem is accidental duplication.

### Stale Requests

A stale request is an in-flight request whose result no longer matches current UI state.

Examples:

- User searches `react`, then changes query to `react hook form`.
- User navigates from `/users/1` to `/users/2`.
- User closes a modal while its request is still loading.
- User changes country before postal-code validation returns.
- User logs out while a background request is running.

If stale responses update state, the UI can show incorrect data.

### Race Conditions

A race condition occurs when correctness depends on timing.

Example:

```txt
Request A starts for user 1.
Request B starts for user 2.
Request B finishes first and shows user 2.
Request A finishes later and overwrites the UI with user 1.
```

The user now sees stale data because the older request completed last.

The fix is to tie each response to the state that created it, cancel old requests, or let a data/router library manage request identity.

### `AbortController`

`AbortController` lets code cancel fetch requests and other abortable async work.

```tsx
useEffect(() => {
  const controller = new AbortController();

  async function loadUser() {
    const response = await fetch(`/api/users/${userId}`, {
      signal: controller.signal,
    });
    const user = await response.json();
    setUser(user);
  }

  loadUser().catch((error) => {
    if (error.name !== "AbortError") {
      setError(error);
    }
  });

  return () => controller.abort();
}, [userId]);
```

When `userId` changes or the component unmounts, cleanup aborts the old request.

### Ignore Flag Pattern

Not all async work is abortable. In those cases, use a stale-response guard.

```tsx
useEffect(() => {
  let ignore = false;

  async function loadUser() {
    const user = await fetchUser(userId);

    if (!ignore) {
      setUser(user);
    }
  }

  loadUser();

  return () => {
    ignore = true;
  };
}, [userId]);
```

This does not stop the network work, but it prevents stale completion from updating state.

### Request Identity

Every async result should match the input that created it.

For search:

```tsx
const requestQuery = query;
const results = await search(requestQuery);

if (requestQuery === latestQueryRef.current) {
  setResults(results);
}
```

For route params:

```tsx
const requestUserId = userId;
const user = await fetchUser(requestUserId);

if (requestUserId === currentUserIdRef.current) {
  setUser(user);
}
```

Request identity can be a query string, route param, page number, filter object, token version, or mutation id.

### Stable Effect Dependencies

Effects can duplicate requests when dependencies are unstable.

Bad:

```tsx
useEffect(() => {
  fetchUsers({ page, filters });
}, [{ page, filters }]);
```

The object literal is new on every render, so the effect runs again.

Better:

```tsx
const queryArgs = useMemo(() => ({ page, filters }), [page, filters]);

useEffect(() => {
  fetchUsers(queryArgs);
}, [queryArgs]);
```

Even better, if using a data library, make the query key explicit and stable:

```tsx
useQuery({
  queryKey: ["users", page, filters],
  queryFn: ({ signal }) => fetchUsers({ page, filters, signal }),
});
```

### Data Library Deduplication

Libraries such as TanStack Query and RTK Query reduce duplicate requests by caching data by query key or endpoint argument.

Example:

```tsx
function useUser(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: ({ signal }) => fetchUser(userId, signal),
  });
}
```

If multiple components ask for the same user with the same query key, the library can share cached data and in-flight requests.

This only works when query keys are stable and accurately represent the data.

### Query Cancellation

Modern data libraries often pass an `AbortSignal` into the query function.

```tsx
useQuery({
  queryKey: ["search", query],
  queryFn: ({ signal }) => searchProducts(query, signal),
});
```

Transport function:

```ts
async function searchProducts(query: string, signal?: AbortSignal) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal,
  });

  return response.json() as Promise<Product[]>;
}
```

If the query becomes unused or outdated, the library can cancel or ignore it depending on configuration and transport support.

### React Router Race Handling

Route data routers help manage navigation races. When a new navigation starts, old loader results should not overwrite newer navigation results. Fetcher behavior also needs to account for concurrent submissions and revalidation.

Still, route code must cooperate:

- Use route loaders for route data instead of nested effects when possible.
- Respect `request.signal` inside loaders.
- Keep URL search params as the source of truth for route filters.
- Avoid duplicating loader data fetches in child components.

Example loader:

```ts
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  const results = await searchProducts(query, request.signal);

  return { query, results };
}
```

The `request.signal` connects route navigation cancellation to the underlying fetch.

### Preventing Duplicate Submissions

Duplicate mutations can be more dangerous than duplicate reads.

Common protections:

- Disable submit button while pending.
- Use `isSubmitting`, mutation pending state, or navigation state.
- Use idempotency keys for create/payment operations.
- Debounce or throttle non-critical actions.
- Server enforces idempotency and uniqueness.
- Ignore repeated clicks for the same pending operation.

Example:

```tsx
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "Saving..." : "Save"}
</button>
```

Client disabling improves UX, but the server should still defend against duplicate mutation requests.

### Autosave and Ordering

Autosave can create write races.

Risk:

- Save older value.
- Save newer value.
- Older request finishes last.
- Server stores old value.

Mitigations:

- Queue saves and run one at a time.
- Use version numbers or ETags.
- Use optimistic concurrency on the server.
- Abort stale saves if safe.
- Save patches with ordering metadata.
- Reconcile conflicts explicitly.

Debounce reduces request count, but it does not guarantee ordering correctness.

### Search and Filtering

Search needs both rate limiting and race handling.

Good pattern:

- Keep input immediate.
- Debounce the query used for requests.
- Cancel old requests with `AbortController`.
- Include query in the request identity.
- Ignore stale responses.
- Show loading state tied to the current query.

Avoid:

- Request on every keystroke without debounce.
- Letting old results overwrite new results.
- Showing aborted requests as errors.
- Clearing useful results during every background search unless product requires it.

### Dependent Requests

Dependent dropdowns are race-prone.

Example:

- User selects country.
- App loads states.
- User quickly selects a different country.
- First states request finishes late.

Use request identity:

```tsx
useEffect(() => {
  const controller = new AbortController();

  loadStates(countryId, controller.signal).then((states) => {
    setStates(states);
  });

  return () => controller.abort();
}, [countryId]);
```

Also clear or reset dependent values when parent values change.

### Authentication Refresh Races

Token refresh can cause duplicate and stale requests.

Common issues:

- Multiple requests fail with `401` and all start refresh.
- Old refresh response overwrites newer token.
- Original request retries with stale token.
- Logout happens while refresh is in flight.

Mitigation:

- Use a refresh queue or shared refresh promise.
- Retry original requests once.
- Clear queues on logout.
- Track active session version.
- Do not refresh for login or refresh endpoints.

Auth races deserve extra care because they affect security and user trust.

### Common Mistakes

Common mistakes include:

- Fetching the same data in parent and child components.
- Ignoring effect cleanup.
- Not passing `AbortSignal` to `fetch` or Axios.
- Treating aborted requests as user-facing errors.
- Using unstable objects in effect dependencies.
- Using query keys that do not include all relevant inputs.
- Retrying mutations blindly.
- Disabling buttons on the client but not enforcing idempotency on the server.
- Letting old search results overwrite newer ones.
- Not clearing sensitive requests after logout.

### Best Practices

Best practices include:

- Prefer route loaders or data libraries for shared server state.
- Use stable query keys.
- Pass `AbortSignal` through the API client.
- Clean up effects.
- Guard non-abortable async work with stale-response checks.
- Debounce high-frequency reads like search.
- Disable duplicate submissions while pending.
- Use idempotency keys for important mutations.
- Keep URL params as source of truth for route filters.
- Test fast input, slow network, navigation during fetch, duplicate clicks, and logout during requests.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a stale request?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q01 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A stale request is a request that was valid when it started but no longer matches the current UI state. For example, a search request for an older query becomes stale after the user types a new query.

If the stale response updates state, the UI can show old or incorrect data.

##### Key Points to Mention

- Started for old state.
- No longer matches current UI.
- Common with search and route params.
- Can overwrite newer data.
- Should be canceled or ignored.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q01 -->

#### What does `AbortController` do?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q02 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`AbortController` creates an abort signal that can be passed to `fetch` or other abortable APIs. Calling `abort()` cancels the request, which is useful when a component unmounts, a route changes, or a newer request replaces an older one.

The app should treat aborts differently from real failures.

##### Key Points to Mention

- Creates an `AbortSignal`.
- Pass signal to `fetch`.
- Call `abort()` in cleanup.
- Useful for route changes and search.
- Ignore or specially handle abort errors.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q02 -->

#### What is a race condition in data fetching?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q03 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A race condition happens when multiple async operations run at the same time and the final UI depends on which one finishes last. If an older request finishes after a newer one and overwrites the newer result, the UI becomes incorrect.

The fix is to cancel old requests, ignore stale responses, or use a data/router library that tracks request identity.

##### Key Points to Mention

- Timing-dependent bug.
- Older request can finish later.
- Can overwrite newer state.
- Common with search and route changes.
- Use cancellation or stale guards.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q03 -->

#### How do you prevent duplicate form submissions?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q04 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Disable the submit button while the form is submitting, show pending state, and ignore repeated clicks for the same pending action. For important operations like payments or order creation, the server should also use idempotency keys or uniqueness checks.

Client-side disabling improves UX, but server-side protection is required for correctness.

##### Key Points to Mention

- Use pending state.
- Disable submit while pending.
- Show clear saving/submitting state.
- Use server idempotency for important mutations.
- Do not rely only on the client.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should a React effect fetch data safely when a prop changes?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q01 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The effect should start a request for the current prop, pass an `AbortSignal` if the request supports cancellation, and abort it in cleanup. If the async work cannot be canceled, use an ignore flag or request id so stale completions do not update state.

The dependency list should include the prop and avoid unstable objects or functions that cause accidental refetching.

##### Key Points to Mention

- Create `AbortController` inside effect.
- Pass `signal` to request.
- Abort in cleanup.
- Use ignore flag for non-abortable work.
- Keep dependencies stable.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q01 -->

#### How do data libraries prevent duplicate requests?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q02 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Data libraries use query keys or endpoint arguments to identify server state. If multiple components request the same data with the same key, the library can share cached data and often share in-flight requests. They can also refetch, invalidate, retry, and cancel requests consistently.

This only works if query keys include all inputs that affect the response.

##### Key Points to Mention

- Query keys identify data.
- Shared cache avoids repeated fetches.
- In-flight requests can be reused.
- Keys must include all relevant inputs.
- Libraries also help with stale data and retries.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q02 -->

#### How should search requests avoid stale results?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q03 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Search should usually debounce the query, cancel the old request when a new query starts, and tie each response to the query that created it. If cancellation is not available, ignore responses that do not match the latest query.

The UI should not show an aborted request as a normal error.

##### Key Points to Mention

- Debounce high-frequency input.
- Cancel old requests.
- Track query identity.
- Ignore stale responses.
- Handle abort separately from failure.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q03 -->

#### Why can unstable dependencies cause duplicate requests?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q04 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

React compares dependencies by identity. If an effect depends on a new object or function created on every render, the effect runs again even when the logical values did not change. If that effect fetches data, it can create duplicate requests.

Use primitive dependencies, memoize objects where appropriate, or move fetch behavior into route loaders or data libraries with stable query keys.

##### Key Points to Mention

- Dependencies use identity comparison.
- New objects/functions trigger effects.
- Effects may refetch unnecessarily.
- Use stable dependencies.
- Prefer explicit query keys for server state.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design request handling for a filterable route?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q01 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would put the filter state in the URL so navigation, reload, and sharing are consistent. A route loader or query hook would use the search params as request identity. If using a loader, it should pass `request.signal` to the fetch. If using a query library, the query key should include all filters and the query function should accept the provided signal.

The UI should debounce typing before committing expensive URL changes if needed and preserve previous data during background refresh when appropriate.

##### Key Points to Mention

- URL search params as source of truth.
- Loader or query key includes filters.
- Pass cancellation signal.
- Debounce high-frequency input.
- Keep stale data visible when safe.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q01 -->

#### How do you make autosave safe from race conditions?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q02 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Debounce autosave to reduce request volume, but also handle ordering. Use a save queue, version numbers, ETags, or optimistic concurrency so an older save cannot overwrite a newer one. The UI should show saving, saved, failed, and conflict states.

If offline work is supported, queue changes locally and reconcile with the server when connectivity returns.

##### Key Points to Mention

- Debounce is not enough.
- Prevent out-of-order writes.
- Use versions, ETags, or idempotency.
- Queue or serialize saves.
- Show clear save and error state.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q02 -->

#### How should token refresh avoid duplicate requests and races?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q03 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

When several requests fail with `401`, only one refresh request should run. Other requests should wait on a shared refresh promise or mutex, then retry with the new token. The refresh endpoint itself should be excluded from refresh logic, original requests should retry once, and logout should clear pending queues.

This prevents refresh storms, stale token overwrites, and infinite loops.

##### Key Points to Mention

- Shared refresh promise or mutex.
- Retry original request once.
- Skip refresh endpoint.
- Clear pending work on logout.
- Avoid stale token overwrite.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q03 -->

#### How would you test race-condition handling?

<!-- question:start:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q04 -->
<!-- question-id:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would test slow and out-of-order responses. For search, make the first request resolve after the second and assert that the UI shows the second query's results. For route changes, navigate away before the request resolves and assert the stale response does not update the new route. For submissions, double-click and verify only one mutation or one server-side result is accepted.

I would also test abort handling so canceled requests do not show user-facing errors.

##### Key Points to Mention

- Simulate out-of-order responses.
- Test stale result ignored.
- Test navigation during fetch.
- Test duplicate submissions.
- Test abort handling.
- Test auth refresh concurrency.

<!-- question:end:preventing-duplicate-requests-canceling-stale-requests-and-avoiding-race-conditions-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
