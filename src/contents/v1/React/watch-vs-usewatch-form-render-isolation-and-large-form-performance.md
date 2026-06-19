---
id: watch-vs-usewatch-form-render-isolation-and-large-form-performance
topic: Forms, validation, and frontend performance in production
subtopic: `watch` vs `useWatch`, form render isolation, and large-form performance
category: React
---

## Overview

`watch` and `useWatch` are React Hook Form APIs for observing form values, but they affect rendering differently. `watch` is a method returned by `useForm` and is convenient when the component that owns the form needs to read values. `useWatch` is a hook that subscribes to form values from a smaller component and isolates rerenders at that hook/component level.

This matters because large forms can become slow when every keystroke rerenders the entire form tree. React Hook Form's performance model depends on uncontrolled inputs, scoped subscriptions, and avoiding unnecessary root-level rerenders. If a top-level form component calls `watch()` for the whole form, every value change can make the whole form component rerender. If smaller field sections use `useWatch`, only the component that depends on that value needs to update.

In production React apps, this topic appears in long profile forms, checkout forms, onboarding flows, admin edit screens, dynamic questionnaires, form builders, nested field arrays, and any page where form state affects conditional UI.

For interviews, this topic is important because it tests whether a candidate understands subscription scope, form state isolation, controlled versus uncontrolled inputs, and practical performance debugging. A good answer is not "never use watch." A good answer is "watch at the level where the value is actually needed."

## Core Concepts

### React Hook Form's Subscription Model

React Hook Form avoids rerendering every field on every keystroke by default. Native inputs registered with `register` can keep their current value in the DOM, while React Hook Form tracks refs, changes, validation, dirty state, touched state, and submit state internally.

Rerenders happen when React components subscribe to state that changes.

Common subscriptions:

- A component reads `formState.errors`.
- A component reads `formState.isDirty`.
- A component calls `watch("fieldName")`.
- A component calls `watch()` for the whole form.
- A component uses `useWatch`.
- A component uses `useFormState`.
- A controlled field uses `Controller` or `useController`.

The performance question is: which component subscribed, and how much of the form did it subscribe to?

### What `watch` Does

`watch` is returned by `useForm`.

```tsx
const { register, watch } = useForm<FormValues>();

const plan = watch("plan");
```

Common forms:

```tsx
const value = watch("fieldName");
const values = watch(["firstName", "lastName"]);
const allValues = watch();
```

`watch` is useful when the same component that owns the form needs values for rendering. For example, a small form might show an extra field when a checkbox is checked.

```tsx
function SmallSignupForm() {
  const { register, watch } = useForm<SignupValues>({
    defaultValues: {
      hasCompany: false,
      companyName: "",
    },
  });

  const hasCompany = watch("hasCompany");

  return (
    <form>
      <label>
        <input type="checkbox" {...register("hasCompany")} />
        I am signing up for a company
      </label>

      {hasCompany ? (
        <input {...register("companyName")} placeholder="Company name" />
      ) : null}
    </form>
  );
}
```

This is fine for small forms. It can become expensive when the component calling `watch` renders a large tree.

### What `useWatch` Does

`useWatch` is a hook that subscribes to value changes from a component. Its main benefit is render isolation.

```tsx
function CompanyFields({ control }: { control: Control<SignupValues> }) {
  const hasCompany = useWatch({
    control,
    name: "hasCompany",
  });

  if (!hasCompany) {
    return null;
  }

  return <input {...register("companyName")} />;
}
```

In real code, the child component usually receives `control` and `register`, or it uses `FormProvider` and `useFormContext`.

```tsx
function CompanyFields() {
  const { control, register } = useFormContext<SignupValues>();
  const hasCompany = useWatch({
    control,
    name: "hasCompany",
  });

  if (!hasCompany) {
    return null;
  }

  return <input {...register("companyName")} placeholder="Company name" />;
}
```

Now only `CompanyFields` needs to rerender when `hasCompany` changes. The root form component does not need to rerender just to decide whether this section is visible.

### `watch` vs `useWatch`

The practical difference is subscription placement.

Use `watch` when:

- The form is small.
- The root form component genuinely needs the value.
- The watched value affects a small amount of UI.
- You are debugging or quickly prototyping.
- You need a one-off conditional render near the form owner.

Use `useWatch` when:

