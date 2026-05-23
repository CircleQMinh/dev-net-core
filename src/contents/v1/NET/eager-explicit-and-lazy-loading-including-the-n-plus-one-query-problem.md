---
id: eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem
topic: Entity Framework
subtopic: Eager, Explicit, and Lazy Loading, Including the N+1 Query Problem
category: .NET
---


## Overview

Entity Framework Core supports several ways to load related data from the database. Related data usually means entities connected through navigation properties, such as a `Customer` with many `Orders`, an `Order` with many `OrderLines`, or a `Post` with an `Author` and many `Tags`.

The three main loading patterns are:

1. **Eager loading**: Load related data as part of the original query, usually with `Include` and `ThenInclude`.
2. **Explicit loading**: Load related data later by writing an explicit command, usually with `DbContext.Entry(...).Reference(...).LoadAsync()` or `DbContext.Entry(...).Collection(...).LoadAsync()`.
3. **Lazy loading**: Load related data automatically when a navigation property is accessed.

This topic matters because data loading strategy directly affects performance, correctness, memory usage, SQL shape, and maintainability. A query that works well in development with a small database can become slow in production if it loads too much data, triggers many extra database roundtrips, or accidentally creates a large join.

The most common performance problem in this area is the **N+1 query problem**. It happens when an application loads a list of parent entities with one query, then executes one additional query per parent to load related data. For example, loading 100 blogs and then lazily loading posts for each blog can produce 101 database queries.

This topic is important for interviews because it tests practical EF Core experience. Interviewers often ask:

- What is the difference between eager, explicit, and lazy loading?
- How do `Include` and `ThenInclude` work?
- What is the N+1 query problem?
- Why is lazy loading dangerous in APIs?
- When should you use projection instead of `Include`?
- What is a split query?
- What is cartesian explosion?
- How does tracking and navigation fix-up affect related data?
- How do you diagnose excessive SQL queries?
- How do you design EF Core queries for production APIs?

A strong answer should not say that one loading strategy is always best. Instead, it should explain trade-offs and choose the loading pattern based on the use case, query shape, data size, and whether the result is for reading, updating, or serialization.

## Core Concepts

### Example Model

The examples in this file use a simple blogging model.

```csharp
public sealed class Blog
{
    public int Id { get; set; }
    public string Url { get; set; } = string.Empty;

    public int OwnerId { get; set; }
    public User Owner { get; set; } = null!;

    public List<Post> Posts { get; } = new();
}

public sealed class Post
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;

    public int BlogId { get; set; }
    public Blog Blog { get; set; } = null!;

    public int AuthorId { get; set; }
    public User Author { get; set; } = null!;

    public List<Comment> Comments { get; } = new();
}

public sealed class Comment
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;

    public int PostId { get; set; }
    public Post Post { get; set; } = null!;
}

public sealed class User
{
    public int Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}
```

A `DbContext` might look like this:

```csharp
using Microsoft.EntityFrameworkCore;

public sealed class AppDbContext : DbContext
{
    public DbSet<Blog> Blogs => Set<Blog>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<User> Users => Set<User>();

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }
}
```

Important navigation properties:

- `Blog.Posts` is a collection navigation.
- `Post.Blog` is a reference navigation.
- `Post.Comments` is a collection navigation.
- `Blog.Owner` is a reference navigation.
- `Post.Author` is a reference navigation.

Loading related data means deciding when and how these navigation properties should be populated.

### What Related Data Loading Means

When EF Core queries an entity, it does not automatically load every related entity by default.

Example:

```csharp
var blogs = await context.Blogs.ToListAsync();
```

This loads `Blog` rows. It does not necessarily load `Posts`, `Owner`, `Comments`, or other related data.

To load related data, you choose one of the loading strategies:

```csharp
// Eager loading
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .ToListAsync();
```

```csharp
// Explicit loading
var blog = await context.Blogs.SingleAsync(b => b.Id == blogId);

await context.Entry(blog)
    .Collection(b => b.Posts)
    .LoadAsync();
```

```csharp
// Lazy loading
var blog = await context.Blogs.SingleAsync(b => b.Id == blogId);

var posts = blog.Posts; // May trigger a database query if lazy loading is enabled.
```

The key interview point is that related data loading is not just a coding style. It determines SQL execution, network roundtrips, result size, memory usage, and database load.

### Eager Loading

Eager loading loads related data as part of the original query.

In EF Core, eager loading is usually done with `Include`.

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .ToListAsync();
```

This tells EF Core to load blogs and their posts together.

Eager loading is best when you already know the related data is needed.

Common use cases:

- API endpoint returns an aggregate with child data.
- Page shows customers and recent orders.
- Report needs parent rows and related summary data.
- Application logic needs a full aggregate to make a decision.
- You want to avoid accidental lazy loading.

### `Include`

`Include` specifies a navigation to load.

```csharp
var orders = await context.Orders
    .Include(o => o.Customer)
    .ToListAsync();
```

For the blog model:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Owner)
    .Include(b => b.Posts)
    .ToListAsync();
```

This loads:

- Blogs.
- Each blog's owner.
- Each blog's posts.

`Include` is clear and readable, but it can also load more data than needed if used carelessly.

### `ThenInclude`

`ThenInclude` loads deeper levels of related data.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
        .ThenInclude(p => p.Author)
    .ToListAsync();
```

This loads:

- Blogs.
- Posts for each blog.
- Author for each post.

Another example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
        .ThenInclude(p => p.Comments)
    .ToListAsync();
```

This loads:

- Blogs.
- Posts.
- Comments for each post.

When loading multiple branches from the same collection, start another `Include` chain.

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
        .ThenInclude(p => p.Author)
    .Include(b => b.Posts)
        .ThenInclude(p => p.Comments)
    .ToListAsync();
```

This may look repetitive, but it is the normal way to include multiple related paths.

### Filtered Include

Filtered include lets you filter or sort included collection navigations.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts
        .Where(p => p.Title.Contains("EF Core"))
        .OrderByDescending(p => p.Id)
        .Take(5))
    .ToListAsync();
```

