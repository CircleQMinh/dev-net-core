---
id: use-sync-external-store-and-subscribing-to-external-state
topic: State management, performance, and rendering optimization
subtopic: useSyncExternalStore and subscribing to external state
category: React
---

## Overview

`useSyncExternalStore` is a React hook for reading and subscribing to state that lives outside React. It gives React a consistent way to subscribe to an external source, read a snapshot during render, and update the component when that source changes.

External state can come from many places: a custom store, Redux-like store, browser API, WebSocket connection, media query, online/offline status, local storage event, or a third-party state library. The key requirement is that React needs a safe subscription contract.

This topic matters because subscribing to external state with a plain `useEffect` and `useState` can create subtle bugs in concurrent rendering, server rendering, hydration, and stale snapshot scenarios. `useSyncExternalStore` is the official low-level hook for building external store integrations.

For interviews, this topic tests whether a candidate understands the difference between React state and external state, how subscriptions work, why snapshots must be stable, and when application developers should use this hook directly versus relying on a state library.

## Core Concepts

### What Counts as External State

External state is state not owned by React's component state system.

Examples:

- Redux store.
- Zustand-like custom store.
- Browser online/offline status.
- `window.matchMedia` result.
- WebSocket-backed presence store.
- Shared worker state.
- Local storage changes across tabs.
- A custom event emitter.
- A map library or editor model.

React can render from external state, but it needs to know when the state changes and how to read a consistent snapshot.

### The `useSyncExternalStore` API

The hook shape is:

```tsx
const snapshot = useSyncExternalStore(
  subscribe,
  getSnapshot,
  getServerSnapshot,
);
```

Arguments:

- `subscribe`: registers a callback and returns an unsubscribe function.
- `getSnapshot`: returns the current client-side value.
- `getServerSnapshot`: optional function for server rendering and hydration.

Basic example:

```tsx
function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeToOnlineStatus,
    () => navigator.onLine,
    () => true,
  );
}

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
```

The component can now render based on a browser value that lives outside React.

### `subscribe`

`subscribe` connects React to the external source.

```ts
function subscribe(callback: () => void) {
  store.addListener(callback);
  return () => store.removeListener(callback);
}
```

Requirements:

- It must call the callback when the external store changes.
- It must return a cleanup function.
- It should be stable when possible.
- It should not update React state directly.
- It should not perform rendering logic.

If `subscribe` is declared inside a component and changes on every render, React may resubscribe more often than needed.

### `getSnapshot`

`getSnapshot` returns the current value from the external source.

```ts
function getSnapshot() {
  return store.getState();
}
```

Important rule: repeated calls to `getSnapshot` must return the same value if the store has not changed.

Bad:

```ts
function getSnapshot() {
  return { ...store.getState() };
}
```

This returns a new object every time, so React may think the snapshot changed even when the store did not.

Better:

```ts
function getSnapshot() {
  return store.getState();
}
```

The store should maintain stable immutable snapshots or cache derived snapshots.

### Simple Custom Store

Example external store:

```ts
type CounterStore = {
  getSnapshot: () => number;
  subscribe: (callback: () => void) => () => void;
  increment: () => void;
};

function createCounterStore(): CounterStore {
  let count = 0;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => count,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    increment: () => {
      count += 1;
      listeners.forEach((listener) => listener());
    },
  };
}

export const counterStore = createCounterStore();
```

Hook:

```tsx
function useCounterCount() {
  return useSyncExternalStore(
    counterStore.subscribe,
    counterStore.getSnapshot,
    counterStore.getSnapshot,
  );
}
```

Component:

```tsx
function Counter() {
  const count = useCounterCount();

  return (
    <button onClick={counterStore.increment}>
      Count: {count}
    </button>
  );
}
```

The store lives outside React. React subscribes and rerenders when the snapshot changes.

### Why Not Just `useEffect`?

A basic subscription can be written with `useEffect`:

```tsx
useEffect(() => {
  return store.subscribe(() => {
    setState(store.getState());
  });
}, []);
```

This works for simple cases, but it has downsides:

