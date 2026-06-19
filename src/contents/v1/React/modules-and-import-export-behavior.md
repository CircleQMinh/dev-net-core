---
id: modules-and-import-export-behavior
topic: JavaScript fundamentals
subtopic: Modules and import/export behavior
category: React
---

## Overview

JavaScript modules let developers split an application into files with explicit dependencies. A module can export values such as functions, components, constants, classes, objects, and types, and another module can import those values where they are needed.

In React applications, modules are everywhere:

- Components are imported into pages and layouts.
- Hooks are exported from shared files.
- Utility functions are reused across features.
- Route-level code can be lazy loaded with dynamic `import()`.
- TypeScript types can be imported and exported separately from runtime values.
- Bundlers use module structure to build dependency graphs, split code, and remove unused exports.

This topic matters in interviews because import/export behavior is often where JavaScript, React, TypeScript, and bundlers meet. A candidate who understands modules can explain why an import fails, why a circular dependency creates `undefined`, why a default export works differently from a named export, why a file with top-level side effects is risky, and why `React.lazy` expects a default export.

The practical goal is to organize React code into clear module boundaries, export stable public APIs, avoid confusing dependency cycles, and understand how the build tool interprets the dependency graph.

## Core Concepts

### What a JavaScript Module Is

A JavaScript module is a file that can explicitly export values and import values from other modules. In modern React projects, source files are usually ES modules:

```js
// math.js
export function add(a, b) {
  return a + b;
}

export const PI = 3.14159;
```

```js
// app.js
import { add, PI } from "./math.js";

console.log(add(2, 3));
console.log(PI);
```

Modules help by making dependencies explicit. Instead of relying on globals or script load order, each file states what it needs.

In React, a component module commonly looks like this:

```jsx
// UserCard.jsx
export function UserCard({ user }) {
  return (
    <article>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </article>
  );
}
```

```jsx
// UserList.jsx
import { UserCard } from "./UserCard.jsx";

export function UserList({ users }) {
  return users.map((user) => <UserCard key={user.id} user={user} />);
}
```

### Named Exports

A named export exports a value by its declared name or by an explicit export list.

```js
export const API_BASE_URL = "/api";

export function formatUserName(user) {
  return `${user.firstName} ${user.lastName}`;
}
```

```js
import { API_BASE_URL, formatUserName } from "./users.js";
```

Named exports are useful when a module exposes multiple related values:

```js
// userSelectors.js
export const selectUserById = (state, id) => state.users.byId[id];
export const selectAllUsers = (state) => state.users.allIds.map((id) => state.users.byId[id]);
export const selectActiveUsers = (state) => selectAllUsers(state).filter((user) => user.active);
```

Benefits of named exports:

- The import name must match the export name, which improves clarity.
- Refactoring tools can find usages easily.
- A module can expose several related values.
- Bundlers can more easily identify unused exports in many cases.

Named imports can be renamed locally:

```js
import { formatUserName as formatName } from "./users.js";

console.log(formatName(user));
```

### Default Exports

A default export is the single primary export from a module.

```jsx
// Button.jsx
export default function Button({ children }) {
  return <button>{children}</button>;
}
```

```jsx
// Toolbar.jsx
import Button from "./Button.jsx";
```

The importing file chooses the local name:

```jsx
import PrimaryButton from "./Button.jsx";
import AnyNameHere from "./Button.jsx";
```

This flexibility can be convenient, but it can also reduce consistency if different files import the same thing under different names. In team codebases, named exports often make large-scale refactoring and searching easier, while default exports are commonly used for route components, page components, or modules with one obvious main value.

### Named vs Default Exports

Named and default exports solve different communication problems.

Named export:

```js
export function parsePrice(value) {
  return Number(value);
}

export function formatPrice(value) {
  return `$${value.toFixed(2)}`;
}
```

```js
import { parsePrice, formatPrice } from "./price.js";
```

Default export:

```jsx
export default function ProductPage() {
  return <main>Products</main>;
}
```

```jsx
import ProductPage from "./ProductPage.jsx";
```

Common interview comparison:

| Export style | Best for | Trade-off |
|---|---|---|
| Named export | Shared utilities, hooks, constants, multiple values | Import name must match or be aliased |
| Default export | One primary value such as a page or lazy component | Import name can drift across files |
| Mixed exports | Primary value plus helpers | Can make module API less obvious if overused |

Avoid treating default exports as automatically better. In React projects, consistency matters more than preference.

### Import Paths and Module Specifiers

The string after `from` is the module specifier.

```js
import { calculateTotal } from "../orders/calculateTotal.js";
import { useAuth } from "@/features/auth/useAuth";
import React from "react";
```

Common specifier types:

- Relative path: `./Button`, `../utils/date`
- Absolute or alias path configured by the project: `@/components/Button`
- Package name: `react`, `zod`, `date-fns`
- URL in some browser-native module scenarios

In browser-native ES modules, relative file imports usually need file extensions. In many React build setups, bundlers and TypeScript resolve extensionless imports such as `./Button`. The behavior depends on the bundler, TypeScript configuration, and runtime.

Common mistake:

```js
// Often fails in browser-native modules without an import map or bundler.
import { Button } from "components/Button";
```

Safer relative form:

```js
import { Button } from "./components/Button.js";
```

Common React project form with a configured alias:

```js
import { Button } from "@/components/Button";
```

An interview answer should connect module specifiers to the environment: browser, Node.js, TypeScript, Vite, Webpack, Next.js, or another framework.

### Static Imports

Static imports are top-level declarations:

```js
import { fetchUsers } from "./api/users.js";

export async function loadUsers() {
  return fetchUsers();
}
```

Static imports have important properties:

- They must appear at the module top level.
- They are resolved before the importing module runs.
- They let tools build a dependency graph before runtime.
- They support tree-shaking and static analysis.
- They cannot be placed inside `if`, `for`, or function bodies.

Invalid:

```js
if (shouldLoadAdmin) {
  import { AdminPanel } from "./AdminPanel.jsx";
}
```

Use dynamic `import()` for conditional loading:

```js
if (shouldLoadAdmin) {
  const module = await import("./AdminPanel.jsx");
  const AdminPanel = module.default;
}
```

### Dynamic Import

Dynamic `import()` is an expression that returns a Promise for the module namespace object.

```js
async function loadFormatter(locale) {
  const module = await import(`./formatters/${locale}.js`);
  return module.formatDate;
}
```

In React, dynamic import is commonly used with `React.lazy`:

```jsx
import { Suspense, lazy } from "react";

const SettingsPage = lazy(() => import("./SettingsPage.jsx"));

export function AppRoutes() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <SettingsPage />
    </Suspense>
  );
}
```

Dynamic import is useful for:

- Route-level code splitting.
- Loading admin-only screens only for authorized users.
- Loading large editors, charts, maps, or markdown previewers only when needed.
- Deferring rarely used logic.

Trade-offs:

- Adds async loading states.
- Can create request waterfalls if used carelessly.
- Requires error handling for failed chunk loads.
- May need framework-specific route splitting patterns.

### React.lazy and Default Exports

`React.lazy` expects the dynamic import Promise to resolve to an object with a `default` export that is a valid React component.

```jsx
const ProfilePage = lazy(() => import("./ProfilePage.jsx"));
```

This works naturally when `ProfilePage.jsx` has a default export:

```jsx
export default function ProfilePage() {
  return <main>Profile</main>;
}
```

If the file uses a named export:

```jsx
export function ProfilePage() {
  return <main>Profile</main>;
}
```

you can adapt it:

```jsx
const ProfilePage = lazy(() =>
  import("./ProfilePage.jsx").then((module) => ({
    default: module.ProfilePage,
  }))
);
```

In interviews, this often reveals whether a candidate understands both module namespace objects and React lazy loading.

### Module Namespace Imports

A namespace import collects all named exports into an object-like namespace:

```js
import * as dateUtils from "./dateUtils.js";

console.log(dateUtils.formatDate(new Date()));
console.log(dateUtils.parseDate("2026-06-19"));
```

Namespace imports can be useful for grouping utilities, but overuse can hide which functions are actually needed.

Prefer this when it improves clarity:

```js
import { formatDate, parseDate } from "./dateUtils.js";
```

