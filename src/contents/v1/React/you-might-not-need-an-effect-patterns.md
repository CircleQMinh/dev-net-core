---
id: you-might-not-need-an-effect-patterns
topic: Hooks, effects, and custom hooks
subtopic: “You might not need an effect” patterns
category: React
---

## Overview

"You might not need an effect" is a React design principle: use effects for synchronization with external systems, not for ordinary data flow inside React. An external system might be a browser API, a network connection, a timer, a subscription, a non-React widget, analytics, or imperative DOM integration.

Many effects in React applications are unnecessary because they are trying to do work that can happen during rendering or in an event handler. Removing those effects usually makes code simpler, faster, and less bug-prone.

Bad pattern:

```tsx
function Form({ firstName, lastName }: Props) {
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
  }, [firstName, lastName]);

  return <p>{fullName}</p>;
}
```

Better:

```tsx
function Form({ firstName, lastName }: Props) {
  const fullName = `${firstName} ${lastName}`;

  return <p>{fullName}</p>;
}
```

For interviews, this topic matters because it shows whether a developer understands React's rendering model. A strong candidate should be able to explain when to derive values during render, when to handle logic directly in event handlers, when to reset state with a key, when to store IDs instead of duplicated objects, and when an effect is genuinely appropriate.

The practical goal is to use effects as escape hatches, not as a default way to coordinate React state.

## Core Concepts

### Effects Are for External Synchronization

Use an effect when a component needs to synchronize with something outside React.

Good effect example:

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

This is appropriate because a network connection exists outside React. The effect starts synchronization, and the cleanup stops it.

Common external systems:

- Browser events.
- Timers.
- WebSocket or SignalR connections.
- Third-party widgets.
- Imperative APIs.
- Subscriptions.
- Analytics that should run because a screen appeared.
- Client-side data fetching when no framework or data library owns it.

If there is no external system, pause before writing an effect.

### Pattern: Calculate Derived Values During Render

If a value can be calculated from props or state, calculate it during render.

Bad:

```tsx
function InvoiceSummary({ items }: { items: InvoiceItem[] }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setTotal(items.reduce((sum, item) => sum + item.price, 0));
  }, [items]);

  return <p>Total: {total}</p>;
}
```

Better:

```tsx
function InvoiceSummary({ items }: { items: InvoiceItem[] }) {
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return <p>Total: {total}</p>;
}
```

The effect version renders once with stale `total`, then renders again after the effect sets state. The render-time calculation is simpler and avoids an extra render pass.

Good derived values:

- `fullName` from `firstName` and `lastName`.
- `total` from cart items.
- `isValid` from form fields.
- `visibleItems` from items and a filter.
- `selectedItem` from `items` and `selectedId`.

### Pattern: Use `useMemo` for Expensive Pure Calculations

Most derived calculations should just run during render. If a pure calculation is noticeably expensive and its inputs often stay the same, cache it with `useMemo`.

```tsx
function TodoList({
  todos,
  filter,
}: {
  todos: Todo[];
  filter: string;
}) {
  const visibleTodos = useMemo(
    () => getFilteredTodos(todos, filter),
    [todos, filter]
  );

  return <List items={visibleTodos} />;
}
```

Use `useMemo` for performance, not correctness. The component should still behave correctly if the calculation runs every render.

Avoid this:

```tsx
const [visibleTodos, setVisibleTodos] = useState<Todo[]>([]);

useEffect(() => {
  setVisibleTodos(getFilteredTodos(todos, filter));
}, [todos, filter]);
```

That creates redundant state and an unnecessary effect.

### Pattern: Put Event-Specific Logic in Event Handlers

If logic happens because the user did something, put it in the event handler.

Bad:

```tsx
function ProductPage({ product }: { product: Product }) {
  const [isInCart, setIsInCart] = useState(false);

  useEffect(() => {
    if (isInCart) {
      showNotification(`${product.name} added to cart`);
    }
  }, [isInCart, product.name]);

  return (
    <button onClick={() => setIsInCart(true)}>
      Add to cart
    </button>
  );
}
```

Better:

