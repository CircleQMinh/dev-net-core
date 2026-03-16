---
id: axios
topic: Axios & Interceptors
category: React
---

## Axios Setup in a React + RTK Query Application

A typical production-ready setup using Axios with Redux Toolkit (RTK Query) looks like this:

1. Create a centralized Axios instance for base configuration  
2. Create an RTK Query API slice using `createApi` (often with a custom `baseQuery` wrapping Axios)  
3. Register the API slice reducer and middleware in the Redux store  
4. Use the auto-generated RTK Query hooks inside components  

### Why centralize Axios configuration?

- Consistent headers
- Easier authentication handling
- Centralized logging
- Retry logic
- Global error handling

### Example: Centralized Axios Instance

```ts
// apiClient.ts
import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  withCredentials: true // important for cookie-based auth
});
````

---

## Axios Interceptors

### What is an Axios interceptor?

An interceptor allows you to intercept and modify:

* Requests before they are sent
* Responses before they reach your application logic

You can think of interceptors as middleware for HTTP requests.

---

## Types of Interceptors

Axios provides two types:

### 1. Request Interceptor

Runs before the request is sent.

### 2. Response Interceptor

Runs after the response is received (or when an error occurs).

```ts
axios.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);
```

---

## Common Real-World Use Cases

### 1. Attaching Authentication Tokens (Most Common)

```ts
apiClient.interceptors.request.use(config => {
  const token = authStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### Why this is good

* No duplication across requests
* Centralized authentication logic
* Cleaner service layer

---

### 2. Global Loading Indicator (Use Carefully)

```ts
apiClient.interceptors.request.use(config => {
  loading.start();
  return config;
});

apiClient.interceptors.response.use(
  res => {
    loading.stop();
    return res;
  },
  err => {
    loading.stop();
    return Promise.reject(err);
  }
);
```

This allows centralized loading state management, but must be handled carefully to avoid race conditions with multiple concurrent requests.

---

### 3. Global Error Handling

```ts
apiClient.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401) {
      logout();
    }
    return Promise.reject(error);
  }
);
```

Use this to handle:

* Unauthorized access (401)
* Redirect to login
* Global toast notifications
* Logging

---

### 4. Token Refresh Logic (Advanced & Common Interview Topic)

This pattern prevents multiple simultaneous refresh calls by using a queue.

```ts
let isRefreshing = false;
let queue: ((token: string) => void)[] = [];

apiClient.interceptors.response.use(
  res => res,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;

      if (isRefreshing) {
        return new Promise(resolve => {
          queue.push(token => {
            error.config.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(error.config));
          });
        });
      }

      isRefreshing = true;
      const newToken = await refreshToken();
      isRefreshing = false;

      queue.forEach(cb => cb(newToken));
      queue = [];

      error.config.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(error.config);
    }

    return Promise.reject(error);
  }
);
```

### Why this pattern works

* Prevents multiple refresh requests
* Queues pending requests
* Retries original requests with the new token
* Avoids race conditions during token expiration

---

## Notes

* All interceptor patterns shown are valid real-world Axios practices.
* The token refresh implementation correctly prevents multiple simultaneous refresh requests using a queue pattern.
* Implementation caution: `error.config._retry` is a custom property. In TypeScript, you should extend `AxiosRequestConfig` to avoid typing errors.
```