This is useful when you need only a subset of a related collection.

Supported operations commonly include:

- `Where`
- `OrderBy`
- `OrderByDescending`
- `ThenBy`
- `ThenByDescending`
- `Skip`
- `Take`

Practical example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts
        .OrderByDescending(p => p.Id)
        .Take(3))
    .ToListAsync();
```

This loads each blog with only its latest three posts.

Important caution: in tracking queries, previously tracked entities can affect filtered include results because of navigation fix-up. If you need a clean read-only result, consider `AsNoTracking()` or a new `DbContext`.

```csharp
var blogs = await context.Blogs
    .AsNoTracking()
    .Include(b => b.Posts
        .OrderByDescending(p => p.Id)
        .Take(3))
    .ToListAsync();
```

### Eager Loading with Projection

`Include` loads entities and navigations. Projection with `Select` lets you shape exactly what you need.

Example with `Include`:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .ToListAsync();
```

Example with projection:

```csharp
var blogs = await context.Blogs
    .Select(b => new BlogSummaryDto
    {
        Id = b.Id,
        Url = b.Url,
        PostCount = b.Posts.Count,
        LatestPosts = b.Posts
            .OrderByDescending(p => p.Id)
            .Take(3)
            .Select(p => new PostSummaryDto
            {
                Id = p.Id,
                Title = p.Title
            })
            .ToList()
    })
    .ToListAsync();

public sealed class BlogSummaryDto
{
    public int Id { get; set; }
    public string Url { get; set; } = string.Empty;
    public int PostCount { get; set; }
    public List<PostSummaryDto> LatestPosts { get; set; } = new();
}

public sealed class PostSummaryDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
}
```

Projection is often better for read-only API endpoints because:

- It loads only required columns.
- It avoids returning EF entities directly.
- It avoids accidental serialization of large object graphs.
- It avoids tracking overhead if entity tracking is not needed.
- It makes the response contract explicit.

For interviews, a strong answer should mention that `Include` is not always the best solution. For API responses and read models, projection is often better.

### Eager Loading Trade-Offs

Benefits of eager loading:

- Clear in the query.
- Avoids lazy loading surprises.
- Can reduce roundtrips.
- Works well when related data is known in advance.
- Helps avoid N+1 queries.

Trade-offs:

- Can load too much data.
- Can create large SQL joins.
- Can duplicate parent data in join results.
- Can cause cartesian explosion when including multiple collection navigations.
- Can make queries harder to optimize.
- Can produce very large result sets.

Bad example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
        .ThenInclude(p => p.Comments)
    .Include(b => b.Posts)
        .ThenInclude(p => p.Author)
    .Include(b => b.Owner)
    .ToListAsync();
```

This might be acceptable for a small admin page but dangerous for a public API returning thousands of rows.

Better approach for read-only API output:

```csharp
var blogs = await context.Blogs
    .AsNoTracking()
    .Select(b => new
    {
        b.Id,
        b.Url,
        OwnerName = b.Owner.DisplayName,
        PostCount = b.Posts.Count
    })
    .ToListAsync();
```

### Explicit Loading

Explicit loading loads related data after the main entity has already been loaded. It is explicit because the developer writes a separate instruction to load the navigation.

Reference navigation:

```csharp
var blog = await context.Blogs
    .SingleAsync(b => b.Id == blogId);

await context.Entry(blog)
    .Reference(b => b.Owner)
    .LoadAsync();
```

Collection navigation:

```csharp
var blog = await context.Blogs
    .SingleAsync(b => b.Id == blogId);

await context.Entry(blog)
    .Collection(b => b.Posts)
    .LoadAsync();
```

Explicit loading is useful when:

- You do not always need the related data.
- You need to decide at runtime whether to load related data.
- You need to load a navigation after checking some condition.
- You want to make database roundtrips visible in code.
- You need to load related data for one specific entity.

Example:

```csharp
var blog = await context.Blogs
    .SingleAsync(b => b.Id == blogId);

if (includePosts)
{
    await context.Entry(blog)
        .Collection(b => b.Posts)
        .LoadAsync();
}
```

### Explicit Loading with Query

You can query a related collection before loading it.

Example: count related posts without loading all posts into memory.

```csharp
var blog = await context.Blogs
    .SingleAsync(b => b.Id == blogId);

var postCount = await context.Entry(blog)
    .Collection(b => b.Posts)
    .Query()
    .CountAsync();
```

Example: load only recent posts.

```csharp
await context.Entry(blog)
    .Collection(b => b.Posts)
    .Query()
    .Where(p => p.Id > 100)
    .LoadAsync();
```

Example: calculate an aggregate.

```csharp
var commentCount = await context.Entry(blog)
    .Collection(b => b.Posts)
    .Query()
    .SelectMany(p => p.Comments)
    .CountAsync();
```

This is a practical advantage of explicit loading: you can control exactly what happens after the main entity is loaded.

### Explicit Loading Trade-Offs

Benefits of explicit loading:

- Database roundtrips are visible in code.
- Useful when related data is optional.
- Can conditionally load navigations.
- Can query related data before loading.
- Safer than lazy loading because it is intentional.

Trade-offs:

- Causes additional database roundtrips.
- Can still create N+1 if used inside loops.
- Requires more code than eager loading.
- Easy to forget loading a needed navigation.
- Can behave differently depending on tracking and navigation fix-up.

Bad example:

```csharp
var blogs = await context.Blogs.ToListAsync();

foreach (var blog in blogs)
{
    await context.Entry(blog)
        .Collection(b => b.Posts)
        .LoadAsync();
}
```

This is an explicit-loading version of the N+1 problem. If there are 100 blogs, this may run 101 queries.

Better approach:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .ToListAsync();
```

Or use projection:

```csharp
var blogs = await context.Blogs
    .Select(b => new BlogSummaryDto
    {
        Id = b.Id,
        Url = b.Url,
        PostCount = b.Posts.Count
    })
    .ToListAsync();
```

