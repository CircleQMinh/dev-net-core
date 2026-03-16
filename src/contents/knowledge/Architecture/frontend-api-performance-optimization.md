---
id: frontend-api-performance-optimization
topic: Frontend & API Performance Optimization
category: Design & Architecture
---

## Frontend Optimization

###  Minify and Bundle Assets

Minification and bundling reduce the number and size of files sent to the browser.

Example using **ASP.NET bundling**:

```csharp
bundles.Add(new ScriptBundle("~/bundles/app").Include(
    "~/Scripts/jquery.js",
    "~/Scripts/bootstrap.js"));

bundles.Add(new StyleBundle("~/Content/css").Include(
    "~/Content/bootstrap.css",
    "~/Content/site.css"));
````

Benefits:

* Fewer HTTP requests
* Smaller payload sizes
* Faster page load

---

###  Reduce the Number of HTTP Requests

Instead of multiple API calls, create a consolidated endpoint.

Example:

```
GET /api/pageData
```

Return all required data in a single response.

Benefits:

* Fewer network round-trips
* Improved **Time To Interactive (TTI)**
* Lower latency for page initialization

---

###  Other Frontend Optimizations

* Use a **CDN** for static assets
* Optimize images
* Enable **lazy loading**
* Compress assets

---

## Script Loading Optimization

Use `async` or `defer` for script loading.

| Attribute | Downloads in Parallel | Blocks Parsing | Execution Timing             | Order Preserved |
| --------- | --------------------- | -------------- | ---------------------------- | --------------- |
| None      | No                    | Yes            | Immediately when encountered | Yes             |
| async     | Yes                   | No (generally) | Executes as soon as ready    | No              |
| defer     | Yes                   | No             | After HTML parsing completes | Yes             |

---

## React Optimization

### Avoid Unnecessary Re-Renders

Use `React.memo` for pure components.

```jsx
const UserRow = React.memo(({ user }) => {
  return <div>{user.name}</div>;
});
```

Use when:

* Components render frequently
* Props remain stable
* Large lists or tables exist

---

### `useMemo`

Purpose:

Cache the result of an expensive computation so it isn't recalculated every render.

Signature:

```jsx
const value = useMemo(() => computeValue(), [deps]);
```

Example:

```jsx
const expensiveTotal = useMemo(() =>
  items.reduce((sum, i) => sum + i.price, 0),
  [items]
);
```

Without `useMemo`:

* Calculation runs on every render.

With `useMemo`:

* Recomputed only when dependencies change.

Use when:

* Expensive calculations
* Derived state
* Preventing unnecessary recomputation

---

### `useCallback`

Purpose:

Cache function references so they aren't recreated on every render.

Signature:

```jsx
const fn = useCallback(() => {}, [deps]);
```

Example:

```jsx
const handleClick = useCallback(() => {
  dispatch(saveUser(user));
}, [dispatch, user]);
```

Without `useCallback`:

* New function instance each render
* Causes child components to re-render

With `useCallback`:

* Stable function reference
* Enables `React.memo` to work effectively

Use when:

* Passing callbacks to memoized children
* Stable dependencies exist

---

###  Avoid Inline Objects or Functions in JSX

Bad:

```jsx
<div style={{ marginTop: 8 }} onClick={() => doSomething()} />
```

Better:

```jsx
const style = { marginTop: 8 };

const handleClick = useCallback(() => {
  doSomething();
}, []);

<div style={style} onClick={handleClick} />
```

---

### Reduce State Complexity

Normalize state before storing in Redux.

Example API response:

```json
[
  { "id": "u1", "name": "Mike", "roles": [{ "id": "r1", "name": "Admin" }] },
  { "id": "u2", "name": "Anna", "roles": [{ "id": "r2", "name": "User" }] }
]
```

Problems with nested storage:

* Duplicate objects
* Hard updates
* Wide re-renders

Normalized structure:

* Entities stored once
* Easy updates by ID
* Minimal re-render scope

This aligns well with Redux architecture.

---

###  Avoid Duplicate Requests

Use **RTK Query** to automatically:

* Deduplicate identical requests
* Cache results
* Manage server state

---

## API Optimization

###  Efficient Request Handling

Use **asynchronous programming**:

* Use `async/await` for I/O operations
* Prevent thread blocking

Minimize payload size:

* Use DTOs
* Compress JSON (Gzip/Brotli)
* Support pagination
* Implement filtering

---

###  Optimize Data Access Layer

When using **EF Core**:

Avoid:

* `ToList()` before filtering
* Loading unnecessary entities

Prefer:

* `AsNoTracking()` for read-only queries
* `Select` projections instead of full entities

Example:

```csharp
var users = db.Users
    .AsNoTracking()
    .Select(u => new UserDto
    {
        Id = u.Id,
        Name = u.Name
    });
