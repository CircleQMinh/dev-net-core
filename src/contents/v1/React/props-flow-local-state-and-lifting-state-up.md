---
id: props-flow-local-state-and-lifting-state-up
topic: Components, props, state, and rendering behavior
subtopic: Props flow, local state, and lifting state up
category: React
---

## Overview

Props flow, local state, and lifting state up describe how data moves through a React component tree. Props are inputs passed from parent components to child components. Local state is data a component remembers between renders. Lifting state up means moving shared state to the closest common parent so multiple components can stay synchronized.

React's data model is intentionally directional: parents pass data down through props, and children communicate changes by calling callbacks passed down from parents.

```tsx
function Parent() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <UserList
      selectedId={selectedId}
      onSelectUser={setSelectedId}
    />
  );
}
```

This topic matters in interviews because many React bugs come from putting state in the wrong place. A candidate should understand when data should be a prop, when it should be local state, when it should be derived during render, when state should be lifted to a parent, and when context or a state library may be appropriate.

The practical goal is to keep data flow predictable: one clear owner for each piece of state, minimal duplicated state, immutable updates, and components that receive the data and event handlers they need.

## Core Concepts

### Props

Props are inputs to a component. A parent passes props, and the child reads them.

```tsx
type UserCardProps = {
  name: string;
  email: string;
};

function UserCard({ name, email }: UserCardProps) {
  return (
    <article>
      <h2>{name}</h2>
      <p>{email}</p>
    </article>
  );
}

function UserPage() {
  return <UserCard name="Ava" email="ava@example.com" />;
}
```

Props should be treated as read-only. A child should not mutate props. If something needs to change, the component that owns the state should update it and pass the new value down.

### One-Way Data Flow

React data typically flows from parent to child.

```tsx
function App() {
  const user = {
    name: "Ava",
    role: "Admin",
  };

  return <Profile user={user} />;
}

function Profile({ user }: { user: { name: string; role: string } }) {
  return <h1>{user.name}</h1>;
}
```

The parent owns the data and decides what the child receives. The child renders based on those props.

Children communicate events upward by calling callback props:

```tsx
function SaveButton({ onSave }: { onSave: () => void }) {
  return <button onClick={onSave}>Save</button>;
}
```

This keeps data ownership explicit. The child does not directly modify parent state; it requests a change by calling a function.

### Local State

Local state is data a component remembers between renders.

```tsx
import { useState } from "react";

function ExpandablePanel({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section>
      <button onClick={() => setIsOpen((open) => !open)}>
        {title}
      </button>
      {isOpen && <div>{children}</div>}
    </section>
  );
}
```

This state is local because only `ExpandablePanel` needs to know whether it is open.

Good candidates for local state:

- Input draft text.
- Whether a menu is open.
- Which tab is selected inside a self-contained widget.
- Temporary UI-only state.
- Hover or focus-related UI state when CSS is not enough.

Poor candidates for local state:

- Data that multiple sibling components need.
- Data already available from props.
- Values that can be derived from other state.
- Server data that should be cached or synchronized by a data layer.

### State as a Snapshot

State values behave like snapshots for a particular render. Calling a state setter does not change the variable in the current render; it schedules a future render with a new state value.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log(count); // Still the old value for this render.
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

If the next value depends on the previous value, use a functional update:

```tsx
setCount((current) => current + 1);
```

This matters when queueing multiple updates:

```tsx
setCount((current) => current + 1);
setCount((current) => current + 1);
setCount((current) => current + 1);
```

The result is three increments.

### State Updates Trigger Rendering

When a component's state changes, React schedules a re-render of that component and its children.

```tsx
function Toggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <button onClick={() => setEnabled((value) => !value)}>
      {enabled ? "On" : "Off"}
    </button>
  );
}
```

Do not mutate state directly:

```tsx
user.name = "Ava";
setUser(user);
```

Create a new value:

```tsx
setUser((current) => ({
  ...current,
  name: "Ava",
}));
```

React relies on state identity to detect changes. Immutable updates make rendering predictable.

### Derived Values vs Stored State

If a value can be calculated from props or state during render, it often should not be stored separately.

Avoid duplicated state:

```tsx
const [firstName, setFirstName] = useState("Ava");
const [lastName, setLastName] = useState("Nguyen");
const [fullName, setFullName] = useState("Ava Nguyen");
```

Better:

```tsx
const [firstName, setFirstName] = useState("Ava");
const [lastName, setLastName] = useState("Nguyen");

const fullName = `${firstName} ${lastName}`;
```

Storing derived state creates synchronization bugs. If one source updates and the derived state does not, the UI becomes inconsistent.

Store state when the value cannot be derived, or when derivation is expensive enough to memoize. Even then, prefer `useMemo` for expensive derived values rather than another state variable.

### Choosing Where State Lives

State should live in the component that owns it. A good rule:

- If only one component needs it, keep it local.
- If a parent needs to control it, put it in the parent.
- If siblings need it, lift it to their closest common parent.
- If many distant components need it, consider context or an external store.

Example:

```tsx
function SearchBox() {
  const [query, setQuery] = useState("");

  return (
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
    />
  );
}
```

This is fine if the query only matters inside `SearchBox`.

If another component needs the query, move it up:

```tsx
function SearchPage() {
  const [query, setQuery] = useState("");

  return (
    <>
      <SearchInput value={query} onChange={setQuery} />
      <SearchResults query={query} />
    </>
  );
}
```

### Lifting State Up

Lifting state up means moving state from a child component to a common parent so multiple components can share it.

Before lifting:

```tsx
function TemperatureInput() {
  const [temperature, setTemperature] = useState("");

  return (
    <input
      value={temperature}
      onChange={(event) => setTemperature(event.target.value)}
    />
  );
}
```

If another component needs the same temperature, the state belongs higher:

```tsx
function TemperatureCalculator() {
  const [temperature, setTemperature] = useState("");

  return (
    <>
      <TemperatureInput
        value={temperature}
        onChange={setTemperature}
      />
      <TemperaturePreview temperature={temperature} />
    </>
  );
}
```

Now both children receive consistent data from the same owner.

### Controlled Components

A controlled component receives its value and change handler from its parent.

```tsx
function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
```

The parent owns the state:

```tsx
function SearchPage() {
  const [query, setQuery] = useState("");

  return (
    <>
      <SearchInput value={query} onChange={setQuery} />
      <SearchResults query={query} />
    </>
  );
}
```

Controlled components are predictable because the source of truth is outside the child.

### Uncontrolled Local State

A component can manage its own state internally when no parent needs to coordinate it.

```tsx
function ToggleDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button onClick={() => setOpen((value) => !value)}>
        {open ? "Hide" : "Show"}
      </button>
      {open && children}
    </section>
  );
}
```

This is simpler than forcing every parent to manage `open`.

A reusable component may support both controlled and uncontrolled modes, but that increases complexity. Use this pattern carefully and document it clearly.

### Callback Props

Callback props let children notify parents about events.

```tsx
function UserRow({
  user,
  onSelect,
}: {
  user: User;
  onSelect: (id: string) => void;
}) {
  return (
    <button onClick={() => onSelect(user.id)}>
      {user.name}
    </button>
  );
}
```

The child does not know what selecting means. The parent decides:

```tsx
function UserTable({ users }: { users: User[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return users.map((user) => (
    <UserRow
      key={user.id}
      user={user}
      onSelect={setSelectedId}
    />
  ));
}
```

Naming matters. Use domain names when possible:

```tsx
onSelectUser
onSubmitOrder
onCloseDialog
```

This is clearer than generic names like `onClick` when the child represents a domain action.

### Props Drilling

Props drilling means passing props through intermediate components that do not use them, only to reach a deeply nested child.

```tsx
function App() {
  return <Page user={user} />;
}

function Page({ user }: { user: User }) {
  return <Layout user={user} />;
}

function Layout({ user }: { user: User }) {
  return <UserMenu user={user} />;
}
```

Props drilling is not automatically bad. A few levels can be explicit and easy to understand. It becomes a problem when many unrelated layers forward the same values, making components noisy and tightly coupled.

Solutions include:

- Component composition.
- Moving the consuming component closer to the data owner.
- Context for widely needed values.
- External state stores for complex global state.