### Lazy Loading

Lazy loading automatically loads related data when a navigation property is accessed.

Example:

```csharp
var blog = await context.Blogs
    .SingleAsync(b => b.Id == blogId);

var posts = blog.Posts; // May trigger a database query.
```

In EF Core, lazy loading is not enabled by default. It must be configured.

One common approach uses lazy-loading proxies.

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options
        .UseLazyLoadingProxies()
        .UseSqlServer(connectionString);
});
```

Entities must allow proxying. Navigation properties usually need to be `virtual`, and classes must be inheritable.

```csharp
public class Blog
{
    public int Id { get; set; }
    public string Url { get; set; } = string.Empty;

    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();
}

public class Post
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;

    public int BlogId { get; set; }
    public virtual Blog Blog { get; set; } = null!;
}
```

Another approach uses `ILazyLoader`, but this couples entities to EF Core infrastructure.

```csharp
using Microsoft.EntityFrameworkCore.Infrastructure;

public class Blog
{
    private readonly ILazyLoader? _lazyLoader;
    private ICollection<Post>? _posts;

    public Blog()
    {
    }

    private Blog(ILazyLoader lazyLoader)
    {
        _lazyLoader = lazyLoader;
    }

    public int Id { get; set; }
    public string Url { get; set; } = string.Empty;

    public ICollection<Post> Posts
    {
        get => _lazyLoader?.Load(this, ref _posts) ?? _posts ??= new List<Post>();
        set => _posts = value;
    }
}
```

Lazy loading can make code look simple, but it can hide database queries behind normal property access.

### Lazy Loading Trade-Offs

Benefits of lazy loading:

- Convenient for small applications.
- Related data is loaded only if accessed.
- Can reduce initial query size.
- Can make some object traversal code easy to write.

Trade-offs:

- Database queries are hidden behind property access.
- Very easy to create N+1 query problems.
- Can be dangerous during JSON serialization.
- Can trigger queries after the intended unit of work.
- Can fail if the `DbContext` is disposed.
- Can make performance unpredictable.
- Proxies require `virtual` navigations and inheritable classes.
- Lazy loading is usually not recommended for high-performance APIs.

For production APIs, eager loading or projection is usually preferred because database access is visible and predictable.

### The N+1 Query Problem

The N+1 query problem happens when an application executes:

- 1 query to load a list of parent records.
- N additional queries to load related data for each parent.

Example with lazy loading:

```csharp
var blogs = await context.Blogs.ToListAsync();

foreach (var blog in blogs)
{
    foreach (var post in blog.Posts)
    {
        Console.WriteLine($"{blog.Url}: {post.Title}");
    }
}
```

If lazy loading is enabled:

1. `context.Blogs.ToListAsync()` loads all blogs.
2. Accessing `blog.Posts` for the first blog loads posts for blog 1.
3. Accessing `blog.Posts` for the second blog loads posts for blog 2.
4. This continues for every blog.

If there are 100 blogs, the application may execute 101 queries.

This is called N+1 because there is one initial query plus one query for each of N parent rows.

### Why N+1 Is Dangerous

N+1 is dangerous because it often looks harmless in code.

```csharp
foreach (var order in orders)
{
    Console.WriteLine(order.Customer.Name);
}
```

This simple loop may execute one query per order if `Customer` is lazy-loaded.

Problems caused by N+1:

- Many database roundtrips.
- High latency.
- Increased database load.
- Poor scalability.
- Production-only performance issues.
- Hard-to-notice performance bugs.
- Slow API endpoints.
- Timeouts under real data volume.

N+1 often appears when:

- Lazy loading is enabled.
- Explicit loading is used inside a loop.
- Navigation properties are accessed in serialization.
- Mapping code accesses unloaded navigations.
- Logging or debugging touches navigation properties.
- Razor views or API DTO mappers access navigation properties repeatedly.

### Fixing N+1 with Eager Loading

If you know you need related data, use eager loading.

Problem:

```csharp
var blogs = await context.Blogs.ToListAsync();

foreach (var blog in blogs)
{
    foreach (var post in blog.Posts)
    {
        Console.WriteLine(post.Title);
    }
}
```

Fix:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .ToListAsync();

foreach (var blog in blogs)
{
    foreach (var post in blog.Posts)
    {
        Console.WriteLine(post.Title);
    }
}
```

Now EF Core knows up front that posts are needed.

### Fixing N+1 with Projection

Projection is often the best fix for read-only endpoints.

Problem:

```csharp
var blogs = await context.Blogs.ToListAsync();

var response = blogs.Select(b => new BlogSummaryDto
{
    Id = b.Id,
    Url = b.Url,
    PostTitles = b.Posts.Select(p => p.Title).ToList()
});
```

This may trigger N+1 if posts are lazy-loaded.

Fix:

```csharp
var response = await context.Blogs
    .AsNoTracking()
    .Select(b => new BlogSummaryDto
    {
        Id = b.Id,
        Url = b.Url,
        PostTitles = b.Posts
            .OrderBy(p => p.Title)
            .Select(p => p.Title)
            .ToList()
    })
    .ToListAsync();
```

This lets EF Core translate the required shape into SQL and avoids loading full entity graphs unnecessarily.

### Fixing N+1 with Batched Queries

Sometimes you may not want a single large include. You can use batched queries.

Example:

```csharp
var blogs = await context.Blogs
    .AsNoTracking()
    .Where(b => b.Url.Contains("dotnet"))
    .ToListAsync();

var blogIds = blogs.Select(b => b.Id).ToList();

var posts = await context.Posts
    .AsNoTracking()
    .Where(p => blogIds.Contains(p.BlogId))
    .ToListAsync();
```

Then group in memory:

```csharp
var postsByBlogId = posts
    .GroupBy(p => p.BlogId)
    .ToDictionary(g => g.Key, g => g.ToList());

var response = blogs.Select(b => new BlogSummaryDto
{
    Id = b.Id,
    Url = b.Url,
    PostTitles = postsByBlogId.TryGetValue(b.Id, out var blogPosts)
        ? blogPosts.Select(p => p.Title).ToList()
        : new List<string>()
}).ToList();
```

