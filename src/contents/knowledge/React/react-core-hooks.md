---
id: react-core-hooks
topic: React Core Hooks
category: React
---

## Overview

This guide explains the core React hooks used in real-world projects:

- `useState`
- `useRef`
- `useReducer`
- `useMemo`
- `useCallback`

These hooks help manage state, performance, and component behavior in modern React applications.

---

#  useState

## What it is

`useState` allows a component to **store state that triggers a re-render when it changes**.

Core idea:

```text
State that affects the UI.
````

When the state changes, React **re-renders the component**.

---

## Syntax

```tsx
const [state, setState] = useState(initialValue);
```

Example:

```tsx
const [count, setCount] = useState(0);
```

Meaning:

* `count` → current state
* `setCount` → updates state
* Calling `setCount` triggers a re-render

---

## Example

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </>
  );
}
```

---

## When to use useState

Use `useState` when:

* UI depends on the value
* Component should re-render on change
* State is simple

Examples:

* form input
* toggle
* counters
* loading state

---

#  useRef

## What it is

`useRef` holds a **mutable value that persists across renders without triggering a re-render**.

Core idea:

```text
Store a value between renders without causing re-render.
```

---

## Important behavior

* Updating `ref.current` **does NOT trigger a re-render**
* Value persists between renders

---

## Most common use: DOM reference

Example:

```tsx
function InputFocus() {
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <>
      <input ref={inputRef} />
      <button onClick={focusInput}>Focus</button>
    </>
  );
}
```

---

## Another use: storing mutable values

Example:

```tsx
function RenderCounter() {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
  });

  return <div>Rendered {renderCount.current} times</div>;
}
```

---

## When to use useRef

Use when you need:

* DOM references
* mutable values across renders
* storing timers
* caching previous values

---

#  useReducer

## What it is

`useReducer` manages **complex state logic using actions and a reducer function**.

It is conceptually similar to **Redux**, but scoped locally to a component.

Core idea:

```text
State changes via actions.
```

Instead of:

```text
setState(value)
```

You dispatch:

```text
dispatch(action)
```

---

## Syntax

```tsx
const [state, dispatch] = useReducer(reducer, initialState);
```

---

## Example reducer

```tsx
type Action =
  | { type: "increment" }
  | { type: "decrement" };

function counterReducer(state: number, action: Action): number {
  switch (action.type) {
    case "increment":
      return state + 1;

    case "decrement":
      return state - 1;

    default:
      return state;
  }
}
```

---

## Example component

```tsx
function Counter() {
  const [count, dispatch] = useReducer(counterReducer, 0);

  return (
    <>
      <p>Count: {count}</p>

      <button onClick={() => dispatch({ type: "increment" })}>
        +
      </button>

      <button onClick={() => dispatch({ type: "decrement" })}>
        -
      </button>
    </>
  );
}
```

---

## When to use useReducer

Use `useReducer` when:

* state has multiple related fields
* updates depend on previous state
* many `setState` calls exist
* logic becomes complex

Examples:

* complex forms
* workflow state
* state machines

---

#  useMemo

## What it is

`useMemo` memoizes a **computed value** to avoid recomputing it on every render.

Core idea:

```text
Cache expensive calculations.
```

---

## Syntax

```tsx
const value = useMemo(() => computeValue(a, b), [a, b]);
```

React will:

* compute the value
* cache it
* recompute only when dependencies change

---

## Example

```tsx
const total = useMemo(() => {
  return items.reduce((sum, item) => sum + item.price, 0);
}, [items]);
```

Without `useMemo`, this calculation runs **on every render**.

---

## When to use useMemo

Use when:

* expensive calculations
* derived data
* filtering large lists
* sorting large datasets

Examples:

```text
filteredProducts
sortedUsers
expensive computations
```

---

#  useCallback

## What it is

`useCallback` memoizes **a function reference**.

Core idea:

```text
Cache a function between renders.
```

---

## Syntax

```tsx
const fn = useCallback(() => {
  doSomething(a);
}, [a]);
```

---

## Why it matters

Without `useCallback`, every render creates a **new function reference**.

This can cause unnecessary re-renders in child components.

---

## Example

```tsx
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []);
```

Often used together with:

```text
React.memo
useEffect dependencies
useMemo
```

---

# useMemo vs useCallback

Simple rule:

| Hook        | Memoizes |
| ----------- | -------- |
| useMemo     | value    |
| useCallback | function |

---

# Big Picture (One Sentence Each)

useState

```text
Store UI state
```

useRef

```text
Store mutable values without triggering re-render
```

useReducer

```text
Manage complex state via actions
```

useMemo

```text
Cache computed values
```

useCallback

```text
Cache function references
```

---

# Practical Mental Model

Think about hooks like this:

```text
useState → UI state
useRef → instance variable
useReducer → state machine
useMemo → cached computation
useCallback → cached function
```

---

# Real Example (Combining Hooks)

```tsx
function ProductList({ products }) {

  const [filter, setFilter] = useState("");

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(filter)
    );
  }, [products, filter]);

  const handleChange = useCallback(
    (e) => setFilter(e.target.value),
    []
  );

  return (
    <>
      <input value={filter} onChange={handleChange} />

      {filteredProducts.map(p => (
        <div key={p.id}>{p.name}</div>
      ))}
    </>
  );
}
```

---

# Interview Summary

If asked:

**When do you use each hook?**

A concise answer:

```text
useState → simple component state
useRef → store values between renders or access DOM
useReducer → complex state logic
useMemo → memoize expensive calculations
useCallback → memoize functions to prevent unnecessary re-renders
```

---

# Notes

1. `useMemo` and `useCallback` are **performance optimizations**, not correctness tools.

2. If you do not clearly understand **what you are optimizing**, you probably **do not need them**.

3. In large React applications, most application state typically lives in:

```text
Redux / RTK Query / server state
```

while React hooks manage **component-level state**.


---