### State Colocation

State colocation means keeping state as close as possible to where it is used.

Good:

```tsx
function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <input type={visible ? "text" : "password"} />
      <button onClick={() => setVisible((value) => !value)}>
        Toggle
      </button>
    </>
  );
}
```

The parent does not need to know whether this one password field is visible.

State should be lifted only when sharing or coordination requires it. Over-lifting state can cause unnecessary re-renders, larger components, and less reusable children.

### Avoiding Duplicated State

Duplicated state means storing the same information in multiple places.

Bad:

```tsx
const [selectedUser, setSelectedUser] = useState<User | null>(null);
const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
```

If both represent the same selection, they can become inconsistent.

Better:

```tsx
const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
```

Store the minimal source of truth and derive the rest during render.

### Resetting State

State is tied to a component's position in the rendered tree. If a component remains in the same position, React usually preserves its state. If it is removed or rendered with a different key, state may reset.

You can intentionally reset child state with a key:

```tsx
function UserEditor({ userId }: { userId: string }) {
  return <EditForm key={userId} userId={userId} />;
}
```

This tells React that a different `userId` should create a fresh form.

Do not use random keys to force resets:

```tsx
<EditForm key={Math.random()} />
```

That destroys state on every render and usually indicates a design problem.

### When to Use Context Instead

Lifting state up works well for nearby components. If data is needed by many distant components, context may be a better fit.

Good context candidates:

- Current authenticated user.
- Theme.
- Locale.
- Feature flags.
- Shared app shell configuration.

Poor context candidates:

- Highly local input state.
- Rapidly changing per-row state in large lists.
- State used by only one or two nearby components.

Context is not a replacement for all props. Props remain the clearest way to pass explicit component inputs.

### Common Mistakes

Common mistakes include:

- Mutating props or state directly.
- Duplicating derived values in state.
- Keeping state too low when siblings need it.
- Lifting state too high when only one component uses it.
- Using context for every shared value.
- Passing generic callbacks with unclear names.
- Forgetting that state updates are scheduled, not immediate variable changes.
- Reading stale state when multiple updates depend on previous values.
- Making a reusable component support both controlled and uncontrolled modes without a clear API.
- Passing whole objects when children only need a few fields.

### Best Practices

Use these rules of thumb:

- Treat props as read-only.
- Keep state close to where it is used.
- Lift state to the closest common parent when components need to coordinate.
- Store the minimal source of truth.
- Derive values during render when possible.
- Use functional updates when the next state depends on previous state.
- Use callback props for child-to-parent communication.
- Prefer explicit props before reaching for context.
- Use context for cross-cutting values shared across distant parts of the tree.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are props in React?

<!-- question:start:props-flow-local-state-and-lifting-state-up-beginner-q01 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Props are inputs passed from a parent component to a child component. They let the parent configure what the child renders or how it behaves.

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}

function App() {
  return <Greeting name="Ava" />;
}
```

Props should be treated as read-only. A child should not mutate props. If the data needs to change, the state owner should update it and pass new props down.

##### Key Points to Mention

- Props are component inputs.
- Props flow from parent to child.
- Props are read-only from the child's perspective.
- Props can include values, objects, functions, and JSX.
- Updating data should happen through the state owner.

<!-- question:end:props-flow-local-state-and-lifting-state-up-beginner-q01 -->

#### What is local state?

<!-- question:start:props-flow-local-state-and-lifting-state-up-beginner-q02 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Local state is data a component remembers between renders. In functional components, it is commonly created with `useState`.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount((value) => value + 1)}>
      {count}
    </button>
  );
}
```

State is local when only that component needs it. Examples include whether a menu is open, a draft input value, or the selected tab inside a self-contained component.

##### Key Points to Mention

- State is remembered between renders.
- `useState` is the common Hook for local state.
- Updating state schedules a re-render.
- Local state is best when only one component needs the data.
- State should be updated immutably.

<!-- question:end:props-flow-local-state-and-lifting-state-up-beginner-q02 -->

#### What does one-way data flow mean?

<!-- question:start:props-flow-local-state-and-lifting-state-up-beginner-q03 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

