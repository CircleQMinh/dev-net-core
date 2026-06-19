---
id: functional-components-and-jsx-composition
topic: Components, props, state, and rendering behavior
subtopic: Functional components and JSX composition
category: React
---

## Overview

Functional components and JSX composition are the foundation of modern React applications. A functional component is a JavaScript or TypeScript function that returns React elements, usually written with JSX. JSX is a syntax extension that lets developers describe UI with HTML-like markup inside JavaScript.

```tsx
function WelcomeCard({ name }: { name: string }) {
  return (
    <section className="card">
      <h2>Hello, {name}</h2>
      <p>Welcome back.</p>
    </section>
  );
}
```

Composition means building larger interfaces by combining smaller components. Instead of creating one large component that knows everything, React encourages breaking UI into focused pieces and nesting them together.

```tsx
function Dashboard() {
  return (
    <PageLayout>
      <Header />
      <Sidebar />
      <MainContent />
    </PageLayout>
  );
}
```

This topic matters in interviews because it tests whether a candidate understands React's mental model: UI is a tree of components, components should be pure during rendering, JSX is JavaScript under the hood, and reusable interfaces are built through composition rather than inheritance or direct DOM manipulation.

Strong React developers should be able to explain component naming rules, JSX syntax rules, fragments, children, conditional rendering, list rendering, keys, component extraction, render purity, and when composition is better than configuration-heavy component APIs.

## Core Concepts

### Functional Components

A functional component is a function that returns React elements.

```tsx
function ProfileAvatar() {
  return (
    <img
      src="/images/avatar.png"
      alt="User avatar"
    />
  );
}
```

Components can be reused and nested:

```tsx
function UserProfile() {
  return (
    <article>
      <ProfileAvatar />
      <h2>Ava Nguyen</h2>
    </article>
  );
}
```

React component names must start with a capital letter. Lowercase JSX tags are treated as built-in HTML elements.

```tsx
function button() {
  return <button>Save</button>;
}

function App() {
  return <button />; // HTML button, not the function above.
}
```

Correct:

```tsx
function Button() {
  return <button>Save</button>;
}

function App() {
  return <Button />;
}
```

### JSX

JSX lets developers write markup-like syntax inside JavaScript.

```tsx
function ProductTitle({ name }: { name: string }) {
  return <h1>{name}</h1>;
}
```

JSX is not a string and not HTML. It is syntax that tools transform into JavaScript calls that describe React elements.

Important JSX rules:

- A component must return one parent element.
- Use `className` instead of `class`.
- Use `htmlFor` instead of `for`.
- Close all tags, including self-closing tags.
- Use camelCase for many DOM attributes and event handlers.
- Use curly braces for JavaScript expressions.

Example:

```tsx
function SearchInput({ id }: { id: string }) {
  return (
    <label htmlFor={id}>
      Search
      <input id={id} className="search-input" />
    </label>
  );
}
```

### Returning One Parent Element

JSX expressions must return a single parent element. This is invalid:

```tsx
function UserHeader() {
  return (
    <h1>Ava</h1>
    <p>Frontend Engineer</p>
  );
}
```

Wrap the elements in a parent:

```tsx
function UserHeader() {
  return (
    <header>
      <h1>Ava</h1>
      <p>Frontend Engineer</p>
    </header>
  );
}
```

Or use a fragment when no extra DOM element is needed:

```tsx
function UserHeader() {
  return (
    <>
      <h1>Ava</h1>
      <p>Frontend Engineer</p>
    </>
  );
}
```

Fragments are useful when layout or semantics would be harmed by an unnecessary wrapper element.

### JavaScript Expressions in JSX

Curly braces let you embed JavaScript expressions in JSX.

```tsx
function MessageCount({ count }: { count: number }) {
  return <p>You have {count} unread messages.</p>;
}
```

You can use expressions, not statements:

```tsx
function Price({ value }: { value: number }) {
  return <span>${value.toFixed(2)}</span>;
}
```

Invalid:

```tsx
function Status({ isOnline }: { isOnline: boolean }) {
  return <p>{if (isOnline) "Online"}</p>;
}
```

Use a ternary or compute before returning:

```tsx
function Status({ isOnline }: { isOnline: boolean }) {
  const label = isOnline ? "Online" : "Offline";
  return <p>{label}</p>;
}
```

Objects cannot be rendered directly as children:

```tsx
const user = { name: "Ava" };

return <p>{user}</p>; // Error.
```

Render a property or transform it:

```tsx
return <p>{user.name}</p>;
```

### JSX Attributes and Props

