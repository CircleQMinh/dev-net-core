---
id: n-plus-one-problem
topic: N+1 Problem
category: .NET
---

## Understanding the N+1 Problem

### What is the N+1 Problem?

The N+1 problem is a common performance issue that occurs when working with relational databases, especially when using ORMs such as:

- Entity Framework / EF Core
- Hibernate
- Sequelize
- Other data mappers

It happens when an application executes:

1. One query to fetch a list of **N parent records**
2. N additional queries — one for each parent — to fetch related child records

Total queries executed: **1 + N**

This leads to inefficient database access and performance degradation.

---

## Example Scenario

Assume you have:

- `Blog` (parent)
- `Post` (child, one-to-many relationship)

### Problematic Code (EF Core Example)

```csharp
var blogs = db.Blogs.ToList();

foreach (var blog in blogs)
{
    Console.WriteLine(blog.Title);
    Console.WriteLine(blog.Posts.Count); // Triggers additional queries if lazy loading is enabled
}
````

If lazy loading is enabled, this results in:

* 1 query to load all blogs
* N additional queries (one per blog) to load related posts

For 100 blogs → **101 queries**

This is the N+1 problem.

> Note: In EF Core, this behavior occurs when lazy loading is enabled or when related data is accessed without proper eager loading.

---

## Why Is It a Problem?

* **Performance degradation**
  Many small queries are slower than a single optimized query.

* **Increased database load**
  More round trips increase CPU, IO, and network overhead.

* **Scalability issues**
  The problem worsens as dataset size grows.

---

## How to Solve the N+1 Problem

### 1️⃣ Eager Loading (Most Common Solution)

Load related data as part of the initial query:

```csharp id="9dk4nt"
var blogs = db.Blogs
              .Include(b => b.Posts)
              .ToList();
```

This generates a single SQL query using a JOIN.

---

### 2️⃣ Explicit Loading

```csharp id="3fa7rc"
var blogs = db.Blogs.ToList();

foreach (var blog in blogs)
{
    db.Entry(blog)
      .Collection(b => b.Posts)
      .Load();
}
```

This still generates multiple queries but gives more control.

---

### 3️⃣ Projection (Often Better Than Include)

Select only required fields:

```csharp id="5mz1px"
var blogs = db.Blogs
              .Select(b => new
              {
                  b.Title,
                  PostCount = b.Posts.Count
              })
              .ToList();
```

This generates optimized SQL and avoids loading unnecessary data.

Projection is often more efficient than `Include()` for read-only scenarios.

---

### 4️⃣ Batch Loading

Instead of loading children per parent, fetch all children in a single query:

```csharp id="7vpl4q"
var blogIds = blogs.Select(b => b.Id).ToList();

var posts = db.Posts
              .Where(p => blogIds.Contains(p.BlogId))
              .ToList();
```

Then map in memory.

---

### 5️⃣ Caching

Cache frequently accessed data to reduce repeated database calls.

---

## Important Clarification

The N+1 problem usually appears when:

* Lazy loading is enabled
* Navigation properties are accessed inside loops
* Developers forget to use `Include()` or projections

In EF Core, lazy loading is **not enabled by default**. It must be explicitly configured.

---

## Best Practices

* Prefer projections (`Select`) over `Include` when possible
* Avoid accessing navigation properties inside loops
* Use logging to inspect generated SQL queries
* Monitor query count in production
* Use tools like:

  * SQL Server Profiler
  * EF Core logging
  * Application performance monitoring (APM)

---

## Summary

* The N+1 problem occurs when 1 query loads N records and N additional queries load related data.
* It commonly appears when using ORMs.
* It causes performance and scalability issues.
* The primary solutions are:

  * Eager loading (`Include`)
  * Projection (`Select`)
  * Batch loading
  * Caching



---

## Notes

- Clarified that N+1 in EF Core typically occurs when lazy loading is enabled or when related navigation properties are accessed without eager loading.
- Added projection as a preferred optimization technique (often better than `Include`).
- Clarified that EF Core does not enable lazy loading by default.
- Expanded best practices for real-world .NET usage.


```
