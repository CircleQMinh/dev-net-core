---
id: controlled-inputs-and-event-handling
topic: Components, props, state, and rendering behavior
subtopic: Controlled inputs and event handling
category: React
---

## Overview

Controlled inputs and event handling are core React skills because most real interfaces respond to user input: typing in forms, clicking buttons, selecting options, submitting data, dismissing dialogs, and changing filters. React handles these interactions declaratively. Instead of manually reading and mutating DOM fields, a component stores important input values in state and renders the UI from that state.

```tsx
function SearchBox() {
  const [query, setQuery] = useState("");

  return (
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
    />
  );
}
```

This is a controlled input: React state is the source of truth, and the input displays whatever value React passes to it. When the user types, `onChange` updates state, React re-renders, and the input receives the new value.

Event handling is the other half of the pattern. React lets you pass functions to JSX event props such as `onClick`, `onChange`, `onSubmit`, `onKeyDown`, and `onBlur`. These handlers run in response to user interactions and often update state, call parent callbacks, prevent default browser behavior, or coordinate UI transitions.

For interviews, this topic matters because controlled inputs reveal whether a developer understands React's one-way data flow, state updates, event handler timing, form submission, accessibility, and common pitfalls such as calling handlers during render or switching an input between controlled and uncontrolled modes.

## Core Concepts

### Event Handlers

An event handler is a function passed to a JSX event prop.

```tsx
function SaveButton() {
  function handleClick() {
    console.log("Saving...");
  }

  return <button onClick={handleClick}>Save</button>;
}
```

The handler is passed, not called. This is correct:

```tsx
<button onClick={handleClick}>Save</button>
```

This is wrong:

```tsx
<button onClick={handleClick()}>Save</button>
```

The second version runs `handleClick` during render instead of waiting for a click.

Inline handlers are fine for short logic:

```tsx
<button onClick={() => setOpen(true)}>Open</button>
```

For more complex logic, use a named handler:

```tsx
function handleSubmitClick() {
  validateForm();
  submitForm();
}
```

### Handler Naming Conventions

By convention:

- Handler functions inside a component often start with `handle`.
- Handler props passed into a component often start with `on`.

```tsx
function Toolbar({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <button onClick={onSave}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

Use domain-specific names when they make intent clearer:

```tsx
<VideoControls
  onPlayMovie={playMovie}
  onUploadImage={uploadImage}
