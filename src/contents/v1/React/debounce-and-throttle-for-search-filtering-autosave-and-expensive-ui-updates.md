---
id: debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates
topic: Forms, validation, and frontend performance in production
subtopic: Debounce and throttle for search, filtering, autosave, and expensive UI updates
category: React
---

## Overview

Debounce and throttle are rate-limiting techniques used to control how often expensive work runs in response to frequent events. In React applications, they are commonly used for search inputs, filtering, autosave, resize handlers, scroll handlers, drag interactions, validation checks, and expensive derived UI updates.

Debounce waits until activity pauses before running work. It is ideal when only the final value matters, such as search after the user stops typing or autosave after editing settles. Throttle runs work at most once per time window. It is ideal when updates should happen periodically during continuous activity, such as scroll position tracking or resize previews.

This topic matters because React apps often handle high-frequency input. Without rate limiting, a component can trigger too many API calls, expensive filters, renders, validations, or storage writes. With the wrong rate-limiting strategy, the UI can feel laggy, stale, or unreliable.

For interviews, this topic is important because it tests practical frontend performance judgment. Strong candidates can explain debounce versus throttle, cancellation, cleanup, stale closures, request aborting, autosave failure states, and the difference between delaying side effects and deferring rendering.

## Core Concepts

### High-Frequency Events

Some UI events fire often:

- Typing in a search box.
- Filtering a table.
- Resizing the window.
- Scrolling.
- Dragging.
- Moving a pointer.
- Editing a large form.
- Updating a slider.

If every event triggers expensive work, the app can become slow.

Expensive work includes:

- Network requests.
- Filtering thousands of rows.
- Recalculating charts.
- Writing drafts to storage.
- Running validation against an API.
- Updating large React subtrees.
- Sending analytics events.

Debounce and throttle are tools for controlling that work.

### Debounce

Debounce delays a function until no new calls happen for a specified wait time.

Use debounce when the final value matters more than intermediate values.

Common uses:

- Search after typing pauses.
- Autosave after editing pauses.
- Validate username availability after typing pauses.
- Recalculate expensive filters after the user stops changing inputs.
- Save layout after resize stops.

Simple debounce helper:

```ts
function debounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  waitMs: number,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: TArgs) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(...args);
    }, waitMs);
  };
}
```

Each call resets the timer. The callback runs only after the input settles.

### Throttle

Throttle limits a function so it runs at most once per time window.

Use throttle when the user needs periodic updates during continuous activity.

Common uses:

- Scroll position tracking.
- Resize updates during resizing.
- Drag preview updates.
- Pointer move calculations.
- Rate-limited analytics.
- Progress-like UI that should update steadily but not constantly.

Simple throttle helper:

```ts
function throttle<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  waitMs: number,
) {
  let lastRun = 0;

  return (...args: TArgs) => {
    const now = Date.now();

    if (now - lastRun >= waitMs) {
      lastRun = now;
      callback(...args);
    }
  };
}
```

This basic version runs on the leading edge only. Production throttles often support trailing calls too so the final value is not lost.

### Debounce vs Throttle

The key difference:

- Debounce waits for silence.
- Throttle allows periodic execution.

Use debounce for:

- Search request after typing stops.
- Autosave draft after user pauses.
- Username availability check.
- Expensive table filtering where intermediate values do not matter.

Use throttle for:

- Scroll position updates.
- Resize preview during resizing.
- Drag or pointer movement.
- Rate-limited progress-like updates.

Interview shortcut: debounce answers "run after the user pauses"; throttle answers "run at a controlled frequency while the user continues."

### Leading and Trailing Behavior

Rate-limited functions can run on the leading edge, trailing edge, or both.

Leading edge:

- Run immediately on the first call.
- Useful for instant feedback.
- Can ignore the final value unless trailing is also enabled.

Trailing edge:

- Run after the wait period with the latest arguments.
- Useful for search and autosave.
- Feels less immediate but preserves final value.

Both:

- Run immediately, then also run once more with the latest value if calls continued.
- Useful when the UI needs quick response and final correctness.

For search, trailing debounce is common. For scroll, leading plus trailing throttle is often useful.

### Debounced Search

Search is the classic debounce example.

```tsx
function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const nextResults = await searchProducts(query);
      setResults(nextResults);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  return (
    <>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products"
      />
      <SearchResults results={results} />
    </>
  );
}
```

This avoids a request on every keystroke. The cleanup cancels the previous scheduled search when `query` changes again.

### Search Race Conditions

Debounce reduces request volume, but it does not eliminate race conditions.

Example:

- User searches `react`.
- Request starts.
- User changes query to `react hook form`.
- Second request starts.
- First request finishes last and overwrites results.

Use `AbortController` or stale-response guards.