This uses 2 queries instead of 1 + N queries.

This approach is useful when:

- You want control over SQL.
- You need multiple separate query shapes.
- `Include` would create too much duplication.
- You are building read models.
- You want to avoid tracking a large graph.

### Single Queries and Join Duplication

By default, eager loading collections often uses joins in one SQL query.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .ToListAsync();
```

This can duplicate blog data for each post row in the SQL result.

Example:

| BlogId | BlogUrl | PostId | PostTitle |
|---|---|---|---|
| 1 | example.com | 10 | A |
| 1 | example.com | 11 | B |
| 1 | example.com | 12 | C |

The blog data appears once per post row. EF Core materializes this back into one `Blog` object with multiple `Post` objects in tracking queries.

This duplication is normal for joins. It becomes a problem when:

- Parent rows have large columns.
- There are many child rows.
- Multiple collection navigations are included.
- The result set becomes much larger than expected.

Projection can avoid selecting huge parent columns.

```csharp
var blogs = await context.Blogs
    .Select(b => new
    {
        b.Id,
        b.Url,
        Posts = b.Posts.Select(p => new
        {
            p.Id,
            p.Title
        }).ToList()
    })
    .ToListAsync();
```

### Cartesian Explosion

Cartesian explosion happens when a query includes multiple collection navigations at the same level.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .Include(b => b.Contributors)
    .ToListAsync();
```

If one blog has:

- 10 posts.
- 10 contributors.

The join can produce 100 rows for that one blog.

The more sibling collections you include, the larger the result can become.

This is a common reason to avoid blindly adding many `Include` statements.

Possible fixes:

- Use projection.
- Use `AsSplitQuery()`.
- Load separate collections with separate queries.
- Limit related data with filtered include.
- Reconsider the API response shape.
- Add pagination.
- Avoid returning huge nested object graphs.

### Split Queries

Split queries tell EF Core to load included collection navigations using multiple SQL queries instead of one large join.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .Include(b => b.Contributors)
    .AsSplitQuery()
    .ToListAsync();
```

Instead of one SQL query with multiple joins, EF Core executes separate SQL queries for the main entity and included collections.

Benefits:

- Avoids cartesian explosion.
- Can reduce duplicated parent data.
- Can make large includes more manageable.
- Often helpful when loading multiple collection navigations.

Trade-offs:

- Executes multiple database roundtrips.
- Results may be less consistent if data changes between queries.
- May require buffering internally.
- Needs careful ordering when combined with pagination in older EF Core versions.
- Not always faster.

You can also choose single query explicitly:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .AsSingleQuery()
    .ToListAsync();
```

A strong interview answer should say: `AsSplitQuery()` is not a universal performance fix. It is useful for avoiding cartesian explosion, but it has trade-offs.

### Configuring Split Queries Globally

You can configure split query behavior globally for a context.

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(
        connectionString,
        sqlOptions =>
        {
            sqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
        });
});
```

You can still override per query:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .AsSingleQuery()
    .ToListAsync();
```

Global split query can be useful in systems that frequently load multiple collections, but it should be chosen carefully and tested.

### `AutoInclude`

`AutoInclude` configures a navigation to be automatically included whenever the entity is queried.

Example:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Blog>()
        .Navigation(b => b.Owner)
        .AutoInclude();
}
```

Now queries for `Blog` will automatically include `Owner`.

```csharp
var blogs = await context.Blogs.ToListAsync();
// Owner is automatically loaded.
```

Benefits:

- Useful for small reference navigations that are almost always needed.
- Reduces repeated `Include` code.
- Makes common query behavior consistent.

Trade-offs:

- Can hide data loading.
- Can load more data than expected.
- Can surprise developers who do not know the model configuration.
- Can affect performance across many queries.

For interview answers, mention that `AutoInclude` should be used sparingly and intentionally.

### Tracking, Identity Resolution, and Navigation Fix-Up

EF Core tracking queries track returned entities in the `DbContext`.

Tracking has an important related-data behavior called **navigation fix-up**. When EF Core loads related entities, it automatically connects navigation properties between tracked instances.

Example:

```csharp
var blog = await context.Blogs
    .SingleAsync(b => b.Id == blogId);

var posts = await context.Posts
    .Where(p => p.BlogId == blogId)
    .ToListAsync();
```

Even though the second query did not use `Include`, EF Core can fix up the relationship:

```csharp
var loadedPosts = blog.Posts;
```

If tracking is enabled, `blog.Posts` may now contain the loaded posts.

This can be useful, but it can also surprise developers, especially with filtered include.

Example:

```csharp
var oldPosts = await context.Posts
    .Where(p => p.Id < 100)
    .ToListAsync();

var blogs = await context.Blogs
    .Include(b => b.Posts.Where(p => p.Id > 500))
    .ToListAsync();
```

Because the context is already tracking some posts, navigation fix-up may make the loaded graph contain more data than the filtered include suggests.

For predictable read-only queries, consider:

```csharp
var blogs = await context.Blogs
    .AsNoTracking()
    .Include(b => b.Posts.Where(p => p.Id > 500))
    .ToListAsync();
```

### `AsNoTracking` and Related Data

`AsNoTracking()` tells EF Core not to track returned entities.

```csharp
var blogs = await context.Blogs
    .AsNoTracking()
    .Include(b => b.Posts)
    .ToListAsync();
```

Benefits:

- Lower overhead for read-only queries.
- Avoids some navigation fix-up surprises.
- Often better for API read endpoints.
- Reduces memory usage in many scenarios.

Trade-off:

- Returned entities are not tracked for updates.
- Identity resolution is not performed by default.
- The same database row may become multiple object instances if it appears multiple times.

EF Core also supports no-tracking with identity resolution:

```csharp
var blogs = await context.Blogs
    .AsNoTrackingWithIdentityResolution()
    .Include(b => b.Posts)
    .ToListAsync();
