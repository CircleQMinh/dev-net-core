---
id: data-seeding-choices-including-hasdata-vs-runtime-seed-logic
topic: Entity Framework
subtopic: Data Seeding Choices, Including HasData vs Runtime Seed Logic
category: .NET
---


## Overview

Data seeding is the process of putting initial or required data into a database. In Entity Framework Core, seeding is commonly used for lookup values, default configuration records, roles, permissions, demo data, test data, feature flags, country lists, product categories, and initial admin users.

This topic focuses on choosing the right EF Core seeding strategy, especially the difference between:

- `HasData`, also known as model-managed data.
- `UseSeeding` and `UseAsyncSeeding`, introduced as a general-purpose EF Core seeding option.
- Custom runtime seed logic.
- Manual migration customization.
- Test and development seed data.

This topic matters because seeding looks simple at first, but the wrong strategy can create production problems. A bad seed design can cause duplicate records, broken migrations, inconsistent environments, large migration files, accidental overwrites, concurrency issues during deployment, or insecure default users.

In real applications, data seeding is used for:

- Static lookup data such as countries, currencies, statuses, and categories.
- Required application roles and permissions.
- Default tenant configuration.
- Development sample data.
- Integration test setup.
- Demo environments.
- Initial admin accounts.
- Seed data needed for feature startup.
- Reference data required by business rules.

This topic is important for interviews because it tests whether a developer understands EF Core beyond basic CRUD. Interviewers often ask:

- What is `HasData` used for?
- Why is `HasData` not ideal for all seeding?
- What are `UseSeeding` and `UseAsyncSeeding`?
- What is the difference between model-managed data and runtime seeding?
- How do migrations interact with seeded data?
- Why must `HasData` specify primary keys?
- How should roles and admin users be seeded?
- Why is seeding during normal app startup risky?
- How should seeding work in production?
- How do you make seed logic idempotent?
- How do you avoid duplicate seed data?

A strong answer should not say "always use `HasData`" or "always seed on startup." The correct choice depends on the type of data, whether it is static or dynamic, whether it depends on current database state, whether database-generated keys are needed, whether external services are involved, and how the deployment process applies migrations.

## Core Concepts

### What Data Seeding Means

Data seeding means adding initial data to a database.

Example seed data:

```text
Countries:
- USA
- Canada
- Mexico

Roles:
- Admin
- Manager
- User

Order statuses:
- Draft
- Submitted
- Paid
- Cancelled
```

A database schema defines the structure. Seed data fills that structure with required initial values.

For example, an application may not work unless these roles exist:

```text
Admin
User
Support
```

Or an order workflow may require these statuses:

```text
Pending
Approved
Rejected
Completed
```

In EF Core, seed data can be added in multiple ways:

- `UseSeeding` and `UseAsyncSeeding`.
- `HasData`.
- Custom initialization code.
- Manual migration operations.
- SQL scripts.
- Separate database initialization tools.
- Test setup code.

Each option has different behavior and trade-offs.

### Main EF Core Seeding Options

EF Core supports several practical seeding choices.

| Option | Best For | Avoid When |
|---|---|---|
| `UseSeeding` / `UseAsyncSeeding` | General-purpose initial data that can be checked and inserted with code | You need only migration-managed static reference data |
| `HasData` | Small, fixed, deterministic reference data controlled by migrations | Data is dynamic, large, environment-specific, or needs generated values |
| Custom initialization logic | Complex seeding, multiple contexts, external services, custom workflow | It runs automatically in every app instance without coordination |
| Manual migration customization | One-off data changes tied to a schema migration | Complex ongoing seed logic |
| SQL scripts | DBA-reviewed production deployment data changes | Application-specific idempotent logic is easier in C# |
| Test seed logic | Unit/integration test data setup | Production data seeding |

The best strategy depends on the type of data and lifecycle.

### `UseSeeding` and `UseAsyncSeeding`

`UseSeeding` and `UseAsyncSeeding` are EF Core configuration methods for general-purpose data seeding.

They are configured on `DbContextOptionsBuilder`.

Example:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString)
        .UseSeeding((context, _) =>
        {
            var hasAdminRole = context.Set<Role>()
                .Any(r => r.Name == "Admin");

            if (!hasAdminRole)
            {
                context.Set<Role>().Add(new Role
                {
                    Name = "Admin"
                });

                context.SaveChanges();
            }
        })
        .UseAsyncSeeding(async (context, _, cancellationToken) =>
        {
            var hasAdminRole = await context.Set<Role>()
                .AnyAsync(r => r.Name == "Admin", cancellationToken);

            if (!hasAdminRole)
            {
                context.Set<Role>().Add(new Role
                {
                    Name = "Admin"
                });

                await context.SaveChangesAsync(cancellationToken);
            }
        });
});
```

A simple entity:

```csharp
public sealed class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
```

This approach is useful because seed logic is normal C# code. It can query the database, check whether data already exists, and insert missing records.

Important interview point: implement both synchronous and asynchronous versions when using this feature, because tooling may rely on the synchronous path.

### Why `UseSeeding` Is Useful

`UseSeeding` and `UseAsyncSeeding` are useful because they provide a clear place for initialization logic.

Benefits:

- Central location for seed logic.
- Can query current database state.
- Can be idempotent.
- Can use database-generated keys.
- Can insert data conditionally.
- Can use normal EF Core operations.
- Can run when migrations are applied.
- Is protected by EF Core's migration locking mechanism when used with migration operations.

Example idempotent seed:

```csharp
options.UseAsyncSeeding(async (context, _, cancellationToken) =>
{
    var requiredStatuses = new[]
    {
        "Draft",
        "Submitted",
        "Paid",
        "Cancelled"
    };

    foreach (var statusName in requiredStatuses)
    {
        var exists = await context.Set<OrderStatus>()
            .AnyAsync(s => s.Name == statusName, cancellationToken);

        if (!exists)
        {
            context.Set<OrderStatus>().Add(new OrderStatus
            {
                Name = statusName
            });
        }
    }

    await context.SaveChangesAsync(cancellationToken);
});
```

This avoids hard-coding primary key values and avoids duplicate inserts if the seed code runs more than once.

### `HasData`

`HasData` configures data as part of the EF Core model.

Example:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<OrderStatus>().HasData(
        new OrderStatus { Id = 1, Name = "Draft" },
        new OrderStatus { Id = 2, Name = "Submitted" },
        new OrderStatus { Id = 3, Name = "Paid" },
        new OrderStatus { Id = 4, Name = "Cancelled" });
}
```

Entity:

```csharp
public sealed class OrderStatus
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
```

When a migration is created, EF Core compares the configured data with the model snapshot and generates migration operations such as:

```csharp
migrationBuilder.InsertData(
    table: "OrderStatuses",
    columns: new[] { "Id", "Name" },
    values: new object[,]
    {
        { 1, "Draft" },
        { 2, "Submitted" },
        { 3, "Paid" },
        { 4, "Cancelled" }
    });
```

This is why `HasData` is sometimes described as model-managed data. EF Core migrations manage it based on the model snapshot.

### `HasData` Is Model-Managed Data

The important mental model is this:

`HasData` is not general runtime seeding. It is model-managed data.

This means:

- Data is stored in the EF Core model snapshot.
- Migrations compare old seed data and new seed data.
- Migrations generate `InsertData`, `UpdateData`, and `DeleteData`.
- EF Core does not query the database to decide what changed.
- The primary key must be specified.
- Data changed outside migrations can conflict with generated migration operations.
- It works best for static deterministic reference data.

Good `HasData` examples:

```text
Country codes
Currency codes
Fixed order statuses
Static lookup categories
System permission definitions
```

Poor `HasData` examples:

```text
Temporary test data
Random sample data
Users with hashed passwords
Data that depends on existing rows
Data that calls external APIs
Large product catalogs
Environment-specific records
Data using DateTime.Now
Data needing database-generated keys
```

### Why `HasData` Requires Primary Keys

`HasData` requires primary key values because migrations need a stable way to identify each row across migration snapshots.

Example:

```csharp
modelBuilder.Entity<Country>().HasData(
    new Country { Id = 1, Code = "US", Name = "United States" },
    new Country { Id = 2, Code = "CA", Name = "Canada" });
```

If you change a primary key value, EF Core treats it as a different row. A migration may delete the old seed row and insert a new one.

Bad change:

```csharp
// Old
new Country { Id = 1, Code = "US", Name = "United States" }

// New
new Country { Id = 100, Code = "US", Name = "United States" }
```

This can produce delete and insert operations instead of a simple update.

Best practice:

- Use stable seed keys.
- Do not change seed primary keys casually.
- Avoid `HasData` for data where database-generated keys are required.
- Consider natural keys carefully, but remember EF still needs configured key values.

### `HasData` with Relationships

When seeding related data with `HasData`, foreign key values must be specified.

Example:

```csharp
public sealed class Country
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<City> Cities { get; } = new();
}

public sealed class City
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public int CountryId { get; set; }
    public Country Country { get; set; } = null!;
}
```

Seed data:

```csharp
modelBuilder.Entity<Country>().HasData(
    new Country { Id = 1, Name = "USA" },
    new Country { Id = 2, Name = "Canada" });

modelBuilder.Entity<City>().HasData(
    new City { Id = 1, Name = "Seattle", CountryId = 1 },
    new City { Id = 2, Name = "Vancouver", CountryId = 2 });
```

Do not try to seed by assigning navigation properties:

```csharp
// Not the right style for HasData
new City
{
    Id = 1,
    Name = "Seattle",
    Country = new Country { Id = 1, Name = "USA" }
}
```

For `HasData`, use scalar key and foreign key values.

### `HasData` with Many-to-Many Relationships

For many-to-many relationships, seed the join table explicitly.

Example model:

```csharp
public sealed class User
{
    public int Id { get; set; }
    public string UserName { get; set; } = string.Empty;

    public List<Role> Roles { get; } = new();
}

public sealed class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public List<User> Users { get; } = new();
}
```

Configuration:

```csharp
modelBuilder.Entity<User>().HasData(
    new User { Id = 1, UserName = "admin" });

modelBuilder.Entity<Role>().HasData(
    new Role { Id = 1, Name = "Admin" });

modelBuilder.Entity<User>()
    .HasMany(u => u.Roles)
    .WithMany(r => r.Users)
    .UsingEntity<Dictionary<string, object>>(
        "UserRole",
        join => join.HasOne<Role>().WithMany().HasForeignKey("RoleId"),
        join => join.HasOne<User>().WithMany().HasForeignKey("UserId"),
        join =>
        {
            join.HasKey("UserId", "RoleId");

            join.HasData(new
            {
                UserId = 1,
                RoleId = 1
            });
        });
```

In production, user seeding is often better handled with runtime seed logic because password hashing, user creation, and identity-related workflows are usually not good fits for `HasData`.

### `HasData` with Owned Entity Types

Owned types can be seeded, but the owner key must be provided.

Example:

```csharp
public sealed class Language
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public LanguageDetails Details { get; set; } = new();
}

public sealed class LanguageDetails
{
    public bool IsPhonetic { get; set; }
    public int PhonemeCount { get; set; }
}
```

Configuration:

```csharp
modelBuilder.Entity<Language>().HasData(
    new Language { Id = 1, Name = "English" });

modelBuilder.Entity<Language>()
    .OwnsOne(l => l.Details)
    .HasData(new
    {
        LanguageId = 1,
        IsPhonetic = false,
        PhonemeCount = 44
    });
```

Owned type seeding often uses anonymous objects because shadow key or owner key values may not exist as CLR properties on the owned type.

### Limitations of `HasData`

`HasData` has important limitations.

It is not a good fit when:

- Data depends on existing database state.
- Data is large.
- Data is temporary test data.
- Data needs generated keys.
- Data uses random values.
- Data uses `DateTime.Now`.
- Data requires password hashing.
- Data requires external API calls.
- Data changes outside migrations.
- Data differs per environment.
- Data should not live in migration snapshots.
- Data needs custom business logic to create.

Example problem:

```csharp
modelBuilder.Entity<User>().HasData(
    new User
    {
        Id = 1,
        Email = "admin@example.com",
        PasswordHash = HashPassword("P@ssw0rd!")
    });
```

This is usually a poor design because password hashing is runtime logic, may require identity services, may change algorithm versions, and may involve sensitive default credentials.

Better approach:

```csharp
public sealed class IdentitySeedService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;

    public IdentitySeedService(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
    }

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        if (!await _roleManager.RoleExistsAsync("Admin"))
        {
            await _roleManager.CreateAsync(new IdentityRole("Admin"));
        }

        var admin = await _userManager.FindByEmailAsync("admin@example.com");

        if (admin is null)
        {
            admin = new ApplicationUser
            {
                UserName = "admin@example.com",
                Email = "admin@example.com"
            };

            await _userManager.CreateAsync(admin, "ChangeThisPassword!123");
            await _userManager.AddToRoleAsync(admin, "Admin");
        }
    }
}
```

This can use the proper Identity APIs and can be made environment-specific and secure.

### Runtime Seed Logic

Runtime seed logic means using normal C# code to query and insert/update data.

Example:

```csharp
public static class DatabaseSeeder
{
    public static async Task SeedAsync(
        AppDbContext context,
        CancellationToken cancellationToken = default)
    {
        var statuses = new[]
        {
            "Draft",
            "Submitted",
            "Paid",
            "Cancelled"
        };

        foreach (var status in statuses)
        {
            var exists = await context.OrderStatuses
                .AnyAsync(s => s.Name == status, cancellationToken);

            if (!exists)
            {
                context.OrderStatuses.Add(new OrderStatus
                {
                    Name = status
                });
            }
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
```

Usage:

```csharp
using var scope = app.Services.CreateScope();

var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

await DatabaseSeeder.SeedAsync(context);
```

Runtime logic is flexible, but it must be used carefully. Running it automatically in every application instance during normal startup can create concurrency and permission issues, especially in production.

### Idempotent Seed Logic

Seed logic should usually be idempotent.

Idempotent means it can run multiple times and produce the same final result without creating duplicates or corrupting data.

Bad seed logic:

```csharp
context.Roles.Add(new Role { Name = "Admin" });
await context.SaveChangesAsync();
```

If this runs twice, it may insert duplicate roles or fail on a unique constraint.

Better seed logic:

```csharp
var exists = await context.Roles
    .AnyAsync(r => r.Name == "Admin", cancellationToken);

if (!exists)
{
    context.Roles.Add(new Role { Name = "Admin" });
    await context.SaveChangesAsync(cancellationToken);
}
```

Even better: enforce uniqueness at the database level.

```csharp
modelBuilder.Entity<Role>()
    .HasIndex(r => r.Name)
    .IsUnique();
```

Idempotency should not rely only on application checks. A unique index protects the database if two processes try to seed the same row at the same time.

### Runtime Seeding and Concurrency

Runtime seed logic can have concurrency problems if multiple app instances run it at the same time.

Example:

```text
Instance A checks if Admin role exists -> false
Instance B checks if Admin role exists -> false
Instance A inserts Admin
Instance B inserts Admin
```

Possible results:

- Duplicate rows.
- Unique constraint violation.
- Startup failure.
- Partial seed state.

Mitigation strategies:

- Use EF Core `UseSeeding` / `UseAsyncSeeding` with migration locking.
- Run seed logic in a separate deployment/init job.
- Use database uniqueness constraints.
- Use transactions where appropriate.
- Use database locks or application locks when needed.
- Ensure only one instance performs seeding.
- Make seed logic retry-safe.
- Do not run high-risk seed logic in normal app startup in production.

### Migration Locking

Modern EF Core includes migration locking around migration operations. This protects migration and seeding operations from concurrent execution when multiple processes attempt to migrate at the same time.

This matters because `UseSeeding` and `UseAsyncSeeding` are called as part of migration-related operations and are protected by the migration lock.

Practical impact:

- Reduces risk of two app instances applying migrations at the same time.
- Helps protect seed logic that runs with migrations.
- Does not mean every startup migration pattern is automatically a good production strategy.
- Provider behavior can vary.
- SQL scripts applied outside EF Core are not protected by EF Core's migration lock.

Interview nuance: migration locking improves safety, but production deployments still need careful database migration strategy, least-privilege permissions, reviewable scripts or migration bundles, and rollback planning.

### `EnsureCreated` vs `Migrate`

`EnsureCreated` and `Migrate` are different.

`EnsureCreated` creates the database schema directly from the current model if the database does not exist. It bypasses migrations.

```csharp
await context.Database.EnsureCreatedAsync();
```

`Migrate` applies pending migrations.

```csharp
await context.Database.MigrateAsync();
```

Important rule:

Do not use `EnsureCreated` and migrations together for the same relational database lifecycle.

Bad:

```csharp
await context.Database.EnsureCreatedAsync();
await context.Database.MigrateAsync();
```

`EnsureCreated` is useful for:

- Simple prototypes.
- Tests.
- In-memory or non-relational scenarios.
- Throwaway databases.

`Migrate` is used when:

- You manage schema with EF Core migrations.
- You need incremental schema evolution.
- You need production database changes over time.

For seeding:

- `EnsureCreated` can create a new database and include model-managed data.
- `Migrate` applies migrations and can run configured seeding logic.
- If the database already exists, `EnsureCreated` does not update schema or seed data.

### Applying Migrations and Seeding in Production

Production database changes should be controlled.

Common safer strategies:

- Generate SQL migration scripts and review them.
- Use idempotent migration scripts when target migration state differs across environments.
- Use migration bundles.
- Run migrations and seeds as part of a deployment job.
- Use a separate initialization executable.
- Coordinate with a DBA when needed.
- Apply least-privilege permissions to the main application.
- Avoid letting every app instance modify schema on startup.

Applying migrations at runtime during app startup is convenient for development, but it can be risky in production.

Risks:

- Multiple instances may migrate or seed at the same time.
- The app needs elevated schema permissions.
- SQL is applied without manual review.
- Startup can fail if migration fails.
- Rollback strategy may be unclear.
- The app may run while the schema is changing.
- Long migrations can delay startup or cause downtime.

A strong interview answer should distinguish development convenience from production deployment safety.

### Manual Migration Customization

Sometimes seed data should be tied to a specific migration.

Example:

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.InsertData(
        table: "OrderStatuses",
        columns: new[] { "Id", "Name" },
        values: new object[,]
        {
            { 1, "Draft" },
            { 2, "Submitted" },
            { 3, "Paid" }
        });
}
```

Manual migration customization is useful when:

- Data change is tied to a schema change.
- A one-time data correction is needed.
- Data must be transformed during migration.
- A column is split or renamed and values must be copied.
- A backfill is required.

Example data backfill:

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>(
        name: "NormalizedEmail",
        table: "Users",
        nullable: true);

    migrationBuilder.Sql("""
        UPDATE Users
        SET NormalizedEmail = UPPER(Email)
        WHERE Email IS NOT NULL
        """);
}
```

This is not general seeding. It is a migration-specific data operation.

### Seeding Lookup Data

Lookup data is one of the best use cases for `HasData` when it is fixed and deterministic.

Example:

```csharp
public sealed class OrderStatus
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}
```

Configuration:

```csharp
modelBuilder.Entity<OrderStatus>(builder =>
{
    builder.HasIndex(s => s.Code).IsUnique();

    builder.HasData(
        new OrderStatus { Id = 1, Code = "DRAFT", DisplayName = "Draft" },
        new OrderStatus { Id = 2, Code = "SUBMITTED", DisplayName = "Submitted" },
        new OrderStatus { Id = 3, Code = "PAID", DisplayName = "Paid" },
        new OrderStatus { Id = 4, Code = "CANCELLED", DisplayName = "Cancelled" });
});
```

This works well because:

- Values are fixed.
- Keys are stable.
- Data is small.
- Data changes only through migrations.
- It does not depend on current database state.