/>
```

This keeps parent-child contracts meaningful. A reusable `Button` might expose `onClick`, but a feature component should often expose `onSelectUser`, `onSubmitOrder`, or `onCloseDialog`.

### Event Objects

React passes an event object to event handlers.

```tsx
function TextInput() {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    console.log(event.target.value);
  }

  return <input onChange={handleChange} />;
}
```

Common event fields and methods:

- `event.target`: the element where the event originated.
- `event.currentTarget`: the element the handler is attached to.
- `event.preventDefault()`: prevents default browser behavior.
- `event.stopPropagation()`: stops the event from bubbling to parent handlers.

In TypeScript, `currentTarget` is often easier to type safely because it refers to the element that owns the handler:

```tsx
function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  setEmail(event.currentTarget.value);
}
```

### Event Propagation

Most React events bubble up the component tree. If a child and parent both listen for clicks, the child handler runs first, then the parent handler.

```tsx
function Toolbar() {
  return (
    <div onClick={() => console.log("toolbar")}>
      <button onClick={() => console.log("button")}>
        Save
      </button>
    </div>
  );
}
```

Clicking the button logs both messages.

To stop the event from reaching the parent:

```tsx
function StopButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      Save
    </button>
  );
}
```

Use `stopPropagation` deliberately. Often, explicit callback chains are easier to trace than relying on bubbling.

### Preventing Default Form Behavior

HTML forms submit by default, which may reload the page. React form handlers usually prevent that default behavior and handle submission in JavaScript.

```tsx
function LoginForm() {
  const [email, setEmail] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitLogin(email);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
      />
      <button type="submit">Log in</button>
    </form>
  );
}
```

Prefer `onSubmit` on the form over `onClick` on the submit button. It supports Enter key submission and works better with browser form semantics.

### Controlled Inputs

A controlled input receives its value from React state and reports changes through an event handler.

```tsx
function NameField() {
  const [name, setName] = useState("");

  return (
    <input
      value={name}
      onChange={(event) => setName(event.currentTarget.value)}
    />
  );
}
```

The value shown in the input is always the `name` state value. Typing triggers `onChange`, the handler updates `name`, and React re-renders with the new value.

Controlled inputs are useful when you need to:

- Validate as the user types.
- Enable or disable buttons based on input.
- Format or normalize values.
- Reset a form from state.
- Submit values from React state.
- Keep multiple fields or components synchronized.

### Controlled Textareas

In React, a controlled `<textarea>` uses `value` and `onChange`, not children text.

```tsx
function CommentBox() {
  const [comment, setComment] = useState("");

  return (
    <textarea
      value={comment}
      onChange={(event) => setComment(event.currentTarget.value)}
    />
  );
}
```

Use `defaultValue` for an uncontrolled initial value:

```tsx
<textarea defaultValue="Initial comment" />
```

Do not mix `value` and `defaultValue` for the same field.

### Controlled Selects

A controlled `<select>` also uses `value` and `onChange`.

```tsx
function RoleSelect() {
  const [role, setRole] = useState("user");

  return (
    <select
      value={role}
      onChange={(event) => setRole(event.currentTarget.value)}
    >
      <option value="admin">Admin</option>
      <option value="user">User</option>
      <option value="guest">Guest</option>
    </select>
  );
}
```

For multiple select, the selected value is usually modeled as an array:

```tsx
function TagSelect() {
  const [tags, setTags] = useState<string[]>([]);

  return (
    <select
      multiple
      value={tags}
      onChange={(event) => {
        const selected = Array.from(
          event.currentTarget.selectedOptions,
          (option) => option.value
        );

        setTags(selected);
      }}
    >
      <option value="react">React</option>
      <option value="typescript">TypeScript</option>
      <option value="testing">Testing</option>
    </select>
  );
}
```

### Checkboxes and Radio Buttons

Text inputs use `value`; checkboxes and radio buttons use `checked`.

```tsx
function NewsletterCheckbox() {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <label>
      <input
        type="checkbox"
        checked={subscribed}
        onChange={(event) => setSubscribed(event.currentTarget.checked)}
      />
      Subscribe
    </label>
  );
}
```

Radio buttons commonly share one state value:

```tsx
function PlanPicker() {
  const [plan, setPlan] = useState("basic");

  return (
    <fieldset>
      <label>
        <input
          type="radio"
          name="plan"
          value="basic"
          checked={plan === "basic"}
          onChange={(event) => setPlan(event.currentTarget.value)}
        />
        Basic
      </label>
      <label>
        <input
          type="radio"
          name="plan"
          value="pro"
          checked={plan === "pro"}
          onChange={(event) => setPlan(event.currentTarget.value)}
        />
        Pro
      </label>
    </fieldset>
  );
}
```

Common checkbox mistake:

```tsx
setSubscribed(event.currentTarget.value);
```

Use `checked`, not `value`, for booleans.

### Controlled vs Uncontrolled Inputs

A controlled input is driven by React state:

```tsx
<input value={name} onChange={(event) => setName(event.currentTarget.value)} />
```

An uncontrolled input lets the DOM manage the current value:

```tsx
<input defaultValue="Ava" />
```

Controlled inputs are best when React needs to know and control the value. Uncontrolled inputs are fine for simple forms, integration with non-React code, or values read only on submit through `FormData` or refs.

Do not switch a field between controlled and uncontrolled during its lifetime:

```tsx
<input value={maybeName} onChange={handleChange} />
```

If `maybeName` starts as `undefined` and later becomes a string, React treats that as switching modes. Use a stable fallback:

```tsx
<input value={maybeName ?? ""} onChange={handleChange} />
```

### Synchronous Updates for Controlled Inputs

A controlled input should synchronously update its backing state in `onChange`.

```tsx
function NameField() {
  const [name, setName] = useState("");

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setName(event.currentTarget.value);
  }

  return <input value={name} onChange={handleChange} />;
}
```

Avoid delaying the state update that controls the input:

```tsx
function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  setTimeout(() => {
    setName(event.currentTarget.value);
  }, 100);
}
```

This can make the input feel broken because React keeps rendering the old value while the user types. If expensive work is needed, update the input value immediately and defer the expensive derived work separately.

### Form State Shape

For small forms, separate state variables are readable:

```tsx
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
```

For larger forms, object state can reduce repetition:

```tsx
type LoginForm = {
  email: string;
  password: string;
};

