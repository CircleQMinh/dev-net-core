---
id: react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state
topic: Forms, validation, and frontend performance in production
subtopic: React Hook Form fundamentals, uncontrolled inputs, `Controller`, and form state
category: React
---

## Overview

React Hook Form is a form state and validation library for React that is built around registering fields, reading values at submit time, and minimizing rerenders. Its default model works especially well with uncontrolled native inputs, where the browser owns the current input value and React Hook Form tracks the field through refs and event handlers.

This matters because production forms often become performance bottlenecks. A large controlled form can rerender many components on every keystroke if state is lifted too high or subscribed too broadly. React Hook Form helps avoid that by letting fields register with the form control and by exposing targeted APIs for field state, form state, validation, reset, and submission.

React Hook Form is used for login forms, profile forms, checkout flows, admin CRUD screens, search filters, multi-step flows, and large enterprise forms. It can handle simple native inputs with `register`, controlled third-party components with `Controller`, and complex validation through built-in rules or schema resolvers.

For interviews, this topic is important because it tests whether a candidate understands form ownership, controlled versus uncontrolled inputs, validation timing, form state subscriptions, accessibility, and how to integrate component libraries without fighting React.

## Core Concepts

### React Hook Form's Mental Model

React Hook Form starts with `useForm`.

```tsx
import { useForm } from "react-hook-form";

type LoginFormValues = {
  email: string;
  password: string;
};

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    await login(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label>
        Email
        <input
          type="email"
          {...register("email", { required: "Email is required" })}
        />
      </label>
      {errors.email ? <p role="alert">{errors.email.message}</p> : null}

      <label>
        Password
        <input
          type="password"
          {...register("password", { required: "Password is required" })}
        />
      </label>
      {errors.password ? <p role="alert">{errors.password.message}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
```

The main pieces are:

- `register`: connects an input to the form.
- `handleSubmit`: validates and calls success or error callbacks.
- `formState`: exposes form-level state such as errors, dirty state, touched fields, submit state, and validation state.
- `defaultValues`: defines the baseline values used for dirty tracking and reset.
- `reset`, `setValue`, `getValues`, `watch`, and `trigger`: imperative helpers for common form workflows.

### Uncontrolled Inputs

An uncontrolled input stores its current value in the DOM rather than in React state on every keystroke. React Hook Form uses this pattern by default for native fields.

```tsx
<input {...register("firstName")} />
```

This is different from a controlled input:

```tsx
const [firstName, setFirstName] = useState("");

<input
  value={firstName}
  onChange={(event) => setFirstName(event.target.value)}
/>;
```

Uncontrolled inputs are useful because:

- The field can update without forcing the parent component to rerender on every keystroke.
- The browser keeps native input behavior.
- Large forms can stay responsive.
- Form state subscriptions can be scoped more carefully.

Uncontrolled does not mean unmanaged. React Hook Form still tracks the field through `name`, `ref`, `onChange`, and `onBlur`.

### `register`

`register` returns props that should be spread onto a native input.

```tsx
<input
  {...register("age", {
    valueAsNumber: true,
    min: { value: 18, message: "Must be at least 18" },
  })}
/>
```

The returned props include:

- `name`.
- `ref`.
- `onChange`.
- `onBlur`.
- Native validation-related attributes when applicable.

Rules can include validation and value conversion. For example, `valueAsNumber` converts the field value before validation and submission. `setValueAs` can customize conversion.

Common mistake:

```tsx
<input {...register("email")} value={email} onChange={setEmail} />
```

This mixes uncontrolled registration with a controlled value without a clear reason. If a field must be controlled, use `Controller` or `useController`.

### `handleSubmit`

`handleSubmit` wraps the form submit event. It runs validation, prevents invalid submission, and calls a valid callback or optional invalid callback.

```tsx
const onValid = async (values: ProfileFormValues) => {
  await updateProfile(values);
};

const onInvalid = (errors: FieldErrors<ProfileFormValues>) => {
  console.log(errors);
};

<form onSubmit={handleSubmit(onValid, onInvalid)} />;
```

Important points:

- The valid callback receives parsed form values.
- The invalid callback receives validation errors.
- Async submit handlers are supported.
- `isSubmitting` can drive pending UI.
- Server errors should be mapped back with `setError` when useful.

### `defaultValues`

`defaultValues` are the initial values for the form and the baseline for dirty tracking.

```tsx
const form = useForm<ProfileFormValues>({
  defaultValues: {
    firstName: "",
    lastName: "",
    email: "",
  },
});
```

Why `defaultValues` matter:

- `isDirty` compares current values against defaults.
- `dirtyFields` depends on defaults.
- `reset()` returns fields to defaults.
- Consistent defaults prevent uncontrolled-to-controlled warnings.

For data loaded from an API, use async defaults or call `reset` after data arrives.

