---
id: keyboard-accessibility-semantic-html-aria-and-labels-ids
topic: Testing, accessibility, and frontend debugging
subtopic: Keyboard accessibility, semantic HTML, ARIA, and labels/IDs
category: React
---

## Overview

Keyboard accessibility, semantic HTML, ARIA, and labels/IDs are the foundation for building React interfaces that work for keyboard users, screen reader users, voice-control users, switch-device users, and people who rely on browser accessibility features. The goal is not to add accessibility as decoration after the UI is built. The goal is to choose the right HTML elements, connect names and descriptions correctly, preserve keyboard behavior, and use ARIA only where native HTML cannot express the interaction.

This matters because React makes it easy to compose custom components, but custom components can accidentally remove browser behavior that native elements provide for free. A clickable `<div>` does not behave like a `<button>`. An unlabeled input is hard to understand. An icon-only button without an accessible name is ambiguous. A modal that does not manage focus can trap or lose keyboard users.

In interviews, this topic tests whether a candidate understands practical accessibility, not just slogans. A strong candidate can explain why semantic HTML should come first, how keyboard focus should move, how labels and IDs connect controls to text, when ARIA is appropriate, and how to test the result with keyboard navigation and user-centric tests.

In real React applications, these skills show up in forms, dialogs, menus, comboboxes, tabs, validation messages, icon buttons, data grids, route changes, and design-system components.

## Core Concepts

### Accessibility Starts With Semantics

Semantic HTML means using elements according to their meaning and behavior. The browser, accessibility tree, keyboard model, form model, and assistive technologies all benefit from the correct element.

Good:

```tsx
function SaveButton({ onSave }: { onSave: () => void }) {
  return (
    <button type="button" onClick={onSave}>
      Save changes
    </button>
  );
}
```

Bad:

```tsx
function SaveButton({ onSave }: { onSave: () => void }) {
  return (
    <div className="button" onClick={onSave}>
      Save changes
    </div>
  );
}
```

The native `<button>` supports focus, keyboard activation, disabled behavior, accessible role, accessible name, and form behavior. The `<div>` supports none of those unless you rebuild them manually. In interviews, the pragmatic answer is: use the native element unless there is a strong reason not to.

### Native Elements Provide Behavior

Native HTML gives useful behavior by default:

- `<button>` is focusable and activates with keyboard.
- `<a href>` is focusable and works as a link.
- `<input>`, `<select>`, and `<textarea>` participate in forms.
- `<label>` gives form controls an accessible name and larger click target.
- `<form>` supports submit with Enter and browser validation hooks.
- `<fieldset>` and `<legend>` group related controls.
- `<main>`, `<nav>`, `<header>`, `<footer>`, and `<section>` communicate page structure.
- Headings create a navigable document outline.

React components should preserve these behaviors rather than replacing them with generic elements.

### Button vs Link

Use a button for an action. Use a link for navigation.

```tsx
// Action: changes UI state or submits an operation.
<button type="button" onClick={openDialog}>
  Delete account
</button>

// Navigation: goes somewhere.
<a href="/billing/invoices">View invoices</a>
```

Common mistake:

```tsx
<a onClick={save}>Save</a>
```

This looks like a link but behaves like a button. It may not be keyboard-accessible, may confuse assistive technology, and may create broken browser behavior because there is no real destination.

### Keyboard Accessibility

Keyboard accessibility means every meaningful interactive control can be reached, understood, and operated without a mouse.

Core expectations:

- `Tab` and `Shift+Tab` move between interactive controls.
- `Enter` activates links and buttons.
- `Space` activates buttons and toggles checkboxes.
- Arrow keys move within composite widgets such as radio groups, tab lists, menus, listboxes, grids, and sliders.
- `Escape` commonly closes popovers, menus, and dialogs.
- Focus is visible.
- Focus does not disappear when UI changes.
- Focus order follows the visual and logical reading order.

The easiest way to satisfy many of these rules is to use native controls. The harder cases are custom widgets.

### Focus Visibility

Keyboard users need to know where focus is. Do not remove focus outlines without replacing them with an equally visible focus style.

Bad:

```css
button:focus {
  outline: none;
}
```

Better:

```css
button:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
```

Use `:focus-visible` when you want focus styling that appears primarily for keyboard-like navigation while avoiding noisy focus rings for mouse users.

### Tab Order

The default tab order follows DOM order for naturally focusable elements. Keep DOM order aligned with visual order whenever possible.

