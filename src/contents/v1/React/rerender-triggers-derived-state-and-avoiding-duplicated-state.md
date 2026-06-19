---
id: rerender-triggers-derived-state-and-avoiding-duplicated-state
topic: Components, props, state, and rendering behavior
subtopic: Rerender triggers, derived state, and avoiding duplicated state
category: React
---

## Overview

Re-render triggers, derived state, and duplicated state are closely related because they determine when React calls components again and whether the next UI is calculated from a clean source of truth. React rendering is not manual DOM mutation. A render is React calling your component functions to figure out what the UI should look like for the current props, state, and context.

The most common render triggers are:

- The initial render.
- A component's state update.
- A parent re-rendering and rendering its children.
- A context value used by a component changing.

Derived state is data that can be calculated from existing props or state. Duplicated state is the same information stored in multiple places. Both are frequent causes of bugs because they create multiple sources of truth.

```tsx
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");

const fullName = `${firstName} ${lastName}`;
```

Here `fullName` should be derived during render, not stored in state. If it were stored separately, every name update would need to remember to update it too.

For interviews, this topic matters because strong React developers know when to store state, when to derive values, why re-renders happen, how state snapshots and batching work, when memoization helps, and how to avoid contradictory or duplicated state models.

## Core Concepts

### What Rendering Means

Rendering means React calls your component function to calculate React elements for the current inputs.

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}
```

Rendering does not mean the browser DOM definitely changes. After rendering, React compares the new output with the previous output and commits the necessary DOM updates.

React's process can be thought of as:

- Trigger: something asks React to render.
- Render: React calls components.
- Commit: React applies necessary changes to the DOM.

This distinction matters because render logic should be pure. Side effects belong in event handlers or effects, not in the component body.

### Initial Render

The first render happens when the app root is mounted.

```tsx
createRoot(document.getElementById("root")!).render(<App />);
```

React calls the root component and builds the initial UI tree. Frameworks often hide this bootstrapping code, but the concept is the same.

After the initial render, updates happen when state, context, or parent rendering causes React to call components again.

### State Updates Trigger Renders

Calling a state setter schedules a render for that component.

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

When `setCount` runs, React schedules `Counter` to render again with the next state.

State updates should be immutable:

```tsx
setUser((current) => ({
  ...current,
  name: "Ava",
}));
```

Mutating existing state and passing the same reference can make changes hard for React and humans to reason about.

### Parent Renders and Child Renders

When a parent renders, React normally renders its children too.

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <>
      <button onClick={() => setCount((count) => count + 1)}>
        {count}
      </button>
      <Child />
    </>
  );
}
```

Clicking the button updates parent state, so `Parent` renders. `Child` is called again because it is part of the parent's output.

This is normal. A re-render is not automatically a performance problem. React still commits only the DOM changes that are needed.

If a child is expensive and often receives the same props, `memo` may help. But memoization is a performance optimization, not a correctness tool.

### Props and Context

Props are not updated independently. A child receives new props because its parent rendered and passed them.

```tsx
function Parent() {
  const [name, setName] = useState("Ava");
  return <Greeting name={name} />;
}
```

When `name` changes, `Parent` renders and passes a new `name` prop to `Greeting`.

Context can also trigger renders. If a component reads a context value and that provider value changes, React re-renders the consumers.

```tsx
const ThemeContext = createContext("light");

function ThemeLabel() {
  const theme = useContext(ThemeContext);
  return <span>{theme}</span>;
}
```

Large context values that change frequently can cause broad re-rendering. Split context by responsibility and update frequency when needed.

### State as a Snapshot

Each render sees a fixed snapshot of state.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log(count); // Old value from this render.
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

Calling `setCount` schedules a future render; it does not change the `count` variable in the current handler.

When the next value depends on previous state, use a functional update:

```tsx
setCount((current) => current + 1);
```

This is especially important when queueing multiple updates:

```tsx
setCount((current) => current + 1);
setCount((current) => current + 1);
setCount((current) => current + 1);
```

The final result is three increments.

### Batching

React batches multiple state updates during the same event so it can render once with the final result instead of rendering after every setter call.

```tsx
function handleClick() {
  setFirstName("Ava");
  setLastName("Nguyen");
  setStatus("saved");
}
```

React can process these together and render once.

Batching is good for performance, but it means you should not expect state variables in the current handler to immediately reflect the queued updates. Use functional updates when the next state depends on previous state.

### Derived Values

A derived value is calculated from props or state.

```tsx
function CartSummary({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return <p>Total: ${total.toFixed(2)}</p>;
}
```

`total` does not need to be state because it can be calculated during render from `items`.

Bad:

```tsx
const [items, setItems] = useState<CartItem[]>([]);
const [total, setTotal] = useState(0);
```

