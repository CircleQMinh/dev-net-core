---
id: narrowing-and-control-flow-analysis
topic: TypeScript for React
subtopic: Narrowing and control-flow analysis
category: React
---

## Overview

Narrowing is TypeScript's ability to refine a broad type into a more specific type based on runtime checks and code flow. If a value starts as `string | number`, TypeScript will not let you call string-only or number-only methods until the code proves which case you are handling.

```ts
function format(value: string | number) {
  if (typeof value === "number") {
    return value.toFixed(2);
  }

  return value.trim();
}
```

Control-flow analysis is how TypeScript follows branches, returns, assignments, guards, and unreachable paths to understand the most specific type at each point in a function. This matters heavily in React because components frequently handle nullable values, API responses, form inputs, discriminated UI states, reducer actions, route params, and event targets.

For interviews, this topic tests whether a developer can write safe TypeScript without fighting the compiler. A strong candidate should be able to explain how `typeof`, `instanceof`, equality checks, `in`, discriminated unions, custom type predicates, assertion functions, and exhaustive `never` checks help TypeScript prove correctness.

The practical goal is not to add random type annotations. The goal is to model possible states clearly and write checks that make impossible states hard to represent.

## Core Concepts

### What Narrowing Means

Narrowing means refining a value from a wider type to a narrower type.

```ts
type UserId = string | number;

function normalizeUserId(id: UserId) {
  if (typeof id === "number") {
    return id.toString();
  }

  return id.trim();
}
```

Before the `if`, `id` is `string | number`. Inside the `number` branch, TypeScript treats it as `number`. After the branch returns, TypeScript knows the remaining path must be `string`.

This lets TypeScript validate ordinary JavaScript logic without requiring separate type-specific functions for every case.

### Control-Flow Analysis

Control-flow analysis means TypeScript tracks how execution can move through your code.

```ts
function getLabel(value: string | null) {
  if (value === null) {
    return "Unknown";
  }

  return value.toUpperCase();
}
```

After the early return, TypeScript knows `value` cannot be `null`.

The same idea works with branches that split and rejoin:

```ts
function parseInput(input: string | number | boolean) {
  let result: string;

  if (typeof input === "boolean") {
    result = input ? "yes" : "no";
  } else if (typeof input === "number") {
    result = input.toFixed(0);
  } else {
    result = input.trim();
  }

  return result;
}
```

TypeScript follows assignments and branches to verify that `result` is assigned correctly before being returned.

### `typeof` Guards

`typeof` is useful for primitive values and functions.

```ts
function renderCount(count: number | string) {
  if (typeof count === "number") {
    return count.toLocaleString();
  }

  return count;
}
```

Common `typeof` results include:

- `"string"`
- `"number"`
- `"boolean"`
- `"undefined"`
- `"object"`
- `"function"`
- `"symbol"`
- `"bigint"`

Important JavaScript quirk:

```ts
typeof null; // "object"
```

So this is not enough:

```ts
function printNames(names: string[] | null) {
  if (typeof names === "object") {
    names.map((name) => name.toUpperCase()); // names can still be null.
  }
}
```

Better:

```ts
function printNames(names: string[] | null) {
  if (Array.isArray(names)) {
    return names.map((name) => name.toUpperCase());
  }

  return [];
}
```

### Truthiness Narrowing

Truthiness checks remove values that JavaScript treats as false:

- `false`
- `0`
- `0n`
- `""`
- `null`
- `undefined`
- `NaN`

Example:

```tsx
function UserName({ name }: { name?: string }) {
  if (!name) {
    return <span>Anonymous</span>;
  }

  return <span>{name.toUpperCase()}</span>;
}
```

This narrows `name` from `string | undefined` to `string`, but it also treats an empty string as missing. That may or may not be correct.

When empty strings or zero are valid values, use explicit checks:

```tsx
function CharacterCount({ count }: { count: number | null }) {
  if (count === null) {
    return <span>Not calculated</span>;
  }

  return <span>{count}</span>;
}
```

Truthiness is convenient, but it can hide valid falsy values. Interviewers often look for this nuance.