```tsx
const { reset } = useForm<ProfileFormValues>({
  defaultValues: {
    firstName: "",
    lastName: "",
  },
});

useEffect(() => {
  if (profile) {
    reset(profile);
  }
}, [profile, reset]);
```

Avoid using `undefined` as a default value for fields that render input values.

### Form State

`formState` exposes form-level state.

Common properties:

- `errors`: validation errors by field name.
- `isDirty`: whether any field differs from `defaultValues`.
- `dirtyFields`: fields changed from defaults.
- `touchedFields`: fields that received blur.
- `isSubmitting`: submit handler is running.
- `isSubmitSuccessful`: last submit completed successfully.
- `isSubmitted`: the form has been submitted at least once.
- `submitCount`: number of submit attempts.
- `isValid`: whether the form currently passes validation.
- `isValidating`: validation is currently running.
- `validatingFields`: fields currently validating.
- `isLoading`: async default values are loading.

Example:

```tsx
const {
  formState: { isDirty, isSubmitting, errors },
} = useForm<ProfileFormValues>();
```

React Hook Form tracks subscriptions to form state. Read only the parts of `formState` that the component actually needs. Broad subscriptions can cause unnecessary rerenders.

### Field State

Sometimes a component only needs state for one field. Use `getFieldState`, `useController`, or `useFormState` instead of subscribing a large parent to the entire form.

```tsx
const fieldState = getFieldState("email");

if (fieldState.invalid) {
  console.log(fieldState.error?.message);
}
```

Field state commonly includes:

- `invalid`.
- `isDirty`.
- `isTouched`.
- `isValidating`.
- `error`.

This is useful for reusable input components that need their own error and touched state.

### `Controller`

`Controller` is used when a field is controlled by a component that does not expose a normal native input ref and event shape.

Common examples:

- UI library select components.
- Date pickers.
- Autocomplete components.
- Rich text editors.
- Masked inputs.
- Custom toggles.

Example:

```tsx
import { Controller, useForm } from "react-hook-form";

type FormValues = {
  startDate: Date | null;
};

function EventForm() {
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      startDate: null,
    },
  });

  return (
    <form onSubmit={handleSubmit(console.log)}>
      <Controller
        control={control}
        name="startDate"
        render={({ field, fieldState }) => (
          <>
            <DatePicker
              selected={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
            {fieldState.error ? (
              <p role="alert">{fieldState.error.message}</p>
            ) : null}
          </>
        )}
      />
    </form>
  );
}
```

The `render` function receives:

- `field`: `name`, `value`, `onChange`, `onBlur`, `ref`, and sometimes `disabled`.
- `fieldState`: error, touched, dirty, validating, and invalid state for that field.
- `formState`: broader form state.

### Avoiding Double Registration

Do not use `register` and `Controller` on the same field.

Bad:

```tsx
<Controller
  name="country"
  control={control}
  render={({ field }) => (
    <Select {...field} {...register("country")} />
  )}
/>
```

The field is already registered by `Controller`. Double registration can cause conflicting event handling, incorrect state, or confusing bugs.

### Mapping Controlled Components

Third-party inputs often do not use the same event signature as native inputs. `Controller` lets you adapt them.

```tsx
<Controller
  control={control}
  name="price"
  render={({ field }) => (
    <CurrencyInput
      value={field.value}
      onValueChange={(value) => field.onChange(value)}
      onBlur={field.onBlur}
      inputRef={field.ref}
    />
  )}
/>
```

The important part is to pass the final field value to `field.onChange`. Do not pass a complex event object unless the component is designed that way.

### `watch`, `getValues`, and `setValue`

`watch` subscribes to values and can rerender the component when watched values change.

```tsx
const plan = watch("plan");
```

Use it for conditional UI:

```tsx
{plan === "business" ? <BusinessFields /> : null}
```

`getValues` reads current values without creating a render subscription.

```tsx
const currentValues = getValues();
```

`setValue` updates a field imperatively and can optionally update validation, dirty, and touched state.

```tsx
setValue("email", normalizedEmail, {
  shouldValidate: true,
  shouldDirty: true,
  shouldTouch: true,
});
```

Use these intentionally. Too much imperative form manipulation can make the form harder to reason about.

### `reset` and `resetField`

`reset` replaces form values and can preserve selected state.

```tsx
reset(serverValues);
```

After a successful save, reset to the saved values so dirty tracking reflects changes after the save point:

```tsx
await saveProfile(values);
reset(values);
```

`resetField` resets one field.

```tsx
resetField("email");
```

Common mistake: saving successfully but not resetting defaults. The form still appears dirty even though the current values match the saved server state.

### Server Errors with `setError`

Server validation errors should be mapped into form errors when possible.