```

This can be useful when you want no tracking but still want repeated rows to refer to the same object instance in the result.

### Serialization and Lazy Loading

Lazy loading can be especially dangerous in APIs that serialize entities directly.

Example:

```csharp
[HttpGet("blogs")]
public async Task<IActionResult> GetBlogs()
{
    var blogs = await context.Blogs.ToListAsync();

    return Ok(blogs);
}
```

If lazy loading is enabled, JSON serialization may access navigation properties and trigger more database queries.

Problems:

- Unexpected N+1 queries during serialization.
- Circular reference issues.
- Huge response payloads.
- Queries run after controller logic appears complete.
- Performance varies depending on serializer behavior.
- Exposes internal entity shape to API clients.

Better approach:

```csharp
[HttpGet("blogs")]
public async Task<IActionResult> GetBlogs()
{
    var blogs = await context.Blogs
        .AsNoTracking()
        .Select(b => new BlogSummaryDto
        {
            Id = b.Id,
            Url = b.Url,
            PostCount = b.Posts.Count
        })
        .ToListAsync();

    return Ok(blogs);
}
```

For production APIs, prefer DTO projection over returning EF entities directly.

### Diagnosing N+1 Queries

You can diagnose N+1 by inspecting executed SQL.

Common methods:

- Enable EF Core logging.
- Use `LogTo` in `DbContextOptions`.
- Use Application Insights or OpenTelemetry traces.
- Use SQL Server Profiler or Extended Events.
- Use database query store.
- Use MiniProfiler.
- Review generated SQL with `ToQueryString()`.
- Add integration tests for query count in critical paths.

Example logging:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options
        .UseSqlServer(connectionString)
        .LogTo(Console.WriteLine, LogLevel.Information)
        .EnableSensitiveDataLogging();
});
```

`EnableSensitiveDataLogging()` should generally be used only in development because it can log parameter values and sensitive data.

Example `ToQueryString()`:

```csharp
var query = context.Blogs
    .Include(b => b.Posts)
    .Where(b => b.Url.Contains("dotnet"));

var sql = query.ToQueryString();

Console.WriteLine(sql);
```

`ToQueryString()` helps inspect the SQL shape before executing a query.

### Choosing a Loading Strategy

Use eager loading when:

- You know related data is needed.
- You need a full aggregate or object graph.
- You want database access visible in the query.
- You want to avoid lazy loading surprises.
- You can control result size.

Use projection when:

- You are building API responses.
- You need only specific columns.
- You are building read models.
- You want better performance and smaller payloads.
- You do not need to update the returned entities.

Use explicit loading when:

- Related data is needed only under certain conditions.
- You load one entity and then decide what else is needed.
- You want database roundtrips to be visible and controlled.
- You need to query a navigation with aggregate operations.

Use lazy loading rarely and carefully when:

- The application is small.
- Data access patterns are simple.
- You accept hidden database calls.
- You have strong monitoring for query counts.
- You are not serializing EF entities directly.

Avoid lazy loading when:

- Building public APIs.
- Returning EF entities from controllers.
- Working with large datasets.
- Query performance must be predictable.
- The team is not carefully monitoring SQL.
- You frequently access navigations in loops.

### Common Mistakes

Common mistakes include:

- Enabling lazy loading globally without understanding N+1.
- Returning EF entities directly from API controllers.
- Accessing lazy-loaded navigations during JSON serialization.
- Using `Include` for every navigation without considering payload size.
- Using explicit loading inside loops.
- Forgetting `ThenInclude` for deeper relationships.
- Including multiple sibling collections and causing cartesian explosion.
- Not using `AsSplitQuery()` when a single query produces a huge join.
- Using `AsSplitQuery()` everywhere without measuring.
- Loading full entities when projection would be enough.
- Forgetting `AsNoTracking()` for read-only endpoints.
- Assuming filtered include always ignores previously tracked entities.
- Not reviewing generated SQL.
- Not limiting result size with pagination.
- Not adding indexes for foreign keys and query filters.
- Calling `ToListAsync()` too early and then filtering in memory.
- Mixing query logic and entity serialization in a way that hides database access.

### Best Practices

Prefer projection for read-only API endpoints.

Use eager loading when you know the related data is needed.

Use explicit loading for conditional or targeted related data loading.

Avoid lazy loading by default in production APIs.

Do not return EF Core entities directly from controllers.

Use DTOs for API responses.

Use `AsNoTracking()` for read-only queries.

Use filtered include to limit related collections when appropriate.

Use pagination when loading parent collections.

Use `AsSplitQuery()` when multiple included collections create cartesian explosion, but measure performance.

Inspect generated SQL for important queries.

Enable EF Core logging in development.

Watch for repeated SQL patterns that indicate N+1.

Avoid explicit loading inside loops unless the loop size is small and intentional.

Use `ToQueryString()` to understand query shape.

Review performance with realistic data volume, not only small test databases.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q01 -->
#### Beginner Q01: What are the three main ways to load related data in EF Core?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

The three main ways to load related data in EF Core are eager loading, explicit loading, and lazy loading.

Eager loading loads related data as part of the original query, usually with `Include` and `ThenInclude`.

Explicit loading loads related data later with an explicit command, such as `context.Entry(entity).Collection(...).LoadAsync()`.

Lazy loading loads related data automatically when a navigation property is accessed, but it must be enabled and should be used carefully because it can cause hidden database queries and N+1 problems.

##### Key Points to Mention

- Eager loading uses `Include` and `ThenInclude`.
- Explicit loading uses `Entry`, `Reference`, `Collection`, and `LoadAsync`.
- Lazy loading triggers when navigation properties are accessed.
- Lazy loading is not enabled by default in EF Core.
- Each strategy has performance trade-offs.
- Choose the strategy based on the use case.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q01 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q02 -->
#### Beginner Q02: What is eager loading?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Eager loading means loading related data as part of the original query. In EF Core, this is commonly done with `Include`.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .ToListAsync();
```

This loads blogs and their posts together. Eager loading is useful when you know in advance that related data is needed.

##### Key Points to Mention

- Loads related data with the initial query.
- Uses `Include`.
- Uses `ThenInclude` for deeper relationships.
- Helps avoid N+1 queries.
- Can load too much data if overused.
- Can create large SQL joins.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q02 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q03 -->
#### Beginner Q03: What is explicit loading?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Explicit loading means loading related data after the main entity has already been loaded, using an explicit command.

Example:

```csharp
var blog = await context.Blogs
    .SingleAsync(b => b.Id == blogId);

