---
id: tsconfig-basics-strict-mode-module-settings
topic: TypeScript for React
subtopic: tsconfig basics, strict mode, and module settings
category: React
---


# tsconfig basics, strict mode, and module settings

## Overview

`tsconfig.json` is the main configuration file for a TypeScript project. It tells TypeScript which files belong to the project, how strictly the code should be checked, which JavaScript language features are available, how JSX should be handled, how modules should be interpreted, and whether TypeScript should emit JavaScript output.

In React projects, `tsconfig.json` is especially important because it affects developer experience, build correctness, editor IntelliSense, import behavior, JSX transformation, type checking, and compatibility with bundlers such as Vite, Webpack, Turbopack, or esbuild. A small configuration mistake can produce confusing import errors, missing DOM types, weak type safety, broken JSX support, or a mismatch between what TypeScript accepts and what the runtime or bundler actually supports.

For interviews, this topic matters because TypeScript configuration reveals whether a developer understands TypeScript as a toolchain, not only as a syntax layer. A strong React developer should know:

- What `tsconfig.json` does.
- What `compilerOptions` are.
- What `include`, `exclude`, `files`, and `extends` do.
- Why `strict` mode matters.
- How strictness flags reduce runtime bugs.
- How `target`, `lib`, `jsx`, `module`, and `moduleResolution` affect a React app.
- Why modern React apps often use `noEmit: true`.
- Why Vite-style projects often use `moduleResolution: "bundler"`.
- How path aliases work.
- How to avoid common configuration mistakes.

A good interview answer should connect configuration choices to real development outcomes: safer code, clearer imports, better editor feedback, fewer production bugs, and fewer surprises between local development and production builds.

## Core Concepts

### What is `tsconfig.json`?

`tsconfig.json` is a project-level configuration file used by the TypeScript compiler and TypeScript language service. When a directory contains `tsconfig.json`, TypeScript treats that directory as the root of a TypeScript project.

A basic example:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

This configuration says:

- Type-check files under `src`.
- Assume modern JavaScript output target.
- Use ES module syntax.
- Use the modern React JSX transform.
- Enable strict type checking.
- Do not emit JavaScript from TypeScript itself.

In many React projects, the bundler handles code transformation and output. TypeScript is used mainly for type checking and editor support.

### What belongs in `compilerOptions`?

`compilerOptions` contains most TypeScript behavior settings.

Common options include:

| Option | Purpose |
|---|---|
| `target` | JavaScript version TypeScript should output or type-check against |
| `lib` | Built-in type libraries available to the project |
| `jsx` | How JSX should be transformed or preserved |
| `strict` | Enables strict type-checking behavior |
| `module` | Module format TypeScript assumes or emits |
| `moduleResolution` | How TypeScript resolves imports |
| `noEmit` | Type-check without generating output |
| `baseUrl` | Base directory for non-relative module resolution |
| `paths` | Path alias mappings |
| `types` | Explicit global type packages to include |
| `skipLibCheck` | Skip type checking declaration files |
| `isolatedModules` | Ensure each file can be transpiled independently |
| `allowJs` | Allow JavaScript files in the project |
| `checkJs` | Type-check JavaScript files |

Example:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

### `include`, `exclude`, and `files`

`include`, `exclude`, and `files` control which files belong to the TypeScript project.

#### `include`

`include` tells TypeScript which files or folders to include.

```json
{
  "include": ["src"]
}
```

This is common in React applications because source files are usually inside `src`.

You can use glob patterns:

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

#### `exclude`

`exclude` removes files from the include pattern.

```json
{
  "exclude": ["node_modules", "dist", "coverage"]
}
```

Common exclusions:

- `node_modules`
- `dist`
- `build`
- `coverage`
- generated files
- test output folders

TypeScript excludes some folders like `node_modules` by default in many cases, but being explicit can improve clarity.

#### `files`

`files` explicitly lists exact files.

```json
{
  "files": ["src/main.tsx", "src/vite-env.d.ts"]
}
```

This is less common for normal React apps because the list can become hard to maintain. It is more useful for small tools, libraries, or specialized projects.

### `extends`

`extends` lets one TypeScript configuration inherit from another.

Example:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

This is useful when a repository has multiple projects:

```text
tsconfig.base.json
tsconfig.app.json
tsconfig.node.json
tsconfig.test.json
```

A monorepo or Vite React app may use separate configs for application code and tooling code. For example, browser code and Node-based config files may need different module resolution and libraries.

### `tsconfig` in React applications

A React TypeScript app usually needs:

- TypeScript syntax support.
- JSX support.
- DOM types.
- Modern JavaScript types.
- Strict checking.
- Module settings compatible with the bundler.
- No TypeScript emit if the bundler emits JavaScript.
- Path aliases if used by the project.

Example React/Vite-style app configuration:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,

    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,

    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

Not every project needs every option. The correct config depends on the framework, bundler, runtime, TypeScript version, and team standards.

### `target`

`target` controls which JavaScript language level TypeScript assumes when emitting output. Even when `noEmit` is true, `target` still affects type checking and available syntax assumptions.

Example:

```json
{
  "compilerOptions": {
    "target": "ES2020"
  }
}
```

Common target values include:

- `ES2018`
- `ES2020`
- `ES2021`
- `ES2022`
- `ESNext`

For modern React apps using a bundler, `ES2020` or newer is common. The bundler and browser support policy may further transform code for target browsers.

