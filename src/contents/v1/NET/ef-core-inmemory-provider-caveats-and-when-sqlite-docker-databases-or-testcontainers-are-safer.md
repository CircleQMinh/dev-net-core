---
id: ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer
topic: Testing strategy and integration testing
subtopic: EF Core InMemory Provider Caveats and When SQLite, Docker Databases, or Testcontainers Are Safer
category: .NET
---


## Overview

EF Core applications often need tests that verify database-related behavior. The challenge is deciding whether the test should use the real production database provider, a lightweight relational substitute such as SQLite, the EF Core InMemory provider, Docker-based databases, Testcontainers, or a mocked repository layer.

The EF Core InMemory provider is tempting because it is simple and fast to configure. However, it is not a relational database. It does not behave like SQL Server, PostgreSQL, MySQL, or SQLite in many important ways. This means tests can pass with the InMemory provider but fail in production.

This topic is about choosing a safe database testing strategy.

The main options are:

1. **EF Core InMemory provider**: A non-relational in-memory provider for simple testing scenarios.
2. **SQLite in-memory**: A lightweight relational provider that can run fully in memory.
3. **Docker database**: A real database server running in a container.
4. **Testcontainers**: A test library that starts and stops Docker containers from test code.
5. **Repository or data-access abstraction**: A layer that allows unit tests to mock query results without running EF Core queries.
6. **Dedicated test database**: A real database instance or database-per-test setup.

This topic matters because database behavior is full of details that fake providers may not reproduce:

- Foreign key constraints.
- Unique indexes.
- Transactions.
- Rollbacks.
- Raw SQL.
- Provider-specific SQL functions.
- Case sensitivity.
- Collations.
- Null comparison semantics.
- Query translation.
- Migrations.
- Computed columns.
- Default values.
- Concurrency tokens.
- Cascade delete behavior.
- Date/time functions.
- JSON columns.
- Stored procedures.
- Performance and indexes.

This topic is important for interviews because it tests whether a developer understands the difference between fast tests and trustworthy tests. A strong candidate should know when the InMemory provider is acceptable, when it is dangerous, why SQLite is safer but still not perfect, and when a real containerized database is the best option.

## Core Concepts

### Why Database Testing Strategy Matters

Database code is not just normal C# logic. When using EF Core, important behavior depends on the database provider.

Example:

```csharp
var users = await context.Users
    .Where(u => u.Email == "MINH@example.com")
    .ToListAsync();
```

This query may behave differently depending on the provider:

- SQL Server may compare strings case-insensitively depending on collation.
- SQLite is often case-sensitive by default.
- PostgreSQL is usually case-sensitive unless configured otherwise.
- EF Core InMemory compares using .NET behavior, not SQL behavior.

A test that passes against one provider does not always prove the code works against another provider.

Database testing strategy matters because tests should catch production bugs, not hide them.

### What the EF Core InMemory Provider Is

The EF Core InMemory provider stores data in memory instead of using a relational database.

Typical setup:

```csharp
var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseInMemoryDatabase("TestDatabase")
    .Options;

using var context = new AppDbContext(options);
```

It is useful for very simple tests where you only need to store and retrieve objects through EF Core APIs.

Example:

```csharp
context.Products.Add(new Product
{
    Id = 1,
    Name = "Keyboard"
});

await context.SaveChangesAsync();

var product = await context.Products
    .SingleAsync(p => p.Id == 1);
```

However, the InMemory provider is not relational. It is not a SQL database running in memory. It behaves more like an in-memory object store behind EF Core.

That distinction is critical.

### Why InMemory Is Not a Relational Database

A relational database enforces relational rules and executes SQL-like behavior.

Relational behavior includes:

- Foreign keys.
- Unique constraints.
- Required columns.
- Transactions.
- Rollbacks.
- SQL translation.
- SQL null semantics.
- Collation.
- Joins executed by the database engine.
- Raw SQL.
- Migrations.
- Computed columns.
- Default constraints.
- Cascade delete constraints.

The InMemory provider does not behave like a relational engine. This means it can hide bugs that would occur in a real database.

Example: foreign key issue.

```csharp
context.Orders.Add(new Order
{
    Id = 1,
    CustomerId = 999
});

await context.SaveChangesAsync();
```

If no customer with `Id = 999` exists, a relational database with a foreign key constraint should reject this. The InMemory provider may allow it because it does not enforce relational constraints the same way.

This can make tests pass even though production would fail.

### InMemory Provider Caveats

Important caveats include:

| Area | InMemory Caveat |
|---|---|
| Relational constraints | Foreign keys and unique constraints are not enforced like a relational database |
| Transactions | Transaction behavior is not supported like a relational database |
| Raw SQL | Raw SQL queries are not supported |
| Query translation | Queries are not translated to real SQL |
| Provider-specific methods | SQL Server/PostgreSQL-specific functions cannot be tested |
| Case sensitivity | Behavior can differ from production provider |
| Null semantics | Behavior can differ from SQL semantics |
| Migrations | Does not validate real relational schema migrations |
| Default values | Database defaults may not behave the same |
| Computed columns | Not equivalent to real database computed columns |
| Performance | Does not represent production query performance |
| Indexes | Does not test index usage or query plans |
| Concurrency | Does not fully represent real database concurrency behavior |

The key problem is false confidence. Tests may pass because the fake provider is more forgiving than production.

### Example: Unique Constraint Not Caught

Model configuration:

```csharp
modelBuilder.Entity<User>()
    .HasIndex(u => u.Email)
    .IsUnique();
```

Production behavior should reject duplicate emails.

Test using InMemory:

```csharp
context.Users.Add(new User
{
    Email = "minh@example.com"
});

context.Users.Add(new User
{
    Email = "minh@example.com"
});

await context.SaveChangesAsync();
```

A relational database should fail because of the unique index. The InMemory provider may not enforce this the same way.

Safer test:

- Use SQLite in-memory if SQLite constraint behavior is enough.
- Use the same production provider in Docker/Testcontainers if provider accuracy matters.

### Example: Foreign Key Constraint Not Caught

Model:

```csharp
public sealed class Customer
{
    public int Id { get; set; }
    public List<Order> Orders { get; } = new();
}

public sealed class Order
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
}
```

Configuration:

```csharp
modelBuilder.Entity<Order>()
    .HasOne(o => o.Customer)
    .WithMany(c => c.Orders)
    .HasForeignKey(o => o.CustomerId)
    .IsRequired();
```

Problem test:

