---
id: context-plus-reducer-vs-external-stores
topic: State management, performance, and rendering optimization
subtopic: Context plus reducer vs external stores
category: React
---

## Overview

Context plus reducer is a React-native state management pattern that combines `useReducer` for predictable state transitions with context for sharing state and dispatch through a component subtree. External stores are state containers that live outside React's component tree and expose subscription APIs so components can read selected state and update when the store changes.

This topic matters because state management choices shape maintainability, performance, testing, and team workflow. A small feature may only need local state. A complex screen may benefit from reducer plus context. A large application with shared, frequently updated state may need an external store such as Redux, Zustand, Jotai, Valtio, or another library.

For interviews, this topic is important because candidates often overreach in both directions. Some reach for a global store too early. Others force context to handle high-frequency, app-wide updates and then fight rerender problems. A strong answer explains the shape of the state, update frequency, ownership boundary, debugging needs, and performance trade-offs before picking a tool.

## Core Concepts

### Local State First

Not all state needs a global solution.

Local state is usually best for:

- Input focus.
- Modal open/closed state.
- Hover state.
- Local tab selection.
- Temporary component UI state.
- Small form drafts.
- Component-only toggles.

Example:

```tsx
function ExpandablePanel() {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button onClick={() => setOpen((value) => !value)}>
        {open ? "Collapse" : "Expand"}
      </button>
      {open ? <PanelContent /> : null}
    </section>
  );
}
```

Putting this in context or an external store would add coordination cost without solving a real problem.

### Reducers

`useReducer` is useful when state transitions are easier to describe as events.

```tsx
type State = {
  selectedIds: string[];
  filter: string;
};

type Action =
  | { type: "filterChanged"; filter: string }
  | { type: "itemSelected"; id: string }
  | { type: "selectionCleared" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "filterChanged":
      return { ...state, filter: action.filter };
    case "itemSelected":
      return {
        ...state,
        selectedIds: [...state.selectedIds, action.id],
      };
    case "selectionCleared":
      return { ...state, selectedIds: [] };
    default:
      return state;
  }
}
```

Reducers help when:

- Several fields update together.
- Updates have names and intent.
- State transitions need tests.
- Event handlers are getting crowded.
- Many components trigger the same state changes.

Reducers do not automatically make state global. They only organize update logic.

### Context

Context lets components read a value from the nearest provider above them in the tree.

```tsx
const ThemeContext = createContext<"light" | "dark">("light");

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Toolbar />
    </ThemeContext.Provider>
  );
}

function Toolbar() {
  const theme = useContext(ThemeContext);
  return <div data-theme={theme}>Toolbar</div>;
}
```

Context is useful for values that are logically scoped to a subtree:

- Theme.
- Locale.
- Current user identity.
- Permission snapshot.
- Design system configuration.
- Wizard state.
- Feature-specific reducer state.

Context avoids prop drilling, but it is not automatically a high-performance state store.

### Context Plus Reducer

Reducer plus context combines structured updates with easy access throughout a subtree.

```tsx
type TasksState = {
  tasks: Task[];
};

type TasksAction =
  | { type: "added"; task: Task }
  | { type: "changed"; task: Task }
  | { type: "deleted"; id: string };

const TasksStateContext = createContext<TasksState | null>(null);
const TasksDispatchContext = createContext<Dispatch<TasksAction> | null>(null);

function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tasksReducer, { tasks: [] });

  return (
    <TasksStateContext.Provider value={state}>
      <TasksDispatchContext.Provider value={dispatch}>
        {children}
      </TasksDispatchContext.Provider>
    </TasksStateContext.Provider>
  );
}
```

Consumer hooks make usage safer:

```tsx
function useTasksState() {
  const value = useContext(TasksStateContext);

  if (!value) {
    throw new Error("useTasksState must be used inside TasksProvider");
  }

  return value;
}

function useTasksDispatch() {
  const value = useContext(TasksDispatchContext);

  if (!value) {
    throw new Error("useTasksDispatch must be used inside TasksProvider");
  }

  return value;
}
```