function LoginForm() {
  const [form, setForm] = useState<LoginForm>({
    email: "",
    password: "",
  });

  function updateField<K extends keyof LoginForm>(key: K, value: LoginForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <form>
      <input
        value={form.email}
        onChange={(event) => updateField("email", event.currentTarget.value)}
      />
      <input
        type="password"
        value={form.password}
        onChange={(event) => updateField("password", event.currentTarget.value)}
      />
    </form>
  );
}
```

When using object state, remember that setting state replaces the object. Copy unchanged fields with spread.

### Declarative Form UI

React encourages describing the form's visual states, then deriving the UI from state.

```tsx
type Status = "idle" | "submitting" | "success" | "error";

function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const isSubmitting = status === "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    try {
      await sendMessage(message);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={message}
        disabled={isSubmitting}
        onChange={(event) => setMessage(event.currentTarget.value)}
      />
      <button disabled={isSubmitting || message.trim() === ""}>
        Send
      </button>
      {status === "error" && <p role="alert">Failed to send.</p>}
    </form>
  );
}
```

The UI follows state. The code does not manually enable, disable, show, or hide DOM nodes imperatively.

### Accessibility and Semantic Events

Use the right HTML element for the interaction.

Good:

```tsx
<button onClick={onClose}>Close</button>
```

Risky:

```tsx
<div onClick={onClose}>Close</div>
```

A real button supports keyboard interaction, focus behavior, disabled state, and semantic meaning. If a clickable element is truly a button, use `<button>`.

For forms:

- Use `<label htmlFor="fieldId">` or wrap the input in a label.
- Use `type="submit"` for submit buttons.
- Use `type="button"` for non-submit buttons inside forms.
- Use `aria-invalid`, `aria-describedby`, and `role="alert"` where appropriate for validation errors.

### Common Mistakes

Common mistakes include:

- Calling a handler during render: `onClick={handleClick()}`.
- Passing `value` without `onChange` for an editable field.
- Using `value` instead of `checked` for checkboxes.
- Switching an input from uncontrolled to controlled by using `undefined` or `null`.
- Using `defaultValue` and expecting later state changes to update the field.
- Handling form submission only on a button click instead of `onSubmit`.
- Forgetting `event.preventDefault()` for JavaScript form submission.
- Overusing `stopPropagation` instead of designing explicit callbacks.
- Using `<div onClick>` when a semantic `<button>` is appropriate.
- Doing expensive validation synchronously on every keystroke without considering responsiveness.

### Best Practices

Use these rules of thumb:

- Use controlled inputs when React needs to validate, submit, reset, or coordinate field values.
- Use `value` for text-like fields and `checked` for checkbox/radio booleans.
- Update controlled input state synchronously in `onChange`.
- Use `onSubmit` on forms and call `preventDefault` for JavaScript submission.
- Pass event handlers as functions, not function calls.
- Name feature-level callback props after user intent.
- Keep side effects in event handlers, not render logic.
- Prefer semantic HTML elements for accessibility.
- Keep form state as simple as possible.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a controlled input in React?

<!-- question:start:controlled-inputs-and-event-handling-beginner-q01 -->
<!-- question-id:controlled-inputs-and-event-handling-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A controlled input is an input whose displayed value is controlled by React state. The component passes a `value` prop to the input and updates that state in an `onChange` handler.

```tsx
function NameInput() {
  const [name, setName] = useState("");

  return (
    <input
      value={name}
      onChange={(event) => setName(event.currentTarget.value)}
    />
  );
}
```

React state is the source of truth. When the user types, the change handler updates state, React re-renders, and the input receives the new value.

##### Key Points to Mention

- React state owns the input value.
- The input receives `value`.
- `onChange` updates the backing state.
- Controlled fields are useful for validation, reset, and submission.
- The state update should happen synchronously for normal typing.

<!-- question:end:controlled-inputs-and-event-handling-beginner-q01 -->

#### How do you handle a button click in React?

<!-- question:start:controlled-inputs-and-event-handling-beginner-q02 -->
<!-- question-id:controlled-inputs-and-event-handling-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Define a function and pass it to the `onClick` prop.

```tsx
function SaveButton() {
  function handleClick() {
    console.log("Save");
  }

  return <button onClick={handleClick}>Save</button>;
}
```

The function must be passed, not called. `onClick={handleClick}` waits for a click. `onClick={handleClick()}` runs during render, which is usually a bug.

##### Key Points to Mention

- Use `onClick` for click handlers.
- Pass the function reference.
- Do not call the handler during render.
- Inline arrow handlers are fine for short logic.
- Use a real `<button>` for button behavior.

<!-- question:end:controlled-inputs-and-event-handling-beginner-q02 -->

#### What is the difference between `value` and `defaultValue`?

<!-- question:start:controlled-inputs-and-event-handling-beginner-q03 -->
<!-- question-id:controlled-inputs-and-event-handling-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`value` makes an input controlled by React. The value shown in the DOM comes from React state, and an `onChange` handler should update that state.

```tsx
<input value={name} onChange={(event) => setName(event.currentTarget.value)} />
```

`defaultValue` sets the initial value for an uncontrolled input. After that, the DOM manages the current value.

```tsx
<input defaultValue="Ava" />
```

Use `value` when React needs to control the field. Use `defaultValue` when you only need an initial value and do not need React to track every change.

##### Key Points to Mention

- `value` is for controlled inputs.
- `defaultValue` is for uncontrolled initial values.
- Controlled inputs need `onChange` unless read-only.
- `defaultValue` does not update the field after initial render.
- Do not mix controlled and uncontrolled modes accidentally.

<!-- question:end:controlled-inputs-and-event-handling-beginner-q03 -->

#### How do you control a checkbox in React?

<!-- question:start:controlled-inputs-and-event-handling-beginner-q04 -->
<!-- question-id:controlled-inputs-and-event-handling-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Use `checked` and read `event.currentTarget.checked` in the change handler.

```tsx
function TermsCheckbox() {
  const [accepted, setAccepted] = useState(false);

  return (
    <input
      type="checkbox"
      checked={accepted}
      onChange={(event) => setAccepted(event.currentTarget.checked)}
    />
  );
}
```

Checkboxes represent a boolean selected state. Text inputs use `value`, but checkboxes and radio buttons use `checked`.

##### Key Points to Mention

- Use `checked` for checkboxes.
- Read `event.currentTarget.checked`.
- The state value is usually boolean.
- `value` is not the checked state.
- Use `defaultChecked` for uncontrolled initial checkbox state.

<!-- question:end:controlled-inputs-and-event-handling-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why should form submission usually be handled with `onSubmit`?

<!-- question:start:controlled-inputs-and-event-handling-intermediate-q01 -->
<!-- question-id:controlled-inputs-and-event-handling-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`onSubmit` belongs on the `<form>` and handles all normal submission paths, including clicking a submit button and pressing Enter in a field. It preserves browser form semantics and accessibility better than only handling `onClick` on a button.

```tsx
function LoginForm() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login();
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" />
      <button type="submit">Log in</button>
    </form>
  );
}
```

When handling submission in JavaScript, call `event.preventDefault()` to prevent the browser's default page navigation or reload.

##### Key Points to Mention

- `onSubmit` handles Enter key and button submission.
- It belongs on the form.
- Call `preventDefault` for client-side handling.
- Use `type="submit"` for submit buttons.
- Use `type="button"` for non-submit form buttons.

<!-- question:end:controlled-inputs-and-event-handling-intermediate-q01 -->

#### What causes the uncontrolled-to-controlled input warning?

<!-- question:start:controlled-inputs-and-event-handling-intermediate-q02 -->
<!-- question-id:controlled-inputs-and-event-handling-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

This warning happens when an input starts uncontrolled and later becomes controlled, or the reverse. A common cause is passing `value={undefined}` on the first render and later passing a string.

```tsx
<input value={maybeName} onChange={handleChange} />
```

If `maybeName` can be `undefined`, use a fallback:

```tsx
<input value={maybeName ?? ""} onChange={handleChange} />
```

For checkboxes, use a boolean fallback:

```tsx
<input checked={Boolean(enabled)} onChange={handleChange} />
```

An input should stay controlled or uncontrolled for its lifetime.

##### Key Points to Mention

- Controlled text inputs need a string value.
- Controlled checkboxes need a boolean checked value.
- `undefined` or `null` can accidentally make a field uncontrolled.
- Use fallback values like `""` or `false`.
- Do not switch modes during the input's lifetime.

<!-- question:end:controlled-inputs-and-event-handling-intermediate-q02 -->

#### How do event propagation and `stopPropagation` work?

<!-- question:start:controlled-inputs-and-event-handling-intermediate-q03 -->
<!-- question-id:controlled-inputs-and-event-handling-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Most React events bubble from the target element up through parent elements. If a button inside a toolbar is clicked and both have `onClick` handlers, the button handler runs first and then the toolbar handler.

`event.stopPropagation()` prevents the event from bubbling further.

```tsx
<button
  onClick={(event) => {
    event.stopPropagation();
    onSave();
  }}