```tsx
useEffect(() => {
  if (!query.trim()) {
    setResults([]);
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(async () => {
    try {
      const nextResults = await searchProducts(query, controller.signal);
      setResults(nextResults);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setError("Search failed");
      }
    }
  }, 300);

  return () => {
    window.clearTimeout(timeoutId);
    controller.abort();
  };
}, [query]);
```

Debounce schedules work. Abort or stale guards control in-flight work.

### Debounced Filtering

Client-side filtering can be expensive when the list is large.

```tsx
function ProductFilter({ products }: { products: Product[] }) {
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilter(input);
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [input]);

  const visibleProducts = useMemo(
    () => filterProducts(products, filter),
    [products, filter],
  );

  return (
    <>
      <input value={input} onChange={(event) => setInput(event.target.value)} />
      <ProductTable products={visibleProducts} />
    </>
  );
}
```

This keeps typing responsive because the input state updates immediately, while expensive filtering waits until the user pauses.

For very large lists, also consider virtualization, indexing, server-side search, or React rendering tools such as `useDeferredValue`.

### Debounced Autosave

Autosave should usually be debounced. Saving every keystroke can overload the server and create race conditions.

```tsx
function DraftEditor({ draftId }: { draftId: string }) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!body.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setStatus("saving");

      try {
        await saveDraft(draftId, body);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [draftId, body]);

  return (
    <>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} />
      <p>{status === "saving" ? "Saving..." : status}</p>
    </>
  );
}
```

Production autosave also needs conflict handling, retry behavior, offline handling, and clear status.

### Autosave Race Conditions

Autosave has ordering problems.

Example:

- Save A starts with older content.
- Save B starts with newer content.
- Save B completes first.
- Save A completes last and overwrites newer content.

Mitigation strategies:

- Send document version or ETag.
- Use server-side optimistic concurrency.
- Abort old saves when possible.
- Queue saves and run one at a time.
- Ignore stale completions on the client.
- Save patches instead of full documents when appropriate.

Client debounce is not enough to guarantee data correctness.

### Throttled Scroll or Resize

Throttle is better than debounce when the UI needs updates during continuous movement.

```tsx
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    let lastRun = 0;

    function handleResize() {
      const now = Date.now();

      if (now - lastRun >= 100) {
        lastRun = now;
        setWidth(window.innerWidth);
      }
    }

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}
```

This avoids rerendering on every resize event.

### `requestAnimationFrame`

For visual updates tied to painting, `requestAnimationFrame` can be better than a fixed timer. It asks the browser to run a callback before the next repaint.

Example:

```tsx
function useScrollY() {
  const [scrollY, setScrollY] = useState(window.scrollY);

  useEffect(() => {
    let frameId: number | null = null;

    function handleScroll() {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        frameId = null;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return scrollY;
}
```

This is a frame-based throttle. It is useful for scroll-linked visual state, but it is not a replacement for debouncing network requests.

### Stable Debounced Functions in React

Debounced functions need stable identity. If a debounced function is recreated on every render, it loses its timer.

Custom hook example:

```tsx
function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  waitMs: number,
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: TArgs) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, waitMs);
  }, [waitMs]);
}
```

This keeps the debounced wrapper stable while still calling the latest callback.

### Cleanup

Timers and scheduled work must be cleaned up.

Cleanup prevents:

- Running work after unmount.
- Updating state on an irrelevant component.
- Autosaving stale values.
- Firing duplicate requests.
- Leaking event listeners.
- Leaving trailing debounced work after navigation.

Use cleanup in `useEffect`:

```tsx
useEffect(() => {
  const timeoutId = setTimeout(runSearch, 300);
  return () => clearTimeout(timeoutId);
}, [runSearch]);
```

If using a library debounce, call `.cancel()` during cleanup when appropriate.

### Stale Closures

Debounced and throttled callbacks can capture old values.

Problem:

```tsx
const debouncedSave = useMemo(
  () => debounce(() => saveDraft(body), 1000),
  [],
);
```

This captures the initial `body` value.

Better:

```tsx
const debouncedSave = useDebouncedCallback((nextBody: string) => {
  saveDraft(nextBody);
}, 1000);

function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
  const nextBody = event.target.value;
  setBody(nextBody);
  debouncedSave(nextBody);
}
```

Pass the latest value as an argument or keep the latest callback in a ref.

### Debounce vs `useDeferredValue`

Debounce delays work. `useDeferredValue` defers rendering work.

Use debounce when:

- You want fewer network requests.
- You want fewer autosaves.
- You want fewer expensive calculations.
- You want work to happen only after input settles.

Use `useDeferredValue` when:

- The input should update immediately.
- A slow child tree can lag behind.
- You want React to prioritize typing over rendering results.

Important: `useDeferredValue` does not reduce network requests by itself. It changes rendering priority, not the number of side effects you start.

### Debounce vs `useTransition`