This pattern keeps components focused on rendering and events while the reducer owns transition logic.

### Splitting State and Dispatch Contexts

Splitting state and dispatch contexts is a common performance and clarity improvement.

```tsx
const StateContext = createContext<State | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);
```

Why this helps:

- Components that only dispatch actions do not need to subscribe to state changes.
- The dispatch function from `useReducer` has stable identity.
- Consumers can choose what they need.

Example:

```tsx
function AddTaskButton() {
  const dispatch = useTasksDispatch();

  return (
    <button onClick={() => dispatch({ type: "added", task: createTask() })}>
      Add task
    </button>
  );
}
```

This component does not rerender because the task list changed unless its own props or parent render force it.

### Context Rerender Behavior

When a context provider's value changes, components that read that context can rerender.

This matters when the context value is large or changes frequently.

```tsx
<AppContext.Provider value={{ state, dispatch }}>
  {children}
</AppContext.Provider>
```

The object literal is new whenever the provider renders. If `state` changes frequently, all consumers that read `AppContext` can be affected, even if they only need one field.

Better options:

- Split state and dispatch contexts.
- Split unrelated state into separate providers.
- Move provider lower in the tree.
- Memoize provider values where appropriate.
- Use an external store with selectors when fine-grained subscriptions matter.

Context is not wrong here. The issue is subscription granularity.

### Provider Scope

Provider placement defines state lifetime and rerender boundaries.

App-wide provider:

```tsx
<AuthProvider>
  <RouterProvider router={router} />
</AuthProvider>
```

Feature-scoped provider:

```tsx
<CheckoutProvider>
  <CheckoutRoutes />
</CheckoutProvider>
```

Prefer the narrowest provider scope that matches the state lifetime. A checkout reducer does not need to sit above the whole application unless other app areas depend on it.

### External Stores

An external store keeps state outside React's component tree. Components subscribe to it and read snapshots or selected values.

External stores commonly provide:

- Centralized state.
- Selectors.
- Fine-grained subscriptions.
- Middleware.
- DevTools.
- Persistence.
- Undo/redo.
- Cross-route access.
- Framework-independent state access.

Redux-style shape:

```ts
const store = configureStore({
  reducer: {
    auth: authReducer,
    preferences: preferencesReducer,
  },
});
```

Component usage:

```tsx
const userName = useSelector((state: RootState) => state.auth.user?.name);
const dispatch = useDispatch();
```

The important feature is not that the store is "global." The important feature is that subscribers can often select the exact state they need.

### When Context Plus Reducer Fits

Context plus reducer is a good fit when:

- State belongs to one feature or subtree.
- Updates are moderately complex.
- Prop drilling is painful.
- The team wants no extra dependency.
- State changes are not extremely frequent.
- Most consumers need the same state.
- DevTools/time-travel/persistence are not major requirements.

Examples:

- Multi-step wizard.
- Checkout flow.
- Modal manager inside a feature area.
- Complex local editor panel.
- Feature-specific permissions snapshot.
- Nested task list screen.

It is a strong middle ground between local `useState` and a full app-level store.

### When External Stores Fit

External stores are a better fit when:

- State is needed across distant routes.
- Many components need different slices of state.
- State updates frequently.
- Fine-grained subscriptions are important.
- Debugging update history matters.
- Middleware, persistence, or undo/redo is needed.
- Non-React code must read or update the state.
- The app has a large team and needs stronger conventions.

Examples:

- Authentication/session state used across the app.
- Feature flags.
- Complex client-side editor state.
- Global notifications.
- Collaborative presence.
- App-wide preferences.
- Large normalized client state.

External stores are not automatically better. They bring concepts, conventions, and dependency cost.

### Server State Is Different

Server state should usually not be managed with reducer plus context or a plain client store unless the team is deliberately building a cache.