```tsx
try {
  await updateProfile(values);
} catch (error) {
  if (isValidationError(error)) {
    for (const fieldError of error.fields) {
      setError(fieldError.name as keyof ProfileFormValues, {
        type: "server",
        message: fieldError.message,
      });
    }

    return;
  }

  setError("root.server", {
    type: "server",
    message: "Could not save profile. Try again.",
  });
}
```

Field-specific errors belong near the field. Form-level errors belong near the submit area or top of the form.

### Accessibility

React Hook Form gives state and handlers, but the markup still needs to be accessible.

Good practices:

- Use real `<form>` and `<button type="submit">`.
- Use `<label>` or `htmlFor` for fields.
- Use `aria-invalid` when a field has an error.
- Connect errors with `aria-describedby`.
- Use `role="alert"` for important validation messages.
- Keep keyboard behavior intact.
- Focus the first invalid field when appropriate.

Example:

```tsx
<input
  id="email"
  aria-invalid={Boolean(errors.email)}
  aria-describedby={errors.email ? "email-error" : undefined}
  {...register("email", { required: "Email is required" })}
/>
{errors.email ? (
  <p id="email-error" role="alert">
    {errors.email.message}
  </p>
) : null}
```

### Performance

React Hook Form's performance advantage comes from avoiding unnecessary rerenders, but it is still possible to lose that benefit.

Performance-friendly practices:

- Prefer `register` for native inputs.
- Use `Controller` only when a component must be controlled.
- Subscribe to the smallest needed state.
- Keep reusable field components scoped.
- Avoid watching the whole form unless needed.
- Avoid storing every field value again in React state.
- Use `defaultValues` consistently.
- Split very large forms into sections.

Do not turn a React Hook Form into a fully controlled form unless there is a clear need.

### Common Mistakes

Common mistakes include:

- Mixing `value` and `onChange` state with `register` accidentally.
- Double-registering a field with both `register` and `Controller`.
- Forgetting `defaultValues`, causing dirty tracking problems.
- Reading broad `formState` in a top-level component and causing extra rerenders.
- Using `watch()` for the whole form when only one field is needed.
- Not forwarding `ref` or `onBlur` from `Controller`.
- Not resetting defaults after a successful save.
- Treating client validation as a replacement for server validation.
- Showing errors without accessible labels or descriptions.

### Best Practices

Best practices include:

- Use uncontrolled inputs with `register` for native fields.
- Use `Controller` for controlled third-party components.
- Provide complete `defaultValues`.
- Keep field components focused and reusable.
- Subscribe only to the form state you need.
- Map server validation errors with `setError`.
- Use `isSubmitting` to prevent duplicate submits.
- Reset after successful saves when current values become the new baseline.
- Use accessible labels, errors, and focus behavior.
- Keep server authorization and validation authoritative.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What problem does React Hook Form solve?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q01 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

React Hook Form helps manage form values, validation, submission, errors, and form state in React applications. It is especially useful because it works well with uncontrolled native inputs, which can reduce rerenders compared with storing every field value in React state.

It provides APIs such as `useForm`, `register`, `handleSubmit`, `formState`, `reset`, `setValue`, and `Controller`.

##### Key Points to Mention

- Manages form values and validation.
- Uses `register` for native inputs.
- Reduces unnecessary rerenders.
- Handles submit and error state.
- Integrates with controlled components through `Controller`.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q01 -->

#### What is an uncontrolled input?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q02 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An uncontrolled input keeps its current value in the DOM instead of requiring React state to update on every keystroke. React Hook Form registers the input with a ref and event handlers so it can read and validate the value without making the parent component control every change.

This is useful for performance, especially in larger forms.

##### Key Points to Mention

- DOM owns the current input value.
- React state is not updated for every keystroke.
- React Hook Form tracks the field through `register`.
- Useful for performance.
- Still supports validation and submission.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q02 -->

#### What does `register` do?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q03 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`register` connects an input to React Hook Form. It returns props such as `name`, `ref`, `onChange`, and `onBlur`, plus validation-related behavior. These props are usually spread onto native inputs.

It also accepts validation and conversion options such as `required`, `minLength`, `pattern`, `validate`, and `valueAsNumber`.

##### Key Points to Mention

- Connects a field to the form.
- Returns input props.
- Works well with native inputs.
- Accepts validation rules.
- Should not be mixed casually with controlled `value` state.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q03 -->

#### What is `formState`?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q04 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`formState` exposes the current state of the form, including validation errors, dirty state, touched fields, submit state, validation state, and whether the form is currently submitting.

Common properties include `errors`, `isDirty`, `dirtyFields`, `touchedFields`, `isSubmitting`, `isValid`, `isValidating`, and `submitCount`.

##### Key Points to Mention

