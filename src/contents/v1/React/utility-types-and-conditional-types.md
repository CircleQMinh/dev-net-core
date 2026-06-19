---
id: utility-types-and-conditional-types
topic: TypeScript for React
subtopic: Utility types and conditional types
category: React
---

## Overview

Utility types and conditional types are TypeScript features for creating new types from existing types. They help React developers avoid duplication, keep component APIs consistent, and express relationships between props, state, events, API responses, and reusable helpers.

Utility types are built-in helpers such as `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Readonly`, `NonNullable`, `Extract`, `Exclude`, `Parameters`, `ReturnType`, and `Awaited`.

```ts
type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
};

type UserPreview = Pick<User, "id" | "name">;
type EditableUser = Omit<User, "id" | "role">;
type UserPatch = Partial<EditableUser>;
```

Conditional types use type-level logic:

```ts
type ApiData<T> = T extends Promise<infer Result> ? Result : T;
```

For interviews, this topic matters because it shows whether a developer can design type-safe APIs without overcomplicating the codebase. A strong candidate should know when to use built-in utility types, when to write custom generic helpers, how conditional types use `extends`, how `infer` extracts types, and why distributive conditional types can surprise people.

The practical goal is to reduce repeated type definitions while keeping types readable and connected to real runtime behavior.

## Core Concepts

### Creating Types from Types

TypeScript lets you derive new types from existing types. This is useful because applications often need several related versions of the same shape.

```ts
type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type CreateUserRequest = Pick<User, "name" | "email">;
type UpdateUserRequest = Partial<CreateUserRequest>;
type UserListItem = Pick<User, "id" | "name">;
```

This avoids duplicating fields manually:

```ts
type BadCreateUserRequest = {
  name: string;
  email: string;
};
```

Manual duplication is sometimes fine, especially across domain boundaries, but derived types help when the relationship is intentional and should stay synchronized.

### `Partial<T>`

`Partial<T>` makes every property optional.

```ts
type UserForm = {
  name: string;
  email: string;
  role: "admin" | "user";
};

type UserFormPatch = Partial<UserForm>;
```

Equivalent shape:

```ts
type UserFormPatch = {
  name?: string;
  email?: string;
  role?: "admin" | "user";
};
```

React use case:

```tsx
function updateDraft(patch: Partial<UserForm>) {
  setDraft((current) => ({
    ...current,
    ...patch,
  }));
}
```

Common mistake: using `Partial<T>` for a value that must actually be complete before rendering or submission. `Partial` is good for patches, staged forms, and test builders, but not for finalized data.

### `Required<T>`

`Required<T>` makes every property required.

```ts
type DraftSettings = {
  theme?: "light" | "dark";
  pageSize?: number;
};

type SavedSettings = Required<DraftSettings>;
```

Use this when a value moves from an incomplete stage to a complete stage.

```ts
function saveSettings(settings: SavedSettings) {
  localStorage.setItem("settings", JSON.stringify(settings));
}
```

Be careful: `Required<T>` changes the type, not the runtime value. You still need runtime defaults or validation before treating optional fields as present.

```ts
function normalizeSettings(draft: DraftSettings): SavedSettings {
  return {
    theme: draft.theme ?? "light",
    pageSize: draft.pageSize ?? 25,
  };
}
```

### `Pick<T, K>` and `Omit<T, K>`

`Pick<T, K>` selects a subset of properties. `Omit<T, K>` removes properties.

```ts
type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};

type PublicUser = Omit<User, "passwordHash">;
type UserCardProps = Pick<User, "id" | "name">;
```

React use case:

```tsx
type UserCardProps = Pick<User, "id" | "name"> & {
  onSelect: (id: string) => void;
};

function UserCard({ id, name, onSelect }: UserCardProps) {
  return <button onClick={() => onSelect(id)}>{name}</button>;
}
```

`Pick` is useful when a component needs only a small part of a larger model. `Omit` is useful when adapting a broad type but excluding fields that should not be exposed.

Avoid deriving public API contracts blindly from database models. Sometimes explicit duplication is better when the concepts should evolve independently.

### `Record<K, T>`