>
  Save
</button>
```

Use it when the child interaction should not count as a parent interaction, such as clicking a button inside a clickable card. Do not use it as a default escape hatch for unclear event design.

##### Key Points to Mention

- Events usually bubble from child to parent.
- Child handlers run before parent bubble handlers.
- `stopPropagation` stops bubbling.
- It is useful for nested interactive regions.
- Explicit callback chains can be easier to trace.

<!-- question:end:controlled-inputs-and-event-handling-intermediate-q03 -->

#### How should controlled inputs handle expensive validation?

<!-- question:start:controlled-inputs-and-event-handling-intermediate-q04 -->
<!-- question-id:controlled-inputs-and-event-handling-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

The input's backing state should still update synchronously so typing stays responsive. Expensive validation, filtering, formatting, or API work should be separated from the immediate input update.

```tsx
function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  setQuery(event.currentTarget.value);
}
```

Then perform expensive work through derived memoized calculations, debounced effects, transitions, or submit-time validation depending on the use case. Do not delay the state update that controls the field, because React will keep rendering the old value and the input can feel broken.

##### Key Points to Mention

- Update the controlled value immediately.
- Keep typing responsive.
- Move expensive work away from the basic `onChange` state update.
- Debounce server calls when appropriate.
- Validate on blur, submit, or derived state depending on requirements.

<!-- question:end:controlled-inputs-and-event-handling-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a reusable input component?

<!-- question:start:controlled-inputs-and-event-handling-advanced-q01 -->
<!-- question-id:controlled-inputs-and-event-handling-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A reusable input component should make ownership clear. For a controlled component, accept `value` and `onChange`, and let the parent own the state. It should also support labels, errors, accessibility attributes, and pass through appropriate native input props.

```tsx
type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