```tsx
function ProductPage({ product }: { product: Product }) {
  function handleAddToCart() {
    addToCart(product.id);
    showNotification(`${product.name} added to cart`);
  }

  return (
    <button onClick={handleAddToCart}>
      Add to cart
    </button>
  );
}
```

The notification should happen because the user clicked the button, not because the component later observed a state value.

Event-handler logic includes:

- Submitting forms.
- Showing user-action notifications.
- Navigating after a click.
- Starting a checkout flow.
- Updating state in response to input.
- Calling a parent callback.

### Pattern: Reset State with a Key

If changing a prop means a subtree should be treated as a different instance, use a key.

Bad:

```tsx
function ProfilePage({ userId }: { userId: string }) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    setComment("");
  }, [userId]);

  return <CommentBox value={comment} onChange={setComment} />;
}
```

This renders once with the old comment, then clears it after the effect runs.

Better:

```tsx
function ProfilePage({ userId }: { userId: string }) {
  return <Profile key={userId} userId={userId} />;
}

function Profile({ userId }: { userId: string }) {
  const [comment, setComment] = useState("");

  return <CommentBox value={comment} onChange={setComment} />;
}
```

Changing the key tells React that this is a different profile instance, so local state below it resets naturally.

Use this when the identity of a screen, form, or subtree truly changes.

### Pattern: Store IDs Instead of Duplicated Objects

If you store both a collection and a selected object from that collection, the selected object can become stale.

Bad:

```tsx
const [items, setItems] = useState(initialItems);
const [selectedItem, setSelectedItem] = useState(initialItems[0]);
```

Better:

```tsx
const [items, setItems] = useState(initialItems);
const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);

const selectedItem =
  items.find((item) => item.id === selectedId) ?? null;
```

Now item data has one source of truth, and selection is derived from the current list.

This often removes effects like:

```tsx
useEffect(() => {
  setSelectedItem(null);
}, [items]);
```

Instead of adjusting duplicated state, store a stable identity and derive the object.

### Pattern: Avoid Chains of Effects

A chain of effects is when one effect updates state, which triggers another effect, which updates more state.

Bad:

```tsx
useEffect(() => {
  if (card !== null) {
    setGoldCardCount((count) => count + 1);
  }
}, [card]);

useEffect(() => {
  if (goldCardCount > 3) {
    setRound(round + 1);
  }
}, [goldCardCount, round]);
```

This makes the flow indirect and can create extra renders. Prefer calculating the next values in the event handler or reducer that knows what happened.

Better:

```tsx
function handleCardDrawn(card: Card) {
  setState((state) => {
    const nextGoldCount =
      card.kind === "gold" ? state.goldCardCount + 1 : state.goldCardCount;

    return {
      ...state,
      card,
      goldCardCount: nextGoldCount,
      round: nextGoldCount > 3 ? state.round + 1 : state.round,
    };
  });
}
```

When state transitions are related, keep them in one event handler or reducer.

### Pattern: Notify Parents from the Event That Changed the Value

If a child changes a value and the parent needs to know, call the parent callback from the event handler.

```tsx
function Toggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onCheckedChange(event.currentTarget.checked);
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={handleChange}
    />
  );
}
```

Avoid this pattern:

```tsx
useEffect(() => {
  onCheckedChange(checked);
}, [checked, onCheckedChange]);
```

The parent callback should usually be part of the event flow, not a reaction to a later render.

### Pattern: Initialize State Correctly

If initial state is expensive, pass an initializer function to `useState`.

```tsx
const [todos, setTodos] = useState(() => loadInitialTodos());
```

Do not initialize with an effect unless the initialization depends on an external system that must happen after render.

Bad:

```tsx
const [todos, setTodos] = useState<Todo[]>([]);

useEffect(() => {
  setTodos(loadInitialTodos());
}, []);
```

Better:

```tsx
const [todos, setTodos] = useState(() => loadInitialTodos());
```

For values based on props, be clear whether the prop is an initial value or a controlled value.

```tsx
function Editor({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
}
```

The name `initialText` communicates that later prop changes are not expected to overwrite local edits.

### Pattern: Split Actual Effects by Purpose

Sometimes you do need effects, but one effect is doing multiple unrelated jobs.

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

Each effect should describe one synchronization process. This makes dependencies and cleanup easier to reason about.