await context.Entry(blog)
    .Collection(b => b.Posts)
    .LoadAsync();
```

Explicit loading is useful when related data is needed only under certain conditions.

##### Key Points to Mention

- Loads related data later.
- Uses `DbContext.Entry`.
- Uses `Reference` for one related entity.
- Uses `Collection` for many related entities.
- Database roundtrips are visible in code.
- Can still cause N+1 if used inside loops.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q03 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q04 -->
#### Beginner Q04: What is lazy loading?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Lazy loading means related data is loaded automatically when a navigation property is accessed.

Example:

```csharp
var blog = await context.Blogs.SingleAsync(b => b.Id == blogId);

var posts = blog.Posts; // May trigger a database query.
```

In EF Core, lazy loading must be enabled, often with lazy-loading proxies. It can be convenient but risky because normal property access can trigger database queries.

##### Key Points to Mention

- Loads related data on navigation access.
- Not enabled by default in EF Core.
- Can use lazy-loading proxies.
- Proxies usually require `virtual` navigations.
- Can hide database queries.
- Can easily cause N+1 problems.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q04 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q05 -->
#### Beginner Q05: What is the N+1 query problem?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

The N+1 query problem happens when an application runs one query to load parent records, then runs one additional query for each parent record to load related data.

Example:

```csharp
var blogs = await context.Blogs.ToListAsync();

foreach (var blog in blogs)
{
    foreach (var post in blog.Posts)
    {
        Console.WriteLine(post.Title);
    }
}
```

If lazy loading is enabled, this can run one query for blogs plus one query for each blog's posts. If there are 100 blogs, the application may run 101 queries.

##### Key Points to Mention

- One initial query plus N related queries.
- Often caused by lazy loading.
- Can also happen with explicit loading inside loops.
- Causes many database roundtrips.
- Often works in development but fails under production data.
- Fixed with eager loading, projection, or batched queries.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q05 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q06 -->
#### Beginner Q06: What is `ThenInclude` used for?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

`ThenInclude` is used after `Include` to load deeper levels of related data.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
        .ThenInclude(p => p.Author)
    .ToListAsync();
```

This loads blogs, their posts, and each post's author.

##### Key Points to Mention

- Used for nested relationships.
- Comes after `Include`.
- Can chain multiple levels.
- Useful for loading object graphs.
- Should be used carefully to avoid large queries.
- Projection may be better for read-only API responses.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q01 -->
#### Intermediate Q01: When would you use eager loading instead of explicit or lazy loading?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use eager loading when you know up front that related data is needed. For example, if an API endpoint always returns orders with their order lines, eager loading or projection should be used instead of waiting for each navigation to load separately.

Example:

```csharp
var orders = await context.Orders
    .Include(o => o.Lines)
    .ToListAsync();
```

Eager loading makes database access visible and helps avoid N+1 queries. However, it should not be used blindly for every navigation because it can load too much data or create large joins.

##### Key Points to Mention

- Use when related data is known in advance.
- Helps avoid N+1 queries.
- Makes data loading explicit in the query.
- Can be combined with filtered include.
- Can cause large joins if overused.
- Projection may be better for read-only responses.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q01 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q02 -->
#### Intermediate Q02: Why is lazy loading often discouraged in Web APIs?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Lazy loading is often discouraged in Web APIs because it hides database queries behind property access. This can cause N+1 queries, unpredictable performance, and extra database calls during JSON serialization.

For example, returning EF entities directly from an API can cause the serializer to access navigation properties, which may trigger lazy loading. This can create huge response payloads, circular references, and many unexpected SQL queries.

A better approach is to use projection into DTOs.

```csharp
var blogs = await context.Blogs
    .AsNoTracking()
    .Select(b => new BlogSummaryDto
    {
        Id = b.Id,
        Url = b.Url,
        PostCount = b.Posts.Count
    })
    .ToListAsync();
```

##### Key Points to Mention

- Lazy loading hides database roundtrips.
- Serialization can trigger lazy loading.
- Can cause N+1 queries.
- Can cause circular reference issues.
- Can expose too much data.
- DTO projection is safer for APIs.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q02 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q03 -->
#### Intermediate Q03: What is the difference between `Include` and projection with `Select`?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Include` loads related entities into an entity graph. It is useful when you need tracked entities or need to work with the full object graph.

Projection with `Select` shapes the query result into a DTO, anonymous type, or read model. It loads only the columns and nested data required by the output.

Example projection:

```csharp
var blogs = await context.Blogs
    .Select(b => new BlogSummaryDto
    {
        Id = b.Id,
        Url = b.Url,
        PostCount = b.Posts.Count
    })
    .ToListAsync();
```

For read-only API responses, projection is often better because it avoids loading unnecessary columns and avoids returning EF entities directly.

##### Key Points to Mention

- `Include` loads entities and navigations.
- `Select` shapes the result.
- Projection can reduce selected columns.
- Projection is often better for DTOs and APIs.
- `Include` is useful when updating or working with tracked graphs.
- Projection usually avoids over-fetching.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q03 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q04 -->
#### Intermediate Q04: How can explicit loading cause the N+1 problem?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Explicit loading can cause N+1 when it is used inside a loop over parent entities.

Example:

```csharp
var blogs = await context.Blogs.ToListAsync();

foreach (var blog in blogs)
{
    await context.Entry(blog)
        .Collection(b => b.Posts)
        .LoadAsync();
}
```

This runs one query for blogs, then one query per blog for posts. If there are 100 blogs, it can run 101 queries.