Important distinction:

```text
TypeScript target is not the same as browser support by itself.
A bundler or transpiler may also transform code based on browser targets.
```

### `lib`

`lib` controls which built-in type declarations are available.

For React browser apps, common libraries are:

```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

Meaning:

- `ES2020`: JavaScript language APIs such as Promise, Map, Set, etc.
- `DOM`: browser APIs such as `document`, `window`, `fetch`, `HTMLElement`.
- `DOM.Iterable`: iterable DOM collections such as `NodeListOf`.

If `DOM` is missing, browser globals may fail:

```ts
document.querySelector("#root");
// Error if DOM lib is not included
```

For Node-only projects, `DOM` may not be appropriate. This is one reason separate `tsconfig` files are useful for browser app code and Node tooling code.

### `jsx`

`jsx` controls how TypeScript handles JSX syntax.

For modern React projects, this is common:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

`react-jsx` supports the modern JSX transform introduced in React 17, where importing `React` just to use JSX is not required.

Example:

```tsx
function App() {
  return <h1>Hello</h1>;
}
```

With modern JSX transform, this can work without:

```tsx
import React from "react";
```

Older React projects may use:

```json
{
  "compilerOptions": {
    "jsx": "react"
  }
}
```

Some bundler setups may use:

```json
{
  "compilerOptions": {
    "jsx": "preserve"
  }
}
```

That keeps JSX in the output for another tool to transform.

For most modern React app projects, `react-jsx` is the practical default.

### `strict`

`strict` enables a group of stricter type-checking rules.

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

This is one of the most important TypeScript options. It makes TypeScript better at catching possible bugs before runtime.

Strict mode usually enables flags such as:

- `noImplicitAny`
- `strictNullChecks`
- `strictFunctionTypes`
- `strictBindCallApply`
- `strictPropertyInitialization`
- `noImplicitThis`
- `alwaysStrict`
- `useUnknownInCatchVariables`

The exact set of strict flags can evolve across TypeScript versions, so treat `strict` as "enable TypeScript's current strict family of checks."

### Why strict mode matters

Without strict mode, TypeScript allows more unsafe code. That can make migration easier but weakens the value of TypeScript.

Example without `strictNullChecks`:

```ts
type User = {
  name: string;
};

function getDisplayName(user: User | null) {
  return user.name;
}
```

Without strict null checking, this may compile. At runtime, it can crash if `user` is `null`.

With strict mode:

```ts
function getDisplayName(user: User | null) {
  if (!user) {
    return "Guest";
  }

  return user.name;
}
```

Strict mode encourages developers to handle missing data, unknown inputs, incorrect function calls, and incomplete object initialization.

In React, strict mode helps catch issues with:

- Optional props.
- Nullable API data.
- Event handler types.
- State initialized as `null`.
- Refs that may not be assigned yet.
- Context values that may be missing.
- Async data before it loads.

### `noImplicitAny`

`noImplicitAny` reports an error when TypeScript cannot infer a type and would otherwise use `any`.

Bad:

```ts
function formatUser(user) {
  return user.name.toUpperCase();
}
```

With `noImplicitAny`, `user` cannot silently become `any`.

Better:

```ts
type User = {
  name: string;
};

function formatUser(user: User) {
  return user.name.toUpperCase();
}
```

This prevents weak typing from spreading through the application.

### `strictNullChecks`

`strictNullChecks` treats `null` and `undefined` as distinct values that must be handled.

Example:

```ts
type User = {
  id: string;
  email?: string;
};

function sendEmail(user: User) {
  user.email.toLowerCase();
}
```

With strict null checks, this is unsafe because `email` may be `undefined`.

Correct:

```ts
function sendEmail(user: User) {
  if (!user.email) {
    return;
  }

  user.email.toLowerCase();
}
```

In React, this is extremely useful for async data:

```tsx
type User = {
  id: string;
  name: string;
};

function Profile({ user }: { user: User | null }) {
  if (!user) {
    return <p>Loading...</p>;
  }

  return <p>{user.name}</p>;
}
```

### Optional properties vs nullable values

TypeScript distinguishes optional properties and explicit nullable values.

Optional:

```ts
type User = {
  email?: string;
};
```

This means `email` may be missing or `undefined`.

Nullable:

```ts
type User = {
  email: string | null;
};
```

This means the property exists, but the value can be `null`.

Optional or nullable:

```ts
type User = {
  email?: string | null;
};
```

This means the property may be missing, `undefined`, `null`, or a string.

In API contracts, prefer modeling the actual backend behavior accurately. Do not use optional fields just because it is convenient.

### `exactOptionalPropertyTypes`

`exactOptionalPropertyTypes` makes optional properties stricter.

```json
{
  "compilerOptions": {
    "exactOptionalPropertyTypes": true
  }
}
```

Without this option, an optional property can often be treated like it allows `undefined`.

Example:

```ts
type ButtonProps = {
  label?: string;
};

const props: ButtonProps = {
  label: undefined
};
```

With `exactOptionalPropertyTypes`, this is stricter: an optional property means the property may be absent, not necessarily explicitly set to `undefined`, unless `undefined` is included in the type.

More explicit:

```ts
type ButtonProps = {
  label?: string | undefined;
};
```

This option can improve accuracy but may require more careful typing, especially with partial objects and object spreading.

### `noUncheckedIndexedAccess`

`noUncheckedIndexedAccess` makes indexed access safer.

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true
  }
}
```