- The first render may use stale or duplicated initial state.
- It is easier to mismatch render-time values and subscription updates.
- It is not the official contract for external stores.
- It is harder to support server rendering and hydration safely.
- It can be less robust with concurrent rendering.

`useSyncExternalStore` tells React exactly how to read the current snapshot during render and how to subscribe to future changes.

### Snapshot Stability

Snapshot stability is the most common pitfall.

If `getSnapshot` returns a new object each time, React sees constant change.

Bad:

```ts
function getSnapshot() {
  return {
    todos: store.todos,
    filter: store.filter,
  };
}
```

Better:

```ts
let snapshot = {
  todos: store.todos,
  filter: store.filter,
};

function updateStore(nextTodos: Todo[], nextFilter: string) {
  store.todos = nextTodos;
  store.filter = nextFilter;
  snapshot = {
    todos: nextTodos,
    filter: nextFilter,
  };
  emitChange();
}

function getSnapshot() {
  return snapshot;
}
```

For mutable stores, cache immutable snapshots so unchanged state returns the same reference.

### Selectors

Many components only need part of a store.

Conceptual selector:

```tsx
function useUserName() {
  const state = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getSnapshot,
  );

  return state.user.name;
}
```

This works, but the component may rerender whenever the full snapshot changes, even if `user.name` is the same. Mature state libraries usually add selector support so components subscribe to slices efficiently.

Selector concerns:

- Selected value equality.
- Stable selected references.
- Avoiding broad rerenders.
- Memoized derived data.
- Store update granularity.

This is one reason teams often use a library instead of writing a custom store by hand.

### Server Rendering and `getServerSnapshot`

`getServerSnapshot` is used during server rendering and hydration.

```tsx
const value = useSyncExternalStore(
  subscribe,
  getSnapshot,
  getServerSnapshot,
);
```

It should return the same initial value on the server and during client hydration.

Example:

```ts
function getServerSnapshot() {
  return initialStoreStateFromHtml;
}
```

If the server snapshot and first client snapshot differ, hydration mismatches can happen. Browser-only state such as `navigator.onLine` often uses a conservative server fallback.

### Browser API Example: Media Query

`useSyncExternalStore` can wrap browser APIs.

```tsx
function subscribeToMediaQuery(query: string, callback: () => void) {
  const mediaQuery = window.matchMedia(query);
  mediaQuery.addEventListener("change", callback);

  return () => mediaQuery.removeEventListener("change", callback);
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => subscribeToMediaQuery(query, callback),
    () => window.matchMedia(query).matches,
    () => false,
  );
}
```

This hook exposes external browser state as a React-readable value.

### Local Storage and Cross-Tab State

The browser `storage` event can notify other tabs when `localStorage` changes.

```tsx
function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getThemeSnapshot() {
  return localStorage.getItem("theme") ?? "light";
}

function useStoredTheme() {
  return useSyncExternalStore(
    subscribeToStorage,
    getThemeSnapshot,
    () => "light",
  );
}
```

Note that the `storage` event fires in other documents, not usually in the same tab that made the change. A robust store wrapper should also notify same-tab subscribers when it writes.

### Immutable Updates

External stores should notify subscribers only after a meaningful change and should expose stable snapshots.

Bad mutable pattern:

```ts
state.user.name = "New name";
emitChange();
```

If `getSnapshot` returns the same `state` reference, React may not detect a changed snapshot correctly.

Better:

```ts
state = {
  ...state,
  user: {
    ...state.user,
    name: "New name",
  },
};
emitChange();
```

Immutable updates make snapshot identity meaningful.

### Tearing

Tearing means different parts of the UI observe different versions of external state during the same render. `useSyncExternalStore` exists to help React coordinate external subscriptions with rendering so components read consistent snapshots.

Application developers do not usually need to implement complex tearing logic themselves, but they should understand the contract:

- `getSnapshot` must be pure.
- Snapshots must be stable.
- Subscriptions must notify on changes.
- The store should not mutate state behind React's back without notification.

If the contract is broken, UI consistency breaks.

### When to Use It Directly

Use `useSyncExternalStore` directly when building:

- A custom external store.
- A wrapper around a browser API.
- A library integration.
- A bridge to a non-React state source.
- A low-level hook used across an app.

Do not reach for it for ordinary component state. Use `useState`, `useReducer`, context, or a state library first.

Most application developers use `useSyncExternalStore` indirectly through libraries.

### Common Mistakes

Common mistakes include:

- Returning a new object from `getSnapshot` every call.
- Mutating store state without changing snapshot identity.
- Forgetting to unsubscribe.
- Creating `subscribe` inside render without stability.
- Using `useSyncExternalStore` for local component state.
- Omitting `getServerSnapshot` in SSR scenarios that need it.
- Returning different server and hydration snapshots.
- Building a complex store without selector/equality support.
- Not notifying subscribers after store changes.

### Best Practices

Best practices include:

- Keep `getSnapshot` pure and stable.
- Return the same snapshot reference when state has not changed.
- Notify subscribers after every meaningful store change.
- Return an unsubscribe function from `subscribe`.
- Use immutable snapshots or cache derived snapshots.
- Provide `getServerSnapshot` for server-rendered apps.
- Wrap external stores in custom hooks.
- Prefer established libraries for complex app-wide stores.
- Add selector/equality support if many consumers need different slices.
- Test subscription, unsubscribe, unchanged snapshots, and SSR fallback behavior.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is `useSyncExternalStore` used for?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-beginner-q01 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`useSyncExternalStore` is used to subscribe React components to state that lives outside React. It tells React how to subscribe to changes and how to read the current snapshot during render.

It is commonly used by state libraries and custom hooks that wrap browser APIs or external stores.

##### Key Points to Mention

- Subscribes to external state.
- Reads snapshots during render.
- Used for stores outside React.
- Useful for browser APIs and state libraries.
- Not needed for normal local component state.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-beginner-q01 -->

#### What are the arguments to `useSyncExternalStore`?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-beginner-q02 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The hook receives `subscribe`, `getSnapshot`, and optionally `getServerSnapshot`. `subscribe` registers a callback and returns an unsubscribe function. `getSnapshot` returns the current client-side value. `getServerSnapshot` provides the snapshot for server rendering and hydration.

The hook returns the current snapshot.

##### Key Points to Mention

- `subscribe`.
- `getSnapshot`.
- Optional `getServerSnapshot`.
- Returns current snapshot.
- Subscription callback triggers React update.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-beginner-q02 -->

#### What is a snapshot?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-beginner-q03 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A snapshot is the current value React reads from the external store. It should represent the store state at that moment. If the store has not changed, `getSnapshot` should return the same value or reference as before.

Stable snapshots help React know whether the subscribed component needs to rerender.

##### Key Points to Mention

- Current value from external store.
- Returned by `getSnapshot`.
- Must be stable when state has not changed.
- Should not create a new object every call.
- Drives rerender decisions.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-beginner-q03 -->

#### What should `subscribe` return?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-beginner-q04 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`subscribe` should return an unsubscribe function. React calls this cleanup function when the component no longer needs the subscription or when the subscription changes.

This prevents leaks and avoids updates from stores a component no longer reads.

##### Key Points to Mention

- Registers a change callback.
- Returns cleanup function.
- Cleanup removes listener.
- Prevents memory leaks.
- Should notify callback when store changes.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why should `getSnapshot` not return a new object every time?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-intermediate-q01 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

React compares snapshots to decide whether the subscribed component needs to update. If `getSnapshot` returns a new object on every call, React may think the store changed even when it did not. This can cause unnecessary rerenders or even update loops.

For object snapshots, the store should return a stable immutable snapshot and only create a new one when the underlying state changes.

##### Key Points to Mention

- Snapshot identity matters.
- New object implies change.
- Can cause rerenders or loops.
- Use immutable stable snapshots.
- Cache derived snapshots when needed.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-intermediate-q01 -->

#### How is `useSyncExternalStore` different from subscribing in `useEffect`?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-intermediate-q02 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Subscribing in `useEffect` can work for simple cases, but React does not get a formal render-time snapshot contract. `useSyncExternalStore` lets React read the current external value during render and subscribe in a way designed for concurrent rendering and server rendering.