### Data Fetching Nuance

Fetching in an effect can be acceptable for simple client-only components:

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

However, data fetching is often better handled by framework loaders, server rendering, server components, route-level APIs, or client data libraries that provide caching, deduplication, race handling, and preloading.

Interview answer: effects can fetch data, but manual effect fetching is not automatically the best production data-loading architecture.

### Decision Checklist

Before adding an effect, ask:

- Is there an external system involved?
- Can this value be calculated during render?
- Is this logic caused by a user event?
- Can state be reset with a key?
- Can duplicated state be replaced with an ID or derived value?
- Are multiple related state updates better handled in one event handler or reducer?
- Should this be a custom hook because it synchronizes with an external system?
- Is a framework or data library a better home for data fetching?

If the answer does not involve external synchronization, the effect may be unnecessary.

### Common Mistakes

Common mistakes include:

- Using effects to calculate `fullName`, totals, filtered lists, or validation booleans.
- Updating state in an effect immediately after render when the value could be derived.
- Moving event-specific logic into effects.
- Resetting state on prop change with an effect instead of a key.
- Storing duplicated objects and trying to sync them with effects.
- Chaining effects that update each other's dependencies.
- Suppressing the dependency linter instead of changing the code.
- Treating effects as lifecycle methods instead of synchronization processes.
- Fetching data manually in every component without thinking about caching or race conditions.

### Best Practices

Use these rules of thumb:

- Effects are escape hatches for external synchronization.
- Derive values during render whenever possible.
- Use event handlers for user-triggered actions.
- Store the minimal source of truth.
- Reset state with keys when component identity changes.
- Prefer IDs and derived lookup over duplicated selected objects.
- Use reducers for related state transitions.
- Split unrelated effects.
- Let dependency warnings guide refactoring instead of suppressing them.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does "you might not need an effect" mean?

<!-- question:start:you-might-not-need-an-effect-patterns-beginner-q01 -->
<!-- question-id:you-might-not-need-an-effect-patterns-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

It means effects should not be the default way to coordinate React state. Effects are for synchronizing a component with external systems such as browser APIs, network connections, timers, subscriptions, or non-React widgets.

If a value can be calculated from props or state, calculate it during render. If logic happens because the user clicked, typed, or submitted something, put it in the event handler.

Unnecessary effects add extra renders, stale intermediate values, more dependency problems, and more code to maintain.

##### Key Points to Mention

- Effects are for external synchronization.
- Derived values usually belong in render.
- User-triggered logic belongs in event handlers.
- Unnecessary effects can cause extra renders.
- Removing effects often simplifies data flow.

<!-- question:end:you-might-not-need-an-effect-patterns-beginner-q01 -->

#### Why should derived values usually be calculated during render?

<!-- question:start:you-might-not-need-an-effect-patterns-beginner-q02 -->
<!-- question-id:you-might-not-need-an-effect-patterns-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Derived values come from existing props or state, so they do not need their own state variable or effect. Calculating them during render keeps one source of truth and avoids rendering once with stale data.

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

This is simpler, faster, and less likely to get out of sync.

##### Key Points to Mention

- Derived values already come from props or state.
- Separate derived state creates synchronization risk.
- Effects run after render, causing stale intermediate UI.
- Render-time calculation avoids extra renders.
- Use `useMemo` only for expensive pure calculations.

<!-- question:end:you-might-not-need-an-effect-patterns-beginner-q02 -->

#### Where should user-triggered logic go?

<!-- question:start:you-might-not-need-an-effect-patterns-beginner-q03 -->
<!-- question-id:you-might-not-need-an-effect-patterns-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

User-triggered logic should usually go in the event handler for that interaction. If the user clicks a button to buy a product, the API call, cart update, notification, or navigation should happen in the click or submit handler.

An effect runs because a component rendered with certain props or state. By the time an effect runs, it is less clear which user action caused the state. Event handlers preserve that context.

##### Key Points to Mention

- Event handlers know exactly what interaction happened.
- Effects run after rendering, not directly from the event.
- Notifications and submissions often belong in handlers.
- Avoid using state flags just to trigger event logic in effects.
- Shared event logic can be extracted into a helper function.