`useTransition` marks state updates as non-blocking. It is useful when a state update causes expensive rendering and should not block urgent input.

It is not a timer and it is not a rate limiter.

Use transition for:

- Switching tabs with expensive content.
- Updating a slow result panel while input remains responsive.
- Showing pending visual state for non-urgent UI updates.

Use debounce or throttle for:

- Limiting API calls.
- Limiting storage writes.
- Limiting event handler frequency.

These tools can be combined, but they solve different problems.

### Search UX

Good debounced search UX includes:

- Input updates immediately.
- Search runs after a short pause.
- The UI shows loading state after the request starts.
- Old request is canceled or ignored.
- Empty query clears results or shows defaults.
- Errors are recoverable.
- Results show which query they represent if stale results stay visible.

Avoid:

- Waiting to update the input value itself.
- Sending a request for every keystroke.
- Letting old results overwrite new results.
- Showing a spinner forever if a request is aborted.

### Filtering UX

For client-side filtering:

- Keep the input immediate.
- Debounce the expensive filter value.
- Memoize derived filtered results.
- Consider `useDeferredValue` for slow result rendering.
- Virtualize large lists.
- Move very large filtering to the server or a worker.

Filtering 50 rows does not need heroic optimization. Filtering 50,000 rows while rendering a table probably does.

### Autosave UX

Autosave needs trust-building UI.

Good autosave UX:

- Shows unsaved changes.
- Shows saving state.
- Shows saved state and time.
- Shows failure state with retry.
- Preserves edits offline or during failures.
- Avoids overwriting newer server data.
- Saves on navigation or warns before leaving when needed.

Debounce controls frequency, but product correctness also needs versioning and error handling.

### Common Mistakes

Common mistakes include:

- Debouncing the input value itself so typing feels delayed.
- Recreating a debounced function every render.
- Forgetting cleanup on unmount.
- Not canceling or ignoring stale search requests.
- Using debounce for scroll when throttle or `requestAnimationFrame` is better.
- Using throttle for search and missing the final intended value.
- Autosaving without handling out-of-order responses.
- Hiding autosave failures.
- Using `useDeferredValue` expecting it to reduce network calls.
- Rate-limiting cheap work while ignoring the actually expensive render.

### Best Practices

Best practices include:

- Debounce search, async validation, autosave, and expensive final-value work.
- Throttle scroll, resize, drag, pointer move, and periodic visual updates.
- Keep controlled inputs immediate.
- Cancel timers in cleanup.
- Abort or ignore stale requests.
- Use stable debounced or throttled callbacks.
- Pass latest values as arguments to avoid stale closures.
- Show loading, saving, saved, and error states.
- Use `requestAnimationFrame` for frame-aligned visual updates.
- Use `useDeferredValue` or `useTransition` for rendering priority, not request limiting.
- Measure before optimizing simple interactions.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is debounce?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q01 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Debounce delays running a function until calls stop for a specified amount of time. If the function is called again before the wait time finishes, the timer resets.

It is useful when only the final value matters, such as search after typing stops, autosave after editing pauses, or validation after a user stops changing a field.

##### Key Points to Mention

- Waits for activity to pause.
- Resets timer on each call.
- Good for search and autosave.
- Reduces unnecessary work.
- Usually uses trailing behavior for final value.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q01 -->

#### What is throttle?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q02 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Throttle limits a function so it runs at most once during a specified time window. Unlike debounce, it can keep running periodically while events continue.

It is useful for scroll, resize, drag, and pointer move handlers where the UI needs regular updates but not one update for every event.

##### Key Points to Mention

- Runs at most once per interval.
- Good for continuous events.
- Useful for scroll and resize.
- Can support leading and trailing calls.
- Keeps updates periodic.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q02 -->

#### When would you debounce a search input?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q03 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

I would debounce a search input when each query triggers expensive work, such as an API call or filtering a large list. The input value should still update immediately, but the search request or expensive filtering should run only after the user pauses typing.

I would also cancel or ignore stale requests so older results do not overwrite newer results.

##### Key Points to Mention

- Keep typing immediate.
- Delay the search work.
- Reduce API calls.
- Use a reasonable delay such as 200-500 ms.
- Handle stale or aborted requests.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q03 -->

#### When would you throttle instead of debounce?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q04 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

I would throttle when the user needs updates during continuous activity, but not for every event. Examples include scroll position, resize previews, drag movement, and pointer tracking.

Debounce would wait until activity stops, which can feel wrong for interactions that need ongoing feedback.

##### Key Points to Mention

- Throttle continuous events.
- Debounce final-value work.
- Scroll and resize usually fit throttle.
- Search and autosave usually fit debounce.
- Choose based on the UX needed.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you avoid stale search results with debounced requests?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q01 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Debounce reduces how often requests start, but old requests can still finish after newer ones. To avoid stale results, cancel old requests with `AbortController`, track the latest query and ignore mismatched responses, or use a data library that handles request identity.

