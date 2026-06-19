---
id: rtk-query-custom-base-queries-including-axios-based-basequery-patterns
topic: Production data access, API clients, and frontend auth
subtopic: RTK Query custom base queries, including Axios-based baseQuery patterns
category: React
---

## Overview

RTK Query custom base queries let a React application control how requests are executed while still using RTK Query for generated hooks, caching, loading states, mutation states, invalidation, polling, and request lifecycle behavior.

In most RTK Query APIs, endpoints define a `query` value and RTK Query passes that value to a shared `baseQuery`. The default choice is usually `fetchBaseQuery`, a lightweight wrapper around `fetch`. When an app needs different transport behavior, such as Axios, GraphQL, automatic reauthorization, custom error normalization, dynamic base URLs, or retry policies, it can wrap `fetchBaseQuery` or provide a fully custom `baseQuery`.

This topic matters in production React apps because the API layer is where authentication, cancellation, error shape, cache behavior, and feature boundaries meet. A weak implementation can break caching, duplicate refresh calls, leak auth headers, or leave query hooks stuck in the wrong state.

For interviews, this topic tests whether a candidate understands RTK Query's core contract: a base query is not just a request helper. It is the adapter between the transport layer and RTK Query's cache and hook state machine.

## Core Concepts

### The Role of `baseQuery`

`baseQuery` is the shared request executor used by an RTK Query API slice.

Endpoint definitions describe what to request:

```ts
getUser: build.query<User, string>({
  query: (userId) => `/users/${userId}`,
});
```

The `baseQuery` decides how to execute that request:

```ts
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (build) => ({
    getUser: build.query<User, string>({
      query: (userId) => `/users/${userId}`,
    }),
  }),
});
```

This split is important. Endpoint code should stay focused on feature intent. The base query handles shared transport behavior such as base URL, headers, response parsing, auth, timeout, and error conversion.

### The Required Return Shape

RTK Query base queries and `queryFn` functions must return one of these shapes:

```ts
return { data: value };
```

or:

```ts
return { error: errorValue };
```

They should not let transport errors escape as unhandled thrown exceptions.

Bad:

```ts
const brokenBaseQuery = async () => {
  const response = await fetch("/api/users");
  const data = await response.json();
  return { data };
};
```

Better:

```ts
const safeBaseQuery = async () => {
  try {
    const response = await fetch("/api/users");

    if (!response.ok) {
      return {
        error: {
          status: response.status,
          data: await response.json().catch(() => null),
        },
      };
    }

    return { data: await response.json() };
  } catch (error) {
    return {
      error: {
        status: "CUSTOM_ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};
```

This contract allows RTK Query to track `isLoading`, `isError`, cached errors, retries, and hook state correctly.

### `fetchBaseQuery`

`fetchBaseQuery` is RTK Query's built-in base query for HTTP APIs. It is intentionally small and similar to a lightweight `fetch` wrapper.

Common features:

- `baseUrl` for relative endpoint paths.
- `prepareHeaders` for common headers.
- Automatic JSON body handling.
- Response parsing.
- Error objects with status and data.
- Optional timeout.
- Access to `signal`, `dispatch`, and `getState`.
- Support for custom parameter serialization.

Example:

```ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../store";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;

      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }

      return headers;
    },
  }),
  endpoints: () => ({}),
});
```

`prepareHeaders` is a good place for common auth headers because it runs at request time and can read current Redux state.

### When `fetchBaseQuery` Is Enough

Use `fetchBaseQuery` when the app needs normal REST-style HTTP behavior:

- JSON requests and responses.
- Basic auth header preparation.
- Relative endpoint paths.
- Standard status-based error handling.
- Simple timeout behavior.
- RTK Query cache and invalidation features.

Example endpoint:

```ts
type Product = {
  id: string;
  name: string;
};

export const productsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProduct: build.query<Product, string>({
      query: (id) => `/products/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Product", id }],
    }),
  }),
});
```

Do not create a custom base query only because it feels more architectural. A custom base query is useful when it solves a real transport or cross-cutting behavior problem.

### Why Create a Custom Base Query

Custom base queries are useful when the app needs:

- Axios instead of `fetch`.
- GraphQL request handling.
- A third-party SDK.
- A non-HTTP async source.
- Automatic token refresh.
- A shared retry policy.
- Dynamic base URLs from Redux state.
- Custom request metadata.
- Custom error normalization.
- Special response parsing.
- Cross-service routing.

The main rule: keep the base query generic. Endpoint-specific logic usually belongs in endpoint definitions, `transformResponse`, `transformErrorResponse`, or `queryFn`.

### Axios-Based `baseQuery`

An Axios-based base query lets an RTK Query API use Axios for transport while preserving RTK Query's `{ data }` / `{ error }` contract.

Example:

```ts
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import axios from "axios";
import type { AxiosError, AxiosRequestConfig } from "axios";

type AxiosBaseQueryArgs = {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: AxiosRequestConfig["data"];
  params?: AxiosRequestConfig["params"];
  headers?: AxiosRequestConfig["headers"];
};

type AxiosBaseQueryError = {
  status?: number;
  data: unknown;
};

export const axiosBaseQuery =
  (
    { baseUrl }: { baseUrl: string } = { baseUrl: "" },
  ): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async ({ url, method = "GET", data, params, headers }, { signal }) => {
    try {
      const result = await axios({
        url: baseUrl + url,
        method,
        data,
        params,
        headers,
        signal,
      });

      return { data: result.data };
    } catch (axiosError) {
      const error = axiosError as AxiosError;

      return {
        error: {
          status: error.response?.status,
          data: error.response?.data ?? error.message,
        },
      };
    }
  };
```

Then use it in `createApi`:

```ts
export const api = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["User"],
  endpoints: (build) => ({
    getUser: build.query<User, string>({
      query: (id) => ({ url: `/users/${id}` }),
      providesTags: (_result, _error, id) => [{ type: "User", id }],
    }),
    updateUser: build.mutation<User, Partial<User> & Pick<User, "id">>({
      query: ({ id, ...patch }) => ({
        url: `/users/${id}`,
        method: "PATCH",
        data: patch,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "User", id }],
    }),
  }),
});
```

The important detail is that Axios errors are caught and converted into the RTK Query error shape.

### Using a Configured Axios Instance

In production, teams often use a configured Axios instance instead of calling `axios` directly.

Example:

```ts
export const http = axios.create({
  baseURL: "/api",
  timeout: 10_000,
  headers: {
    Accept: "application/json",
  },
});
```

Base query:

```ts
export const axiosInstanceBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async ({ url, method = "GET", data, params, headers }, { signal }) => {
    try {
      const result = await http.request({
        url,
        method,
        data,
        params,
        headers,
        signal,
      });

      return { data: result.data };
    } catch (axiosError) {
      const error = axiosError as AxiosError;

      return {
        error: {
          status: error.response?.status,
          data: error.response?.data ?? error.message,
        },
      };
    }
  };
