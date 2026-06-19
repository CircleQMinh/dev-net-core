---
id: debugging-rendering-hydration-and-interaction-issues
topic: Testing, accessibility, and frontend debugging
subtopic: Debugging rendering, hydration, and interaction issues
category: React
---

## Overview

Debugging rendering, hydration, and interaction issues in React means understanding how React calculates UI, attaches event handlers, preserves state, runs effects, and coordinates server-rendered HTML with client-side React. These bugs often look mysterious at first: a component renders twice, an event handler sees stale state, a button does not click, a form submits unexpectedly, server-rendered markup changes after hydration, or a component loses state after a list update.

The practical debugging skill is to separate the problem into layers. Rendering issues usually involve props, state, context, keys, memoization, or effects. Hydration issues involve mismatches between server output and the first client render. Interaction issues involve event handlers, native HTML behavior, disabled elements, overlays, focus, propagation, async state, or stale closures.

This topic matters in interviews because React debugging reveals whether a candidate has a real mental model of React. Strong answers do not just say "use DevTools." They explain render vs commit, Strict Mode behavior, hydration parity, effect cleanup, state snapshots, event propagation, and a systematic way to reproduce and isolate the bug.

In production teams, these skills are used when debugging slow screens, SSR warnings, broken forms, inaccessible controls, disappearing state, flaky interactions, and issues that only happen after deployment.

## Core Concepts

### Render, Commit, and Paint

React updates UI in stages:

- Trigger: initial render, state update, prop change, context change, or external store update.
- Render: React calls components to calculate the next UI.
- Commit: React applies necessary DOM changes.
- Paint: the browser displays the result.

A component function running does not always mean the DOM changed. React may rerender a subtree, compare the result, and commit only the minimal necessary DOM updates.

Debugging implication:

- If JSX is wrong, inspect render inputs: props, state, context, derived values.
- If the DOM is wrong, inspect commit-related conditions: keys, conditional rendering, portals, hydration, or browser DOM mutations outside React.
- If the screen feels slow, inspect expensive render work and commit cost separately.

### Common Render Triggers

A component can render because:

- Its own state changed.
- Its parent rendered.
- A context value it reads changed.
- A subscribed external store changed.
- Its key changed and React treated it as a new component.
- It mounted for the first time.

Example debugging helper:

```tsx
function ProductRow({ product }: { product: Product }) {
  console.log("ProductRow render", product.id, product.name);

  return <li>{product.name}</li>;
}
```

Logs can help during exploration, but use React DevTools Profiler for serious performance debugging.

### Strict Mode Development Behavior

In development, `StrictMode` intentionally checks for common bugs:

- Components may render an extra time to detect impure rendering.
- Effects may run setup, cleanup, and setup again to detect missing cleanup.
- Ref callbacks may also be checked.

This can surprise developers who see duplicate logs or duplicate development network requests.

The fix is usually not to hide Strict Mode. The fix is to make render logic pure and make effects resilient to setup, cleanup, and setup.

Bad:

```tsx
useEffect(() => {
  socket.connect();
}, []);
```

Better:

```tsx
useEffect(() => {
  socket.connect();

  return () => {
    socket.disconnect();
  };
}, []);
```

If the effect cannot safely run twice in development, it probably has a missing cleanup or belongs in an event handler instead.

### State as a Snapshot