`Record<K, T>` creates an object type whose keys are `K` and whose values are `T`.

```ts
type Role = "admin" | "user" | "guest";

const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  user: "User",
  guest: "Guest",
};
```

This is useful for exhaustive lookup tables:

```tsx
type Status = "idle" | "loading" | "success" | "error";

const statusLabels: Record<Status, string> = {
  idle: "Idle",
  loading: "Loading",
  success: "Success",
  error: "Error",
};
```

If a new status is added, TypeScript requires the table to be updated.

`Record<string, T>` is also common:

```ts
type UsersById = Record<string, User>;
```

But prefer a narrower key union when the keys are known.

### `Readonly<T>`

`Readonly<T>` makes properties read-only at compile time.

```ts
type Config = Readonly<{
  apiBaseUrl: string;
  timeoutMs: number;
}>;
```

React use case:

```tsx
type Props = Readonly<{
  user: User;
  onSelect: (id: string) => void;
}>;
```

This communicates that the component should not mutate its props.

Important limitation: `Readonly<T>` is shallow.

```ts
type State = Readonly<{
  user: {
    name: string;
  };
}>;

function mutate(state: State) {
  state.user.name = "Ava"; // The nested object can still be mutable.
}
```

For deep immutability, you need a custom type or library convention. Also remember that TypeScript `readonly` does not freeze values at runtime.

### `NonNullable<T>`

`NonNullable<T>` removes `null` and `undefined` from a type.

```ts
type MaybeUser = User | null | undefined;
type UserOnly = NonNullable<MaybeUser>;
```

This is useful when a runtime check guarantees presence:

```ts
function requireUser(user: User | null): NonNullable<typeof user> {
  if (user === null) {
    throw new Error("Expected user");
  }

  return user;
}
```

React context example:

```tsx
type AuthContextValue = {
  user: User;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth(): NonNullable<React.ContextType<typeof AuthContext>> {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
```

In many cases, the explicit return type can simply be `AuthContextValue`. Use `NonNullable` when it improves clarity, not to make simple code clever.

### `Exclude<T, U>` and `Extract<T, U>`

`Exclude<T, U>` removes union members assignable to `U`. `Extract<T, U>` keeps only union members assignable to `U`.

```ts
type Status = "idle" | "loading" | "success" | "error";

type FinishedStatus = Exclude<Status, "idle" | "loading">;
type PendingStatus = Extract<Status, "idle" | "loading">;
```

They are especially useful with discriminated unions:

```ts
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };

type SuccessState = Extract<RequestState, { status: "success" }>;
type ErrorState = Extract<RequestState, { status: "error" }>;
```

React use case:

```tsx
function SuccessView({ state }: { state: SuccessState }) {
  return <UserList users={state.data} />;
}
```

This keeps component props aligned with the union model.

### `Parameters<T>` and `ReturnType<T>`

`Parameters<T>` extracts a function's parameter tuple. `ReturnType<T>` extracts a function's return type.

```ts
function createUser(input: CreateUserRequest) {
  return {
    id: crypto.randomUUID(),
    ...input,
  };
}

type CreateUserArgs = Parameters<typeof createUser>;
type CreatedUser = ReturnType<typeof createUser>;
```

React custom hook example:

```ts
function useUsers() {
  return {
    users: [] as User[],
    reload: async () => {},
  };
}

type UseUsersResult = ReturnType<typeof useUsers>;
```

This is useful when tests, context values, or child components need to reference the return shape of a hook.

Avoid overusing `ReturnType` when an explicit domain type would be clearer.

### `Awaited<T>`

`Awaited<T>` models what comes out of `await` or `.then`.

```ts
async function fetchUser() {
  const response = await fetch("/api/me");
  return response.json() as Promise<User>;
}

type FetchedUser = Awaited<ReturnType<typeof fetchUser>>;
```

For a React data hook:

```ts
function useUserData(user: Awaited<ReturnType<typeof fetchUser>>) {
  return user.name;
}
```

`Awaited` recursively unwraps Promises, which is useful for API client return types.

### `ComponentProps`

React's type ecosystem includes helpers that are built from TypeScript's type system. A common example is extracting component prop types.