Example:

```ts
const users = ["Alice", "Bob"];

const first = users[0];
const third = users[2];
```

With this option, `users[2]` has type `string | undefined`, because an array access can be out of range.

This is safer:

```ts
const third = users[2];

if (third) {
  console.log(third.toUpperCase());
}
```

This option is useful for robust code but can be noisy in some React apps. Teams often enable it for stricter projects.

### `useUnknownInCatchVariables`

With this strict behavior, catch variables are `unknown` instead of `any`.

```ts
try {
  throw new Error("Failed");
} catch (error) {
  console.log(error.message);
}
```

This is unsafe because anything can be thrown in JavaScript.

Better:

```ts
try {
  throw new Error("Failed");
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
  } else {
    console.log("Unknown error", error);
  }
}
```

This matters in React API error handling because not all thrown values are guaranteed to be `Error` objects.

### `strictFunctionTypes`

`strictFunctionTypes` makes function type compatibility safer, especially around callback parameter types.

Example:

```ts
type Animal = {
  name: string;
};

type Dog = Animal & {
  bark(): void;
};

let handleAnimal: (animal: Animal) => void;

const handleDog = (dog: Dog) => {
  dog.bark();
};

handleAnimal = handleDog;
```

This assignment is unsafe because `handleAnimal` might be called with an `Animal` that is not a `Dog`.

Strict function checking helps prevent incorrect callback assumptions, which is important in React event handlers, generic components, and reusable UI libraries.

### `strictPropertyInitialization`

`strictPropertyInitialization` ensures class properties are initialized.

Bad:

```ts
class UserStore {
  currentUser: string;

  constructor() {
    // currentUser is not initialized
  }
}
```

Correct:

```ts
class UserStore {
  currentUser: string | null = null;
}
```

Or:

```ts
class UserStore {
  currentUser: string;

  constructor(currentUser: string) {
    this.currentUser = currentUser;
  }
}
```

This is less common in function-component React apps but still useful in services, stores, classes, and utility code.

### Avoiding `any`

`any` disables type checking for a value. It is useful for gradual migration or truly dynamic boundaries, but it should not become the default.

Bad:

```ts
function renderUser(user: any) {
  return user.profile.name.toUpperCase();
}
```

This can crash at runtime and TypeScript will not help.

Better:

```ts
type User = {
  profile: {
    name: string;
  };
};

function renderUser(user: User) {
  return user.profile.name.toUpperCase();
}
```

For unknown external data, use `unknown` first and validate.

```ts
function parseUser(value: unknown): User {
  if (
    typeof value === "object" &&
    value !== null &&
    "profile" in value
  ) {
    return value as User;
  }

  throw new Error("Invalid user");
}
```

In production, schema validation libraries can help validate API responses.

### `unknown` vs `any`

`unknown` is safer than `any`.

```ts
function handleValue(value: unknown) {
  value.toUpperCase();
}
```

This fails because TypeScript does not know that `value` is a string.

Correct:

```ts
function handleValue(value: unknown) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }

  return "";
}
```

Comparison:

| Type | Meaning |
|---|---|
| `any` | Turn off type checking for this value |
| `unknown` | Value can be anything, but must be narrowed before use |

Use `unknown` for external input, caught errors, JSON parsing, and uncertain boundaries.

### `noEmit`

`noEmit` tells TypeScript not to output JavaScript files.

```json
{
  "compilerOptions": {
    "noEmit": true
  }
}
```

This is common in React apps because the bundler handles transformation and output.

Typical workflow:

```bash
tsc --noEmit
vite build
```

Meaning:

- `tsc --noEmit` checks types.
- `vite build` bundles/transforms application code.

This separation is common because TypeScript type checking and bundler output are different responsibilities.

### `isolatedModules`

`isolatedModules` warns when code cannot be safely transpiled one file at a time.

```json
{
  "compilerOptions": {
    "isolatedModules": true
  }
}
```

This is useful with bundlers and transpilers that process each file independently, such as Babel, esbuild, or SWC.

Example issue:

```ts
const enum Direction {
  Up,
  Down
}
```

Certain TypeScript-only features can be problematic when the transpiler does not do full type-aware compilation. `isolatedModules` helps catch patterns that may not work correctly in those pipelines.

### `skipLibCheck`

`skipLibCheck` skips type checking of declaration files.

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

This can speed up builds and avoid type errors inside third-party `.d.ts` files.

Trade-off:

- Faster and less noisy.
- May hide declaration-file issues from dependencies.
- Does not skip checking your own source code.

Many React projects use `skipLibCheck: true` for practical build performance.

### `module`

`module` controls the module system TypeScript uses for output and type analysis.

Common values include:

- `ESNext`
- `ES2020`
- `NodeNext`
- `CommonJS`
- `Preserve`

For modern React apps with a bundler, a common setting is:

```json
{
  "compilerOptions": {
    "module": "ESNext"
  }
}
```

This preserves modern ES module syntax for the bundler.

For modern Node.js projects, `NodeNext` is often more appropriate because Node has specific ESM and CommonJS rules.

Important:

```text
module controls how TypeScript understands or emits modules.
moduleResolution controls how TypeScript finds imported modules.
```

They are related, but they are not the same.

### `moduleResolution`

`moduleResolution` controls how TypeScript resolves imports.