<!-- question:end:you-might-not-need-an-effect-patterns-beginner-q03 -->

#### When do you actually need an effect?

<!-- question:start:you-might-not-need-an-effect-patterns-beginner-q04 -->
<!-- question-id:you-might-not-need-an-effect-patterns-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

You need an effect when the component must synchronize with something outside React. Examples include connecting to a chat server, adding a browser event listener, starting a timer, controlling a third-party widget, or fetching data in a simple client-side component.

The effect should set up synchronization and return cleanup when needed.

```tsx
useEffect(() => {
  window.addEventListener("resize", handleResize);

  return () => {
    window.removeEventListener("resize", handleResize);
  };
}, []);
```

##### Key Points to Mention

- External systems are the main reason for effects.
- Effects run after render commit.
- Cleanup should undo setup.
- Timers, subscriptions, sockets, and browser events are common examples.
- If no external system exists, look for a simpler pattern first.

<!-- question:end:you-might-not-need-an-effect-patterns-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you replace an effect that filters a list into state?

<!-- question:start:you-might-not-need-an-effect-patterns-intermediate-q01 -->
<!-- question-id:you-might-not-need-an-effect-patterns-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Remove the state and effect, then calculate the filtered list during render from the source list and filter value.

Bad:

```tsx
const [visibleTodos, setVisibleTodos] = useState<Todo[]>([]);

useEffect(() => {
  setVisibleTodos(getFilteredTodos(todos, filter));
}, [todos, filter]);
```

Good:

```tsx
const visibleTodos = getFilteredTodos(todos, filter);
```

If filtering is expensive and `todos` or `filter` often stay the same, wrap the calculation in `useMemo`.

##### Key Points to Mention

- Filtered data is derived data.
- Store the source list and filter, not the result.
- Render-time calculation avoids stale extra render.
- Use `useMemo` for expensive pure filtering.
- The memoized calculation depends on `todos` and `filter`.

<!-- question:end:you-might-not-need-an-effect-patterns-intermediate-q01 -->

#### How can you reset state when a prop changes without an effect?

<!-- question:start:you-might-not-need-an-effect-patterns-intermediate-q02 -->
<!-- question-id:you-might-not-need-an-effect-patterns-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

If a prop change means the subtree represents a different entity, give that subtree a key based on the identity prop.

```tsx
function ProfilePage({ userId }: { userId: string }) {
  return <Profile key={userId} userId={userId} />;
}
```

When `userId` changes, React treats the keyed `Profile` as a different component instance and resets its local state. This avoids rendering with stale state and then clearing it in an effect.

##### Key Points to Mention

- Use keys to express component identity.
- Changing a key resets state below that component.
- This avoids effect-driven reset after stale render.
- Useful for forms or screens tied to an entity ID.
- Do not use random keys because they reset every render.

<!-- question:end:you-might-not-need-an-effect-patterns-intermediate-q02 -->

#### How do IDs help avoid state-adjustment effects?

<!-- question:start:you-might-not-need-an-effect-patterns-intermediate-q03 -->
<!-- question-id:you-might-not-need-an-effect-patterns-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Instead of storing both a selected object and the list that contains it, store the selected ID and derive the selected object from the current list.

```tsx
const [items, setItems] = useState(initialItems);
const [selectedId, setSelectedId] = useState<string | null>(null);

const selectedItem =
  items.find((item) => item.id === selectedId) ?? null;
```

This removes duplicated object state. If the list changes, the derived selected item automatically reflects the latest list or becomes `null` when no item matches.

##### Key Points to Mention

- Duplicated selected objects can become stale.
- Store stable identity instead.
- Derive the object during render.
- This removes many prop-change adjustment effects.
- It keeps one source of truth.

<!-- question:end:you-might-not-need-an-effect-patterns-intermediate-q03 -->

#### Why can putting notifications in effects cause bugs?

<!-- question:start:you-might-not-need-an-effect-patterns-intermediate-q04 -->
<!-- question-id:you-might-not-need-an-effect-patterns-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Notifications are often caused by a specific user action. If you put notification logic in an effect that watches state, the notification may run for reasons unrelated to the original event, such as restoring state on page load or receiving already-updated props.