Avoid positive `tabIndex` values:

```tsx
// Avoid this.
<button tabIndex={3}>Third</button>
<button tabIndex={1}>First</button>
<button tabIndex={2}>Second</button>
```

Positive tab order is hard to maintain and can make focus movement unpredictable. Prefer:

- Natural DOM order.
- `tabIndex={0}` only when a custom element must join the tab order.
- `tabIndex={-1}` when an element should be programmatically focusable but not part of normal tab navigation.

### Custom Controls Are Expensive

If you create a custom control, you inherit responsibilities the browser normally handles:

- Role.
- Accessible name.
- Keyboard behavior.
- Focus visibility.
- Disabled behavior.
- Pointer behavior.
- State attributes such as `aria-expanded`, `aria-selected`, or `aria-checked`.
- Relationship attributes such as `aria-controls`, `aria-labelledby`, or `aria-describedby`.

Example of a custom disclosure button that still uses a native button:

```tsx
function FilterDisclosure() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Filters
      </button>

      {open && (
        <section id={panelId} aria-label="Filters">
          <label>
            Search
            <input name="search" />
          </label>
        </section>
      )}
    </>
  );
}
```

This uses ARIA for state and relationship, but the interactive control is still a native button.

### ARIA Basics

ARIA can add accessibility semantics when native HTML cannot express the component. It can define:

- Roles, such as `dialog`, `tablist`, `tab`, `progressbar`, or `switch`.
- States, such as `aria-expanded`, `aria-selected`, `aria-checked`, `aria-invalid`, or `aria-disabled`.
- Properties, such as `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-controls`, or `aria-live`.

ARIA does not add behavior. If you write:

```tsx
<div role="button">Save</div>
```

you have told assistive technology that the element is a button, but you still have to implement focus, keyboard activation, disabled behavior, and visible focus. Usually this should just be:

```tsx
<button type="button">Save</button>
```

### Use Native HTML Before ARIA

Prefer native elements and attributes first:

```tsx
// Prefer this.
<progress value={75} max={100}>
  75%
</progress>
```

Instead of rebuilding it:

```tsx
// More work and more risk.
<div
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={75}
>
  75%
</div>
```

ARIA is powerful, but it should be used to fill semantic gaps, not to override good HTML.

### Accessible Names

An accessible name is the name assistive technologies expose for an element. It may come from visible text, a `<label>`, `aria-label`, `aria-labelledby`, `alt`, or other naming rules.

Good:

```tsx
<button type="button">Close</button>
```

Good for icon-only buttons:

```tsx
<button type="button" aria-label="Close dialog">
  <CloseIcon aria-hidden="true" />
</button>
```

If visible label text exists, prefer using that visible text as the accessible name. Invisible names can drift from the visible UI during redesigns or translation work.

### `aria-label` vs `aria-labelledby`

Use `aria-label` when there is no visible text to reference:

```tsx
<button type="button" aria-label="Remove item">
  <TrashIcon aria-hidden="true" />
</button>
```

Use `aria-labelledby` when visible text already exists in the DOM:

```tsx
<h2 id="billing-title">Billing address</h2>

<section aria-labelledby="billing-title">
  <AddressForm />
</section>
```

Avoid using both on the same element. If both are present, `aria-labelledby` takes precedence in accessible name calculation.

### Labels and IDs

Form controls need labels. In React, use `htmlFor` instead of `for`.

```tsx
function EmailField() {
  const emailId = useId();

  return (
    <div>
      <label htmlFor={emailId}>Email address</label>
      <input id={emailId} name="email" type="email" autoComplete="email" />
    </div>
  );
}
```

Benefits:

- Screen readers can announce the field label.
- Clicking the label focuses or activates the field.
- Testing Library can find the input with `getByLabelText`.
- The input has a clearer programmatic contract.

Wrapping labels also work:

```tsx
<label>
  Email address
  <input name="email" type="email" />
</label>
```

Explicit IDs are often easier when layout separates label and input.

### `useId`

`useId` generates unique IDs that are useful for accessibility relationships.

```tsx
function PasswordField() {
  const passwordId = useId();
  const hintId = useId();

  return (
    <div>
      <label htmlFor={passwordId}>Password</label>
      <input
        id={passwordId}
        type="password"
        aria-describedby={hintId}
        autoComplete="new-password"
      />
      <p id={hintId}>Use at least 12 characters.</p>
    </div>
  );
}
```

