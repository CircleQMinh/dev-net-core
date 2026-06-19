---
id: centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query
topic: Production data access, API clients, and frontend auth
subtopic: Centralized API clients with `fetch`, Axios, RTK Query, or TanStack Query
category: React
---

## Overview

Centralized API clients are shared modules that define how a React application talks to backend services. Instead of scattering raw `fetch` or Axios calls across components, the app uses a small set of API utilities, service functions, generated hooks, or query definitions.

This matters because production React apps need consistent behavior for:

- Base URLs.
- Request headers.
- Authentication.
- JSON parsing.
- Error normalization.
- Timeouts and cancellation.
- Retries.
- Cache invalidation.
- Loading and mutation states.
- Logging and observability.
- Type-safe request and response shapes.

Centralization does not mean every endpoint must live in one giant file. It means the app has a clear boundary for server communication. Components should usually describe what data they need or what mutation they want to perform, not duplicate low-level HTTP details.

For interviews, this topic is important because it tests whether a candidate understands the difference between UI state and server state, when a lightweight wrapper is enough, when a full data-fetching library is useful, and how to avoid auth, caching, and error handling bugs as an application grows.

## Core Concepts

### What a Centralized API Client Is

A centralized API client is a shared layer that hides repetitive transport details behind a predictable interface.

Common responsibilities:

- Build URLs from a base API path.
- Serialize request bodies.
- Parse JSON responses.
- Check HTTP status codes.
- Attach authentication headers when appropriate.
- Convert network and HTTP failures into application-level errors.
- Support aborting requests.
- Apply common timeout or retry behavior.
- Expose typed service functions or hooks to the UI.

Example:

```ts
type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);

    throw {
      status: response.status,
      message: body?.message ?? "Request failed",
      details: body,
    } satisfies ApiError;
  }

  return response.json() as Promise<T>;
}
```

This wrapper gives components one behavior for error handling and response parsing instead of making every component remember to check `response.ok`.

### Why Raw HTTP Calls in Components Become a Problem

Calling APIs directly inside components can be acceptable for prototypes or tiny screens, but it scales poorly.

Common issues:

- Every component reimplements loading, error, and success states.
- Some calls check `response.ok`, while others forget.
- Authentication headers are attached inconsistently.
- Error shapes vary from screen to screen.
- Cancellation is forgotten when components unmount or inputs change.
- Duplicate requests are made for the same data.
- Cache invalidation becomes guesswork.
- Tests must mock many unrelated HTTP details.

The goal of an API client is not to hide HTTP completely. The goal is to make common behavior boring and consistent.

### Centralization vs Over-Centralization

Good centralization removes repetition without creating a giant, fragile abstraction.

Good centralization:

- Keeps transport details in one place.
- Keeps endpoint-specific logic near the feature that owns it.
- Uses typed request and response contracts.
- Lets callers pass needed options such as `signal`.
- Makes errors predictable.

Over-centralization:

- Puts every endpoint in one enormous `api.ts`.
- Hides important behavior behind magic flags.
- Builds a custom caching framework when a proven library would be clearer.
- Forces unrelated APIs into one interface.
- Makes feature teams edit the same file for every endpoint.

A practical structure is often:

```txt
src/
  api/
    httpClient.ts
    apiError.ts
  features/
    users/
      usersApi.ts
      usersQueries.ts
    orders/
      ordersApi.ts
      ordersQueries.ts
```

The shared `httpClient.ts` handles transport. Feature API files define domain-specific operations.

### `fetch` as a Lightweight API Client

`fetch` is built into modern browsers and returns a promise that resolves to a `Response`. It is a good choice when an app wants minimal dependencies and has simple HTTP needs.

Important `fetch` details for interviews:

- `fetch` rejects for network-level failures, not for HTTP error statuses such as `400` or `500`.
- Callers must check `response.ok` or inspect `response.status`.
- Response body parsing is explicit, such as `response.json()` or `response.text()`.
- Cancellation uses `AbortController` and `AbortSignal`.
- Cookies and credentials are controlled with the `credentials` option.
- Headers and request bodies must be built explicitly.

Example with cancellation:

```ts
export async function getUser(userId: string, signal?: AbortSignal) {
  return apiFetch<User>(`/users/${userId}`, { signal });
}
```

Used in a component:

```tsx
useEffect(() => {
  const controller = new AbortController();

  getUser(userId, controller.signal)
    .then(setUser)
    .catch((error) => {
      if (error.name !== "AbortError") {
        setError(error);
      }
    });

  return () => controller.abort();
}, [userId]);
```

This is useful when the app does not need a full server-state cache, but it does put more responsibility on the team to handle request deduplication, caching, and retries.

### Axios as a Centralized HTTP Client

Axios is a promise-based HTTP client that adds convenience around request configuration, JSON handling, timeouts, interceptors, cancellation, and error objects.

Typical Axios client:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10_000,
  headers: {
    Accept: "application/json",
  },
});
```

Feature service:

```ts
export async function getProfile() {
  const response = await api.get<UserProfile>("/me");
  return response.data;
}
```

Axios can be a good choice when the team wants:

- Request and response interceptors.
- Built-in timeout configuration.
- Consistent error objects.
- Per-service instances.
- A mature client usable in browser and Node-based tooling.

The main mistake is putting global defaults on the shared Axios object when the app talks to multiple domains. Credentials and auth headers should usually be scoped to an instance with a known `baseURL`.

### RTK Query as an API Client and Cache Layer

RTK Query is a data fetching and caching tool included with Redux Toolkit. It is useful when the app already uses Redux Toolkit or wants API definitions integrated with Redux state and generated React hooks.

Example API slice:

```ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

type User = {
  id: string;
  name: string;
};

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: (headers, { getState }) => {
      const token = selectAccessToken(getState());

      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }

      return headers;
    },
  }),
  tagTypes: ["User"],
  endpoints: (build) => ({
    getUser: build.query<User, string>({
      query: (id) => `/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: "User", id }],
    }),
    updateUser: build.mutation<User, Partial<User> & Pick<User, "id">>({
      query: ({ id, ...patch }) => ({
        url: `/users/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "User", id }],
    }),
  }),
});

export const { useGetUserQuery, useUpdateUserMutation } = usersApi;
```

RTK Query centralizes:

- Endpoint definitions.
- Generated hooks.
- Loading and error state.
- Cache lifetimes.
- Cache invalidation with tags.
- Request header preparation.
- Response and error transformations.

The trade-off is that RTK Query is tied to Redux Toolkit infrastructure. If the app does not otherwise use Redux, TanStack Query or a smaller wrapper may be simpler.

### TanStack Query as a Server-State Client

TanStack Query is a server-state library. It does not require Redux and works with any promise-returning function. The API client still performs HTTP transport, while TanStack Query manages query keys, caching, request deduplication, retries, refetching, stale state, and mutation coordination.

Example:

```ts
export function getUser(userId: string) {
  return apiFetch<User>(`/users/${userId}`);
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    staleTime: 60_000,
  });
}
```

Mutation with invalidation:

```ts
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["user", updated.id] });
    },
  });
}
```

TanStack Query is often the right abstraction when:

- The app has repeated reads of server data.
- Multiple components need the same data.
- Background refetching is useful.
- Loading, error, stale, and fetching states need to be consistent.
- Optimistic updates or mutation invalidation matter.
- You do not want to store remote data manually in React state.

It is not a replacement for the HTTP client. The query function still needs a reliable `fetch` or Axios wrapper.

### Choosing Between `fetch`, Axios, RTK Query, and TanStack Query

The choice depends on the problem.

Use a `fetch` wrapper when:

- The app is small or has simple server communication.
- You want no extra dependency.
- You can manage loading, retries, and caching manually or through route loaders.
- You only need a consistent transport layer.

Use Axios when:

- You want configured instances, interceptors, timeouts, and consistent error objects.
- Your app has multiple backends or needs per-service clients.
- You need to integrate auth headers, logging, retry, or response normalization at the HTTP layer.

Use RTK Query when:

- The app already uses Redux Toolkit.
- You want endpoint definitions, generated hooks, and cache invalidation tied to Redux.
- You prefer tags and API slices as the data access model.

Use TanStack Query when:

- You want server-state caching without Redux.
- Query keys, stale data, background refetching, retries, and mutations are central to the app.
- You want to keep transport code separate from server-state behavior.

The best answer in an interview is rarely "always use X." A better answer explains the app size, team conventions, cache complexity, authentication model, and operational needs.

### Error Normalization

A strong API client returns or throws predictable errors. Components should not need to know every backend error shape.

Example:

```ts
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