However, if admins can edit statuses in production, `HasData` becomes risky because migrations may overwrite or conflict with production changes.

### Seeding Roles and Permissions

Roles and permissions can be seeded in different ways depending on the application design.

Static permissions are often good candidates for `HasData`:

```csharp
modelBuilder.Entity<Permission>().HasData(
    new Permission { Id = 1, Code = "orders.read", Description = "Read orders" },
    new Permission { Id = 2, Code = "orders.write", Description = "Create and update orders" },
    new Permission { Id = 3, Code = "orders.approve", Description = "Approve orders" });
```

Role-permission mappings can be seeded if they are fixed:

```csharp
modelBuilder.Entity<RolePermission>().HasData(
    new RolePermission { RoleId = 1, PermissionId = 1 },
    new RolePermission { RoleId = 1, PermissionId = 2 },
    new RolePermission { RoleId = 1, PermissionId = 3 });
```

ASP.NET Core Identity roles and users are often better seeded with runtime logic because Identity APIs handle normalization, password hashing, validators, security stamps, and other details.

Example runtime role seeding:

```csharp
public static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
{
    var roles = new[] { "Admin", "User", "Support" };

    foreach (var roleName in roles)
    {
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            await roleManager.CreateAsync(new IdentityRole(roleName));
        }
    }
}
```

### Seeding Admin Users

Initial admin user seeding must be handled carefully.

Bad practice:

```csharp
modelBuilder.Entity<User>().HasData(
    new User
    {
        Id = 1,
        Email = "admin@example.com",
        PasswordHash = "hard-coded-hash"
    });
```

Problems:

- Hard-coded credentials.
- Password hash may depend on Identity configuration.
- Security stamp and normalization may be wrong.
- Password may leak through source control.
- Different environments need different admin users.
- Rotating or disabling the initial password is harder.

Better approach:

- Use runtime seed logic.
- Read initial admin email from secure configuration.
- Read temporary password from a secret store.
- Force password change on first login.
- Disable seeding after initial setup.
- Make the operation idempotent.
- Use Identity APIs.
- Avoid logging secrets.

Example:

```csharp
public sealed class AdminUserSeeder
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IConfiguration _configuration;

    public AdminUserSeeder(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
    }

    public async Task SeedAsync()
    {
        var email = _configuration["SeedAdmin:Email"];
        var password = _configuration["SeedAdmin:Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        if (!await _roleManager.RoleExistsAsync("Admin"))
        {
            await _roleManager.CreateAsync(new IdentityRole("Admin"));
        }

        var user = await _userManager.FindByEmailAsync(email);

        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true
            };

            var createResult = await _userManager.CreateAsync(user, password);

            if (createResult.Succeeded)
            {
                await _userManager.AddToRoleAsync(user, "Admin");
            }
        }
    }
}
```

### Environment-Specific Seeding

Different environments may need different seed data.

Examples:

| Environment | Seed Data |
|---|---|
| Development | Sample users, demo orders, fake products |
| Test | Deterministic test data |
| Staging | Production-like reference data |
| Production | Required roles, permissions, lookup data only |

Environment-specific seeding should be explicit.

Example:

```csharp
if (app.Environment.IsDevelopment())
{
    await DevelopmentSeeder.SeedAsync(app.Services);
}
```

Avoid accidentally seeding development data into production.

Bad:

```csharp
await DemoDataSeeder.SeedAsync(app.Services);
```

Better:

```csharp
if (app.Environment.IsDevelopment())
{
    await DemoDataSeeder.SeedAsync(app.Services);
}
```

For production, seed only required operational data, not fake sample data.

### Test Data Seeding

Test data seeding is different from production seeding.

Integration tests often need deterministic data.

Example:

```csharp
public static async Task SeedTestDataAsync(AppDbContext context)
{
    context.Customers.Add(new Customer
    {
        Name = "Test Customer"
    });

    context.Orders.Add(new Order
    {
        OrderNumber = "TEST-001",
        Total = 100
    });

    await context.SaveChangesAsync();
}
```

Best practices for tests:

- Use deterministic data.
- Reset database state between tests when needed.
- Avoid relying on production seed logic for all tests.
- Use builders or factories for test entities.
- Keep test seed data small and focused.
- Use the real relational provider when testing EF behavior.
- Avoid EF InMemory provider for relational behavior tests.

Test seed data should not pollute production migrations.

### Large Seed Data

Large seed data is usually not a good fit for `HasData`.

Problems:

- Large migration snapshots.
- Large migration files.
- Slow migrations.
- Difficult code reviews.
- Source control noise.
- Potential memory and tooling overhead.
- Harder data updates.

Better options for large data:

- Bulk import scripts.
- CSV import tools.
- Separate data migration process.
- SQL scripts reviewed by DBAs.
- Application-specific import job.
- ETL pipeline.
- Runtime seed job with batching.
- Database backup/restore for demo data.

Example runtime batching:

```csharp
foreach (var batch in products.Chunk(500))
{
    context.Products.AddRange(batch);

    await context.SaveChangesAsync(cancellationToken);

    context.ChangeTracker.Clear();
}
```

Large seed data should be handled as a data import problem, not a model snapshot problem.

### Deterministic vs Non-Deterministic Seed Data

`HasData` should use deterministic values.

Good:

```csharp
new OrderStatus { Id = 1, Code = "DRAFT", DisplayName = "Draft" }
```

Bad:

```csharp
new OrderStatus
{
    Id = 1,
    Code = "DRAFT",
    DisplayName = "Draft",
    CreatedAtUtc = DateTime.UtcNow
}
```

`DateTime.UtcNow`, `Guid.NewGuid()`, random values, and environment-specific values are not good fits for model-managed data because migrations compare snapshots and expect stable values.

If you need runtime-generated values, use runtime seed logic.

Example:

```csharp
if (!await context.ApiClients.AnyAsync(c => c.Name == "DefaultClient"))
{
    context.ApiClients.Add(new ApiClient
    {
        Name = "DefaultClient",
        ClientSecret = secretGenerator.Generate(),
        CreatedAtUtc = timeProvider.GetUtcNow().UtcDateTime
    });

    await context.SaveChangesAsync();
}
```

### Seed Data and Database Constraints

Seed logic should work with database constraints, not replace them.

Example unique constraint:

```csharp
modelBuilder.Entity<Role>()
    .HasIndex(r => r.Name)
    .IsUnique();
```

Seed logic:

```csharp
if (!await context.Roles.AnyAsync(r => r.Name == "Admin"))
{
    context.Roles.Add(new Role { Name = "Admin" });
    await context.SaveChangesAsync();
}
```

