---
id: proper-use-effect-usage-and-cleanup
topic: Hooks, effects, and custom hooks
subtopic: Proper useEffect usage and cleanup
category: React
---

## Overview

`useEffect` is a React Hook for synchronizing a component with an external system after React renders and commits the UI. External systems include browser APIs, timers, subscriptions, network connections, third-party widgets, analytics, and imperative libraries.

```tsx
function ChatRoom({ roomId }: { roomId: string }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();

    return () => {
      connection.disconnect();
    };
  }, [roomId]);

  return <h1>Room {roomId}</h1>;
}
```

The cleanup function undoes the setup. It runs before the effect is re-run with changed dependencies and when the component unmounts. In development Strict Mode, React may run setup, cleanup, and setup again to reveal missing cleanup bugs.

This topic matters in interviews because many React bugs come from using effects for the wrong job, missing dependencies, causing infinite loops, leaking subscriptions, failing to cancel stale async work, or writing cleanup that does not mirror setup.

The practical goal is to use effects only when needed, make dependencies honest, and write setup/cleanup code that remains correct across mount, update, unmount, and development re-checks.

## Core Concepts

### What `useEffect` Is For

`useEffect` is for synchronizing with systems outside React's render calculation.

Good effect use cases:

- Connecting to a WebSocket or chat server.
- Subscribing to browser events.
- Starting and clearing timers.
- Controlling a non-React widget.
- Fetching data in simple client-side components.
- Reporting analytics after a screen appears.
- Synchronizing with APIs such as `localStorage`, when appropriate.

Example:

```tsx
function WindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <p>{width}px</p>;
}
```

### What `useEffect` Is Not For

Do not use effects for values that can be calculated during render.

Bad:

```tsx
const [fullName, setFullName] = useState("");

useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);
```

Good:

```tsx
const fullName = `${firstName} ${lastName}`;
```

Do not use effects to handle user events that already have event handlers.

Bad:

```tsx
useEffect(() => {
  if (isSubmitted) {
    submitForm();
  }
}, [isSubmitted]);
```

Good:

```tsx
function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  submitForm();
}
```

Effects are escape hatches. If no external system is involved, you often do not need an effect.

### Basic Effect Shape

An effect has setup logic and optional cleanup logic.

```tsx
useEffect(() => {
  setup();

  return () => {
    cleanup();
  };
}, [dependencies]);
```

The dependency array tells React which reactive values the setup uses. Reactive values include props, state, and variables or functions declared inside the component.

```tsx
function ChatRoom({ roomId, serverUrl }: Props) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();

    return () => connection.disconnect();
  }, [serverUrl, roomId]);
}
```

If `serverUrl` or `roomId` changes, React cleans up the old connection and sets up the new one.

### Effect Timing

Effects run after React commits the render to the DOM. That means effects do not block the render calculation.

This is why effects are suitable for synchronization after the UI has updated:

```tsx
useEffect(() => {
  document.title = `Inbox (${unreadCount})`;
}, [unreadCount]);
```

For visual work that must happen before the browser paints, such as measuring layout to avoid flicker, `useLayoutEffect` may be more appropriate. Most effects should use `useEffect`.

Effects do not run during server rendering. Code inside an effect is client-side behavior.

### Cleanup

Cleanup is the function returned from an effect. It should undo whatever setup did.

```tsx
useEffect(() => {
  const id = window.setInterval(() => {
    setTime(new Date());
  }, 1000);

  return () => {
    window.clearInterval(id);
  };
}, []);
```

Common cleanup tasks:

- Remove event listeners.
- Clear timers.
- Disconnect sockets.
- Unsubscribe from stores.
- Abort fetch requests or ignore stale results.
- Destroy third-party widgets.

Cleanup must match setup. If setup subscribes, cleanup unsubscribes. If setup starts a timer, cleanup clears it.

### When Cleanup Runs

Cleanup runs:

- Before the effect runs again because dependencies changed.
- When the component unmounts.
- During development Strict Mode checks, after the first setup and before the second setup.

Example timeline:

```tsx
useEffect(() => {
  connect(roomId);

  return () => disconnect(roomId);
}, [roomId]);
```

If `roomId` changes from `"general"` to `"music"`:

- Cleanup disconnects `"general"`.
- Setup connects `"music"`.