Now every item update must also update `total`. If one code path forgets, the UI becomes inconsistent.

### Avoiding Redundant State

Redundant state stores something already available from existing props or state.

Bad:

```tsx
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [fullName, setFullName] = useState("");
```

Better:

```tsx
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");

const fullName = `${firstName} ${lastName}`;
```

Derived values are recalculated when the component renders. This avoids extra state updates and prevents values from getting out of sync.

### Avoiding Duplicated State

Duplicated state stores the same information in multiple places.

Bad:

```tsx
const [items, setItems] = useState<Item[]>(initialItems);
const [selectedItem, setSelectedItem] = useState<Item | null>(initialItems[0]);
```

If an item is edited in `items`, `selectedItem` may still contain the old object. Better store the selected ID:

```tsx
const [items, setItems] = useState<Item[]>(initialItems);
const [selectedId, setSelectedId] = useState<string | null>(initialItems[0].id);

const selectedItem = items.find((item) => item.id === selectedId) ?? null;
```

Now the item data lives in one place, and the selection stores only the identity of the selected item.

### Avoiding Contradictory State

Contradictory state allows impossible combinations.

Bad:

```tsx
const [isSending, setIsSending] = useState(false);
const [isSent, setIsSent] = useState(false);
```

This can accidentally produce both `isSending` and `isSent` as `true`.

Better:

```tsx
type Status = "typing" | "sending" | "sent" | "error";

const [status, setStatus] = useState<Status>("typing");

const isSending = status === "sending";
const isSent = status === "sent";
```

One state variable represents the real finite states. Boolean flags are then derived during render.

### Mirroring Props in State

Mirroring props in state usually creates stale data.

Bad:

```tsx
function Message({ color }: { color: string }) {
  const [messageColor, setMessageColor] = useState(color);
  return <p style={{ color: messageColor }}>Hello</p>;
}
```

If the parent later passes a new `color`, the state does not automatically update. The initial state only uses the prop on the first render.

Better:

```tsx
function Message({ color }: { color: string }) {
  return <p style={{ color }}>Hello</p>;
}
```

Mirroring props is only appropriate when you intentionally want to capture the initial value and ignore later prop changes. Use names like `initialColor` or `defaultValue` to make that contract clear.

### You Might Not Need an Effect

Do not use effects to calculate values that can be calculated during render.

Bad:

```tsx
function Form({ firstName, lastName }: Props) {
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
  }, [firstName, lastName]);

  return <p>{fullName}</p>;
}
```

This causes an unnecessary render with stale `fullName`, then another render after the effect updates it.

Better:

```tsx
function Form({ firstName, lastName }: Props) {
  const fullName = `${firstName} ${lastName}`;
  return <p>{fullName}</p>;
}
```

Effects are for synchronizing with external systems, not for normal derived rendering.

### Expensive Derived Values

Most derived values should be calculated directly during render. If a calculation is expensive and inputs often do not change, use `useMemo`.

```tsx
function ProductList({
  products,
  query,
}: {
  products: Product[];
  query: string;
}) {
  const filteredProducts = useMemo(
    () => filterProducts(products, query),
    [products, query]
  );

  return <List products={filteredProducts} />;
}
```

`useMemo` caches a calculation result until its dependencies change. It is a performance optimization. The code should still be correct without it.

Do not use `useMemo` to fix incorrect data flow. First remove duplicated state and make the source of truth clear.

### Memoization and Re-renders

`memo` can skip re-rendering a component when its props are unchanged.

```tsx
const UserCard = memo(function UserCard({ user }: { user: User }) {
  return <h2>{user.name}</h2>;
});
```

Memoization helps only when:

- The component re-renders often with the same props.
- Rendering is expensive enough to matter.
- Props are stable.

This defeats `memo`:

```tsx
<UserCard user={{ id: user.id, name: user.name }} />
```

The object is new on every render. Prefer passing stable values or memoizing derived objects only when there is a real performance need.

### Identity and Re-renders

Objects, arrays, and functions created during render have new identity each time.

```tsx
function Parent({ user }: { user: User }) {
  const options = { showEmail: true };

  return <UserCard user={user} options={options} />;
}
```

If `UserCard` is memoized, the new `options` object can still cause it to re-render. Fixes include:

- Pass primitive props.
- Move object creation into the child if possible.
- Use `useMemo` when stable identity is actually needed.
- Avoid premature memoization if rendering is cheap.

### State Preservation and Reset

React preserves state while a component remains in the same position in the rendered tree. Changing a key tells React to treat it as a different component and reset its state.

```tsx
function UserEditor({ userId }: { userId: string }) {
  return <EditForm key={userId} userId={userId} />;
}
```

This is useful when changing `userId` should create a fresh form.

Avoid random keys:

```tsx
<EditForm key={Math.random()} />
```