- Contains form-level status.
- Includes validation errors.
- Tracks dirty and touched state.
- Tracks submission state.
- Should be subscribed to intentionally for performance.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When should you use `Controller`?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q01 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `Controller` when the field is a controlled component or a third-party UI component that does not behave like a normal native input. Examples include date pickers, custom selects, autocomplete components, masked inputs, and rich text editors.

`Controller` provides `field`, `fieldState`, and `formState` through a render function. The component should map its value and change events to `field.value` and `field.onChange`.

##### Key Points to Mention

- Use it for controlled components.
- Useful for UI libraries.
- `render` receives `field`, `fieldState`, and `formState`.
- Map custom events to `field.onChange`.
- Do not double-register the field.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q01 -->

#### Why are `defaultValues` important?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q02 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`defaultValues` define the initial form values and the baseline used for dirty tracking. `isDirty` and `dirtyFields` compare current values to the defaults. `reset()` also uses defaults to restore the form.

Without consistent defaults, dirty tracking can be wrong, reset behavior can be surprising, and inputs may hit controlled/uncontrolled edge cases.

##### Key Points to Mention

- Baseline for `isDirty`.
- Baseline for `dirtyFields`.
- Used by `reset`.
- Prevents inconsistent initial state.
- Should be updated after successful save if saved values become the new baseline.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q02 -->

#### How would you display server validation errors?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q03 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

After a failed submit, map server validation errors into React Hook Form using `setError`. Field-specific errors should be attached to their field names, and form-level errors can use a root-level key such as `root.server`.

This keeps server errors in the same error display path as client validation errors.

##### Key Points to Mention

- Use `setError`.
- Map field errors to field names.
- Use root-level errors for form-wide failures.
- Keep server validation authoritative.
- Preserve user input after failure.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q03 -->

#### How can React Hook Form reduce rerenders?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q04 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

React Hook Form reduces rerenders by defaulting to uncontrolled inputs and allowing components to subscribe only to the state they need. Native inputs can update in the DOM without forcing parent components to rerender on every keystroke.

To preserve that benefit, avoid watching the entire form unnecessarily, avoid broad `formState` subscriptions at the top of the tree, and use field-level components or `Controller` only where needed.

##### Key Points to Mention

- Uncontrolled inputs avoid parent rerenders per keystroke.
- State subscriptions can be scoped.
- Avoid broad `watch()`.
- Avoid duplicating all field values in React state.
- Use `Controller` only when needed.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you integrate a complex UI library input with React Hook Form?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q01 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would use `Controller` or `useController`. The render function would map `field.value`, `field.onChange`, `field.onBlur`, `field.name`, and `field.ref` to the UI component's API. If the component emits a custom value shape, I would transform it before calling `field.onChange`.

I would also display `fieldState.error`, pass accessibility props, provide a default value, and avoid spreading both `field` and `register` onto the same component.

##### Key Points to Mention

- Use `Controller` or `useController`.
- Map custom value and change APIs.
- Forward blur and ref when possible.
- Display `fieldState.error`.
- Provide default values.
- Avoid double registration.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q01 -->

#### How should dirty state be handled after a successful save?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q02 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

After a successful save, the saved values often become the new baseline. I would call `reset(savedValues)` so `isDirty` and `dirtyFields` compare future edits against the saved server state, not the original page-load values.

If the server returns normalized values, I would reset with the server response rather than the raw submitted values.

##### Key Points to Mention

- Dirty state compares against defaults.
- Successful save often changes the baseline.
- Use `reset(savedValues)`.
- Prefer server-normalized response values.
- Prevent stale "unsaved changes" warnings.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q02 -->

#### What are common performance traps with React Hook Form?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q03 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Common traps include turning every field into a controlled component, watching the whole form from a top-level component, destructuring broad `formState` values that many children do not need, and storing duplicate form values in external state.

Another trap is wrapping every native input in `Controller` when `register` would be simpler and faster.

##### Key Points to Mention

- Avoid unnecessary controlled fields.
- Avoid broad `watch()`.
- Avoid broad parent subscriptions to form state.
- Avoid duplicate external state.
- Prefer `register` for native inputs.
- Split large forms into focused components.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q03 -->

#### How would you design a reusable field component?

<!-- question:start:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q04 -->
<!-- question-id:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

For native inputs, I would pass the result of `register` or accept a field name and form context carefully. The component should render a label, input, error message, and accessibility attributes. It should not subscribe to unrelated form state.

For controlled UI library inputs, I would use `Controller` or `useController` inside the reusable component and expose only the needed props. The component should forward refs when possible and display field-level state.

##### Key Points to Mention

- Keep subscriptions narrow.
- Include label and error markup.
- Use `aria-invalid` and `aria-describedby`.
- Use `register` for native inputs.
- Use `Controller` for controlled components.
- Avoid hiding too much form behavior.

<!-- question:end:react-hook-form-fundamentals-uncontrolled-inputs-controller-and-form-state-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