```tsx
type ButtonProps = React.ComponentProps<"button">;

function PrimaryButton(props: ButtonProps) {
  return <button {...props} className={`primary ${props.className ?? ""}`} />;
}
```

For custom components:

```tsx
function UserCard({ user, onSelect }: { user: User; onSelect: (id: string) => void }) {
  return <button onClick={() => onSelect(user.id)}>{user.name}</button>;
}

type UserCardProps = React.ComponentProps<typeof UserCard>;
```

This is useful when wrapping intrinsic elements or reusing a component's props in tests and stories. Be careful not to create confusing dependency cycles between components and types.

### Conditional Types

A conditional type chooses one type or another based on an assignability check.

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;
type B = IsString<number>;
```

More practical:

```ts
type ApiResponse<T> = T extends Error
  ? { ok: false; error: T }
  : { ok: true; data: T };
```

Conditional types are most useful with generics:

```ts
type MaybeArray<T> = T | T[];

type ElementType<T> = T extends Array<infer Item> ? Item : T;

type A = ElementType<string[]>;
type B = ElementType<number>;
```

They let you describe relationships between input types and output types.

### `infer`

`infer` introduces a type variable inside the true branch of a conditional type.

```ts
type ArrayItem<T> = T extends Array<infer Item> ? Item : never;

type UserItem = ArrayItem<User[]>;
```

Promise example:

```ts
type PromiseResult<T> = T extends Promise<infer Result> ? Result : T;

type A = PromiseResult<Promise<User>>;
type B = PromiseResult<string>;
```

Function example:

```ts
type FirstArgument<T> = T extends (arg: infer First, ...rest: never[]) => unknown
  ? First
  : never;
```

Most application code does not need many custom `infer` types. They are more common in libraries, reusable hooks, and API helper layers.

### Distributive Conditional Types

Conditional types distribute over unions when the checked type is a naked generic type parameter.

```ts
type ToArray<T> = T extends unknown ? T[] : never;

type Result = ToArray<string | number>;
```

`Result` becomes:

```ts
string[] | number[]
```

not:

```ts
(string | number)[]
```

To prevent distribution, wrap each side in a tuple:

```ts
type ToArrayNonDistributed<T> = [T] extends [unknown] ? T[] : never;

type Result = ToArrayNonDistributed<string | number>;
```

Now `Result` is:

```ts
(string | number)[]
```

This distinction is a frequent advanced interview topic because it explains why utilities such as `Exclude` and `Extract` work on each union member.

### Mapped Types

Mapped types create object types by iterating over keys.

```ts
type Flags<T> = {
  [Key in keyof T]: boolean;
};

type UserFlags = Flags<User>;
```

Many utility types are based on mapped types:

```ts
type MyPartial<T> = {
  [Key in keyof T]?: T[Key];
};

type MyReadonly<T> = {
  readonly [Key in keyof T]: T[Key];
};
```

React use case:

```ts
type FormErrors<T> = {
  [Key in keyof T]?: string;
};

type LoginForm = {
  email: string;
  password: string;
};