- A child component needs a form value.
- The form is large.
- Only one section should rerender.
- The watched value drives expensive UI.
- A field array row needs its own derived behavior.
- A reusable component should subscribe to its own field.

The rule of thumb: if the value only affects a subsection, subscribe inside that subsection.

### Whole-Form Watching

`watch()` with no field name returns the entire form values object.

```tsx
const values = watch();
```

This is convenient but expensive because it subscribes to every field. In a large form, every keystroke can rerender the component that called it.

Avoid using whole-form watch for:

- Live previews of large forms.
- Autosave of every field.
- Debug panels left in production.
- Form-level derived data that only needs a few fields.
- Expensive calculations on every input change.

Prefer watching specific fields:

```tsx
const [country, postalCode] = watch(["country", "postalCode"]);
```

Or isolate the subscription:

```tsx
function ShippingPreview() {
  const { control } = useFormContext<CheckoutValues>();
  const country = useWatch({ control, name: "shipping.country" });
  const postalCode = useWatch({ control, name: "shipping.postalCode" });

  return <ShippingEstimate country={country} postalCode={postalCode} />;
}
```

### `useWatch` Props

Common `useWatch` options include:

- `control`: the form control object from `useForm`.
- `name`: one field name or an array of field names.
- `defaultValue`: value used before the watched value is available.
- `disabled`: disables the subscription.
- `exact`: controls exact name matching.
- `compute`: derives a smaller value from the watched value.

Example with one field:

```tsx
const plan = useWatch({
  control,
  name: "plan",
  defaultValue: "free",
});
```

Example with multiple fields:

```tsx
const [firstName, lastName] = useWatch({
  control,
  name: ["firstName", "lastName"],
});
```

Example with `compute`:

```tsx
const hasBusinessPlan = useWatch({
  control,
  compute: (values: SignupValues) => values.plan === "business",
});
```

`compute` is useful when the component only needs a derived value. It can reduce rerenders when the derived result does not change.

### `useFormState`

`useWatch` isolates value subscriptions. `useFormState` isolates form-state subscriptions.

```tsx
function SaveBar() {
  const { control } = useFormContext<ProfileValues>();
  const { isDirty, isSubmitting, errors } = useFormState({ control });

  return (
    <footer>
      <button disabled={!isDirty || isSubmitting}>Save</button>
      {Object.keys(errors).length > 0 ? <span>Fix validation errors</span> : null}
    </footer>
  );
}
```

Use `useFormState` when a component only needs errors, dirty state, touched state, or submit state. Do not make the root form component subscribe to all form state if only one toolbar or field component needs it.

### `useController` and Render Isolation

`useController` combines a field value subscription and field state subscription for controlled components. It uses `useWatch` and `useFormState` internally to isolate rerenders around one controlled field.

```tsx
function ControlledTextField({ name }: { name: FieldPath<FormValues> }) {
  const { field, fieldState } = useController<FormValues>({ name });

  return (
    <>
      <TextField
        value={field.value ?? ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        inputRef={field.ref}
      />
      {fieldState.error ? <p role="alert">{fieldState.error.message}</p> : null}
    </>
  );
}
```

This is helpful for UI libraries, but native inputs should usually use `register` instead of being forced into controlled components.

### `getValues` for One-Time Reads

If you need the current value inside an event handler but do not need rendering to update when it changes, use `getValues`.

```tsx
function EstimateButton() {
  const { getValues } = useFormContext<CheckoutValues>();

  function handleEstimate() {
    const values = getValues(["shipping.country", "shipping.postalCode"]);
    calculateShipping(values);
  }

  return <button type="button" onClick={handleEstimate}>Estimate</button>;
}
```

`getValues` reads current values without subscribing the component to future changes. This is useful for buttons, submit handlers, validation helpers, and one-time calculations.

### `subscribe` for Side Effects Without Rendering

React Hook Form also supports subscriptions for observing form changes without forcing a React render.

This can be useful for:

- Analytics.
- Logging.
- Imperative integrations.
- Autosave pipelines.
- Syncing to external systems.

Example shape:

```tsx
useEffect(() => {
  const unsubscribe = subscribe({
    formState: { values: true },
    callback: ({ values }) => {
      queueAutosave(values);
    },
  });

  return unsubscribe;
}, [subscribe]);
```

Do not use render subscriptions when the UI does not need to render.