```csharp
context.Orders.Add(new Order
{
    Id = 1,
    CustomerId = 12345
});

await context.SaveChangesAsync();
```

A real relational database should reject this if no customer exists. InMemory may allow it.

This is dangerous because many production bugs are constraint bugs.

### Example: Transaction Behavior Not Tested

Application code:

```csharp
await using var transaction = await context.Database
    .BeginTransactionAsync(cancellationToken);

try
{
    context.Orders.Add(order);
    await context.SaveChangesAsync(cancellationToken);

    context.AuditLogs.Add(audit);
    await context.SaveChangesAsync(cancellationToken);

    await transaction.CommitAsync(cancellationToken);
}
catch
{
    await transaction.RollbackAsync(cancellationToken);
    throw;
}
```

A test using InMemory cannot reliably verify real rollback behavior because it does not support relational transactions like a real database.

If the code depends on transaction behavior, use a real relational provider.

Good choices:

- SQLite in-memory for simple relational transaction behavior.
- SQL Server/PostgreSQL/MySQL in Docker for provider-accurate transaction behavior.
- Testcontainers for automated container lifecycle.

### Example: Raw SQL Not Tested

Application code:

```csharp
var recentOrders = await context.Orders
    .FromSqlRaw("""
        SELECT *
        FROM Orders
        WHERE CreatedAtUtc >= {0}
        """, startDate)
    .ToListAsync();
```

The InMemory provider cannot execute raw SQL.

If your application uses raw SQL, stored procedures, database views, functions, or provider-specific SQL, InMemory is not suitable for testing that behavior.

Use:

- SQLite if the SQL is compatible with SQLite.
- The real database provider if SQL is provider-specific.
- Testcontainers if you want tests to create the real database automatically.

### Example: Query Translation Not Tested

EF Core query:

```csharp
var users = await context.Users
    .Where(u => EF.Functions.Like(u.Email, "%@example.com"))
    .ToListAsync();
```

Relational providers translate this into SQL. InMemory does not execute real SQL translation in the same way.

Another example:

```csharp
var orders = await context.Orders
    .Where(o => EF.Functions.DateDiffDay(o.CreatedAtUtc, DateTime.UtcNow) <= 7)
    .ToListAsync();
```

This is SQL Server-specific. It cannot be meaningfully validated using InMemory or SQLite.

If the purpose of the test is to verify that LINQ translates and executes correctly against SQL Server, the test must use SQL Server.

### Example: Case Sensitivity Differences

Suppose production uses SQL Server with case-insensitive collation.

```csharp
var user = await context.Users
    .SingleOrDefaultAsync(u => u.Email == "MINH@example.com");
```

If the database contains:

```text
minh@example.com
```

SQL Server may match it depending on collation. SQLite or InMemory may behave differently.

This matters for:

- Login by email.
- Search features.
- Unique indexes.
- Normalized fields.
- Usernames.
- Tags.
- Codes.
- Filtering and sorting.

Tests should use the provider behavior that matters for production.

### Example: Default Values and Computed Columns

Model configuration:

```csharp
modelBuilder.Entity<Order>()
    .Property(o => o.CreatedAtUtc)
    .HasDefaultValueSql("SYSUTCDATETIME()");
```

In production SQL Server, the database sets the default value.

With InMemory, there is no SQL Server default constraint. Unless your code sets `CreatedAtUtc`, the behavior may not match production.

Computed column example:

```csharp
modelBuilder.Entity<Order>()
    .Property(o => o.SearchText)
    .HasComputedColumnSql("[OrderNumber] + ' ' + [CustomerName]");
```

This cannot be properly tested with InMemory.

Use the real provider when database-generated values are important.

### Example: Navigation Fix-Up Can Hide Missing `Include`

A common issue in EF tests is accidentally relying on tracked entities from arrange setup.

Example:

```csharp
// Arrange
var customer = new Customer
{
    Id = 1,
    Name = "Alice",
    Orders =
    {
        new Order { Id = 1, OrderNumber = "ORD-001" }
    }
};

context.Customers.Add(customer);
await context.SaveChangesAsync();

// Act
var loadedCustomer = await context.Customers
    .SingleAsync(c => c.Id == 1);

// Assert
Assert.NotEmpty(loadedCustomer.Orders);
```

This test may pass because the same context is tracking `customer` and its `Orders`. In real application code using a new context, `Orders` may not be loaded unless `Include` is used.

Better test pattern:

```csharp
context.ChangeTracker.Clear();

var loadedCustomer = await context.Customers
    .Include(c => c.Orders)
    .SingleAsync(c => c.Id == 1);

Assert.NotEmpty(loadedCustomer.Orders);
```

Even better, use a relational provider and design tests around realistic query behavior.

### When the InMemory Provider Is Acceptable

The InMemory provider can still be useful in narrow cases.

Acceptable use cases:

- Simple tests that do not depend on relational behavior.
- Tests for application logic that only needs basic persistence.
- Tests where database correctness is not the focus.
- Legacy test suites that already use it.
- Very small prototypes.
- Tests for simple EF-based services where constraints, transactions, SQL, and provider behavior do not matter.

Example acceptable test:

```csharp
[Fact]
public async Task AddProduct_AddsProductToContext()
{
    var options = new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options;

    await using var context = new AppDbContext(options);

    context.Products.Add(new Product
    {
        Name = "Keyboard"
    });

    await context.SaveChangesAsync();

    Assert.Single(context.Products);
}
```

But even here, ask whether the test provides meaningful confidence.

If the test is supposed to verify database behavior, InMemory is usually the wrong tool.

### SQLite In-Memory

SQLite in-memory is a lightweight relational database option.

Setup:

```csharp
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();

var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseSqlite(connection)
    .Options;

await using var context = new AppDbContext(options);
await context.Database.EnsureCreatedAsync();
```

Important rule:

The SQLite in-memory database exists only while the connection remains open. If the connection is closed, the database is destroyed.

This is why tests often keep a shared open connection for the lifetime of the test or fixture.

### SQLite In-Memory Example with Test Fixture

Example xUnit fixture:

```csharp
public sealed class SqliteTestDatabase : IAsyncLifetime
{
    private SqliteConnection _connection = null!;

    public DbContextOptions<AppDbContext> Options { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        Options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        await using var context = new AppDbContext(Options);
        await context.Database.EnsureCreatedAsync();

        context.Categories.Add(new Category
        {
            Id = 1,
            Name = "Default"
        });

        await context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        await _connection.DisposeAsync();
    }
}
```