Server state has different needs:

- Loading state.
- Error state.
- Staleness.
- Refetching.
- Cache invalidation.
- Deduplication.
- Retries.
- Optimistic updates.

Use route loaders, RTK Query, TanStack Query, or another server-state tool when data is owned by the backend.

Bad fit:

```tsx
dispatch({ type: "usersLoaded", users });
```

This may be fine for a tiny app, but large apps usually benefit from a real server-state cache.

### Reducer Testability

Reducers are easy to test because they are pure functions.

```ts
it("adds a task", () => {
  const state = { tasks: [] };
  const next = tasksReducer(state, {
    type: "added",
    task: { id: "1", text: "Write tests", done: false },
  });

  expect(next.tasks).toHaveLength(1);
});
```

This is one reason reducer plus context is attractive for complex screen state. The update rules can be tested without rendering React components.

### External Store Testability

External stores can also be testable, but the strategy depends on the library.

Common approaches:

- Test reducers or store actions directly.
- Create a fresh store per test.
- Preload state for component tests.
- Assert selectors return expected slices.
- Use integration tests for full flows.

External stores often add stronger test setup requirements, but they can make app-level behavior more consistent.

### Performance Trade-Offs

Context plus reducer:

- Simple mental model.
- No external dependency.
- Good for feature-local state.
- Can rerender broad consumers when provider value changes.
- No built-in selector subscription model.

External stores:

- Better for fine-grained subscriptions.
- Better for cross-route state.
- Often have devtools and middleware.
- Add dependency and architecture decisions.
- Can be overkill for small feature state.

Performance should be measured. Do not migrate to a store because of a vague feeling. Identify the component rerendering too often and fix the subscription boundary.

### Common Mistakes

Common mistakes include:

- Putting every state value in a global store.
- Using context as a high-frequency state store for the whole app.
- Creating one huge app context with unrelated state.
- Passing `{ state, dispatch }` as a new object to every consumer without thinking about rerenders.
- Using context for server state caching.
- Moving state far above where it is needed.
- Adding Redux or another store before local and feature-scoped state are exhausted.
- Ignoring selectors and subscription granularity in external stores.
- Mutating reducer state instead of returning new state.

### Best Practices

Best practices include:

- Start with local state.
- Lift state only when multiple components need it.
- Use `useReducer` when update logic becomes event-based or complex.
- Use context to avoid prop drilling inside a clear subtree.
- Split state and dispatch contexts.
- Keep providers as low as practical.
- Split unrelated contexts.
- Use external stores when state is broad, frequent, selector-heavy, or needs tooling.
- Use server-state libraries for backend-owned data.
- Profile before changing state architecture.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the context plus reducer pattern?

<!-- question:start:context-plus-reducer-vs-external-stores-beginner-q01 -->
<!-- question-id:context-plus-reducer-vs-external-stores-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Context plus reducer combines `useReducer` for state transitions with context for sharing state and dispatch through a component subtree. The reducer defines how state changes in response to actions, and context lets components read state or dispatch actions without prop drilling.

It is useful for complex feature-local state that several nested components need.

##### Key Points to Mention

- `useReducer` owns update logic.
- Context shares state and dispatch.
- Avoids prop drilling.
- Good for scoped feature state.
- Not automatically a global app store.

<!-- question:end:context-plus-reducer-vs-external-stores-beginner-q01 -->

#### What problem does context solve?

<!-- question:start:context-plus-reducer-vs-external-stores-beginner-q02 -->
<!-- question-id:context-plus-reducer-vs-external-stores-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Context lets components read values from a provider above them in the tree without passing props through every intermediate component. It is useful for values such as theme, locale, current user, permissions, or feature state that many nested components need.

Context solves prop drilling, but it does not automatically solve all state management or performance problems.

##### Key Points to Mention

- Avoids passing props through many layers.
- Scoped by provider placement.
- Good for shared subtree values.
- Consumers rerender when context value changes.
- Not the same as a full external store.