### Large-Form Performance Principles

Large forms perform well when subscriptions are narrow.

Good patterns:

- Use `register` for native fields.
- Use `Controller` only for controlled components.
- Split sections into components.
- Use `useWatch` inside the section that needs the value.
- Use `useFormState` near the component that needs form state.
- Use `getValues` for event-time reads.
- Use `subscribe` for side effects that do not render.
- Avoid global form previews unless they are memoized and scoped.
- Avoid storing all form values in React state.

The goal is not to prevent all rerenders. The goal is to rerender the smallest useful part of the tree.

### Dynamic Sections

Conditional sections are a common use case.

Less scalable:

```tsx
function LargeForm() {
  const methods = useForm<FormValues>();
  const accountType = methods.watch("accountType");

  return (
    <FormProvider {...methods}>
      <BasicFields />
      {accountType === "business" ? <BusinessFields /> : null}
      <BillingFields />
      <SecurityFields />
    </FormProvider>
  );
}
```

Better isolation:

```tsx
function LargeForm() {
  const methods = useForm<FormValues>();

  return (
    <FormProvider {...methods}>
      <BasicFields />
      <BusinessFieldsGate />
      <BillingFields />
      <SecurityFields />
    </FormProvider>
  );
}

function BusinessFieldsGate() {
  const { control } = useFormContext<FormValues>();
  const accountType = useWatch({ control, name: "accountType" });

  return accountType === "business" ? <BusinessFields /> : null;
}
```

Now `BusinessFieldsGate` handles the conditional render without making `LargeForm` rerender on account type changes.

### Field Arrays

Field arrays can become expensive because each row may contain many fields and derived UI.

Recommendations:

- Keep each row as a separate component.
- Use stable keys from `useFieldArray`.
- Watch row-specific values inside the row.
- Avoid watching the entire array at the parent.
- Avoid rebuilding all rows when one row changes.

Example:

```tsx
function LineItemRow({ index }: { index: number }) {
  const { control, register } = useFormContext<OrderForm>();
  const quantity = useWatch({
    control,
    name: `items.${index}.quantity`,
  });
  const price = useWatch({
    control,
    name: `items.${index}.price`,
  });

  return (
    <tr>
      <td><input {...register(`items.${index}.name`)} /></td>
      <td><input type="number" {...register(`items.${index}.quantity`)} /></td>
      <td>{Number(quantity || 0) * Number(price || 0)}</td>
    </tr>
  );
}
```

For very large arrays, consider virtualization, pagination, or splitting editing into smaller experiences.

### Derived Values

Derived values should be scoped and cheap.

Example:

```tsx
function OrderTotal() {
  const { control } = useFormContext<OrderForm>();
  const items = useWatch({ control, name: "items" });

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
        0,
      ),
    [items],
  );

  return <strong>Total: {total}</strong>;
}
```

If the form is large, avoid deriving everything from `watch()` at the root. Put the derived output where it belongs and subscribe only to the fields it needs.

### Validation and Error Rendering

Validation errors can also cause broad rerenders if handled at the wrong level.

Less scalable:

```tsx
const {
  formState: { errors },
} = useForm<FormValues>();
```

If the root component reads `errors`, it may rerender when any field error changes.

Better:

```tsx
function FieldError({ name }: { name: FieldPath<FormValues> }) {
  const { control } = useFormContext<FormValues>();
  const { errors } = useFormState({ control, name, exact: true });
  const error = get(errors, name);

  return error ? <p role="alert">{error.message}</p> : null;
}
```

In practice, many teams wrap this pattern inside reusable field components.

### FormProvider and Context

`FormProvider` lets child components access form methods with `useFormContext`.

```tsx
<FormProvider {...methods}>
  <ProfileFields />
</FormProvider>
```

Context access is not automatically slow. The important question is what the child reads and subscribes to. A child that only calls `register` is different from a child that watches the entire form.

Good practice:

- Use `FormProvider` to avoid prop drilling.
- Keep subscriptions inside small components.
- Avoid passing frequently changing derived values through many layers.
- Avoid reading broad `formState` in layout components.

### Default Values and First Render

Watched fields need default values for predictable first render behavior.

```tsx
const methods = useForm<FormValues>({
  defaultValues: {
    plan: "free",
    seats: 1,
  },
});
```