That resets state every render and usually hides a data-flow problem.

### Common Mistakes

Common mistakes include:

- Treating every re-render as a bug.
- Storing values that can be calculated from props or state.
- Mirroring props in state without intending to ignore later prop updates.
- Keeping both selected object and selected ID in state.
- Keeping multiple booleans that can contradict each other.
- Using effects to calculate derived values.
- Adding `memo`, `useMemo`, or `useCallback` before fixing state design.
- Creating new object or function props and expecting `memo` to skip rendering.
- Using random keys to force state resets.
- Mutating state and expecting React to reliably detect meaningful changes.

### Best Practices

Use these rules of thumb:

- Store the minimal source of truth.
- Derive everything else during render when possible.
- Avoid duplicated and contradictory state.
- Use one status field for mutually exclusive states.
- Keep state flat when nested updates become awkward.
- Use functional state updates when next state depends on previous state.
- Use effects for external synchronization, not normal derived data.
- Treat memoization as a performance optimization, not a correctness fix.
- Use stable keys to intentionally preserve or reset state.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What triggers a React component to render?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q01 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A component renders initially when the app is mounted. After that, a component can render because its state was updated, because its parent rendered and included it, or because a context value it reads changed.

Rendering means React calls the component function to calculate what the UI should look like. It does not always mean the browser DOM changes. React commits only the necessary DOM updates after rendering.

##### Key Points to Mention

- Initial render happens when the app starts.
- State updates trigger renders.
- Parent renders usually call child components again.
- Context changes can re-render consumers.
- Rendering is calculating UI, not necessarily changing the DOM.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q01 -->

#### What is derived state?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q02 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Derived state is a value that can be calculated from existing props or state. In many cases, it should not be stored as state.

```tsx
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");

const fullName = `${firstName} ${lastName}`;
```

`fullName` is derived from `firstName` and `lastName`. Storing it separately would create another source of truth and could get out of sync.

##### Key Points to Mention

- Derived values come from props or state.
- They often do not belong in state.
- Calculate simple derived values during render.
- Avoid extra state updates for derived data.
- Derived state can create synchronization bugs if duplicated.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q02 -->

#### Why is duplicated state risky?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q03 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Duplicated state stores the same information in multiple places. It is risky because one copy can update while another copy stays stale.

```tsx
const [items, setItems] = useState(initialItems);
const [selectedItem, setSelectedItem] = useState(initialItems[0]);
```

If the item is edited in `items`, `selectedItem` may still point to old data. A better model is to store `selectedId` and derive the selected item from the current items array.

##### Key Points to Mention

- Duplicated state creates multiple sources of truth.
- Copies can get out of sync.
- Store IDs instead of duplicated objects when possible.
- Derive related data during render.
- State should be minimal and normalized enough for the use case.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q03 -->

#### What does it mean that state is a snapshot?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q04 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Each render sees a fixed snapshot of state. Calling a state setter schedules a future render; it does not immediately change the state variable in the current handler.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log(count); // Old value.
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

If the next value depends on the previous one, use a functional update: `setCount((current) => current + 1)`.

##### Key Points to Mention

- State variables are fixed for a render.
- Setters schedule a later render.
- Logs after setters show the old snapshot.
- Functional updates use the latest queued value.
- Snapshot behavior affects event handlers and batching.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why should you avoid mirroring props in state?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q01 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Mirroring props in state usually creates stale data. The initial state uses the prop only on the first render. If the parent later passes a different prop value, the local state does not automatically update.

```tsx
function Message({ color }: { color: string }) {
  const [messageColor, setMessageColor] = useState(color);
  return <p style={{ color: messageColor }}>Hello</p>;
}
```

If the component should follow the prop, use the prop directly. Mirroring only makes sense when intentionally capturing an initial value and ignoring future changes. In that case, names like `initialColor` or `defaultColor` make the behavior clearer.

##### Key Points to Mention

- Initial state from props is only used on first render.
- Later prop changes do not update local state automatically.
- Use props directly when the UI should follow the parent.
- Use `initial` or `default` naming when ignoring future prop updates.
- Mirroring often creates synchronization bugs.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q01 -->

#### How should mutually exclusive UI states be modeled?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q02 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use one state variable that represents the allowed states instead of several booleans that can contradict each other.

Bad:

```tsx
const [isLoading, setIsLoading] = useState(false);
const [isSuccess, setIsSuccess] = useState(false);
const [isError, setIsError] = useState(false);
```

Better:

```tsx
type Status = "idle" | "loading" | "success" | "error";
const [status, setStatus] = useState<Status>("idle");
```

Then derive booleans as needed:

```tsx
const isLoading = status === "loading";
```

This prevents impossible combinations and makes transitions easier to reason about.

##### Key Points to Mention