For example, an effect watching `isInCart` might show an "Added to cart" notification when the page reloads and the product is already in the cart. The notification should happen in the add-to-cart event handler where the user's action is known.

##### Key Points to Mention

- Effects run because state or props changed, not necessarily because of a specific event.
- Event handlers preserve user-action context.
- Restored or preloaded state can accidentally trigger effects.
- Notifications after clicks usually belong in click handlers.
- Shared event logic can be extracted into a function.

<!-- question:end:you-might-not-need-an-effect-patterns-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you audit a component with many effects?

<!-- question:start:you-might-not-need-an-effect-patterns-advanced-q01 -->
<!-- question-id:you-might-not-need-an-effect-patterns-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Inspect each effect and ask what external system it synchronizes with. If there is no external system, try to move the logic into render, an event handler, a reducer, or state initialization.

Classify each effect:

- Derived data effect: replace with render calculation or `useMemo`.
- Event logic effect: move to the event handler.
- Reset effect: consider a key.
- State adjustment effect: consider better state shape, IDs, or derived values.
- Real synchronization effect: keep it, but verify dependencies and cleanup.

Finally, split unrelated synchronization processes into separate effects so each dependency list describes one purpose.

##### Key Points to Mention

- Start by identifying the external system.
- Remove derived-data effects.
- Move event-specific effects to handlers.
- Use keys or better state shape for reset/adjustment.
- Keep real effects honest and focused.

<!-- question:end:you-might-not-need-an-effect-patterns-advanced-q01 -->

#### How would you replace a chain of effects that update state from state?

<!-- question:start:you-might-not-need-an-effect-patterns-advanced-q02 -->
<!-- question-id:you-might-not-need-an-effect-patterns-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Move the related transitions into the event handler or reducer that knows what happened. Chained effects make the flow indirect: render, effect, state update, render, another effect, another state update.

If several fields must update together, a reducer is often clearer. Actions such as `cardDrawn`, `submitted`, or `checkoutCompleted` can calculate the next state in one place.

The goal is one intentional transition from one state to the next, not a sequence of effects reacting to intermediate state.

##### Key Points to Mention

- Chained effects create extra render passes.
- Related state transitions should happen together.
- Event handlers know the initiating event.
- Reducers are good for structured transitions.
- Avoid using effects as a state machine glue layer.

<!-- question:end:you-might-not-need-an-effect-patterns-advanced-q02 -->

#### What should you do when the dependency linter complains but re-running the effect seems wrong?

<!-- question:start:you-might-not-need-an-effect-patterns-advanced-q03 -->
<!-- question-id:you-might-not-need-an-effect-patterns-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Do not suppress the linter as the first move. The dependency list describes the reactive values used by the effect. If the dependency list is undesirable, change the code so the effect no longer depends on that value.

Common refactors include moving event-specific code into an event handler, splitting unrelated effects, moving object creation inside the effect, using functional state updates, or deriving values during render.

Suppressing dependencies can create stale closure bugs where the effect reads old props or state.

##### Key Points to Mention

- Dependencies should match the effect code.
- To change dependencies, change the code.
- Suppression can create stale closure bugs.
- Split effects when dependencies represent different processes.
- Move non-effect logic out of effects.

<!-- question:end:you-might-not-need-an-effect-patterns-advanced-q03 -->

#### How do you decide whether to fetch data in an effect?

<!-- question:start:you-might-not-need-an-effect-patterns-advanced-q04 -->
<!-- question-id:you-might-not-need-an-effect-patterns-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Fetching in an effect is reasonable for simple client-only components, prototypes, or code where no data-loading layer exists. The effect must handle dependencies, loading state, errors, stale responses, and cleanup.

For production applications, framework data loaders, server rendering, server components, route loaders, or client data libraries may be better because they handle caching, deduplication, race conditions, preloading, and server/client coordination.

The interview answer should not say effects can never fetch. It should say effect fetching is one tool, but often not the best architecture for larger apps.

##### Key Points to Mention

- Effects can fetch data in client components.
- Manual fetching needs stale response handling.
- Larger apps often need caching and deduplication.
- Framework and data libraries may be better.
- Include real dependencies and cleanup when fetching manually.

<!-- question:end:you-might-not-need-an-effect-patterns-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