The fix is to eager load, project, or batch-load related data.

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .ToListAsync();
```

##### Key Points to Mention

- Explicit loading is not automatically safe.
- Loading inside loops can create N+1.
- Use eager loading when all related data is needed.
- Use batched queries when you need more control.
- Use projection for read models.
- Monitor SQL query count.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q04 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q05 -->
#### Intermediate Q05: What is a filtered include?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

A filtered include applies filtering, ordering, or limiting to an included collection navigation.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts
        .Where(p => p.Title.Contains("EF Core"))
        .OrderByDescending(p => p.Id)
        .Take(5))
    .ToListAsync();
```

This loads each blog with only matching posts.

Filtered include is useful when you need related data but not the entire collection. In tracking queries, previously tracked entities can affect results through navigation fix-up, so `AsNoTracking()` or a fresh `DbContext` may be better for predictable results.

##### Key Points to Mention

- Filters included collection navigations.
- Supports operations like `Where`, `OrderBy`, `Skip`, and `Take`.
- Helps reduce related data size.
- Applies to collection navigations.
- Tracking queries can be affected by navigation fix-up.
- Useful for limiting child collections.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q05 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q06 -->
#### Intermediate Q06: What is cartesian explosion in EF Core queries?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cartesian explosion happens when a query includes multiple collection navigations at the same level, causing the database to return a cross product of related rows.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .Include(b => b.Contributors)
    .ToListAsync();
```

If one blog has 10 posts and 10 contributors, the join may produce 100 rows for that blog. This increases result size and can hurt performance.

Possible fixes include projection, split queries, filtering related collections, or loading data separately.

##### Key Points to Mention

- Usually caused by multiple sibling collection includes.
- Produces cross-product rows.
- Can greatly increase result size.
- Different from simple parent row duplication.
- `AsSplitQuery()` can help.
- Projection can often produce a better query shape.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q06 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q07 -->
#### Intermediate Q07: What is `AsSplitQuery()` and when should you use it?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

`AsSplitQuery()` tells EF Core to load included collection navigations using multiple SQL queries instead of one large join query.

Example:

```csharp
var blogs = await context.Blogs
    .Include(b => b.Posts)
    .Include(b => b.Contributors)
    .AsSplitQuery()
    .ToListAsync();
```

It is useful when a single query would cause cartesian explosion or a very large joined result. However, it also has trade-offs, such as multiple database roundtrips and possible consistency concerns if data changes between queries.

##### Key Points to Mention

- Splits includes into multiple SQL queries.
- Helps avoid cartesian explosion.
- Useful for multiple collection includes.
- Can reduce duplicated data.
- Adds additional roundtrips.
- Should be measured, not applied blindly.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q07 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q08 -->
#### Intermediate Q08: How do you detect an N+1 query problem?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

You detect N+1 by observing repeated SQL queries that differ only by a parameter value, usually after loading a list of parent entities.

Common tools and techniques include EF Core logging, `LogTo`, Application Insights, OpenTelemetry traces, database profiler tools, MiniProfiler, and reviewing generated SQL with `ToQueryString()`.

Example logging setup:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options
        .UseSqlServer(connectionString)
        .LogTo(Console.WriteLine, LogLevel.Information);
});
```

If you see one parent query followed by many similar child queries, that is a strong sign of N+1.

##### Key Points to Mention

- Look for repeated SQL queries.
- Enable EF Core command logging.
- Use profiling tools.
- Use `ToQueryString()` for query shape.
- Test with realistic data volume.
- N+1 often appears only under larger datasets.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q01 -->
#### Advanced Q01: How would you choose between eager loading, explicit loading, lazy loading, and projection in a production API?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For a production API, projection is usually the first choice for read-only responses because it loads only the fields required by the response DTO and avoids exposing EF entities. It also avoids many lazy loading and serialization issues.

Eager loading is appropriate when the application needs a full entity graph or aggregate and knows the related data is required. Explicit loading is useful when related data is needed conditionally after the main entity is loaded. Lazy loading should generally be avoided in APIs because it hides database roundtrips and can cause N+1 queries during mapping or serialization.

The decision should consider query shape, result size, update requirements, tracking needs, and performance measurements.

##### Key Points to Mention

- Projection is usually best for read-only API DTOs.
- Eager loading is good when related data is known in advance.
- Explicit loading is good for conditional loading.
- Lazy loading is risky in APIs.
- Avoid returning EF entities directly.
- Measure SQL and performance with realistic data.
- Consider tracking and no-tracking behavior.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q01 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q02 -->
#### Advanced Q02: How does tracking affect related data loading?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

In tracking queries, EF Core tracks entity instances in the `DbContext`. When related entities are loaded, EF Core performs navigation fix-up, which connects navigations between already tracked entities.

This means a navigation may appear populated even if the current query did not explicitly include it, because related entities were already loaded into the same context.

This can be useful, but it can also cause surprises with filtered include. Previously tracked entities may appear in a navigation even if they do not match the current filtered include.

For read-only predictable results, use `AsNoTracking()` or a fresh `DbContext`.

##### Key Points to Mention

- Tracking queries store entities in the change tracker.
- EF Core performs identity resolution.
- EF Core performs navigation fix-up.
- Previously loaded entities can populate navigations.
- Filtered include can be affected by tracked entities.
- `AsNoTracking()` gives more predictable read-only results.
- `AsNoTrackingWithIdentityResolution()` is available when identity resolution is needed without tracking.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q02 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q03 -->
#### Advanced Q03: What are the trade-offs of split queries compared with single queries?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Single queries use joins to load related data. They can be efficient for simple includes, but they can duplicate parent data and cause cartesian explosion when multiple collection navigations are included.

Split queries avoid large join result sets by executing multiple SQL queries. They can reduce row duplication and avoid cartesian explosion, but they require additional roundtrips, may buffer results internally, and may see inconsistent data if the database changes between the split queries.

The best choice depends on query shape, data volume, network latency, transaction requirements, and measurement.