Use namespace imports when the grouping itself is meaningful:

```js
import * as analytics from "@/platform/analytics";

analytics.trackPageView("checkout");
analytics.trackEvent("payment_started");
```

### Re-exports and Barrel Files

A re-export forwards exports from another module.

```js
export { Button } from "./Button.jsx";
export { Modal } from "./Modal.jsx";
export { TextField } from "./TextField.jsx";
```

A file that mainly re-exports from several files is often called a barrel file:

```js
// components/index.js
export { Button } from "./Button.jsx";
export { Card } from "./Card.jsx";
export { Dialog } from "./Dialog.jsx";
```

Then consumers can import from one entry point:

```js
import { Button, Card } from "@/components";
```

Benefits:

- Cleaner public API for a folder or package.
- Easier to hide internal file layout.
- Convenient imports for consumers.

Risks:

- Can accidentally create circular dependencies.
- Can pull in side-effectful modules earlier than expected.
- Can make dependency graphs harder to understand.
- Can slow development tooling in very large projects if every folder has broad barrels.

Good practice: use barrel files at deliberate boundaries, not automatically in every directory.

### Live Bindings

ES module imports are live bindings. That means an imported binding reflects the current value exported by the exporting module. The importing file cannot reassign the imported binding, but if the exporter updates it, importers see the update.

```js
// counter.js
export let count = 0;

export function increment() {
  count += 1;
}
```

```js
// app.js
import { count, increment } from "./counter.js";

console.log(count); // 0
increment();
console.log(count); // 1
```

Invalid:

```js
import { count } from "./counter.js";

count = 10; // Error: imported bindings are read-only in the importing module
```

Important nuance: read-only binding does not mean deeply immutable object.

```js
// config.js
export const settings = {
  theme: "light",
};
```

```js
// app.js
import { settings } from "./config.js";

settings.theme = "dark"; // The object can still be mutated.
```

For React apps, exporting mutable shared objects is usually risky because any module can change shared state outside React's state flow. Prefer functions, constants, factories, context, stores, or immutable data patterns.

### Module Evaluation and Top-Level Code

A module's top-level code runs when the module is loaded and evaluated.

```js
console.log("analytics module loaded");

export function track(eventName) {
  console.log(eventName);
}
```

If another file imports this module, the top-level `console.log` runs during module evaluation.

Top-level side effects include:

- Registering global event listeners.
- Writing to `localStorage`.
- Starting timers.
- Calling APIs.
- Modifying globals.
- Mutating shared objects.

In React, prefer keeping side effects inside appropriate places:

- Event handlers for user actions.
- `useEffect` for synchronization with external systems.
- App initialization code for deliberate startup work.

Avoid hidden side effects in utility modules:

```js
// Risky: importing this file changes global behavior immediately.
window.addEventListener("resize", handleResize);

export function getWindowSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}
```

Better:

```js
export function subscribeToWindowResize(handler) {
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler);
}
```

### Circular Dependencies

A circular dependency happens when modules import each other directly or indirectly.

```js
// a.js
import { b } from "./b.js";

export const a = "A";
export const fromB = b;
```

```js
// b.js
import { a } from "./a.js";

export const b = "B";
export const fromA = a;
```

ES modules can support some cycles because bindings are live, but cycles can still fail if a module reads an imported binding before it is initialized.

React-specific examples:

- `components/index.js` exports everything, while a component imports from that same barrel.
- A feature module imports a shared store, while the store imports feature-specific actions.
- A route file imports a component, and the component imports route configuration.

Symptoms:

- `undefined` imported values.
- Runtime errors about accessing values before initialization.
- Tests passing individually but failing when run together.
- Hot module replacement behaving strangely.

Fixes:

- Extract shared types or constants to a third module.
- Move wiring code closer to the composition root.
- Avoid importing from a barrel inside files that the barrel itself exports.
- Separate low-level utilities from feature-level modules.

### CommonJS Interop

Older Node.js packages often use CommonJS:

```js
const express = require("express");

module.exports = function createServer() {
  return express();
};
```

Modern React source code usually uses ES modules:

```js
import React from "react";
export function App() {}
```

