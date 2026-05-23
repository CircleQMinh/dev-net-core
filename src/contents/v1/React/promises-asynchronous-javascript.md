---
id: promises-asynchronous-javascript
topic: JavaScript fundamentals
subtopic: Promises and asynchronous JavaScript
category: React
---

# Promises and asynchronous JavaScript

## Overview

Promises and asynchronous JavaScript are fundamental to modern web development. JavaScript runs application code on a single main thread in the browser, but real applications constantly need to do work that takes time: calling APIs, reading files, waiting for timers, loading images, handling user events, or performing background operations. Asynchronous programming allows JavaScript to start these operations without blocking the whole page.

A **Promise** is a JavaScript object that represents the eventual completion or failure of an asynchronous operation and its resulting value. It lets code attach success and failure handlers instead of deeply nesting callbacks. `async` and `await` are syntax built on top of Promises that make asynchronous code easier to read and reason about.

This topic is especially important for React developers because React applications frequently fetch data, submit forms, debounce user input, run multiple API calls, handle loading/error states, cancel stale requests, and coordinate UI updates after asynchronous work. Many production bugs in React applications come from misunderstanding Promises, stale async results, race conditions, missing error handling, or incorrect `useEffect` cleanup.

For interviews, this topic matters because it tests whether a developer understands more than basic syntax. A strong candidate should be able to explain:

- What asynchronous JavaScript means.
- How Promises work.
- The difference between pending, fulfilled, and rejected Promise states.
- How `.then`, `.catch`, and `.finally` work.
- How `async` and `await` relate to Promises.
- How error handling works with asynchronous code.
- The difference between sequential and parallel async execution.
- How `Promise.all`, `Promise.allSettled`, `Promise.race`, and `Promise.any` differ.
- How the event loop, tasks, and microtasks affect execution order.
- How to avoid common bugs such as unhandled rejections, accidental sequential calls, and stale React state updates.

The practical goal is to write asynchronous code that is readable, reliable, cancellable where needed, and safe for real user interfaces.

## Core Concepts

### Synchronous vs asynchronous JavaScript

Synchronous code runs line by line. Each statement must finish before the next statement runs.

```js
console.log("A");
console.log("B");
console.log("C");
```

Output:

```text
A
B
C
```

Asynchronous code starts an operation that will complete later. JavaScript can continue running other code while waiting.

```js
console.log("A");

setTimeout(() => {
  console.log("B");
}, 1000);

console.log("C");
```

Output:

```text
A
C
B
```

The timer callback runs later. JavaScript does not block the main thread for one second.

In real applications, asynchronous behavior appears in:

- `fetch` API calls.
- Timers such as `setTimeout` and `setInterval`.
- DOM events.
- File operations in Node.js.
- WebSocket messages.
- IndexedDB operations.
- Image and script loading.
- React data fetching.
- Form submissions.
- Authentication flows.
- Background jobs and worker communication.

### Why asynchronous programming matters

JavaScript often runs on the browser's main thread, which also handles user interaction and rendering. If long-running work blocks the main thread, the UI can freeze.

Bad blocking example:

```js
function blockForTooLong() {
  const start = Date.now();

  while (Date.now() - start < 5000) {
    // Blocks the main thread for 5 seconds
  }
}

blockForTooLong();
console.log("Done");
```

During that loop, the browser cannot respond smoothly to clicks, input, or rendering.

Asynchronous programming helps keep applications responsive by allowing slow operations to complete later while JavaScript continues running other work.

### Callback-based asynchronous code

Before Promises became common, asynchronous JavaScript often used callbacks.

```js
function loadUser(userId, onSuccess, onError) {
  fetch(`/api/users/${userId}`)
    .then(response => response.json())
    .then(user => onSuccess(user))
    .catch(error => onError(error));
}

loadUser(
  42,
  user => {
    console.log(user);
  },
  error => {
    console.error(error);
  }
);
```

Callbacks are still common in event handlers and some older APIs, but deeply nested callbacks can become hard to read.

Example callback nesting:

```js
getUser(userId, user => {
  getOrders(user.id, orders => {
    getOrderItems(orders[0].id, items => {
      console.log(items);
    });
  });
});
```

This is often called "callback hell" or the "pyramid of doom." Promises and `async`/`await` make this easier to structure.

### What is a Promise?

A Promise is an object representing an asynchronous result that may be available now, later, or never if the operation fails or hangs.

A Promise can be in one of three states:

| State | Meaning |
|---|---|
| `pending` | The operation has not completed yet |
| `fulfilled` | The operation completed successfully |
| `rejected` | The operation failed |

A Promise is settled when it is either fulfilled or rejected.

Example:

```js
const promise = fetch("/api/products");

console.log(promise); // Promise object
```

The `fetch` call starts an HTTP request and immediately returns a Promise. The Promise will eventually fulfill with a `Response` or reject if the request fails at the network level.

### Creating a Promise

You can create a Promise with the `Promise` constructor.

```js
function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

delay(1000).then(() => {
  console.log("One second passed");
});
```

The constructor receives an executor function with two callbacks:

- `resolve(value)` fulfills the Promise.
- `reject(error)` rejects the Promise.

Example:

```js
function loadSettings() {
  return new Promise((resolve, reject) => {
    const settings = localStorage.getItem("settings");

    if (!settings) {
      reject(new Error("Settings not found"));
      return;
    }

    resolve(JSON.parse(settings));
  });
}
```

In most application code, you do not need to manually create Promises often. Many modern APIs already return Promises.