JSX attributes become props passed to components or DOM attributes for built-in elements.

```tsx
function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}

function Toolbar() {
  return <Button label="Save" />;
}
```

For dynamic values, use curly braces:

```tsx
const isDisabled = formStatus === "submitting";

return <button disabled={isDisabled}>Submit</button>;
```

Boolean props can be passed with shorthand:

```tsx
<button disabled>Submit</button>
```

This is equivalent to:

```tsx
<button disabled={true}>Submit</button>
```

### Component Composition

Composition means using components inside other components.

```tsx
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Dashboard() {
  return (
    <Card title="Activity">
      <p>No recent activity.</p>
    </Card>
  );
}
```

This pattern keeps the `Card` responsible for structure and styling while allowing the caller to provide content.

Composition is useful for:

- Layout components.
- Reusable form controls.
- Dialogs and modals.
- Cards and panels.
- Page shells.
- Feature-specific component trees.

### The `children` Prop

`children` is a special prop containing whatever is placed between a component's opening and closing tags.

```tsx
function Alert({ children }: { children: React.ReactNode }) {
  return <div role="alert">{children}</div>;
}

function SaveError() {
  return (
    <Alert>
      <strong>Save failed.</strong> Please try again.
    </Alert>
  );
}
```

`children` supports flexible composition because the parent does not need to predict every possible piece of content.

Do not overuse `children` when named props communicate intent better:

```tsx
function UserCard({
  avatar,
  title,
  actions,
}: {
  avatar: React.ReactNode;
  title: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <article>
      <div>{avatar}</div>
      <h2>{title}</h2>
      <footer>{actions}</footer>
    </article>
  );
}
```

This is still composition, but with named slots.

### Conditional Rendering

Components can return different JSX based on data.

```tsx
function LoginButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) {
    return <button>Log out</button>;
  }

  return <button>Log in</button>;
}
```

Ternary expressions are useful for small conditions:

```tsx
function StatusBadge({ online }: { online: boolean }) {
  return <span>{online ? "Online" : "Offline"}</span>;
}
```

Logical `&&` is useful for optional rendering:

```tsx
function ErrorMessage({ message }: { message?: string }) {
  return (
    <>
      {message && <p role="alert">{message}</p>}
    </>
  );
}
```

Be careful with numeric values:

```tsx
{count && <Badge count={count} />}
```

If `count` is `0`, React may render `0` instead of rendering nothing. Prefer an explicit condition:

```tsx
{count > 0 && <Badge count={count} />}
```

### Rendering Lists

Use array methods such as `map` to render lists.

```tsx
type User = {
  id: string;
  name: string;
};

function UserList({ users }: { users: User[] }) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

Every item in a list needs a stable `key`. The key helps React match items between renders.

Good key:

```tsx
<li key={user.id}>{user.name}</li>
```

Risky key:

```tsx
{users.map((user, index) => (
  <li key={index}>{user.name}</li>
))}
```

Index keys are risky when items can be inserted, removed, reordered, filtered, or sorted. They can cause incorrect state preservation and confusing UI bugs.

### Component Extraction

Extract a component when a piece of UI has a clear responsibility, is repeated, or makes a parent component hard to read.

Before:

```tsx
function ProductList({ products }: { products: Product[] }) {
  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          <h3>{product.name}</h3>
          <p>${product.price.toFixed(2)}</p>
          <button>Add to cart</button>
        </li>
      ))}
    </ul>
  );
}
```

After:

```tsx
function ProductCard({ product }: { product: Product }) {
  return (
    <li>
      <h3>{product.name}</h3>
      <p>${product.price.toFixed(2)}</p>
      <button>Add to cart</button>
    </li>
  );
}