type LoginFormErrors = FormErrors<LoginForm>;
```

This keeps form error keys aligned with form fields.

### Utility Types vs Explicit Types

Utility types are not always better than explicit types.

Derived type:

```ts
type UserCardProps = Pick<User, "id" | "name">;
```

Explicit type:

```ts
type UserCardProps = {
  id: string;
  name: string;
};
```

Use derived types when the relationship is meaningful and should stay synchronized. Use explicit types when the concepts should be allowed to evolve independently.

For example, an API request type should not always be derived from an internal database model. A component prop type should describe what the component needs, not everything a domain object happens to contain.

### Common Mistakes

Common mistakes include:

- Using `Partial<T>` for data that must be complete.
- Using `Omit<T, K>` to hide sensitive fields but still sending the original object at runtime.
- Forgetting that utility types are compile-time only.
- Creating unreadable chains like `Partial<Omit<Pick<T, K>, X>>`.
- Overusing conditional types in application code where explicit types would be clearer.
- Forgetting that conditional types distribute over unions.
- Using `ReturnType` everywhere instead of naming important domain types.
- Expecting `Readonly<T>` to deeply freeze values at runtime.

### Best Practices

Use these rules of thumb:

- Prefer built-in utility types before writing custom ones.
- Keep derived types close to the source type.
- Use `Pick` for small component prop slices.
- Use `Omit` carefully for adaptation, not security.
- Use `Record` for exhaustive lookup maps.
- Use `Extract` and `Exclude` for union filtering.
- Use `ReturnType`, `Parameters`, and `Awaited` for reusable function and API helpers.
- Use conditional types mostly for reusable abstractions, not everyday business logic.
- Name complex derived types so call sites stay readable.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are TypeScript utility types?

<!-- question:start:utility-types-and-conditional-types-beginner-q01 -->
<!-- question-id:utility-types-and-conditional-types-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Utility types are built-in TypeScript helpers that transform existing types into new types. They are available globally and include helpers such as `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Readonly`, `NonNullable`, `Exclude`, `Extract`, `Parameters`, `ReturnType`, and `Awaited`.

For example:

```ts
type UserPreview = Pick<User, "id" | "name">;
type UserPatch = Partial<User>;
type PublicUser = Omit<User, "passwordHash">;
```

In React applications, utility types are useful for component props, form drafts, patch objects, lookup maps, API response helpers, and custom hook return types.

##### Key Points to Mention

- Utility types create new types from existing types.
- They reduce duplication.
- They are compile-time only.
- Common examples include `Partial`, `Pick`, `Omit`, and `Record`.
- React code uses them for props, forms, hooks, and API types.

<!-- question:end:utility-types-and-conditional-types-beginner-q01 -->

#### What is the difference between `Pick` and `Omit`?

<!-- question:start:utility-types-and-conditional-types-beginner-q02 -->
<!-- question-id:utility-types-and-conditional-types-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`Pick<T, K>` creates a type with only selected keys from `T`. `Omit<T, K>` creates a type with selected keys removed.

```ts
type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};

type UserCardProps = Pick<User, "id" | "name">;
type PublicUser = Omit<User, "passwordHash">;
```

Use `Pick` when a component or function needs only a small subset of a type. Use `Omit` when adapting a type by removing fields. Do not treat `Omit` as runtime security; it does not remove fields from actual objects.

##### Key Points to Mention

- `Pick` keeps specified keys.
- `Omit` removes specified keys.
- Both operate only at compile time.
- `Pick` is common for component prop slices.
- `Omit` should not be confused with runtime data filtering.

<!-- question:end:utility-types-and-conditional-types-beginner-q02 -->

#### When would you use `Partial<T>`?

<!-- question:start:utility-types-and-conditional-types-beginner-q03 -->
<!-- question-id:utility-types-and-conditional-types-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`Partial<T>` makes all properties of `T` optional. It is useful for patch objects, staged form state, test builders, and update helpers.

```ts
type ProfileForm = {
  name: string;
  email: string;
};

function updateDraft(patch: Partial<ProfileForm>) {
  setDraft((current) => ({
    ...current,
    ...patch,
  }));
}
```

It should not be used when the value must be complete. If a form is being submitted or a component requires all fields, a complete type is usually better.

##### Key Points to Mention

- `Partial<T>` makes every property optional.
- It is useful for patches and drafts.
- It does not validate runtime data.
- Avoid using it for required complete values.
- It works well with immutable state updates.

<!-- question:end:utility-types-and-conditional-types-beginner-q03 -->

#### What does `Record<K, T>` do?

<!-- question:start:utility-types-and-conditional-types-beginner-q04 -->
<!-- question-id:utility-types-and-conditional-types-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`Record<K, T>` creates an object type with keys `K` and values `T`.

```ts
type Status = "idle" | "loading" | "success" | "error";