It is the official low-level hook for external stores.

##### Key Points to Mention

- `useEffect` subscription happens after render.
- `useSyncExternalStore` provides render-time snapshot.
- Safer for external store integrations.
- Supports SSR with `getServerSnapshot`.
- Better contract for concurrent rendering.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-intermediate-q02 -->

#### How would you wrap a browser API with `useSyncExternalStore`?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-intermediate-q03 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would write a `subscribe` function that adds and removes browser event listeners, then write `getSnapshot` to read the current browser value. For online status, subscribe to `online` and `offline` events and read `navigator.onLine`.

For SSR, I would provide a safe default with `getServerSnapshot`.

##### Key Points to Mention

- Add browser listener in `subscribe`.
- Return unsubscribe cleanup.
- Read current value in `getSnapshot`.
- Provide server fallback if needed.
- Wrap it in a custom hook.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-intermediate-q03 -->

#### Why do selectors matter for external stores?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-intermediate-q04 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Selectors let a component read only the slice of state it needs. Without selectors, a component may rerender whenever the full store snapshot changes, even if the part it uses did not change.

Selector equality and stable selected values are important for performance in large stores.

##### Key Points to Mention

- Components often need only one slice.
- Full snapshots can rerender too broadly.
- Selectors improve subscription granularity.
- Equality checks avoid unnecessary updates.
- Mature store libraries usually provide this.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you build a small custom external store for React?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-advanced-q01 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would create a store module with private state, a `getSnapshot` function, a `subscribe` function that manages listeners, and action functions that update state immutably and notify listeners. Then I would expose custom hooks that call `useSyncExternalStore` instead of having components use the store directly.

If the store grows, I would add selectors and equality checks or move to an established store library.

##### Key Points to Mention

- Private state.
- `getSnapshot`.
- `subscribe`.
- Immutable updates.
- Notify listeners after changes.
- Custom hooks as the public API.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-advanced-q01 -->

#### What SSR issues does `getServerSnapshot` solve?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-advanced-q02 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`getServerSnapshot` provides the snapshot used during server rendering and initial client hydration. It helps avoid mismatches by ensuring the server-rendered value and the first client-rendered value agree.

For browser-only values, the server snapshot should be a safe fallback. For app stores, the server snapshot should match the serialized initial state sent to the client.

##### Key Points to Mention

- Used during SSR and hydration.
- Prevents initial snapshot mismatch.
- Should match serialized initial state.
- Browser-only APIs need safe fallback.
- Hydration consistency matters.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-advanced-q02 -->

#### What is tearing, and how does `useSyncExternalStore` relate to it?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-advanced-q03 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Tearing is when different parts of the UI observe different versions of the same external state during a render. `useSyncExternalStore` gives React a consistent subscription and snapshot contract so external store reads work correctly with React rendering.

The store must still follow the rules: stable snapshots, notifications on change, and no hidden mutation without notifying subscribers.

##### Key Points to Mention

- Tearing is inconsistent external state reads.
- Can happen with external mutable sources.
- `useSyncExternalStore` provides React's contract.
- Store must expose stable snapshots.
- Store must notify after changes.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-advanced-q03 -->

#### When should application code avoid using `useSyncExternalStore` directly?

<!-- question:start:use-sync-external-store-and-subscribing-to-external-state-advanced-q04 -->
<!-- question-id:use-sync-external-store-and-subscribing-to-external-state-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Application code should usually avoid using it directly for ordinary local state, reducer state, or simple context state. It is a low-level hook for external subscriptions. For normal UI state, use `useState`, `useReducer`, context, or a state library.

Use it directly when building a custom store, wrapping a browser API, or integrating a non-React source. For complex app-wide stores, an established library is usually safer than a hand-rolled one.

##### Key Points to Mention

- Low-level external store hook.
- Not for ordinary local state.
- Use for custom stores and browser APIs.
- State libraries often wrap it for you.
- Complex stores need selectors and tested behavior.

<!-- question:end:use-sync-external-store-and-subscribing-to-external-state-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
