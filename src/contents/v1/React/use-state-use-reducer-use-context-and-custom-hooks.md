---
id: use-state-use-reducer-use-context-and-custom-hooks
topic: Hooks, effects, and custom hooks
subtopic: useState, useReducer, useContext, and custom hooks
category: React
---

## Overview

React Hooks let functional components use React features such as state, context, effects, memoization, refs, and transitions without writing class components. This topic focuses on four interview-critical areas:

- `useState` for local component state.
- `useReducer` for structured state transitions.
- `useContext` for reading shared values from a provider.
- Custom hooks for extracting reusable stateful logic.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount((current) => current + 1)}>
      Count: {count}
    </button>
  );
}
```

Hooks matter because modern React applications are built from small functional components and reusable hooks. Interviews often test whether a developer understands state snapshots, functional updates, reducers, dispatch actions, context boundaries, provider value stability, rules of hooks, and when a custom hook is a useful abstraction instead of just a wrapper.

The practical goal is to put state and shared logic in the right place, keep render logic predictable, and make components easier to test, reuse, and reason about.

## Core Concepts

### What Hooks Are

Hooks are functions that let React components use React features. Built-in hooks include `useState`, `useReducer`, `useContext`, `useEffect`, `useMemo`, `useCallback`, and `useRef`.

Hooks are called inside function components or inside custom hooks:

```tsx
function UserMenu() {
  const [open, setOpen] = useState(false);

  return (
    <button onClick={() => setOpen((value) => !value)}>
      {open ? "Close" : "Open"}
    </button>
  );
}
```

Custom hooks are functions whose names start with `use` and may call other hooks:

```tsx
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = () => setValue((current) => !current);

  return { value, setValue, toggle };
}
```

### Rules of Hooks

Hooks must be called at the top level of a function component or custom hook.

Do not call hooks:

- Inside conditions.
- Inside loops.
- Inside nested functions.
- After early returns.
- In ordinary non-hook functions.
- In event handlers.

Bad:

```tsx
function Profile({ enabled }: { enabled: boolean }) {
  if (enabled) {
    const [name, setName] = useState("");
  }

  return null;
}
```

Good:

```tsx
function Profile({ enabled }: { enabled: boolean }) {
  const [name, setName] = useState("");

  if (!enabled) {
    return null;
  }

  return <p>{name}</p>;
}
```

React depends on hooks being called in the same order on every render. Breaking this rule makes React associate state with the wrong hook call.

### `useState`

`useState` declares local state in a component.

```tsx
const [value, setValue] = useState(initialValue);
```

Example:

```tsx
function SearchInput() {
  const [query, setQuery] = useState("");

  return (
    <input
      value={query}
      onChange={(event) => setQuery(event.currentTarget.value)}
    />
  );
}
```

`useState` returns two values:

- The current state for this render.
- A setter function that schedules the next state and triggers a re-render.

State is local to each component instance. If `SearchInput` renders twice, each instance has its own `query`.

### State as a Snapshot

State variables are snapshots for a specific render. Calling a setter does not change the variable in the already-running code.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log(count); // Old value for this render.
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

React will call the component again with the new state.

If the next state depends on the previous state, use a functional update:

```tsx
setCount((current) => current + 1);
```

This matters when queueing multiple updates:

```tsx
setCount((current) => current + 1);
setCount((current) => current + 1);
setCount((current) => current + 1);
```

The count increases by three.

### Lazy Initial State

If initial state is expensive to compute, pass an initializer function.

```tsx
function TodoList() {
  const [todos, setTodos] = useState(() => loadInitialTodos());

  return <TodoItems todos={todos} />;
}
```

Do not call the expensive function directly:

```tsx
const [todos, setTodos] = useState(loadInitialTodos());
```

That evaluates on every render, even though React uses the initial value only during initialization.

The initializer function should be pure. In development Strict Mode, React may call initializers more than once to help find impurities.

### Updating Objects and Arrays

State should be treated as immutable. Do not mutate existing state objects or arrays.

Bad:

```tsx
user.name = "Ava";
setUser(user);
```

Good:

```tsx
setUser((current) => ({
  ...current,
  name: "Ava",
}));
```

Array update:

```tsx
setItems((items) =>
  items.map((item) =>
    item.id === updated.id ? { ...item, ...updated } : item
  )
);
```

Immutable updates help React detect meaningful changes and keep previous renders predictable.

### When `useState` Is Enough

Use `useState` when state is simple and updates are easy to understand.

Good `useState` candidates:

- A boolean such as `isOpen`.
- A string input value.
- A selected tab.
- A small object updated in one or two places.
- Local UI state used by one component.

```tsx
function Tabs() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      <button onClick={() => setActiveTab("overview")}>Overview</button>
      <button onClick={() => setActiveTab("settings")}>Settings</button>
      <Panel activeTab={activeTab} />
    </>
  );
}
```

Reach for something else when updates become hard to follow, several fields change together, or transitions are better described as actions.

### `useReducer`

`useReducer` manages state with a reducer function and dispatched actions.

```tsx
type State = {
  count: number;
};