const labels: Record<Status, string> = {
  idle: "Idle",
  loading: "Loading",
  success: "Success",
  error: "Error",
};
```

This is useful for lookup maps. When `K` is a union of known keys, TypeScript requires every key to be present and prevents unexpected keys.

##### Key Points to Mention

- `Record<K, T>` maps keys to value types.
- It is useful for dictionaries and lookup tables.
- Literal key unions can enforce completeness.
- `Record<string, T>` is broader than a known key union.
- It is common for labels, render maps, and normalized data.

<!-- question:end:utility-types-and-conditional-types-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What are conditional types?

<!-- question:start:utility-types-and-conditional-types-intermediate-q01 -->
<!-- question-id:utility-types-and-conditional-types-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Conditional types choose one type or another based on whether one type is assignable to another. They look like a ternary expression at the type level.

```ts
type IsString<T> = T extends string ? true : false;
```

They are most useful with generics because they can describe relationships between input types and output types.

```ts
type ElementType<T> = T extends Array<infer Item> ? Item : T;
```

In React applications, conditional types are usually seen inside reusable helpers, library types, custom hook utilities, and advanced prop transformations.

##### Key Points to Mention

- Syntax is `T extends U ? X : Y`.
- The condition is assignability, not runtime logic.
- They are powerful with generics.
- They can use `infer` to extract types.
- They are usually for reusable abstractions.

<!-- question:end:utility-types-and-conditional-types-intermediate-q01 -->

#### What does `infer` do in a conditional type?

<!-- question:start:utility-types-and-conditional-types-intermediate-q02 -->
<!-- question-id:utility-types-and-conditional-types-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`infer` declares a type variable inside the true branch of a conditional type. It lets TypeScript extract part of a matched type.

```ts
type ArrayItem<T> = T extends Array<infer Item> ? Item : never;

type A = ArrayItem<string[]>;
```

Promise example:

```ts
type PromiseResult<T> = T extends Promise<infer Result> ? Result : T;
```

`infer` is useful for extracting array item types, Promise result types, function parameter types, and function return types. Built-in utilities such as `ReturnType` and `Parameters` rely on similar type-level ideas.

##### Key Points to Mention

- `infer` extracts a type from a matched pattern.
- It only appears in conditional types.
- Common use cases include arrays, Promises, and functions.
- It avoids manually indexing into complex types.
- It is powerful but can reduce readability if overused.

<!-- question:end:utility-types-and-conditional-types-intermediate-q02 -->

#### What are distributive conditional types?

<!-- question:start:utility-types-and-conditional-types-intermediate-q03 -->
<!-- question-id:utility-types-and-conditional-types-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A conditional type distributes over a union when the checked type is a naked generic type parameter.

```ts
type ToArray<T> = T extends unknown ? T[] : never;

type Result = ToArray<string | number>;
```

The result is:

```ts
string[] | number[]
```

not:

```ts
(string | number)[]
```

To prevent distribution, wrap the type parameter in a tuple:

```ts
type ToArrayNonDistributed<T> = [T] extends [unknown] ? T[] : never;
```

This behavior explains how utilities like `Exclude` and `Extract` filter union members.

##### Key Points to Mention

- Distribution happens over union members.
- It happens with a naked generic type parameter.
- `Exclude` and `Extract` depend on this behavior.
- Tuple wrapping prevents distribution.
- It is a common source of advanced TypeScript surprises.

<!-- question:end:utility-types-and-conditional-types-intermediate-q03 -->

#### How can `ReturnType`, `Parameters`, and `Awaited` help with React hooks and API clients?

<!-- question:start:utility-types-and-conditional-types-intermediate-q04 -->
<!-- question-id:utility-types-and-conditional-types-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

`ReturnType<T>` extracts a function's return type. `Parameters<T>` extracts its parameter tuple. `Awaited<T>` unwraps Promise-like types. Together, they can keep hook, API, test, and context types synchronized with real functions.

```ts
async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  return response.json() as Promise<User>;
}

type FetchUserArgs = Parameters<typeof fetchUser>;
type FetchUserResult = Awaited<ReturnType<typeof fetchUser>>;
```

For custom hooks:

```ts
function useUsers() {
  return {
    users: [] as User[],
    reload: async () => {},
  };
}