Without defaults, a watched value may be `undefined` on first render. That can cause flicker or conditional UI to mount incorrectly.

Use:

- `defaultValues` at `useForm`.
- `defaultValue` in `useWatch` for local fallback.
- `reset` when server data loads.

### Profiling Large Forms

Performance work should be measured.

Useful signals:

- Typing feels delayed.
- React DevTools Profiler shows large rerenders per keystroke.
- Expensive components rerender when unrelated fields change.
- Whole-form previews recalculate on every input.
- Controlled UI library fields lag.
- Field arrays rerender every row after one edit.

Fix the subscription scope before reaching for broad memoization. `memo` helps only when props are stable and the component does not subscribe to changing context or form state.

### Common Mistakes

Common mistakes include:

- Calling `watch()` for the whole form in the root component.
- Watching a field at the root when only a child section needs it.
- Using `useWatch` without default values and getting first-render flicker.
- Reading broad `formState` in a layout component.
- Using `Controller` for every native input.
- Storing every form field in external state.
- Watching a whole field array when only one row needs values.
- Using `watch` for side effects instead of a subscription or effect with care.
- Adding `memo` while keeping broad subscriptions.

### Best Practices

Best practices include:

- Use `watch` for small, local conditional rendering.
- Use `useWatch` for isolated child subscriptions.
- Use `useFormState` for isolated error, dirty, and submit state.
- Use `getValues` for one-time reads.
- Use subscriptions for non-rendering side effects.
- Keep conditional sections close to their watched fields.
- Provide complete `defaultValues`.
- Prefer uncontrolled native inputs with `register`.
- Use `Controller` only for controlled components.
- Profile before and after optimization.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does `watch` do in React Hook Form?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q01 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`watch` reads and subscribes to form values from the component that calls `useForm`. It can watch one field, multiple fields, or the whole form. It is useful for simple conditional rendering, such as showing a field when a checkbox is checked.

The trade-off is that the component calling `watch` can rerender when the watched value changes. If that component is the large root form component, the rerender can be expensive.

##### Key Points to Mention

- Returned by `useForm`.
- Can watch one field, many fields, or all values.
- Useful for conditional UI.
- Rerenders the calling component when watched values change.
- Whole-form watching can be expensive.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q01 -->

#### What does `useWatch` do?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q02 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`useWatch` is a React Hook Form hook that subscribes to form values at the component or hook level. It lets a smaller child component rerender when a specific field changes instead of forcing the whole form owner to rerender.

It is useful for large forms, conditional sections, field array rows, and reusable components that only care about a small part of the form.

##### Key Points to Mention

- Hook-level value subscription.
- Isolates rerendering.
- Accepts `control`, `name`, and `defaultValue`.
- Useful in child components.
- Good for large-form performance.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q02 -->

#### Why can `watch()` be expensive in a large form?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q03 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`watch()` with no name subscribes to the entire form. In a large form, any field change can rerender the component that called `watch()`. If that component renders many sections, field arrays, or expensive previews, typing into one field can cause too much work.

The fix is to watch specific fields or move subscriptions into smaller components with `useWatch`.

##### Key Points to Mention

- `watch()` subscribes to all values.
- Any field change can trigger rerender.
- Root-level rerenders are expensive.
- Watch specific fields when possible.
- Use `useWatch` for section-level subscriptions.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q03 -->

#### What is render isolation?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q04 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Render isolation means only the component that depends on changing state rerenders, rather than a large parent tree. In React Hook Form, `useWatch`, `useFormState`, and `useController` help isolate value and form-state subscriptions.

For example, a shipping estimate component can rerender when postal code changes without rerendering the entire checkout form.

##### Key Points to Mention

- Rerender the smallest useful component.
- Avoid broad parent subscriptions.
- `useWatch` isolates value changes.
- `useFormState` isolates form-state changes.
- Improves large-form responsiveness.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When would you choose `watch` instead of `useWatch`?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q01 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would choose `watch` for small forms or when the form owner genuinely needs the value for rendering. For example, a small login or signup form can use `watch("hasCompany")` to show one extra field without creating a separate component.

If the form is large or the value only affects a child section, I would prefer `useWatch` inside that child to keep rerenders scoped.

##### Key Points to Mention

- `watch` is fine for small forms.
- Use it when the caller needs the value.
- Avoid whole-form watch in large forms.
- Prefer `useWatch` for child sections.
- Match subscription location to UI need.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q01 -->