Example import:

```ts
import { formatDate } from "@/utils/date";
import React from "react";
```

TypeScript must decide what file or package those imports refer to.

Common values include:

- `bundler`
- `node16`
- `nodenext`
- `node`
- `classic`

For modern React apps using Vite or a similar bundler, this is common:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

`bundler` mode is designed for bundler-based projects. It models the way modern bundlers handle package `exports`, `imports`, and extensionless imports.

For Node.js projects, use Node-specific settings such as `node16` or `nodenext` when the code runs directly in Node and must follow Node's module rules.

### `module` vs `moduleResolution`

These options are often confused.

| Option | Question it answers |
|---|---|
| `module` | What module system should TypeScript assume or emit? |
| `moduleResolution` | How should TypeScript find files and packages from import paths? |

Example:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

This means:

- Keep ES module syntax for the bundler.
- Resolve imports using bundler-style rules.

For React/Vite apps, this is common. For Node apps, this may be wrong because the runtime itself is Node, not a bundler.

### `baseUrl` and `paths`

`baseUrl` and `paths` are used for path aliases.

Example:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"]
    }
  }
}
```

Then code can import:

```ts
import { Button } from "@/components/Button";
import { formatDate } from "@/utils/date";
```

instead of:

```ts
import { Button } from "../../../../components/Button";
```

Important: TypeScript path aliases help TypeScript and the editor understand imports, but the runtime or bundler must also understand them.

In Vite, configure aliases separately:

```ts
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
```

Common mistake:

```text
Adding paths in tsconfig but not configuring the bundler.
```

This can make the editor happy while the app fails at runtime or build time.

### `types`

`types` controls which global type packages are included.

Example for Vite:

```json
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

This makes Vite-specific types available, such as `import.meta.env`.

Example:

```ts
const apiUrl = import.meta.env.VITE_API_URL;
```

For testing, you might have a separate test config:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

Be careful: when `types` is specified, TypeScript includes only the listed global type packages. This can accidentally remove expected global types if configured incorrectly.

### `allowJs` and `checkJs`

`allowJs` lets JavaScript files be part of the TypeScript project.

```json
{
  "compilerOptions": {
    "allowJs": true
  }
}
```

`checkJs` enables type checking for JavaScript files.

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true
  }
}
```

These are useful for gradual migration from JavaScript to TypeScript.

Example JavaScript with JSDoc:

```js
/**
 * @param {number} price
 * @returns {string}
 */
export function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}
```

For new React TypeScript projects, `allowJs` is usually false unless migration is needed.

### `resolveJsonModule`

`resolveJsonModule` allows importing JSON files.

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

Example:

```ts
import packageInfo from "../package.json";

console.log(packageInfo.version);
```

This is useful for configuration, mock data, localization files, or metadata.

### `allowImportingTsExtensions`

`allowImportingTsExtensions` allows imports that include `.ts`, `.tsx`, `.mts`, or `.cts` extensions.

```json
{
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

This is only safe in configurations where TypeScript is not responsible for emitting runnable JavaScript, or where declarations only are emitted. It is common in bundler-based setups but not always needed.

Example:

```ts
import { helper } from "./helper.ts";
```

Many projects still prefer extensionless imports:

```ts
import { helper } from "./helper";
```

Follow the convention expected by your bundler and runtime.

### `verbatimModuleSyntax`

`verbatimModuleSyntax` keeps import/export syntax closer to what you wrote and makes type-only imports more explicit.

```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

Example:

```ts
import type { User } from "./types";
import { fetchUser } from "./api";
```

`import type` is erased from output because it is used only for types.

This improves clarity:

- Type-only imports are explicit.
- Runtime imports are easier to distinguish.
- Bundlers can better understand what code is needed at runtime.
- Accidental runtime imports for type-only usage are reduced.

### Type-only imports

A type-only import imports only TypeScript types, not runtime values.

```ts
import type { Product } from "@/types/product";
```

Use it when importing a type:

```ts
type ProductCardProps = {
  product: Product;
};
```

Use normal imports for runtime values:

```ts
import { formatCurrency } from "@/utils/formatCurrency";
```

This distinction matters because TypeScript types disappear at runtime. Importing a type as a runtime value can cause confusing module behavior.

### `esModuleInterop` and `allowSyntheticDefaultImports`

These options affect compatibility with CommonJS-style modules and default imports.

Example:

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

These options often help when importing older CommonJS packages.

Example:

```ts
import express from "express";
```

In React app code, this is less visible than in Node.js backend code, but it can still appear when using older packages.

The best setting depends on the toolchain and project type. Many modern templates enable compatibility options to reduce import friction.

### `forceConsistentCasingInFileNames`

This option catches import casing mistakes.

```json
{
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true
  }
}
```

Example problem:

```ts
import { Button } from "./components/button";
```

But the file is:

```text
components/Button.tsx
```

This may work on a case-insensitive local file system such as Windows or macOS default settings, but fail in Linux CI or production. This option helps catch the mismatch early.

### `noUnusedLocals` and `noUnusedParameters`

These options report unused variables and parameters.

```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

Example:

```ts
function calculateTotal(price: number, discount: number) {
  const tax = 0.1;

  return price - discount;
}
```

`tax` is unused.

These options keep code clean, but some teams prefer ESLint to handle unused code. Avoid duplicate or conflicting rules between TypeScript and ESLint.

