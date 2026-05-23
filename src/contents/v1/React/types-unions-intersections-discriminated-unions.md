---
id: types-unions-intersections-discriminated-unions
topic: TypeScript for React
subtopic: Types, unions, intersections, and discriminated unions
category: React
---

# Types, unions, intersections, and discriminated unions

## Overview

TypeScript adds static typing to JavaScript. In React applications, TypeScript is commonly used to describe component props, state, API responses, form values, reducer actions, event handlers, context values, and reusable domain models.

This topic focuses on four important TypeScript concepts:

- **Types**
- **Union types**
- **Intersection types**
- **Discriminated unions**

These concepts are important because React applications often deal with values that can have different shapes depending on UI state, API state, user actions, component variants, permissions, or data-loading status.

Examples:

```ts
type ButtonVariant = "primary" | "secondary" | "danger";

type User = {
  id: string;
  name: string;
  email: string;
};

type LoadingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };
```

In this example:

- `ButtonVariant` is a union of string literal types.
- `User` is an object type.
- `LoadingState` is a discriminated union.
- The `status` property is the discriminant that allows TypeScript to narrow the possible shape.

These features help developers model valid states and prevent invalid combinations.

For example, without discriminated unions, a loading state may be written like this:

```ts
type BadState = {
  loading: boolean;
  data?: User[];
  error?: string;
};
```

This allows confusing states:

```ts
const state: BadState = {
  loading: true,
  data: [{ id: "1", name: "Minh", email: "minh@example.com" }],
  error: "Failed to load users",
};
```

The state says loading, has data, and has an error at the same time. That may be invalid for the application.

A discriminated union makes invalid states harder to represent:

```ts
type UsersState =
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };
```

Now TypeScript knows:

- If `status` is `"loading"`, there is no `data` or `error`.
- If `status` is `"success"`, `data` exists.
- If `status` is `"error"`, `error` exists.

This is powerful in React because UI rendering often depends on state shape.

```tsx
function UsersPanel({ state }: { state: UsersState }) {
  if (state.status === "loading") {
    return <p>Loading...</p>;
  }

  if (state.status === "error") {
    return <p>Error: {state.error}</p>;
  }

  return (
    <ul>
      {state.data.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

TypeScript narrows `state` based on the `status` check, so `state.error` and `state.data` are only accessible in the correct branches.

This topic matters for interviews because TypeScript is not only about adding simple annotations like `string` and `number`. A strong React developer should know how to model real application states, component variants, mutually exclusive props, API responses, and reducer actions safely.

Interviewers often ask about these concepts because they reveal whether a candidate can:

- Design safe component props.
- Avoid invalid UI states.
- Use type narrowing.
- Understand compile-time vs runtime behavior.
- Choose between `type` and `interface`.
- Use unions instead of overly broad optional props.
- Use intersections to combine shared props.
- Use `never` for exhaustiveness checks.
- Avoid over-engineering simple components.

A strong answer should be practical:

```text
Use types and unions to describe what values are allowed.
Use intersections to combine requirements.
Use discriminated unions to model values that can be one of several known shapes.
Use narrowing to safely access properties.
Use exhaustive checks to catch missing cases.
```

## Core Concepts

### TypeScript Types

A TypeScript type describes the shape or allowed values of a variable, parameter, return value, object, function, component prop, or state.

Basic examples:

```ts
let name: string = "Minh";
let age: number = 30;
let isActive: boolean = true;
let tags: string[] = ["react", "typescript"];
```

Object type example:

```ts
type User = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
};
```

Function type example:

```ts
type SaveUser = (user: User) => Promise<void>;
```

React prop type example:

```tsx
type UserCardProps = {
  user: User;
  onSelect: (userId: string) => void;
};

function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <button onClick={() => onSelect(user.id)}>
      {user.name}
    </button>
  );
}
```

TypeScript types exist at compile time. They help the compiler and editor detect incorrect usage before runtime. Most TypeScript types are removed during compilation and do not exist in the emitted JavaScript.

Important point:

```text
TypeScript checks types at compile time.
JavaScript still runs at runtime.
```

If data comes from an API, user input, local storage, or a third-party script, TypeScript cannot automatically guarantee it is valid at runtime. Runtime validation may still be required.

### Type Aliases

A type alias gives a name to a type.

```ts
type ProductId = string;

type Product = {
  id: ProductId;
  name: string;
  price: number;
};
```

Type aliases can name:

- Primitive types.
- Object types.
- Union types.
- Intersection types.
- Function types.
- Tuple types.
- Literal types.
- Generic types.
- Utility-type results.

Examples:

```ts
type Status = "idle" | "loading" | "success" | "error";

type Point = {
  x: number;
  y: number;
};

type ClickHandler = (event: React.MouseEvent<HTMLButtonElement>) => void;

type ApiResponse<T> = {
  data: T;
  statusCode: number;
};
```

Type aliases are very common in React because component props and state models are often easier to read when named.

```tsx
type ButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

