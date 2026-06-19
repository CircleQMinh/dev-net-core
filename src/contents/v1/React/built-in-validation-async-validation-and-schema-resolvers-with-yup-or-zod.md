---
id: built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod
topic: Forms, validation, and frontend performance in production
subtopic: Built-in validation, async validation, and schema resolvers with Yup or Zod
category: React
---

## Overview

React Hook Form supports several validation styles: built-in field rules, custom synchronous validation, asynchronous validation, and schema-based validation through resolvers such as Yup or Zod. The right choice depends on form complexity, type-safety needs, reuse, server contracts, and user experience.

Built-in validation is useful for simple field-level rules such as required fields, minimum length, maximum value, and patterns. Custom `validate` functions are useful for domain-specific checks. Async validation is useful for server-backed checks such as username availability, but it must be designed carefully to avoid slow typing, race conditions, and excessive network requests. Schema resolvers are useful when the app wants centralized validation rules, reusable schemas, and consistent error messages.

This topic matters because form validation is a product boundary. Good validation catches mistakes early, gives actionable feedback, preserves user input, and still treats the server as authoritative. Weak validation creates duplicate rules, confusing errors, inaccessible forms, expensive network chatter, or false confidence in client-side checks.

For interviews, this topic tests whether a candidate can choose validation levels deliberately, integrate schema libraries correctly, explain Yup versus Zod trade-offs, and design async validation without making the form feel haunted by latency.

## Core Concepts

### Validation Layers

Production forms often have multiple validation layers.

Client-side validation:

- Improves immediate feedback.
- Catches obvious mistakes before submit.
- Reduces avoidable server calls.
- Helps guide user input.

Server-side validation:

- Is authoritative.
- Protects business rules.
- Validates permissions.
- Handles race conditions.
- Prevents tampered client requests.

Schema validation:

- Centralizes structure and rules.
- Can be reused across forms or boundaries.
- Can infer TypeScript types with some libraries.
- Makes complex validation easier to test.

Client validation should improve UX, not replace server validation.

### Built-In Rules with `register`

React Hook Form supports common field-level validation rules through `register`.

```tsx
type SignupValues = {
  email: string;
  password: string;
  age: number;
};

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<SignupValues>();

<input
  type="email"
  {...register("email", {
    required: "Email is required",
    pattern: {
      value: /^\S+@\S+$/i,
      message: "Enter a valid email",
    },
  })}
/>;

<input
  type="password"
  {...register("password", {
    required: "Password is required",
    minLength: {
      value: 12,
      message: "Use at least 12 characters",
    },
  })}
/>;

<input
  type="number"
  {...register("age", {
    valueAsNumber: true,
    min: {
      value: 18,
      message: "You must be at least 18",
    },
  })}
/>;
```

Common rules include:

- `required`.
- `min`.
- `max`.
- `minLength`.
- `maxLength`.
- `pattern`.
- `validate`.
- `deps`.
- `valueAsNumber`.
- `valueAsDate`.
- `setValueAs`.

Built-in rules are best for simple field constraints.

### Custom `validate`

Use `validate` for rules that do not fit built-in constraints.

```tsx
<input
  {...register("confirmPassword", {
    validate: (value, formValues) =>
      value === formValues.password || "Passwords must match",
  })}
/>
```

`validate` can also be an object of named validators.

```tsx
<input
  {...register("password", {
    validate: {
      hasUppercase: (value) =>
        /[A-Z]/.test(value) || "Use at least one uppercase letter",
      hasNumber: (value) =>
        /\d/.test(value) || "Use at least one number",
    },
  })}
/>
```

Named validators work well with `criteriaMode: "all"` when the UI wants to show multiple reasons a field is invalid.

### Validation Modes

Validation timing is controlled by `mode` and `reValidateMode`.

Common modes:

- `onSubmit`: validate when the form is submitted.
- `onBlur`: validate when a field loses focus.
- `onChange`: validate while the user types.
- `onTouched`: validate after a field has been touched.
- `all`: validate on blur and change.

Example:

```tsx
const form = useForm<SignupValues>({
  mode: "onBlur",
  reValidateMode: "onChange",
});
```

Trade-offs:

- `onSubmit` is quiet but errors appear later.
- `onBlur` is a practical default for many forms.
- `onChange` gives immediate feedback but can be noisy and expensive.
- Async validation on every change can overwhelm the API without debouncing or caching.

Choose validation timing based on the field and user task.

### Error Messages

Good validation messages are specific, actionable, and close to the field.

Bad:

```txt
Invalid input
```

Better:

```txt
Use at least 12 characters.
```

Field error example:

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

Validation is UX, not just correctness.

### Async Validation