function TextField({ id, label, value, error, onChange }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}
```

The component should not hide important state internally unless it is intentionally uncontrolled. If supporting both modes, document the contract carefully.

##### Key Points to Mention

- Controlled reusable inputs accept `value` and `onChange`.
- Include label and error accessibility.
- Normalize event details if the API should expose values.
- Avoid hidden internal state unless intentionally uncontrolled.
- Be careful when supporting both controlled and uncontrolled modes.

<!-- question:end:controlled-inputs-and-event-handling-advanced-q01 -->

#### How do event handler props help separate presentation from behavior?

<!-- question:start:controlled-inputs-and-event-handling-advanced-q02 -->
<!-- question-id:controlled-inputs-and-event-handling-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Event handler props let a child component describe an interaction without owning the business behavior. A design-system `Button` might only render styling and call `onClick`; a feature parent decides whether that click saves, cancels, uploads, or opens a modal.

```tsx
function Button({ onClick, children }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}
```

For feature components, domain-specific callback names are often better:

```tsx
<OrderSummary onSubmitOrder={submitOrder} onCancelOrder={cancelOrder} />
```

This makes the contract clearer and lets the child change the physical event that triggers the action later.

##### Key Points to Mention

- Children can expose interaction points.
- Parents provide business behavior.
- Reusable UI stays presentation-focused.
- Domain callback names communicate intent.
- This supports one-way data flow.

<!-- question:end:controlled-inputs-and-event-handling-advanced-q02 -->

#### How do you handle forms with many fields without making state messy?

<!-- question:start:controlled-inputs-and-event-handling-advanced-q03 -->
<!-- question-id:controlled-inputs-and-event-handling-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Choose a state shape that matches how fields update. A few unrelated fields can use separate `useState` calls. A larger form may use an object state, a reducer, or a form library if validation and dynamic fields become complex.

```tsx
type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
};