function Button({ label, disabled, onClick }: ButtonProps) {
  return (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
```

### Type Aliases vs Interfaces

Both `type` and `interface` can describe object shapes.

Using `type`:

```ts
type User = {
  id: string;
  name: string;
};
```

Using `interface`:

```ts
interface User {
  id: string;
  name: string;
}
```

They are similar for simple object models, but they differ in some important ways.

| Feature | `type` | `interface` |
|---|---:|---:|
| Object shape | Yes | Yes |
| Union type | Yes | No |
| Intersection type | Yes | Through `extends`, but not all cases |
| Primitive alias | Yes | No |
| Tuple alias | Yes | No |
| Function alias | Yes | Yes, but type is often clearer |
| Declaration merging | No | Yes |
| Common React props usage | Very common | Very common |

Examples where `type` is required or clearer:

```ts
type Status = "loading" | "success" | "error";

type Id = string | number;

type UserWithRole = User & {
  role: string;
};
```

Example where `interface` can be useful:

```ts
interface ButtonProps {
  label: string;
  onClick: () => void;
}

interface IconButtonProps extends ButtonProps {
  icon: React.ReactNode;
}
```

Practical guidance:

```text
Use `type` when you need unions, intersections, utility types, or complex composition.
Use `interface` when you are defining extendable object shapes, especially public library APIs.
In application code, either can be acceptable if the team is consistent.
```

For this topic, `type` is especially important because unions and intersections are usually written as type aliases.

### Literal Types

A literal type represents one exact value.

```ts
type Direction = "left" | "right" | "up" | "down";

let direction: Direction = "left";
```

This is different from `string`.

```ts
let anyString: string = "anything";

let fixed: "success" = "success";
```

`fixed` can only be `"success"`.

Literal types are commonly used in React props:

```tsx
type AlertProps = {
  variant: "success" | "warning" | "error";
  message: string;
};

function Alert({ variant, message }: AlertProps) {
  return <div className={`alert alert-${variant}`}>{message}</div>;
}
```

Usage:

```tsx
<Alert variant="success" message="Saved successfully" />
<Alert variant="error" message="Failed to save" />
```

Invalid:

```tsx
<Alert variant="blue" message="Invalid variant" />
```

The compiler catches the invalid variant.

Literal types are also the foundation of discriminated unions.

### Union Types

A union type means a value can be one of several possible types.

Syntax:

```ts
type Id = string | number;
```

Example:

```ts
function formatId(id: string | number) {
  return String(id);
}
```

Valid:

```ts
formatId("user-1");
formatId(123);
```

Invalid:

```ts
formatId(true);
```

Union types are useful for:

- Component variants.
- Status values.
- API result states.
- Nullable values.
- IDs that can be string or number.
- Event payloads.
- Reducer actions.
- Form field types.
- Feature flags.
- Permission states.
- Return values that can fail.

React example:

```tsx
type BadgeProps = {
  status: "active" | "inactive" | "pending";
};

function Badge({ status }: BadgeProps) {
  return <span>{status}</span>;
}
```

Union types make invalid values impossible at compile time.

### Working Safely with Union Types

When you have a union, TypeScript only lets you access members that are safe for all possible members.

Example:

```ts
function printValue(value: string | number) {
  console.log(value.toUpperCase());
}
```

This is invalid because `number` does not have `toUpperCase`.

You must narrow first:

```ts
function printValue(value: string | number) {
  if (typeof value === "string") {
    console.log(value.toUpperCase());
    return;
  }

  console.log(value.toFixed(2));
}
```

TypeScript uses control flow analysis to narrow the type.

Common narrowing tools:

- `typeof`
- `instanceof`
- `in`
- Equality checks
- Truthiness checks
- Discriminant property checks
- User-defined type guards
- Assertion functions
- `switch` statements

Example with `in`:

```ts
type User = {
  id: string;
  name: string;
};

type Admin = {
  id: string;
  name: string;
  permissions: string[];
};

function renderPerson(person: User | Admin) {
  if ("permissions" in person) {
    return person.permissions.join(", ");
  }

  return person.name;
}
```

TypeScript knows that `permissions` exists only in the `Admin` branch.

### Union of Values vs Union of Object Shapes

Union types can be simple value unions:

```ts
type Theme = "light" | "dark";
```

They can also be object-shape unions:

```ts
type TextField = {
  type: "text";
  value: string;
};

type CheckboxField = {
  type: "checkbox";
  checked: boolean;
};

type FormField = TextField | CheckboxField;
```

This is common in React because UI components often render different views based on object shape.

```tsx
function FieldRenderer({ field }: { field: FormField }) {
  switch (field.type) {
    case "text":
      return <input value={field.value} readOnly />;

    case "checkbox":
      return <input type="checkbox" checked={field.checked} readOnly />;
  }
}
```

The union makes invalid field shapes impossible:

```ts
const invalidField: FormField = {
  type: "checkbox",
  value: "wrong",
};
```

A checkbox field must have `checked`, not `value`.

### Optional Properties vs Union Types

Optional properties are useful, but they can create invalid combinations when a value has multiple possible states.

Weak model:

```ts
type DialogProps = {
  title?: string;
  message?: string;
  error?: string;
  loading?: boolean;
};
```

This allows invalid or unclear combinations:

```ts
const props: DialogProps = {
  title: "User",
  error: "Failed",
  loading: true,
};
```

Is it loading or error?

Better with a union:

```ts
type DialogProps =
  | { state: "loading"; message?: string }
  | { state: "error"; error: string }
  | { state: "success"; title: string; message: string };
```

Now each state has only the properties that make sense.

Use optional properties when:

- A property is truly optional in the same shape.
- The object is still valid with or without the property.
- The property does not determine a different mode.

Use union types when:

- Different modes require different properties.
- Some properties are mutually exclusive.
- The object can be one of several known shapes.
- You want TypeScript to narrow based on mode.

### Intersection Types

An intersection type combines multiple types into one type.

Syntax:

```ts
type A = { id: string };
type B = { createdAt: string };

type AAndB = A & B;
```

`AAndB` must satisfy both `A` and `B`.

```ts
const item: AAndB = {
  id: "1",
  createdAt: "2026-05-23T10:00:00Z",
};
```

Intersection types are useful for combining shared props, base models, metadata, and feature-specific fields.

Example:

```ts
type Entity = {
  id: string;
};

type Timestamped = {
  createdAt: string;
  updatedAt: string;
};

type User = Entity &
  Timestamped & {
    name: string;
    email: string;
  };
```

A `User` must have:

- `id`
- `createdAt`
- `updatedAt`
- `name`
- `email`

React example:

```tsx
type BaseButtonProps = {
  disabled?: boolean;
  children: React.ReactNode;
};

type TrackingProps = {
  trackingId: string;
};

type ButtonProps = BaseButtonProps &
  TrackingProps & {
    onClick: () => void;
  };

function Button({ disabled, children, trackingId, onClick }: ButtonProps) {
  return (
    <button data-tracking-id={trackingId} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
```

Intersection means "all of these requirements at the same time."

### Intersection vs Union

Union and intersection are often confused.

```ts
type Union = A | B;
type Intersection = A & B;
```

Conceptually:

| Type | Meaning |
|---|---|
| `A | B` | Value can be A or B |
| `A & B` | Value must satisfy A and B |

Example:

```ts
type HasName = {
  name: string;
};

type HasEmail = {
  email: string;
};

type NameOrEmail = HasName | HasEmail;
type NameAndEmail = HasName & HasEmail;
```

Valid `NameOrEmail`:

```ts
const a: NameOrEmail = { name: "Minh" };
const b: NameOrEmail = { email: "minh@example.com" };
const c: NameOrEmail = { name: "Minh", email: "minh@example.com" };
```

Valid `NameAndEmail`:

```ts
const d: NameAndEmail = {
  name: "Minh",
  email: "minh@example.com",
};
```

Invalid `NameAndEmail`:

```ts
const e: NameAndEmail = {
  name: "Minh",
};
```

Important interview point:

```text
Union widens possible shapes.
Intersection combines requirements.
```

### Intersections with Conflicting Properties

Intersections can become confusing when the same property exists with incompatible types.

```ts
type A = {
  id: string;
};

type B = {
  id: number;
};

type C = A & B;
```

`C["id"]` becomes `never` because a value cannot be both `string` and `number` at the same time.

```ts
const value: C = {
  id: "1",
};
```

This is invalid.

This often happens accidentally when combining props.

Example:

```ts
type LinkProps = {
  href: string;
  onClick?: never;
};

type ButtonProps = {
  onClick: () => void;
  href?: never;
};

type BadProps = LinkProps & ButtonProps;
```

This requires both link and button rules at the same time, which is impossible.

Use union when the component can be one mode or another:

```ts
type ActionProps = LinkProps | ButtonProps;
```

Best practice:

```text
Use intersection to combine compatible requirements.
Use union to model alternatives.
```

### Discriminated Unions

A discriminated union is a union of object types where each member has a common property with a different literal value.

The common property is called the **discriminant**, **tag**, or **kind**.

Example:

```ts
type LoadingState = {
  status: "loading";
};

type SuccessState = {
  status: "success";
  data: string[];
};

type ErrorState = {
  status: "error";
  error: string;
};

type AsyncState = LoadingState | SuccessState | ErrorState;
```

`status` is the discriminant.

TypeScript can narrow the union based on `status`.

```ts
function renderState(state: AsyncState) {
  switch (state.status) {
    case "loading":
      return "Loading...";

    case "success":
      return state.data.join(", ");

    case "error":
      return state.error;
  }
}
```

Inside each case, TypeScript knows the exact type.

Discriminated unions are useful for:

- API loading states.
- Reducer actions.
- Component variants.
- Form field variants.
- Modal states.
- Error states.
- State machines.
- Workflow status.
- Notification types.
- Message/event payloads.

They are especially helpful in React because UI often has finite states.

### Discriminated Unions for React Loading State

Weak state model:

```tsx
type UsersState = {
  isLoading: boolean;
  data?: User[];
  error?: string;
};
```

Problems:

- `isLoading` can be `true` while `data` exists.
- `error` and `data` can exist at the same time.
- The component must defensively check many combinations.
- Invalid states are representable.

Better:

```tsx
type UsersState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };
```

Component:

```tsx
function UsersList({ state }: { state: UsersState }) {
  switch (state.status) {
    case "idle":
      return <p>Click search to load users.</p>;

    case "loading":
      return <p>Loading users...</p>;

    case "error":
      return <p>Error: {state.error}</p>;

    case "success":
      return (
        <ul>
          {state.data.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      );
  }
}
```

Benefits:

- Invalid UI states are prevented.
- Rendering logic is clearer.
- TypeScript narrows properties safely.
- Adding a new state can be caught with exhaustive checks.

### Discriminated Unions for Component Props

Discriminated unions are powerful for React component props that have variants.

Example: a button that can render as a normal button or a link.

```tsx
type BaseActionProps = {
  children: React.ReactNode;
  className?: string;
};

type ButtonActionProps = BaseActionProps & {
  as: "button";
  onClick: () => void;
  href?: never;
};

type LinkActionProps = BaseActionProps & {
  as: "link";
  href: string;
  onClick?: never;
};

type ActionProps = ButtonActionProps | LinkActionProps;

function Action(props: ActionProps) {
  if (props.as === "link") {
    return (
      <a href={props.href} className={props.className}>
        {props.children}
      </a>
    );
  }

  return (
    <button onClick={props.onClick} className={props.className}>
      {props.children}
    </button>
  );
}
```

Usage:

```tsx
<Action as="button" onClick={() => console.log("clicked")}>
  Save
</Action>

<Action as="link" href="/settings">
  Settings
</Action>
```

Invalid:

```tsx
<Action as="link" onClick={() => console.log("wrong")}>
  Wrong
</Action>
```

A link requires `href`, not `onClick`.

The `never` properties help prevent passing props from the wrong variant.

### Discriminated Unions for Reducer Actions

Reducers often benefit from discriminated unions.

```ts
type CounterAction =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "set"; value: number }
  | { type: "reset" };

function counterReducer(state: number, action: CounterAction) {
  switch (action.type) {
    case "increment":
      return state + 1;

    case "decrement":
      return state - 1;

    case "set":
      return action.value;

    case "reset":
      return 0;
  }
}
```

Invalid action:

```ts
const action: CounterAction = {
  type: "set",
};
```

TypeScript requires `value` for the `"set"` action.

This is much safer than:

```ts
type BadAction = {
  type: string;
  value?: number;
};
```

With `BadAction`, TypeScript cannot know which actions require `value`.

### Exhaustive Checking with `never`

Exhaustive checking ensures all union members are handled.

```ts
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
```

Usage:

```ts
function renderState(state: UsersState) {
  switch (state.status) {
    case "idle":
      return "Idle";

    case "loading":
      return "Loading";

    case "success":
      return state.data.length;

    case "error":
      return state.error;

    default:
      return assertNever(state);
  }
}
```

If a new union member is added:

```ts
type UsersState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string }
  | { status: "refreshing"; data: User[] };
```

TypeScript will complain because `state` in the `default` branch is no longer `never`.

This catches missing cases at compile time.

In React, exhaustive checks are useful for:

- Component variants.
- Reducer actions.
- API states.
- Form field types.
- Workflow states.
- Notification types.

### Type Narrowing

Type narrowing is how TypeScript reduces a broad type to a more specific type based on code checks.

Example:

```ts
function getLength(value: string | string[]) {
  if (typeof value === "string") {
    return value.length;
  }

  return value.length;
}
```

Both branches have `.length`, but TypeScript knows the first is `string` and the second is `string[]`.

Narrowing with discriminant:

```ts
type ApiResult =
  | { ok: true; data: User[] }
  | { ok: false; error: string };

function handleResult(result: ApiResult) {
  if (result.ok) {
    return result.data;
  }

  return result.error;
}
```

TypeScript understands that `ok: true` means the result has `data`.

Narrowing with `in`:

```ts
type Cat = {
  meow: () => void;
};

type Dog = {
  bark: () => void;
};

function speak(animal: Cat | Dog) {
  if ("meow" in animal) {
    animal.meow();
    return;
  }

  animal.bark();
}
```

Narrowing is central to safe union handling.

### User-Defined Type Guards

A user-defined type guard is a function that tells TypeScript how to narrow a value.

Syntax:

```ts
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "email" in value
  );
}
```

Usage:

```ts
function printUser(value: unknown) {
  if (isUser(value)) {
    console.log(value.email);
  }
}
```

Type guards are useful when:

- Data comes from APIs.
- Data comes from local storage.
- You need runtime validation.
- You work with `unknown`.
- You need custom narrowing logic.

Important limitation:

```text
A type guard is only as correct as its implementation.
```

For serious API validation, teams often use runtime validation libraries or schema validation.

### `unknown`, `any`, and Type Safety

`any` disables type checking for a value.

```ts
let value: any = "hello";
value.not.a.real.method();
```

TypeScript does not complain, but runtime may fail.

`unknown` is safer because it forces narrowing before use.

```ts
let value: unknown = "hello";