function ProductList({ products }: { products: Product[] }) {
  return (
    <ul>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}
```

Do not extract components mechanically. Too many tiny components can make the code harder to follow. Extract around meaningful responsibilities.

### Purity During Rendering

React components should be pure during rendering: given the same inputs, they should return the same JSX and should not mutate values that existed before rendering.

Bad:

```tsx
let nextId = 0;

function Item() {
  nextId += 1;
  return <li>Item {nextId}</li>;
}
```

This changes external state during render. It can break when React re-renders, retries, or runs extra development checks.

Better:

```tsx
function Item({ id }: { id: number }) {
  return <li>Item {id}</li>;
}
```

Side effects belong in event handlers or effects, not in render logic.

```tsx
function SaveButton() {
  function handleClick() {
    analytics.track("save_clicked");
  }

  return <button onClick={handleClick}>Save</button>;
}
```

### Component Definitions Should Stay at Top Level

Avoid defining components inside other components.

```tsx
function Parent() {
  function Child() {
    return <p>Child</p>;
  }

  return <Child />;
}
```

This creates a new component function every render and can cause state to reset unexpectedly.

Prefer top-level definitions:

```tsx
function Child() {
  return <p>Child</p>;
}

function Parent() {
  return <Child />;
}
```

If the child needs data, pass it with props:

```tsx
function Child({ label }: { label: string }) {
  return <p>{label}</p>;
}

function Parent() {
  return <Child label="Child" />;
}
```

### Composition vs Inheritance

React code usually favors composition over inheritance. Instead of creating a base class or a highly abstract component hierarchy, you combine components and pass data, event handlers, or JSX.

```tsx
function Dialog({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <div>{children}</div>
      <footer>{actions}</footer>
    </section>
  );
}
```

Usage:

```tsx
<Dialog
  title="Delete project"
  actions={<button>Confirm</button>}
>
  <p>This action cannot be undone.</p>
</Dialog>
```

Composition keeps behavior explicit at the usage site and avoids deep inheritance chains.

### Common Mistakes

Common mistakes include:

- Naming components with lowercase names.
- Returning multiple sibling JSX elements without a wrapper or fragment.
- Forgetting to close tags.
- Using `class` instead of `className`.
- Using statements instead of expressions inside JSX braces.
- Rendering objects directly.
- Defining components inside components.
- Mutating external values during render.
- Using array index keys for reorderable lists.
- Extracting components before there is a clear responsibility.
- Creating component APIs with too many boolean flags instead of composing smaller pieces.

### Best Practices

Use these rules of thumb:

- Keep components pure during rendering.
- Name components with PascalCase.
- Use JSX to describe UI from data.
- Break components around clear responsibilities.
- Prefer composition through `children`, named slots, and smaller components.
- Use fragments to avoid unnecessary DOM wrappers.
- Use stable keys for list items.
- Keep side effects in event handlers or effects.
- Let parent components coordinate structure while child components handle focused display logic.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a functional component in React?

<!-- question:start:functional-components-and-jsx-composition-beginner-q01 -->
<!-- question-id:functional-components-and-jsx-composition-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A functional component is a JavaScript or TypeScript function that returns React elements, usually written with JSX. It describes what the UI should look like for a given set of inputs such as props, state, or context.

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}
```

Functional components are the standard way to write React UI today. They can be composed together, accept props, use Hooks when needed, and should remain pure during rendering.

##### Key Points to Mention

- A component is a function that returns React elements.
- Component names must start with a capital letter.
- Components are reusable UI building blocks.
- Components can receive props.
- Rendering should be pure and based on inputs.

<!-- question:end:functional-components-and-jsx-composition-beginner-q01 -->

#### What is JSX?

<!-- question:start:functional-components-and-jsx-composition-beginner-q02 -->
<!-- question-id:functional-components-and-jsx-composition-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

JSX is a syntax extension for JavaScript that lets developers write HTML-like markup inside JavaScript. React projects commonly use JSX because it makes component output easy to read and keeps rendering logic close to the data that drives it.

JSX is not exactly HTML. It has rules such as using `className` instead of `class`, closing all tags, returning one parent element, and using curly braces for JavaScript expressions.

```tsx
function Button({ disabled }: { disabled: boolean }) {
  return <button className="primary" disabled={disabled}>Save</button>;
}
```

##### Key Points to Mention

- JSX lets markup and JavaScript live together.
- JSX is transformed into JavaScript.
- JSX uses `className`, `htmlFor`, and camelCase attributes.
- Curly braces embed JavaScript expressions.
- A component must return one parent JSX value.

<!-- question:end:functional-components-and-jsx-composition-beginner-q02 -->

#### Why must React component names start with a capital letter?

<!-- question:start:functional-components-and-jsx-composition-beginner-q03 -->
<!-- question-id:functional-components-and-jsx-composition-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

React uses JSX tag casing to distinguish built-in DOM elements from custom components. Lowercase tags like `<div>` and `<button>` are treated as HTML elements. Capitalized tags like `<UserCard />` are treated as React components.

```tsx
function UserCard() {
  return <article>Ava</article>;
}

function App() {
  return <UserCard />;
}
```

If a component is named with a lowercase first letter and used as `<userCard />`, React treats it like a custom HTML tag rather than calling the component function.

##### Key Points to Mention

- Lowercase JSX tags mean DOM elements.
- Capitalized JSX tags mean React components.
- Component functions should use PascalCase.
- This rule helps JSX distinguish markup from custom UI.
- Incorrect casing can cause the component not to render as expected.

<!-- question:end:functional-components-and-jsx-composition-beginner-q03 -->

#### What is component composition?

<!-- question:start:functional-components-and-jsx-composition-beginner-q04 -->
<!-- question-id:functional-components-and-jsx-composition-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Component composition means building larger UI by combining smaller components. A parent component can render child components and pass them data with props or content through `children`.

```tsx
function Page() {
  return (
    <Layout>
      <Header />
      <Article />
      <Footer />
    </Layout>
  );
}
```

Composition makes UI easier to reuse, test, and reason about. It is the main way React encourages developers to share structure and behavior, rather than relying on inheritance.

##### Key Points to Mention

- Composition means nesting and combining components.
- Parent components can render child components.
- Props and `children` connect composed components.
- Composition supports reuse and separation of responsibility.
- React generally favors composition over inheritance.

<!-- question:end:functional-components-and-jsx-composition-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What are the most important JSX rules to remember?

<!-- question:start:functional-components-and-jsx-composition-intermediate-q01 -->
<!-- question-id:functional-components-and-jsx-composition-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Important JSX rules include returning a single parent element, closing all tags, using `className` instead of `class`, using `htmlFor` instead of `for`, using camelCase DOM attributes and event handlers, and using curly braces for JavaScript expressions.

JSX expressions must be expressions, not statements. For example, a ternary expression can be used inside JSX, but an `if` statement cannot be placed directly inside braces.

```tsx
function Status({ active }: { active: boolean }) {
  return <span>{active ? "Active" : "Inactive"}</span>;
}
```

These rules exist because JSX becomes JavaScript. Understanding that helps developers debug JSX syntax errors and avoid treating JSX like plain HTML.

##### Key Points to Mention

- JSX must return one parent value.
- Tags must be closed.
- Use `className` and `htmlFor`.
- Curly braces accept expressions, not statements.
- JSX is transformed into JavaScript.

<!-- question:end:functional-components-and-jsx-composition-intermediate-q01 -->

#### How do fragments help with composition?

<!-- question:start:functional-components-and-jsx-composition-intermediate-q02 -->
<!-- question-id:functional-components-and-jsx-composition-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Fragments let a component return multiple sibling elements without adding an extra DOM node. This is useful when a wrapper would break styling, layout, table structure, accessibility, or semantic HTML.

```tsx
function NameFields() {
  return (
    <>
      <label htmlFor="firstName">First name</label>
      <input id="firstName" />
      <label htmlFor="lastName">Last name</label>
      <input id="lastName" />
    </>
  );
}
```

Fragments support composition by letting components group JSX logically without forcing unnecessary DOM structure. If a fragment is in a list, the explicit `<Fragment key={...}>` form may be needed.

##### Key Points to Mention

- Fragments avoid unnecessary wrapper elements.
- The shorthand is `<>...</>`.
- They preserve valid DOM and layout.
- Explicit `Fragment` can accept a key.
- They are useful for grouped JSX in composition.

<!-- question:end:functional-components-and-jsx-composition-intermediate-q02 -->

#### How should you render lists in React?

<!-- question:start:functional-components-and-jsx-composition-intermediate-q03 -->
<!-- question-id:functional-components-and-jsx-composition-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use JavaScript array methods like `map` to transform data into JSX. Each item in the list should have a stable `key` so React can match items between renders.

```tsx
function UserList({ users }: { users: User[] }) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

The key should usually come from the data, such as a database ID. Array index keys are acceptable only for static lists that never reorder, insert, delete, or filter. In dynamic lists, index keys can cause state preservation bugs and incorrect UI behavior.

##### Key Points to Mention

- Use `map` to render arrays.
- Each list item needs a key.
- Keys should be stable and unique among siblings.
- IDs from data are usually better than indexes.
- Index keys are risky for reorderable lists.

<!-- question:end:functional-components-and-jsx-composition-intermediate-q03 -->

#### Why should components be pure during rendering?

<!-- question:start:functional-components-and-jsx-composition-intermediate-q04 -->
<!-- question-id:functional-components-and-jsx-composition-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Components should be pure during rendering because React expects the same inputs to produce the same JSX. A component should not mutate external variables, change the DOM, start timers, send network requests, or perform other side effects while rendering.

Pure rendering lets React safely render, pause, retry, or double-invoke components in development. It also makes components easier to test and optimize.

Side effects should happen in event handlers when caused by user actions, or in effects when synchronizing with external systems.

```tsx
function SaveButton() {
  function handleClick() {
    saveChanges();
  }

  return <button onClick={handleClick}>Save</button>;
}
```

##### Key Points to Mention

- Same inputs should produce same JSX.
- Do not mutate external values during render.
- Do not perform side effects during render.
- Event handlers are appropriate for user-triggered side effects.
- Purity helps React safely schedule and optimize rendering.

<!-- question:end:functional-components-and-jsx-composition-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### When should you extract a new component?

<!-- question:start:functional-components-and-jsx-composition-advanced-q01 -->
<!-- question-id:functional-components-and-jsx-composition-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Extract a component when a piece of UI has a clear responsibility, is repeated, makes a parent component hard to read, needs isolated testing, or represents a meaningful design-system or feature concept. Extraction should improve clarity, not just reduce line count.

For example, a `ProductCard` extracted from a product list is useful because it has a focused purpose and can be reused. But extracting every `<div>` into a component can make the tree harder to follow.

Good extraction also considers data flow. The extracted component should receive the data it needs through props and should not reach into unrelated parent state or global objects just to avoid passing props.

##### Key Points to Mention

- Extract around clear responsibility.
- Repetition is a signal, not the only reason.
- Improve readability and ownership.
- Avoid premature tiny abstractions.
- Keep data flow explicit through props.

<!-- question:end:functional-components-and-jsx-composition-advanced-q01 -->

#### How do `children` and named slots differ as composition patterns?

<!-- question:start:functional-components-and-jsx-composition-advanced-q02 -->
<!-- question-id:functional-components-and-jsx-composition-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`children` is best when a component has one main content area controlled by the caller, such as a card, alert, layout, or modal body.

```tsx
function Card({ children }: { children: React.ReactNode }) {
  return <section className="card">{children}</section>;
}
```

Named slots are useful when a component has multiple composition points, such as `header`, `footer`, `actions`, or `sidebar`.

```tsx
function Dialog({ title, body, actions }: DialogProps) {
  return (
    <section role="dialog">
      <h2>{title}</h2>
      <div>{body}</div>
      <footer>{actions}</footer>
    </section>
  );
}
```

Both are composition. The choice depends on how much structure the component owns and how much flexibility the caller needs.

##### Key Points to Mention

- `children` is good for one main content area.
- Named slots make multiple regions explicit.
- Slots can be typed as `ReactNode`.
- Too many slots may signal an overgeneralized component.
- The pattern should match the component's responsibility.

<!-- question:end:functional-components-and-jsx-composition-advanced-q02 -->

#### Why is defining a component inside another component usually a problem?

<!-- question:start:functional-components-and-jsx-composition-advanced-q03 -->
<!-- question-id:functional-components-and-jsx-composition-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Defining a component inside another component creates a new component function every time the parent renders. React may treat it as a different component type, which can reset child state and cause unnecessary work. It also makes the code harder to test and reuse.

```tsx
function Parent() {
  function Child() {
    return <p>Child</p>;
  }

  return <Child />;
}
```

The better pattern is to define components at the module top level and pass data through props.

```tsx
function Child({ label }: { label: string }) {
  return <p>{label}</p>;
}

function Parent() {
  return <Child label="Child" />;
}
```

##### Key Points to Mention

- A nested definition is recreated on every parent render.
- It can reset state unexpectedly.
- It hurts reuse and testability.
- Top-level definitions are preferred.
- Pass data with props instead of closing over parent locals.

<!-- question:end:functional-components-and-jsx-composition-advanced-q03 -->

#### How would you decide between composition and a highly configurable component?

<!-- question:start:functional-components-and-jsx-composition-advanced-q04 -->
<!-- question-id:functional-components-and-jsx-composition-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a configurable component when the variations are limited, predictable, and part of the component's responsibility. For example, a `Button` may reasonably accept `variant`, `size`, and `disabled`.

Use composition when the caller needs to control structure, content, or behavior in ways that would otherwise require many flags. A modal with `showFooter`, `primaryAction`, `secondaryAction`, `showCloseIcon`, `customHeader`, and many layout flags may be clearer as a composed component with `children`, `actions`, or subcomponents.

The trade-off is API clarity. Too much configuration creates boolean-flag complexity. Too much composition can make every usage verbose. Good React design keeps the common path simple while allowing escape hatches where needed.

##### Key Points to Mention

- Use props for limited predictable variants.
- Use composition for flexible structure.
- Too many boolean flags are a design smell.
- Composition keeps usage explicit.
- Balance convenience, readability, and flexibility.

<!-- question:end:functional-components-and-jsx-composition-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