The UI should also handle aborted requests differently from real failures.

##### Key Points to Mention

- Debounce does not solve in-flight races.
- Use `AbortController`.
- Or ignore responses for stale query values.
- Keep request identity tied to the query.
- Do not show aborted requests as user-facing errors.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q01 -->

#### Why should the input value usually not be debounced?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q02 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The input value should update immediately so typing feels responsive and predictable. Debouncing the actual controlled value makes the input lag behind the user's keystrokes.

Usually, the app should store the immediate input value and debounce the expensive side effect or derived value, such as the search request or filtered list.

##### Key Points to Mention

- Controlled input should feel immediate.
- Debounce expensive work, not keystroke display.
- Keep separate immediate and debounced values if needed.
- Avoid typing lag.
- Preserve accessibility and browser input behavior.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q02 -->

#### How should autosave be debounced safely?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q03 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Autosave should wait until the user pauses editing before saving. The UI should show saving, saved, and error states. The implementation should avoid out-of-order writes by using version numbers, ETags, a save queue, request cancellation, or stale completion guards.

Debounce controls frequency, but server-side concurrency control is needed to prevent older saves from overwriting newer content.

##### Key Points to Mention

- Debounce after editing pauses.
- Show save status.
- Handle failures and retry.
- Prevent out-of-order overwrites.
- Use server versioning or optimistic concurrency.
- Preserve unsaved edits.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q03 -->

#### What cleanup is required for debounced or throttled work?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q04 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Scheduled timers should be cleared when dependencies change or the component unmounts. Event listeners should be removed. Library debounce or throttle functions should have pending work canceled when appropriate. In-flight requests should be aborted or ignored if they are no longer relevant.

Without cleanup, stale callbacks can update state after unmount, fire old requests, or save outdated values.

##### Key Points to Mention

- Clear timeouts.
- Remove event listeners.
- Cancel debounced trailing work.
- Abort stale requests.
- Avoid updating unmounted or irrelevant components.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a production search box with debouncing?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q01 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would keep the input value immediate, derive a debounced query after a short delay, and start the request from the debounced query. I would cancel or ignore stale requests, show loading state after the request starts, handle empty queries deliberately, preserve useful previous results when appropriate, and show recoverable errors.

If results rendering is expensive, I would also consider virtualization, server-side filtering, `useDeferredValue`, or splitting expensive rendering from urgent input updates.

##### Key Points to Mention

- Immediate input state.
- Debounced request query.
- Abort or ignore stale requests.
- Empty-query behavior.
- Loading and error states.
- Virtualize or defer expensive results rendering.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q01 -->

#### How do debounce, throttle, `useDeferredValue`, and `useTransition` differ?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q02 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Debounce and throttle limit how often work runs. Debounce waits for activity to pause; throttle runs periodically during activity. `useDeferredValue` and `useTransition` do not limit side effects by themselves. They help React prioritize rendering so urgent updates, like typing, remain responsive while slower UI catches up.

For fewer API calls, use debounce or throttle. For expensive rendering, consider `useDeferredValue`, `useTransition`, memoization, virtualization, or moving work off the main thread.

##### Key Points to Mention

- Debounce delays until pause.
- Throttle limits frequency.
- `useDeferredValue` defers rendering of a value.
- `useTransition` marks state updates as non-blocking.
- React deferral does not reduce network requests by itself.
- Combine tools based on bottleneck.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q02 -->

#### How would you avoid stale closures in debounced callbacks?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q03 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

I would avoid creating a debounced callback that captures an old state value. Instead, I would pass the latest value as an argument to the debounced function or store the latest callback/value in a ref. I would also keep the debounced wrapper stable with `useMemo`, `useCallback`, or a custom hook.

This prevents delayed work from running with stale form values or old props.

##### Key Points to Mention

- Delayed callbacks can capture old state.
- Pass latest values as arguments.
- Or store latest callback in a ref.
- Keep wrapper identity stable.
- Cancel pending work on cleanup.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q03 -->

#### How would you handle autosave conflicts and failures?

<!-- question:start:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q04 -->
<!-- question-id:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would debounce autosave to reduce request volume, but I would not rely on debounce for correctness. The server should use version numbers, ETags, timestamps, or another concurrency mechanism to reject stale writes. The client should show saving, saved, and failed states, preserve local edits, and offer retry or conflict resolution.

If the app supports offline work, I would queue saves and reconcile them when connectivity returns.

##### Key Points to Mention

- Debounce reduces frequency.
- Versioning prevents stale overwrites.
- Queue or serialize saves when needed.
- Preserve user edits on failure.
- Show clear save status.
- Support retry or conflict resolution.

<!-- question:end:debounce-and-throttle-for-search-filtering-autosave-and-expensive-ui-updates-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