type Action =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "reset":
      return { count: 0 };
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: "increment" })}>+</button>
      <button onClick={() => dispatch({ type: "decrement" })}>-</button>
      <button onClick={() => dispatch({ type: "reset" })}>Reset</button>
    </>
  );
}
```

The reducer receives the current state and an action, then returns the next state.

### When to Use `useReducer`

`useReducer` is useful when:

- State transitions are complex.
- Several fields update together.
- Many event handlers update the same state.
- You want action names to document why state changed.
- You want reducer logic to be easy to test outside React.

Example form state:

```tsx
type FormState = {
  email: string;
  password: string;
  status: "idle" | "submitting" | "success" | "error";
};

type FormAction =
  | { type: "fieldChanged"; field: "email" | "password"; value: string }
  | { type: "submitted" }
  | { type: "succeeded" }
  | { type: "failed" };
```

Reducers make state transitions explicit. This is often clearer than many scattered `setState` calls.

### Reducer Best Practices

Reducers should be pure:

- Do not mutate state.
- Do not call APIs.
- Do not generate random IDs unless the ID is part of an action created outside the reducer.
- Do not read from the DOM.
- Return the next state based only on current state and action.

Bad:

```tsx
function reducer(state: State, action: Action) {
  state.count += 1;
  return state;
}
```

Good:

```tsx
function reducer(state: State, action: Action) {
  return { count: state.count + 1 };
}
```

Keep side effects in event handlers, effects, or command functions outside the reducer.

### `useContext`

`useContext` reads a value from the nearest matching context provider above the component.

```tsx
const ThemeContext = createContext<"light" | "dark">("light");

function ThemeButton() {
  const theme = useContext(ThemeContext);

  return <button className={theme}>Save</button>;
}
```

Provider example:

```tsx
function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  return (
    <ThemeContext.Provider value={theme}>
      <Page />
    </ThemeContext.Provider>
  );
}
```

React 19 also supports rendering the context object itself as a provider:

```tsx
<ThemeContext value={theme}>
  <Page />
</ThemeContext>
```

Many codebases still use `.Provider`, so interview answers should recognize both.

### When to Use Context

Context is useful for values needed by many components at different depths:

- Theme.
- Locale.
- Current user.
- Feature flags.
- App shell settings.
- Shared service clients.

Context is not a replacement for all props. A few levels of explicit props may be simpler than context.

Poor context candidates:

- State used by only one component.
- Rapidly changing state for large lists.
- Form field values that belong in a form component.
- Values that only one child needs.

Context makes dependencies less visible at the call site. Use it for cross-cutting values, not to avoid ordinary component design.

### Context Value Stability

Every provider value change re-renders consumers that read that context.

This value is new every render:

```tsx
<AuthContext.Provider value={{ user, logout }}>
  {children}
</AuthContext.Provider>
```

If consumers are expensive or the provider renders often, memoize the value:

```tsx
const value = useMemo(
  () => ({ user, logout }),
  [user, logout]
);