Test:

```csharp
public sealed class ProductRepositoryTests
    : IClassFixture<SqliteTestDatabase>
{
    private readonly SqliteTestDatabase _database;

    public ProductRepositoryTests(SqliteTestDatabase database)
    {
        _database = database;
    }

    [Fact]
    public async Task AddProduct_WithValidCategory_SavesProduct()
    {
        await using var context = new AppDbContext(_database.Options);

        context.Products.Add(new Product
        {
            Name = "Keyboard",
            CategoryId = 1
        });

        await context.SaveChangesAsync();

        var exists = await context.Products
            .AnyAsync(p => p.Name == "Keyboard");

        Assert.True(exists);
    }
}
```

SQLite gives more realistic relational behavior than InMemory, but it is still not the same as SQL Server or PostgreSQL.

### SQLite Is Safer Than InMemory, But Not Perfect

SQLite is relational, so it can test many behaviors InMemory cannot.

SQLite can help test:

- Foreign key constraints.
- Unique constraints.
- Transactions.
- Relational query translation.
- Basic raw SQL if SQL is SQLite-compatible.
- Real SQL execution.
- Migrations in some simple cases.
- Database-generated values in SQLite-compatible ways.

However, SQLite is not SQL Server, PostgreSQL, or MySQL.

SQLite differences may include:

- SQL dialect.
- Data types.
- Date/time functions.
- Case sensitivity.
- Collation.
- Decimal precision behavior.
- Schema support.
- Computed columns.
- Stored procedures.
- JSON capabilities.
- Provider-specific EF functions.
- Migration behavior.
- Concurrency behavior.
- Full-text search features.
- Index behavior.

Use SQLite when you want a fast relational fake and can accept provider differences.

Use the real database provider when provider behavior matters.

### SQLite Foreign Key Behavior

SQLite supports foreign keys, but they must be enabled. EF Core's SQLite provider usually enables them when opening a connection, but if you manage connections manually or use raw SQLite settings, verify behavior.

Example:

```csharp
context.Orders.Add(new Order
{
    CustomerId = 999
});

await Assert.ThrowsAsync<DbUpdateException>(
    () => context.SaveChangesAsync());
```

This kind of test is meaningful with a relational provider, but not with InMemory.

### SQLite Caveat: SQL Server-Specific Functions

SQL Server-specific EF function:

```csharp
var orders = await context.Orders
    .Where(o => EF.Functions.DateDiffDay(o.CreatedAtUtc, DateTime.UtcNow) < 7)
    .ToListAsync();
```

This is not portable to SQLite.

If the application uses provider-specific EF functions, the tests should use that provider.

For SQL Server:

- LocalDB on Windows.
- SQL Server Docker container.
- Testcontainers SQL Server module.
- Dedicated SQL Server test database.

For PostgreSQL:

- PostgreSQL Docker container.
- Testcontainers PostgreSQL module.
- Dedicated PostgreSQL test database.

### Docker Databases

A Docker database means running the real database engine in a container.

Example:

```text
docker run -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=Your_password123 \
  -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
```

Or PostgreSQL:

```text
docker run -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16
```

Benefits:

- Uses the real database engine.
- Tests real SQL translation.
- Tests real constraints.
- Tests migrations.
- Tests provider-specific behavior.
- Closer to production.
- Good for integration and CI tests.

Trade-offs:

- Requires Docker.
- Slower startup than InMemory or SQLite.
- Needs cleanup.
- Requires test isolation.
- CI pipeline must support containers.
- More infrastructure complexity.
- Must manage connection strings and ports.

Docker databases are safer when correctness matters more than minimal setup.

### Testcontainers

Testcontainers is a library that lets tests start and stop Docker containers programmatically.

Instead of requiring a manually running database, test code can create the container.

Example packages:

```text
dotnet add package Testcontainers.PostgreSql
dotnet add package Testcontainers.MsSql
```

Example PostgreSQL fixture:

```csharp
using DotNet.Testcontainers.Builders;
using Testcontainers.PostgreSql;

public sealed class PostgreSqlDatabaseFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container =
        new PostgreSqlBuilder()
            .WithImage("postgres:16")
            .WithDatabase("app_test")
            .WithUsername("postgres")
            .WithPassword("postgres")
            .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        await using var context = new AppDbContext(options);
        await context.Database.MigrateAsync();
    }

    public Task DisposeAsync()
    {
        return _container.DisposeAsync().AsTask();
    }
}
```

Example SQL Server fixture:

```csharp
using Testcontainers.MsSql;

public sealed class SqlServerDatabaseFixture : IAsyncLifetime
{
    private readonly MsSqlContainer _container =
        new MsSqlBuilder()
            .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
            .WithPassword("Your_password123")
            .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(ConnectionString)
            .Options;

        await using var context = new AppDbContext(options);
        await context.Database.MigrateAsync();
    }

    public Task DisposeAsync()
    {
        return _container.DisposeAsync().AsTask();
    }
}
```

Testcontainers is often the best balance between realistic integration testing and automated test setup.

### Testcontainers with `WebApplicationFactory`

A common pattern is to use Testcontainers with ASP.NET Core integration tests.

Custom factory:

```csharp
public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>,
      IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres =
        new PostgreSqlBuilder()
            .WithImage("postgres:16")
            .WithDatabase("app_test")
            .WithUsername("postgres")
            .WithPassword("postgres")
            .Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
    }

    public new async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                service => service.ServiceType ==
                    typeof(DbContextOptions<AppDbContext>));

            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseNpgsql(_postgres.GetConnectionString());
            });

            using var serviceProvider = services.BuildServiceProvider();
            using var scope = serviceProvider.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            context.Database.Migrate();
        });
    }
}
```

Test:

```csharp
public sealed class OrdersApiTests
    : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public OrdersApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateOrder_WithValidRequest_ReturnsCreated()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            CustomerId = 1,
            ProductId = 10,
            Quantity = 2
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
```

This pattern tests the ASP.NET Core pipeline and the real database provider.

### When Testcontainers Are Safer

Testcontainers are safer than InMemory or SQLite when your test needs to verify provider-specific behavior.

Use Testcontainers when testing:

- EF Core migrations.
- Raw SQL.
- Stored procedures.
- Views.
- Database functions.
- JSON columns.
- Case-insensitive/case-sensitive behavior.
- SQL Server `DateDiff` functions.
- PostgreSQL arrays or JSONB.
- Foreign keys.
- Unique constraints.
- Transactions and rollbacks.
- Cascade deletes.
- Optimistic concurrency tokens.
- Database-generated values.
- Computed columns.
- Integration with `WebApplicationFactory`.
- Real query translation.
- Production-like behavior.