async function parseError(response: Response) {
  const body = await response.json().catch(() => undefined);

  return new ApiClientError(
    body?.message ?? `Request failed with status ${response.status}`,
    response.status,
    body,
  );
}
```

This makes UI code simpler:

```tsx
if (error instanceof ApiClientError && error.status === 401) {
  return <SignInExpiredMessage />;
}
```

Error normalization is especially important when an app mixes REST endpoints, generated clients, and third-party APIs.

### Authentication Headers and Credentials

Centralized clients commonly attach auth data, but this must be done carefully.

For bearer tokens:

- Attach the `Authorization` header only to trusted API origins.
- Avoid global defaults that send tokens to third-party domains.
- Keep token lookup close to request time so refreshed tokens are used.
- Avoid logging headers or serialized configs that contain secrets.

For cookie-based auth:

- Configure `credentials` for `fetch` only when needed.
- Configure Axios `withCredentials` only for trusted cross-origin APIs.
- Account for `SameSite`, CORS, CSRF, and secure cookie settings.

Example:

```ts
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});
```

The key interview point: auth belongs in the client boundary, but security decisions belong in the full request model, including browser storage, cookies, CORS, CSRF, token refresh, and logging.

### Cancellation and Race Conditions

Cancellation prevents stale or irrelevant requests from updating the UI.

Common cases:

- Search input changes while an old request is still in flight.
- A component unmounts before the request completes.
- A route changes while a loader or query is still running.
- A user clicks a different entity before the previous details request returns.

With `fetch`, use `AbortController`. With Axios, use the `signal` option. With TanStack Query and RTK Query, understand how the library cancels or ignores stale requests and how query keys affect request identity.

Example:

```ts
export async function searchUsers(term: string, signal?: AbortSignal) {
  return apiFetch<User[]>(`/users?search=${encodeURIComponent(term)}`, {
    signal,
  });
}
```

Cancellation is not only a performance feature. It prevents incorrect UI state.

### Type Safety and Runtime Validation

TypeScript types help callers understand expected request and response shapes, but TypeScript does not validate runtime JSON from a server.

Options:

- Use TypeScript interfaces for internal contracts where the API is trusted.
- Use schema validation for high-risk boundaries.
- Generate API clients from OpenAPI when contracts are stable.
- Normalize response DTOs before the UI consumes them.

Example:

```ts
type UserDto = {
  id: string;
  displayName: string;
};

type UserViewModel = {
  id: string;
  name: string;
};