return (
  <AuthContext.Provider value={value}>
    {children}
  </AuthContext.Provider>
);
```

Also consider splitting context:

- `AuthUserContext` for user data.
- `AuthActionsContext` for stable actions.

This prevents unrelated changes from re-rendering consumers unnecessarily.

### Safe Context Hooks

When a context has no meaningful default value, use `null` and expose a custom hook that throws if the provider is missing.

```tsx
type AuthContextValue = {
  user: User;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
```

This improves caller code because consumers receive `AuthContextValue`, not `AuthContextValue | null`.

### Custom Hooks

A custom hook is a reusable function that starts with `use` and calls hooks.

```tsx
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
```

Usage:

```tsx
function StatusBanner() {
  const isOnline = useOnlineStatus();

  return <p>{isOnline ? "Online" : "Offline"}</p>;
}
```

Custom hooks share logic, not state. Each call to a custom hook has its own state unless it uses a shared external store or context.

### Good Custom Hook Boundaries

Extract a custom hook when:

- Multiple components use the same stateful logic.
- A component has too much setup or synchronization code.
- You want to hide implementation details behind a focused API.
- You want to test logic separately.
- The hook represents a domain concept such as `useAuth`, `useCart`, or `useDebouncedValue`.

Avoid custom hooks that only rename one line:

```tsx
function useName() {
  return useState("");
}
```

This adds indirection without meaningful abstraction.

Good custom hook:

```tsx
function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}
```

### Custom Hook Return Shapes

Custom hooks commonly return:

- A single value.
- An object with named fields.
- A tuple for small state-like APIs.

Single value:

```tsx
const isOnline = useOnlineStatus();
```

Object:

```tsx
const { user, login, logout } = useAuth();
```

Tuple:

```tsx
const [open, setOpen, toggle] = useDisclosure();
```

Objects are usually clearer for domain hooks because call sites do not depend on position. Tuples are common when the hook intentionally mirrors built-in hook style.

### Common Mistakes

Common mistakes include:

- Calling hooks conditionally.
- Calling hooks in event handlers.
- Mutating state objects or arrays.
- Using `useState` for complex transition logic that wants a reducer.
- Putting side effects inside reducers.
- Using context to avoid simple prop passing.
- Providing a new object context value on every render without considering consumers.
- Forgetting that each custom hook call has separate state.
- Naming a function that calls hooks without the `use` prefix.
- Creating a custom hook abstraction before there is repeated or complex logic.

### Best Practices

Use these rules of thumb:

- Use `useState` for simple local state.
- Use functional updates when the next state depends on previous state.
- Use `useReducer` for complex state transitions.
- Keep reducers pure.
- Use context for cross-cutting values needed across distance.
- Split context by responsibility and update frequency.
- Use custom hooks to extract reusable stateful logic.
- Keep custom hook APIs small and intention-revealing.
- Follow the Rules of Hooks and use the hooks lint rules.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is `useState` used for?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-beginner-q01 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`useState` is used to add local state to a function component. It returns the current state value and a setter function. Calling the setter schedules a re-render with the next state.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount((current) => current + 1)}>
      {count}
    </button>
  );
}
```

It is best for simple component state such as booleans, strings, selected tabs, input values, and small local UI state.

##### Key Points to Mention

- `useState` stores local component state.
- It returns `[state, setState]`.
- Setters schedule a re-render.
- State is scoped to a component instance.
- Use functional updates when next state depends on previous state.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-beginner-q01 -->

#### What are the Rules of Hooks?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-beginner-q02 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Hooks must be called at the top level of a React function component or custom hook. They should not be called inside conditions, loops, nested functions, event handlers, or after early returns.

React relies on hooks being called in the same order on every render. If the order changes, React can associate state with the wrong hook call.

```tsx
function Component() {
  const [value, setValue] = useState("");

  if (!value) {
    return null;
  }

  return <p>{value}</p>;
}
```

The hook is called before the conditional return, so the order is stable.

##### Key Points to Mention

- Call hooks only from components or custom hooks.
- Call hooks at the top level.
- Do not call hooks conditionally.
- Do not call hooks in loops or event handlers.
- Stable hook order is required across renders.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-beginner-q02 -->

#### What is `useContext` used for?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-beginner-q03 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`useContext` reads a value from the nearest matching context provider above the component. It is useful for values needed by many components without passing props through every intermediate layer.

```tsx
const ThemeContext = createContext("light");

function Button() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Save</button>;
}
```

Common context values include theme, locale, current user, feature flags, and app-wide configuration. Context should not replace all props; explicit props are often clearer for local data.

##### Key Points to Mention

- `useContext` reads from a context provider.
- It avoids passing props through many layers.
- Provider value changes re-render consumers.
- Good for cross-cutting shared values.
- Not every shared value needs context.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-beginner-q03 -->

#### What is a custom hook?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-beginner-q04 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A custom hook is a reusable function whose name starts with `use` and that can call other hooks. It extracts stateful logic from components.

```tsx
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  const toggle = () => setValue((current) => !current);

  return { value, setValue, toggle };
}
```

Each call to a custom hook has its own state unless the hook reads shared state from context or an external store. Custom hooks help keep components focused on rendering.

##### Key Points to Mention

- Custom hooks start with `use`.
- They can call built-in hooks.
- They extract reusable stateful logic.
- Each hook call has independent state by default.
- Good custom hooks expose a focused API.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When would you choose `useReducer` instead of `useState`?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q01 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `useReducer` when state transitions are complex, several fields change together, many handlers update the same state, or action names make the logic easier to understand. `useState` is fine for simple local state, but reducers make larger transition logic explicit and testable.

```tsx
type Action =
  | { type: "submitted" }
  | { type: "succeeded" }
  | { type: "failed"; error: string };
```

The reducer describes how each action changes state. This can be clearer than scattered setter calls across many event handlers.

##### Key Points to Mention

- Use `useState` for simple state.
- Use `useReducer` for complex transitions.
- Reducers centralize update logic.
- Actions document why state changed.
- Reducers are easy to unit test.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q01 -->

#### What makes a reducer pure?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q02 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A reducer is pure when it returns the next state based only on the current state and action. It should not mutate the existing state, call APIs, read from the DOM, use random values, or perform side effects.

Bad:

```tsx
function reducer(state: State, action: Action) {
  state.count += 1;
  return state;
}
```