This keeps the component synchronized with the latest props and state.

### Strict Mode Double Setup

In development, Strict Mode may run an extra setup-cleanup-setup cycle. This is not a production behavior, but it exposes effects that are missing cleanup.

If this effect has no cleanup:

```tsx
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();
}, [roomId]);
```

development may show duplicate connections.

Fix:

```tsx
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();

  return () => {
    connection.disconnect();
  };
}, [roomId]);
```

The goal is not to prevent the development re-check. The goal is to make the effect resilient to setup and cleanup happening multiple times.

### Dependency Arrays

The dependency array should include every reactive value used by the effect.

```tsx
function ChatRoom({ roomId }: { roomId: string }) {
  const [serverUrl, setServerUrl] = useState("https://localhost:1234");

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();

    return () => connection.disconnect();
  }, [serverUrl, roomId]);
}
```

Do not remove dependencies just to silence the linter. Missing dependencies create stale closure bugs, where an effect reads old props or state.

If a dependency changes too often, restructure the code:

- Move object creation inside the effect.
- Move functions inside the effect.
- Use primitive dependencies.
- Use `useCallback` only when stable function identity is actually needed.
- Split effects by responsibility.

### No Dependency Array vs Empty Dependency Array

No dependency array:

```tsx
useEffect(() => {
  console.log("Runs after every render");
});
```

Empty dependency array:

```tsx
useEffect(() => {
  console.log("Runs after mount");
}, []);
```

Specific dependencies:

```tsx
useEffect(() => {
  console.log("Runs when roomId changes");
}, [roomId]);
```

An empty dependency array does not mean "ignore dependencies." It means the effect uses no reactive values from the component. If it does use props or state, the dependency list should include them.

### Avoiding Object and Function Dependency Loops

Objects and functions created during render have new identity each render.

Problem:

```tsx
function ChatRoom({ roomId }: { roomId: string }) {
  const options = {
    serverUrl: "https://localhost:1234",
    roomId,
  };

  useEffect(() => {
    const connection = createConnection(options);
    connection.connect();

    return () => connection.disconnect();
  }, [options]);
}
```

`options` is new every render, so the effect runs too often.

Better:

```tsx
function ChatRoom({ roomId }: { roomId: string }) {
  useEffect(() => {
    const options = {
      serverUrl: "https://localhost:1234",
      roomId,
    };

    const connection = createConnection(options);
    connection.connect();

    return () => connection.disconnect();
  }, [roomId]);
}
```

Move object creation inside the effect so dependencies represent real reactive inputs.

### Fetching Data in Effects

Effects can fetch data in simple client-side components, but you must handle stale results.

```tsx
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      setUser(null);
      const nextUser = await fetchUser(userId);

      if (!ignore) {
        setUser(nextUser);
      }
    }

    loadUser();

    return () => {
      ignore = true;
    };
  }, [userId]);

  return user ? <h1>{user.name}</h1> : <p>Loading...</p>;
}
```

The cleanup prevents an older request from updating state after `userId` changes or the component unmounts.

For production apps, framework data loading, route loaders, server components, or client data libraries often handle caching, deduplication, race conditions, and loading states better than manual effects.

### AbortController

When using `fetch`, cleanup can abort an in-flight request.

```tsx
useEffect(() => {
  const controller = new AbortController();

  async function load() {
    const response = await fetch(`/api/users/${userId}`, {
      signal: controller.signal,
    });

    const data = await response.json();
    setUser(data);
  }

  load().catch((error) => {
    if (error.name !== "AbortError") {
      setError("Failed to load user");
    }
  });

  return () => {
    controller.abort();
  };
}, [userId]);
```

Aborting avoids unnecessary network work and prevents stale work from continuing after cleanup.

### Subscriptions and External Stores

Subscriptions need cleanup.

```tsx
useEffect(() => {
  function handleChange() {
    setSnapshot(store.getSnapshot());
  }

  const unsubscribe = store.subscribe(handleChange);

  return () => {
    unsubscribe();
  };
}, [store]);
```

For external stores, React provides `useSyncExternalStore`, which is often better than hand-rolled subscription effects because it is designed for concurrent rendering and consistent snapshots.

### Splitting Effects

Each effect should usually represent one synchronization process.