State values inside a render are snapshots. Event handlers close over the values from the render that created them.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function addThree() {
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
  }

  return <button onClick={addThree}>{count}</button>;
}
```

All three updates read the same `count` snapshot. Use updater functions when the next value depends on the previous value:

```tsx
function addThree() {
  setCount((current) => current + 1);
  setCount((current) => current + 1);
  setCount((current) => current + 1);
}
```

This mental model also explains many stale closure bugs in timers, event listeners, and async callbacks.

### Keys and State Preservation

React associates state with a component's position in the render tree. Keys help React match list items across renders.

Bad:

```tsx
{todos.map((todo, index) => (
  <TodoRow key={index} todo={todo} />
))}
```

If items are inserted, removed, or reordered, index keys can cause state to move to the wrong row.

Better:

```tsx
{todos.map((todo) => (
  <TodoRow key={todo.id} todo={todo} />
))}
```

Debugging signs of key problems:

- Input text appears under the wrong row.
- Expanded state moves to another item.
- Animations or focus jump after sorting.
- State resets unexpectedly when conditionals change.

Use stable keys from data and keep component types stable.

### Effects and Dependency Bugs

Effects synchronize React with external systems: subscriptions, browser APIs, timers, sockets, analytics, or imperative widgets. Dependency arrays should match the reactive values used by the effect.

Bad:

```tsx
useEffect(() => {
  fetchResults(query);
}, []);
```

If `query` changes, the effect still uses the initial query.

Better:

```tsx
useEffect(() => {
  fetchResults(query);
}, [query]);
```

For async requests, handle stale responses:

```tsx
useEffect(() => {
  let ignore = false;

  async function load() {
    const results = await searchProducts(query);

    if (!ignore) {
      setResults(results);
    }
  }

  load();

  return () => {
    ignore = true;
  };
}, [query]);
```

If adding a dependency creates a loop, do not suppress the linter by default. Change the code shape: move objects inside the effect, use updater functions, split unrelated effects, or move user-triggered logic into event handlers.

### Infinite Render Loops

Common causes of render loops:

- Calling a state setter during render.
- An effect updates state and depends on a value recreated every render.
- A parent passes a new object or function that causes a child effect to run repeatedly.
- Derived state is recalculated in an effect instead of during render.

Bad:

```tsx
function ProductList({ products }: { products: Product[] }) {
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);

  useEffect(() => {
    setVisibleProducts(products.filter((product) => product.active));
  }, [products]);

  return <List items={visibleProducts} />;
}
```

If the value is derived from props or state and does not require an external system, calculate it during render:

```tsx
function ProductList({ products }: { products: Product[] }) {
  const visibleProducts = products.filter((product) => product.active);

  return <List items={visibleProducts} />;
}
```

Use `useMemo` only if the calculation is expensive enough to matter.

### Hydration

Hydration is the process where React attaches event handlers and component logic to HTML that was already generated on the server. The first client render must produce the same output as the server render.

```tsx
import { hydrateRoot } from "react-dom/client";

hydrateRoot(document.getElementById("root")!, <App />);
```

If the server HTML and the first client render differ, React may warn, recover slowly, or attach handlers incorrectly in severe cases.

### Common Hydration Mismatch Causes

Common causes include:

- Rendering `Date.now()`, `new Date()`, or random values during render.
- Using `Math.random()` for IDs or text.
- Reading `window`, `document`, `localStorage`, `matchMedia`, or browser-only APIs during render.
- Using `typeof window !== "undefined"` to render different markup.
- Rendering user-specific data differently on server and client.
- Locale, timezone, or formatting differences.
- Invalid HTML that the browser repairs differently than expected.
- CSS-in-JS or style ordering mismatches.
- IDs generated differently between server and client.
- Browser extensions modifying the DOM before hydration.

Bad:

```tsx
function TimeStamp() {
  return <p>{new Date().toLocaleString()}</p>;
}
```

Better if the timestamp must be client-only:

```tsx
function TimeStamp() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    setTime(new Date().toLocaleString());
  }, []);

  return <p>{time ?? "Loading time..."}</p>;
}
```

The server and first client render both show the fallback. The client updates after hydration.

### Fixing Hydration Mismatches

Good fixes include:

- Make initial render deterministic.
- Pass the same data to server and client.
- Move browser-only reads into `useEffect`.
- Use `useId` for accessibility IDs instead of random ID generation.
- Use framework-supported data loading and serialization.
- Validate HTML nesting.
- Ensure CSS-in-JS setup follows the framework's SSR guidance.
- Use `suppressHydrationWarning` only for narrow, unavoidable one-element mismatches.

Escape hatch:

```tsx
<time suppressHydrationWarning>
  {new Date().toLocaleString()}