One-way data flow means data usually moves down the component tree from parent to child through props. Children do not directly change parent data. Instead, they call callback props when something happens, and the parent decides how to update state.

```tsx
function Child({ onSelect }: { onSelect: () => void }) {
  return <button onClick={onSelect}>Select</button>;
}
```

This keeps ownership clear. The parent owns the data, passes values down, and passes functions down for child-to-parent communication.

##### Key Points to Mention

- Data flows from parent to child through props.
- Children communicate upward with callback props.
- The state owner decides how to update state.
- One-way flow makes changes easier to trace.
- This is core to React's predictable data model.

<!-- question:end:props-flow-local-state-and-lifting-state-up-beginner-q03 -->

#### What does lifting state up mean?

<!-- question:start:props-flow-local-state-and-lifting-state-up-beginner-q04 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Lifting state up means moving state from a child component to a common parent so multiple components can share and coordinate around the same value.

For example, if a search input and search results both need the current query, the query should live in their parent:

```tsx
function SearchPage() {
  const [query, setQuery] = useState("");

  return (
    <>
      <SearchInput value={query} onChange={setQuery} />
      <SearchResults query={query} />
    </>
  );
}
```

This creates one source of truth instead of duplicated state in multiple children.

##### Key Points to Mention

- Move shared state to a common parent.
- Use props to pass the value down.
- Use callback props to update the value.
- Lifting avoids duplicated inconsistent state.
- Lift only as high as necessary.

<!-- question:end:props-flow-local-state-and-lifting-state-up-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you decide whether state should be local or lifted?

<!-- question:start:props-flow-local-state-and-lifting-state-up-intermediate-q01 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Start by asking who needs the data. If only one component needs it, keep it local. If siblings need to stay synchronized, lift it to their closest common parent. If a parent needs to control the value, keep it in the parent and pass it down. If many distant components need the value, consider context or a store.

The goal is to place state at the lowest component that can own it correctly. State that is too low causes duplication and synchronization bugs. State that is too high makes parents too large and can cause unnecessary rendering.

##### Key Points to Mention

- State should have one clear owner.
- Keep state close to where it is used.
- Lift to the closest common parent for shared state.
- Avoid lifting state all the way to the app root by default.
- Use context only when prop passing becomes the wrong shape.

<!-- question:end:props-flow-local-state-and-lifting-state-up-intermediate-q01 -->

#### What is derived state, and why can it be a problem?

<!-- question:start:props-flow-local-state-and-lifting-state-up-intermediate-q02 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Derived state is state that can be calculated from existing props or state. It becomes a problem when stored separately because it can get out of sync with its source.

Bad:

```tsx
const [firstName, setFirstName] = useState("Ava");
const [lastName, setLastName] = useState("Nguyen");
const [fullName, setFullName] = useState("Ava Nguyen");
```

Better:

```tsx
const fullName = `${firstName} ${lastName}`;
```

Store the minimal source of truth and derive the rest during render. Use memoization for expensive derived calculations, not separate state by default.

##### Key Points to Mention

- Derived values can be calculated from existing data.
- Storing derived values creates sync risk.
- Keep one source of truth.
- Calculate simple derived values during render.
- Use memoization for expensive derivations when needed.

<!-- question:end:props-flow-local-state-and-lifting-state-up-intermediate-q02 -->

#### Why are state updates sometimes described as snapshots?

<!-- question:start:props-flow-local-state-and-lifting-state-up-intermediate-q03 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Each render sees a snapshot of state for that render. Calling a state setter schedules a new render; it does not change the local state variable immediately inside the current event handler or render.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log(count); // Logs the old value.
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

When the next state depends on the previous state, use a functional update:

```tsx
setCount((current) => current + 1);
```

##### Key Points to Mention

- A render sees a fixed state snapshot.
- Setters schedule future renders.
- The current variable does not update immediately.
- Functional updates avoid stale values.
- This matters when queueing multiple updates.

<!-- question:end:props-flow-local-state-and-lifting-state-up-intermediate-q03 -->

#### What is a controlled component?

<!-- question:start:props-flow-local-state-and-lifting-state-up-intermediate-q04 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A controlled component receives its value and change handler from a parent. The parent owns the state, and the child reflects that state through props.