The application check avoids normal duplicate inserts. The unique constraint protects against race conditions and manual database changes.

Best practice:

- Add unique indexes for natural unique values.
- Use transactions when multiple seed records must be consistent.
- Handle unique constraint failures gracefully if concurrent seeding is possible.
- Do not rely only on "check then insert" logic.

### Seed Data and Transactions

Some seed operations must be atomic.

Example:

```csharp
await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

try
{
    var role = await context.Roles
        .SingleOrDefaultAsync(r => r.Name == "Admin", cancellationToken);

    if (role is null)
    {
        role = new Role { Name = "Admin" };
        context.Roles.Add(role);
        await context.SaveChangesAsync(cancellationToken);
    }

    var permission = await context.Permissions
        .SingleAsync(p => p.Code == "users.manage", cancellationToken);

    var hasMapping = await context.RolePermissions
        .AnyAsync(rp => rp.RoleId == role.Id && rp.PermissionId == permission.Id, cancellationToken);

    if (!hasMapping)
    {
        context.RolePermissions.Add(new RolePermission
        {
            RoleId = role.Id,
            PermissionId = permission.Id
        });

        await context.SaveChangesAsync(cancellationToken);
    }

    await transaction.CommitAsync(cancellationToken);
}
catch
{
    await transaction.RollbackAsync(cancellationToken);
    throw;
}
```

Use transactions when partial seed state would be harmful. However, avoid wrapping EF Core migration operations in unsupported explicit transaction patterns. Know the difference between application seed transactions and EF migration execution behavior.

### Seed Data Versioning

Seed data changes should be versioned carefully.

Examples:

- Add new permission code.
- Rename a status display name.
- Remove an obsolete lookup value.
- Add a new default configuration key.
- Backfill a value for existing customers.

For static reference data controlled by the application, `HasData` plus migrations can version changes.

For dynamic or state-dependent changes, use migrations with custom SQL or controlled runtime seed jobs.

Example migration backfill:

```csharp
migrationBuilder.Sql("""
    UPDATE CustomerSettings
    SET TimeZone = 'UTC'
    WHERE TimeZone IS NULL
    """);
```

Best practice:

- Treat seed changes as part of deployment.
- Review generated migration operations.
- Avoid destructive updates unless intentional.
- Document business meaning of seed values.
- Use stable codes for business logic instead of display names.
- Avoid deleting lookup values still referenced by existing rows.

### Soft-Deleting or Retiring Seeded Reference Data

Deleting seeded lookup data can break historical records.

Example:

```text
OrderStatus: Cancelled
```

If historical orders reference `Cancelled`, deleting that status can violate foreign keys or make old data unreadable.

Better pattern:

```csharp
public sealed class OrderStatus
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
```

Instead of deleting:

```csharp
status.IsActive = false;
```

This preserves historical data while preventing new usage.

For `HasData`, changing `IsActive` from `true` to `false` can be migration-managed if the data is static.

### `HasData` vs Runtime Seed Logic

The main comparison:

| Question | `HasData` | Runtime Seed Logic |
|---|---|---|
| Runs through migrations? | Yes | Can run during migration/seeding/startup/job |
| Needs primary keys? | Yes | No, can use generated keys |
| Can query database state? | No | Yes |
| Good for static lookup data? | Yes | Yes |
| Good for Identity users? | Usually no | Yes |
| Good for large data? | No | Sometimes, with batching |
| Good for environment-specific data? | No | Yes, if controlled |
| Good for deterministic data? | Yes | Yes |
| Good for data with `DateTime.Now` or `Guid.NewGuid()`? | No | Yes, if intended |
| Risk of duplicates? | Low through migrations, but conflicts possible | Must be handled with idempotency and constraints |
| Stored in migration snapshot? | Yes | No |
| Can call external services? | No | Yes, but be careful |

Rule of thumb:

Use `HasData` for small static reference data controlled by migrations.

Use `UseSeeding` / `UseAsyncSeeding` or controlled runtime logic for general-purpose seeding that must inspect the database, use generated keys, call services, or vary by environment.

### Seeding in Clean Architecture

In Clean Architecture, seeding usually belongs in the Infrastructure or Persistence layer, not the Domain layer.

Example structure:

```text
MyApp.Domain
  Entities
  ValueObjects

MyApp.Application
  Use cases
  Interfaces

MyApp.Infrastructure
  AppDbContext
  Entity configurations
  Seeders

MyApp.Api
  Program.cs
```

A seeder can be registered as a service:

```csharp
public interface IDatabaseSeeder
{
    Task SeedAsync(CancellationToken cancellationToken = default);
}
```

Implementation:

```csharp
public sealed class DatabaseSeeder : IDatabaseSeeder
{
    private readonly AppDbContext _context;

    public DatabaseSeeder(AppDbContext context)
    {
        _context = context;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (!await _context.Roles.AnyAsync(r => r.Name == "Admin", cancellationToken))
        {
            _context.Roles.Add(new Role { Name = "Admin" });
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
```

For production, run this in a controlled deployment/init process, not randomly during normal request processing.

### Seeding in Docker and Cloud Deployments

In Docker, Kubernetes, Azure App Service, Azure Container Apps, or other cloud environments, multiple instances may start at the same time. This affects seeding.

Risky pattern:

```text
Every app instance starts -> every app instance runs migrations and seed logic
```

Safer patterns:

- Run migrations and seed logic as a separate deployment step.
- Use a one-off Kubernetes Job.
- Use a CI/CD database migration stage.
- Use an EF migration bundle.
- Use SQL scripts reviewed before production.
- Use a controlled admin/init tool.
- Use `UseSeeding` with migration operations when appropriate.
- Ensure idempotency and uniqueness constraints.

Cloud deployments should avoid requiring the main application identity to have schema modification permissions unless carefully justified.

### Security Considerations

Seed logic can create security risks.

Common risks:

- Hard-coded admin passwords.
- Default credentials left enabled.
- Secrets committed to source control.
- Overly privileged default users.
- Seeding production with development accounts.
- Logging seed passwords.
- Not forcing password reset.
- Not auditing who ran seed logic.
- Running seed logic repeatedly and resetting credentials unexpectedly.

Better practices:

- Use secret stores for temporary credentials.
- Use environment-specific configuration.
- Force password change on first login.
- Disable or remove bootstrap seed logic after setup.
- Use least privilege.
- Log non-sensitive seed events.
- Never log passwords or tokens.
- Protect seed tools and migration jobs.

### Common Mistakes

Common mistakes include:

- Using `HasData` for dynamic or environment-specific data.
- Using `HasData` for password hashes or Identity users.
- Forgetting to specify primary keys in `HasData`.
- Changing `HasData` primary keys and causing delete/insert operations.
- Seeding with `DateTime.Now` or `Guid.NewGuid()` in model configuration.
- Putting large datasets into migrations.
- Running seed logic in every app instance on startup.
- Not making runtime seed logic idempotent.
- Not enforcing unique constraints for seeded natural keys.
- Seeding development demo data into production.
- Calling `EnsureCreated` and `Migrate` together.
- Assuming `EnsureCreated` updates existing databases.
- Not reviewing generated migrations from `HasData`.
- Deleting seeded lookup data that historical rows still reference.
- Storing seed passwords in source control.
- Ignoring concurrency in cloud deployments.

### Best Practices

Choose the seeding strategy based on data lifecycle.

Use `HasData` only for small, stable, deterministic reference data.

Use `UseSeeding` and `UseAsyncSeeding` for general-purpose EF Core seeding logic.

Implement both synchronous and asynchronous seeding methods when using EF Core seeding options.

Make runtime seed logic idempotent.

Add database unique constraints for natural keys such as role name, permission code, country code, and setting key.

Use migrations or reviewed scripts for production schema and data changes.

Avoid running high-risk seed logic automatically in every production app instance.

Use separate migration/init jobs in cloud deployments.

Do not use `HasData` for sensitive default users or passwords.

Keep test and demo seed data separate from production seed data.

Review generated migrations.

Avoid large seed data in migration snapshots.

Use transactions for multi-step seed operations when partial state would be harmful.

Treat seeding as part of deployment and operations, not just application startup code.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q01 -->
#### Beginner Q01: What is data seeding in EF Core?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Data seeding is the process of putting initial or required data into a database. In EF Core, this can be done with `UseSeeding`, `UseAsyncSeeding`, `HasData`, custom initialization logic, manual migration operations, or test setup code.

Examples include roles, permissions, lookup values, order statuses, countries, currencies, demo data, and test data.

The best seeding method depends on whether the data is static, dynamic, environment-specific, large, security-sensitive, or dependent on existing database state.

##### Key Points to Mention

- Seeding means inserting initial data.
- Common examples are roles, permissions, and lookup tables.
- EF Core has multiple seeding options.
- `HasData` is model-managed data.
- `UseSeeding` and `UseAsyncSeeding` support general-purpose seeding.
- Seed strategy should match the data lifecycle.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q01 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q02 -->
#### Beginner Q02: What is `HasData` used for?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`HasData` is used to configure model-managed data in EF Core. The configured data becomes part of the model snapshot, and migrations generate insert, update, or delete operations for that data.

Example:

```csharp
modelBuilder.Entity<OrderStatus>().HasData(
    new OrderStatus { Id = 1, Name = "Draft" },
    new OrderStatus { Id = 2, Name = "Submitted" });
```

`HasData` is best for small, stable, deterministic reference data such as lookup values.

##### Key Points to Mention

- Configured in `OnModelCreating`.
- Data is managed through migrations.
- Primary key values must be specified.
- Best for static reference data.
- Not ideal for dynamic or environment-specific data.
- Not ideal for users, passwords, or large datasets.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q02 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q03 -->
#### Beginner Q03: What are `UseSeeding` and `UseAsyncSeeding`?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`UseSeeding` and `UseAsyncSeeding` are EF Core configuration options for placing general-purpose seed logic in the `DbContext` options configuration. They allow the application to query the current database state and insert missing data using normal EF Core code.

Example:

```csharp
options.UseAsyncSeeding(async (context, _, cancellationToken) =>
{
    var exists = await context.Set<Role>()
        .AnyAsync(r => r.Name == "Admin", cancellationToken);

    if (!exists)
    {
        context.Set<Role>().Add(new Role { Name = "Admin" });
        await context.SaveChangesAsync(cancellationToken);
    }
});
```

They are useful for seed logic that needs to inspect the database or use generated keys.

##### Key Points to Mention

- Configured through `DbContextOptionsBuilder`.
- Supports general-purpose seed logic.
- Can query the database.
- Can use generated keys.
- Should be idempotent.
- Implement both sync and async versions when using this feature.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q03 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q04 -->
#### Beginner Q04: Why does `HasData` require primary key values?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`HasData` requires primary key values because EF Core migrations use those keys to identify seeded rows across model snapshots. The key tells EF Core whether a row should be inserted, updated, or deleted in a migration.

If the primary key changes, EF Core may treat the row as a different row and generate delete and insert operations.

##### Key Points to Mention

- Migrations need stable row identity.
- Primary key is used to compare seed data between snapshots.
- Keys must be deterministic.
- Changing keys can cause delete and insert operations.
- This is one reason `HasData` is not ideal for generated keys.
- Stable lookup data works best.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q04 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q05 -->
#### Beginner Q05: What is idempotent seed logic?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Idempotent seed logic can run multiple times and still produce the same final database state. It should not insert duplicates or reset data unexpectedly.

Bad example:

```csharp
context.Roles.Add(new Role { Name = "Admin" });
await context.SaveChangesAsync();
```

Better example:

```csharp
if (!await context.Roles.AnyAsync(r => r.Name == "Admin"))
{
    context.Roles.Add(new Role { Name = "Admin" });
    await context.SaveChangesAsync();
}
```

Idempotent logic is important because seed code may run more than once across deployments, local development, testing, or retries.

##### Key Points to Mention

- Safe to run multiple times.
- Avoids duplicates.
- Checks whether data already exists.
- Should be supported by unique constraints.
- Important for runtime seed logic.
- Useful in deployment and test scenarios.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q05 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q06 -->
#### Beginner Q06: What kind of data is a good fit for `HasData`?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

`HasData` is a good fit for small, stable, deterministic reference data that is controlled by the application and changes only through migrations.

Examples:

- Order statuses.
- Country codes.
- Currency codes.
- Static lookup categories.
- Fixed permission definitions.

It is not a good fit for temporary test data, large data, generated values, environment-specific values, external API data, or data changed directly in production.

##### Key Points to Mention

- Small data.
- Static data.
- Deterministic values.
- Stable primary keys.
- Controlled by migrations.
- Does not depend on current database state.
- Examples include statuses and lookup values.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q01 -->
#### Intermediate Q01: What is the difference between `HasData` and runtime seed logic?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`HasData` is model-managed data. It is configured in the EF Core model, stored in the model snapshot, and applied through migrations. It requires primary key values and is best for fixed reference data.

Runtime seed logic is normal C# code that runs against the database. It can query existing data, use generated keys, call services, read configuration, and make decisions. It is better for roles, users, environment-specific data, data that depends on current database state, and dynamic initialization.

The trade-off is that runtime seed logic must be made idempotent and must handle concurrency and deployment safety.

##### Key Points to Mention