React Hook Form validators can return a promise. This is useful for server-backed checks.

```tsx
<input
  {...register("username", {
    validate: async (value) => {
      if (value.length < 3) {
        return "Use at least 3 characters";
      }

      const available = await checkUsernameAvailable(value);
      return available || "That username is already taken";
    },
  })}
/>
```

Good async validation candidates:

- Username availability.
- Email uniqueness.
- Coupon validity.
- Invite code validity.
- Address verification.

Poor async validation candidates:

- Every keystroke without debounce.
- Security or authorization decisions.
- Expensive business operations.
- Checks that can only be final at submit time.

Async validation should be helpful, not punitive.

### Async Validation Race Conditions

Async validation can race.

Example:

- User types `alex`.
- App starts availability check.
- User changes value to `alex1`.
- `alex1` check returns first.
- Old `alex` check returns later and overwrites the result.

Mitigation strategies:

- Validate on blur instead of every change.
- Debounce change-based checks.
- Ignore results for stale values.
- Use request cancellation when available.
- Cache repeated checks.
- Always revalidate on submit.

Example stale guard:

```ts
function createUsernameValidator() {
  let latestValue = "";

  return async (value: string) => {
    latestValue = value;

    const available = await checkUsernameAvailable(value);

    if (value !== latestValue) {
      return true;
    }

    return available || "That username is already taken";
  };
}
```

The server must still validate final submission.

### Validation State

React Hook Form exposes validation state through `formState`.

Useful fields:

- `isValidating`: at least one validation is running.
- `validatingFields`: fields currently validating.
- `isValid`: current validity.
- `errors`: field and form errors.

Example:

```tsx
const {
  register,
  formState: { errors, isValidating, validatingFields },
} = useForm<SignupValues>({
  mode: "onBlur",
});

{validatingFields.username ? <span>Checking username...</span> : null}
```

Use validation state to make async feedback clear. A silent delay after blur feels broken.

### `trigger`

`trigger` manually runs validation.

```tsx
const isStepValid = await trigger(["email", "password"], {
  shouldFocus: true,
});

if (isStepValid) {
  goToNextStep();
}
```

Use cases:

- Multi-step forms.
- Validate before opening a confirmation step.
- Revalidate dependent fields.
- Run validation after programmatic changes.

Avoid calling `trigger` on every render or without a clear user event.

### Schema Resolvers

A resolver connects React Hook Form to an external validation library. Common choices include Zod and Yup.

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  age: z.coerce.number().min(18, "You must be at least 18"),
});

type SignupValues = z.infer<typeof schema>;

const form = useForm<SignupValues>({
  resolver: zodResolver(schema),
  defaultValues: {
    email: "",
    age: 18,
  },
});
```

Resolvers are useful when:

- Rules are shared across fields.
- Validation logic is complex.
- Type inference matters.
- Server and client contracts are schema-driven.
- Multiple forms need consistent rules.

### Zod

Zod is a TypeScript-first schema validation library. It defines schemas in TypeScript and can infer static types from those schemas.

Example:

```tsx
import { z } from "zod";

const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

type ProfileValues = z.infer<typeof profileSchema>;
```

React Hook Form integration:

```tsx
const form = useForm<ProfileValues>({
  resolver: zodResolver(profileSchema),
});
```

Zod is often preferred in TypeScript-heavy React apps because schema and type inference stay close together.

### Yup

Yup is a schema builder for runtime parsing and validation. It supports object schemas, transforms, validation tests, async validation, and TypeScript inference.

Example:

```tsx
import * as yup from "yup";

const profileSchema = yup
  .object({
    displayName: yup.string().required("Display name is required"),
    age: yup
      .number()
      .typeError("Age must be a number")
      .min(18, "You must be at least 18")
      .required("Age is required"),
  })
  .required();
```

React Hook Form integration:

```tsx
const form = useForm({
  resolver: yupResolver(profileSchema),
});
```

Yup can be attractive for teams already familiar with its API or with existing validation schemas.

### Yup vs Zod

Both Yup and Zod can work well with React Hook Form.

Zod strengths:

- TypeScript-first design.
- Strong static inference.
- No external dependencies.
- Clear parsing model.
- Good fit for shared TypeScript contracts.

Yup strengths:

- Mature schema builder.
- Expressive object validation.
- Built-in transforms and async validation.
- Familiar in many existing React codebases.
- Useful for teams with existing Yup schemas.

Choose based on team standards, TypeScript needs, existing code, bundle considerations, and schema reuse. Do not mix both in one app without a clear migration boundary.

### Built-In Rules vs Schema Resolvers

Use built-in rules when:

- The form is small.
- Rules are simple and local.
- You do not need schema reuse.
- You want minimal dependencies.

Use schema resolvers when:

- The form has complex nested data.
- Cross-field validation is common.
- You want reusable schemas.
- You want type inference from schemas.
- Validation rules should match API contracts.

It is fine to use both patterns in different forms, but avoid splitting rules for one field between inline rules and schema rules in a way that becomes hard to reason about.

### Cross-Field Validation

Cross-field validation can be handled with custom `validate` or schema refinements.

Inline example:

```tsx
<input
  type="password"
  {...register("confirmPassword", {
    validate: (value, values) =>
      value === values.password || "Passwords must match",
  })}