```

---

### Avoid N+1 Queries

Use:

* Eager loading (`Include`)
* Projections (`Select`)

Choose projection when possible to reduce unnecessary joins.

---

### Index and Query Optimization

Ensure queries use proper indexes.

Index columns used in:

* `WHERE`
* `JOIN`
* `ORDER BY`
* `GROUP BY`

Avoid full table scans.

Analyze execution plans.

---

## SQL Performance Investigation

### Identify Slow Queries

Use tools such as:

* SQL Server Profiler
* Application logs
* Telemetry systems
* APM tools

---

### Analyze Execution Plans

Look for warning signs:

* Table scans
* Key lookups
* High-cost operators
* Missing indexes

---

### Reduce Data Volume

Best practices:

* Avoid `SELECT *`
* Fetch only required columns
* Filter early (`WHERE`)
* Use pagination

Example:

```
OFFSET ... FETCH
```

---

### Indexed Computed Columns

If a function is applied to an indexed column, SQL Server cannot use the index efficiently.

Example problem:

```sql
WHERE YEAR(OrderDate) = 2024
```

Solution:

```sql
ALTER TABLE Orders
ADD OrderYear AS YEAR(OrderDate) PERSISTED;

CREATE INDEX IX_Orders_OrderYear
ON Orders(OrderYear);
```

---

## API Design Best Practices

### Rate Limiting and Throttling

Protect APIs from abuse and overload.

Benefits:

* Prevent traffic spikes
* Protect downstream services
* Improve reliability

---

### Proper HTTP Status Codes

Correct responses prevent:

* Retry storms
* Client-side misbehavior

---

### Batch or Bulk Endpoints

Design endpoints that handle multiple items:

```
POST /orders/bulk
```

Benefits:

* Reduced round trips
* Improved throughput

---

## Rate Limiting Implementation

### API Gateway (Recommended)

Rate limiting should ideally be implemented at the **API gateway layer**.

Examples:

* Azure API Management
* AWS API Gateway
* Kong

Supports:

* Per-IP rate limiting
* Per-user limits
* Subscription-based throttling

---

### ASP.NET Core Implementation

Example configuration:

```csharp
services.Configure<IpRateLimitOptions>(options =>
{
    options.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule
        {
            Endpoint = "*",
            Period = "1m",
            Limit = 60
        }
    };
});
```

---

### Custom Rate Limiting Middleware

```csharp
public class RateLimitingMiddleware
{
    public async Task Invoke(HttpContext context)
    {
        var clientKey = context.Connection.RemoteIpAddress.ToString();
        var count = await _cache.GetAsync(clientKey); // e.g., Redis

        if (count > limit)
        {
            context.Response.StatusCode = 429;
            return;
        }

        await _next(context);
    }
}
```

---

### Middleware vs Action Filters

For rate limiting in .NET APIs, **middleware is typically preferred**.

Reasons:

* Runs before model binding
* Works globally
* Access to request headers early
* Handles cross-cutting concerns
* Lower performance overhead

---

## Summary

Performance optimization should consider the full stack:

* Frontend asset optimization
* React rendering efficiency
* API design and payload management
* Database query tuning
* Proper rate limiting

Combining these techniques significantly improves scalability and user experience.

---

## Notes

1. `async` scripts may still briefly affect parsing depending on browser timing, but generally do not block HTML parsing.
2. `React.memo`, `useMemo`, and `useCallback` only improve performance when used appropriately; excessive use can add unnecessary complexity.
3. Using functions on indexed columns (e.g., `WHERE YEAR(date)`) prevents index seeks — persisted computed columns solve this correctly.
4. Rate limiting is usually best implemented at the **API gateway level** in distributed systems.
5. RTK Query automatically deduplicates identical requests within the same cache scope.


```