- `HasData` is migration/model-managed.
- Runtime seed logic queries the database.
- `HasData` needs explicit keys.
- Runtime logic can use generated keys.
- `HasData` is best for fixed lookup data.
- Runtime logic is better for dynamic or environment-specific data.
- Runtime logic must handle idempotency and concurrency.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q01 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q02 -->
#### Intermediate Q02: Why is `HasData` not recommended for ASP.NET Core Identity users and passwords?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`HasData` is not ideal for Identity users and passwords because Identity user creation involves runtime services such as `UserManager`, `RoleManager`, password hashing, normalization, security stamps, validators, and configuration. Hard-coding password hashes in migrations is also a security and maintenance risk.

A better approach is to seed users and roles through runtime logic using Identity APIs, with credentials coming from secure configuration or a secret store.

##### Key Points to Mention

- Identity has runtime creation logic.
- Password hashing should use Identity services.
- Hard-coded password hashes are risky.
- Security stamps and normalization matter.
- Admin credentials may differ by environment.
- Use `UserManager` and `RoleManager`.
- Store temporary passwords securely.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q02 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q03 -->
#### Intermediate Q03: How do you seed related data with `HasData`?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

When using `HasData` for related data, specify primary key and foreign key values explicitly. Do not rely on navigation properties.

Example:

```csharp
modelBuilder.Entity<Country>().HasData(
    new Country { Id = 1, Name = "USA" });

modelBuilder.Entity<City>().HasData(
    new City { Id = 1, Name = "Seattle", CountryId = 1 });
```

For many-to-many relationships, configure and seed the join entity or join table explicitly.

##### Key Points to Mention

- Use scalar FK values.
- Do not seed through navigation properties.
- Primary keys must be specified.
- Foreign keys must match seeded principals.
- Many-to-many join data must be seeded explicitly.
- Owned type data may need anonymous objects.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q03 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q04 -->
#### Intermediate Q04: What are the risks of running seed logic on application startup?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Running seed logic during normal application startup can be risky, especially in production. If multiple app instances start at the same time, they may try to seed or migrate concurrently. The app may also need elevated database permissions, startup can fail if seeding fails, and data changes may happen without review.

For production, it is often better to run migrations and seed logic in a controlled deployment step, migration bundle, SQL script, or one-off initialization job. If startup seeding is used, it must be idempotent and concurrency-safe.

##### Key Points to Mention

- Multiple instances may run seed logic concurrently.
- Can cause duplicates or constraint violations.
- App may need elevated schema/data permissions.
- Startup can fail or slow down.
- Production changes may not be reviewed.
- Better to use deployment/init jobs for production.
- Use uniqueness constraints and idempotency.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q04 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q05 -->
#### Intermediate Q05: What is the difference between `EnsureCreated` and `Migrate` for seeding?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

`EnsureCreated` creates a database schema directly from the current model if the database does not exist. It bypasses migrations. It is useful for tests, prototypes, or throwaway databases.

`Migrate` applies pending EF Core migrations. It is used for databases managed through migrations and production-style schema evolution.

Do not mix `EnsureCreated` and migrations for the same relational database lifecycle. If `EnsureCreated` creates the schema, migrations may not work correctly later.

##### Key Points to Mention

- `EnsureCreated` bypasses migrations.
- `Migrate` applies migrations.
- Do not call `EnsureCreated` before `Migrate`.
- `EnsureCreated` is useful for tests/prototypes.
- `Migrate` is for migration-managed databases.
- Existing databases are not updated by `EnsureCreated`.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q05 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q06 -->
#### Intermediate Q06: How should development or demo seed data be handled?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Development or demo seed data should be separated from production seed data. It should run only in development, demo, or test environments, usually guarded by environment checks.

Example:

```csharp
if (app.Environment.IsDevelopment())
{
    await DemoDataSeeder.SeedAsync(app.Services);
}
```

Production should receive only required operational seed data, such as roles, permissions, and lookup values. Fake users, sample orders, and demo products should not accidentally appear in production.

##### Key Points to Mention

- Keep dev/demo data separate.
- Guard with environment checks.
- Do not seed fake data in production.
- Use deterministic data for tests.
- Use factories/builders for test data.
- Production seed data should be minimal and required.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q06 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q07 -->
#### Intermediate Q07: Why should seed logic also use database constraints?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Application seed logic can check whether data exists before inserting, but that check is not enough under concurrency. Two instances could check at the same time and both try to insert.

Database constraints, such as unique indexes, protect the database from duplicates even when application logic has a race condition.

Example:

```csharp
modelBuilder.Entity<Role>()
    .HasIndex(r => r.Name)
    .IsUnique();
```

Seed logic should be idempotent, but the database should still enforce important uniqueness rules.

##### Key Points to Mention

- App checks can race.
- Unique indexes protect data integrity.
- Database is the final consistency boundary.
- Use natural unique keys such as role name or permission code.
- Handle unique constraint failures if needed.
- Do not rely only on seed code.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q07 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q08 -->
#### Intermediate Q08: When would you manually customize a migration for data changes?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Manual migration customization is useful when the data change is tied to a schema change or needs a one-time migration operation. Examples include backfilling a new column, copying data from an old column to a new column, inserting fixed rows for a new lookup table, or cleaning data before adding a constraint.

Example:

```csharp
migrationBuilder.Sql("""
    UPDATE Users
    SET NormalizedEmail = UPPER(Email)
    WHERE Email IS NOT NULL
    """);
```

This is different from general seed logic. It is part of a specific migration.

##### Key Points to Mention

- Useful for one-time data changes.
- Often tied to schema changes.
- Can use `InsertData`, `UpdateData`, `DeleteData`, or raw SQL.
- Good for backfills.
- Review migration scripts carefully.
- Not a replacement for ongoing runtime seed logic.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q01 -->
#### Advanced Q01: How would you design a production-ready EF Core seeding strategy?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A production-ready strategy should separate seed data by lifecycle. Use `HasData` only for small, stable, deterministic reference data that should be versioned through migrations. Use `UseSeeding` and `UseAsyncSeeding` or controlled runtime initialization for general seed logic that needs to query database state, use generated keys, or create roles/users.

Production migrations and seed operations should run in a controlled deployment process, such as reviewed SQL scripts, migration bundles, or a one-off initialization job. Avoid running high-risk seed logic automatically in every app instance during startup. Seed logic should be idempotent, concurrency-safe, protected by unique constraints, and should avoid secrets in source control.

##### Key Points to Mention