### Equality Narrowing

TypeScript narrows values through equality checks.

```ts
function formatStatus(status: "idle" | "loading" | "success" | "error") {
  if (status === "loading") {
    return "Loading...";
  }

  return status;
}
```

It can also narrow by comparing two variables:

```ts
function compare(x: string | number, y: string | boolean) {
  if (x === y) {
    return x.toUpperCase();
  }

  return String(x);
}
```

In the true branch, the only shared possible type is `string`, so TypeScript treats both values as strings.

For nullable values, explicit checks are clear:

```ts
function getEmail(user: { email?: string | null }) {
  if (user.email == null) {
    return "No email";
  }

  return user.email.toLowerCase();
}
```

The `== null` check intentionally removes both `null` and `undefined`. Many teams still prefer explicit `=== null || === undefined` checks for readability.

### `in` Operator Narrowing

The `in` operator checks whether a property exists on an object.

```ts
type ApiSuccess = {
  data: string[];
};

type ApiFailure = {
  error: string;
};

type ApiResult = ApiSuccess | ApiFailure;

function renderResult(result: ApiResult) {
  if ("data" in result) {
    return result.data.join(", ");
  }

  return result.error;
}
```

This is useful when union members have different property names.

Be careful with optional properties:

```ts
type Fish = { swim?: () => void };
type Bird = { fly: () => void };

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim?.();
  }
}
```

The property may exist but still be optional, so the value may need another check.

### `instanceof` Narrowing

`instanceof` checks whether a value is an instance of a class or constructor.

```ts
function formatDate(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}
```

This is useful for built-in classes such as `Date`, `Error`, and custom classes.

React example:

```tsx
function ErrorMessage({ error }: { error: unknown }) {
  if (error instanceof Error) {
    return <p>{error.message}</p>;
  }

  return <p>Something went wrong.</p>;
}
```

Use `instanceof` only when runtime values are actually class instances. API data parsed from JSON is plain object data, not class instances.

### Discriminated Unions

A discriminated union is a union where each member has a shared literal property that identifies its shape.

```ts
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };
```

The `status` field is the discriminant.

```tsx
function UsersPanel({ state }: { state: RequestState }) {
  switch (state.status) {
    case "idle":
      return <p>Start searching.</p>;
    case "loading":
      return <p>Loading...</p>;
    case "success":
      return <UserList users={state.data} />;
    case "error":
      return <p>{state.error}</p>;
  }
}
```

This is one of the most useful TypeScript patterns in React because UI state often has mutually exclusive variants.

Bad state model:

```ts
type BadState = {
  loading: boolean;
  data?: User[];
  error?: string;
};
```

This allows invalid combinations like loading with both data and error. A discriminated union prevents those invalid states.

### Reducer Actions and Narrowing

Reducers are a natural fit for discriminated unions.

```ts
type CounterAction =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "set"; value: number };

type CounterState = {
  count: number;
};

function counterReducer(state: CounterState, action: CounterAction): CounterState {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "set":
      return { count: action.value };
  }
}
```

Inside the `"set"` case, TypeScript knows `action` has a `value` property. Inside `"increment"`, it knows there is no `value` property.

This helps prevent dispatching invalid actions:

```ts
dispatch({ type: "set", value: 10 });
dispatch({ type: "set" }); // Error.
dispatch({ type: "increment", value: 10 }); // Error.
```

### User-Defined Type Predicates

Sometimes TypeScript cannot infer enough from inline checks. A user-defined type guard returns a type predicate:

```ts
type User = {
  id: string;
  name: string;
};

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}
```

Now callers get narrowing:

```ts
function renderUnknown(value: unknown) {
  if (isUser(value)) {
    return value.name;
  }

  return "Invalid user";
}
```

Type predicates are powerful, but TypeScript trusts the function's return type. If `isUser` lies or checks too little, the rest of the code becomes unsafe.

For untrusted API data, runtime validation libraries or carefully tested validators are often better than casual hand-written guards.

### Assertion Functions

An assertion function throws or stops execution when a condition is not met, and tells TypeScript that the value is narrowed after the function returns.