### Promise resolution and rejection

A Promise should represent either success or failure.

```js
function getNumber() {
  return new Promise((resolve, reject) => {
    const value = Math.random();

    if (value > 0.5) {
      resolve(value);
    } else {
      reject(new Error("Value was too small"));
    }
  });
}
```

Usage:

```js
getNumber()
  .then(value => {
    console.log("Success:", value);
  })
  .catch(error => {
    console.error("Failed:", error.message);
  });
```

Important behavior:

- A Promise can settle only once.
- Calling `resolve` or `reject` after settlement has no effect.
- Throwing an error inside the Promise executor rejects the Promise.
- Returning a Promise from `.then` chains the asynchronous operation.

### `.then`, `.catch`, and `.finally`

Promises expose methods for handling completion.

#### `.then`

`.then` handles successful fulfillment.

```js
fetch("/api/users/1")
  .then(response => response.json())
  .then(user => {
    console.log(user.name);
  });
```

Each `.then` returns a new Promise, which enables chaining.

```js
getUser()
  .then(user => getOrders(user.id))
  .then(orders => getOrderItems(orders[0].id))
  .then(items => console.log(items));
```

#### `.catch`

`.catch` handles rejection.

```js
fetch("/api/users/1")
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  })
  .then(user => {
    console.log(user);
  })
  .catch(error => {
    console.error("Failed to load user:", error);
  });
```

A `.catch` can handle errors thrown in previous `.then` callbacks.

#### `.finally`

`.finally` runs whether the Promise is fulfilled or rejected.

```js
setLoading(true);

fetch("/api/users/1")
  .then(response => response.json())
  .then(user => {
    setUser(user);
  })
  .catch(error => {
    setError(error);
  })
  .finally(() => {
    setLoading(false);
  });
```

`finally` is useful for cleanup:

- Stop loading indicator.
- Release a lock.
- Close a resource.
- Reset temporary state.

### Promise chaining

Promise chaining lets each step depend on the previous step.

```js
fetch("/api/users/1")
  .then(response => response.json())
  .then(user => {
    return fetch(`/api/orders?userId=${user.id}`);
  })
  .then(response => response.json())
  .then(orders => {
    console.log(orders);
  })
  .catch(error => {
    console.error(error);
  });
```

Important rule:

```text
Return the next Promise from .then if the next step is asynchronous.
```

Bad example:

```js
fetch("/api/users/1")
  .then(response => {
    response.json(); // Missing return
  })
  .then(user => {
    console.log(user); // undefined
  });
```

Correct:

```js
fetch("/api/users/1")
  .then(response => {
    return response.json();
  })
  .then(user => {
    console.log(user);
  });
```

Or shorter:

```js
fetch("/api/users/1")
  .then(response => response.json())
  .then(user => console.log(user));
```

### `async` functions

An `async` function is a function that always returns a Promise.

```js
async function getUser() {
  return { id: 1, name: "Minh" };
}

const result = getUser();

console.log(result); // Promise
```

Even though the function returns a plain object, JavaScript wraps it in a fulfilled Promise.

Equivalent idea:

```js
async function getUser() {
  return { id: 1 };
}

// Similar to:
function getUser() {
  return Promise.resolve({ id: 1 });
}
```

If an `async` function throws an error, the returned Promise is rejected.

```js
async function fail() {
  throw new Error("Something went wrong");
}

fail().catch(error => {
  console.error(error.message);
});
```

### `await`

`await` pauses the execution of an `async` function until the awaited Promise settles.

```js
async function loadUser() {
  const response = await fetch("/api/users/1");
  const user = await response.json();

  console.log(user);
}
```

This looks synchronous, but it is still asynchronous. The JavaScript thread is not blocked while waiting for the Promise. Instead, the async function pauses and resumes later.

`await` returns the fulfillment value:

```js
const value = await Promise.resolve(123);
console.log(value); // 123
```

If the Promise rejects, `await` throws the rejection reason:

```js
try {
  await Promise.reject(new Error("Failed"));
} catch (error) {
  console.error(error.message);
}
```

### `async`/`await` vs Promise chains

These two examples are equivalent in behavior.

Promise chain:

```js
function loadUser() {
  return fetch("/api/users/1")
    .then(response => response.json())
    .then(user => {
      console.log(user);
      return user;
    });
}
```

`async`/`await`:

```js
async function loadUser() {
  const response = await fetch("/api/users/1");
  const user = await response.json();

  console.log(user);
  return user;
}
```

`async`/`await` is often easier to read for sequential logic. Promise chains can still be useful for concise transformations or when working directly with combinators.

### Error handling with `async`/`await`

Use `try`/`catch` around awaited operations.

```js
async function loadUser(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to load user:", error);
    throw error;
  }
}
```

Important: `fetch` does not reject just because the server returns `404` or `500`. It rejects for network-level failures. You must check `response.ok` for HTTP error statuses.

```js
const response = await fetch("/api/products");

if (!response.ok) {
  throw new Error(`Request failed with status ${response.status}`);
}
```

### Sequential vs parallel async execution

A common performance mistake is accidentally running independent operations sequentially.

Sequential:

```js
const user = await fetchUser();
const settings = await fetchSettings();
const notifications = await fetchNotifications();
```

This waits for each operation to finish before starting the next. If each takes one second, the total time may be around three seconds.

Parallel:

```js
const userPromise = fetchUser();
const settingsPromise = fetchSettings();
const notificationsPromise = fetchNotifications();

const user = await userPromise;
const settings = await settingsPromise;
const notifications = await notificationsPromise;
```

Or with `Promise.all`:

```js
const [user, settings, notifications] = await Promise.all([
  fetchUser(),
  fetchSettings(),
  fetchNotifications()
]);
```

If the operations are independent, `Promise.all` is usually cleaner and faster.

Use sequential execution when:

- Step 2 depends on the result of step 1.
- Order matters.
- You need to stop early after a failed step.
- You need rate limiting or controlled load.

Use parallel execution when:

- Operations are independent.
- You need all results.
- You want lower total waiting time.

### Promise combinators

Promise combinators help coordinate multiple asynchronous operations.

#### `Promise.all`

Waits for all Promises to fulfill. Rejects when any input Promise rejects.

```js
const [user, orders] = await Promise.all([
  fetchUser(userId),
  fetchOrders(userId)
]);
```

Use when:

- All operations are required.
- Failure of any operation should fail the whole operation.
- You want parallel execution.

Risk:

```text
One rejection rejects the entire Promise.all result.
```

#### `Promise.allSettled`

Waits for all Promises to settle, whether fulfilled or rejected.

```js
const results = await Promise.allSettled([
  fetchUser(userId),
  fetchOrders(userId),
  fetchRecommendations(userId)
]);

for (const result of results) {
  if (result.status === "fulfilled") {
    console.log("Value:", result.value);
  } else {
    console.error("Reason:", result.reason);
  }
}
```

Use when:

- You need every result.
- Some failures are acceptable.
- You want to show partial data.

Example React use case:

```text
Load profile, recommendations, and notifications.
If recommendations fail, still show profile and notifications.
```

#### `Promise.race`

Settles as soon as the first input Promise settles, whether fulfilled or rejected.

```js
const result = await Promise.race([
  fetchData(),
  delay(5000).then(() => {
    throw new Error("Timeout");
  })
]);
```

Use when:

- You care about the first settled operation.
- You implement timeout-like behavior.
- You race multiple sources.

Important: `Promise.race` does not automatically cancel the other Promises.

#### `Promise.any`

Fulfills as soon as the first input Promise fulfills. Rejects only if all input Promises reject.

```js
const data = await Promise.any([
  fetchFromPrimaryRegion(),
  fetchFromSecondaryRegion(),
  fetchFromCacheService()
]);
```

Use when:

- Any successful result is acceptable.
- You want the fastest successful response.
- Failures are acceptable as long as one succeeds.

If all reject, `Promise.any` rejects with an `AggregateError`.

### Event loop, tasks, and microtasks

JavaScript uses an event loop to coordinate synchronous code, asynchronous callbacks, rendering, and queued work.

Key terms:

| Term | Meaning |
|---|---|
| Call stack | Where currently executing synchronous functions run |
| Task queue | Queue for tasks such as timers, events, and script execution |
| Microtask queue | Queue for Promise reactions and `queueMicrotask` callbacks |
| Event loop | Mechanism that runs tasks, drains microtasks, and allows rendering |

Promise callbacks are microtasks.

Example:

```js
console.log("A");

setTimeout(() => {
  console.log("B");
}, 0);

Promise.resolve().then(() => {
  console.log("C");
});

console.log("D");
```

Output:

```text
A
D
C
B
```

Why:

1. `A` logs synchronously.
2. `setTimeout` schedules a task.
3. Promise `.then` schedules a microtask.
4. `D` logs synchronously.
5. Microtasks run before the next task.
6. Timer task runs later.

This matters in interviews because it shows that "0 ms timeout" does not mean "run immediately." It means "run in a later task."

### Microtask starvation

Because the microtask queue is drained before the browser moves to the next task or rendering opportunity, too many recursive microtasks can delay rendering and user input.

Bad example:

```js
function loop() {
  Promise.resolve().then(loop);
}

loop();
```

This can keep the microtask queue busy and make the UI unresponsive.

Most application code does not create this intentionally, but it is useful to understand why Promise-heavy loops can affect responsiveness.

### Async functions and execution order

`async` functions start running synchronously until the first `await`.

```js
async function run() {
  console.log("B");
  await Promise.resolve();
  console.log("C");
}

console.log("A");
run();
console.log("D");
```

Output:

```text
A
B
D
C
```

Explanation:

- `run()` starts immediately.
- It logs `B`.
- `await` pauses the function.
- The outer code continues and logs `D`.
- The async function resumes later and logs `C`.

This is a common interview question because many developers incorrectly assume everything inside an `async` function runs later.

### Returning vs awaiting

Inside an async function, returning a Promise and awaiting a Promise are often similar, but not always identical for error handling and stack traces.

```js
async function getUser() {
  return fetchUser();
}
```

This returns a Promise that resolves or rejects with `fetchUser`.

```js
async function getUser() {
  return await fetchUser();
}
```

This awaits the result and then returns it.

In many cases, `return await` is unnecessary. However, it is useful inside `try`/`catch` when you want the function to catch the rejection.

Bad:

```js
async function loadUser() {
  try {
    return fetchUser();
  } catch (error) {
    // This will not catch an async rejection from fetchUser()
    console.error(error);
  }
}
```

Correct:

```js
async function loadUser() {
  try {
    return await fetchUser();
  } catch (error) {
    console.error("Failed to load user:", error);
    throw error;
  }
}
```

### Unhandled Promise rejections

An unhandled rejection happens when a Promise rejects and no code handles the error.