#### How should form state such as errors or dirty state be isolated?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q02 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `useFormState` near the component that needs the state. For example, a field component can subscribe to its own error, and a save bar can subscribe to `isDirty` and `isSubmitting`. Avoid making the root form component read broad `formState` if only a small child needs that information.

This keeps validation and dirty-state updates from rerendering unrelated form sections.

##### Key Points to Mention

- Use `useFormState`.
- Subscribe near the UI that needs the state.
- Scope by field name when possible.
- Avoid broad root `formState` subscriptions.
- Useful for errors, dirty state, touched state, and submit state.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q02 -->

#### When should you use `getValues` instead of watching a field?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q03 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `getValues` when you only need the current value at a specific moment, such as inside a button click, submit handler, custom validation function, or imperative calculation. `getValues` reads the current form values without subscribing the component to future changes.

Use `watch` or `useWatch` when the rendered UI must update as the value changes.

##### Key Points to Mention

- `getValues` is a one-time read.
- It does not subscribe the component.
- Good for event handlers.
- Watching is for reactive rendering.
- Avoid subscriptions when UI does not need them.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q03 -->

#### How would you optimize a conditional section in a large form?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q04 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would move the conditional logic into a small gate component and use `useWatch` inside that component. For example, `BusinessFieldsGate` can watch `accountType` and render `BusinessFields` only when needed. The root form component no longer needs to watch `accountType`.

I would also make sure the form has default values so the first render is predictable.

##### Key Points to Mention

- Move conditional render into child component.
- Use `useWatch` in the child.
- Avoid root-level watch.
- Provide default values.
- Keep expensive sections independent.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you diagnose rerender problems in a large React Hook Form?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q01 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would use React DevTools Profiler and targeted logging to see which components rerender on each keystroke. Then I would look for broad subscriptions: `watch()` at the root, root-level `formState.errors`, whole-array watches, controlled components where `register` would work, or derived previews that recalculate too often.

The fix is usually to move subscriptions down with `useWatch` or `useFormState`, use `getValues` for one-time reads, split large sections, and memoize only after subscription scope is correct.

##### Key Points to Mention

- Profile before optimizing.
- Identify broad subscriptions.
- Check root `watch()` and broad `formState`.
- Move value subscriptions down.
- Use `useFormState` for scoped errors/state.
- Memoization helps only after props and subscriptions are stable.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q01 -->

#### How would you handle a large field array efficiently?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q02 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

I would render each row as a separate component, use stable keys from `useFieldArray`, and watch only row-specific fields inside the row. I would avoid watching the entire array in the parent if only one row needs derived values. For very large arrays, I would consider virtualization, pagination, or editing one item at a time.

The goal is to avoid rerendering every row when one row changes.

##### Key Points to Mention

- Split rows into components.
- Use stable field-array keys.
- Watch row-specific values.
- Avoid parent-level whole-array watch.
- Consider virtualization or pagination.
- Keep derived row calculations local.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q02 -->

#### How do `useWatch` and `useFormState` work together?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q03 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`useWatch` subscribes to form values, while `useFormState` subscribes to form state such as errors, dirty fields, touched fields, validity, and submit state. A reusable field component may use `useWatch` for its value and `useFormState` for its error or dirty state.

This combination lets the component update only when its relevant value or state changes, rather than rerendering the whole form.

##### Key Points to Mention

- `useWatch` is for values.
- `useFormState` is for form state.
- Both isolate subscriptions.
- Useful in reusable fields.
- Avoid root-level broad subscriptions.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q03 -->

#### Why might `memo` not fix a slow form?

<!-- question:start:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q04 -->
<!-- question-id:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

`memo` only helps when props are stable and the component is not subscribed to changing state internally. If a component calls `watch()` or reads broad `formState`, it can still rerender when that subscription changes. If the parent creates new props every render, `memo` may also provide little benefit.

For large forms, subscription scope usually matters more than wrapping everything in `memo`.

##### Key Points to Mention

- `memo` depends on stable props.
- Internal subscriptions can still rerender.
- Broad `watch` or `formState` defeats isolation.
- Fix subscription placement first.
- Then memoize expensive pure components if needed.

<!-- question:end:watch-vs-usewatch-form-render-isolation-and-large-form-performance-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