```ts
function assertUser(value: unknown): asserts value is User {
  if (!isUser(value)) {
    throw new Error("Expected User");
  }
}
```

Usage:

```ts
async function loadUser() {
  const response = await fetch("/api/me");
  const json: unknown = await response.json();

  assertUser(json);

  return json.name;
}
```

After `assertUser(json)`, TypeScript treats `json` as `User`.

Assertion functions are useful at boundaries:

- API response parsing.
- Route loader validation.
- Environment configuration.
- Context hooks that require a provider.

React context example:

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

The explicit runtime check narrows away `null` for callers.

### Narrowing `unknown`

`unknown` is safer than `any` for values whose type is not yet known. You must narrow it before using it.

```ts
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}
```

In React, `unknown` is useful for caught errors and external data:

```tsx
try {
  await saveForm(values);
} catch (error: unknown) {
  setError(getErrorMessage(error));
}
```

Avoid immediately casting external data:

```ts
const user = json as User; // This tells TypeScript to trust you, but it validates nothing.
```

Prefer validation and narrowing:

```ts
if (!isUser(json)) {
  throw new Error("Invalid response");
}
```

### Exhaustiveness Checking with `never`

Exhaustiveness checking verifies that every union member has been handled.

```ts
type ThemeMode = "light" | "dark" | "system";

function getThemeLabel(mode: ThemeMode) {
  switch (mode) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    case "system":
      return "System";
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}
```

If someone later adds `"high-contrast"` to `ThemeMode`, TypeScript will fail at the `never` assignment until the new case is handled.

This is valuable in React render functions:

```tsx
function RequestView({ state }: { state: RequestState }) {
  switch (state.status) {
    case "idle":
      return <EmptyState />;
    case "loading":
      return <Spinner />;
    case "success":
      return <UserList users={state.data} />;
    case "error":
      return <ErrorBanner message={state.error} />;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
```

The compiler helps keep UI rendering synchronized with the state model.

### Narrowing and Destructuring

Be careful when destructuring union values too early.

```ts
type Props =
  | { kind: "link"; href: string; onClick?: never }
  | { kind: "button"; onClick: () => void; href?: never };

function Action(props: Props) {
  if (props.kind === "link") {
    return <a href={props.href}>Open</a>;
  }

  return <button onClick={props.onClick}>Open</button>;
}
```

This keeps the discriminant and related fields together on `props`. Premature destructuring can make code harder to narrow and harder to read, especially in complex unions.

Prefer narrowing the object first, then reading variant-specific fields.

### Narrowing Does Not Replace Runtime Validation

TypeScript checks your code at compile time. It does not validate runtime data by itself.

```ts
type User = {
  id: string;
  name: string;
};

const user = await response.json() as User;
```

This cast only changes TypeScript's belief. It does not prove the server returned a valid user.

For trusted internal data, types may be enough. For external data, use runtime checks:

```ts
const json: unknown = await response.json();

if (!isUser(json)) {
  throw new Error("Invalid user response");
}
```

Interviewers often expect this distinction: TypeScript narrows based on checks in your code, but it cannot make untrusted runtime data safe without actual validation logic.

### Common Mistakes

Common mistakes include:

- Using `any` instead of `unknown` and losing type safety.
- Using `as` assertions to silence the compiler instead of proving the type.
- Relying on truthiness when `0` or `""` are valid values.
- Forgetting that `typeof null` is `"object"`.
- Writing weak type guards that only check one property.
- Not using discriminated unions for mutually exclusive UI states.
- Missing exhaustive checks in reducers and render switches.
- Destructuring complex unions before narrowing.
- Assuming TypeScript validates API data automatically.

### Best Practices

Use these rules of thumb:

- Model mutually exclusive states with discriminated unions.
- Prefer explicit null and undefined checks when falsy values are valid.
- Use `unknown` at external boundaries and narrow it.
- Write type predicates only when they perform real runtime checks.
- Use assertion functions for boundary validation and required context hooks.
- Use `never` checks for important union switches.
- Avoid `as` unless you have a clear reason and no better proof path.
- Let control flow do the work instead of over-annotating local variables.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is narrowing in TypeScript?