- Classify data by lifecycle.
- Use `HasData` for static deterministic reference data.
- Use runtime seeding for dynamic or state-dependent data.
- Use Identity APIs for users and roles.
- Run production seeding in a controlled deployment step.
- Make seed logic idempotent.
- Add unique constraints.
- Avoid secrets and default passwords.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q01 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q02 -->
#### Advanced Q02: Why can `HasData` cause unexpected migration operations?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`HasData` is compared through EF Core's model snapshot, not by querying the current database. If the configured seed data changes, EF Core generates migration operations based on the snapshot difference.

Changing a primary key may generate delete and insert operations. Changing values outside migrations can conflict with future migration-managed updates. Non-deterministic values such as `DateTime.Now` or `Guid.NewGuid()` can cause repeated or unexpected changes.

This is why `HasData` should be used only for stable deterministic data controlled by migrations.

##### Key Points to Mention

- `HasData` is snapshot-based.
- EF Core does not inspect current database state for differences.
- Primary key changes can become delete/insert operations.
- External data changes can conflict with migrations.
- Non-deterministic values are dangerous.
- Review generated migrations.
- Use runtime seeding for dynamic data.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q02 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q03 -->
#### Advanced Q03: How would you seed permissions and role-permission mappings?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

If permissions are static application-defined values, they can be seeded with `HasData` using stable IDs or stable keys. Role-permission mappings can also be seeded if they are fixed and controlled by the application.

For dynamic or administrator-configurable roles, runtime seed logic is better. The seed should check for existing roles and permissions, create missing items, and avoid overwriting user-customized assignments unless that is explicitly intended.

Database unique constraints should enforce permission code uniqueness and role name uniqueness.

##### Key Points to Mention

- Static permissions can use `HasData`.
- Dynamic roles should use runtime logic.
- Use stable permission codes.
- Add unique indexes.
- Be careful not to overwrite admin-customized permissions.
- Seed role-permission mappings explicitly.
- Use Identity APIs if using ASP.NET Core Identity roles.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q03 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q04 -->
#### Advanced Q04: How do you avoid concurrency problems in runtime seed logic?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

To avoid concurrency problems, make seed logic idempotent, use database unique constraints, and run seed logic in a controlled single-instance deployment process when possible. For EF Core seeding integrated with migration operations, `UseSeeding` and `UseAsyncSeeding` benefit from migration locking.

For cloud deployments with multiple instances, avoid having every instance run seed logic on startup. Use a migration job, migration bundle, deployment stage, or one-off initializer. For critical multi-step seed operations, use transactions and handle uniqueness conflicts gracefully.

##### Key Points to Mention

- Seed logic should be idempotent.
- Add unique constraints.
- Avoid startup seeding in every instance.
- Use a controlled deployment/init job.
- Use `UseSeeding` with migration operations when appropriate.
- Use transactions for multi-step consistency.
- Handle duplicate insert races.
- Consider provider-specific migration lock behavior.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q04 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q05 -->
#### Advanced Q05: How should initial admin users be seeded securely?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Initial admin users should usually be seeded with runtime logic using proper identity services such as `UserManager` and `RoleManager`. Credentials should come from secure configuration or a secret store, not source control. The seed should be idempotent and should not reset passwords repeatedly.

A production strategy should force password change on first login, log non-sensitive seed events, and disable or restrict bootstrap logic after initial setup. Avoid `HasData` for admin users and password hashes.

##### Key Points to Mention

- Use Identity APIs.
- Do not hard-code passwords.
- Use secure configuration or secret store.
- Do not log secrets.
- Force password reset if appropriate.
- Do not reset credentials on every startup.
- Make logic idempotent.
- Avoid `HasData` for password hashes.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q05 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q06 -->
#### Advanced Q06: How would you handle large seed datasets?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Large datasets should generally not be placed in `HasData` because they make migration snapshots and migration files large, slow, and hard to review. Better options include bulk import scripts, SQL scripts, ETL jobs, runtime import tools, CSV import processes, or database restore for demo environments.

If using EF Core runtime logic, insert in batches, clear the change tracker between batches, and ensure the process is resumable or idempotent.

##### Key Points to Mention

- Avoid large `HasData` payloads.
- Large data bloats migration snapshots.
- Use bulk import or SQL scripts.
- Use batching if seeding through EF.
- Clear the change tracker for large inserts.
- Make import resumable or idempotent.
- Treat large seed data as a data import problem.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q06 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q07 -->
#### Advanced Q07: How should seed data be versioned and changed over time?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Static reference data controlled by the application can be versioned through migrations using `HasData`. Changes should be reviewed in generated migrations because they may produce inserts, updates, or deletes.

Dynamic or state-dependent data changes should be handled through custom migrations, SQL scripts, or controlled runtime seed jobs. Avoid deleting lookup data that historical records still reference; prefer marking old values inactive.

Use stable codes for business logic and avoid relying on display names as identifiers.

##### Key Points to Mention

- Version static data through migrations.
- Review generated seed migration operations.
- Use custom migrations for one-time data changes.
- Avoid deleting referenced lookup values.
- Prefer `IsActive` for retiring values.
- Use stable codes.
- Do not overwrite user-managed production data accidentally.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q07 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q08 -->
#### Advanced Q08: What are the production risks of applying migrations and seed logic from the application itself?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Applying migrations and seed logic from the application itself is convenient but risky in production. The app needs elevated database permissions, multiple instances may compete, startup may fail or take too long, migrations are applied without review, rollback planning may be weak, and the app may run while the schema is changing.

Modern migration locking improves some concurrency risks, but it does not remove the need for controlled deployment practices. Safer production approaches include reviewed SQL scripts, idempotent scripts, migration bundles, or dedicated deployment jobs.

##### Key Points to Mention

- App needs schema modification permissions.
- Multiple instances can cause deployment issues.
- Startup can fail or slow down.
- SQL may not be reviewed.
- Rollback may be harder.
- Migration locking helps but is not a complete deployment strategy.
- Prefer controlled deployment for production.
- Use least privilege for the main app.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q08 -->

<!-- question:start:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q09 -->
#### Advanced Q09: How do you decide whether a lookup table should be seeded with `HasData` or runtime logic?

<!-- question-id:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Use `HasData` if the lookup values are small, static, deterministic, application-controlled, and change only through migrations. Examples include fixed status codes or currency codes.

Use runtime logic if the lookup data depends on environment, existing database state, generated keys, external systems, user customization, or operational configuration.

Also consider whether production administrators can edit the lookup values. If they can, `HasData` may conflict with their changes during future migrations.

##### Key Points to Mention

- Static application-controlled lookup data fits `HasData`.
- Dynamic or environment-specific data fits runtime logic.
- Admin-editable data should not be overwritten by migrations.
- Stable primary keys are required for `HasData`.
- Use unique codes for lookup values.
- Consider historical references before deleting values.
- Review migration output.

<!-- question:end:data-seeding-choices-including-hasdata-vs-runtime-seed-logic-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