Use `useId` for accessibility attributes such as `id`, `htmlFor`, `aria-describedby`, and `aria-labelledby`.

Do not use `useId` for list keys:

```tsx
// Bad.
items.map((item) => <Row key={useId()} item={item} />);
```

Keys should come from stable data.

### Error Messages and Descriptions

Validation errors should be visible and programmatically connected to the field.

```tsx
function EmailField({ error }: { error?: string }) {
  const emailId = useId();
  const errorId = useId();

  return (
    <div>
      <label htmlFor={emailId}>Email</label>
      <input
        id={emailId}
        name="email"
        type="email"
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

`aria-invalid` communicates invalid state. `aria-describedby` connects the error text to the field. `role="alert"` can announce newly rendered error text, but do not overuse alerts for every small UI change.

### Live Regions

Use live regions when dynamic content changes without moving focus and users need to be informed.

```tsx
<p aria-live="polite">{statusMessage}</p>
```

Use cases:

- Search result counts.
- Save status.
- Background sync state.
- Form-level validation summary.

Avoid noisy live regions for frequent updates such as every keystroke. Prefer `aria-live="polite"` for most status messages and reserve assertive announcements for urgent messages.

### Dialog Accessibility

A modal dialog needs more than `position: fixed`.

Important behavior:

- The dialog has an accessible name.
- Focus moves inside the dialog when it opens.
- `Tab` and `Shift+Tab` stay inside the dialog.
- `Escape` closes the dialog when appropriate.
- Focus returns to the invoking control when the dialog closes.
- Content outside the modal is inert or otherwise unavailable.
- There is a visible close or cancel control.

Example:

```tsx
function DeleteDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  if (!open) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId}>Delete account?</h2>
      <p>This action cannot be undone.</p>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm}>
        Delete account
      </button>
    </div>
  );
}
```

In production, use a well-tested dialog primitive or implement focus trapping, inert background behavior, and focus restoration carefully.

### Composite Widgets

Composite widgets are controls that contain multiple focusable or selectable items, such as tabs, menus, listboxes, trees, and grids.

Common patterns:

- Only one item is in the normal tab sequence.
- Arrow keys move within the widget.
- `Home` and `End` often move to first and last items.
- `Enter` or `Space` activates or selects.
- `aria-selected`, `aria-expanded`, or `aria-activedescendant` may communicate state.
- Focus and selection may be different concepts.

Do not invent keyboard behavior for common components. Follow established patterns so users do not have to relearn the interface.

### React Component API Design

Reusable components should make accessible usage easy.

Good component API:

```tsx
type TextFieldProps = {
  id?: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

function TextField({ id, label, error, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input
        {...inputProps}
        id={inputId}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : inputProps["aria-describedby"]}
      />
      {error && <p id={errorId}>{error}</p>}
    </div>
  );
}
```

The component requires a label, wires IDs correctly, preserves native input props, and still lets callers pass a stable ID when needed.

### Testing Keyboard and Semantics

Use tests that reflect user behavior:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("opens and closes the menu with the keyboard", async () => {
  const user = userEvent.setup();

  render(<AccountMenu />);

  await user.tab();
  expect(screen.getByRole("button", { name: /account/i })).toHaveFocus();

  await user.keyboard("{Enter}");
  expect(screen.getByRole("menu")).toBeVisible();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
```

Manual checks still matter:

- Navigate with only keyboard.
- Check focus order.
- Check visible focus.
- Test forms with labels.
- Try screen reader basics for complex widgets.
- Inspect the accessibility tree in browser devtools.

### Common Mistakes

Common mistakes include:

- Building buttons from `<div>` or `<span>`.
- Removing focus outlines.
- Using positive `tabIndex`.
- Adding ARIA roles that conflict with native elements.
- Adding ARIA without keyboard behavior.
- Using `aria-label` when visible text should be used.
- Leaving icon-only buttons unnamed.
- Failing to connect labels, hints, and errors to inputs.
- Treating `placeholder` as a label.
- Moving focus unpredictably after state changes.
- Creating modal overlays without focus management.

### Best Practices

Best practices include:

- Use semantic HTML first.
- Use ARIA to supplement, not replace, native behavior.
- Give every interactive element an accessible name.
- Keep focus visible.
- Keep DOM order and visual order aligned.
- Prefer `button` for actions and `a href` for navigation.
- Use `<label>` with `htmlFor` or a wrapping label for inputs.
- Use `useId` for component-scoped accessibility IDs.
- Connect helper and error text with `aria-describedby`.
- Follow established ARIA patterns for custom widgets.
- Test with keyboard and semantic queries.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### Why is semantic HTML important for accessibility in React?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q01 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

Semantic HTML gives the browser and assistive technologies meaningful information about the UI. A real `<button>` is announced as a button, can receive keyboard focus, activates with keyboard, supports disabled behavior, and participates correctly in forms. A generic `<div>` does not provide that behavior by default.

In React, it is common to create reusable components, but those components should still render semantic elements internally. Accessibility is easiest when the component starts with the correct native element instead of trying to recreate native behavior with JavaScript and ARIA.

##### Key Points to Mention

- Native elements expose roles and behavior automatically.
- Semantic HTML improves keyboard support.
- It helps screen readers and Testing Library queries.
- It is usually simpler than custom ARIA widgets.
- Use custom elements only when native HTML cannot express the UI.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q01 -->

#### What is the difference between a button and a link?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q02 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A button performs an action, such as submitting a form, opening a dialog, saving data, or toggling UI. A link navigates to another URL or resource. Using the right element preserves browser behavior and accessibility expectations.

If an element changes application state but does not navigate, use `<button>`. If it changes the location or points to another page, use `<a href="...">`. Avoid anchors without `href` for button-like behavior.

##### Key Points to Mention

- Buttons are for actions.
- Links are for navigation.
- Native behavior differs.
- `a` without `href` is not a real link.
- Use `type="button"` when a button should not submit a form.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q02 -->

#### Why do form controls need labels?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q03 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Labels give form controls accessible names. Screen readers can announce the label when the field receives focus, and users can click the label to focus or activate the field. Labels also make tests and automation more user-centric because fields can be found by label text.

In React, an explicit label uses `htmlFor` and an input `id`. A wrapping label can also work. Placeholder text should not replace a label because it disappears as users type and is not a reliable accessible name.

##### Key Points to Mention

- Labels provide accessible names.
- Use `htmlFor` and `id` in React.
- Wrapping labels are also valid.
- Labels increase the clickable area.
- Placeholder is not a replacement for a label.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q03 -->

#### What is `useId` used for?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q04 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

`useId` is a React Hook for generating unique IDs that can be used in accessibility relationships, such as connecting a label to an input or connecting help text to a field with `aria-describedby`.

It should be called at the top level of a component or custom hook. It should not be used to generate keys in lists. List keys should come from stable data, such as database IDs.

##### Key Points to Mention

- Generates unique component IDs.
- Useful for `id`, `htmlFor`, `aria-labelledby`, and `aria-describedby`.
- Helps reusable components avoid ID collisions.
- Must follow Hook rules.
- Do not use it for list keys.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When should you use ARIA in React?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q01 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use ARIA when native HTML cannot express the semantics, state, or relationship needed by the component. For example, `aria-expanded` can communicate whether a disclosure is open, `aria-controls` can connect a button to a panel, `aria-describedby` can connect a field to help text, and `role="dialog"` can identify a custom dialog container.

ARIA should not be used to replace native HTML that already has the right behavior. If a native `<button>` works, use it instead of `<div role="button">`. ARIA adds semantics but does not add keyboard behavior or state management.

##### Key Points to Mention

- Prefer native HTML first.
- ARIA adds roles, states, and relationships.
- ARIA does not add behavior.
- Use ARIA for custom widgets and dynamic states.
- Avoid conflicting with native semantics.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q01 -->

#### How would you make an icon-only button accessible?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q02 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use a native `<button>` and give it an accessible name. If there is no visible text, use `aria-label` with a clear action name. Hide decorative icon content from assistive technology with `aria-hidden="true"` if the icon itself should not be announced.

The accessible name should be specific, such as "Close dialog" or "Remove item", not just "Close" if there are multiple close actions with different meanings.

##### Key Points to Mention

- Use a real button.
- Add `aria-label` when there is no visible label.
- Hide decorative icons with `aria-hidden`.
- Use specific action text.
- Ensure focus and disabled behavior still work.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q02 -->

#### What is wrong with positive `tabIndex` values?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q03 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Positive `tabIndex` values create a custom tab order that can diverge from DOM order and visual order. This makes focus movement difficult to predict and hard to maintain as the UI changes. It can also create a confusing experience for screen reader and keyboard users.