```

This allows the app to reuse Axios timeouts, interceptors, base URL, and other defaults. The trade-off is that interceptor behavior becomes part of the RTK Query transport boundary and must be easy to reason about.

### Cancellation and `signal`

RTK Query passes an `AbortSignal` to `baseQuery`. A good custom base query forwards that signal to the underlying transport.

With `fetchBaseQuery`, this is handled internally. With Axios, pass `signal`:

```ts
const result = await http.request({
  url,
  method,
  data,
  params,
  signal,
});
```

This matters when:

- A component unmounts.
- Query arguments change.
- A request is no longer needed.
- RTK Query cancels an in-flight subscription.

Ignoring cancellation can waste network resources and allow stale responses to create confusing behavior.

### Auth Headers with `prepareHeaders`

For `fetchBaseQuery`, use `prepareHeaders` to attach common headers:

```ts
const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders: (headers, { getState }) => {
    const token = selectAccessToken(getState() as RootState);

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    return headers;
  },
});
```

For Axios-based base queries, there are two common approaches:

- Set headers inside the base query using `getState`.
- Use a scoped Axios request interceptor.

Base query approach:

```ts
export const axiosBaseQueryWithAuth =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async (args, { getState, signal }) => {
    const token = selectAccessToken(getState() as RootState);

    return axiosBaseQuery({ baseUrl: "/api" })(
      {
        ...args,
        headers: {
          ...args.headers,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
      { getState, signal } as never,
      {},
    );
  };
```

In real code, avoid awkward casts by composing the shared request logic cleanly. The interview point is that auth headers should be scoped to the intended API and read at request time.

### Automatic Reauthorization with `fetchBaseQuery`

A common pattern is wrapping `fetchBaseQuery` to refresh tokens after a `401 Unauthorized`, then retry the original request.

```ts
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders: (headers, { getState }) => {
    const token = selectAccessToken(getState() as RootState);

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    return headers;
  },
});

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshResult = await rawBaseQuery(
      { url: "/auth/refresh", method: "POST" },
      api,
      extraOptions,
    );

    if (refreshResult.data) {
      api.dispatch(tokenReceived(refreshResult.data as AuthTokens));
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(loggedOut());
    }
  }

  return result;
};
```

This pattern is simple, but by itself it can create multiple simultaneous refresh calls when several requests fail with `401` at the same time.

### Refresh Token Queue or Mutex Pattern

When many queries fail with `401` together, only one refresh request should run. Other failed requests should wait, then retry with the refreshed token.

Example with a mutex:

```ts
import { Mutex } from "async-mutex";

const mutex = new Mutex();

export const baseQueryWithReauthQueue: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();

  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();

      try {
        const refreshResult = await rawBaseQuery(
          { url: "/auth/refresh", method: "POST" },
          api,
          extraOptions,
        );

        if (refreshResult.data) {
          api.dispatch(tokenReceived(refreshResult.data as AuthTokens));
          result = await rawBaseQuery(args, api, extraOptions);
        } else {
          api.dispatch(loggedOut());
        }
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};
```

This avoids a refresh storm. It also prevents race conditions where an older refresh response overwrites a newer token.

### Axios-Based Reauthorization

You can implement reauth inside an Axios-based base query, but the same rules apply:

- Return `{ data }` or `{ error }`.
- Retry the original request only once.
- Avoid refreshing for the refresh endpoint itself.
- Coordinate concurrent refresh attempts.
- Update stored tokens before retrying.
- Preserve cancellation behavior.

Example:

```ts
let refreshPromise: Promise<AuthTokens> | null = null;