Bad:

```tsx
useEffect(() => {
  document.title = title;
  const connection = createConnection(roomId);
  connection.connect();

  return () => connection.disconnect();
}, [title, roomId]);
```

Better:

```tsx
useEffect(() => {
  document.title = title;
}, [title]);

useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();

  return () => connection.disconnect();
}, [roomId]);
```

Splitting effects makes dependencies smaller and behavior easier to reason about.

### Infinite Effect Loops

An infinite effect loop usually happens when:

- The effect updates state.
- That state update changes a dependency.
- The changed dependency causes the effect to run again.

Example:

```tsx
useEffect(() => {
  setOptions({ sort: "name" });
}, [options]);
```

Every `setOptions` creates a new object, which changes `options`, which runs the effect again.

Fix the data flow:

- Derive the value during render if possible.
- Initialize state directly.
- Remove unnecessary object dependencies.
- Use functional updates carefully.
- Split the effect or remove it.

### Reading Latest Values Without Re-running Effects

Sometimes an effect needs latest data for an event or callback, but that data should not cause the subscription itself to restart. Common solutions include:

- Move non-reactive event logic into the event handler.
- Store mutable latest values in a ref when appropriate.
- Use React's newer effect-event patterns where available in your environment.
- Split the effect so the subscription and state reaction are separate.

Use this carefully. Do not hide real dependencies. If the effect's synchronization depends on a value, include it.

### Common Mistakes

Common mistakes include:

- Using effects for derived state.
- Using effects for user event logic.
- Missing dependencies.
- Adding empty dependency arrays while reading props or state.
- Creating object or function dependencies that change every render.
- Forgetting cleanup for subscriptions, timers, and connections.
- Treating Strict Mode's development re-check as the bug instead of fixing cleanup.
- Fetching data without handling stale responses.
- Combining unrelated synchronization processes in one effect.
- Updating state in an effect after every render and causing loops.

### Best Practices

Use these rules of thumb:

- Start by asking whether an external system is involved.
- If not, you probably do not need an effect.
- Keep render calculations in render.
- Keep user-triggered actions in event handlers.
- Include all reactive dependencies.
- Let the linter help with dependency correctness.
- Make cleanup mirror setup.
- Split effects by synchronization purpose.
- Handle stale async work with cleanup, ignore flags, or aborts.
- Treat effects as synchronization, not lifecycle methods.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is `useEffect` used for?

<!-- question:start:proper-use-effect-usage-and-cleanup-beginner-q01 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`useEffect` is used to synchronize a component with an external system after React renders and commits the UI. External systems include browser APIs, timers, subscriptions, network connections, analytics, and imperative third-party libraries.

```tsx
useEffect(() => {
  document.title = `Inbox (${unreadCount})`;
}, [unreadCount]);
```

It should not be the default place for all logic. If something can be calculated during render or handled in an event handler, an effect is often unnecessary.

##### Key Points to Mention

- Effects synchronize with external systems.
- Effects run after render commit.
- Dependencies control when effects re-run.
- Not all logic belongs in effects.
- Derived values usually belong in render.

<!-- question:end:proper-use-effect-usage-and-cleanup-beginner-q01 -->

#### What is an effect cleanup function?

<!-- question:start:proper-use-effect-usage-and-cleanup-beginner-q02 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An effect cleanup function is the function returned from an effect. It undoes the setup work. React runs cleanup before re-running the effect with changed dependencies and when the component unmounts.

```tsx
useEffect(() => {
  const id = window.setInterval(tick, 1000);

  return () => {
    window.clearInterval(id);
  };
}, []);
```

Cleanup is needed for timers, subscriptions, event listeners, sockets, and other resources that should not keep running after the component no longer needs them.

##### Key Points to Mention

- Cleanup is returned from the effect callback.
- It undoes setup work.
- It runs before dependency-driven re-setup.
- It runs on unmount.
- It prevents leaks and duplicate subscriptions.

<!-- question:end:proper-use-effect-usage-and-cleanup-beginner-q02 -->

#### What does the dependency array do?

<!-- question:start:proper-use-effect-usage-and-cleanup-beginner-q03 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The dependency array tells React which reactive values the effect depends on. React compares those values between renders. If a dependency changes, React runs cleanup for the previous effect and then runs setup again.