Testcontainers are also useful in CI because they remove the need for a manually provisioned database.

### Testcontainers Trade-Offs

Testcontainers are powerful but have trade-offs.

Trade-offs:

- Requires Docker or a compatible container runtime.
- Slower startup than InMemory or SQLite.
- More complex setup.
- Requires container support in CI.
- Tests may be harder to debug if container logs are not captured.
- Parallel tests need isolation strategy.
- Images should be pinned to avoid version drift.
- First test run may be slower due to image pull.
- Test data cleanup must be designed carefully.

Best practices:

- Pin image versions.
- Reuse a container per test class when safe.
- Use one database per test when isolation matters.
- Reset database state between tests.
- Apply migrations at startup.
- Capture container logs when debugging.
- Keep test data deterministic.
- Avoid depending on test order.
- Limit parallelism when the database is shared.

### Dedicated Test Database

A dedicated test database can be a real SQL Server/PostgreSQL/MySQL database used only for tests.

Options:

- One database for all tests with cleanup.
- One database per test class.
- One database per test.
- One schema per test.
- One transaction per test with rollback.
- One tenant/test partition per test.

Benefits:

- Real provider behavior.
- Can be faster than starting a container each time.
- Useful for local development teams.
- Useful in CI with managed database services.

Trade-offs:

- Requires setup and maintenance.
- Tests can interfere without cleanup.
- Connection strings must be managed.
- Parallel execution needs design.
- Risk if tests point to wrong database.

Never run destructive tests against production or shared development databases.

### Test Isolation Strategies

Database tests need isolation.

Common strategies:

| Strategy | Description | Pros | Cons |
|---|---|---|---|
| New database per test | Create a new database for each test | Strong isolation | Slower |
| New database per class | Shared database per class | Good balance | Tests in class can interfere |
| Transaction rollback | Wrap test in transaction and roll back | Fast | Hard with multiple connections |
| Respawn-style cleanup | Delete data between tests | Fast with real DB | Requires careful configuration |
| Unique test data | Use unique IDs/names per test | Simple | Data accumulates |
| Container per test | New container each test | Strong isolation | Slow |
| Container per test suite | Shared container with reset | Faster | Requires cleanup discipline |

Choose based on test speed, reliability, and database behavior.

### Repository Pattern as a Test Double Boundary

Another option is to avoid EF Core in unit tests by introducing a repository or data-access abstraction.

Example:

```csharp
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task AddAsync(Order order, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
```

Application service:

```csharp
public sealed class OrderService
{
    private readonly IOrderRepository _orders;

    public OrderService(IOrderRepository orders)
    {
        _orders = orders;
    }

    public async Task SubmitAsync(int orderId, CancellationToken cancellationToken)
    {
        var order = await _orders.GetByIdAsync(orderId, cancellationToken);

        if (order is null)
        {
            throw new InvalidOperationException("Order not found.");
        }

        order.Submit();

        await _orders.SaveChangesAsync(cancellationToken);
    }
}
```

Unit test can mock the repository:

```csharp
var repository = new Mock<IOrderRepository>();

repository
    .Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
    .ReturnsAsync(new Order());

var service = new OrderService(repository.Object);

await service.SubmitAsync(1, CancellationToken.None);

repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()));
```

This is useful for application logic tests. But it does not test EF Core queries. You still need integration tests for the repository implementation.

### Why Mocking `DbSet` Is Usually a Bad Idea

Mocking `DbSet` query behavior is usually unreliable.

Reason:

- EF Core queries are LINQ expression trees translated by a provider.
- Mocked `DbSet` often executes LINQ in memory.
- In-memory LINQ does not match SQL translation.
- Provider-specific behavior is not tested.
- Raw SQL is not tested.
- Includes and tracking behavior may not match.
- Tests can pass while production queries fail.

Instead of mocking `DbSet`:

- Test application logic through a repository abstraction.
- Test EF Core query code against a real provider.
- Use SQLite in-memory if a lightweight relational fake is acceptable.
- Use Testcontainers for provider-accurate tests.

### InMemory vs SQLite vs Testcontainers

Comparison:

| Feature | EF Core InMemory | SQLite In-Memory | Testcontainers / Docker DB |
|---|---|---|---|
| Relational database | No | Yes | Yes |
| Same provider as production | No | Only if production uses SQLite | Yes if configured that way |
| Foreign keys | Not reliable like relational DB | Yes | Yes |
| Unique constraints | Not reliable like relational DB | Yes | Yes |
| Transactions | Not realistic | Yes | Yes |
| Raw SQL | No | SQLite-compatible only | Yes |
| Migrations | Not realistic relational migrations | Partially realistic | Realistic |
| Provider-specific functions | No | SQLite only | Yes |
| Speed | Fast setup | Fast | Slower startup |
| CI complexity | Low | Low | Medium |
| Docker required | No | No | Yes |
| Best use | Narrow simple tests | Fast relational fake | High-confidence integration tests |

Rule of thumb:

- Use InMemory rarely and narrowly.
- Use SQLite in-memory when you need fast relational behavior but can accept provider differences.
- Use Testcontainers when provider correctness matters.
- Use repository mocks for pure application unit tests.
- Use a real test database for critical data-access behavior.

### Choosing the Right Option

Choose InMemory when:

- The test does not care about relational behavior.
- You only need a simple fake store.
- You are testing simple application flow.
- You accept that database behavior is not validated.

Choose SQLite in-memory when:

- You want fast relational behavior.
- You want constraints and transactions.
- Your queries are provider-neutral.
- You do not use provider-specific SQL.
- Production provider differences are acceptable for that test.

Choose Testcontainers or Docker database when:

- You need production-provider behavior.
- You use migrations.
- You use raw SQL.
- You use provider-specific functions.
- You rely on constraints, transactions, computed columns, or concurrency.
- The test should prove the app works with the real database engine.

Choose repository mocks when:

- You are unit testing application/domain logic.
- You do not want EF Core involved.
- You can mock query results at a higher abstraction.
- You still have separate integration tests for repository queries.

### Testing EF Core Migrations

Do not test migrations with InMemory.

Migrations are relational database schema changes. They should be tested against a relational provider, ideally the real provider.

Migration test example:

```csharp
await using var context = new AppDbContext(options);

await context.Database.MigrateAsync();

var canConnect = await context.Database.CanConnectAsync();

Assert.True(canConnect);
```

A stronger migration test may:

- Apply migrations from empty database.
- Seed required data.
- Verify important tables exist.
- Verify indexes/constraints exist.
- Insert rows that should succeed.
- Insert rows that should fail due to constraints.
- Test downgrade only if your team supports downgrade migrations.

Use Testcontainers for realistic migration tests.

### Testing Constraints

Constraint tests should use a relational provider.

Example unique constraint test:

```csharp
[Fact]
public async Task SaveChanges_WhenDuplicateEmail_Throws()
{
    await using var context = CreateContext();

    context.Users.Add(new User
    {
        Email = "minh@example.com"
    });

    context.Users.Add(new User
    {
        Email = "minh@example.com"
    });

    await Assert.ThrowsAsync<DbUpdateException>(
        () => context.SaveChangesAsync());
}
```

This test is meaningful only if the provider enforces the unique index.

Use SQLite or the real provider. Prefer the real provider if the exact exception type, error code, or behavior matters.

### Testing Transactions and Rollbacks

Transaction tests require a provider with transaction support.

Example:

```csharp
await using var context = CreateContext();

await using var transaction = await context.Database.BeginTransactionAsync();

context.Products.Add(new Product
{
    Name = "Temporary Product"
});

await context.SaveChangesAsync();

await transaction.RollbackAsync();

var exists = await context.Products
    .AnyAsync(p => p.Name == "Temporary Product");

Assert.False(exists);
```

This should not be tested with InMemory if rollback behavior matters.

### Testing Raw SQL and Stored Procedures

If your application uses raw SQL, test it with the actual database provider.

Example:

```csharp
var users = await context.Users
    .FromSqlInterpolated($"""
        SELECT *
        FROM Users
        WHERE IsActive = 1
        """)
    .ToListAsync();
```

For SQL Server stored procedure:

```csharp
var reportRows = await context.ReportRows
    .FromSqlInterpolated($"EXEC dbo.GetMonthlyReport {month}")
    .ToListAsync();
```

SQLite and InMemory cannot validate SQL Server stored procedures. Use SQL Server in Docker/Testcontainers.

### Testing Case Sensitivity and Collation

If your system depends on case-insensitive email lookup, test it against the production provider or configure the test provider to match production behavior.

Example:

```csharp
var user = await context.Users
    .SingleOrDefaultAsync(u => u.Email == request.Email);
```

Important questions:

- Is the database collation case-insensitive?
- Is email normalized before storage?
- Is there a unique index on normalized email?
- Does the test provider behave the same?
- Does the query use the same column and index as production?

InMemory tests are not enough for these behaviors.

### Testing Optimistic Concurrency

EF Core concurrency tokens depend on provider behavior.

Example SQL Server rowversion:

```csharp
modelBuilder.Entity<Product>()
    .Property(p => p.RowVersion)
    .IsRowVersion();
```

This should be tested against SQL Server if production uses SQL Server `rowversion`.

Concurrency test:

```csharp
await using var context1 = CreateContext();
await using var context2 = CreateContext();

var product1 = await context1.Products.SingleAsync(p => p.Id == productId);
var product2 = await context2.Products.SingleAsync(p => p.Id == productId);

product1.Name = "Updated by context 1";
await context1.SaveChangesAsync();

product2.Name = "Updated by context 2";

await Assert.ThrowsAsync<DbUpdateConcurrencyException>(
    () => context2.SaveChangesAsync());
```

Use the real provider for high-confidence concurrency tests.

### Testing Query Performance

InMemory and SQLite cannot prove SQL Server/PostgreSQL query performance.

Performance depends on:

- Generated SQL.
- Query plans.
- Indexes.
- Statistics.
- Data volume.
- Collation.
- Join strategy.
- Sorts.
- Locks.
- IO.
- Provider-specific translation.

Use the real database provider for query performance tests.

Useful checks:

- Generated SQL with `ToQueryString()`.
- Query plan in database tooling.
- Row counts.
- Index usage.
- Command duration logs.
- Query tags.
- Realistic data volume.

### Testing with `WebApplicationFactory` and SQLite

Custom factory with SQLite in-memory:

```csharp
public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{
    private SqliteConnection? _connection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                service => service.ServiceType ==
                    typeof(DbContextOptions<AppDbContext>));

            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }

            _connection = new SqliteConnection("Data Source=:memory:");
            _connection.Open();

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlite(_connection);
            });

            using var provider = services.BuildServiceProvider();
            using var scope = provider.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            context.Database.EnsureCreated();
            Seed(context);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection?.Dispose();
    }

    private static void Seed(AppDbContext context)
    {
        context.Customers.Add(new Customer
        {
            Name = "Test Customer"
        });

        context.SaveChanges();
    }
}
```

This is good for fast API integration tests where SQLite differences are acceptable.

### Testing with `WebApplicationFactory` and Testcontainers

Custom factory with Testcontainers can use the real database provider.

Example concept:

```csharp
public sealed class ApiFactory
    : WebApplicationFactory<Program>,
      IAsyncLifetime
{
    private readonly MsSqlContainer _sqlServer =
        new MsSqlBuilder()
            .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
            .WithPassword("Your_password123")
            .Build();

    public async Task InitializeAsync()
    {
        await _sqlServer.StartAsync();
    }

    public new async Task DisposeAsync()
    {
        await _sqlServer.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                service => service.ServiceType ==
                    typeof(DbContextOptions<AppDbContext>));

            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlServer(_sqlServer.GetConnectionString());
            });
        });
    }
}
```

In the test setup, apply migrations:

```csharp
using var scope = factory.Services.CreateScope();

var context = scope.ServiceProvider
    .GetRequiredService<AppDbContext>();

await context.Database.MigrateAsync();
```

This tests the API pipeline and real SQL Server behavior.

### Common Mistakes

Common mistakes include:

- Using InMemory for tests that depend on relational constraints.
- Assuming InMemory is a faster version of SQL Server.
- Testing queries with InMemory and assuming they will translate to SQL.
- Ignoring case sensitivity and collation differences.
- Using SQLite for SQL Server-specific functions.
- Forgetting to keep SQLite in-memory connection open.
- Using EF InMemory and missing foreign key bugs.
- Using EF InMemory and missing unique constraint bugs.
- Testing transactions with InMemory.
- Testing raw SQL with a provider that cannot execute it.
- Mocking `DbSet` query behavior and trusting the result.
- Sharing one test database without cleanup.
- Depending on test execution order.
- Using Testcontainers but not pinning image versions.
- Running too many containers in parallel without considering CI capacity.
- Not applying migrations in integration tests.
- Using `EnsureCreated` when the test is meant to validate migrations.
- Reusing tracked entities in tests and hiding missing `Include` calls.
- Letting test data leak between tests.
- Treating all tests as integration tests when unit tests would be simpler.