type UsersContextValue = ReturnType<typeof useUsers>;
```

This avoids duplicating function shapes, but important domain types should still be named explicitly when they represent business concepts.

##### Key Points to Mention

- `ReturnType` extracts function return types.
- `Parameters` extracts function arguments.
- `Awaited` unwraps Promise results.
- They reduce duplicated hook and API types.
- Do not hide important domain concepts behind clever extraction.

<!-- question:end:utility-types-and-conditional-types-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### When are utility types better than explicit types, and when are they worse?

<!-- question:start:utility-types-and-conditional-types-advanced-q01 -->
<!-- question-id:utility-types-and-conditional-types-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Utility types are better when the derived type has a real relationship to the source type and should change with it. For example, `Pick<User, "id" | "name">` is useful if a card component truly displays a slice of `User`.

They are worse when they hide intent or couple concepts that should evolve separately. For example, deriving a public API request type directly from an internal database entity can accidentally expose implementation details or create unwanted coupling.

A good rule is to use utility types for local adaptation and synchronization, but write explicit named types for important domain boundaries, public contracts, and concepts that need independent meaning.

##### Key Points to Mention

- Derived types are good when the relationship is intentional.
- Explicit types are better at domain boundaries.
- Over-composed utilities can reduce readability.
- Public API contracts should not blindly mirror internal models.
- Readability matters more than clever type reuse.

<!-- question:end:utility-types-and-conditional-types-advanced-q01 -->

#### How would you type a reusable form error object?

<!-- question:start:utility-types-and-conditional-types-advanced-q02 -->
<!-- question-id:utility-types-and-conditional-types-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

A mapped type can create an error object whose keys match the form fields.

```ts
type FormErrors<T> = {
  [Key in keyof T]?: string;
};

type LoginForm = {
  email: string;
  password: string;
};

type LoginFormErrors = FormErrors<LoginForm>;
```

This ensures that `errors.email` and `errors.password` are allowed while unrelated keys are rejected. If nested forms are involved, the team must decide whether to support nested error objects, flattened paths, or a validation library's schema type.

This pattern is useful because the error type is tied to the form model without manually duplicating every field.

##### Key Points to Mention

- Use a mapped type over `keyof T`.
- Make each error field optional.
- The error keys stay aligned with form fields.
- Nested forms may require a deeper design.
- Keep the type understandable for everyday form code.

<!-- question:end:utility-types-and-conditional-types-advanced-q02 -->

#### How do `Extract` and `Exclude` work with discriminated unions?

<!-- question:start:utility-types-and-conditional-types-advanced-q03 -->
<!-- question-id:utility-types-and-conditional-types-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`Extract` keeps union members assignable to a target type, and `Exclude` removes union members assignable to a target type. Because conditional types distribute over unions, these utilities operate on each union member.

```ts
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: string };

type SuccessState = Extract<RequestState, { status: "success" }>;
type NonLoadingState = Exclude<RequestState, { status: "loading" }>;
```

In React, this can be useful when a child component only accepts a specific variant, such as a success view that requires data. It avoids duplicating the success shape manually.

##### Key Points to Mention

- `Extract` keeps matching union members.
- `Exclude` removes matching union members.
- They rely on distributive conditional types.
- They work well with discriminated unions.
- Useful for variant-specific components and helpers.

<!-- question:end:utility-types-and-conditional-types-advanced-q03 -->

#### What are the risks of advanced conditional types in application code?

<!-- question:start:utility-types-and-conditional-types-advanced-q04 -->
<!-- question-id:utility-types-and-conditional-types-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Advanced conditional types can make application code hard to read, slow to type-check, and difficult for teammates to debug. They can also create surprising behavior because conditional types distribute over unions by default. If the type is more complex than the runtime concept, it may hide design problems.

They are most valuable in reusable libraries, API clients, strongly typed helpers, and places where one generic abstraction removes real duplication. For ordinary component props and business models, explicit types are often clearer.

A good answer should balance type power with maintainability. TypeScript should document and protect the design, not become a puzzle that only one person understands.

##### Key Points to Mention

- Advanced types can reduce readability.
- Distribution over unions can surprise developers.
- Complex types can slow feedback and refactoring.
- Use them when they remove real duplication.
- Prefer explicit types for core business concepts.

<!-- question:end:utility-types-and-conditional-types-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