```tsx
function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
```

Controlled components are useful when a parent needs to validate, reset, submit, synchronize, or share the value with other components.

##### Key Points to Mention

- Parent owns the value.
- Child receives value and change callback.
- Common for forms and reusable inputs.
- Controlled components make synchronization explicit.
- They can be more verbose than local uncontrolled state.

<!-- question:end:props-flow-local-state-and-lifting-state-up-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you refactor two sibling components with duplicated state?

<!-- question:start:props-flow-local-state-and-lifting-state-up-advanced-q01 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

First identify the shared source of truth. If two siblings each store their own copy of the same value, move that value to their closest common parent. Then pass the value down as props and pass callback props down for updates.

For example, if `SearchInput` and `SearchResults` both need `query`, `SearchPage` should own `query`. `SearchInput` receives `value` and `onChange`; `SearchResults` receives `query`.

This removes duplicated state and makes the data flow traceable. If the parent becomes too large, extract smaller presentational children while keeping ownership clear.

##### Key Points to Mention

- Identify the single source of truth.
- Lift shared state to the closest common parent.
- Pass values down with props.
- Pass updates up with callbacks.
- Keep the lifted state no higher than necessary.

<!-- question:end:props-flow-local-state-and-lifting-state-up-advanced-q01 -->

#### When is prop drilling acceptable, and when should you consider context?

<!-- question:start:props-flow-local-state-and-lifting-state-up-advanced-q02 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Prop drilling is acceptable when the chain is short, the data flow is clear, and the intermediate components are still understandable. Explicit props are often easier to trace than hidden global access.

Consider context when many distant components need the same value and passing it through intermediate layers creates noise or coupling. Good context examples include theme, locale, authenticated user, feature flags, and app shell configuration.

Context should not be the default for every shared value. Local state, lifted state, and composition often solve the problem with less global coupling.

##### Key Points to Mention

- Prop drilling is not automatically bad.
- Explicit props are easy to trace.
- Context helps with distant cross-cutting data.
- Avoid context for highly local state.
- Composition can sometimes remove prop drilling without context.

<!-- question:end:props-flow-local-state-and-lifting-state-up-advanced-q02 -->

#### What are the risks of lifting state too high?

<!-- question:start:props-flow-local-state-and-lifting-state-up-advanced-q03 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Lifting state too high can make parent components large and hard to reason about. It can cause unrelated children to receive props they do not need, increase re-render scope, and reduce component reuse. It can also turn simple local UI state into application-level coordination.

For example, a password visibility toggle should usually stay inside the password field. Moving it to a page-level component adds noise without improving coordination.

The better rule is to colocate state by default and lift it only when another component genuinely needs to read or update it.

##### Key Points to Mention

- Over-lifting makes parents bloated.
- It can increase prop noise.
- It can widen re-render scope.
- Local UI state should often remain local.
- Lift state only when coordination requires it.

<!-- question:end:props-flow-local-state-and-lifting-state-up-advanced-q03 -->

#### How would you design a reusable component that can be controlled or uncontrolled?

<!-- question:start:props-flow-local-state-and-lifting-state-up-advanced-q04 -->
<!-- question-id:props-flow-local-state-and-lifting-state-up-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

A controlled-or-uncontrolled component can either receive its state from a parent or manage state internally. For example, a disclosure component might accept `open` and `onOpenChange` for controlled usage, or `defaultOpen` for uncontrolled usage.

```tsx
type DisclosureProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};
```

The implementation should choose one source of truth. If `open` is provided, use it as controlled state and call `onOpenChange` when the user requests a change. If `open` is not provided, manage internal state initialized from `defaultOpen`.

This pattern is powerful but more complex. It should be used for reusable library-style components, not for every application component.

##### Key Points to Mention

- Controlled mode receives `value` or `open` from parent.
- Uncontrolled mode manages internal state.
- `defaultValue` or `defaultOpen` initializes uncontrolled state.
- Avoid switching between controlled and uncontrolled modes.
- Use this pattern only when the flexibility is worth the complexity.

<!-- question:end:props-flow-local-state-and-lifting-state-up-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