<!-- question:end:context-plus-reducer-vs-external-stores-beginner-q02 -->

#### What is an external store?

<!-- question:start:context-plus-reducer-vs-external-stores-beginner-q03 -->
<!-- question-id:context-plus-reducer-vs-external-stores-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

An external store is a state container that lives outside React's component tree. Components subscribe to it and read state from it. Examples include Redux, Zustand, Jotai, Valtio, or custom stores.

External stores are useful when state is shared broadly, updated frequently, or needs features such as selectors, persistence, middleware, or devtools.

##### Key Points to Mention

- Lives outside the React tree.
- Components subscribe to changes.
- Often supports selectors.
- Useful for app-wide or frequently updated state.
- Adds dependency and architectural cost.

<!-- question:end:context-plus-reducer-vs-external-stores-beginner-q03 -->

#### Should every React app use a global store?

<!-- question:start:context-plus-reducer-vs-external-stores-beginner-q04 -->
<!-- question-id:context-plus-reducer-vs-external-stores-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

No. Many apps can use local state, lifted state, reducer plus context, route loaders, and server-state libraries without a global client store. A global store is useful when the app has real shared state complexity.

The tool should match the problem. Adding a store too early can add indirection and boilerplate without improving the app.

##### Key Points to Mention

- Start with local state.
- Add abstractions when state complexity justifies them.
- Not all apps need Redux or another store.
- Server state may need a data cache instead.
- Global stores have trade-offs.

<!-- question:end:context-plus-reducer-vs-external-stores-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When would you use context plus reducer?

<!-- question:start:context-plus-reducer-vs-external-stores-intermediate-q01 -->
<!-- question-id:context-plus-reducer-vs-external-stores-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would use context plus reducer when a feature or screen has moderately complex state transitions and several nested components need to read or update that state. Examples include a checkout flow, multi-step wizard, task editor, or feature-specific settings page.

It is a good fit when the state is scoped to a subtree and does not need app-wide persistence, devtools, or fine-grained selector subscriptions.

##### Key Points to Mention

- Feature-scoped state.
- Complex event-based updates.
- Nested components need access.
- Avoids prop drilling.
- No extra library needed.

<!-- question:end:context-plus-reducer-vs-external-stores-intermediate-q01 -->

#### When would you choose an external store instead?

<!-- question:start:context-plus-reducer-vs-external-stores-intermediate-q02 -->
<!-- question-id:context-plus-reducer-vs-external-stores-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would choose an external store when state is needed across distant routes, updated frequently, consumed in different slices by many components, or needs features such as selectors, persistence, middleware, undo/redo, devtools, or access from non-React code.

External stores are also useful when a large team needs stronger conventions for shared client state.

##### Key Points to Mention

- Cross-route state.
- Frequent updates.
- Many consumers need different slices.
- Selectors and fine-grained subscriptions.
- DevTools, middleware, persistence, or non-React access.

<!-- question:end:context-plus-reducer-vs-external-stores-intermediate-q02 -->

#### Why split state and dispatch into separate contexts?

<!-- question:start:context-plus-reducer-vs-external-stores-intermediate-q03 -->
<!-- question-id:context-plus-reducer-vs-external-stores-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Splitting state and dispatch lets components subscribe only to what they need. Components that only dispatch actions can read the dispatch context and avoid subscribing to state changes. Since the `dispatch` function from `useReducer` is stable, dispatch-only consumers are less likely to rerender because state changed.

This improves clarity and can reduce unnecessary rerenders.

##### Key Points to Mention

- Consumers choose state or dispatch.
- Dispatch identity is stable.
- Dispatch-only components avoid state subscriptions.
- Improves performance and clarity.
- Common reducer plus context pattern.

<!-- question:end:context-plus-reducer-vs-external-stores-intermediate-q03 -->

#### Why is context not always enough for performance?

