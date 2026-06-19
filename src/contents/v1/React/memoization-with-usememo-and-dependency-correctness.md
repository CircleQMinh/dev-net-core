---
id: memoization-with-usememo-and-dependency-correctness
topic: Hooks, effects, and custom hooks
subtopic: Memoization with useMemo and dependency correctness
category: React
---

## Overview

`useMemo` is a React Hook that caches the result of a pure calculation between renders until its dependencies change. It is mainly a performance optimization. It can help skip expensive recalculations, provide stable derived values to memoized children, or avoid recreating dependency values used by other hooks.

```tsx
function ProductList({
  products,
  query,
}: {
  products: Product[];
  query: string;
}) {
  const visibleProducts = useMemo(
    () => filterProducts(products, query),
    [products, query]
  );

  return <List items={visibleProducts} />;
}
```

Dependency correctness means the dependency array includes every reactive value used by the memoized calculation. Reactive values include props, state, and variables or functions declared inside the component. React compares dependencies with `Object.is`; if none changed, React can reuse the cached result.

For interviews, this topic matters because many candidates overuse `useMemo`, omit dependencies, depend on unstable objects, or treat memoization as a correctness tool. A strong answer explains what `useMemo` does, when it helps, when it is unnecessary, how dependency arrays work, and why memoized calculations must stay pure.

The practical goal is to use memoization deliberately: fix data flow first, measure or identify real cost, then memoize the smallest useful pure calculation with correct dependencies.

## Core Concepts

### What `useMemo` Does

`useMemo` caches a calculation result.

```tsx
const result = useMemo(() => calculate(input), [input]);
```

It takes:

- A calculation function that takes no arguments and returns a value.
- A dependency array containing every reactive value used inside the calculation.

On the initial render, React calls the calculation. On later renders, React compares dependencies with the previous render. If dependencies are the same by `Object.is`, React returns the cached value. If any dependency changed, React runs the calculation again.

### `useMemo` Is a Performance Optimization

The component should still be correct without `useMemo`.

This should be correct:

```tsx
const visibleTodos = filterTodos(todos, tab);
```

Then this may improve performance:

```tsx
const visibleTodos = useMemo(
  () => filterTodos(todos, tab),
  [todos, tab]
);
```

If removing `useMemo` breaks behavior, the component has a design problem. State, refs, or clearer data flow may be the correct tool.

Use `useMemo` for:

- Expensive pure calculations.
- Stable props for a component wrapped in `memo`.
- Stable values used as dependencies of other hooks.

Avoid using it as a blanket optimization around every value.

### Dependency Arrays

The dependency array must include every reactive value used in the calculation.

```tsx
const visibleProducts = useMemo(
  () => products.filter((product) => product.name.includes(query)),
  [products, query]
);
```

`products` and `query` are dependencies because the calculation reads them.

This is wrong:

```tsx
const visibleProducts = useMemo(
  () => products.filter((product) => product.name.includes(query)),
  [products]
);
```

If `query` changes, the memoized value may stay stale.

The dependency list should be inline and have a constant number of items:

```tsx
[products, query]
```

Do not build dependency arrays dynamically.

### What Counts as a Reactive Value

Reactive values include:

- Props.
- State.
- Context values.
- Variables declared inside the component body.
- Functions declared inside the component body.
- Values returned by hooks.

Example:

```tsx
function SearchResults({
  products,
  query,
}: {
  products: Product[];
  query: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();

  const visibleProducts = useMemo(() => {
    return products.filter((product) =>
      product.name.toLowerCase().includes(normalizedQuery)
    );
  }, [products, normalizedQuery]);

  return <List items={visibleProducts} />;
}
```

`normalizedQuery` is reactive because it is declared in the component body and changes when `query` changes. You can also move it inside the calculation and depend on `query` directly.

```tsx
const visibleProducts = useMemo(() => {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) =>
    product.name.toLowerCase().includes(normalizedQuery)
  );
}, [products, query]);
```

This is often clearer.

### Dependency Comparison Uses Identity

React compares dependencies with `Object.is`.

Primitive values compare by value:

```tsx
const count = 1;
const query = "react";
```

Objects, arrays, and functions compare by reference:

```tsx
const options = { matchMode: "whole-word", query };
```

If `options` is created during render, it is a new object every render. Depending on it defeats memoization:

```tsx
const options = { matchMode: "whole-word", query };

const results = useMemo(
  () => searchProducts(products, options),
  [products, options]
);
```

Better:

```tsx
const results = useMemo(() => {
  const options = { matchMode: "whole-word", query };

  return searchProducts(products, options);
}, [products, query]);
```

Now the calculation depends on stable primitive inputs instead of a new object reference.

### Expensive Calculations

Most calculations are not expensive enough to need `useMemo`.

Usually fine:

```tsx
const fullName = `${firstName} ${lastName}`;
const isValid = email.includes("@") && password.length >= 8;
```

Potentially worth memoizing:

- Filtering or sorting thousands of items.
- Expensive data transformation.
- Heavy parsing.
- Calculating layout data.
- Creating a large derived tree.

Measure when unsure:

```tsx
console.time("filter products");
const visibleProducts = filterProducts(products, query);
console.timeEnd("filter products");
```

Profile production builds when possible. Development mode and Strict Mode can make timings misleading.

### `useMemo` vs Derived State

Do not store derived data in state just to avoid recalculation.

Bad:

```tsx
const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);

useEffect(() => {
  setVisibleProducts(filterProducts(products, query));
}, [products, query]);
```

Better:

```tsx
const visibleProducts = filterProducts(products, query);
```

If it is expensive:

```tsx
const visibleProducts = useMemo(
  () => filterProducts(products, query),
  [products, query]
);
```

The source of truth remains `products` and `query`. The memoized value is only a cached calculation result.

### `useMemo` and `memo`

`memo` can skip re-rendering a child when its props are unchanged. `useMemo` can help keep a derived prop stable.

```tsx
const ProductTable = memo(function ProductTable({
  rows,
}: {
  rows: ProductRow[];
}) {
  return <Table rows={rows} />;
});
```

Parent:

```tsx
function ProductPage({ products, query, theme }: Props) {
  const rows = useMemo(
    () => buildRows(products, query),
    [products, query]
  );

  return <ProductTable rows={rows} />;
}
```

If `theme` changes but `products` and `query` do not, `rows` can keep the same reference, so `ProductTable` may skip re-rendering.

Without `useMemo`, `buildRows` might create a new array every render, making `memo` less useful.

### `useMemo` for Hook Dependencies

Sometimes a value is used as a dependency of another hook.

Problem:

```tsx
const options = {
  serverUrl,
  roomId,
};

useEffect(() => {
  const connection = createConnection(options);
  connection.connect();

  return () => connection.disconnect();
}, [options]);
```

The object is new every render, so the effect reconnects too often.

One fix:

```tsx
const options = useMemo(
  () => ({ serverUrl, roomId }),
  [serverUrl, roomId]
);

useEffect(() => {
  const connection = createConnection(options);
  connection.connect();

  return () => connection.disconnect();
}, [options]);
```

Often better:

```tsx
useEffect(() => {
  const options = { serverUrl, roomId };
  const connection = createConnection(options);
  connection.connect();

  return () => connection.disconnect();
}, [serverUrl, roomId]);
```

Move object creation inside the effect when the object is only needed there.

### `useMemo` vs `useCallback`

`useMemo` caches a value. `useCallback` caches a function reference.

These are equivalent in spirit:

```tsx
const handleSubmit = useMemo(() => {
  return (order: Order) => {
    submitOrder(productId, order);
  };
}, [productId]);
```

```tsx
const handleSubmit = useCallback((order: Order) => {
  submitOrder(productId, order);
}, [productId]);
```

Use `useCallback` for functions because it avoids the extra nested function shape.

Only stabilize function references when it matters:

- Passing a callback to a memoized child.
- Using a callback as a dependency of another hook.
- Returning stable callbacks from a custom hook.

### Pure Calculations

The `useMemo` calculation runs during rendering, so it must be pure.

Bad:

```tsx
const visibleTodos = useMemo(() => {
  todos.push({ id: "new", text: "Mutated" });
  return filterTodos(todos, tab);
}, [todos, tab]);
```

This mutates a prop during render.

Good:

```tsx
const visibleTodos = useMemo(() => {
  return filterTodos(todos, tab);
}, [todos, tab]);
```

In development Strict Mode, React may call the calculation more than once to help expose accidental impurities. Pure calculations are safe under repeated calls.

### Cache Is Not a Semantic Guarantee

`useMemo` is allowed to discard its cached value for specific reasons, such as development edits or initial mount suspension. This is fine when `useMemo` is only a performance optimization.

Do not use `useMemo` to store information that must persist for correctness.

Use state when changes should trigger rendering:

```tsx
const [selectedId, setSelectedId] = useState<string | null>(null);
```

Use a ref when mutable data must persist without causing renders:

```tsx
const latestRequestId = useRef(0);
```

Use `useMemo` only for recalculable values.

### React Compiler Nuance

Modern React tooling is moving toward more automatic memoization through the React Compiler. That reduces the need for manual `useMemo` in many cases when the compiler is available and enabled.

Interview-friendly answer:

- Understand manual `useMemo` because many codebases still use it.
- Do not add `useMemo` everywhere.
- Keep render logic pure.
- Prefer clear data flow.
- Let compiler/tooling handle routine memoization where the project supports it.

The principles of dependency correctness and purity still matter.

### Common Mistakes

Common mistakes include:

- Using `useMemo` for every object or calculation.
- Omitting dependencies to avoid recalculation.
- Depending on an object or function created during render.
- Using `useMemo` to make broken code work.
- Mutating props or state inside the memoized calculation.
- Storing derived values in state instead of calculating them.
- Expecting `useMemo` to prevent all child renders without `memo`.
- Measuring performance only in development mode.
- Using `useMemo` where `useCallback` communicates intent better.
- Depending on the cache as persistent storage.

### Best Practices

Use these rules of thumb:

- Write correct code first without memoization.
- Memoize only expensive pure calculations or identity-sensitive values.
- Include every reactive value used by the calculation.
- Prefer primitive dependencies when possible.
- Move object creation inside the memoized calculation.
- Move object creation inside effects when the object is effect-only.
- Use `useCallback` for function references.
- Treat `useMemo` as a performance optimization, not storage.
- Measure before optimizing when the cost is uncertain.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does `useMemo` do?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-beginner-q01 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`useMemo` caches the result of a pure calculation between renders until its dependencies change.

```tsx
const visibleTodos = useMemo(
  () => filterTodos(todos, tab),
  [todos, tab]
);
```

On the first render, React runs the calculation. On later renders, React compares dependencies. If they are the same, React returns the cached value. If any dependency changed, React runs the calculation again.

##### Key Points to Mention

- `useMemo` memoizes a calculation result.
- It runs during rendering.
- Dependencies decide when it recalculates.
- It is mainly a performance optimization.
- The calculation should be pure.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-beginner-q01 -->

#### What should go in a `useMemo` dependency array?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-beginner-q02 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The dependency array should include every reactive value used inside the calculation. Reactive values include props, state, context values, and variables or functions declared inside the component body.

```tsx
const result = useMemo(() => {
  return search(items, query);
}, [items, query]);
```

If `query` is used but omitted, the memoized result can become stale when `query` changes.

##### Key Points to Mention

- Include all reactive values used by the calculation.
- Props and state are dependencies.
- Component-local variables can also be dependencies.
- Missing dependencies create stale values.
- The dependency array should be inline and stable in length.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-beginner-q02 -->

#### Is `useMemo` required for correctness?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-beginner-q03 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

No. `useMemo` should be used as a performance optimization. The component should still work correctly if the calculation runs on every render.

If removing `useMemo` breaks the code, the value probably should be stored in state, a ref, context, or derived more directly from props and state. `useMemo` caches recalculable values; it should not be treated as persistent storage.

##### Key Points to Mention

- `useMemo` is for performance.
- Correctness should not depend on the cache.
- React may discard cached values for specific reasons.
- Use state or refs for semantic persistence.
- Fix data flow before memoizing.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-beginner-q03 -->

#### When should you avoid `useMemo`?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-beginner-q04 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Avoid `useMemo` for cheap calculations, simple string or boolean derivations, and code that is not causing a performance or identity problem.

```tsx
const fullName = `${firstName} ${lastName}`;
const isValid = email.includes("@");
```

These do not need memoization. Adding `useMemo` everywhere can make code harder to read and does not automatically make the app faster.

##### Key Points to Mention

- Most calculations are cheap.
- Memoization adds complexity.
- It does not make first render faster.
- It is unnecessary for simple derived values.
- Use it when cost or identity stability matters.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why can object dependencies defeat memoization?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-intermediate-q01 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Objects created during render have a new reference every render. Since React compares dependencies by identity, a new object dependency looks changed even if its contents are the same.

Bad:

```tsx
const options = { matchMode: "whole-word", query };

const results = useMemo(
  () => search(items, options),
  [items, options]
);
```

Better:

```tsx
const results = useMemo(() => {
  const options = { matchMode: "whole-word", query };

  return search(items, options);
}, [items, query]);
```

Now the dependency list uses stable source values.

##### Key Points to Mention

- Object literals create new references.
- Dependencies are compared by `Object.is`.
- A new object reference invalidates the memo.
- Move object creation inside the calculation when possible.
- Prefer primitive source dependencies.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-intermediate-q01 -->

#### How does `useMemo` relate to `React.memo`?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-intermediate-q02 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`React.memo` can skip re-rendering a child when its props are unchanged. `useMemo` can help keep a derived prop stable so the memoized child can actually skip rendering.

```tsx
const rows = useMemo(
  () => buildRows(products, query),
  [products, query]
);

return <ProductTable rows={rows} />;
```

If `buildRows` returns a new array every render, a memoized `ProductTable` receives a new `rows` prop and may re-render. `useMemo` can keep the same array reference when inputs have not changed.

##### Key Points to Mention

- `memo` memoizes component rendering.
- `useMemo` memoizes a calculated value.
- Stable derived props can help memoized children.
- Without `memo`, stable props may not skip child rendering.
- Use this when the child render cost matters.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-intermediate-q02 -->