Prefer natural DOM order. Use `tabIndex={0}` only when a custom element must be added to the normal tab order, and use `tabIndex={-1}` for elements that need programmatic focus but should not be reached by normal tabbing.

##### Key Points to Mention

- Positive values override natural tab order.
- They are hard to maintain.
- They can make focus unpredictable.
- DOM order should match visual and reading order.
- Use `0` and `-1` intentionally.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q03 -->

#### How should validation errors be connected to form fields?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q04 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Validation errors should be visible and programmatically associated with the field. The input should have a label. When invalid, it can use `aria-invalid="true"` and `aria-describedby` pointing to the error message ID. This lets assistive technologies announce the error context when the user focuses the field.

For newly appearing errors, a form-level summary or carefully used `role="alert"` can help announce the problem. Avoid noisy alerts for every small change, and keep focus management predictable.

##### Key Points to Mention

- Inputs need labels.
- Use `aria-invalid` for invalid state.
- Use `aria-describedby` for help or error text.
- Error text should be visible.
- Consider form-level summaries and focus behavior.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### What accessibility behavior should a modal dialog provide?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q01 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

A modal dialog should have an accessible name, usually through `aria-labelledby` referencing its title or through `aria-label`. Focus should move into the dialog when it opens, `Tab` and `Shift+Tab` should stay inside it, `Escape` should close it when appropriate, and focus should return to the triggering element when the dialog closes.

The rest of the page should be inert or otherwise unavailable while the modal is open. The dialog should include a visible close or cancel action. In production, teams should use a well-tested dialog primitive or carefully implement focus trapping, inert background behavior, and focus restoration.

##### Key Points to Mention

- Use `role="dialog"` and `aria-modal="true"` when needed.
- Provide an accessible name.
- Move focus inside on open.
- Trap focus while open.
- Restore focus on close.
- Make background content unavailable.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q01 -->

#### How do focus and selection differ in composite widgets?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q02 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Focus identifies the element that currently receives keyboard input. Selection identifies the item or items currently chosen inside a widget. In a tab list, for example, focus may move between tabs with arrow keys, while the selected tab is the one whose panel is active. Some widgets make selection follow focus, and others require Enter or Space to select.

This distinction matters because users need predictable keyboard behavior. Slow panels or network-backed tab content should usually avoid changing selection on every arrow key movement. ARIA state such as `aria-selected` communicates selection, while DOM focus or `aria-activedescendant` communicates active focus within a widget.

##### Key Points to Mention

- Focus is where keyboard input goes.
- Selection is chosen state.
- They can be different.
- `aria-selected` communicates selection.
- Roving `tabIndex` or `aria-activedescendant` can manage active focus.
- Do not make slow content load on every focus move.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q02 -->

#### How would you design an accessible reusable text field component?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q03 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

The component should require a label or equivalent accessible name, render a native input, generate or accept a stable ID, connect the label with `htmlFor`, pass through native input props, and connect helper or error text with `aria-describedby`. When there is an error, it should set `aria-invalid` and render visible error text.

The component should not hide native behavior. It should preserve `type`, `name`, `autoComplete`, `required`, `disabled`, and event props. It should avoid forcing every caller to manually wire IDs unless the caller needs explicit control.

##### Key Points to Mention

- Require a label.
- Render native controls.
- Use `useId` or caller-provided IDs.
- Connect label, hint, and error text.
- Preserve native input props.
- Support errors without breaking accessibility.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q03 -->

#### How would you test keyboard accessibility in a React component?

<!-- question:start:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q04 -->
<!-- question-id:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

I would start with manual keyboard testing: tab through the UI, verify visible focus, activate controls with Enter or Space, use Escape for overlays, and check focus restoration. Then I would add React Testing Library tests using role and label queries, `userEvent.tab`, `userEvent.keyboard`, and focus assertions.

For complex widgets, I would compare behavior against an established pattern, such as dialog, tabs, menu, listbox, or combobox guidance. Automated checks can catch missing labels or invalid ARIA, but they do not replace testing the actual keyboard interaction.

##### Key Points to Mention

- Test with keyboard only.
- Verify visible focus and focus order.
- Use semantic queries in tests.
- Use `userEvent.tab` and keyboard events.
- Check dialog and menu focus behavior.
- Automated scans are helpful but incomplete.

<!-- question:end:keyboard-accessibility-semantic-html-aria-and-labels-ids-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