if (typeof value === "string") {
  console.log(value.toUpperCase());
}
```

Use `unknown` for untrusted data:

```ts
async function loadData(): Promise<unknown> {
  const response = await fetch("/api/users");
  return response.json();
}
```

Then validate or narrow it before treating it as a known type.

Best practice:

```text
Prefer `unknown` over `any` when the value is not yet validated.
Use `any` only when you intentionally need to escape the type system.
```

### Type Assertions

A type assertion tells TypeScript to treat a value as a specific type.

```ts
const input = document.getElementById("email") as HTMLInputElement;
```

Type assertions do not perform runtime checks. They are a compile-time instruction.

Dangerous example:

```ts
const user = responseData as User;
```

If `responseData` does not actually match `User`, TypeScript will not protect you at runtime.

Better for untrusted data:

```ts
const responseData: unknown = await response.json();

if (isUser(responseData)) {
  console.log(responseData.email);
}
```

Use assertions when:

- You know more than TypeScript can infer.
- You have already validated the value.
- You are working with DOM APIs.
- The assertion is local and safe.

Avoid assertions when:

- You are hiding real type errors.
- You are using them to bypass compiler checks.
- The data comes from an untrusted source.
- A type guard or better model would be safer.

### React Props with Union Types

Union types are very useful for component props.

Example: mutually exclusive props.

```tsx
type ControlledInputProps = {
  value: string;
  onChange: (value: string) => void;
  defaultValue?: never;
};