#### What is the difference between `useMemo` and `useCallback`?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-intermediate-q03 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`useMemo` caches a calculated value. `useCallback` caches a function reference.

```tsx
const sortedItems = useMemo(
  () => sortItems(items),
  [items]
);
```

```tsx
const handleSubmit = useCallback((order: Order) => {
  submitOrder(productId, order);
}, [productId]);
```

You can technically return a function from `useMemo`, but `useCallback` communicates that the value is a callback and avoids an extra nested function.

##### Key Points to Mention

- `useMemo` returns a memoized value.
- `useCallback` returns a memoized function.
- Both use dependency arrays.
- Use `useCallback` for callbacks passed to memoized children or hooks.
- Do not memoize every function by default.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-intermediate-q03 -->

#### How do you decide whether a calculation is expensive enough to memoize?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-intermediate-q04 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Start by assuming simple calculations are cheap. Filtering or sorting thousands of items, heavy parsing, or large transformations may be expensive. Measure when unsure.

```tsx
console.time("filter");
const visibleItems = filterItems(items, query);
console.timeEnd("filter");
```

If the calculation takes noticeable time during common interactions and dependencies often stay the same, try `useMemo` and verify that the interaction improves. Prefer production builds and realistic devices for performance testing because development timings can be misleading.

##### Key Points to Mention

- Most calculations are not expensive.
- Large loops and heavy transformations are candidates.
- Measure before optimizing when unsure.
- Development mode can distort timings.
- `useMemo` helps updates, not the initial calculation.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you fix missing or excessive dependencies in `useMemo`?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-advanced-q01 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

First make the dependency list match the calculation. Do not omit values to reduce recalculation. If the list is too broad or includes unstable values, change the calculation structure.

Common fixes:

- Move temporary object creation inside the memo callback.
- Depend on primitive source values instead of derived objects.
- Move unrelated calculations into separate `useMemo` calls.
- Remove `useMemo` if the calculation is cheap.
- Stabilize a function with `useCallback` only when identity matters.

The goal is not a shorter dependency list by force. The goal is correct dependencies that reflect clear code.

##### Key Points to Mention

- Dependencies must match used reactive values.
- Missing dependencies create stale results.
- Excess dependencies often signal unstable objects or mixed logic.
- Change code structure rather than lying to the linter.
- Split calculations when they depend on different inputs.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-advanced-q01 -->

#### Why must a `useMemo` calculation be pure?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-advanced-q02 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

The calculation runs during rendering, and render logic should be pure. It should not mutate props, mutate state, call APIs, start timers, write to storage, or cause side effects.

In development Strict Mode, React may call memo calculations more than once to help reveal accidental impurities. If the calculation mutates a prop array, duplicate calls can make the mutation obvious.

Good memo calculations derive a value from inputs and return it without changing existing objects.

##### Key Points to Mention

- `useMemo` runs during render.
- Render calculations should be pure.
- Do not mutate props or state.
- Strict Mode can call calculations more than once in development.
- Side effects belong in event handlers or effects.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-advanced-q02 -->

#### Should you use `useMemo` to stabilize an object used by an effect?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-advanced-q03 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Sometimes, but first try to remove the object dependency. If the object is only needed inside the effect, create it inside the effect and depend on its primitive inputs.

Better than memoizing the object:

```tsx
useEffect(() => {
  const options = { serverUrl, roomId };
  const connection = createConnection(options);
  connection.connect();

  return () => connection.disconnect();
}, [serverUrl, roomId]);
```

Memoizing the object can work, but `useMemo` is still a performance optimization, not a semantic guarantee. Simpler code with direct primitive dependencies is usually better.

##### Key Points to Mention

- Object dependencies often change every render.
- Creating the object inside the effect can remove the dependency.
- Depend on primitive source values.
- `useMemo` can stabilize objects but may be unnecessary.
- Do not suppress effect dependencies.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-advanced-q03 -->

#### How does the React Compiler affect manual memoization decisions?

<!-- question:start:memoization-with-usememo-and-dependency-correctness-advanced-q04 -->
<!-- question-id:memoization-with-usememo-and-dependency-correctness-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

The React Compiler can automatically memoize many values and calculations when it is available and enabled in a project. This reduces the need to manually add `useMemo` everywhere.

However, developers still need to understand memoization principles because many codebases do not use the compiler, and because purity, stable dependencies, and clear data flow remain important.

A good answer is balanced: do not cargo-cult manual memoization, but understand when `useMemo` is useful and how to write correct dependency arrays.

##### Key Points to Mention

- The compiler can reduce manual memoization needs.
- Many projects still rely on manual hooks.
- Pure render logic remains important.
- Dependency correctness still matters.
- Avoid adding `useMemo` by habit.

<!-- question:end:memoization-with-usememo-and-dependency-correctness-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