Bad:

```js
async function saveUser() {
  throw new Error("Save failed");
}

saveUser(); // No await, no catch
```

Better:

```js
try {
  await saveUser();
} catch (error) {
  console.error(error);
}
```

Or:

```js
saveUser().catch(error => {
  console.error(error);
});
```

In React event handlers, unhandled rejections can happen if you call an async function without handling errors.

```jsx
function SaveButton() {
  async function handleClick() {
    await saveUser();
  }

  return <button onClick={handleClick}>Save</button>;
}
```

Better:

```jsx
function SaveButton() {
  async function handleClick() {
    try {
      await saveUser();
      showSuccess("Saved");
    } catch (error) {
      showError("Save failed");
    }
  }

  return <button onClick={handleClick}>Save</button>;
}
```

### Async array methods

A common mistake is using `forEach` with `async` and expecting it to await each operation.

Bad:

```js
const users = [1, 2, 3];

users.forEach(async userId => {
  await sendEmail(userId);
});

console.log("Done");
```

`Done` logs before the emails complete because `forEach` does not await the async callbacks.

Use `Promise.all` for parallel execution:

```js
await Promise.all(
  users.map(userId => sendEmail(userId))
);

console.log("Done");
```

Use `for...of` for sequential execution:

```js
for (const userId of users) {
  await sendEmail(userId);
}

console.log("Done");
```

Use sequential execution when order or rate limiting matters. Use parallel execution when operations are independent and the system can handle the load.

### Concurrency control

Running everything in parallel can overload the browser, API, database, or third-party service.

Risky:

```js
await Promise.all(
  thousandsOfIds.map(id => fetch(`/api/items/${id}`))
);
```

This can create too many concurrent requests.

A simple concurrency limiter:

```js
async function runWithConcurrency(items, limit, worker) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const promise = Promise.resolve()
      .then(() => worker(item))
      .then(result => {
        results.push(result);
      })
      .finally(() => {
        executing.delete(promise);
      });

    executing.add(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);

  return results;
}
```

Usage:

```js
const results = await runWithConcurrency(ids, 5, id =>
  fetch(`/api/items/${id}`).then(response => response.json())
);
```

In real projects, teams may use a small utility or library for concurrency limiting, but interviewers often want to see that you understand why unlimited `Promise.all` can be dangerous.

### Cancellation with AbortController

Promises do not have built-in cancellation. For APIs that support cancellation, such as `fetch`, use `AbortController`.

```js
const controller = new AbortController();

try {
  const response = await fetch("/api/products", {
    signal: controller.signal
  });

  const products = await response.json();
  console.log(products);
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Request was cancelled");
  } else {
    throw error;
  }
}

// Later:
controller.abort();
```

Cancellation is important when:

- A user navigates away.
- A React component unmounts.
- A search query changes before the previous request finishes.
- A timeout is reached.
- A newer request replaces an older request.

### Timeouts

`fetch` does not automatically use a custom timeout in the same way some HTTP clients do. You can combine `AbortController` with `setTimeout`.

```js
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

Usage:

```js
try {
  const response = await fetchWithTimeout("/api/products", 3000);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const products = await response.json();
} catch (error) {
  if (error.name === "AbortError") {
    console.error("Request timed out or was cancelled");
  } else {
    console.error("Request failed:", error);
  }
}
```

### Async JavaScript in React

React applications commonly use asynchronous JavaScript for data fetching, form submission, authentication, and background updates.

Example with `useEffect`:

```jsx
import { useEffect, useState } from "react";