### Best Practices

Use the real production database provider for important data-access tests.

Use Testcontainers or Docker databases when provider-specific behavior matters.

Use SQLite in-memory when you want a fast relational fake and can accept provider differences.

Use EF Core InMemory only for narrow tests that do not depend on relational behavior.

Avoid mocking `DbSet` for query behavior.

Use repository or data-access abstractions for pure application unit tests.

Keep database integration tests focused on important query and persistence behavior.

Test migrations against a real relational provider.

Test constraints, transactions, concurrency, raw SQL, and provider-specific functions against the real provider.

Keep SQLite in-memory connections open for the test lifetime.

Reset database state between tests.

Use deterministic seed data.

Avoid test order dependencies.

Pin Docker image versions.

Balance speed and confidence: not every test needs a real database, but critical database behavior should be tested with one.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q01 -->
#### Beginner Q01: What is the EF Core InMemory provider?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

The EF Core InMemory provider is a provider that stores data in memory instead of using a real database. It is sometimes used in tests because it is easy to configure and does not require a database server.

However, it is not a relational database. It does not behave like SQL Server, PostgreSQL, MySQL, or SQLite in many important ways. It should not be used when the test needs to verify relational database behavior such as foreign keys, unique constraints, transactions, raw SQL, migrations, or provider-specific query translation.

##### Key Points to Mention

- Stores data in memory.
- Easy to configure for simple tests.
- Not a relational database.
- Does not fully represent production database behavior.
- Can give false confidence.
- Usually not recommended for database integration tests.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q01 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q02 -->
#### Beginner Q02: Why is the InMemory provider risky for EF Core testing?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

It is risky because it does not behave like a relational database. Tests can pass with InMemory but fail in production.

For example, InMemory may not enforce foreign key constraints or unique indexes the same way a real database does. It also does not execute real SQL, does not support raw SQL, does not validate provider-specific query translation, and does not properly test transactions or migrations.

##### Key Points to Mention

- Not relational.
- May not catch foreign key bugs.
- May not catch unique constraint bugs.
- Does not test SQL translation.
- Does not test raw SQL.
- Does not test real transaction behavior.
- Can produce false positives.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q02 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q03 -->
#### Beginner Q03: What is SQLite in-memory testing?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

SQLite in-memory testing uses SQLite as a relational database that exists only in memory while a connection remains open.

Example:

```csharp
var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();

var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseSqlite(connection)
    .Options;

await using var context = new AppDbContext(options);
await context.Database.EnsureCreatedAsync();
```

It is safer than EF Core InMemory for many tests because SQLite is relational and supports constraints and transactions. However, it is still not the same as SQL Server or PostgreSQL.

##### Key Points to Mention

- Uses SQLite in memory.
- Requires an open connection to keep the database alive.
- Relational database behavior is closer to production.
- Supports constraints and transactions better than InMemory.
- Still has provider differences.
- Good for fast relational integration tests.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q03 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q04 -->
#### Beginner Q04: What are Testcontainers?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Testcontainers is a library that lets tests start and stop Docker containers automatically. In .NET, it can be used to run real dependencies such as SQL Server, PostgreSQL, Redis, RabbitMQ, or other services during integration tests.

For EF Core testing, Testcontainers can start the same database engine used in production, apply migrations, seed test data, run tests, and dispose the container afterward.

##### Key Points to Mention

- Starts Docker containers from test code.
- Useful for real database integration tests.
- Supports databases such as SQL Server and PostgreSQL.
- Gives more production-like behavior than fakes.
- Requires Docker or compatible runtime.
- Slower than InMemory or SQLite but more accurate.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q04 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q05 -->
#### Beginner Q05: When is SQLite safer than EF Core InMemory?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

SQLite is safer when the test needs relational behavior such as foreign keys, unique constraints, transactions, SQL execution, or more realistic query behavior.

For example, if a test should verify that duplicate emails are rejected by a unique index, SQLite is more meaningful than InMemory because SQLite can enforce relational constraints.

However, SQLite is still not identical to SQL Server or PostgreSQL, so use the real provider when provider-specific behavior matters.

##### Key Points to Mention

- SQLite is relational.
- Better for constraints.
- Better for transactions.
- Better for relational query behavior.
- Still differs from production providers.
- Use real provider for provider-specific behavior.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q05 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q06 -->
#### Beginner Q06: When should you use a real database in tests?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

Use a real database when the behavior being tested depends on the real database provider. This includes migrations, raw SQL, stored procedures, provider-specific EF functions, constraints, transactions, concurrency tokens, computed columns, default values, and query behavior that must match production.

A real database can be provided through Docker, Testcontainers, a local database, or a dedicated test database.

##### Key Points to Mention

- Use for provider-specific behavior.
- Use for migrations.
- Use for raw SQL and stored procedures.
- Use for constraints and transactions.
- Use for concurrency behavior.
- Use for high-confidence integration tests.
- Docker/Testcontainers make this easier.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q01 -->
#### Intermediate Q01: What database behaviors can InMemory fail to catch?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

InMemory can fail to catch many relational database behaviors, including foreign key violations, unique constraint violations, transaction rollbacks, raw SQL execution errors, provider-specific query translation failures, case sensitivity differences, SQL null semantics, database defaults, computed columns, cascade delete behavior, and concurrency token behavior.

Because it does not execute real SQL, it cannot prove that a LINQ query will translate or behave correctly on the production database provider.

##### Key Points to Mention

- Foreign keys.
- Unique constraints.
- Transactions and rollbacks.
- Raw SQL.
- Provider-specific functions.
- SQL translation.
- Case sensitivity and collation.
- Database-generated values.
- Concurrency behavior.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q01 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q02 -->
#### Intermediate Q02: Why is SQLite in-memory not a perfect substitute for SQL Server or PostgreSQL?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

SQLite is relational, but it is a different database engine from SQL Server or PostgreSQL. It has different SQL syntax, data types, date/time functions, collation behavior, case sensitivity, migration behavior, concurrency behavior, and provider-specific features.