##### Key Points to Mention

- Single query uses joins.
- Single query can duplicate parent data.
- Multiple collection includes can cause cartesian explosion.
- Split query uses multiple SQL queries.
- Split query can avoid huge joined results.
- Split query adds roundtrips.
- Measure both options for important queries.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q03 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q04 -->
#### Advanced Q04: How would you fix an endpoint that suffers from N+1 queries?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

First, confirm the N+1 problem by enabling SQL logging or profiling. Identify the repeated queries and the navigation access that triggers them.

Then choose a fix based on the endpoint's purpose. For a read-only API response, use projection into a DTO. For an entity graph that must be updated, use eager loading with `Include`. If multiple collections cause a huge joined result, consider `AsSplitQuery()`. If the related data is conditionally needed, use explicit loading carefully and avoid loading inside large loops. For complex read models, consider batched queries.

Also add tests or monitoring to prevent the issue from returning.

##### Key Points to Mention

- Confirm with logs or profiler.
- Find the navigation causing repeated queries.
- Use projection for read-only API responses.
- Use eager loading when the graph is needed.
- Use split queries for multiple large collections.
- Avoid explicit loading inside loops.
- Add monitoring or tests for query count.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q04 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q05 -->
#### Advanced Q05: Why can returning EF entities directly from controllers be problematic?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Returning EF entities directly from controllers can expose internal database structure, create circular reference problems, return more data than intended, and trigger lazy loading during serialization. If lazy loading is enabled, the serializer may access navigation properties and cause unexpected SQL queries or N+1 problems.

It also couples the API contract to the persistence model, making future schema or domain changes harder.

A better approach is to project into DTOs.

```csharp
var result = await context.Blogs
    .AsNoTracking()
    .Select(b => new BlogSummaryDto
    {
        Id = b.Id,
        Url = b.Url,
        PostCount = b.Posts.Count
    })
    .ToListAsync();
```

##### Key Points to Mention

- Can expose internal entity structure.
- Can cause circular references.
- Can serialize too much data.
- Can trigger lazy loading.
- Couples API contract to persistence model.
- DTO projection is safer and clearer.
- Helps avoid over-fetching.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q05 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q06 -->
#### Advanced Q06: When would you use `AutoInclude`, and what are its risks?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

`AutoInclude` is useful when a navigation is almost always needed whenever the entity is loaded, especially small reference navigations such as lookup or owner data.

Example:

```csharp
modelBuilder.Entity<Blog>()
    .Navigation(b => b.Owner)
    .AutoInclude();
```

The risk is that it hides data loading in model configuration. Developers may query `Blogs` without realizing `Owner` is always included. This can cause over-fetching or unexpected query complexity across the application.

It should be used sparingly and documented clearly.

##### Key Points to Mention

- Automatically includes a navigation.
- Useful for commonly needed small references.
- Configured in the model.
- Can hide loading behavior.
- Can cause over-fetching.
- Should be used intentionally and sparingly.
- Be careful in large systems.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q06 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q07 -->
#### Advanced Q07: How can projection avoid both over-fetching and N+1?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Projection uses `Select` to tell EF Core exactly what shape and columns are needed. Instead of loading full entities and navigating them later, projection builds the required DTO directly from the query.

Example:

```csharp
var blogs = await context.Blogs
    .AsNoTracking()
    .Select(b => new BlogSummaryDto
    {
        Id = b.Id,
        Url = b.Url,
        PostCount = b.Posts.Count,
        LatestPostTitles = b.Posts
            .OrderByDescending(p => p.Id)
            .Take(3)
            .Select(p => p.Title)
            .ToList()
    })
    .ToListAsync();
```

This avoids over-fetching because unnecessary columns are not selected. It avoids N+1 because related data access is part of the translated query instead of being triggered later by navigation property access.

##### Key Points to Mention

- Projection shapes the result in SQL.
- Loads only required columns.
- Avoids returning EF entities.
- Avoids navigation access after materialization.
- Good for read-only DTOs.
- Often better than `Include` for APIs.
- Still review generated SQL for complex projections.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q07 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q08 -->
#### Advanced Q08: What would you check before adding many `Include` statements to a query?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Before adding many `Include` statements, check whether the endpoint really needs full entities or only a DTO projection. Check the expected number of parent rows, average number of child rows, whether multiple collection navigations are included, whether the query needs pagination, and whether any parent table has large columns.

Also inspect the generated SQL and consider whether `AsSplitQuery()` is needed to avoid cartesian explosion. If the response is read-only, projection may be better than loading a full entity graph.

##### Key Points to Mention

- Confirm the data is actually needed.
- Consider projection first for read-only responses.
- Check parent and child row counts.
- Watch for multiple sibling collection includes.
- Watch for large parent columns.
- Use pagination.
- Inspect generated SQL.
- Consider `AsSplitQuery()` when appropriate.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q08 -->

<!-- question:start:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q09 -->
#### Advanced Q09: How would you explain the difference between N+1 and cartesian explosion?

<!-- question-id:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

N+1 is a roundtrip problem. It happens when the application executes one query for parent records and then one additional query per parent record for related data.

Cartesian explosion is a result-size problem. It happens when a single SQL query joins multiple collection navigations at the same level and produces a cross product of related rows.

N+1 usually comes from lazy loading or explicit loading inside loops. Cartesian explosion usually comes from eager loading multiple sibling collections in one query.

Fixes are different. N+1 is often fixed with projection, eager loading, or batched queries. Cartesian explosion is often fixed with projection, split queries, filtering includes, or changing the response shape.

##### Key Points to Mention

- N+1 means too many SQL queries.
- Cartesian explosion means one SQL query returns too many rows.
- N+1 often comes from lazy loading.
- Cartesian explosion often comes from multiple collection includes.
- Fixes are related but not identical.
- Both require inspecting SQL and data volume.

<!-- question:end:eager-explicit-and-lazy-loading-including-the-n-plus-one-query-problem-advanced-q09 -->

<!-- interview-questions:end -->