<!-- question:start:narrowing-and-control-flow-analysis-beginner-q01 -->
<!-- question-id:narrowing-and-control-flow-analysis-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Narrowing is TypeScript's process of refining a value from a broader type to a more specific type based on checks in the code. For example, a value might start as `string | number`. After checking `typeof value === "string"`, TypeScript treats the value as a string inside that branch.

```ts
function format(value: string | number) {
  if (typeof value === "string") {
    return value.trim();
  }

  return value.toFixed(2);
}
```

Narrowing lets developers safely work with union types without unsafe casts. In React, it is used for nullable props, API responses, event values, reducer actions, and UI state variants.

##### Key Points to Mention

- Narrowing refines broad types into specific types.
- TypeScript narrows through runtime checks.
- Common guards include `typeof`, equality checks, `in`, and `instanceof`.
- It is essential when working with unions.
- React code often uses narrowing for props, state, and API data.

<!-- question:end:narrowing-and-control-flow-analysis-beginner-q01 -->

#### What is control-flow analysis?

<!-- question:start:narrowing-and-control-flow-analysis-beginner-q02 -->
<!-- question-id:narrowing-and-control-flow-analysis-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Control-flow analysis is TypeScript's ability to follow possible execution paths through code and update types based on branches, returns, assignments, and guards. TypeScript understands that after an early return for `null`, the rest of the function can treat the value as non-null.

```ts
function getName(name: string | null) {
  if (name === null) {
    return "Anonymous";
  }

  return name.toUpperCase();
}
```

In this example, TypeScript knows `name` is a string after the `null` branch returns. This makes ordinary JavaScript control flow useful for type safety.

##### Key Points to Mention

- TypeScript follows branches and returns.
- Early returns can narrow the remaining code path.
- Assignments can affect the observed type.
- Control flow can split and merge.
- It helps avoid unnecessary casts.

<!-- question:end:narrowing-and-control-flow-analysis-beginner-q02 -->

#### How does `typeof` narrowing work?

<!-- question:start:narrowing-and-control-flow-analysis-beginner-q03 -->
<!-- question-id:narrowing-and-control-flow-analysis-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`typeof` narrowing uses JavaScript's `typeof` operator to distinguish primitive values and functions. TypeScript recognizes checks such as `typeof value === "string"` or `typeof value === "number"` and narrows the variable in that branch.

```ts
function double(value: number | string) {
  if (typeof value === "number") {
    return value * 2;
  }

  return Number(value) * 2;
}
```

It is useful for `string`, `number`, `boolean`, `undefined`, `function`, `bigint`, and `symbol`. One important caveat is that `typeof null` is `"object"`, so object checks also need a `value !== null` check when null is possible.

##### Key Points to Mention

- `typeof` is a runtime JavaScript operator.
- TypeScript understands it as a type guard.
- It works well for primitives and functions.
- `typeof null` is `"object"`.
- It is often used before calling type-specific methods.

<!-- question:end:narrowing-and-control-flow-analysis-beginner-q03 -->

#### Why can truthiness checks be risky?

<!-- question:start:narrowing-and-control-flow-analysis-beginner-q04 -->
<!-- question-id:narrowing-and-control-flow-analysis-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Truthiness checks narrow away values that JavaScript treats as false, such as `null`, `undefined`, `""`, `0`, `false`, and `NaN`. This is convenient when you only care whether a value exists, but it can be wrong when empty strings or zero are valid values.

```tsx
function Count({ count }: { count: number | null }) {
  if (!count) {
    return <span>No count</span>;
  }

  return <span>{count}</span>;
}
```

This incorrectly treats `0` as missing. A better check is explicit:

```tsx
if (count === null) {
  return <span>No count</span>;
}
```

##### Key Points to Mention

- Truthiness removes all falsy values.
- `0` and `""` may be valid data.
- Explicit null checks are often clearer.
- Truthiness can hide edge-case bugs.
- React rendering often needs to preserve valid falsy values.