Bundlers and TypeScript often smooth over differences between CommonJS and ES modules, but interop can still create confusing default import behavior.

Examples of possible confusion:

```js
import thing from "some-commonjs-package";
import * as thingNamespace from "some-commonjs-package";
const thingRequire = require("some-commonjs-package");
```

Depending on package format, TypeScript settings, and bundler behavior, these can produce different shapes. In interviews, the important point is not memorizing every interop rule. The important point is recognizing that CommonJS `module.exports` and ES module `export default` are different systems that tooling may bridge.

### TypeScript Type Imports

React projects often separate runtime imports from type-only imports.

```ts
import type { User } from "./types";
import { fetchUser } from "./api";

export async function loadUser(id: string): Promise<User> {
  return fetchUser(id);
}
```

`import type` communicates that the import is only needed for type checking and should not become a runtime dependency.

This matters because:

- It avoids accidental runtime imports.
- It helps bundlers and TypeScript emit cleaner output.
- It prevents side-effectful modules from being loaded just for types.
- It makes component APIs clearer.

Common pattern:

```tsx
import type { ReactNode } from "react";

type CardProps = {
  title: string;
  children: ReactNode;
};

export function Card({ title, children }: CardProps) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```

### Tree-Shaking and Side Effects

Tree-shaking is a bundler optimization that removes unused exports from the final bundle when it can safely prove they are unused.

```js
// math.js
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
```

```js
import { add } from "./math.js";

console.log(add(1, 2));
```

If `multiply` is unused, the bundler may remove it from the production output.

Tree-shaking works best when:

- Modules use static ES imports and exports.
- Modules avoid hidden top-level side effects.
- Imports are specific.
- Package metadata accurately describes side effects.

Poor pattern:

```js
import "@/features";
```

This import may run many modules for their side effects, making it harder to remove unused code.

Better pattern:

```js
import { CheckoutPage } from "@/features/checkout";
```

### Organizing Modules in React Applications

A React feature folder might expose a small public API:

```text
features/
  users/
    api/
      fetchUsers.ts
    components/
      UserCard.tsx
      UserList.tsx
    hooks/
      useUsers.ts
    index.ts
```

```ts
// features/users/index.ts
export { UserList } from "./components/UserList";
export { useUsers } from "./hooks/useUsers";
export type { User } from "./types";
```

Other features import through the public API:

```tsx
import { UserList } from "@/features/users";
```

But files inside the same feature can import directly:

```tsx
import { UserCard } from "../components/UserCard";
```

Good module boundaries:

- Export what consumers need.
- Keep internal helpers internal.
- Avoid cross-feature imports into deep private files.
- Avoid one global `utils` folder that mixes unrelated concerns.
- Keep side effects explicit and close to where they are used.

### Common Mistakes

Common mistakes include:

- Importing a named export as if it were default.
- Importing a default export with curly braces.
- Creating circular dependencies through barrel files.
- Putting expensive side effects at module top level.
- Exporting mutable shared objects and mutating them across files.
- Using dynamic imports for tiny code paths where the loading complexity is not worth it.
- Forgetting that `React.lazy` expects a default export.
- Assuming TypeScript path aliases automatically work in every runtime tool.
- Mixing CommonJS and ES module syntax without understanding the build setup.

### Best Practices

Use these rules of thumb:

- Prefer named exports for shared utilities, hooks, constants, and reusable components unless the team standard says otherwise.
- Use default exports deliberately for pages, route components, or modules with one obvious primary value.
- Keep module top-level code mostly declarative.
- Use dynamic import for meaningful code splitting, not as a default import style.
- Avoid importing from a barrel file inside a file exported by that same barrel.
- Use `import type` for TypeScript-only dependencies.
- Keep public APIs small and stable.
- Treat modules as architecture boundaries, not just file separators.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a JavaScript module, and why is it useful in React applications?

<!-- question:start:modules-and-import-export-behavior-beginner-q01 -->
<!-- question-id:modules-and-import-export-behavior-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A JavaScript module is a file that can explicitly export values and import values from other files. It is useful because it lets developers split an application into smaller units with clear dependencies instead of relying on global variables or script order.