/>
```

Zod example:

```ts
const passwordSchema = z
  .object({
    password: z.string().min(12),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });
```

For complex cross-field rules, schema validation is usually easier to test and maintain.

### Server Validation and `setError`

Even with schema validation, server errors need to be handled.

```tsx
async function onSubmit(values: SignupValues) {
  const result = await createAccount(values);

  if (!result.ok) {
    for (const field of result.fieldErrors) {
      setError(field.name as keyof SignupValues, {
        type: "server",
        message: field.message,
      });
    }

    return;
  }

  reset(result.user);
}
```

Client validation cannot know everything:

- The username may become unavailable.
- The user may lose permission.
- Business rules may change.
- The server may normalize values.
- The request may be tampered with.

Server validation remains authoritative.

### Native Browser Validation

React Hook Form can align with native HTML validation attributes, but many apps prefer custom validation UI for consistency and accessibility control.

Native constraints still matter:

```tsx
<input
  type="email"
  autoComplete="email"
  {...register("email", { required: "Email is required" })}
/>
```

Use semantic input types and browser hints even when custom validation is used. They improve mobile keyboards, autofill, and accessibility.

### Common Mistakes

Common mistakes include:

- Validating on every change with expensive async requests.
- Trusting client validation as the security boundary.
- Duplicating conflicting rules in both schemas and inline validators.
- Forgetting `valueAsNumber` or coercion for numeric fields.
- Displaying generic messages such as "Invalid".
- Not handling server validation errors.
- Not preserving user input after a failed submit.
- Using `isValid` without understanding validation mode.
- Ignoring race conditions in async validation.
- Showing multiple schema errors without a clear UI strategy.

### Best Practices

Best practices include:

- Use built-in rules for simple field constraints.
- Use schemas for complex, shared, or typed validation.
- Prefer `onBlur` or submit-time validation for expensive checks.
- Debounce and guard async validation.
- Show field-level messages close to the field.
- Keep messages specific and actionable.
- Use `valueAsNumber`, `setValueAs`, or schema coercion intentionally.
- Treat server validation as authoritative.
- Map server errors into form state with `setError`.
- Make validation accessible with labels and error associations.
- Keep validation rules testable.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What validation options does React Hook Form provide?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q01 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

React Hook Form supports built-in field rules such as `required`, `min`, `max`, `minLength`, `maxLength`, and `pattern`. It also supports custom `validate` functions, async validation, and schema validation through resolvers such as Yup or Zod.

The right option depends on form complexity and whether validation should be local, reusable, type-driven, or server-backed.

##### Key Points to Mention

- Built-in rules.
- Custom `validate`.
- Async validation.
- Schema resolvers.
- Server validation still required.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q01 -->

#### What are built-in validation rules?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q02 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Built-in validation rules are simple field-level constraints passed to `register`. Examples include `required`, `min`, `max`, `minLength`, `maxLength`, and `pattern`. They are useful for straightforward constraints like required email, minimum password length, or numeric range.

They can return custom messages so the UI can show helpful field errors.

##### Key Points to Mention

- Passed through `register`.
- Good for simple rules.
- Can include messages.
- Run according to validation mode.
- Not a replacement for server validation.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q02 -->

#### What is a resolver?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q03 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A resolver connects React Hook Form to an external validation library. For example, `zodResolver` lets a Zod schema validate the form, and `yupResolver` lets a Yup schema validate the form.

The resolver returns validated values or errors in the shape React Hook Form expects.

##### Key Points to Mention

- Adapter between React Hook Form and schema library.
- Common resolvers include Zod and Yup.
- Configured with `useForm({ resolver })`.
- Useful for centralized validation.
- Can improve type safety with some schemas.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q03 -->

#### Why is server-side validation still needed?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q04 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Client-side validation improves UX but can be bypassed or tampered with. The server must still validate input, enforce permissions, check business rules, and handle race conditions.

For example, a username may be available during client validation but taken by the time the user submits. The server must make the final decision.

##### Key Points to Mention

- Client validation can be bypassed.
- Server enforces business rules.
- Server enforces authorization.
- Server handles race conditions.
- Client validation is for UX.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When would you use built-in rules instead of a schema resolver?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q01 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would use built-in rules for small forms with simple field-level constraints. For example, a login form may only need required email and password fields. Built-in rules avoid extra dependencies and keep the validation close to the field.

I would move to a schema resolver when validation becomes complex, reused, nested, cross-field, or strongly tied to TypeScript/API contracts.

##### Key Points to Mention

- Built-in rules are simple and local.
- Good for small forms.
- Avoid extra schema dependency.
- Schema resolvers fit complex or reusable rules.
- Avoid splitting one rule across too many places.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q01 -->

#### How should async validation be designed?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q02 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Async validation should be used sparingly for checks that need the server, such as username availability. It should not fire expensive requests on every keystroke without debounce or a validation mode such as `onBlur`.

It should handle stale responses, show validation progress when useful, and always revalidate on submit because async checks can become outdated.

##### Key Points to Mention

- Use for server-backed checks.
- Prefer blur or debounce for expensive checks.
- Guard against stale responses.
- Show validating state.
- Revalidate on submit.
- Server remains authoritative.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q02 -->

#### How do Yup and Zod differ?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q03 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Zod is TypeScript-first and commonly used when teams want schema definitions to infer static TypeScript types. Yup is a mature schema builder with expressive object validation, transforms, and async validation support.

Both can be used with React Hook Form through resolvers. The best choice depends on existing codebase conventions, TypeScript needs, schema reuse, and team familiarity.

##### Key Points to Mention

- Zod is TypeScript-first.
- Zod has strong inference.
- Yup is mature and expressive.
- Yup supports transforms and async validation.
- Both work through resolvers.
- Choose based on codebase needs.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q03 -->

#### How should numeric inputs be validated?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q04 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

HTML input values arrive as strings by default, even for `type="number"`. With React Hook Form, use `valueAsNumber`, `setValueAs`, or schema-level coercion so validation receives the expected type.

Then validate range and required behavior with built-in rules or schema constraints. The UI should handle empty values carefully because `NaN` can appear when converting empty numeric inputs.

##### Key Points to Mention

- Browser input values are strings.
- Use `valueAsNumber` or schema coercion.
- Validate min and max.
- Handle empty values.
- Keep displayed message clear.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you validate a multi-step form?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q01 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would validate only the fields needed for the current step before moving forward, often using `trigger(["fieldA", "fieldB"])`. For complex forms, I might use a full schema and step-specific field lists or step-specific schemas.

I would preserve values between steps, avoid unregistering fields accidentally unless that is intended, and still validate the full payload on final submit.

##### Key Points to Mention

- Validate current step fields.
- Use `trigger`.
- Consider step-specific schemas.
- Preserve values between steps.
- Validate full payload on final submit.
- Server remains authoritative.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q01 -->

#### How would you handle schema validation and server errors together?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q02 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

The schema validates the client-side shape before submit. The server still validates the final request. If the server returns field errors, I would map them into React Hook Form using `setError`. If it returns a form-level error, I would set a root error.

This keeps all error rendering in one path while respecting the server as the source of truth.

##### Key Points to Mention

- Schema handles client-side validation.
- Server validates final request.
- Map server field errors with `setError`.
- Use root errors for form-level problems.
- Preserve values and focus the relevant field.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q02 -->

#### What are risks of validating on every change?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q03 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Validating on every change can be noisy and expensive. It can show errors before the user has had a chance to finish typing, rerun complex schema logic too often, or fire many async requests. For async checks, it can also create race conditions where stale responses overwrite newer results.

For many forms, `onBlur`, `onSubmit`, debounced checks, or field-specific validation timing creates a better UX.

##### Key Points to Mention

- Can be noisy.
- Can hurt performance.
- Can trigger too many network requests.
- Can create async race conditions.
- Use blur, submit, or debounce when appropriate.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q03 -->

#### How would you choose between inline validation and schema validation in a large app?

<!-- question:start:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q04 -->
<!-- question-id:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would use inline validation for simple, local field rules and schema validation for complex forms, reusable domain rules, nested objects, cross-field validation, and typed API contracts. I would also consider whether the team already standardizes on Zod, Yup, or generated schemas.

In a large app, consistency matters. I would define conventions so teams do not duplicate conflicting validation logic in multiple places.

##### Key Points to Mention

- Inline rules for simple constraints.
- Schemas for complex and reusable rules.
- Schemas help with nested and cross-field validation.
- Zod is strong for TypeScript inference.
- Yup may fit existing mature schemas.
- Team conventions matter.

<!-- question:end:built-in-validation-async-validation-and-schema-resolvers-with-yup-or-zod-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