<!-- question:start:context-plus-reducer-vs-external-stores-intermediate-q04 -->
<!-- question-id:context-plus-reducer-vs-external-stores-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Context consumers rerender when the context value they read changes. If one large context holds many unrelated values or changes frequently, many consumers can rerender even when they only care about part of the state.

External stores often provide selector-based subscriptions so components update only when their selected slice changes. Context can still work if providers are scoped and split carefully.

##### Key Points to Mention

- Context updates affect consumers.
- Large context values can be too broad.
- Frequent updates can cause rerenders.
- Split contexts or providers.
- Use external stores for selector-heavy state.

<!-- question:end:context-plus-reducer-vs-external-stores-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you decide between reducer plus context and Redux?

<!-- question:start:context-plus-reducer-vs-external-stores-advanced-q01 -->
<!-- question-id:context-plus-reducer-vs-external-stores-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start by identifying state scope, update frequency, number of consumers, debugging needs, and team conventions. If the state is feature-scoped and moderate in complexity, reducer plus context is probably enough. If the state is app-wide, frequently updated, consumed in different slices, and benefits from selectors, devtools, middleware, or persistence, Redux or another external store becomes more appropriate.

I would also separate server state from client state. Backend-owned data usually belongs in a server-state cache or route loader, not a hand-rolled reducer.

##### Key Points to Mention

- Scope and lifetime of state.
- Update frequency.
- Number and type of consumers.
- Selector and devtools needs.
- Team conventions.
- Server state is a separate concern.

<!-- question:end:context-plus-reducer-vs-external-stores-advanced-q01 -->

#### How would you optimize a context plus reducer provider?

<!-- question:start:context-plus-reducer-vs-external-stores-advanced-q02 -->
<!-- question-id:context-plus-reducer-vs-external-stores-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

I would place the provider as low as practical, split unrelated state into separate providers, split state and dispatch contexts, and avoid putting unstable object literals or functions in context values. If only part of the tree needs a feature reducer, the provider should wrap only that feature.

If consumers still need fine-grained subscriptions to many slices, I would consider an external store instead of fighting context.

##### Key Points to Mention

- Narrow provider scope.
- Split unrelated contexts.
- Split state and dispatch.
- Stabilize provider values when needed.
- Move to external store for fine-grained selectors.

<!-- question:end:context-plus-reducer-vs-external-stores-advanced-q02 -->

#### What are risks of putting server data in reducer plus context?

<!-- question:start:context-plus-reducer-vs-external-stores-advanced-q03 -->
<!-- question-id:context-plus-reducer-vs-external-stores-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Server data needs loading state, error state, staleness, refetching, retries, request deduplication, cache invalidation, and optimistic update coordination. A reducer plus context can model some of this, but teams often end up rebuilding a server-state cache badly.

For backend-owned data, route loaders, RTK Query, TanStack Query, or another data-fetching cache are usually a better fit.

##### Key Points to Mention

- Server state has cache concerns.
- Needs invalidation and refetching.
- Needs stale/error/loading behavior.
- Reducers can become a hand-rolled cache.
- Use server-state tools when appropriate.

<!-- question:end:context-plus-reducer-vs-external-stores-advanced-q03 -->

#### How would you migrate from context plus reducer to an external store?

<!-- question:start:context-plus-reducer-vs-external-stores-advanced-q04 -->
<!-- question-id:context-plus-reducer-vs-external-stores-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would first identify the state slice causing pain and avoid migrating unrelated state. Then I would create the external store with equivalent actions/selectors, update custom hooks to read from the new store, and keep component call sites as stable as possible. Tests should cover reducer behavior before and after migration.

I would migrate incrementally and avoid running two sources of truth for the same state longer than necessary.

##### Key Points to Mention

- Migrate only the painful slice.
- Keep custom hooks as the boundary.
- Preserve component API where possible.
- Avoid duplicate sources of truth.
- Test before and after behavior.

<!-- question:end:context-plus-reducer-vs-external-stores-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