export const axiosBaseQueryWithReauth =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async (args, api) => {
    const runRequest = async () => {
      const token = selectAccessToken(api.getState() as RootState);

      return http.request({
        url: args.url,
        method: args.method ?? "GET",
        data: args.data,
        params: args.params,
        headers: {
          ...args.headers,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });
    };

    try {
      const response = await runRequest();
      return { data: response.data };
    } catch (firstError) {
      const error = firstError as AxiosError;

      if (error.response?.status !== 401 || args.url === "/auth/refresh") {
        return toRtkQueryError(error);
      }

      try {
        refreshPromise ??= refreshTokens();
        const tokens = await refreshPromise;
        api.dispatch(tokenReceived(tokens));

        const retryResponse = await runRequest();
        return { data: retryResponse.data };
      } catch (refreshOrRetryError) {
        api.dispatch(loggedOut());
        return toRtkQueryError(refreshOrRetryError as AxiosError);
      } finally {
        refreshPromise = null;
      }
    }
  };

function toRtkQueryError(error: AxiosError): { error: AxiosBaseQueryError } {
  return {
    error: {
      status: error.response?.status,
      data: error.response?.data ?? error.message,
    },
  };
}
```

In many teams, this logic is cleaner in a shared Axios interceptor. In RTK Query, keeping it in `baseQuery` can be easier to test and easier to connect to Redux auth state.

### `queryFn` vs Custom `baseQuery`

Use `baseQuery` when the behavior is common to most endpoints in the API slice.

Use `queryFn` when one endpoint has special behavior.

Example `queryFn`:

```ts
getCombinedProfile: build.query<CombinedProfile, string>({
  async queryFn(userId, _api, _extraOptions, baseQuery) {
    const userResult = await baseQuery(`/users/${userId}`);

    if (userResult.error) {
      return { error: userResult.error };
    }

    const permissionsResult = await baseQuery(`/users/${userId}/permissions`);

    if (permissionsResult.error) {
      return { error: permissionsResult.error };
    }

    return {
      data: {
        user: userResult.data as User,
        permissions: permissionsResult.data as Permission[],
      },
    };
  },
});
```

This avoids complicating the global base query for one endpoint.

### `transformResponse` and `transformErrorResponse`

Use endpoint-level transforms when only one endpoint needs a different data or error shape.

```ts
getUsers: build.query<User[], void>({
  query: () => "/users",
  transformResponse: (response: { items: UserDto[] }) =>
    response.items.map(mapUserDto),
  transformErrorResponse: (response: { status: number; data: ApiErrorBody }) => ({
    status: response.status,
    message: response.data.message,
  }),
});
```

This keeps base query behavior generic while allowing endpoint-specific normalization.

### Automatic Retries

RTK Query provides retry utilities that can wrap a base query. Retry is useful for transient failures but dangerous when applied blindly.

Example:

```ts
import { retry } from "@reduxjs/toolkit/query/react";

const staggeredBaseQuery = retry(
  fetchBaseQuery({ baseUrl: "/api" }),
  { maxRetries: 2 },
);
```

Good retry candidates:

- Network timeouts.
- `408 Request Timeout`.
- `429 Too Many Requests`, ideally respecting server retry guidance.
- Temporary `5xx` failures.
- Idempotent reads.

Bad retry candidates:

- Validation errors.
- `401` before refresh logic is considered.
- `403 Forbidden`.
- Most non-idempotent mutations unless protected by idempotency keys.

Interviewers often look for this nuance. "Retry everything" is not a production-safe answer.

### Dynamic Base URLs

Sometimes the base URL depends on tenant, region, environment, or user selection.

Example:

```ts
const dynamicBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> =
  async (args, api, extraOptions) => {
    const state = api.getState() as RootState;
    const region = selectActiveRegion(state);
    const baseUrl = `/api/${region}`;

    const rawBaseQuery = fetchBaseQuery({ baseUrl });
    return rawBaseQuery(args, api, extraOptions);
  };
```

Be careful not to create confusing cache keys. If the same endpoint argument can return different data based on region or tenant, include that context in the query arg or endpoint design so cache entries do not collide.

### Error Shape Design

A base query should return errors that are easy for UI code to interpret.

Useful fields:

- `status`.
- `message`.
- `code`.
- `details`.
- `correlationId`.
- `isNetworkError`.
- `isAuthError`.
- `isRetryable`.

Example:

```ts
type ApiError = {
  status?: number | string;
  message: string;
  details?: unknown;
};
```

Do not throw away useful server details, but do not expose secrets or raw stack traces to UI code.

### Common Mistakes

Common mistakes include:

- Throwing from a custom base query instead of returning `{ error }`.
- Forgetting to forward `signal` to Axios or `fetch`.
- Returning inconsistent error shapes.
- Putting endpoint-specific business logic in the global base query.
- Creating multiple API slices with duplicate caches for the same resource.
- Retrying unsafe mutations automatically.
- Refreshing tokens on every `401` without a mutex or queue.
- Retrying the refresh endpoint and creating an infinite loop.
- Ignoring tenant or region in cache identity.
- Hiding too much behavior behind Axios interceptors and making RTK Query hard to debug.

### Best Practices

Best practices include:

- Prefer `fetchBaseQuery` until custom behavior is clearly needed.
- Keep base queries small and generic.
- Always return `{ data }` or `{ error }`.
- Normalize errors once.
- Forward cancellation signals.
- Attach auth headers at request time.
- Use mutex or queue behavior for token refresh.
- Use `queryFn` for endpoint-specific async workflows.
- Use `transformResponse` and `transformErrorResponse` for endpoint-specific mapping.
- Keep cache tags and invalidation explicit.
- Test success, HTTP error, network error, cancellation, refresh success, refresh failure, and concurrent `401` cases.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a `baseQuery` in RTK Query?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q01 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A `baseQuery` is the shared request function used by an RTK Query API slice. Endpoint definitions return arguments such as a URL or request object, and RTK Query passes those arguments to the `baseQuery`.

The `baseQuery` handles the actual request and must return either `{ data }` for success or `{ error }` for failure. This lets RTK Query update generated hook state, cache entries, and errors consistently.

##### Key Points to Mention

- It is configured on `createApi`.
- It executes endpoint `query` output.
- It can use `fetch`, Axios, GraphQL, or another async source.
- It must return `{ data }` or `{ error }`.
- It is the transport adapter for RTK Query.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q01 -->

#### What is `fetchBaseQuery`?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q02 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`fetchBaseQuery` is RTK Query's built-in lightweight wrapper around `fetch`. It handles common HTTP behavior such as a base URL, request headers, JSON parsing, and status-based error results.

It is usually the default choice for REST-style APIs unless the application needs Axios, GraphQL, custom reauthorization, dynamic base URLs, or other specialized behavior.

##### Key Points to Mention

- Built into RTK Query.
- Works well for normal HTTP APIs.
- Supports `prepareHeaders`.
- Returns RTK Query-compatible success and error shapes.
- Can be wrapped for custom behavior.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q02 -->

#### Why must a custom base query catch errors?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q03 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A custom base query should catch transport errors and return them as `{ error }` so RTK Query can track the failed request. If errors escape unexpectedly, the query lifecycle may not have the predictable error shape that generated hooks and cache logic expect.

Returning `{ error }` allows the hook to expose fields such as `isError` and `error` consistently.

##### Key Points to Mention

- RTK Query expects `{ data }` or `{ error }`.
- Uncaught errors break predictable hook state.
- Error shape should be consistent.
- Axios errors need conversion.
- Network errors and HTTP errors should both be handled.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q03 -->

#### What is an Axios-based base query?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q04 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

An Axios-based base query is a custom RTK Query `baseQuery` that uses Axios to perform HTTP requests. It maps endpoint arguments to an Axios request config, returns `result.data` as `{ data }`, and catches Axios errors to return `{ error }`.

It is useful when a team already uses Axios features such as configured instances, interceptors, timeouts, or custom error behavior.

##### Key Points to Mention

- It wraps Axios inside RTK Query's base query contract.
- It should catch `AxiosError`.
- It should return `response.data` as data.
- It should map `error.response?.status` and `error.response?.data`.
- It should forward cancellation when possible.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When should you write a custom base query instead of using `fetchBaseQuery`?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q01 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would write a custom base query when the default `fetchBaseQuery` no longer matches the transport needs. Examples include using Axios, GraphQL, a third-party SDK, dynamic base URLs, custom error normalization, automatic reauthorization, or a shared retry policy.

If the app only needs base URL, JSON parsing, and common headers, `fetchBaseQuery` is usually enough.

##### Key Points to Mention

- Use custom behavior for real transport needs.
- Do not customize just for style.
- Wrapping `fetchBaseQuery` is often enough.
- Use `queryFn` for one-off endpoint behavior.
- Keep custom base queries generic.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q01 -->

#### How do you attach auth headers in RTK Query?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q02 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

With `fetchBaseQuery`, I would use `prepareHeaders`. It receives the headers object and an API object that includes `getState`, so it can read the current access token from Redux state and set the `Authorization` header.

With an Axios-based base query, I could add headers inside the base query or use a scoped Axios interceptor. In either case, the token should be read at request time and only sent to trusted API origins.

##### Key Points to Mention

- Use `prepareHeaders` for `fetchBaseQuery`.
- Read token from `getState`.
- Attach `Authorization: Bearer <token>`.
- Scope headers to the intended API.
- Avoid stale tokens and global leaks.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q02 -->

#### What is the difference between `baseQuery` and `queryFn`?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q03 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`baseQuery` is shared by the API slice and handles common request execution. `queryFn` is endpoint-specific and lets one endpoint run custom async logic while still returning `{ data }` or `{ error }`.

Use `baseQuery` for common transport behavior. Use `queryFn` for special endpoint workflows such as combining multiple requests, calling a third-party SDK, or implementing unique error handling for one endpoint.

##### Key Points to Mention

- `baseQuery` is shared.
- `queryFn` is endpoint-specific.
- Both must return `{ data }` or `{ error }`.
- `queryFn` can call the provided `baseQuery`.
- Avoid bloating the global base query for one endpoint.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q03 -->

#### How should an Axios base query handle cancellation?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q04 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

RTK Query passes an `AbortSignal` to the base query. An Axios-based base query should pass that signal into the Axios request config. This allows RTK Query to cancel requests when components unmount, query arguments change, or subscriptions are removed.

Ignoring the signal can waste network work and may allow stale requests to finish after they are no longer relevant.

##### Key Points to Mention

- The base query receives `signal`.
- Axios supports `signal` in request config.
- Cancellation prevents stale or unnecessary requests.
- It matters for search, route changes, and unmounts.
- Cancellation should be tested.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you implement token refresh in an RTK Query base query?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q01 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would wrap the normal base query. First, run the original request. If it returns a `401`, call the refresh endpoint. If refresh succeeds, store the new token and retry the original request once. If refresh fails, dispatch a logout or session-expired action and return the error.

For production, I would prevent multiple simultaneous refresh requests with a mutex or shared refresh promise. I would also skip refresh logic for the refresh endpoint itself to avoid loops.

##### Key Points to Mention

- Wrap the normal base query.
- Detect `401`.
- Refresh once.
- Store new token before retrying.
- Retry the original request.
- Use mutex or queue for concurrent failures.
- Logout when refresh fails.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q01 -->

#### Why is a mutex or queue useful for RTK Query reauthorization?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q02 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

When an access token expires, several active queries may fail with `401` at almost the same time. Without coordination, each failed request may call the refresh endpoint. That creates a refresh storm and can cause token rotation races.

A mutex or queue allows one request to refresh the token while the others wait. Once the token is updated, waiting requests retry with the new token.

##### Key Points to Mention

- Multiple queries can fail together.
- Only one refresh request should run.
- Other requests should wait.
- Prevents refresh storms.
- Prevents token rotation race conditions.
- Waiting requests retry after token update.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q02 -->

#### What are the trade-offs of using Axios interceptors inside an RTK Query Axios base query?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q03 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Axios interceptors can centralize auth headers, logging, error normalization, and retry behavior. This can be useful if the same Axios instance is used outside RTK Query. The risk is that important behavior becomes hidden from RTK Query endpoint code and can conflict with RTK Query's own retry, error, and cache lifecycle.

If interceptors are used, they should be scoped to the Axios instance, registered once, avoid swallowing errors, and still allow the base query to return RTK Query-compatible `{ data }` or `{ error }` values.

##### Key Points to Mention

- Interceptors can reduce duplication.
- Hidden retries can confuse RTK Query behavior.
- Errors must still be returned correctly.
- Scope interceptors to an instance.
- Avoid duplicate retry logic in both Axios and RTK Query.
- Keep behavior testable.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q03 -->

#### How would you design error handling for a custom RTK Query base query?

<!-- question:start:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q04 -->
<!-- question-id:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would define one predictable error shape for the API slice. It should include status, message, optional details, and possibly flags such as `isNetworkError`, `isAuthError`, or `isRetryable`. The base query should convert transport errors into that shape without losing useful server details.

Endpoint-specific error mapping can use `transformErrorResponse`. Feature UI should not need to understand Axios internals, `fetch` parsing errors, and backend-specific error bodies all at once.

##### Key Points to Mention

- Normalize errors once.
- Preserve status and useful details.
- Avoid exposing secrets.
- Use endpoint transforms for endpoint-specific mapping.
- Keep UI code independent of Axios or `fetch` internals.
- Test network, HTTP, parsing, auth, and cancellation errors.

<!-- question:end:rtk-query-custom-base-queries-including-axios-based-basequery-patterns-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