function mapUser(dto: UserDto): UserViewModel {
  return {
    id: dto.id,
    name: dto.displayName,
  };
}
```

Do not let backend DTO quirks leak into every component. Map at the boundary when the UI model differs from the API model.

### Testing Centralized API Clients

Centralization improves testability.

Useful tests:

- Unit tests for URL construction and error normalization.
- Integration tests with mocked network responses.
- Tests that verify auth headers are scoped correctly.
- Tests for retries and timeout behavior.
- Tests for cache invalidation after mutations.

Example test target:

```ts
await expect(apiFetch("/missing")).rejects.toMatchObject({
  status: 404,
  message: "Not found",
});
```

Avoid tests that mock the entire data-fetching library for every component. Prefer testing feature behavior and using network-level mocks when possible.

### Common Mistakes

Common mistakes include:

- Calling `fetch` and forgetting that HTTP `500` does not reject automatically.
- Putting every endpoint in one massive client file.
- Sending auth headers through global Axios defaults to multiple domains.
- Duplicating server data in local React state after using TanStack Query or RTK Query.
- Using both RTK Query and TanStack Query for the same data without a clear reason.
- Retrying non-idempotent mutations blindly.
- Swallowing errors in the client and leaving UI stuck in loading state.
- Creating new query keys or client instances on every render.
- Hiding request cancellation so callers cannot pass an `AbortSignal`.

### Best Practices

Best practices include:

- Create a small shared transport client.
- Keep endpoint-specific functions close to their feature.
- Normalize errors once.
- Scope credentials and headers to trusted API origins.
- Use stable query keys.
- Use server-state libraries for cache-heavy UI instead of hand-rolled state.
- Keep mutation invalidation explicit.
- Pass cancellation signals through the stack.
- Avoid leaking backend DTO shapes into every component.
- Log enough context to debug failures without logging secrets.
- Prefer boring, predictable behavior over clever abstractions.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a centralized API client in a React application?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q01 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A centralized API client is a shared module or set of modules that handles common server communication behavior. It usually manages base URLs, headers, JSON parsing, error handling, authentication, cancellation, and sometimes retries. Components call service functions or generated hooks instead of duplicating raw HTTP code.

The goal is consistency. If every component builds requests and parses errors differently, the app becomes harder to maintain and harder to debug.

##### Key Points to Mention

- It creates one consistent boundary for backend communication.
- It avoids repeated `fetch` or Axios setup in components.
- It should normalize errors and response handling.
- It can be lightweight or built around RTK Query or TanStack Query.
- It should not become a giant unrelated endpoint file.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q01 -->

#### Why should components avoid duplicating low-level HTTP logic?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q02 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Duplicated HTTP logic leads to inconsistent behavior. One component may check response status, another may forget. One screen may attach auth headers correctly, another may not. Error messages, timeouts, and loading states drift over time.

Keeping low-level HTTP logic in a shared client lets components focus on UI behavior and feature intent.

##### Key Points to Mention

- Reduces repetition.
- Improves consistency.
- Makes auth and error behavior easier to audit.
- Makes tests simpler.
- Keeps components focused on rendering and interaction.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q02 -->

#### What is an important difference between `fetch` and Axios error handling?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q03 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`fetch` rejects for network-level failures, but it does not reject simply because the server returns an HTTP error status such as `404` or `500`. The caller must check `response.ok` or `response.status`.

Axios rejects promises for responses outside its successful status range by default, and it provides an error object with response, request, config, code, and status information.

##### Key Points to Mention

- `fetch` needs explicit status checks.
- Axios rejects on non-2xx responses by default.
- Axios error objects are structured.
- Both clients still need application-level error normalization.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q03 -->

#### What is server state?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q04 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Server state is data owned by a backend system but displayed or edited by the frontend. It can become stale, can be shared by many screens, may need refetching, and often has loading, error, and mutation states.

Examples include users, orders, permissions, invoices, notifications, and search results. Libraries like RTK Query and TanStack Query are designed to manage server state better than raw `useState` and `useEffect` in many applications.

##### Key Points to Mention

- Server state is remote and asynchronous.
- It can become stale.
- Multiple components may depend on the same data.
- It needs caching, refetching, and invalidation.
- It is different from local UI state.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When would you choose a simple `fetch` wrapper instead of TanStack Query or RTK Query?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q01 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

A simple `fetch` wrapper is reasonable when the application has limited server communication, minimal cache needs, and no complex cross-screen server-state coordination. It can handle base URLs, headers, response parsing, error normalization, and cancellation without adding a larger library.

If the app later needs request deduplication, stale data handling, background refetching, pagination, optimistic updates, and mutation invalidation, a server-state library becomes more attractive.

##### Key Points to Mention

- Use the simplest tool that meets the real requirements.
- A wrapper is good for transport consistency.
- It does not solve caching or invalidation by itself.
- Route loaders may also reduce the need for component-level fetching.
- Reevaluate when server-state complexity grows.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q01 -->

#### How do RTK Query and TanStack Query differ conceptually?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q02 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

RTK Query is part of Redux Toolkit. It defines API slices with endpoints, generates hooks, stores cache state in Redux, and uses tags for invalidation. It is a natural fit when the app already uses Redux Toolkit or wants API definitions integrated with Redux infrastructure.

TanStack Query is a standalone server-state library. It works with any promise-returning function and organizes data around query keys. It manages caching, stale data, retries, refetching, mutations, and invalidation without requiring Redux.

##### Key Points to Mention

- RTK Query integrates with Redux Toolkit.
- TanStack Query is framework-level server-state management without Redux.
- RTK Query uses API slices and generated hooks.
- TanStack Query uses query keys and query functions.
- Both need a reliable HTTP function underneath.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q02 -->

#### How should an API client handle authentication headers?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q03 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Authentication headers should be attached in a centralized place, but scoped carefully. A bearer token should only be sent to trusted API origins. The client should retrieve the token close to request time so refreshed tokens are used. It should avoid global defaults that might send credentials to third-party APIs.

For cookie-based auth, the client must configure credentials only when needed and account for CORS, secure cookie flags, SameSite behavior, and CSRF protections.

##### Key Points to Mention

- Scope auth headers to a trusted `baseURL`.
- Avoid leaking tokens through global defaults.
- Use request-time token lookup.
- Do not log secrets.
- Cookie auth changes CSRF and CORS considerations.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q03 -->

#### Why is error normalization useful?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q04 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Error normalization converts different failure shapes into a predictable application-level format. Backends may return different JSON error bodies, network failures may not have a response, and parsing can fail. Without normalization, every component needs custom checks.

A normalized error might include status, code, message, validation details, retryability, and correlation ID. This makes UI behavior, logging, and tests more consistent.

##### Key Points to Mention

- Components should not parse every backend error format.
- Normalized errors make UX decisions simpler.
- Include enough information for logging and support.
- Preserve useful details without exposing secrets.
- Distinguish network errors, HTTP errors, validation errors, and auth errors.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design API client boundaries for a large React application?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q01 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would separate transport concerns from feature endpoint concerns. A shared client would handle base URL, headers, auth, timeout, cancellation, parsing, and error normalization. Feature modules would own their endpoint functions or query definitions. Server-state hooks would live near the feature that uses them, using RTK Query or TanStack Query if caching and invalidation are important.

For multiple backend services, I would use separate clients or instances so credentials, timeouts, and interceptors do not leak across service boundaries. I would also define a shared error model and testing strategy.

##### Key Points to Mention

- Shared transport client.
- Feature-owned endpoint modules.
- Separate instances per backend or credential boundary.
- Typed DTOs and mapping where useful.
- Server-state library for caching and invalidation.
- Tests for auth scoping, errors, and retries.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q01 -->

#### What are the risks of mixing multiple API client patterns in one app?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q02 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Mixing patterns can be fine during migration, but it creates risks if there is no boundary. The app may fetch the same data through raw Axios in one screen, TanStack Query in another, and RTK Query elsewhere. That can lead to duplicate requests, inconsistent cache invalidation, different error handling, different auth behavior, and confusing loading states.

If multiple patterns are necessary, each should have a clear ownership rule. For example, RTK Query owns legacy Redux-backed APIs, TanStack Query owns new server-state features, and a shared Axios instance remains the low-level transport.

##### Key Points to Mention

- Duplicate caches are a major risk.
- Error and auth behavior can drift.
- Migration periods need explicit rules.
- Avoid two libraries owning the same resource.
- Keep one shared transport behavior when possible.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q02 -->

#### How do you prevent stale or incorrect UI after API mutations?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q03 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

After a mutation, the app must update or invalidate affected server state. In TanStack Query, this often means invalidating query keys or updating cached data from the mutation response. In RTK Query, this often means using tags with `providesTags` and `invalidatesTags`. With a raw client, the app must manually refetch or update local state.

The right approach depends on the mutation. If the server response is authoritative and contains the updated entity, direct cache update can be efficient. If many lists or derived views may be affected, invalidation and refetching can be safer.

##### Key Points to Mention

- Mutations must coordinate with cached reads.
- Invalidate broadly enough to prevent stale UI.
- Direct cache updates are fast but must be correct.
- Server response is often the safest source of truth.
- Avoid duplicating server state in unrelated local state.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q03 -->

#### How would you evaluate whether to introduce TanStack Query or RTK Query to an existing app?

<!-- question:start:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q04 -->
<!-- question-id:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would look at the current pain points: duplicated loading states, repeated requests, stale data bugs, manual cache management, optimistic update complexity, pagination, background refetching, and inconsistent error handling. If those problems are common, a server-state library is likely worth it.

Then I would consider existing architecture. If the app already uses Redux Toolkit heavily, RTK Query may fit naturally. If it does not, TanStack Query may be simpler. I would introduce it feature by feature, avoid double-owning the same data, and define conventions for query keys, mutations, errors, and invalidation.

##### Key Points to Mention

- Start from real pain, not library fashion.
- Consider whether Redux Toolkit is already central.
- Introduce incrementally.
- Define conventions early.
- Avoid migrating everything at once.
- Measure bundle, complexity, and team familiarity trade-offs.

<!-- question:end:centralized-api-clients-with-fetch-axios-rtk-query-or-tanstack-query-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