<!-- question:end:narrowing-and-control-flow-analysis-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do discriminated unions help React UI state?

<!-- question:start:narrowing-and-control-flow-analysis-intermediate-q01 -->
<!-- question-id:narrowing-and-control-flow-analysis-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Discriminated unions model mutually exclusive states using a shared literal property, often called `status`, `kind`, or `type`. TypeScript uses that property to narrow to the correct variant.

```ts
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };
```

In a component, switching on `state.status` gives access to only the fields that exist for that variant. This prevents invalid combinations like `loading: true` with both `data` and `error`. It also makes render logic easier to reason about.

##### Key Points to Mention

- A discriminant is a shared literal property.
- Each variant has fields specific to that state.
- Switching on the discriminant narrows the type.
- It prevents invalid UI state combinations.
- It is useful for async state, reducers, and component variants.

<!-- question:end:narrowing-and-control-flow-analysis-intermediate-q01 -->

#### What is a user-defined type guard?

<!-- question:start:narrowing-and-control-flow-analysis-intermediate-q02 -->
<!-- question-id:narrowing-and-control-flow-analysis-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A user-defined type guard is a function that returns a type predicate such as `value is User`. It performs a runtime check and tells TypeScript that a value has a more specific type when the function returns true.

```ts
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}
```

After `if (isUser(value))`, TypeScript treats `value` as `User`. This is useful for narrowing `unknown` values from APIs, storage, route data, or loosely typed library callbacks.

The guard must be honest. TypeScript trusts the predicate, so a weak or incorrect guard creates false safety.

##### Key Points to Mention

- It returns a predicate like `value is User`.
- It combines runtime checking with compile-time narrowing.
- It is useful for `unknown` data.
- TypeScript trusts the guard's signature.
- Weak guards can be dangerous.

<!-- question:end:narrowing-and-control-flow-analysis-intermediate-q02 -->

#### What is an assertion function, and when would you use one?

<!-- question:start:narrowing-and-control-flow-analysis-intermediate-q03 -->
<!-- question-id:narrowing-and-control-flow-analysis-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

An assertion function narrows a value after it returns successfully. Its signature uses `asserts`, often as `asserts value is User`. If the value is invalid, the function throws or otherwise stops execution.

```ts
function assertUser(value: unknown): asserts value is User {
  if (!isUser(value)) {
    throw new Error("Expected User");
  }
}
```

After calling `assertUser(json)`, TypeScript treats `json` as `User`. Assertion functions are useful at boundaries where invalid data should stop the flow: API responses, environment configuration, route params, and context hooks that require a provider.

##### Key Points to Mention

- Assertion functions use `asserts`.
- They narrow after successful return.
- They usually throw on invalid input.
- They are useful at runtime validation boundaries.
- Context hooks often use this pattern to remove `null`.

<!-- question:end:narrowing-and-control-flow-analysis-intermediate-q03 -->

#### How would you narrow an `unknown` error in React?

<!-- question:start:narrowing-and-control-flow-analysis-intermediate-q04 -->
<!-- question-id:narrowing-and-control-flow-analysis-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use runtime checks before reading properties. A caught error or external value should often be treated as `unknown`.

```ts
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong";
}
```

In a React component or hook, this prevents unsafe assumptions about thrown values. JavaScript can throw anything, not only `Error` objects.

```tsx
try {
  await submitForm(values);
} catch (error: unknown) {
  setError(getErrorMessage(error));
}
```

##### Key Points to Mention

- `unknown` requires narrowing before use.
- `instanceof Error` is useful for real Error objects.
- `typeof error === "string"` handles string throws.
- Do not assume every caught value has `.message`.
- This pattern is safer than `catch (error: any)`.

<!-- question:end:narrowing-and-control-flow-analysis-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How does `never` support exhaustive checks?

<!-- question:start:narrowing-and-control-flow-analysis-advanced-q01 -->
<!-- question-id:narrowing-and-control-flow-analysis-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

`never` represents a type that should have no possible value. After all members of a union have been handled, the remaining value in a `default` branch should be `never`. Assigning it to a `never` variable forces TypeScript to fail if a new union member is added and not handled.