function ProductList() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        setStatus("loading");

        const response = await fetch("/api/products", {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        setProducts(data);
        setStatus("success");
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setError(error);
        setStatus("error");
      }
    }

    loadProducts();

    return () => {
      controller.abort();
    };
  }, []);

  if (status === "loading") return <p>Loading...</p>;
  if (status === "error") return <p>{error.message}</p>;

  return (
    <ul>
      {products.map(product => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

Important React habits:

- Do not make the `useEffect` callback itself `async`.
- Define an inner async function and call it.
- Use cleanup to cancel or ignore stale requests.
- Track loading and error states.
- Avoid setting state after a component unmounts.
- Handle stale responses when dependencies change.
- Prefer a data-fetching library for complex caching and synchronization.

### Why `useEffect` callback should not be async

This is incorrect:

```jsx
useEffect(async () => {
  const response = await fetch("/api/products");
  const data = await response.json();

  setProducts(data);
}, []);
```

The effect callback should return either nothing or a cleanup function. An `async` function returns a Promise, which is not the cleanup function React expects.

Correct:

```jsx
useEffect(() => {
  async function loadProducts() {
    const response = await fetch("/api/products");
    const data = await response.json();

    setProducts(data);
  }

  loadProducts();
}, []);
```

With cleanup:

```jsx
useEffect(() => {
  const controller = new AbortController();

  async function loadProducts() {
    try {
      const response = await fetch("/api/products", {
        signal: controller.signal
      });

      const data = await response.json();
      setProducts(data);
    } catch (error) {
      if (error.name !== "AbortError") {
        setError(error);
      }
    }
  }

  loadProducts();

  return () => {
    controller.abort();
  };
}, []);
```

### Race conditions in React data fetching

A race condition happens when multiple async operations finish in a different order than expected.

Example problem:

```jsx
useEffect(() => {
  async function loadUser() {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();

    setUser(data);
  }

  loadUser();
}, [userId]);
```

If `userId` changes quickly, the old request may finish after the new request and overwrite the state with stale data.

Better with cancellation:

```jsx
useEffect(() => {
  const controller = new AbortController();

  async function loadUser() {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setUser(data);
    } catch (error) {
      if (error.name !== "AbortError") {
        setError(error);
      }
    }
  }

  loadUser();

  return () => {
    controller.abort();
  };
}, [userId]);
```

Alternative with request ID:

```jsx
let requestId = 0;

async function search(query) {
  const currentRequestId = ++requestId;

  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();

  if (currentRequestId === requestId) {
    setResults(data);
  }
}
```

This ensures only the latest response updates the UI.

### Loading, success, and error state

Asynchronous UI should usually model request state explicitly.

```js
const [status, setStatus] = useState("idle");
// idle | loading | success | error
```

Example:

```jsx
async function handleSubmit() {
  try {
    setStatus("loading");
    setError(null);

    await saveProfile(formData);

    setStatus("success");
  } catch (error) {
    setError(error);
    setStatus("error");
  }
}
```

Good UI states:

- Idle.
- Loading.
- Success.
- Error.
- Empty result.
- Retrying.
- Cancelled if useful.

Avoid relying only on `data === null` to represent all states. That can make the UI ambiguous.

### Promise-based API helpers

A common real-world pattern is to centralize fetch logic.

```js
async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
```

Usage:

```js
const products = await requestJson("/api/products");
```

Benefits:

- Consistent error handling.
- Consistent JSON parsing.
- Centralized headers.
- Easier authentication handling.
- Easier logging and retry behavior.

### Retry and backoff

Some failures are transient, such as network issues or temporary server overload. Retrying can help, but it must be used carefully.

Simple retry:

```js
async function retry(operation, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw lastError;
      }
    }
  }
}
```

Retry with delay:

```js
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(operation, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      await delay(250 * attempt);
    }
  }
}
```

Use retries only for safe operations or operations designed to be idempotent. Retrying a payment or order submission without idempotency can create duplicate side effects.

### Idempotency and async operations

An operation is idempotent if repeating it has the same effect as doing it once.

Examples:

- `GET /products` is typically idempotent.
- `PUT /profile` is usually designed to be idempotent.
- `POST /orders` may not be idempotent unless it uses an idempotency key.

Async operations often fail after the server already processed the request but before the client received the response. Retrying blindly can duplicate work.

Example safer request:

```js
await fetch("/api/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID()
  },
  body: JSON.stringify(order)
});
```

This is more of an API design concern, but frontend developers should understand it when implementing retries.

### Top-level await

In JavaScript modules, `await` can be used at the top level.

```js
const configResponse = await fetch("/config.json");
export const config = await configResponse.json();
```

This can be useful for module initialization, but it should be used carefully because it can delay module loading and affect dependent modules.

For React apps, top-level await is usually less common in component code. Most async work belongs in event handlers, effects, data loaders, or dedicated data-fetching layers.

### Common mistakes

Common mistakes with Promises and asynchronous JavaScript include:

- Forgetting to `return` a Promise inside `.then`.
- Forgetting to `await` an async function.
- Using `forEach` with async callbacks and expecting it to wait.
- Running independent API calls sequentially instead of in parallel.
- Running too many requests in parallel with unbounded `Promise.all`.
- Not handling errors.
- Assuming `fetch` rejects on HTTP `404` or `500`.
- Making a `useEffect` callback `async`.
- Setting React state after a component unmounts.
- Letting stale async responses overwrite newer state.
- Not cancelling requests when dependencies change.
- Retrying non-idempotent operations.
- Swallowing errors without logging or user feedback.
- Mixing `.then` and `await` in confusing ways.
- Assuming `setTimeout(..., 0)` runs before Promise callbacks.
- Blocking the main thread with heavy synchronous work.

### Best practices

Good asynchronous JavaScript habits include:

- Prefer `async`/`await` for readable sequential logic.
- Use Promise chains where they are concise and clear.
- Always handle errors with `try`/`catch` or `.catch`.
- Check `response.ok` after `fetch`.
- Use `Promise.all` for independent required operations.
- Use `Promise.allSettled` when partial success is acceptable.
- Use `Promise.race` carefully for first-settled behavior or timeout patterns.
- Use `Promise.any` when the first successful result is enough.
- Limit concurrency for large batches.
- Use `AbortController` to cancel stale or unnecessary requests.
- Keep React effects synchronous and call an inner async function.
- Clean up async effects on unmount or dependency change.
- Model loading, success, error, and empty states explicitly.
- Avoid fire-and-forget async work unless failure is intentionally ignored and logged.
- Make retry behavior deliberate and safe.
- Keep async business logic out of deeply nested UI components when it becomes complex.

### Practical decision guide

Use this guide during interviews and real implementation:

```text
Do I need to wait for one async operation?
  -> Use await with try/catch.

Do I need several independent results and all are required?
  -> Use Promise.all.

Do I need every result, even failures?
  -> Use Promise.allSettled.

Do I need the first operation to settle?
  -> Use Promise.race.

Do I need the first successful operation?
  -> Use Promise.any.

Do I need to process many items but avoid overload?
  -> Use controlled concurrency.

Can the request become stale or unnecessary?
  -> Use AbortController or an ignore-latest strategy.

Is this in React useEffect?
  -> Keep the effect callback synchronous and call an inner async function with cleanup.
```

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a Promise in JavaScript?

<!-- question:start:promises-asynchronous-javascript-beginner-q01 -->
<!-- question-id:promises-asynchronous-javascript-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A Promise is a JavaScript object that represents the eventual completion or failure of an asynchronous operation and its resulting value.

A Promise can be in one of three states: pending, fulfilled, or rejected. Pending means the operation is still running. Fulfilled means it completed successfully. Rejected means it failed.

Promises allow code to attach handlers with `.then`, `.catch`, and `.finally`, or to use `async`/`await` syntax for a more synchronous-looking style.

##### Key Points to Mention

- Represents an async result.
- Has pending, fulfilled, and rejected states.
- Settled means fulfilled or rejected.
- `.then` handles success.
- `.catch` handles failure.
- `async`/`await` is built on Promises.

<!-- question:end:promises-asynchronous-javascript-beginner-q01 -->

#### What is the difference between synchronous and asynchronous code?

<!-- question:start:promises-asynchronous-javascript-beginner-q02 -->
<!-- question-id:promises-asynchronous-javascript-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Synchronous code runs line by line, and each statement must finish before the next one starts. Asynchronous code starts an operation that completes later, allowing JavaScript to continue running other code.

For example, a `fetch` request starts a network operation and returns a Promise immediately. The response is handled later when the Promise settles.

Asynchronous programming is important because it prevents slow operations like network calls or timers from blocking the UI.

##### Key Points to Mention

- Synchronous code blocks until complete.
- Asynchronous code completes later.
- `fetch`, timers, and events are common async examples.
- Async code helps keep the UI responsive.
- Results are often handled with Promises or `async`/`await`.

<!-- question:end:promises-asynchronous-javascript-beginner-q02 -->

#### What does `async` do to a function?

<!-- question:start:promises-asynchronous-javascript-beginner-q03 -->
<!-- question-id:promises-asynchronous-javascript-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The `async` keyword makes a function return a Promise. If the function returns a normal value, JavaScript wraps it in a fulfilled Promise. If the function throws an error, the returned Promise is rejected.

Inside an async function, you can use `await` to pause the function until a Promise settles.

##### Key Points to Mention

- `async` functions always return Promises.
- Returned values become fulfilled Promise values.
- Thrown errors become rejected Promises.
- `await` can be used inside async functions.
- The function starts running synchronously until the first `await`.

<!-- question:end:promises-asynchronous-javascript-beginner-q03 -->

#### What does `await` do?

<!-- question:start:promises-asynchronous-javascript-beginner-q04 -->
<!-- question-id:promises-asynchronous-javascript-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`await` waits for a Promise to settle inside an async function. If the Promise fulfills, `await` returns the fulfilled value. If the Promise rejects, `await` throws the rejection reason.

`await` does not block the entire JavaScript thread. It pauses the async function and allows other work to continue.

##### Key Points to Mention

- Waits for a Promise to settle.
- Returns the fulfilled value.
- Throws if the Promise rejects.
- Pauses only the async function, not the whole JavaScript runtime.
- Usually used with `try`/`catch`.

<!-- question:end:promises-asynchronous-javascript-beginner-q04 -->

#### How do you handle errors with async/await?

<!-- question:start:promises-asynchronous-javascript-beginner-q05 -->
<!-- question-id:promises-asynchronous-javascript-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Use `try`/`catch` around awaited operations.

```js
try {
  const response = await fetch("/api/users/1");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const user = await response.json();
  console.log(user);
} catch (error) {
  console.error("Failed to load user:", error);
}
```

If an awaited Promise rejects, control moves to the `catch` block.

##### Key Points to Mention

- Use `try`/`catch`.
- Rejected Promises are thrown by `await`.
- `fetch` needs `response.ok` checks for HTTP errors.
- Handle errors near where useful recovery or user feedback can happen.
- Rethrow errors when higher-level code should handle them.

<!-- question:end:promises-asynchronous-javascript-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What is the difference between `Promise.all` and `Promise.allSettled`?

<!-- question:start:promises-asynchronous-javascript-intermediate-q01 -->
<!-- question-id:promises-asynchronous-javascript-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Promise.all` waits for all input Promises to fulfill, but it rejects as soon as any input Promise rejects. It is useful when all operations are required.

`Promise.allSettled` waits for all input Promises to settle, whether fulfilled or rejected. It returns result objects showing each Promise's status. It is useful when partial success is acceptable or when you need to inspect every result.

For example, loading profile and required permissions may use `Promise.all`, while loading optional dashboard widgets may use `Promise.allSettled`.

##### Key Points to Mention

- `Promise.all` fails fast on first rejection.
- `Promise.allSettled` waits for every Promise.
- `Promise.all` returns fulfilled values.
- `Promise.allSettled` returns status/result objects.
- Use `all` when all operations are required.
- Use `allSettled` when partial failure is acceptable.

<!-- question:end:promises-asynchronous-javascript-intermediate-q01 -->

#### What is the difference between sequential and parallel async execution?

<!-- question:start:promises-asynchronous-javascript-intermediate-q02 -->
<!-- question-id:promises-asynchronous-javascript-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Sequential execution waits for one operation to finish before starting the next. Parallel execution starts multiple operations before waiting for their results.

Sequential code is needed when one step depends on a previous result. Parallel code is better when operations are independent because it reduces total waiting time.

Example parallel execution:

```js
const [user, settings] = await Promise.all([
  fetchUser(),
  fetchSettings()
]);
```

This starts both operations at the same time and waits for both.

##### Key Points to Mention

- Sequential: one after another.
- Parallel: start multiple operations before awaiting.
- Use sequential when later steps depend on earlier results.
- Use parallel for independent work.
- `Promise.all` is common for parallel required operations.
- Avoid accidental sequential API calls.

<!-- question:end:promises-asynchronous-javascript-intermediate-q02 -->

#### Why is using `forEach` with async often a mistake?

<!-- question:start:promises-asynchronous-javascript-intermediate-q03 -->
<!-- question-id:promises-asynchronous-javascript-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`forEach` does not await async callbacks. If you pass an async function to `forEach`, the loop starts the async callbacks, but the outer code continues immediately.

Bad example:

```js
items.forEach(async item => {
  await saveItem(item);
});

console.log("Done");
```

`Done` may log before the items are saved.

Use `Promise.all(items.map(...))` for parallel work or `for...of` with `await` for sequential work.

##### Key Points to Mention

- `forEach` ignores returned Promises.
- Outer code does not wait.
- Use `Promise.all` with `map` for parallel execution.
- Use `for...of` for sequential execution.
- Choose based on ordering, dependencies, and load.

<!-- question:end:promises-asynchronous-javascript-intermediate-q03 -->

#### What is the event loop, and where do Promises fit?

<!-- question:start:promises-asynchronous-javascript-intermediate-q04 -->
<!-- question-id:promises-asynchronous-javascript-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

The event loop coordinates execution of JavaScript code, queued tasks, microtasks, and rendering. Synchronous code runs on the call stack. Timers and events usually run as tasks. Promise reactions such as `.then` callbacks run as microtasks.

After the current synchronous code finishes, JavaScript drains the microtask queue before moving to the next task. This is why Promise callbacks usually run before `setTimeout(..., 0)` callbacks.

Example:

```js
console.log("A");

setTimeout(() => console.log("B"), 0);

Promise.resolve().then(() => console.log("C"));

console.log("D");
```

Output:

```text
A
D
C
B
```

##### Key Points to Mention

- Synchronous code runs first.
- Promise callbacks are microtasks.
- Timers are tasks.
- Microtasks run before the next task.
- `setTimeout(..., 0)` does not run immediately.
- Understanding this helps explain execution order bugs.

<!-- question:end:promises-asynchronous-javascript-intermediate-q04 -->

#### How should you fetch data inside a React `useEffect`?

<!-- question:start:promises-asynchronous-javascript-intermediate-q05 -->
<!-- question-id:promises-asynchronous-javascript-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

The `useEffect` callback itself should not be `async` because an async function returns a Promise, while React expects the effect to return either nothing or a cleanup function.

Define an inner async function and call it. Use cleanup to cancel or ignore stale requests.

```jsx
useEffect(() => {
  const controller = new AbortController();

  async function loadData() {
    try {
      const response = await fetch("/api/products", {
        signal: controller.signal
      });

      const data = await response.json();
      setProducts(data);
    } catch (error) {
      if (error.name !== "AbortError") {
        setError(error);
      }
    }
  }

  loadData();

  return () => {
    controller.abort();
  };
}, []);
```

##### Key Points to Mention

- Do not make the effect callback `async`.
- Define and call an inner async function.
- Use cleanup for cancellation.
- Handle errors.
- Track loading and error state.
- Avoid stale state updates after unmount or dependency changes.

<!-- question:end:promises-asynchronous-javascript-intermediate-q05 -->

#### What is the difference between `Promise.race` and `Promise.any`?

<!-- question:start:promises-asynchronous-javascript-intermediate-q06 -->
<!-- question-id:promises-asynchronous-javascript-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Promise.race` settles as soon as the first input Promise settles, whether it fulfills or rejects.

`Promise.any` fulfills as soon as the first input Promise fulfills. It only rejects if all input Promises reject.

Use `Promise.race` when the first settled result matters, such as timeout-like behavior. Use `Promise.any` when the first successful result is enough, such as trying multiple fallback sources.

##### Key Points to Mention

- `race` cares about first settled Promise.
- `any` cares about first fulfilled Promise.
- `race` can reject if the first settled Promise rejects.
- `any` ignores rejections until all reject.
- `any` rejects with `AggregateError` if all fail.
- Neither automatically cancels the remaining operations.

<!-- question:end:promises-asynchronous-javascript-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do you prevent race conditions when fetching data in React?

<!-- question:start:promises-asynchronous-javascript-advanced-q01 -->
<!-- question-id:promises-asynchronous-javascript-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Race conditions happen when multiple async requests are active and an older request finishes after a newer one, overwriting state with stale data.

A common solution is to cancel stale requests with `AbortController` in the `useEffect` cleanup. Another approach is to track a request ID and update state only if the response belongs to the latest request.

Example with cancellation:

```jsx
useEffect(() => {
  const controller = new AbortController();

  async function loadUser() {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        signal: controller.signal
      });

      const data = await response.json();
      setUser(data);
    } catch (error) {
      if (error.name !== "AbortError") {
        setError(error);
      }
    }
  }

  loadUser();

  return () => controller.abort();
}, [userId]);
```

##### Key Points to Mention

- Stale requests can overwrite newer state.
- Use `AbortController` for supported APIs.
- Use request IDs or latest-only checks when cancellation is not enough.
- Clean up effects when dependencies change.
- Handle `AbortError` separately.
- Data-fetching libraries can help manage this.

<!-- question:end:promises-asynchronous-javascript-advanced-q01 -->

#### How would you implement a timeout for `fetch`?

<!-- question:start:promises-asynchronous-javascript-advanced-q02 -->
<!-- question-id:promises-asynchronous-javascript-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use `AbortController` with `setTimeout`. The timeout aborts the request, and the `finally` block clears the timer.

```js
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

The caller should handle `AbortError` and distinguish timeout/cancellation from other failures if needed.

##### Key Points to Mention

- Promises do not have built-in cancellation.
- `fetch` supports `AbortController`.
- Clear the timeout in `finally`.
- Handle `AbortError`.
- `Promise.race` alone does not cancel the underlying request.
- Timeouts should be selected based on user experience and backend expectations.

<!-- question:end:promises-asynchronous-javascript-advanced-q02 -->

#### Why can unlimited `Promise.all` be dangerous?

<!-- question:start:promises-asynchronous-javascript-advanced-q03 -->
<!-- question-id:promises-asynchronous-javascript-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Unlimited `Promise.all` can start too many operations at once. This can overload the browser, backend API, database, network, or third-party service. It can also cause rate limiting, memory pressure, or poor user experience.

For small independent batches, `Promise.all` is fine. For large batches, use concurrency control so only a limited number of operations run at the same time.

Example: process 1,000 items with a concurrency limit of 5 instead of starting 1,000 requests immediately.

##### Key Points to Mention

- `Promise.all` starts all operations immediately if the Promises are created immediately.
- Large batches can overload systems.
- Use concurrency limits.
- Consider rate limits and backend capacity.
- Use sequential processing when order or dependency matters.
- Use batching or pagination for large datasets.

<!-- question:end:promises-asynchronous-javascript-advanced-q03 -->

#### What is an unhandled Promise rejection, and why is it a problem?

<!-- question:start:promises-asynchronous-javascript-advanced-q04 -->
<!-- question-id:promises-asynchronous-javascript-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

An unhandled Promise rejection happens when a Promise rejects and no error handler observes it. This can happen when an async function is called without `await` or `.catch`.

It is a problem because failures can be silently missed, logs may be incomplete, UI state may stay stuck, and production behavior becomes unreliable.

Good code either awaits the Promise inside `try`/`catch`, returns it to a caller that will handle it, or attaches `.catch`.

##### Key Points to Mention

- Rejection without handler.
- Common when calling async functions without `await`.
- Can cause missed errors and stuck loading states.
- Use `try`/`catch`, `.catch`, or return the Promise.
- Fire-and-forget work should still log errors.
- React event handlers should handle async failures.

<!-- question:end:promises-asynchronous-javascript-advanced-q04 -->

#### How do retries interact with async operations and idempotency?

<!-- question:start:promises-asynchronous-javascript-advanced-q05 -->
<!-- question-id:promises-asynchronous-javascript-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Retries can help with transient failures, but they are only safe when the operation is idempotent or protected by an idempotency mechanism. Retrying a `GET` request is usually safer than retrying a `POST` that creates an order or charges a payment.

An async request may fail on the client after the server already processed it. If the client retries without idempotency, it may create duplicate side effects.

For important write operations, use idempotency keys or backend support to make retries safe.

##### Key Points to Mention

- Retries help transient failures.
- Not all operations are safe to retry.
- Idempotent operations can be repeated safely.
- Non-idempotent writes can duplicate side effects.
- Use idempotency keys for critical writes.
- Use backoff and retry limits.

<!-- question:end:promises-asynchronous-javascript-advanced-q05 -->

#### What is the difference between returning a Promise and using `return await`?

<!-- question:start:promises-asynchronous-javascript-advanced-q06 -->
<!-- question-id:promises-asynchronous-javascript-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Inside an async function, returning a Promise usually passes that Promise's result to the caller. In many simple cases, `return promise` and `return await promise` produce similar external behavior.

However, `return await` is useful inside `try`/`catch` because it allows the async function to catch a rejection before returning.

Bad:

```js
async function loadUser() {
  try {
    return fetchUser();
  } catch (error) {
    // Does not catch async rejection from fetchUser
  }
}
```

Correct:

```js
async function loadUser() {
  try {
    return await fetchUser();
  } catch (error) {
    console.error(error);
    throw error;
  }
}
```

##### Key Points to Mention

- `async` functions always return Promises.
- `return promise` is often enough.
- `return await` can be unnecessary in simple cases.
- `return await` is useful for local `try`/`catch`.
- Awaiting turns rejection into a thrown error inside the async function.
- Prefer clarity and correct error handling.

<!-- question:end:promises-asynchronous-javascript-advanced-q06 -->

#### Explain the output order of Promises and timers.

<!-- question:start:promises-asynchronous-javascript-advanced-q07 -->
<!-- question-id:promises-asynchronous-javascript-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Given this code:

```js
console.log("A");

setTimeout(() => console.log("B"), 0);

Promise.resolve().then(() => console.log("C"));

console.log("D");
```

The output is:

```text
A
D
C
B
```

`A` and `D` are synchronous, so they run first. The Promise `.then` callback is a microtask, and the timer callback is a task. After synchronous code finishes, JavaScript drains microtasks before running the next task, so `C` runs before `B`.

##### Key Points to Mention

- Synchronous logs run first.
- Promise callbacks are microtasks.
- Timers run as tasks.
- Microtasks run before the next task.
- `setTimeout(..., 0)` does not mean immediate execution.
- Event loop knowledge helps debug async ordering.

<!-- question:end:promises-asynchronous-javascript-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