For example, SQL Server-specific functions such as `EF.Functions.DateDiffDay` cannot be tested with SQLite. SQL Server stored procedures also cannot be tested with SQLite.

SQLite is useful for fast relational tests, but provider-specific behavior should be tested against the actual provider.

##### Key Points to Mention

- SQLite is relational but not the same provider.
- SQL dialect differs.
- Case sensitivity can differ.
- Date/time functions can differ.
- Provider-specific EF functions may fail.
- Stored procedures may not exist.
- Use real provider for provider-specific tests.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q02 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q03 -->
#### Intermediate Q03: How do you keep a SQLite in-memory database alive during a test?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A SQLite in-memory database exists only while its connection remains open. To keep it alive, create and open a `SqliteConnection`, pass that connection to EF Core, and keep the connection open for the lifetime of the test or test fixture.

Example:

```csharp
var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();

var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseSqlite(connection)
    .Options;

await using var context = new AppDbContext(options);
await context.Database.EnsureCreatedAsync();
```

Dispose the connection when the test is complete.

##### Key Points to Mention

- SQLite in-memory database is tied to the connection.
- Closing the connection destroys the database.
- Keep the connection open for test lifetime.
- Pass the open connection to EF Core.
- Dispose connection after test.
- Common issue in SQLite tests.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q03 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q04 -->
#### Intermediate Q04: How do Testcontainers improve EF Core integration tests?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Testcontainers improve EF Core integration tests by running a real database provider in Docker and managing its lifecycle from test code. This allows tests to use the same database engine as production without requiring developers or CI agents to manually provision a database.

The tests can start the container, get the connection string, apply EF Core migrations, seed data, run the test, and dispose the container.

This gives higher confidence for provider-specific behavior such as migrations, constraints, transactions, raw SQL, and query translation.

##### Key Points to Mention

- Starts real database containers automatically.
- Provides connection string to tests.
- Works well with EF Core migrations.
- Tests production-like provider behavior.
- Good for CI.
- Requires Docker.
- Slower than fake providers but more accurate.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q04 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q05 -->
#### Intermediate Q05: Why is mocking `DbSet` usually not recommended for query tests?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Mocking `DbSet` query behavior usually means running LINQ over in-memory collections. That does not test EF Core query translation, SQL execution, provider-specific behavior, includes, relational constraints, or raw SQL.

A query that works against a mocked `DbSet` may fail against SQL Server or PostgreSQL.

A better approach is to unit test application logic through a repository abstraction and integration test the repository or EF Core queries against a real provider.

##### Key Points to Mention

- Mocked `DbSet` often uses in-memory LINQ.
- Does not test SQL translation.
- Does not test provider behavior.
- Does not test constraints.
- Can create false confidence.
- Prefer repository mocks for application logic.
- Test real EF queries against real provider or SQLite.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q05 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q06 -->
#### Intermediate Q06: How do you choose between SQLite and Testcontainers?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use SQLite when you want fast relational tests and the tested behavior is provider-neutral. It is good for basic CRUD, constraints, and transaction behavior when exact production provider behavior is not required.

Use Testcontainers when the test must match the production database provider. This includes migrations, raw SQL, stored procedures, provider-specific functions, computed columns, JSON columns, concurrency tokens, and production-specific query behavior.

SQLite is faster and simpler. Testcontainers is more accurate.

##### Key Points to Mention

- SQLite is faster and simpler.
- SQLite is relational but not production provider.
- Testcontainers uses real provider.
- Use Testcontainers for provider-specific behavior.
- Use SQLite for provider-neutral relational behavior.
- Both are safer than InMemory for relational tests.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q06 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q07 -->
#### Intermediate Q07: How should database test data be isolated?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Database test data should be isolated so tests do not affect each other. Common strategies include using a new database per test, resetting the database before each test, transaction rollback, unique test data, Respawn-style cleanup, container per test, or shared container with cleanup.

The right approach depends on speed, parallelism, and how realistic the database setup must be.

Tests should not depend on execution order or shared state from previous tests.

##### Key Points to Mention

- Avoid shared mutable state.
- Reset database between tests.
- Use unique data when needed.
- Transaction rollback can be fast but has limitations.
- Containers can be per test or shared.
- Do not depend on test order.
- Design for parallel test execution if needed.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q07 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q08 -->
#### Intermediate Q08: When is the EF Core InMemory provider still acceptable?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

The InMemory provider can be acceptable for narrow tests where relational database behavior does not matter. For example, simple application flow tests that only need to store and retrieve objects may use it.

However, it should not be used to validate constraints, transactions, SQL translation, raw SQL, migrations, provider-specific behavior, or concurrency. It should be chosen knowingly, not as a default database replacement.

##### Key Points to Mention

- Acceptable for narrow/simple tests.
- Useful when relational behavior is irrelevant.
- Not a production database fake.
- Avoid for constraints, transactions, raw SQL, migrations.
- Avoid for provider-specific query behavior.
- Use SQLite or real database for integration confidence.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q01 -->
#### Advanced Q01: How would you design a database testing strategy for a production EF Core application?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would separate tests by purpose.

For pure business logic, I would use unit tests and mock repository or application abstractions. For EF Core query and persistence behavior, I would use integration tests against a relational provider. For critical database behavior, migrations, raw SQL, constraints, transactions, and provider-specific queries, I would test against the actual production database provider using Docker or Testcontainers.

SQLite in-memory can be used for fast relational tests when provider differences are acceptable. I would avoid EF Core InMemory for tests that claim to verify relational database behavior.

I would also design database reset or isolation, seed deterministic data, run migrations in integration tests, and ensure tests do not depend on execution order.

##### Key Points to Mention

- Use unit tests for pure logic.
- Use repository mocks only above EF Core.
- Use SQLite for fast provider-neutral relational tests.
- Use Testcontainers/real DB for provider-specific behavior.
- Avoid InMemory for relational correctness.
- Test migrations and constraints against real provider.
- Reset database state between tests.
- Keep tests deterministic.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q01 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q02 -->
#### Advanced Q02: Why can a test pass with InMemory but fail in production?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

A test can pass with InMemory but fail in production because InMemory does not reproduce relational database behavior. It may not enforce foreign keys or unique indexes, may not support transactions, does not execute raw SQL, does not validate provider-specific SQL translation, and can have different case sensitivity or null semantics.

For example, inserting an order with a non-existent `CustomerId` may pass with InMemory but fail in SQL Server due to a foreign key constraint.