In React applications, modules are used for components, hooks, utilities, API clients, constants, route files, and shared types. A component might export `UserCard`, and another component can import and render it. This makes the codebase easier to organize, test, refactor, and bundle.

Modules also help build tools understand the dependency graph. That enables features such as code splitting, tree-shaking, hot reload, and better error messages.

##### Key Points to Mention

- Modules make dependencies explicit.
- React components, hooks, and utilities are commonly organized as modules.
- Modules avoid global namespace pollution.
- Bundlers use imports and exports to build dependency graphs.
- Good module boundaries improve maintainability.

<!-- question:end:modules-and-import-export-behavior-beginner-q01 -->

#### What is the difference between a named export and a default export?

<!-- question:start:modules-and-import-export-behavior-beginner-q02 -->
<!-- question-id:modules-and-import-export-behavior-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A named export exports a value by name, and the importing file must import that exact name unless it aliases it.

```js
export function Button() {}
import { Button } from "./Button";
```

A default export is the module's primary export. It is imported without curly braces, and the importing file chooses the local name.

```js
export default function Button() {}
import Button from "./Button";
```

Named exports are often good for utilities, hooks, constants, and modules that export several values. Default exports are often used when a module has one obvious main value, such as a page component. Teams should choose consistent conventions because inconsistent export styles cause confusing imports.

##### Key Points to Mention

- Named imports use curly braces.
- Default imports do not use curly braces.
- A file can have many named exports but only one default export.
- Named exports make refactoring and search more explicit.
- Default exports are common for page or route components.

<!-- question:end:modules-and-import-export-behavior-beginner-q02 -->

#### Why do import paths such as `./Button`, `../utils/date`, and `@/components/Button` behave differently?

<!-- question:start:modules-and-import-export-behavior-beginner-q03 -->
<!-- question-id:modules-and-import-export-behavior-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The string in an import is called a module specifier. A relative specifier such as `./Button` or `../utils/date` is resolved relative to the current file. A package specifier such as `react` is resolved from installed dependencies. An alias such as `@/components/Button` only works if the project configures that alias in tools like TypeScript, Vite, Webpack, or the framework.

In browser-native modules, relative imports may require explicit file extensions. In many React projects, the bundler resolves extensionless imports. Interview answers should mention that import resolution is environment-dependent.

##### Key Points to Mention

- `./` and `../` are relative imports.
- Package imports resolve from dependencies.
- Aliases require project configuration.
- Browser-native modules and bundlers may resolve paths differently.
- TypeScript path aliases must align with the bundler or framework.

<!-- question:end:modules-and-import-export-behavior-beginner-q03 -->

#### What is dynamic `import()`, and when would you use it in React?

<!-- question:start:modules-and-import-export-behavior-beginner-q04 -->
<!-- question-id:modules-and-import-export-behavior-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Dynamic `import()` is an expression that loads a module asynchronously and returns a Promise. Unlike static imports, it can be used inside functions, event handlers, conditions, or route-loading logic.

In React, dynamic imports are commonly used for code splitting. For example, a large settings page, admin page, chart library, or markdown editor can be loaded only when the user reaches that part of the app. With `React.lazy`, dynamic import can lazy-load a component and render it inside a `Suspense` boundary.

```jsx
import { lazy, Suspense } from "react";

const SettingsPage = lazy(() => import("./SettingsPage"));

export function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <SettingsPage />
    </Suspense>
  );
}
```

##### Key Points to Mention

- Dynamic `import()` returns a Promise.
- It supports conditional and on-demand loading.
- It is commonly used for route-level code splitting.
- `React.lazy` uses dynamic import for lazy components.
- Lazy loading needs loading and error-state thinking.

<!-- question:end:modules-and-import-export-behavior-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What does it mean that ES module imports are live bindings?

<!-- question:start:modules-and-import-export-behavior-intermediate-q01 -->
<!-- question-id:modules-and-import-export-behavior-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Live bindings mean an imported binding reflects the current value from the exporting module. If the exporting module changes an exported variable, importers observe the updated value. However, the importing module cannot reassign the imported binding.

```js
// counter.js
export let count = 0;
export function increment() {
  count += 1;
}
```

```js
// app.js
import { count, increment } from "./counter.js";

console.log(count); // 0
increment();
console.log(count); // 1
```