Good:

```tsx
function reducer(state: State, action: Action) {
  return { count: state.count + 1 };
}
```

Side effects should happen outside the reducer, usually in event handlers, effects, or async command functions.

##### Key Points to Mention

- Reducers should not mutate state.
- Reducers should not perform side effects.
- Same input should produce same output.
- Return a new state object for changes.
- Keep API calls outside reducers.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q02 -->

#### What problem does a safe context hook solve?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q03 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A safe context hook wraps `useContext` and throws a clear error when the provider is missing. This is useful when the context has no meaningful default value.

```tsx
const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
```

Consumers no longer need to handle `null`, and missing provider bugs fail early with a useful message.

##### Key Points to Mention

- Context defaults are fallback values.
- `null` is common when no real default exists.
- A custom hook can enforce provider presence.
- It simplifies consumer types.
- It gives clearer runtime errors.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q03 -->

#### How should context provider values be structured?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q04 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Provider values should be shaped around what consumers need and how often values change. If a provider passes an object literal inline, it creates a new object on every render, which can re-render consumers.

```tsx
const value = useMemo(
  () => ({ user, logout }),
  [user, logout]
);
```

For larger contexts, split values by responsibility or update frequency. For example, separate user data from auth actions if actions are stable but user data changes. This reduces unnecessary consumer updates and makes dependencies clearer.

##### Key Points to Mention

- Provider value changes re-render consumers.
- Inline object values create new references.
- `useMemo` can stabilize object values.
- Split context by responsibility when useful.
- Avoid one giant context for unrelated data.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you refactor complex component state into a reducer?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-advanced-q01 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

First identify the state shape and the events that change it. Replace scattered setter calls with action objects that describe user or system events. Move transition logic into a reducer that returns new state for each action.

For example, a form with `status`, `values`, and `error` could have actions such as `fieldChanged`, `submitted`, `succeeded`, and `failed`. Event handlers dispatch actions instead of manually coordinating several setters.

The reducer should stay pure. API calls remain in event handlers or async functions, which dispatch success or failure actions when work completes.

##### Key Points to Mention

- Identify state shape and events.
- Use actions to describe why state changes.
- Move transition logic into a pure reducer.
- Keep async side effects outside the reducer.
- Use discriminated unions for TypeScript action safety.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-advanced-q01 -->

#### How do custom hooks share logic without sharing state?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-advanced-q02 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Custom hooks reuse code, but each call gets its own hook state. If two components both call `useToggle`, they each receive independent `value` state because each call belongs to a different component instance and hook position.

Shared state only happens when the custom hook reads or writes a shared source such as context, an external store, browser storage, or a module-level singleton.

This distinction matters because developers sometimes expect a custom hook to act like a global store. It does not. It is just a function that uses React hooks.

##### Key Points to Mention

- Custom hooks share logic.
- Each call has independent React state by default.
- Shared state requires a shared source.
- Context or external stores can provide shared state.
- Hook names should start with `use`.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-advanced-q02 -->

#### How would you design a custom hook API?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-advanced-q03 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Design a custom hook around a clear responsibility. The hook should hide implementation details and return the smallest useful API. Domain hooks often return objects with named fields because objects are self-documenting and easier to extend. Small state-like hooks can return tuples if they intentionally mirror built-in hooks.

```tsx
function useAuth() {
  return { user, login, logout, status };
}
```

Avoid returning unstable functions or objects unnecessarily if consumers depend on identity. Also avoid hooks that merely rename one `useState` call without adding clarity.

##### Key Points to Mention

- Start with a clear responsibility.
- Return a small intention-revealing API.
- Objects are good for domain hooks.
- Tuples are good for simple state-like hooks.
- Avoid premature or thin abstractions.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-advanced-q03 -->

#### What are common hook-related performance pitfalls?

<!-- question:start:use-state-use-reducer-use-context-and-custom-hooks-advanced-q04 -->
<!-- question-id:use-state-use-reducer-use-context-and-custom-hooks-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Common pitfalls include putting too much frequently changing state in context, creating new provider objects or callbacks every render, using context as a global store for high-frequency updates, and memoizing before fixing state ownership.

Other issues include reducers that recreate large state trees unnecessarily, custom hooks that hide expensive work, and effects that update state unnecessarily after every render.

The first fix is usually data-flow design: colocate state, split context, avoid duplicated state, and derive values during render. Memoization with `useMemo` or `useCallback` can help when identity stability is actually needed.

##### Key Points to Mention

- Context value changes re-render consumers.
- Inline objects and functions can create unstable identities.
- Too much global context can hurt performance.
- Fix state ownership before memoizing.
- Memoization is useful when it solves a real identity or cost problem.

<!-- question:end:use-state-use-reducer-use-context-and-custom-hooks-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