- Multiple booleans can contradict each other.
- One status value can model finite states.
- Derived booleans do not need separate state.
- TypeScript unions can enforce valid states.
- This improves reducers, forms, and async UI.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q02 -->

#### When should you use `useMemo` for derived data?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q03 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `useMemo` when a derived calculation is expensive and its inputs often stay the same between renders, or when a stable derived reference is needed for a memoized child or Hook dependency.

```tsx
const visibleTodos = useMemo(
  () => filterTodos(todos, tab),
  [todos, tab]
);
```

Do not use `useMemo` for every derived value. Simple calculations should be done directly during render. `useMemo` is a performance optimization, not a correctness mechanism. The code should still work correctly if `useMemo` is removed.

##### Key Points to Mention

- Use it for expensive calculations.
- Dependencies control when it recalculates.
- It can help with stable references.
- It is not needed for simple values.
- It should not fix incorrect state design.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q03 -->

#### Why can using an effect for derived state be a problem?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q04 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Using an effect to calculate derived state often causes an unnecessary extra render and can briefly show stale data. If a value can be calculated from props or state during render, calculate it directly.

Bad:

```tsx
const [fullName, setFullName] = useState("");

useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);
```

Better:

```tsx
const fullName = `${firstName} ${lastName}`;
```

Effects should generally synchronize with external systems, not perform ordinary render-time calculations.

##### Key Points to Mention

- Derived state in effects causes extra renders.
- It can show stale values before the effect runs.
- Calculate from props or state during render when possible.
- Effects are for external synchronization.
- This simplification reduces bugs and code.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you debug an unexpected re-render?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q01 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

First determine whether the re-render is actually harmful. Re-rendering is normal in React. If it is causing visible slowness or incorrect behavior, identify the trigger: local state update, parent render, context value change, key change, or external store update.

Then inspect props and identities. New object, array, or function props created during render can make memoized children render again. Context provider values created inline can re-render all consumers. Random or changing keys can reset state.

Use React DevTools Profiler, focused console logging, and component boundaries to isolate the issue. Fix state ownership and derived state first; add `memo`, `useMemo`, or `useCallback` only when they solve a measured or obvious performance problem.

##### Key Points to Mention

- Re-rendering is normal, not automatically a bug.
- Identify state, parent, context, or key triggers.
- Check unstable object and function props.
- Check context provider value identity.
- Optimize after fixing data flow.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q01 -->

#### How does `memo` interact with parent re-renders?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q02 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Normally, when a parent renders, its children render too. `memo` can let a child skip re-rendering when its props are unchanged. By default, React compares props using identity-oriented comparisons.

```tsx
const UserCard = memo(function UserCard({ user }: { user: User }) {
  return <h2>{user.name}</h2>;
});
```

`memo` is useful only when the component renders often with the same props and rendering is expensive enough to matter. It is ineffective if props are always new, such as object literals or inline functions created during every parent render.

It should not be used to fix incorrect rendering logic. The component must be correct without memoization.

##### Key Points to Mention

- Parent renders normally call children.
- `memo` can skip child renders with unchanged props.
- New object and function props can defeat memoization.
- It is a performance optimization.
- Correctness should not depend on `memo`.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q02 -->

#### How would you redesign state that stores both selected object and selected ID?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q03 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Store the collection and the selected ID, then derive the selected object during render.

Bad:

```tsx
const [items, setItems] = useState(initialItems);
const [selectedItem, setSelectedItem] = useState(initialItems[0]);
```

Better:

```tsx
const [items, setItems] = useState(initialItems);
const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);

const selectedItem = items.find((item) => item.id === selectedId) ?? null;
```

This removes duplicated item data. If an item is edited in `items`, the derived `selectedItem` reflects the latest version automatically.

##### Key Points to Mention

- Store identity instead of duplicating object data.
- Derive the selected object from current items.
- This avoids stale selected objects.
- It creates one source of truth.
- It works well with normalized collections.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q03 -->

#### How do keys affect re-rendering and state reset?

<!-- question:start:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q04 -->
<!-- question-id:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Keys help React identify components among siblings. Stable keys let React preserve the right component state across list changes. Changing a key tells React to treat the element as a different component, which resets its state.

Intentional reset:

```tsx
<EditForm key={userId} userId={userId} />
```

This is useful when switching users should create a fresh form. Bad reset:

```tsx
<EditForm key={Math.random()} />
```

A random key changes every render and destroys state repeatedly. Keys should come from stable identity in the data, not render-time randomness.

##### Key Points to Mention

- Keys identify siblings across renders.
- Stable keys preserve state correctly.
- Changing a key resets component state.
- IDs from data are usually good keys.
- Random keys cause constant remounting.

<!-- question:end:rerender-triggers-derived-state-and-avoiding-duplicated-state-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