```tsx
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();

  return () => connection.disconnect();
}, [roomId]);
```

The dependency list should include props, state, and component-local variables used by the effect.

##### Key Points to Mention

- Dependencies control when an effect re-runs.
- Include all reactive values used by the effect.
- Changed dependencies cause cleanup then setup.
- Empty array means no reactive dependencies.
- Missing dependencies can cause stale closures.

<!-- question:end:proper-use-effect-usage-and-cleanup-beginner-q03 -->

#### When do you not need an effect?

<!-- question:start:proper-use-effect-usage-and-cleanup-beginner-q04 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

You do not need an effect when the value can be calculated from props or state during render, or when logic belongs in a user event handler.

Bad:

```tsx
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);
```

Good:

```tsx
const fullName = `${firstName} ${lastName}`;
```

Effects are for synchronizing with systems outside React, not for ordinary render-time calculations.

##### Key Points to Mention

- Derived values can be calculated during render.
- User actions belong in event handlers.
- Effects are for external synchronization.
- Avoid extra renders from derived state effects.
- Simpler render logic is usually more reliable.

<!-- question:end:proper-use-effect-usage-and-cleanup-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why does Strict Mode run effects twice in development?

<!-- question:start:proper-use-effect-usage-and-cleanup-intermediate-q01 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Strict Mode may run an extra setup-cleanup-setup cycle in development to reveal effects that are not resilient to being mounted, cleaned up, and mounted again. This helps find missing cleanup bugs.

If connecting to a server creates duplicate connections in development, the problem is usually not Strict Mode itself. The effect likely needs cleanup.

```tsx
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();

  return () => connection.disconnect();
}, [roomId]);
```

Production does not use this extra development re-check, but the code should still be correct under it.

##### Key Points to Mention

- Strict Mode exposes missing cleanup.
- Development may run setup-cleanup-setup.
- Do not disable cleanup to hide the symptom.
- Cleanup should mirror setup.
- Production behavior is not the same as the development check.

<!-- question:end:proper-use-effect-usage-and-cleanup-intermediate-q01 -->

#### How do you prevent stale async results in an effect?

<!-- question:start:proper-use-effect-usage-and-cleanup-intermediate-q02 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use cleanup to ignore or cancel work from an outdated effect. A common pattern is an `ignore` flag:

```tsx
useEffect(() => {
  let ignore = false;

  async function load() {
    const data = await fetchUser(userId);

    if (!ignore) {
      setUser(data);
    }
  }

  load();

  return () => {
    ignore = true;
  };
}, [userId]);
```

For `fetch`, `AbortController` can also abort the request. This prevents older requests from updating state after props change or the component unmounts.

##### Key Points to Mention

- Async work can finish after dependencies change.
- Cleanup can mark old work as ignored.
- `AbortController` can cancel fetch requests.
- Avoid setting state from stale requests.
- Data libraries often handle these concerns for larger apps.

<!-- question:end:proper-use-effect-usage-and-cleanup-intermediate-q02 -->

#### How do you fix an effect that re-runs too often because of object dependencies?

<!-- question:start:proper-use-effect-usage-and-cleanup-intermediate-q03 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

If an object is created during render and used as a dependency, it has a new identity every render. The effect will re-run too often. Move the object creation inside the effect or depend on primitive values instead.

Bad:

```tsx
const options = { roomId, serverUrl };

useEffect(() => {
  connect(options);
}, [options]);
```

Good:

```tsx
useEffect(() => {
  const options = { roomId, serverUrl };
  connect(options);
}, [roomId, serverUrl]);
```

Use `useMemo` only when stable object identity is truly needed outside the effect.

##### Key Points to Mention

- Object literals are new every render.
- New identity can re-trigger effects.
- Move object creation inside the effect.
- Depend on primitive inputs when possible.
- Do not remove dependencies dishonestly.

<!-- question:end:proper-use-effect-usage-and-cleanup-intermediate-q03 -->

#### Why should unrelated effects be split?

<!-- question:start:proper-use-effect-usage-and-cleanup-intermediate-q04 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Each effect should represent one synchronization process. If one effect updates the document title and also connects to a chat room, its dependencies become mixed and it may reconnect unnecessarily when only the title changes.