</time>
```

This should be rare. It silences a warning; it does not make mismatched UI a good experience.

### Debugging Interaction Issues

When a click, key, submit, or focus behavior does not work, check the browser layer before blaming React.

Questions to ask:

- Is the element a real interactive element?
- Is it disabled?
- Is another element overlaying it?
- Is CSS using `pointer-events: none`?
- Is the handler passed correctly?
- Is the handler accidentally called during render?
- Is the element inside a form where a button defaults to submit?
- Is `preventDefault` or `stopPropagation` blocking expected behavior?
- Is focus going somewhere unexpected?
- Is stale state used inside an async callback?

Bad:

```tsx
<button onClick={save()}>Save</button>
```

This calls `save` during render.

Good:

```tsx
<button onClick={save}>Save</button>
```

or:

```tsx
<button onClick={() => save(productId)}>Save</button>
```

### Form Interaction Issues

Common form bugs:

- A button submits a form because it defaults to `type="submit"`.
- Submit logic is attached only to button `onClick`, so pressing Enter does not work.
- A controlled input switches between controlled and uncontrolled.
- Validation errors are stored but not rendered accessibly.
- The form relies on placeholder text instead of labels.
- `event.preventDefault()` is missing or used in the wrong place.

Better pattern:

```tsx
function ProfileForm({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(name);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button type="submit">Save profile</button>
      <button type="button">Cancel</button>
    </form>
  );
}
```

Use form semantics so clicking submit and pressing Enter go through the same path.

### Event Propagation

React event handlers use a delegated event system and follow normal propagation concepts. A child click can bubble to a parent.

Example:

```tsx
function Card() {
  return (
    <article onClick={() => openDetails()}>
      <h2>Invoice 123</h2>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          downloadInvoice();
        }}
      >
        Download
      </button>
    </article>
  );
}
```

Use `stopPropagation` only when a nested interaction should not trigger the parent interaction. If you need it everywhere, the component design may be too broad.

### Focus Issues

Focus bugs often appear after conditional rendering, dialogs, route changes, validation errors, or removed elements.

Debugging steps:

- Check `document.activeElement`.
- Confirm the focused element still exists after state changes.
- Ensure modals move focus inside and restore it after close.
- Ensure validation errors do not move focus unexpectedly.
- Avoid remounting focused inputs with unstable keys.
- Check whether an overlay or disabled state prevents focus.

Example focus restoration:

```tsx
function DeleteButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function closeDialog() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => setOpen(true)}>
        Delete
      </button>
      <DeleteDialog open={open} onClose={closeDialog} />
    </>
  );
}
```

### React DevTools

React Developer Tools helps inspect:

- Component tree.
- Props and state.
- Context values.
- Hook state.
- Owner relationships.
- Render performance through the Profiler.

Use Components view to inspect the current state and props. Use Profiler when the problem is slowness, excessive rerendering, or expensive commits. Combine it with browser DevTools for DOM, network, console, performance, accessibility tree, and event listener debugging.

### Debugging Workflow

A reliable workflow:

- Reproduce the bug with exact steps.
- Check console warnings first.
- Identify whether the symptom is rendering, hydration, interaction, data, or styling.
- Reduce the example to the smallest component or state path.
- Inspect props, state, context, and keys.
- Check whether Strict Mode development behavior is involved.
- Inspect effects and dependencies.
- For SSR, compare server output and first client render assumptions.
- For interactions, verify native element behavior, focus, event propagation, and CSS overlays.
- Add a regression test once the cause is understood.

### Common Mistakes

Common mistakes include:

- Treating Strict Mode duplicate logs as a production bug.
- Mutating props or state during render.
- Using index keys for reorderable lists.
- Suppressing effect dependency warnings.
- Calculating browser-only values during SSR render.
- Using `createRoot` for server-rendered HTML instead of `hydrateRoot`.
- Relying on random IDs during hydration.
- Calling handlers during render.
- Forgetting `type="button"` inside forms.
- Hiding focus outlines and then missing focus bugs.
- Debugging React while ignoring CSS overlays or native browser behavior.

### Best Practices

Best practices include:

- Keep render logic pure.
- Use stable keys from data.
- Treat effects as synchronization with external systems.
- Implement cleanup for subscriptions, timers, sockets, and imperative widgets.
- Keep server and first client render deterministic.
- Move browser-only work into effects or client-only boundaries.
- Use semantic HTML for interactions.
- Prefer form `onSubmit` over button-only submit logic.
- Profile slow interactions in production-like builds.
- Add regression tests for rendering, hydration, and interaction bugs.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between render and commit in React?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-beginner-q01 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

Render is when React calls components to calculate what the UI should look like. Commit is when React applies the necessary changes to the DOM. A component can rerender without causing a visible DOM change if the calculated output is effectively the same.

This distinction matters for debugging because seeing a console log during render does not always mean the browser DOM changed. Rendering bugs are usually about props, state, context, keys, and derived values. Commit or DOM bugs may involve keys, portals, hydration, or code outside React modifying the DOM.

##### Key Points to Mention

- Render calculates UI.
- Commit updates the DOM.
- Not every render causes DOM changes.
- State updates trigger renders.
- Debug render inputs separately from DOM effects.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-beginner-q01 -->

#### Why might a component render twice in development?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-beginner-q02 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

In development, React Strict Mode intentionally runs extra checks. Components may render an extra time, effects may run setup and cleanup again, and ref callbacks may be checked. This helps find bugs caused by impure rendering or missing cleanup.

This does not mean production renders the same way. The right response is usually to make rendering pure and effects safe to clean up and rerun, not to hide the problem with refs or remove Strict Mode immediately.

##### Key Points to Mention

- Strict Mode adds development-only checks.
- Extra renders can reveal impure render logic.
- Effects may run setup, cleanup, setup.
- Production behavior is different.
- Fix cleanup and purity problems.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-beginner-q02 -->

#### What is hydration in React?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-beginner-q03 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Hydration is when React attaches event handlers and component logic to HTML that was already rendered on the server. The server sends an HTML snapshot so the user can see content before JavaScript finishes loading. Then client-side React takes over that existing DOM.

For hydration to work correctly, the first client render should match the server-rendered HTML. If they differ, React may warn about a hydration mismatch and may need to recover.

##### Key Points to Mention

- Hydration attaches React to server-rendered HTML.
- It makes the server HTML interactive.
- Use `hydrateRoot` for server-rendered roots.
- Server output and first client render should match.
- Mismatches should be treated as bugs.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-beginner-q03 -->

#### Why does a button inside a form sometimes submit unexpectedly?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-beginner-q04 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Inside a form, a `<button>` defaults to `type="submit"` if no type is provided. If the button is meant to open a dialog, cancel, toggle UI, or perform another non-submit action, it should use `type="button"`.

Submit behavior should usually be handled on the form's `onSubmit`, not only on a button's `onClick`. This preserves keyboard behavior such as pressing Enter in a field.

##### Key Points to Mention

- Button default type in forms is submit.
- Use `type="button"` for non-submit actions.
- Use form `onSubmit` for submit logic.
- Call `preventDefault` when handling client-side submit.
- Preserve Enter-key submission behavior.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you debug a component that loses input state after sorting a list?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-intermediate-q01 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

I would first inspect the keys used for list items. If the list uses array indexes as keys, sorting changes which data is associated with each position, so React may preserve state for the position rather than the logical item. This can make input values, expanded state, or focus appear under the wrong row.

The fix is to use stable keys from the data, such as item IDs. I would also check whether the row component type changes conditionally, because changing component types can reset state.

##### Key Points to Mention

- State is tied to position in the render tree.
- Keys help React match logical items.
- Index keys are unsafe for reordered lists.
- Use stable IDs from data.
- Check conditional component type changes.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-intermediate-q01 -->

#### How would you debug a hydration mismatch?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-intermediate-q02 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

I would identify what markup differs between the server output and the first client render. Then I would look for nondeterministic render values such as dates, random numbers, locale formatting, browser-only APIs, user-specific data, invalid HTML nesting, CSS-in-JS configuration, or IDs generated differently on the server and client.

The fix is to make the initial render deterministic. Browser-only values should be read in `useEffect` or behind a client-only boundary. Data should be serialized consistently. IDs for accessibility should use `useId` or framework-supported mechanisms. `suppressHydrationWarning` should be a narrow escape hatch, not a general fix.

##### Key Points to Mention

- Compare server output and first client render.
- Look for random, time, locale, and browser-only values.
- Validate HTML structure.
- Use deterministic data and IDs.
- Move client-only reads after hydration.
- Avoid overusing `suppressHydrationWarning`.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-intermediate-q02 -->

#### How do stale closures cause interaction bugs?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-intermediate-q03 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Event handlers, timers, effects, and async callbacks close over the props and state from the render that created them. If a callback runs later, it may read old values unless the code accounts for that. This can cause counters not to increment correctly, old search results to overwrite new ones, or event listeners to use stale props.

Fixes depend on the case: use state updater functions when the next value depends on previous state, include correct effect dependencies, cancel or ignore stale async work, or use refs carefully when an external callback needs the latest value without rerunning setup.

##### Key Points to Mention

- Each render has its own state snapshot.
- Callbacks close over that snapshot.
- Async callbacks can use old values.
- Use updater functions for previous-state updates.
- Use correct dependencies and cleanup.
- Guard against stale async responses.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-intermediate-q03 -->

#### How would you debug a click handler that does not run?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-intermediate-q04 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

I would first check the DOM and browser behavior. Is the element actually rendered? Is it disabled? Is another element overlaying it? Is CSS using `pointer-events: none`? Is it a semantic button or a custom element? Then I would check React wiring: whether the handler is passed correctly, whether it is accidentally called during render, and whether propagation is stopped by a child or parent.

If the app uses SSR, I would also check hydration warnings because severe mismatches can affect event attachment. Finally, I would reproduce with keyboard interaction to see whether the issue is pointer-only, focus-related, or a general activation problem.

##### Key Points to Mention

- Inspect DOM and CSS first.
- Check disabled state and overlays.
- Verify handler syntax.
- Check propagation and `preventDefault`.
- Check hydration warnings if SSR is involved.
- Test keyboard activation too.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do you debug an effect that keeps reconnecting or refetching?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-advanced-q01 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would inspect the effect dependencies and identify which dependency changes on every render. Common causes are objects or functions created inline, derived values stored unnecessarily in state, or parent props that are recreated each render. I would avoid suppressing the dependency linter because that can create stale closure bugs.

The fix may be to move static values outside the component, move object creation inside the effect, extract primitive values, split unrelated effects, use updater functions, or move user-triggered logic to an event handler. If the effect subscribes or connects to something, I would also verify cleanup.

##### Key Points to Mention

- Dependency arrays should match effect code.
- Inline objects and functions can cause repeated effects.
- Do not suppress the dependency linter as a default fix.
- Change code shape to remove unnecessary dependencies.
- Split unrelated effects.
- Verify cleanup for external systems.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-advanced-q01 -->

#### How would you approach debugging a slow React interaction?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-advanced-q02 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

I would reproduce the slow interaction in a production-like build if possible, then profile it with React DevTools Profiler and browser performance tools. I would identify which components rendered, how long they took, whether expensive calculations repeated, whether context or parent state caused broad rerenders, and whether the delay is render work, commit work, layout, network, or JavaScript outside React.

Then I would fix the actual bottleneck: move state closer to where it is used, split components, reduce context blast radius, memoize expensive calculations, virtualize large lists, defer non-urgent rendering, or optimize network and data caching. After the change, I would profile again.

##### Key Points to Mention

- Reproduce first.
- Use React Profiler and browser performance tools.
- Separate render, commit, layout, and network cost.
- Identify broad rerenders and expensive components.
- Optimize the bottleneck, not guesses.
- Re-measure after changes.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-advanced-q02 -->

#### How would you debug an SSR page that works in development but has hydration warnings in production?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-advanced-q03 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

I would compare the exact server HTML and the first client render in the production environment. Production-only mismatches often come from environment differences: timezone, locale, feature flags, user cookies, CDN transformations, minification, CSS-in-JS extraction, different data versions, or browser extensions. I would also check whether development uses a different rendering path than production.

The fix is to remove nondeterminism from render, ensure the same serialized data and configuration reach both server and client, validate HTML, and move browser-only behavior into effects. I would avoid masking broad mismatches because hydration problems can hurt performance and interaction correctness.

##### Key Points to Mention

- Compare production server HTML and first client render.
- Check timezone, locale, flags, cookies, and data drift.
- Check CSS-in-JS and build configuration.
- Check invalid HTML and CDN transformations.
- Keep render deterministic.
- Treat hydration warnings as real bugs.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-advanced-q03 -->

#### What is a systematic debugging workflow for React interaction bugs?

<!-- question:start:debugging-rendering-hydration-and-interaction-issues-advanced-q04 -->
<!-- question-id:debugging-rendering-hydration-and-interaction-issues-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Start by reproducing the bug with exact steps and identifying the smallest component path involved. Check console warnings, DOM structure, CSS overlays, disabled states, focus, and native element semantics. Then inspect React props, state, context, handlers, keys, effects, and async state updates.

For forms, verify `onSubmit`, button types, labels, and controlled input values. For nested interactions, check propagation. For SSR, check hydration warnings. After finding the cause, add a regression test that interacts like a user and asserts the visible outcome or public contract.

##### Key Points to Mention

- Reproduce and minimize.
- Check console, DOM, CSS, and focus.
- Inspect props, state, context, keys, and effects.
- Verify native form and button behavior.
- Check propagation and stale closures.
- Add a user-centric regression test.

<!-- question:end:debugging-rendering-hydration-and-interaction-issues-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