type UncontrolledInputProps = {
  defaultValue?: string;
  value?: never;
  onChange?: never;
};

type TextInputProps = {
  label: string;
} & (ControlledInputProps | UncontrolledInputProps);

function TextInput(props: TextInputProps) {
  if ("value" in props) {
    return (
      <label>
        {props.label}
        <input
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </label>
    );
  }

  return (
    <label>
      {props.label}
      <input defaultValue={props.defaultValue} />
    </label>
  );
}
```

This prevents a component from being both controlled and uncontrolled.

Invalid:

```tsx
<TextInput
  label="Name"
  value="Minh"
  defaultValue="Default"
  onChange={() => {}}
/>
```

This helps catch common React prop mistakes at compile time.

### React Component State with Discriminated Unions

Discriminated unions are excellent for component state.

```tsx
type SearchState =
  | { status: "idle" }
  | { status: "searching"; query: string }
  | { status: "success"; query: string; results: User[] }
  | { status: "empty"; query: string }
  | { status: "error"; query: string; error: string };
```

Rendering:

```tsx
function SearchResults({ state }: { state: SearchState }) {
  switch (state.status) {
    case "idle":
      return <p>Start typing to search.</p>;

    case "searching":
      return <p>Searching for {state.query}...</p>;

    case "success":
      return (
        <ul>
          {state.results.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      );

    case "empty":
      return <p>No results for {state.query}.</p>;

    case "error":
      return <p>Search failed: {state.error}</p>;
  }
}
```

Benefits:

- State transitions are clearer.
- Rendering branches are safer.
- Invalid combinations are avoided.
- The UI becomes easier to reason about.

### Discriminated Unions and Destructuring in React

A common pitfall is destructuring discriminated union props too early.

Problem:

```tsx
type Props =
  | { kind: "link"; href: string }
  | { kind: "button"; onClick: () => void };

function Action({ kind, href, onClick }: Props) {
  if (kind === "link") {
    return <a href={href}>Open</a>;
  }

  return <button onClick={onClick}>Open</button>;
}
```

Depending on TypeScript version and configuration, destructuring can make narrowing harder, especially for properties that do not exist on every union member.

Safer:

```tsx
function Action(props: Props) {
  if (props.kind === "link") {
    return <a href={props.href}>Open</a>;
  }

  return <button onClick={props.onClick}>Open</button>;
}
```

Best practice:

```text
When using discriminated unions, narrow on the whole object first.
Then access variant-specific properties.
```

You can destructure inside the narrowed branch:

```tsx
function Action(props: Props) {
  if (props.kind === "link") {
    const { href } = props;
    return <a href={href}>Open</a>;
  }

  const { onClick } = props;
  return <button onClick={onClick}>Open</button>;
}
```

### `never` for Mutually Exclusive Props

`never` can be used to forbid props in a specific union branch.

```tsx
type IconButtonProps = {
  variant: "icon";
  icon: React.ReactNode;
  label?: never;
};

type TextButtonProps = {
  variant: "text";
  label: string;
  icon?: never;
};

type ButtonProps = IconButtonProps | TextButtonProps;
```

This prevents invalid combinations:

```tsx
<Button variant="icon" icon={<SaveIcon />} />
<Button variant="text" label="Save" />
```

Invalid:

```tsx
<Button variant="icon" icon={<SaveIcon />} label="Save" />
```

`label` is not allowed in the icon branch.

Use this pattern when:

- Props are mutually exclusive.
- One prop requires another prop.
- Component mode changes required props.
- You want invalid combinations to fail at compile time.

Avoid overusing it for simple optional props where the added complexity is not worth it.

### Unions Over Enums for React Props

For many React props, string literal unions are simpler than enums.

```ts
type ButtonVariant = "primary" | "secondary" | "danger";
```

Usage:

```tsx
function Button({ variant }: { variant: ButtonVariant }) {
  return <button className={`btn-${variant}`}>Save</button>;
}
```

This is lightweight and compile-time only.

Enums can be useful in some cases, but they introduce runtime values unless using `const enum`, and `const enum` can have build-tool caveats.

Alternative with object constants:

```ts
const ButtonVariant = {
  Primary: "primary",
  Secondary: "secondary",
  Danger: "danger",
} as const;

type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant];
```

This provides reusable constants and a union type.

Practical React guidance:

```text
Use string literal unions for simple prop variants.
Use object constants when you want named reusable values.
Use enums only when the team has a clear reason.
```

### Intersections with React Native HTML Props

Intersections are often used to combine custom props with native element props.

Example:

```tsx
type PrimaryButtonProps = {
  variant?: "primary" | "secondary";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

function PrimaryButton({
  variant = "primary",
  className,
  ...buttonProps
}: PrimaryButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${className ?? ""}`}
      {...buttonProps}
    />
  );
}
```

This allows native button props such as:

```tsx
<PrimaryButton
  type="submit"
  disabled
  onClick={() => console.log("clicked")}
>
  Save
</PrimaryButton>
```

However, be careful when custom props conflict with native props.

For more precise control, use `Omit`:

```tsx
type AppButtonProps = {
  variant: "primary" | "secondary";
  onPress: () => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">;

function AppButton({ onPress, variant, ...props }: AppButtonProps) {
  return (
    <button {...props} className={`btn-${variant}`} onClick={onPress} />
  );
}
```

This prevents exposing both `onPress` and `onClick` if your component wants a custom API.

### Utility Types with Unions and Intersections

TypeScript utility types are often used with unions and intersections.

Common utility types:

| Utility Type | Purpose |
|---|---|
| `Partial<T>` | Makes properties optional |
| `Required<T>` | Makes properties required |
| `Pick<T, K>` | Selects specific properties |
| `Omit<T, K>` | Removes specific properties |
| `Record<K, T>` | Creates an object type with keys and values |
| `Extract<T, U>` | Extracts union members assignable to another type |
| `Exclude<T, U>` | Removes union members assignable to another type |
| `NonNullable<T>` | Removes `null` and `undefined` |
| `ReturnType<T>` | Gets function return type |
| `Parameters<T>` | Gets function parameter tuple type |

Example with union:

```ts
type Action =
  | { type: "create"; name: string }
  | { type: "update"; id: string; name: string }
  | { type: "delete"; id: string };

type DeleteAction = Extract<Action, { type: "delete" }>;
```

`DeleteAction` becomes:

```ts
type DeleteAction = {
  type: "delete";
  id: string;
};
```

Example with `Omit`:

```ts
type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};

type UserDto = Omit<User, "passwordHash">;
```

Utility types are powerful, but overly complex type transformations can hurt readability.

### Runtime Validation vs Static Types

TypeScript does not validate data at runtime.

Example:

```ts
type User = {
  id: string;
  name: string;
};

const user = await response.json() as User;
```

This compiles, but it does not verify the API response is actually a `User`.

If API data is untrusted, use runtime validation.

Simple manual validation:

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

Usage:

```ts
const data: unknown = await response.json();

if (!isUser(data)) {
  throw new Error("Invalid user response");
}

console.log(data.name);
```

Important interview point:

```text
TypeScript helps at compile time, but it does not replace runtime validation for external data.
```

### Common Mistakes

Common mistakes include:

- Using `any` instead of modeling the type.
- Using optional properties for mutually exclusive states.
- Forgetting to narrow a union before accessing variant-specific properties.
- Using intersection when union was intended.
- Using union when all properties are required.
- Creating intersections with conflicting property types.
- Destructuring discriminated union props before narrowing.
- Not using a discriminant property for object unions.
- Using `as` assertions to silence real errors.
- Assuming API data is valid because it is asserted as a type.
- Forgetting exhaustive checks when switching over union members.
- Using enums for simple React variants when string literal unions are simpler.
- Overusing complex type-level programming for simple components.
- Creating types that are technically correct but unreadable.
- Using `Partial<T>` too broadly and making required data appear optional.
- Forgetting that TypeScript types are erased at runtime.
- Not aligning frontend types with backend contracts.

### Best Practices

Use type aliases for unions, intersections, and reusable object shapes.

Use string literal unions for simple status and variant values.

Use discriminated unions for state that can be one of several known shapes.

Use a clear discriminant property such as `type`, `kind`, `status`, or `variant`.

Narrow union values before accessing variant-specific properties.

Prefer `unknown` over `any` for untrusted values.

Use runtime validation for API responses and user input when correctness matters.

Use intersections to combine compatible shared props or model requirements.

Avoid intersections with conflicting property names.

Use `never` for exhaustive checks and mutually exclusive props when appropriate.

Avoid destructuring discriminated union props before narrowing.

Keep React component prop types readable.

Avoid over-engineering simple components with complex unions.

Use utility types carefully and name complex derived types.

Prefer invalid states being unrepresentable.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:types-unions-intersections-and-discriminated-unions-beginner-q01 -->
#### Beginner Q01: What is a type in TypeScript?

<!-- question-id:types-unions-intersections-and-discriminated-unions-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A type describes the allowed values or shape of a variable, function parameter, return value, object, component prop, or state value. TypeScript uses types at compile time to detect incorrect usage before the code runs.

Example:

```ts
type User = {
  id: string;
  name: string;
  email: string;
};
```

This means a `User` value should have `id`, `name`, and `email` properties, all strings.

Types help make React components safer because props, state, event handlers, and API models can be described clearly.

##### Key Points to Mention

- A type describes allowed values or object shape.
- TypeScript checks types at compile time.
- Types are mostly erased from emitted JavaScript.
- Types help catch mistakes before runtime.
- React props and state are commonly typed.
- Runtime validation is still needed for untrusted data.

<!-- question:end:types-unions-intersections-and-discriminated-unions-beginner-q01 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-beginner-q02 -->
#### Beginner Q02: What is a type alias?

<!-- question-id:types-unions-intersections-and-discriminated-unions-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A type alias gives a name to a type. It can name object types, primitive types, union types, intersection types, function types, tuples, and more.

Example:

```ts
type ButtonVariant = "primary" | "secondary";

type ButtonProps = {
  variant: ButtonVariant;
  label: string;
  onClick: () => void;
};
```

Type aliases improve readability and reuse. They are very common for React component props and state models.

##### Key Points to Mention

- Created with the `type` keyword.
- Gives a reusable name to a type.
- Can represent unions and intersections.
- Common for React props.
- Improves readability.
- Does not create runtime JavaScript by itself.

<!-- question:end:types-unions-intersections-and-discriminated-unions-beginner-q02 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-beginner-q03 -->
#### Beginner Q03: What is a union type?

<!-- question-id:types-unions-intersections-and-discriminated-unions-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A union type means a value can be one of several possible types or values.

Example:

```ts
type Id = string | number;
```

`Id` can be either a `string` or a `number`.

React example:

```ts
type ButtonVariant = "primary" | "secondary" | "danger";
```

This restricts the value to one of the allowed strings.

When using a union, TypeScript only allows operations that are safe for all possible members unless the value is narrowed first.

##### Key Points to Mention

- Uses the `|` operator.
- Means "one of these types."
- Useful for variants and statuses.
- Requires narrowing for member-specific properties.
- Helps prevent invalid values.
- Common in React props and reducer actions.

<!-- question:end:types-unions-intersections-and-discriminated-unions-beginner-q03 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-beginner-q04 -->
#### Beginner Q04: What is an intersection type?

<!-- question-id:types-unions-intersections-and-discriminated-unions-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

An intersection type combines multiple types into one type. A value of the intersection type must satisfy all combined types.

Example:

```ts
type Entity = {
  id: string;
};

type Timestamped = {
  createdAt: string;
  updatedAt: string;
};

type User = Entity & Timestamped & {
  name: string;
};
```

A `User` must have `id`, `createdAt`, `updatedAt`, and `name`.

##### Key Points to Mention

- Uses the `&` operator.
- Means "all of these types at once."
- Combines requirements.
- Useful for shared props and base models.
- Can become invalid with conflicting property types.
- Different from union.

<!-- question:end:types-unions-intersections-and-discriminated-unions-beginner-q04 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-beginner-q05 -->
#### Beginner Q05: What is the difference between union and intersection types?

<!-- question-id:types-unions-intersections-and-discriminated-unions-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A union type means a value can be one of several alternatives. An intersection type means a value must satisfy multiple types at the same time.

Example:

```ts
type HasName = { name: string };
type HasEmail = { email: string };

type NameOrEmail = HasName | HasEmail;
type NameAndEmail = HasName & HasEmail;
```

`NameOrEmail` can have a name, an email, or both. `NameAndEmail` must have both name and email.

##### Key Points to Mention

- Union uses `|`.
- Intersection uses `&`.
- Union means alternatives.
- Intersection means combined requirements.
- Use union for variants.
- Use intersection for composition.
- Choosing the wrong one causes confusing types.

<!-- question:end:types-unions-intersections-and-discriminated-unions-beginner-q05 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-beginner-q06 -->
#### Beginner Q06: What is a discriminated union?

<!-- question-id:types-unions-intersections-and-discriminated-unions-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

A discriminated union is a union of object types where each object has a common property with a different literal value. That common property is called the discriminant.

Example:

```ts
type State =
  | { status: "loading" }
  | { status: "success"; data: string[] }
  | { status: "error"; error: string };
```

`status` is the discriminant. When you check `state.status`, TypeScript narrows the type and knows which properties are available.

##### Key Points to Mention

- Union of object types.
- Has a shared literal property.
- The shared property is the discriminant.
- Common discriminant names: `type`, `kind`, `status`, `variant`.
- Enables safe narrowing.
- Very useful for React UI state and reducer actions.

<!-- question:end:types-unions-intersections-and-discriminated-unions-beginner-q06 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-beginner-q07 -->
#### Beginner Q07: Why are union types useful in React?

<!-- question-id:types-unions-intersections-and-discriminated-unions-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

Union types are useful in React because components often accept a limited set of variants, statuses, or modes. They help prevent invalid prop values and make component behavior clearer.

Example:

```ts
type AlertVariant = "success" | "warning" | "error";

type AlertProps = {
  variant: AlertVariant;
  message: string;
};
```

Now the component cannot receive an unsupported variant such as `"blue"`.

Union types can also model UI states, reducer actions, form field types, and API responses.

##### Key Points to Mention

- Restrict prop values.
- Model component variants.
- Model loading/error/success states.
- Model reducer actions.
- Prevent invalid values.
- Improve autocomplete and documentation.

<!-- question:end:types-unions-intersections-and-discriminated-unions-beginner-q07 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-beginner-q08 -->
#### Beginner Q08: What is type narrowing?

<!-- question-id:types-unions-intersections-and-discriminated-unions-beginner-q08 -->
<!-- question-level:beginner -->

##### Expected Answer

Type narrowing is how TypeScript reduces a broad type to a more specific type based on checks in the code.

Example:

```ts
function format(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }

  return value.toFixed(2);
}
```

Inside the `if` branch, TypeScript knows `value` is a string. In the other branch, it knows `value` is a number.

Narrowing is necessary when working with unions.

##### Key Points to Mention

- Narrows broad type to specific type.
- Uses checks like `typeof`, `in`, `instanceof`, equality, and discriminants.
- Required for safe union handling.
- TypeScript uses control flow analysis.
- Common with discriminated unions.
- Prevents accessing invalid properties.

<!-- question:end:types-unions-intersections-and-discriminated-unions-beginner-q08 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:types-unions-intersections-and-discriminated-unions-intermediate-q01 -->
#### Intermediate Q01: How do discriminated unions prevent invalid UI states?

<!-- question-id:types-unions-intersections-and-discriminated-unions-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Discriminated unions prevent invalid UI states by modeling each valid state as a separate object shape. Instead of using many optional properties that can be combined incorrectly, each state has only the properties that make sense.

Weak model:

```ts
type State = {
  loading: boolean;
  data?: User[];
  error?: string;
};
```

This can represent loading, success, and error at the same time.

Better:

```ts
type State =
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };
```

Now TypeScript ensures that success has data, error has error, and loading has neither.

##### Key Points to Mention

- Models only valid states.
- Avoids optional-property combinations.
- Uses a shared discriminant property.
- Makes rendering logic safer.
- Helps TypeScript narrow properties.
- Follows the idea of making invalid states unrepresentable.

<!-- question:end:types-unions-intersections-and-discriminated-unions-intermediate-q01 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-intermediate-q02 -->
#### Intermediate Q02: How would you type mutually exclusive React props?

<!-- question-id:types-unions-intersections-and-discriminated-unions-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a union of prop shapes and use `never` to forbid props that do not belong to a branch.

Example:

```tsx
type LinkActionProps = {
  as: "link";
  href: string;
  onClick?: never;
};

type ButtonActionProps = {
  as: "button";
  onClick: () => void;
  href?: never;
};

type ActionProps = {
  children: React.ReactNode;
} & (LinkActionProps | ButtonActionProps);
```

This means a link action must have `href` and cannot have `onClick`, while a button action must have `onClick` and cannot have `href`.

##### Key Points to Mention

- Use union of prop shapes.
- Use discriminant such as `as`, `type`, or `variant`.
- Use `never` to forbid invalid props.
- Helps prevent invalid combinations.
- Narrow props before accessing variant-specific properties.
- Do not overuse this for simple optional props.

<!-- question:end:types-unions-intersections-and-discriminated-unions-intermediate-q02 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-intermediate-q03 -->
#### Intermediate Q03: How do you use exhaustive checking with discriminated unions?

<!-- question-id:types-unions-intersections-and-discriminated-unions-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a `never` helper in the default branch of a `switch` statement. If all union members are handled, the value in the default branch is `never`. If a new union member is added and not handled, TypeScript reports an error.

Example:

```ts
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

function renderState(state: State) {
  switch (state.status) {
    case "loading":
      return "Loading";

    case "success":
      return state.data.length;

    case "error":
      return state.error;

    default:
      return assertNever(state);
  }
}
```

This helps catch missing cases at compile time.

##### Key Points to Mention

- Use `never` for unreachable cases.
- Helps catch missing union members.
- Useful with `switch`.
- Useful for reducers, states, and component variants.
- Makes future changes safer.
- Compile-time protection, not runtime validation.

<!-- question:end:types-unions-intersections-and-discriminated-unions-intermediate-q03 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-intermediate-q04 -->
#### Intermediate Q04: Why can destructuring discriminated union props cause problems?

<!-- question-id:types-unions-intersections-and-discriminated-unions-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Destructuring discriminated union props too early can make it harder for TypeScript to keep the relationship between the discriminant and the variant-specific properties. If properties do not exist on every union member, destructuring them before narrowing may cause errors or lose useful narrowing information.

Safer approach:

```tsx
function Action(props: ActionProps) {
  if (props.as === "link") {
    return <a href={props.href}>{props.children}</a>;
  }

  return <button onClick={props.onClick}>{props.children}</button>;
}
```

Narrow the whole object first, then access or destructure branch-specific properties.

##### Key Points to Mention

- Narrow the object before destructuring variant-specific props.
- Destructuring can break or weaken narrowing.
- Access properties through `props` after checking discriminant.
- Destructure inside narrowed branches if desired.
- Common issue in React components.
- Keep discriminant and dependent props together.

<!-- question:end:types-unions-intersections-and-discriminated-unions-intermediate-q04 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-intermediate-q05 -->
#### Intermediate Q05: When should you use an intersection type in React?

<!-- question-id:types-unions-intersections-and-discriminated-unions-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use intersection types when a component or model must satisfy multiple compatible sets of requirements. In React, intersections are common for combining custom props with shared props or native HTML props.

Example:

```tsx
type TrackingProps = {
  trackingId: string;
};

type ButtonProps = TrackingProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant: "primary" | "secondary";
  };
```

This means the component accepts tracking props, standard button props, and custom variant props.

Use intersections for composition, not alternatives. Use unions when the component can be one mode or another.

##### Key Points to Mention

- Use intersection to combine compatible requirements.
- Common for shared props.
- Common with native HTML props.
- Means all combined properties are required or allowed according to their definitions.
- Use `Omit` to avoid prop conflicts.
- Use union for alternatives.

<!-- question:end:types-unions-intersections-and-discriminated-unions-intermediate-q05 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-intermediate-q06 -->
#### Intermediate Q06: What happens when intersection types have conflicting properties?

<!-- question-id:types-unions-intersections-and-discriminated-unions-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

If two intersected types define the same property with incompatible types, the resulting property may become `never`, because no value can satisfy both requirements.

Example:

```ts
type A = { id: string };
type B = { id: number };

type C = A & B;
```

`C["id"]` is effectively `never` because a value cannot be both a string and a number.

This usually means the type model is wrong. You may need a union instead of an intersection, or you may need to rename or omit conflicting properties.

##### Key Points to Mention

- Intersection means all requirements at once.
- Conflicting property types can become `never`.
- Often indicates a design mistake.
- Use union for alternatives.
- Use `Omit` to remove conflicting inherited props.
- Be careful when combining native HTML props with custom props.

<!-- question:end:types-unions-intersections-and-discriminated-unions-intermediate-q06 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-intermediate-q07 -->
#### Intermediate Q07: Why is `unknown` safer than `any`?

<!-- question-id:types-unions-intersections-and-discriminated-unions-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

`any` disables type checking for a value, so TypeScript lets you access any property or call any method. This can hide real bugs. `unknown` means the value is not known yet, so TypeScript requires you to narrow or validate it before using it.

Example:

```ts
function handle(value: unknown) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }

  return "Unsupported";
}
```

Use `unknown` for untrusted data such as API responses, local storage values, or dynamic input.

##### Key Points to Mention

- `any` disables type safety.
- `unknown` requires narrowing.
- Use `unknown` for untrusted data.
- Type guards can narrow `unknown`.
- Safer than type assertions.
- Helps avoid runtime errors.

<!-- question:end:types-unions-intersections-and-discriminated-unions-intermediate-q07 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-intermediate-q08 -->
#### Intermediate Q08: What is the difference between static TypeScript types and runtime validation?

<!-- question-id:types-unions-intersections-and-discriminated-unions-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

TypeScript types are checked at compile time and are mostly removed from the emitted JavaScript. They help catch mistakes in code you write, but they do not validate runtime data.

Runtime validation checks actual values while the application is running. It is needed for data from APIs, user input, local storage, and external systems.

Example:

```ts
const user = await response.json() as User;
```

This tells TypeScript to trust the value, but it does not prove the response is actually a `User`.

For untrusted data, validate it with type guards or schema validation.

##### Key Points to Mention

- TypeScript types are compile-time only.
- Runtime data can still be invalid.
- Type assertions do not validate.
- API responses should be validated when correctness matters.
- Type guards can narrow runtime values.
- TypeScript does not replace backend validation.

<!-- question:end:types-unions-intersections-and-discriminated-unions-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q01 -->
#### Advanced Q01: How would you model an async API state in React using discriminated unions?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would model each valid state as a separate object shape with a shared discriminant property such as `status`.

Example:

```ts
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };
```

Usage:

```tsx
function UserList({ state }: { state: AsyncState<User[]> }) {
  switch (state.status) {
    case "idle":
      return <p>Start search.</p>;

    case "loading":
      return <p>Loading...</p>;

    case "error":
      return <p>{state.error}</p>;

    case "success":
      return (
        <ul>
          {state.data.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      );
  }
}
```

This prevents impossible combinations such as loading with data and error at the same time.

##### Key Points to Mention

- Use a generic discriminated union.
- Common discriminant: `status`.
- Each state has only valid properties.
- Prevents invalid UI states.
- TypeScript narrows in each branch.
- Works well with rendering logic.
- Add exhaustive checking for safety.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q01 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q02 -->
#### Advanced Q02: How would you type a polymorphic or variant-based React component safely?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

For a variant-based component, I would use a discriminated union where each variant defines only the props it supports. Shared props can be extracted and combined with an intersection.

Example:

```tsx
type BaseProps = {
  children: React.ReactNode;
  className?: string;
};

type LinkProps = BaseProps & {
  as: "link";
  href: string;
  onClick?: never;
};

type ButtonProps = BaseProps & {
  as: "button";
  onClick: () => void;
  href?: never;
};

type ActionProps = LinkProps | ButtonProps;
```

The component narrows on `props.as` before accessing `href` or `onClick`. This prevents invalid prop combinations.

##### Key Points to Mention

- Use discriminated union for variants.
- Use shared base props with intersection.
- Use `never` for mutually exclusive props.
- Narrow before accessing variant-specific props.
- Avoid early destructuring if it weakens narrowing.
- Keep types readable.
- Do not over-engineer simple components.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q02 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q03 -->
#### Advanced Q03: How would you type reducer actions with discriminated unions?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Reducer actions should be modeled as a discriminated union with a `type` property. Each action should include only the payload it needs.

Example:

```ts
type TodoAction =
  | { type: "add"; text: string }
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string }
  | { type: "clearCompleted" };

function todoReducer(state: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case "add":
      return [...state, { id: crypto.randomUUID(), text: action.text, done: false }];

    case "toggle":
      return state.map((todo) =>
        todo.id === action.id ? { ...todo, done: !todo.done } : todo
      );

    case "remove":
      return state.filter((todo) => todo.id !== action.id);

    case "clearCompleted":
      return state.filter((todo) => !todo.done);
  }
}
```

This makes invalid actions fail at compile time and lets TypeScript narrow the payload in each case.

##### Key Points to Mention

- Use `type` as discriminant.
- Each action has only required payload.
- Prevents missing or invalid payloads.
- TypeScript narrows inside `switch`.
- Add exhaustive checks for future safety.
- Useful for `useReducer` and state machines.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q03 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q04 -->
#### Advanced Q04: How do you choose between `type` and `interface` in a React TypeScript project?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Both `type` and `interface` can describe object shapes, so either can be used for many React prop models. I choose `type` when I need unions, intersections, utility types, tuples, primitives, or complex composition. I choose `interface` when defining an extendable object shape, especially in public APIs where declaration merging may be useful.

For application code, consistency matters more than strict preference. Since unions and discriminated unions require type aliases, I often use `type` for variant-based React props and state models.

##### Key Points to Mention

- Both can describe object shapes.
- `type` supports unions and intersections directly.
- `interface` supports declaration merging.
- `interface` is good for extendable object contracts.
- `type` is common for React props with variants.
- Team consistency matters.
- Avoid arguing style when either is acceptable.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q04 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q05 -->
#### Advanced Q05: How can utility types interact with unions?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Utility types can transform and filter union members. For example, `Extract` can select a specific union member, and `Exclude` can remove one.

Example:

```ts
type Action =
  | { type: "create"; name: string }
  | { type: "update"; id: string; name: string }
  | { type: "delete"; id: string };

type DeleteAction = Extract<Action, { type: "delete" }>;
type NonDeleteAction = Exclude<Action, { type: "delete" }>;
```

`DeleteAction` becomes the delete branch. `NonDeleteAction` becomes create or update.

Utility types are powerful, but deeply nested or overly clever type transformations can hurt readability and produce confusing errors.

##### Key Points to Mention

- `Extract` selects union members.
- `Exclude` removes union members.
- `Omit` and `Pick` transform object shapes.
- Utility types are compile-time only.
- Useful for reusable React prop types.
- Avoid unreadable type-level programming.
- Name complex derived types.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q05 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q06 -->
#### Advanced Q06: How would you prevent invalid controlled vs uncontrolled input props?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

I would use a union type to model controlled and uncontrolled modes separately.

Example:

```tsx
type ControlledProps = {
  value: string;
  onChange: (value: string) => void;
  defaultValue?: never;
};

type UncontrolledProps = {
  defaultValue?: string;
  value?: never;
  onChange?: never;
};

type TextInputProps = {
  label: string;
} & (ControlledProps | UncontrolledProps);
```

This prevents the component from receiving both `value` and `defaultValue`, which is a common React mistake. It also ensures that if `value` is provided, `onChange` is required.

##### Key Points to Mention

- Model each mode separately.
- Use union for alternatives.
- Use `never` to forbid invalid props.
- Controlled requires `value` and `onChange`.
- Uncontrolled can use `defaultValue`.
- Prevents common React prop misuse.
- Keep the API understandable.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q06 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q07 -->
#### Advanced Q07: What are the limitations of discriminated unions?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Discriminated unions are powerful, but they can become verbose and hard to read when there are too many variants or deeply nested conditions. Error messages can become complex. Destructuring can sometimes weaken narrowing. Runtime data still needs validation because TypeScript types are not runtime checks.

They can also be overkill for simple components where optional props are clear enough. A good developer uses discriminated unions when they prevent real invalid states, not just because the pattern is available.

##### Key Points to Mention

- Can become verbose.
- Complex unions can create confusing errors.
- Destructuring may affect narrowing.
- Does not validate runtime data.
- Can be overkill for simple props.
- Needs clear discriminant design.
- Best when it prevents real invalid states.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q07 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q08 -->
#### Advanced Q08: How do you handle API response types safely in TypeScript?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

I would separate the compile-time type from runtime validation. The API result can be modeled as a discriminated union, but the raw JSON should be treated as `unknown` until validated.

Example:

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

When fetching:

```ts
const raw: unknown = await response.json();
```

Then validate the shape before using it as `ApiResult<User[]>`. For critical data, use a schema validation library or well-tested type guards.

Do not blindly use `as User` for untrusted API data unless the boundary is already validated elsewhere.

##### Key Points to Mention

- Treat raw API data as `unknown`.
- TypeScript does not validate runtime JSON.
- Use discriminated union for success/error result.
- Validate with type guards or schemas.
- Avoid unsafe `as` assertions.
- Align frontend types with backend contracts.
- Handle error states explicitly.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q08 -->

<!-- question:start:types-unions-intersections-and-discriminated-unions-advanced-q09 -->
#### Advanced Q09: How would you explain "make invalid states unrepresentable" with TypeScript unions?

<!-- question-id:types-unions-intersections-and-discriminated-unions-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

"Make invalid states unrepresentable" means designing types so that impossible or invalid combinations cannot be created in the first place.

For example, this model allows invalid states:

```ts
type State = {
  loading: boolean;
  data?: User[];
  error?: string;
};
```

It can represent loading with data and error at the same time.

This model only allows valid states:

```ts
type State =
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };
```

Now the compiler helps enforce the UI state machine. This reduces defensive checks and runtime bugs.

##### Key Points to Mention

- Design types to allow only valid combinations.
- Avoid broad optional-property objects for state machines.
- Use discriminated unions.
- Compiler catches invalid state construction.
- Rendering logic becomes clearer.
- Especially useful for async state, forms, reducers, and variants.
- Improves maintainability.

<!-- question:end:types-unions-intersections-and-discriminated-unions-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