### `noFallthroughCasesInSwitch`

This option catches accidental fallthrough in `switch` statements.

```json
{
  "compilerOptions": {
    "noFallthroughCasesInSwitch": true
  }
}
```

Bad:

```ts
switch (status) {
  case "loading":
    showSpinner();
  case "success":
    showData();
    break;
}
```

Without `break`, code falls through from `"loading"` to `"success"`.

This is useful in reducers, state machines, and UI logic.

### Recommended React app config example

A practical React/Vite application config may look like this:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],

    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,

    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },

    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

This is a solid starting point, but not a universal answer. Frameworks and templates may recommend slightly different settings.

### Separate app and Node/tooling configs

React projects often contain both browser code and Node-based tooling code.

Example files:

```text
src/main.tsx
src/App.tsx
vite.config.ts
eslint.config.js
```

Browser code needs `DOM` types. Vite config runs in Node and may need Node-specific types and module resolution.

A project may use separate configs:

```text
tsconfig.json
tsconfig.app.json
tsconfig.node.json
```

Example root config:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Example app config:

```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

Example Node/tooling config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

This avoids mixing browser and Node assumptions in one config.

### Project references

Project references help TypeScript understand multiple related projects.

Example:

```json
{
  "files": [],
  "references": [
    { "path": "./packages/ui" },
    { "path": "./packages/app" }
  ]
}
```

They are common in monorepos, libraries, and large applications.

Benefits:

- Faster incremental builds.
- Clear project boundaries.
- Better editor performance in large workspaces.
- Separate configs for app, library, tests, and tooling.

Most small React apps do not need project references beyond what a template provides.

### TypeScript and bundlers

In many React projects, TypeScript is not the tool that produces the final JavaScript bundle. Instead:

- TypeScript checks types.
- The bundler transforms and bundles files.
- The bundler handles JSX, CSS imports, assets, environment variables, and code splitting.

Example scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build"
  }
}
```

This ensures the production build fails if type checking fails.

### Common module setting combinations

Common combinations:

| Project type | Common settings |
|---|---|
| React app with Vite | `module: "ESNext"`, `moduleResolution: "bundler"`, `noEmit: true` |
| Modern Node app | `module: "NodeNext"`, `moduleResolution: "NodeNext"` |
| Older Node/CommonJS app | `module: "CommonJS"`, `moduleResolution: "node"` |
| Library package | Depends on emitted format, package exports, and build tool |
| Monorepo | Shared base config plus project-specific configs |

Do not copy module settings blindly. The correct settings depend on where the code runs and what tool performs the final build.

### `moduleResolution: "bundler"` in React apps

`moduleResolution: "bundler"` is designed for projects where a bundler resolves modules. It supports modern package resolution behavior used by bundlers and avoids enforcing some Node runtime restrictions that do not apply to bundled browser code.

It is commonly appropriate when:

- The code is bundled before running.
- You use Vite, Webpack, Rollup, esbuild, or similar tools.
- You use modern package `exports`.
- You write extensionless imports that the bundler supports.
- TypeScript is used for checking, not direct runtime execution.

It may be inappropriate when:

- The TypeScript output runs directly in Node.
- You are building a Node library that must match Node's ESM behavior.
- You rely on Node-specific module rules.
- Your runtime is not a bundler.

### `module: "NodeNext"` and `moduleResolution: "NodeNext"`

For code that runs directly in Node.js using modern module rules, `NodeNext` is often appropriate.

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

This tells TypeScript to follow Node's ESM/CommonJS behavior, including package `type`, file extensions, and package exports.

This is more common for:

- Node backend code.
- CLI tools.
- Vite config or build tooling code.
- Server-side scripts.
- Packages intended to run directly in Node.

For React browser app code bundled by Vite, `bundler` mode is often simpler.

### Path aliases and runtime compatibility

TypeScript path aliases are not enough by themselves.

Example TypeScript config:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

This makes TypeScript understand:

```ts
import { Button } from "@/components/Button";
```

But Vite also needs:

```ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src")
  }
}
```

Testing tools may also need alias configuration. For example, Vitest, Jest, Storybook, or ESLint may need equivalent settings.

Common problem:

```text
Editor has no error, but build or tests fail because aliases are configured only in tsconfig.
```

### Environment variables and Vite types

Vite exposes environment variables through `import.meta.env`.

Example:

```ts
const apiUrl = import.meta.env.VITE_API_URL;
```

To type this correctly, include Vite client types.

In a `vite-env.d.ts` file:

```ts
/// <reference types="vite/client" />
```

Or in `tsconfig`:

```json
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

For custom environment variables, define types:

```ts
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Only variables with the expected public prefix should be exposed to browser code. Do not put secrets in frontend environment variables.

### `tsc --noEmit` in CI

A common CI step:

```bash
npm run typecheck
```

Script:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

This catches type errors even if the dev server is permissive or transpiles without full type checking.

Good CI flow:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

TypeScript should be part of the quality gate, not only an editor feature.

### Common mistakes

Common `tsconfig` mistakes include:

- Turning off `strict` to avoid fixing real type issues.
- Using `any` instead of modeling data correctly.
- Missing `DOM` in `lib` for React browser apps.
- Using Node module settings for browser code without understanding the trade-off.
- Using `moduleResolution: "bundler"` for code that runs directly in Node.
- Adding path aliases to `tsconfig` but not to Vite, Jest, Storybook, or other tools.
- Setting `types` and accidentally excluding needed global types.
- Assuming TypeScript path aliases change runtime behavior automatically.
- Forgetting `noEmit` when a bundler should own output.
- Using one `tsconfig` for both browser code and Node tooling when their environments differ.
- Ignoring `forceConsistentCasingInFileNames` and later failing in Linux CI.
- Depending on `skipLibCheck` to hide real project type errors.
- Making `useEffect` or component typing worse because props and state types are too loose.
- Not running `tsc --noEmit` in CI.
- Copying config from another framework without adapting it.

### Best practices

Good TypeScript configuration habits for React include:

- Enable `strict` for new projects.
- Use `noEmit: true` when the bundler emits output.
- Use `jsx: "react-jsx"` for modern React projects.
- Include `DOM` and `DOM.Iterable` in browser app `lib`.
- Use `moduleResolution: "bundler"` for modern bundled React app code when appropriate.
- Use Node-specific module settings for Node tooling code.
- Keep browser and Node configs separate when needed.
- Use `forceConsistentCasingInFileNames: true`.
- Use `baseUrl` and `paths` only with matching bundler/test configuration.
- Prefer `unknown` over `any` at external boundaries.
- Consider stricter flags such as `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` for mature projects.
- Use `import type` for type-only imports.
- Keep `tsconfig` small enough to understand.
- Add comments in documentation if the team uses uncommon settings.
- Run type checking in CI.

### Practical decision guide

Use this guide when reviewing or designing a React TypeScript config:

```text
Is this a browser React app?
  -> Include DOM libs and JSX settings.

Is a bundler producing the final output?
  -> Use noEmit and bundler-compatible module settings.

Is this code running directly in Node?
  -> Use Node-specific module and moduleResolution settings.

Is this a new project?
  -> Start with strict mode enabled.

Is this a migration from JavaScript?
  -> Consider allowJs/checkJs temporarily and tighten over time.

Are import aliases used?
  -> Configure both tsconfig paths and the bundler/test tools.

Are type errors hidden by any?
  -> Prefer unknown, explicit types, and validation at boundaries.

Is CI running type checks?
  -> Add tsc --noEmit as a required step.
```

The best TypeScript configuration is not the longest configuration. It is the configuration that accurately matches the runtime, the bundler, the team's strictness goals, and the way the project is deployed.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is `tsconfig.json`?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-beginner-q01 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`tsconfig.json` is the configuration file for a TypeScript project. It tells TypeScript which files belong to the project and how those files should be type-checked or compiled.

It usually contains `compilerOptions`, such as `target`, `module`, `jsx`, `strict`, and `noEmit`, plus file selection settings such as `include`, `exclude`, or `files`.

In a React project, `tsconfig.json` affects JSX support, DOM types, module resolution, editor IntelliSense, type checking, and build behavior.

##### Key Points to Mention

- Defines a TypeScript project.
- Controls compiler and type-checker behavior.
- Uses `compilerOptions` for most settings.
- Uses `include`, `exclude`, or `files` to select files.
- Important for React JSX and DOM typing.
- Often works together with a bundler.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-beginner-q01 -->

#### What does `strict: true` do?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-beginner-q02 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`strict: true` enables TypeScript's strict type-checking mode. It turns on a family of stricter checks that catch more potential runtime errors at compile time.

Strict mode includes checks such as implicit `any` detection, null and undefined checking, safer function type checking, stricter class property initialization, and safer catch variables.

In React projects, strict mode helps catch unsafe props, nullable API data, refs that may be null, missing state handling, and incorrect event handler types.

##### Key Points to Mention

- Enables strict type checking.
- Makes TypeScript more useful.
- Catches null, undefined, and implicit any issues.
- Improves React prop and state safety.
- The exact strict flags can evolve by TypeScript version.
- Recommended for new projects.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-beginner-q02 -->

#### What is the difference between `include` and `exclude`?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-beginner-q03 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`include` tells TypeScript which files or folders should be part of the project. `exclude` removes files from the included set.

For a React app, `include` is often set to `["src"]` so TypeScript checks application source files. `exclude` may list folders such as `dist`, `build`, or `coverage`.

`files` is different because it lists exact files rather than patterns or folders.

##### Key Points to Mention

- `include` selects files.
- `exclude` removes files from selection.
- React apps often include `src`.
- Build output and coverage folders are usually excluded.
- `files` is for exact file lists.
- Incorrect file selection can cause missing or extra type errors.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-beginner-q03 -->

#### Why do React TypeScript apps usually include `DOM` in `lib`?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-beginner-q04 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

React browser applications use browser APIs such as `document`, `window`, `HTMLElement`, `fetch`, and DOM events. The `DOM` library provides TypeScript type definitions for those browser APIs.

Without `DOM` in `lib`, TypeScript may not recognize browser globals and DOM types.

A common React app setting is:

```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

##### Key Points to Mention

- React apps run in browsers.
- Browser APIs need DOM type definitions.
- `DOM` provides types for `window`, `document`, elements, events, and `fetch`.
- `DOM.Iterable` supports iterable DOM collections.
- Node-only projects usually should not include DOM unless needed.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-beginner-q04 -->

#### What does `jsx: "react-jsx"` mean?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-beginner-q05 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`jsx: "react-jsx"` tells TypeScript to use the modern React JSX transform. With this setting, React components can use JSX without importing `React` only for JSX syntax.

Example:

```tsx
function App() {
  return <h1>Hello</h1>;
}
```

This is common in modern React projects. Older React projects may use `jsx: "react"`.

##### Key Points to Mention

- Controls JSX transformation behavior.
- `react-jsx` supports the modern React JSX transform.
- Usually no need to import `React` only for JSX.
- Common in modern React projects.
- Older projects may use different JSX settings.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What is the difference between `module` and `moduleResolution`?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-intermediate-q01 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`module` controls the module system TypeScript assumes or emits, such as `ESNext`, `CommonJS`, or `NodeNext`.

`moduleResolution` controls how TypeScript finds imported files and packages, such as using bundler-style resolution or Node-style resolution.

For a Vite React app, a common combination is `module: "ESNext"` and `moduleResolution: "bundler"`. For code that runs directly in modern Node.js, `module: "NodeNext"` and `moduleResolution: "NodeNext"` may be more appropriate.

##### Key Points to Mention

- `module` is about module format.
- `moduleResolution` is about resolving import paths.
- Bundled browser apps often use bundler resolution.
- Node runtime code should follow Node module rules.
- Do not copy module settings blindly.
- The settings should match the runtime and build tool.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-intermediate-q01 -->

#### Why do many React apps use `noEmit: true`?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-intermediate-q02 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Many React apps use `noEmit: true` because TypeScript is used for type checking while the bundler handles JavaScript output.

For example, in a Vite project, `tsc --noEmit` can check types, and `vite build` can transform and bundle the application.

This separates type checking from bundling. TypeScript verifies correctness, while the bundler handles JSX, assets, CSS imports, code splitting, and optimized production output.

##### Key Points to Mention

- `noEmit` prevents TypeScript from writing output files.
- Bundlers usually handle output in React apps.
- `tsc --noEmit` is useful for type checking.
- Build scripts often run typecheck before bundling.
- Avoid duplicate or conflicting output pipelines.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-intermediate-q02 -->

#### What is `moduleResolution: "bundler"` used for?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-intermediate-q03 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`moduleResolution: "bundler"` tells TypeScript to resolve imports in a way that matches modern bundlers. It is useful for React apps built with tools such as Vite, Webpack, Rollup, or esbuild.

Bundler mode understands modern package resolution patterns and supports extensionless imports commonly used in bundled projects.

It may not be appropriate for TypeScript code that runs directly in Node.js because Node has its own runtime module rules. For Node runtime code, `NodeNext` settings may be more accurate.

##### Key Points to Mention

- Designed for bundler-based projects.
- Common with Vite React apps.
- Matches modern package exports/import behavior better for bundlers.
- Works well with `noEmit`.
- Not always correct for direct Node execution.
- Choose based on actual runtime and build pipeline.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-intermediate-q03 -->

#### How do `baseUrl` and `paths` work?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-intermediate-q04 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

`baseUrl` and `paths` define import aliases for TypeScript.

Example:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

This allows imports such as:

```ts
import { Button } from "@/components/Button";
```

However, TypeScript path aliases only help TypeScript understand the import. The bundler, test runner, and other tools must also be configured to resolve the same alias.

##### Key Points to Mention

- `baseUrl` defines the base for non-relative imports.
- `paths` maps aliases to folders/files.
- Useful for avoiding long relative imports.
- Does not automatically change runtime or bundler behavior.
- Vite, Jest, Vitest, Storybook, or ESLint may need matching config.
- Misconfigured aliases can pass in editor but fail at build time.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-intermediate-q04 -->

#### What is the difference between `any` and `unknown`?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-intermediate-q05 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

`any` disables type checking for a value. TypeScript allows almost any operation on it, which can hide bugs.

`unknown` means the value can be anything, but it must be checked or narrowed before use. This makes it safer for external data, caught errors, and dynamic inputs.

Example:

```ts
function handle(value: unknown) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }

  return "";
}
```

Prefer `unknown` at boundaries and narrow it before use.

##### Key Points to Mention

- `any` turns off type safety.
- `unknown` requires narrowing.
- `unknown` is safer for external inputs.
- Use `any` sparingly.
- Use validation for API responses.
- Strict mode helps prevent accidental unsafe typing.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-intermediate-q05 -->

#### Why might a project have multiple tsconfig files?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-intermediate-q06 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

A project may have multiple `tsconfig` files because different parts of the project run in different environments or need different compiler settings.

For example, React browser code needs DOM types and JSX settings, while `vite.config.ts` runs in Node and may need Node types and Node module resolution.

A project may also separate app code, test code, library code, and tooling code. A shared base config can be reused with `extends`.

##### Key Points to Mention

- Browser and Node code may need different settings.
- App, test, and tooling configs can differ.
- `extends` allows shared base configuration.
- Project references help large workspaces.
- Separate configs avoid mixing incompatible assumptions.
- Common in Vite, monorepos, and libraries.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a strict TypeScript config for a React/Vite app?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-advanced-q01 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For a modern React/Vite app, I would start with strict type checking, modern JavaScript target, DOM libraries, modern React JSX transform, bundler module resolution, and no TypeScript emit.

Example:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

I would also configure path aliases consistently in both `tsconfig` and Vite if the team uses aliases. For mature codebases, I might add stricter options such as `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

##### Key Points to Mention