const [form, setForm] = useState<ProfileForm>({
  firstName: "",
  lastName: "",
  email: "",
});

function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
  setForm((current) => ({ ...current, [key]: value }));
}
```

Avoid duplicating derived values in state, avoid contradictory status booleans, and keep validation results tied to the relevant fields.

##### Key Points to Mention

- Match state shape to update patterns.
- Separate state is fine for small forms.
- Object state or reducers can help larger forms.
- Copy unchanged fields when updating object state.
- Avoid duplicated and contradictory form state.

<!-- question:end:controlled-inputs-and-event-handling-advanced-q03 -->

#### When would you choose uncontrolled inputs instead of controlled inputs?

<!-- question:start:controlled-inputs-and-event-handling-advanced-q04 -->
<!-- question-id:controlled-inputs-and-event-handling-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Uncontrolled inputs can be useful when React does not need to track every keystroke. Examples include simple forms read on submit, file inputs, integration with non-React libraries, or fields where the DOM can be the source of truth.

```tsx
function SignupForm() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    submitEmail(String(formData.get("email") ?? ""));
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" defaultValue="" />
      <button type="submit">Sign up</button>
    </form>
  );
}
```

Use controlled inputs when the UI needs live validation, conditional rendering, reset behavior, formatting, or synchronization with other state.

##### Key Points to Mention

- Uncontrolled inputs let the DOM own current value.
- They are useful for simple submit-time reads.
- `defaultValue` and `defaultChecked` set initial values.
- File inputs are commonly uncontrolled.
- Controlled inputs are better for live coordination and validation.

<!-- question:end:controlled-inputs-and-event-handling-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