This is why important data-access behavior should be tested with a relational provider or the actual provider.

##### Key Points to Mention

- InMemory is not relational.
- Constraints may not be enforced.
- SQL translation is not validated.
- Provider-specific behavior is missing.
- Transactions are not realistic.
- Case sensitivity can differ.
- False positives are the main risk.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q02 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q03 -->
#### Advanced Q03: How would you test EF Core migrations safely?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Migrations should be tested against a real relational database provider, ideally the same provider used in production. InMemory is not suitable because migrations are relational schema operations.

A migration test can start a containerized database, apply migrations with `Database.MigrateAsync()`, seed required data, and verify that important tables, constraints, and queries work.

For SQL Server or PostgreSQL production apps, Testcontainers is a good choice because it can start the real database engine automatically in the test lifecycle.

##### Key Points to Mention

- InMemory cannot validate relational migrations.
- Use the real provider when possible.
- Testcontainers are useful for migration tests.
- Apply migrations from an empty database.
- Verify constraints and important queries.
- Avoid `EnsureCreated` when testing migrations.
- Use deterministic test data.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q03 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q04 -->
#### Advanced Q04: How do you handle test speed when using real database containers?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

To keep real database container tests fast, avoid starting a new container for every test unless isolation requires it. A common strategy is to start one container per test class or test collection, apply migrations once, and reset data between tests.

Other optimizations include pinning image versions, reusing containers carefully, using database cleanup tools, creating one database per test inside the same server, reducing test data size, and running only important integration tests against the container.

The goal is to balance speed and confidence.

##### Key Points to Mention

- Container per test is isolated but slower.
- Shared container with database reset is faster.
- Apply migrations once when possible.
- Use deterministic cleanup.
- Pin image versions.
- Keep seed data small.
- Limit tests to meaningful integration scenarios.
- Balance speed and realism.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q04 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q05 -->
#### Advanced Q05: How would you test SQL Server-specific EF Core queries?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

SQL Server-specific queries should be tested against SQL Server. For example, queries using `EF.Functions.DateDiffDay`, SQL Server-specific raw SQL, computed columns, `rowversion`, stored procedures, or SQL Server collation behavior cannot be reliably tested with InMemory or SQLite.

Use SQL Server LocalDB, a Docker SQL Server instance, a dedicated test database, or Testcontainers with SQL Server. Apply migrations and run the query against realistic test data.

##### Key Points to Mention

- Use SQL Server for SQL Server-specific behavior.
- SQLite cannot test SQL Server-specific functions.
- InMemory cannot test SQL translation.
- Test raw SQL and stored procedures against SQL Server.
- Test `rowversion` against SQL Server.
- Use Docker/Testcontainers for repeatable setup.
- Check generated SQL and behavior.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q05 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q06 -->
#### Advanced Q06: What are the trade-offs of using a repository pattern instead of fake EF Core providers?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A repository pattern can make application logic easier to unit test because tests can mock repository outputs without running EF Core queries. This avoids the problem of fake providers behaving differently from production databases.

The trade-off is that the repository layer adds abstraction, implementation cost, maintenance cost, and potential duplication. It also does not remove the need to integration test the repository implementation and EF Core queries against a real provider.

The repository should not expose `IQueryable`, because that leaks EF query composition back to the caller and makes reliable mocking difficult.

##### Key Points to Mention

- Repository mocks can isolate application logic.
- Avoids fake EF provider behavior in unit tests.
- Adds architectural and maintenance cost.
- Repository implementation still needs integration tests.
- Avoid exposing `IQueryable`.
- Return DTOs/entities/results instead of queryables.
- Useful when application needs a testable data-access boundary.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q06 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q07 -->
#### Advanced Q07: How do you prevent tests from hiding missing `Include` calls or tracking-related bugs?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Use realistic query patterns and avoid using the same tracked context for arrange and act phases when it can hide missing includes. After seeding data, clear the change tracker or create a new context before executing the code under test.

Example:

```csharp
await context.SaveChangesAsync();
context.ChangeTracker.Clear();

var customer = await service.GetCustomerAsync(customerId);
```

Using a relational provider also helps because the behavior is closer to production. For read endpoints, prefer projection tests that verify the actual DTO output.

##### Key Points to Mention

- Tracked entities can hide missing includes.
- Navigation fix-up can make tests pass accidentally.
- Use a fresh context for act phase.
- Or call `ChangeTracker.Clear()`.
- Avoid asserting on already-tracked arranged entities.
- Use realistic provider behavior.
- Test DTO/output shape through actual query.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q07 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q08 -->
#### Advanced Q08: How do you decide whether a database test should use SQLite or the production provider?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Use SQLite if the behavior being tested is generic relational behavior and the query is provider-neutral. For example, simple CRUD, basic constraints, and simple transactions can often be tested with SQLite.

Use the production provider when the behavior depends on provider-specific SQL, migrations, collation, case sensitivity, computed columns, JSON support, concurrency tokens, default values, performance, raw SQL, or stored procedures.

A good test suite may use both: SQLite for fast broad feedback and the real provider for critical integration paths.

##### Key Points to Mention

- SQLite is good for provider-neutral relational tests.
- Production provider is needed for provider-specific behavior.
- Migrations should use real provider.
- Raw SQL should use real provider.
- Collation/case sensitivity can require real provider.
- A mixed strategy is often best.
- Choose based on the risk being tested.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q08 -->

<!-- question:start:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q09 -->
#### Advanced Q09: What is a balanced testing pyramid for EF Core-heavy applications?

<!-- question-id:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

A balanced strategy should have many fast unit tests for pure business logic, validators, domain rules, and application services where database behavior is mocked behind a repository or abstraction. It should have focused integration tests for EF Core queries, repositories, persistence, constraints, and important API workflows. Critical provider-specific behavior should run against the actual database provider using Docker/Testcontainers or a dedicated test database.

There should be fewer end-to-end tests because they are slower and more fragile.

InMemory should not be the default foundation for database integration tests because it does not validate relational behavior.

##### Key Points to Mention

- Many unit tests for pure logic.
- Focused integration tests for data access.
- Real provider tests for critical database behavior.
- Few E2E tests for full workflows.
- Avoid relying on InMemory for relational confidence.
- Use SQLite or Testcontainers based on risk.
- Keep tests fast, isolated, and meaningful.

<!-- question:end:ef-core-inmemory-provider-caveats-and-when-sqlite-docker-databases-or-testcontainers-are-safer-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