This is different from receiving a frozen copy of the value. It is also different from deep immutability. If a module exports an object, another module may still mutate that object's properties unless the object is frozen or protected by convention.

##### Key Points to Mention

- Imports are connected to exported bindings.
- Importers cannot reassign imported bindings.
- Exported object values can still be mutated.
- Live bindings are one reason some circular dependencies can work.
- Mutable shared exports are usually risky in React apps.

<!-- question:end:modules-and-import-export-behavior-intermediate-q01 -->

#### How do modules help bundlers with tree-shaking?

<!-- question:start:modules-and-import-export-behavior-intermediate-q02 -->
<!-- question-id:modules-and-import-export-behavior-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Tree-shaking is the process of removing unused code from the production bundle. ES modules help because static `import` and `export` declarations let bundlers analyze the dependency graph before runtime.

For example, if a module exports `add` and `multiply`, but the application imports only `add`, a bundler may remove `multiply` from the final bundle if it can prove that removing it is safe.

Tree-shaking works best with static imports, clear named exports, and modules without hidden top-level side effects. It can be limited by dynamic patterns, broad side-effect imports, CommonJS interop, or packages that do not clearly describe side effects.

##### Key Points to Mention

- Static ES modules are easier for tools to analyze.
- Unused exports can often be removed.
- Top-level side effects can prevent safe removal.
- Named exports often make usage clearer.
- Dynamic imports are used for splitting, not the same thing as tree-shaking.

<!-- question:end:modules-and-import-export-behavior-intermediate-q02 -->

#### What are barrel files, and what are their trade-offs?

<!-- question:start:modules-and-import-export-behavior-intermediate-q03 -->
<!-- question-id:modules-and-import-export-behavior-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A barrel file is a module, often named `index.ts` or `index.js`, that re-exports values from several other modules. It gives a folder or feature a cleaner public API.

```ts
export { UserList } from "./components/UserList";
export { useUsers } from "./hooks/useUsers";
export type { User } from "./types";
```

Consumers can then import from the feature boundary:

```ts
import { UserList, useUsers } from "@/features/users";
```

The benefit is a cleaner import surface and better encapsulation of internal file layout. The trade-off is that barrels can create circular dependencies, hide which files are actually loaded, trigger side-effectful modules earlier, and make dependency graphs less obvious. They are best used at deliberate boundaries rather than automatically in every folder.

##### Key Points to Mention

- Barrel files re-export from other files.
- They create a public API for a folder or feature.
- They can make imports cleaner.
- They can create circular dependencies.
- Avoid importing from a barrel inside files exported by that barrel.

<!-- question:end:modules-and-import-export-behavior-intermediate-q03 -->

#### What can go wrong with circular module dependencies?

<!-- question:start:modules-and-import-export-behavior-intermediate-q04 -->
<!-- question-id:modules-and-import-export-behavior-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A circular dependency happens when module A imports module B and module B imports module A, either directly or through other modules. ES modules can handle some cycles because imports are live bindings, but cycles can still fail if a value is read before it has been initialized.

In React, circular dependencies often appear through barrel files, shared stores importing feature modules, components importing route configuration, or features reaching into each other's internals.

Symptoms include `undefined` imports, errors about accessing values before initialization, inconsistent test behavior, and confusing hot reload behavior. Fixes include extracting shared constants or types into a third module, moving composition logic upward, reducing barrel usage inside a feature, or separating low-level utilities from feature modules.

##### Key Points to Mention

- Cycles can be direct or indirect.
- Live bindings do not make all cycles safe.
- Reading a binding too early can fail.
- Barrels are a common source of accidental cycles.
- Extracting shared code to a third module often breaks the cycle.

<!-- question:end:modules-and-import-export-behavior-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design module boundaries for a React feature?

<!-- question:start:modules-and-import-export-behavior-advanced-q01 -->
<!-- question-id:modules-and-import-export-behavior-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A good React feature boundary exposes only what other parts of the app need and keeps implementation details private. For example, a `features/users` folder might export `UserList`, `useUsers`, and public types from `features/users/index.ts`, while keeping lower-level components, API functions, selectors, and helpers internal.