Better:

```tsx
useEffect(() => {
  document.title = title;
}, [title]);

useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();

  return () => connection.disconnect();
}, [roomId]);
```

Splitting effects makes dependencies smaller, cleanup clearer, and behavior easier to reason about.

##### Key Points to Mention

- One effect should represent one synchronization process.
- Mixed effects create noisy dependencies.
- Splitting avoids unnecessary cleanup and setup.
- Smaller effects are easier to debug.
- Cleanup should match one setup responsibility.

<!-- question:end:proper-use-effect-usage-and-cleanup-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you debug an infinite `useEffect` loop?

<!-- question:start:proper-use-effect-usage-and-cleanup-advanced-q01 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

First identify whether the effect sets state. Then check whether that state update changes one of the effect dependencies. Infinite loops often happen when an effect creates a new object, stores it in state, or depends on a value that changes because of the effect.

Fix the data flow rather than hiding dependencies. If the value can be derived during render, remove the effect. If object or function identity is the issue, move creation inside the effect or depend on primitive values. If the effect is doing event logic, move it to the event handler.

Use logging of dependency values, React DevTools, and lint feedback to locate the changing dependency.

##### Key Points to Mention

- Effects loop when they update a dependency.
- Look for state updates inside the effect.
- Check object and function identity.
- Remove effects used for derived state.
- Do not suppress dependencies as the primary fix.

<!-- question:end:proper-use-effect-usage-and-cleanup-advanced-q01 -->

#### How do you decide between an effect and an event handler?

<!-- question:start:proper-use-effect-usage-and-cleanup-advanced-q02 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use an event handler when the logic is caused by a specific user interaction, such as clicking Submit, opening a menu, or selecting an item. Use an effect when the component needs to stay synchronized with an external system because it is currently rendered with certain props or state.

Submitting a form belongs in `onSubmit` because the user caused it. Connecting to a chat room belongs in an effect because the component must stay connected while `roomId` is active.

This distinction prevents state flags like `isSubmitted` from triggering effects that could have been direct event logic.

##### Key Points to Mention

- User-caused actions belong in event handlers.
- Render-caused synchronization belongs in effects.
- Effects should not replace direct event logic.
- External systems are the key signal for effects.
- This reduces indirect state-driven code.

<!-- question:end:proper-use-effect-usage-and-cleanup-advanced-q02 -->

#### How would you write a custom hook that uses an effect safely?

<!-- question:start:proper-use-effect-usage-and-cleanup-advanced-q03 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Design the custom hook around one responsibility, include all reactive dependencies, and make cleanup mirror setup. For example, a window event hook should add the listener in setup and remove the same listener in cleanup.

```tsx
function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void
) {
  useEffect(() => {
    window.addEventListener(type, handler);

    return () => {
      window.removeEventListener(type, handler);
    };
  }, [type, handler]);
}
```

If `handler` changes every render, callers may need `useCallback`, or the hook can use a ref-based pattern depending on the intended API. The important point is to keep synchronization honest and documented.

##### Key Points to Mention

- Custom hooks should have one clear responsibility.
- Include dependencies honestly.
- Cleanup should remove what setup added.
- Think about callback identity.
- Hide effect details behind a focused API.

<!-- question:end:proper-use-effect-usage-and-cleanup-advanced-q03 -->

#### What are the trade-offs of fetching data directly in `useEffect`?

<!-- question:start:proper-use-effect-usage-and-cleanup-advanced-q04 -->
<!-- question-id:proper-use-effect-usage-and-cleanup-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Fetching in `useEffect` is simple for small client-only components, but it has trade-offs. You must handle loading state, errors, stale responses, cancellation, caching, deduplication, race conditions, and repeated fetches. It also usually does not run during server rendering.

For larger apps, framework loaders, server components, route-level data APIs, or client data libraries often provide better caching and request coordination.

If fetching in an effect, include the real dependencies and use cleanup with an ignore flag or `AbortController` to prevent stale updates.

##### Key Points to Mention

- Simple effects can fetch data in client components.
- Manual fetching must handle stale responses.
- Caching and deduplication are not automatic.
- Effects do not run during server rendering.
- Framework or data-library fetching is often better for production flows.

<!-- question:end:proper-use-effect-usage-and-cleanup-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