- Use `strict: true`.
- Include DOM libraries.
- Use `jsx: "react-jsx"`.
- Use bundler-compatible module settings for Vite.
- Use `noEmit` because Vite emits output.
- Use `isolatedModules`.
- Configure aliases in both TypeScript and Vite.
- Consider additional strictness flags based on team readiness.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-advanced-q01 -->

#### What can go wrong if module settings do not match the runtime?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-advanced-q02 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

If module settings do not match the runtime or bundler, TypeScript may accept imports that fail at runtime, or it may report errors for imports that the bundler can actually handle.

For example, `moduleResolution: "bundler"` can be appropriate for Vite browser code, but Node runtime code may need `NodeNext` behavior to correctly model package `type`, file extensions, and ESM/CommonJS rules.

Incorrect module settings can cause confusing errors around default imports, package exports, extensionless imports, CommonJS interoperability, or build/runtime mismatches.

##### Key Points to Mention

- TypeScript checks based on configured assumptions.
- Runtime/bundler must match those assumptions.
- Bundler and Node resolution are different.
- ESM/CommonJS mismatches can break builds.
- Package exports/imports behavior matters.
- Use separate configs for browser and Node code when needed.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-advanced-q02 -->

#### Why is `strictNullChecks` important in React applications?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-advanced-q03 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`strictNullChecks` is important in React because React applications often deal with data that may be temporarily missing: async API data, optional props, refs before mount, context values, route params, and nullable form state.

Without strict null checks, TypeScript may allow code that assumes a value exists when it can actually be `null` or `undefined`, causing runtime crashes.

With strict null checks, developers must handle loading states, missing data, and optional values explicitly.

##### Key Points to Mention

- React data is often loaded asynchronously.
- Refs can be null.
- Optional props may be undefined.
- Route params and API fields may be missing.
- Forces explicit loading and fallback UI.
- Prevents common runtime crashes.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-advanced-q03 -->

#### How do TypeScript path aliases interact with Vite, tests, and runtime?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-advanced-q04 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

TypeScript path aliases only affect TypeScript's understanding of imports. They do not automatically configure the bundler, test runner, or runtime.

If `@/*` maps to `src/*` in `tsconfig`, Vite also needs a matching `resolve.alias` setting. Test tools such as Vitest or Jest may also need alias configuration depending on setup.

Otherwise, the editor may show no TypeScript error, but the build or tests may fail because the runtime cannot resolve the alias.

##### Key Points to Mention

- `paths` helps TypeScript resolve imports.
- Bundlers need matching alias config.
- Test runners may need matching alias config.
- Runtime behavior is not changed by TypeScript alone.
- Keep aliases consistent across tools.
- Avoid too many aliases because they can hide project structure.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-advanced-q04 -->

#### What is the trade-off of enabling `noUncheckedIndexedAccess`?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-advanced-q05 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

`noUncheckedIndexedAccess` makes indexed access safer by adding `undefined` to values accessed through indexes. For example, `users[0]` may be typed as `User | undefined` because the array could be empty.

This catches real bugs where code assumes an array or dictionary has a value. However, it can also make code more verbose because developers must add checks, defaults, or non-null assertions where they know a value exists.

It is useful for mature codebases that value safety, but some teams may delay enabling it during migration.

##### Key Points to Mention

- Makes array and dictionary access safer.
- Adds `undefined` to indexed access results.
- Catches out-of-range and missing-key bugs.
- Can increase type-checking noise.
- Requires guards, defaults, or assertions.
- Good stricter option for mature projects.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-advanced-q05 -->

#### What is the trade-off of `skipLibCheck`?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-advanced-q06 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

`skipLibCheck` skips type checking declaration files, usually from dependencies. This can make type checking faster and avoid errors caused by third-party type packages.

The trade-off is that TypeScript may not report some problems inside `.d.ts` files. However, it still checks your application source code.

Many React projects enable `skipLibCheck` for performance and practicality, especially when dependency types are noisy. It should not be used to ignore errors in your own code.

##### Key Points to Mention

- Speeds up type checking.
- Skips declaration file checking.
- Helps avoid third-party type noise.
- Still checks application source files.
- Can hide dependency declaration issues.
- Common in practical React projects.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-advanced-q06 -->

#### How would you migrate a JavaScript React project to TypeScript safely?

<!-- question:start:tsconfig-basics-strict-mode-module-settings-advanced-q07 -->
<!-- question-id:tsconfig-basics-strict-mode-module-settings-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

I would migrate incrementally. First, add TypeScript and a `tsconfig` that supports JavaScript files with `allowJs`. Then gradually rename files from `.js` or `.jsx` to `.ts` or `.tsx`. I would type shared models, API responses, props, and state first because those provide the most value.

During migration, `checkJs` can help type-check JavaScript files with JSDoc. Strict mode can be enabled immediately for new files, or introduced gradually depending on project size.

I would avoid using `any` everywhere just to silence errors. For external data, I would use `unknown` and validation. CI should eventually run `tsc --noEmit`.

##### Key Points to Mention

- Migrate incrementally.
- Use `allowJs` temporarily.
- Consider `checkJs` with JSDoc.
- Rename files gradually.
- Type props, state, API models, and shared utilities early.
- Avoid spreading `any`.
- Enable strictness progressively if needed.
- Add type checking to CI.

<!-- question:end:tsconfig-basics-strict-mode-module-settings-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