```ts
function renderState(state: RequestState) {
  switch (state.status) {
    case "idle":
      return "Idle";
    case "loading":
      return "Loading";
    case "success":
      return state.data.length;
    case "error":
      return state.error;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
```

This is especially useful for React render switches and reducers because it keeps UI behavior synchronized with the state model.

##### Key Points to Mention

- `never` means no possible value remains.
- A `never` assignment can enforce exhaustiveness.
- Adding a new union member causes a compile error.
- It is useful in reducers and render functions.
- Exhaustive checks prevent forgotten UI states.

<!-- question:end:narrowing-and-control-flow-analysis-advanced-q01 -->

#### How do narrowing and reducer action types work together?

<!-- question:start:narrowing-and-control-flow-analysis-advanced-q02 -->
<!-- question-id:narrowing-and-control-flow-analysis-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Reducer actions are often modeled as discriminated unions. Each action has a shared `type` field and variant-specific payload fields. A `switch` on `action.type` narrows the action in each case.

```ts
type Action =
  | { type: "add"; text: string }
  | { type: "toggle"; id: string }
  | { type: "clearCompleted" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add":
      return { ...state, items: [...state.items, { id: crypto.randomUUID(), text: action.text, done: false }] };
    case "toggle":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, done: !item.done } : item
        ),
      };
    case "clearCompleted":
      return { ...state, items: state.items.filter((item) => !item.done) };
  }
}
```

This prevents dispatching invalid actions and prevents reducers from reading payload fields that do not exist for a given action.

##### Key Points to Mention

- Reducer actions work well as discriminated unions.
- `action.type` narrows payload fields.
- Invalid dispatch shapes become compile errors.
- Reducers become easier to refactor safely.
- Exhaustive checks can catch missing action cases.

<!-- question:end:narrowing-and-control-flow-analysis-advanced-q02 -->

#### When should you use `unknown`, a type predicate, or a type assertion?

<!-- question:start:narrowing-and-control-flow-analysis-advanced-q03 -->
<!-- question-id:narrowing-and-control-flow-analysis-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Use `unknown` for values whose type is not proven yet, especially external data or caught errors. Then narrow it with runtime checks. Use a type predicate when you have a reusable runtime check that can prove a value's shape. Use a type assertion only when TypeScript cannot know something that you know for a solid reason.

For API data, `unknown` plus validation is safer than `as User`:

```ts
const json: unknown = await response.json();

if (!isUser(json)) {
  throw new Error("Invalid user");
}
```

A type assertion is not validation. It only changes TypeScript's belief. Overusing assertions makes TypeScript less useful because it bypasses the proof that narrowing is meant to provide.

##### Key Points to Mention

- `unknown` is safe at untrusted boundaries.
- Type predicates provide reusable runtime proof.
- Assertions do not perform runtime checks.
- Use `as` sparingly and intentionally.
- API responses should be validated before use.

<!-- question:end:narrowing-and-control-flow-analysis-advanced-q03 -->

#### What are common narrowing mistakes in React TypeScript code?

<!-- question:start:narrowing-and-control-flow-analysis-advanced-q04 -->
<!-- question-id:narrowing-and-control-flow-analysis-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Common mistakes include modeling async UI state with unrelated booleans instead of a discriminated union, using truthiness checks that accidentally hide valid `0` or empty string values, casting API responses instead of validating them, and writing type guards that do not actually check enough at runtime.

Other mistakes include destructuring complex union props too early, missing exhaustive checks in render switches, using `any` for event or API values, and relying on `typeof value === "object"` without checking for `null`.

Good React TypeScript code uses explicit state models, runtime validation at boundaries, `unknown` instead of `any`, and control-flow-friendly checks that make the component's rendering logic obvious.

##### Key Points to Mention

- Avoid invalid state models with unrelated booleans.
- Be careful with truthiness and valid falsy values.
- Do not cast untrusted API data without validation.
- Check `null` when using object guards.
- Use exhaustive checks for important UI unions.

<!-- question:end:narrowing-and-control-flow-analysis-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