Consumers should import from the public feature boundary instead of deep internal paths. Inside the feature, files can import directly from nearby files to avoid unnecessary barrels and accidental cycles.

A strong design also separates pure utilities from React components, keeps side effects in hooks or service functions, uses `import type` for type-only dependencies, and avoids exporting mutable shared objects. The goal is not just clean imports; the goal is a stable dependency direction and a small public API.

##### Key Points to Mention

- Expose a small public API.
- Keep internal helpers internal.
- Avoid cross-feature deep imports.
- Use direct local imports inside the feature.
- Separate pure code, React code, and side-effectful code.

<!-- question:end:modules-and-import-export-behavior-advanced-q01 -->

#### How would you debug an error saying a module does not provide a named or default export?

<!-- question:start:modules-and-import-export-behavior-advanced-q02 -->
<!-- question-id:modules-and-import-export-behavior-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

First, compare the importing code with the exporting code. If the file says `export function Button() {}`, the consumer must use `import { Button } from "./Button"`. If the file says `export default function Button() {}`, the consumer must use `import Button from "./Button"`.

Next, check whether an intermediate barrel file re-exports the value correctly. A component may be exported from its own file but missing from `index.ts`. Also check for spelling and case differences, especially on case-sensitive file systems in CI or Linux containers.

Then inspect TypeScript and bundler resolution. A path alias may work in the editor but fail in the bundler if only `tsconfig.json` is configured. If dynamic import or `React.lazy` is involved, remember that `React.lazy` expects a default export or a transformed Promise that returns `{ default: Component }`.

##### Key Points to Mention

- Match curly-brace imports with named exports.
- Match default imports with default exports.
- Check re-export files.
- Check file casing and path aliases.
- Check `React.lazy` default export expectations.

<!-- question:end:modules-and-import-export-behavior-advanced-q02 -->

#### How does `React.lazy` relate to module export behavior?

<!-- question:start:modules-and-import-export-behavior-advanced-q03 -->
<!-- question-id:modules-and-import-export-behavior-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`React.lazy` accepts a function that returns a Promise. That Promise should resolve to a module object whose `default` property is a React component. This is why the most direct lazy-loading pattern works with default exports.

```jsx
const SettingsPage = lazy(() => import("./SettingsPage"));
```

If `SettingsPage` is a named export, `lazy` will not automatically know which named export to use. You can adapt the module:

```jsx
const SettingsPage = lazy(() =>
  import("./SettingsPage").then((module) => ({
    default: module.SettingsPage,
  }))
);
```

This matters because module namespace objects contain named exports as properties, and `React.lazy` expects one conventional property: `default`. The component also needs to be rendered under a `Suspense` boundary for the loading state.

##### Key Points to Mention

- `lazy` uses dynamic `import()`.
- The resolved module needs a `default` component.
- Named exports need an adapter.
- The lazy component should be declared at module top level.
- Rendering a lazy component requires `Suspense`.

<!-- question:end:modules-and-import-export-behavior-advanced-q03 -->

#### How do top-level module side effects affect large React applications?

<!-- question:start:modules-and-import-export-behavior-advanced-q04 -->
<!-- question-id:modules-and-import-export-behavior-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Top-level module side effects run when the module is evaluated, simply because something imported it. In a large React application, this can make behavior depend on import order, trigger unexpected work during startup, make tests harder to isolate, and reduce bundler optimization opportunities.

Examples include registering global listeners, starting timers, writing to storage, firing analytics events, mutating exported objects, or making network calls at module top level. Some top-level setup is legitimate, such as defining constants or configuring a library in the app entry point, but hidden side effects in shared modules are risky.

A better approach is to export functions, hooks, or explicit initialization APIs. Then the caller decides when the side effect happens. For React, synchronization with external systems usually belongs in `useEffect`, event handlers, or app-level bootstrap code.

##### Key Points to Mention

- Importing a module can execute top-level code.
- Hidden side effects make behavior depend on import order.
- Side effects can hurt tests and tree-shaking.
- Prefer explicit initialization functions.
- In React, external synchronization often belongs in effects or app bootstrap code.

<!-- question:end:modules-and-import-export-behavior-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
