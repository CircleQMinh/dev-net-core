---
id: conventions-fluent-api-owned-complex-data-and-relationship-mapping
topic: Entity Framework
subtopic: Conventions, Fluent API, Owned/Complex Data, and Relationship Mapping
category: .NET
---


## Overview

Entity Framework Core uses a model to understand how C# classes map to a database. That model includes entity types, properties, keys, indexes, relationships, owned types, complex types, table names, column names, constraints, and many other mapping details.

This topic covers four important EF Core modeling areas:

1. **Conventions**: EF Core's default rules for discovering entities, keys, properties, relationships, table names, column names, required fields, and foreign keys.
2. **Fluent API**: Explicit model configuration written in `OnModelCreating` or in separate configuration classes.
3. **Owned and complex data**: Techniques for modeling value-object-like data such as addresses, money, audit metadata, contact information, and embedded details.
4. **Relationship mapping**: Configuring one-to-many, one-to-one, many-to-many, required/optional relationships, foreign keys, navigations, shadow properties, and delete behavior.

This topic matters because EF Core is not just a database access library. It is an object-relational mapper. The quality of the EF Core model affects the database schema, migrations, query translation, change tracking, performance, data integrity, and maintainability.

In real applications, you often start with simple conventions. For example, a `Customer` entity with an `Id` property and an `Orders` collection can often be mapped automatically. But production systems usually need explicit configuration for table names, column types, indexes, required fields, relationships, value objects, delete behavior, constraints, and legacy database schemas.

This topic is important for interviews because it tests whether a developer understands how EF Core builds the model and how to control it. Interviewers often ask:

- What does EF Core configure by convention?
- When should you use Fluent API instead of data annotations?
- What is the difference between owned entity types and complex types?
- How do you configure one-to-many, one-to-one, and many-to-many relationships?
- What are navigations and foreign keys?
- What are shadow foreign keys?
- What is the difference between principal and dependent entities?
- How do nullable reference types affect required relationships?
- How do you avoid accidental cascade deletes?
- How do you keep entity configuration maintainable in large projects?

A strong answer should show that you know when conventions are enough, when explicit Fluent API is safer, and how relationship and value-object mapping decisions affect both code and database design.

## Core Concepts

### EF Core Model Building

EF Core builds a metadata model that describes how your C# object model maps to the database.

The model includes:

- Entity types.
- Primary keys.
- Alternate keys.
- Properties.
- Column names and column types.
- Required and optional fields.
- Relationships.
- Foreign keys.
- Navigations.
- Indexes.
- Owned entity types.
- Complex types.
- Table and schema mappings.
- Delete behavior.
- Concurrency tokens.
- Value conversions.
- Query filters.

A basic `DbContext` might look like this:

```csharp
using Microsoft.EntityFrameworkCore;

public sealed class AppDbContext : DbContext
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }
}

public sealed class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public List<Order> Orders { get; } = new();
}

public sealed class Order
{
    public int Id { get; set; }
    public DateTime OrderedAtUtc { get; set; }

    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
}
```

EF Core can infer a lot from this model:

- `Customer` and `Order` are entities because they are exposed through `DbSet`.
- `Id` is the primary key by convention.
- `Customer.Orders` and `Order.Customer` are navigations.
- `Order.CustomerId` is the foreign key.
- A one-to-many relationship exists from `Customer` to `Order`.

Conventions are useful, but they are not a replacement for understanding the generated model.

### Conventions

Conventions are EF Core's default rules for discovering and configuring the model.

Common conventions include:

| Convention | Example |
|---|---|
| `DbSet<T>` types are included as entities | `DbSet<Customer>` includes `Customer` |
| `Id` or `<TypeName>Id` is discovered as primary key | `Customer.Id`, `Customer.CustomerId` |
| Public properties with getters and setters are mapped | `Name`, `Price`, `CreatedAtUtc` |
| Navigation properties are discovered | `Customer.Orders`, `Order.Customer` |
| Foreign keys are discovered by name | `CustomerId`, `OrderId` |
| Nullable properties are optional | `string? Description` |
| Non-nullable value types are required | `int Quantity`, `decimal Price` |
| Foreign key properties get indexes by convention | `Order.CustomerId` |
| Table names often come from `DbSet` names or entity names | `Customers`, `Orders` |

Example:

```csharp
public sealed class Blog
{
    public int Id { get; set; }
    public string Url { get; set; } = string.Empty;

    public List<Post> Posts { get; } = new();
}

public sealed class Post
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;

    public int BlogId { get; set; }
    public Blog Blog { get; set; } = null!;
}
```

EF Core can infer:

- `Blog.Id` is the primary key.
- `Post.Id` is the primary key.
- `Blog.Posts` is a collection navigation.
- `Post.Blog` is a reference navigation.
- `Post.BlogId` is the foreign key.
- The relationship is required because `BlogId` is non-nullable.

Conventions are best when your model follows normal EF Core naming patterns. If your schema is complex, legacy, or security-sensitive, explicit configuration is often better.

### Configuration Precedence

EF Core model configuration usually comes from three sources:

1. **Conventions**
2. **Data annotations**
3. **Fluent API**

The Fluent API is the most powerful and has the highest priority. It can override conventions and most data annotation configurations.

Example using data annotations:

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("app_customers")]
public sealed class Customer
{
    [Key]
    public int CustomerId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
}
```

Equivalent Fluent API:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Customer>(builder =>
    {
        builder.ToTable("app_customers");

        builder.HasKey(c => c.CustomerId);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(200);
    });
}
```

In larger applications, Fluent API is often preferred because it keeps persistence configuration out of domain classes and supports more complete configuration.

### Fluent API

The Fluent API is EF Core's explicit configuration API.

It is usually written inside `OnModelCreating`:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Customer>(builder =>
    {
        builder.ToTable("Customers");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.HasIndex(c => c.Email)
            .IsUnique();
    });
}
```

The Fluent API is used for:

- Table names.
- Schemas.
- Column names.
- Column types.
- Required and optional properties.
- Maximum lengths.
- Precision and scale.
- Indexes.
- Unique constraints.
- Keys and alternate keys.
- Relationships.
- Foreign keys.
- Delete behavior.
- Owned entities.
- Complex types.
- Value conversions.
- Backing fields.
- Query filters.
- Concurrency tokens.

Fluent API is especially important when conventions would be ambiguous.

### Organizing Fluent API with `IEntityTypeConfiguration<T>`

For large applications, putting all mapping code inside `OnModelCreating` becomes hard to maintain. A common pattern is to create separate configuration classes.

Example:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.HasMany(c => c.Orders)
            .WithOne(o => o.Customer)
            .HasForeignKey(o => o.CustomerId)
            .IsRequired();
    }
}
```

Register all configurations:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
```

This approach keeps each entity's mapping close to its own configuration and avoids a huge `DbContext`.

### Entity Types

An entity type is a type that EF Core tracks and maps to a database object such as a table or view.

Example:

```csharp
public sealed class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
}
```

Common ways a type becomes an entity:

- It is exposed as `DbSet<T>` in the context.
- It is configured in `OnModelCreating`.
- It is discovered through a navigation property from another entity.

Example:

```csharp
public sealed class AppDbContext : DbContext
{
    public DbSet<Product> Products => Set<Product>();
}
```

An entity usually has identity, which means EF Core can track one instance as representing one database row. This is different from complex types, which do not have their own identity.

### Keys

A primary key uniquely identifies each entity instance.

By convention, EF Core discovers `Id` or `<EntityName>Id` as the primary key.

Example:

```csharp
public sealed class Customer
{
    public int Id { get; set; }
}
```

Explicit configuration:

```csharp
builder.HasKey(c => c.Id);
```

Composite key:

```csharp
public sealed class OrderLine
{
    public int OrderId { get; set; }
    public int LineNumber { get; set; }

    public string ProductName { get; set; } = string.Empty;
}

builder.HasKey(ol => new { ol.OrderId, ol.LineNumber });
```

Composite keys are common for join entities, line items, and legacy schemas.

### Alternate Keys

An alternate key is a unique identifier other than the primary key. It can be used as the target of a foreign key.

Example:

```csharp
public sealed class Country
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
}

public sealed class Customer
{
    public int Id { get; set; }
    public string CountryCode { get; set; } = string.Empty;
    public Country Country { get; set; } = null!;
}
```

Configuration:

```csharp
modelBuilder.Entity<Country>()
    .HasAlternateKey(c => c.Code);

modelBuilder.Entity<Customer>()
    .HasOne(c => c.Country)
    .WithMany()
    .HasForeignKey(c => c.CountryCode)
    .HasPrincipalKey(c => c.Code);
```

Use alternate keys carefully. In many cases, a unique index is enough unless another entity needs to reference the property as a foreign key target.

### Properties and Column Mapping

EF Core maps entity properties to database columns.

Example:

```csharp
builder.Property(p => p.Name)
    .HasColumnName("product_name")
    .HasMaxLength(200)
    .IsRequired();
```

Decimal precision:

```csharp
builder.Property(p => p.Price)
    .HasPrecision(18, 2);
```

Date/time column type:

```csharp
builder.Property(o => o.OrderedAtUtc)
    .HasColumnType("datetime2");
```

Column default value:

```csharp
builder.Property(o => o.CreatedAtUtc)
    .HasDefaultValueSql("SYSUTCDATETIME()");
```

Common mistake:

```csharp
public decimal Price { get; set; }
```

Without precision configuration, different providers may choose defaults that are not what you expect. For money-like values, configure precision explicitly.

### Required and Optional Properties

EF Core uses CLR nullability and nullable reference types to infer whether a property is required.

Example with nullable reference types enabled:

```csharp
public sealed class Customer
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty; // Required by convention

    public string? MiddleName { get; set; } // Optional by convention
}
```

Explicit configuration:

```csharp
builder.Property(c => c.Name)
    .IsRequired();

builder.Property(c => c.MiddleName)
    .IsRequired(false);
```

For value types:

```csharp
public int Quantity { get; set; }      // Required
public int? DiscountPercent { get; set; } // Optional
```

A common migration issue happens when nullable reference types are enabled in an existing project. Properties that were previously treated as optional may become required, which can generate schema changes.

### Indexes

Indexes improve lookup, filtering, joining, and ordering performance.

By convention, EF Core creates indexes for foreign key properties.

Explicit index:

```csharp
builder.HasIndex(c => c.Email);
```

Unique index:

```csharp
builder.HasIndex(c => c.Email)
    .IsUnique();
```

Composite index:

```csharp
builder.HasIndex(o => new { o.TenantId, o.OrderNumber })
    .IsUnique();
```

A practical production example:

```csharp
builder.HasIndex(o => new { o.TenantId, o.CreatedAtUtc });
```

This supports queries like:

```csharp
var recentOrders = await context.Orders
    .Where(o => o.TenantId == tenantId)
    .OrderByDescending(o => o.CreatedAtUtc)
    .Take(50)
    .ToListAsync();
```

Indexes are not only for performance. Unique indexes also enforce data integrity.

### Navigations

A navigation is a C# property that lets you move between related entities.

Reference navigation:

```csharp
public Customer Customer { get; set; } = null!;
```

Collection navigation:

```csharp
public List<Order> Orders { get; } = new();
```

Example relationship:

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

Navigations are not database columns. They are object model properties that EF Core uses to understand and traverse relationships.

### Foreign Keys

A foreign key property stores the key value of a related principal entity.

Example:

```csharp
public sealed class Order
{
    public int Id { get; set; }

    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
}
```

Here, `CustomerId` is the foreign key.

Explicit configuration:

```csharp
builder.HasOne(o => o.Customer)
    .WithMany(c => c.Orders)
    .HasForeignKey(o => o.CustomerId);
```

Foreign key values are useful because they allow you to change relationships without loading the related entity:

```csharp
order.CustomerId = newCustomerId;
```

Some domain models hide foreign keys for a cleaner object model, but exposing them often makes EF Core usage simpler and more explicit.

### Principal and Dependent Entities

In a relationship, the principal entity is the parent or referenced entity. The dependent entity contains the foreign key.

Example:

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

Here:

- `Customer` is the principal.
- `Order` is the dependent.
- `Order.CustomerId` is the foreign key.

Understanding principal and dependent is important for configuring one-to-one relationships, cascade delete behavior, and required relationships.

### Shadow Properties and Shadow Foreign Keys

A shadow property is a property that exists in the EF Core model but not in the CLR class.

Example:

```csharp
public sealed class Post
{
    public int Id { get; set; }
    public Blog Blog { get; set; } = null!;
}
```

There is no `BlogId` property, but EF Core can create a shadow foreign key.

Configuration:

```csharp
builder.HasOne(p => p.Blog)
    .WithMany(b => b.Posts)
    .HasForeignKey("BlogId");
```

You can access shadow properties in queries using `EF.Property<T>`:

```csharp
var posts = await context.Posts
    .Where(p => EF.Property<int>(p, "BlogId") == blogId)
    .ToListAsync();
```

Shadow foreign keys can keep domain classes cleaner, but they can also make queries, debugging, and DTO mapping less obvious. For many business applications, explicit foreign key properties are easier to maintain.

### One-to-Many Relationships

A one-to-many relationship means one principal entity relates to many dependent entities.

Example:

```csharp
public sealed class Blog
{
    public int Id { get; set; }
    public string Url { get; set; } = string.Empty;

    public List<Post> Posts { get; } = new();
}

public sealed class Post
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;

    public int BlogId { get; set; }
    public Blog Blog { get; set; } = null!;
}
```

Configuration:

```csharp
modelBuilder.Entity<Blog>(builder =>
{
    builder.HasMany(b => b.Posts)
        .WithOne(p => p.Blog)
        .HasForeignKey(p => p.BlogId)
        .IsRequired();
});
```

Optional relationship:

```csharp
public int? BlogId { get; set; }
public Blog? Blog { get; set; }
```

Configuration:

```csharp
builder.HasMany(b => b.Posts)
    .WithOne(p => p.Blog)
    .HasForeignKey(p => p.BlogId)
    .IsRequired(false);
```

One-to-many is the most common EF Core relationship.

### One-to-One Relationships

A one-to-one relationship means one entity is related to at most one other entity.

Example:

```csharp
public sealed class User
{
    public int Id { get; set; }
    public UserProfile Profile { get; set; } = null!;
}

public sealed class UserProfile
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string DisplayName { get; set; } = string.Empty;
}
```

Configuration:

```csharp
modelBuilder.Entity<User>()
    .HasOne(u => u.Profile)
    .WithOne(p => p.User)
    .HasForeignKey<UserProfile>(p => p.UserId)
    .IsRequired();
```

The important part is `HasForeignKey<UserProfile>`. In a one-to-one relationship, EF Core often needs help identifying which side is dependent.

Primary-key-to-primary-key one-to-one:

```csharp
public sealed class User
{
    public int Id { get; set; }
    public UserProfile Profile { get; set; } = null!;
}

public sealed class UserProfile
{
    public int Id { get; set; }
    public User User { get; set; } = null!;
}
```

Configuration:

```csharp
modelBuilder.Entity<User>()
    .HasOne(u => u.Profile)
    .WithOne(p => p.User)
    .HasForeignKey<UserProfile>(p => p.Id);
```

One-to-one relationships are more ambiguous than one-to-many relationships, so explicit configuration is often recommended.

### Many-to-Many Relationships

A many-to-many relationship means many entities on one side can relate to many entities on the other side.

Example:

```csharp
public sealed class Student
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public List<Course> Courses { get; } = new();
}

public sealed class Course
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;

    public List<Student> Students { get; } = new();
}
```

EF Core can create a join table by convention.

Explicit configuration:

```csharp
modelBuilder.Entity<Student>()
    .HasMany(s => s.Courses)
    .WithMany(c => c.Students)
    .UsingEntity("CourseStudent");
```

Many-to-many with an explicit join entity:

```csharp
public sealed class StudentCourse
{
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;

    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;

    public DateTime EnrolledAtUtc { get; set; }
}
```

Configuration:

```csharp
modelBuilder.Entity<StudentCourse>(builder =>
{
    builder.HasKey(sc => new { sc.StudentId, sc.CourseId });

    builder.HasOne(sc => sc.Student)
        .WithMany()
        .HasForeignKey(sc => sc.StudentId);

    builder.HasOne(sc => sc.Course)
        .WithMany()
        .HasForeignKey(sc => sc.CourseId);

    builder.Property(sc => sc.EnrolledAtUtc)
        .IsRequired();
});
```

Use skip navigations for simple many-to-many relationships. Use an explicit join entity when the relationship itself has data, such as `EnrolledAtUtc`, `Role`, `SortOrder`, `AssignedBy`, or `IsPrimary`.

### Required vs Optional Relationships

A required relationship means the dependent must have a principal.

Example:

```csharp
public int CustomerId { get; set; }
public Customer Customer { get; set; } = null!;
```

Optional relationship:

```csharp
public int? CustomerId { get; set; }
public Customer? Customer { get; set; }
```

Configuration:

```csharp
builder.HasOne(o => o.Customer)
    .WithMany(c => c.Orders)
    .HasForeignKey(o => o.CustomerId)
    .IsRequired();
```

For optional:

```csharp
builder.HasOne(o => o.Customer)
    .WithMany(c => c.Orders)
    .HasForeignKey(o => o.CustomerId)
    .IsRequired(false);
```

Required relationships often result in non-nullable foreign key columns. Optional relationships often result in nullable foreign key columns.

### Delete Behavior and Cascade Delete

Delete behavior controls what happens to dependents when a principal is deleted.

Common delete behaviors include:

| Delete Behavior | Meaning |
|---|---|
| `Cascade` | Delete dependents when principal is deleted |
| `Restrict` | Prevent delete if dependents exist |
| `NoAction` | Let the database enforce constraints |
| `SetNull` | Set nullable foreign key to null |
| `ClientCascade` | Cascade in EF Core change tracker but not database |

Example:

```csharp
builder.HasMany(c => c.Orders)
    .WithOne(o => o.Customer)
    .HasForeignKey(o => o.CustomerId)
    .OnDelete(DeleteBehavior.Restrict);
```

Cascade delete can be useful for true parent-child relationships, such as order and order lines. But it can be dangerous for important aggregate roots or shared data.

Good practice:

- Use cascade delete intentionally.
- Avoid accidental cascade delete across large object graphs.
- Be especially careful with required relationships.
- Review generated migrations and database constraints.
- For business-critical data, consider soft delete or restricted delete.

### Owned Entity Types

An owned entity type is an entity type that belongs to another entity. It cannot exist independently from its owner.

Owned types are useful for modeling data that is part of an aggregate.

Example:

```csharp
public sealed class Order
{
    public int Id { get; set; }
    public ShippingAddress ShippingAddress { get; set; } = new();
}

public sealed class ShippingAddress
{
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
}
```

Configuration:

```csharp
modelBuilder.Entity<Order>(builder =>
{
    builder.OwnsOne(o => o.ShippingAddress, address =>
    {
        address.Property(a => a.Street)
            .HasMaxLength(200)
            .IsRequired();

        address.Property(a => a.City)
            .HasMaxLength(100)
            .IsRequired();

        address.Property(a => a.PostalCode)
            .HasMaxLength(20)
            .IsRequired();
    });
});
```

Owned reference types are often mapped to the same table as the owner by default, using columns such as:

```text
ShippingAddress_Street
ShippingAddress_City
ShippingAddress_PostalCode
```

Owned types can also be mapped to separate tables depending on configuration.

### `OwnsOne`

`OwnsOne` maps a single owned reference.

Example:

```csharp
public sealed class Customer
{
    public int Id { get; set; }
    public Address Address { get; set; } = new();
}

public sealed class Address
{
    public string Line1 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
}
```

Configuration:

```csharp
modelBuilder.Entity<Customer>(builder =>
{
    builder.OwnsOne(c => c.Address, address =>
    {
        address.Property(a => a.Line1)
            .HasColumnName("AddressLine1")
            .HasMaxLength(200);

        address.Property(a => a.City)
            .HasColumnName("AddressCity")
            .HasMaxLength(100);
    });
});
```

If the owned type is truly part of the owner and should be saved/deleted with the owner, `OwnsOne` is a good fit.

### `OwnsMany`

`OwnsMany` maps a collection of owned items.

Example:

```csharp
public sealed class Order
{
    public int Id { get; set; }
    public List<OrderNote> Notes { get; } = new();
}

public sealed class OrderNote
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
}
```

Configuration:

```csharp
modelBuilder.Entity<Order>(builder =>
{
    builder.OwnsMany(o => o.Notes, note =>
    {
        note.ToTable("OrderNotes");

        note.WithOwner()
            .HasForeignKey("OrderId");

        note.HasKey("OrderId", "Id");

        note.Property(n => n.Text)
            .HasMaxLength(1000)
            .IsRequired();
    });
});
```

Owned collections usually need a key. A common pattern is a composite key that includes the owner's key plus an owned item identifier.

### Limitations and Trade-Offs of Owned Entity Types

Owned entity types are powerful, but they have limitations and trade-offs.

Important points:

- Owned types are still entity types in EF Core.
- They are dependent on the owner.
- They cannot have their own `DbSet<T>`.
- They are not shared independently across owners.
- They are usually deleted when the owner is deleted.
- Their lifecycle is tied to the owner.
- They can make migrations more complex if overused.
- Collections of owned types require careful key design.

Owned types are best for composition inside aggregates.

Good examples:

- Address inside customer.
- Money inside order line.
- Audit metadata inside entity.
- Order details inside order.
- Contact information inside customer.

Poor examples:

- Shared lookup data.
- Independent entities.
- Data that needs its own repository.
- Data that many owners share by identity.
- Data with a lifecycle independent of the owner.

### Complex Types

Complex types model structured data that has no identity of its own.

They are useful for value-object-like data such as:

- Address.
- Money.
- Coordinates.
- Date range.
- Audit metadata.
- Person name.
- Phone number.
- Contact information.

Example:

```csharp
public sealed class Customer
{
    public int Id { get; set; }
    public Address Address { get; set; } = new();
}

public sealed record Address(
    string Line1,
    string City,
    string PostalCode);
```

Configuration:

```csharp
modelBuilder.Entity<Customer>(builder =>
{
    builder.ComplexProperty(c => c.Address, address =>
    {
        address.Property(a => a.Line1)
            .HasMaxLength(200)
            .IsRequired();

        address.Property(a => a.City)
            .HasMaxLength(100)
            .IsRequired();

        address.Property(a => a.PostalCode)
            .HasMaxLength(20)
            .IsRequired();
    });
});
```

Complex types are not entity types. They do not have keys and are not tracked by identity. They are part of the containing entity.

In modern EF Core, complex types are the preferred option for many value-object scenarios where the type has no identity and should not be treated as an entity.

### Complex Types vs Owned Entity Types

Complex types and owned entity types can look similar, but they have different semantics.

| Feature | Complex Type | Owned Entity Type |
|---|---|---|
| Has its own identity/key | No | Yes, even if hidden |
| Tracked as separate entity | No | Yes |
| Can have `DbSet<T>` | No | No |
| Shared instance allowed | More natural | Not appropriate for shared entity instances |
| Best for | Value-object-like data | Aggregate-owned entity data |
| Configured with | `ComplexProperty` or `[ComplexType]` | `OwnsOne`, `OwnsMany`, or `[Owned]` |
| Relationship semantics | Not a relationship | Ownership relationship |
| Collections | Provider/version dependent; usually more limited | `OwnsMany` supports owned collections |
| Separate table mapping | Not generally the main model; depends on EF/provider features | Possible |
| JSON column mapping | Supported in modern EF/provider scenarios | Also possible in some provider scenarios |

Use complex types when the object has no identity and is just structured data.

Use owned entity types when the object is part of the aggregate but still benefits from entity-like mapping behavior, ownership relationships, or owned collections.

Example complex type:

```csharp
public sealed record Money(decimal Amount, string Currency);
```

Example owned entity type:

```csharp
public sealed class OrderLine
{
    public int Id { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public Money UnitPrice { get; set; } = new(0, "USD");
}
```

In this example, `Money` is likely a complex type. `OrderLine` may be an owned collection because each order line has its own identity within an order.

### Mapping Value Objects

Domain-driven design often uses value objects. In EF Core, value objects are commonly mapped as complex types or owned types.

Example value object:

```csharp
public sealed record Money(decimal Amount, string Currency);
```

Entity:

```csharp
public sealed class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public Money Price { get; set; } = new(0, "USD");
}
```

Complex type mapping:

```csharp
modelBuilder.Entity<Product>(builder =>
{
    builder.ComplexProperty(p => p.Price, money =>
    {
        money.Property(m => m.Amount)
            .HasPrecision(18, 2)
            .HasColumnName("PriceAmount");

        money.Property(m => m.Currency)
            .HasMaxLength(3)
            .HasColumnName("PriceCurrency");
    });
});
```

This keeps `Money` as part of `Product` rather than as a separate table or entity.

### Table Splitting

Table splitting maps multiple entity types to the same database table row.

Owned types often use table splitting when mapped into the owner's table.

Example:

```csharp
public sealed class Order
{
    public int Id { get; set; }
    public OrderDetails Details { get; set; } = new();
}

public sealed class OrderDetails
{
    public string ShippingAddress { get; set; } = string.Empty;
    public string BillingAddress { get; set; } = string.Empty;
}
```

Configuration with owned type:

```csharp
modelBuilder.Entity<Order>(builder =>
{
    builder.OwnsOne(o => o.Details, details =>
    {
        details.Property(d => d.ShippingAddress)
            .HasColumnName("ShippingAddress");

        details.Property(d => d.BillingAddress)
            .HasColumnName("BillingAddress");
    });
});
```

The database may have one `Orders` table containing both order and detail columns.

Table splitting is useful for encapsulation and value-object-like modeling, but it can complicate optional data, nullability, and migrations if not designed carefully.

### JSON Column Mapping

Modern EF Core versions and providers can map structured owned or complex data into JSON columns in some scenarios.

Conceptual example:

```csharp
public sealed class Customer
{
    public int Id { get; set; }
    public ContactDetails ContactDetails { get; set; } = new();
}

public sealed class ContactDetails
{
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
}
```

Provider-specific configuration may allow this structured object to be stored in a single JSON column instead of many relational columns.

Why use JSON mapping:

- The data is naturally document-shaped.
- The data is usually loaded with the parent.
- The data does not need many relational joins.
- The schema changes more frequently than normal columns.
- The provider supports efficient JSON querying and indexing.

Trade-offs:

- Relational constraints may be weaker.
- Querying can be provider-specific.
- Indexing JSON fields requires provider-specific knowledge.
- Migrations and schema validation may be less obvious.
- Reporting and SQL-based analysis may be harder.

For interview answers, mention that JSON mapping is useful but should not be used to avoid proper relational modeling when relationships, constraints, and query patterns need normalized tables.

### Backing Fields and Encapsulation

EF Core can map to backing fields, which helps preserve domain encapsulation.

Example:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = new();

    public int Id { get; private set; }

    public IReadOnlyCollection<OrderLine> Lines => _lines;

    public void AddLine(string productName, int quantity)
    {
        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity));
        }

        _lines.Add(new OrderLine(productName, quantity));
    }
}

public sealed class OrderLine
{
    private OrderLine()
    {
    }

    public OrderLine(string productName, int quantity)
    {
        ProductName = productName;
        Quantity = quantity;
    }

    public int Id { get; private set; }
    public string ProductName { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
}
```

Mapping:

```csharp
modelBuilder.Entity<Order>(builder =>
{
    builder.HasMany(typeof(OrderLine), "_lines")
        .WithOne()
        .OnDelete(DeleteBehavior.Cascade);

    builder.Navigation("_lines")
        .UsePropertyAccessMode(PropertyAccessMode.Field);
});
```

This allows EF Core to use the backing field while application code uses methods that enforce invariants.

### Value Conversions

Value conversions convert between a CLR type and a provider type.

Example enum conversion:

```csharp
public enum OrderStatus
{
    Draft,
    Submitted,
    Paid,
    Cancelled
}
```

Mapping:

```csharp
builder.Property(o => o.Status)
    .HasConversion<string>()
    .HasMaxLength(50);
```

Example strongly typed ID:

```csharp
public readonly record struct CustomerId(Guid Value);

public sealed class Customer
{
    public CustomerId Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
```

Mapping:

```csharp
builder.Property(c => c.Id)
    .HasConversion(
        id => id.Value,
        value => new CustomerId(value));
```

Value conversions are helpful for domain-friendly types, but they are not a replacement for relationship mapping. If a type has multiple fields, a complex type or owned type may be better than a single value converter.

### Data Annotations vs Fluent API

Data annotations are simple and close to the model.

Example:

```csharp
public sealed class Product
{
    public int Id { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
}
```

Fluent API is more powerful and keeps persistence configuration separate.

Example:

```csharp
builder.Property(p => p.Name)
    .HasMaxLength(200)
    .IsRequired();
```

Comparison:

| Aspect | Data Annotations | Fluent API |
|---|---|---|
| Location | On entity class | In EF configuration |
| Complexity | Good for simple rules | Best for complex mappings |
| Separation | Mixes persistence details into model | Keeps mapping separate |
| Capability | Limited | Full EF Core configuration |
| Team preference | Useful in small apps | Preferred in larger apps |

For interviews, a strong answer is: use conventions for simple defaults, data annotations for simple validation/mapping if acceptable, and Fluent API for production-grade, complex, or centralized EF configuration.

### Relationship Mapping Patterns

Common relationship mapping methods:

| Method | Meaning |
|---|---|
| `HasOne` | Entity has one related entity |
| `HasMany` | Entity has many related entities |
| `WithOne` | Other side has one navigation |
| `WithMany` | Other side has many navigation |
| `HasForeignKey` | Configures the dependent foreign key |
| `HasPrincipalKey` | Configures an alternate principal key |
| `IsRequired` | Configures required relationship |
| `OnDelete` | Configures delete behavior |
| `UsingEntity` | Configures many-to-many join entity/table |
| `OwnsOne` | Configures owned reference |
| `OwnsMany` | Configures owned collection |
| `ComplexProperty` | Configures complex type |

Example one-to-many:

```csharp
builder.HasMany(c => c.Orders)
    .WithOne(o => o.Customer)
    .HasForeignKey(o => o.CustomerId)
    .OnDelete(DeleteBehavior.Restrict);
```

Example one-to-one:

```csharp
builder.HasOne(u => u.Profile)
    .WithOne(p => p.User)
    .HasForeignKey<UserProfile>(p => p.UserId);
```

Example many-to-many:

```csharp
builder.HasMany(s => s.Courses)
    .WithMany(c => c.Students)
    .UsingEntity("StudentCourse");
```

### Relationship Mapping Without Navigations

EF Core can map relationships without navigations.

Example:

```csharp
public sealed class AuditLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
}
```

Configuration:

```csharp
modelBuilder.Entity<AuditLog>()
    .HasOne<User>()
    .WithMany()
    .HasForeignKey(a => a.UserId);
```

This creates a database relationship even though `AuditLog` does not have a `User` navigation.

This can be useful when:

- You want a foreign key constraint but not object traversal.
- The relationship is used mostly for integrity.
- Loading the related entity is rarely needed.
- You want to avoid accidental joins or serialization loops.

### Delete Behavior and Aggregate Boundaries

In domain-driven design, aggregate boundaries influence relationship mapping.

Example aggregate:

```text
Order
 └── OrderLine
```

If `OrderLine` cannot exist without `Order`, cascade delete may be appropriate.

Example:

```csharp
builder.HasMany(o => o.Lines)
    .WithOne()
    .HasForeignKey("OrderId")
    .OnDelete(DeleteBehavior.Cascade);
```

Shared reference data should usually not cascade.

Example:

```text
Product -> Category
```

Deleting a category should probably not automatically delete all products.

Configuration:

```csharp
builder.HasOne(p => p.Category)
    .WithMany(c => c.Products)
    .HasForeignKey(p => p.CategoryId)
    .OnDelete(DeleteBehavior.Restrict);
```

Good relationship mapping should reflect business ownership, not just object references.

### Common Mistakes

Common EF Core modeling mistakes include:

- Relying on conventions when the relationship is ambiguous.
- Forgetting to configure the dependent side in one-to-one relationships.
- Using `Cascade` delete accidentally.
- Using owned types for data that should be independent.
- Using regular entities for value objects that have no identity.
- Confusing complex types with owned entity types.
- Using records as EF entities without understanding identity and tracking semantics.
- Exposing EF entities directly as API request models.
- Forgetting indexes for common query paths.
- Not configuring decimal precision for money values.
- Enabling nullable reference types in an existing project without reviewing migrations.
- Creating multiple navigations between the same two types without explicit configuration.
- Using many-to-many skip navigations when the join table needs additional data.
- Hiding all foreign keys and then making queries/debugging harder.
- Putting all Fluent API configuration in a huge `OnModelCreating` method.
- Not reviewing generated migrations.

### Best Practices

Start with conventions when the model is simple and follows standard naming.

Use Fluent API for production mappings, complex relationships, legacy schemas, owned types, complex types, delete behavior, indexes, constraints, and value conversions.

Organize mappings with `IEntityTypeConfiguration<T>`.

Use explicit foreign key properties when it improves clarity.

Use nullable reference types intentionally.

Configure precision for decimal values.

Configure indexes based on real query patterns.

Use owned entity types for aggregate-owned components with owner-dependent lifecycle.

Use complex types for value-object-like structured data with no identity.

Use explicit join entities when many-to-many relationships contain extra data.

Configure delete behavior deliberately.

Review generated migrations before applying them.

Keep API DTOs separate from EF entities.

Use integration tests to verify important mappings, constraints, and delete behavior.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q01 -->
#### Beginner Q01: What are EF Core conventions?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

EF Core conventions are default rules used to build the model without explicit configuration. For example, EF Core can discover entity types from `DbSet<T>`, discover `Id` as a primary key, map public properties to columns, discover navigation properties, infer foreign keys such as `CustomerId`, and create indexes for foreign key columns.

Conventions make simple models quick to build, but they should be overridden with explicit configuration when the model is ambiguous or when the database schema must follow specific rules.

##### Key Points to Mention

- Conventions are default model-building rules.
- `Id` and `<EntityName>Id` are common key conventions.
- Navigation and foreign key properties can be discovered automatically.
- Conventions reduce boilerplate.
- Conventions can be overridden.
- Complex or production models often need Fluent API configuration.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q01 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q02 -->
#### Beginner Q02: What is the Fluent API in EF Core?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The Fluent API is EF Core's explicit model configuration API. It is usually used in `OnModelCreating` or in classes that implement `IEntityTypeConfiguration<T>`.

It can configure tables, columns, keys, relationships, indexes, required fields, delete behavior, owned types, complex types, conversions, and many other mapping details.

Example:

```csharp
modelBuilder.Entity<Product>(builder =>
{
    builder.ToTable("Products");

    builder.HasKey(p => p.Id);

    builder.Property(p => p.Name)
        .IsRequired()
        .HasMaxLength(200);
});
```

##### Key Points to Mention

- Used for explicit EF Core mapping.
- Usually configured in `OnModelCreating`.
- More powerful than data annotations.
- Overrides conventions.
- Useful for production and complex mappings.
- Can be organized using `IEntityTypeConfiguration<T>`.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q02 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q03 -->
#### Beginner Q03: What is a navigation property?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A navigation property is a C# property that represents a relationship between entities. It allows code to move from one entity to related entities.

Example:

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

`Customer.Orders` is a collection navigation, and `Order.Customer` is a reference navigation.

##### Key Points to Mention

- Navigation properties represent relationships in the object model.
- Reference navigation points to one related entity.
- Collection navigation points to many related entities.
- Navigations are not database columns.
- Foreign keys store relationship values in the database.
- EF Core uses navigations to discover relationships.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q03 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q04 -->
#### Beginner Q04: What is a foreign key in EF Core?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A foreign key is a property that stores the key value of a related principal entity. It represents the relationship in the database.

Example:

```csharp
public sealed class Order
{
    public int Id { get; set; }

    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
}
```

`CustomerId` is the foreign key. It points to the related `Customer`.

##### Key Points to Mention

- Foreign key stores the related entity key value.
- Usually exists on the dependent entity.
- Can be discovered by convention.
- Can be configured with `HasForeignKey`.
- Foreign keys are database relationship columns.
- Exposing FK properties often improves clarity.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q04 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q05 -->
#### Beginner Q05: How do you configure a one-to-many relationship in EF Core?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A one-to-many relationship is configured with `HasMany`, `WithOne`, and `HasForeignKey`.

Example:

```csharp
modelBuilder.Entity<Customer>(builder =>
{
    builder.HasMany(c => c.Orders)
        .WithOne(o => o.Customer)
        .HasForeignKey(o => o.CustomerId)
        .IsRequired();
});
```

This means one customer has many orders, and each order has one customer.

##### Key Points to Mention

- Use `HasMany` on the principal collection side.
- Use `WithOne` on the dependent reference side.
- Use `HasForeignKey` to specify the dependent FK.
- `IsRequired` controls required vs optional.
- One-to-many is the most common relationship.
- EF Core can often discover this by convention.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q05 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q06 -->
#### Beginner Q06: What is an owned entity type?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

An owned entity type is an entity type that belongs to another entity and does not have an independent lifecycle. It is configured using `OwnsOne` or `OwnsMany`.

Example:

```csharp
modelBuilder.Entity<Order>(builder =>
{
    builder.OwnsOne(o => o.ShippingAddress);
});
```

Owned types are useful for modeling data that is part of an aggregate, such as an address inside an order or audit metadata inside an entity.

##### Key Points to Mention

- Owned type belongs to an owner.
- It cannot exist independently.
- Configured with `OwnsOne` or `OwnsMany`.
- Useful for aggregate components.
- Often mapped to the owner's table.
- Still has entity-type semantics in EF Core.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q06 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q07 -->
#### Beginner Q07: What is a complex type in EF Core?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

A complex type is structured data inside an entity that has no identity of its own. It is useful for value-object-like data such as `Address`, `Money`, `PhoneNumber`, or `DateRange`.

Example:

```csharp
modelBuilder.Entity<Customer>(builder =>
{
    builder.ComplexProperty(c => c.Address);
});
```

Unlike an entity, a complex type does not have a primary key and is not tracked by identity.

##### Key Points to Mention

- Complex type has no key.
- It has no independent identity.
- It is part of the containing entity.
- Configured with `ComplexProperty` or `[ComplexType]`.
- Good for value-object-like data.
- Different from owned entity types.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-beginner-q07 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q01 -->
#### Intermediate Q01: When should you use Fluent API instead of conventions or data annotations?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use Fluent API when the mapping is complex, ambiguous, or important enough that it should be explicit. Fluent API is preferred for relationships, delete behavior, indexes, owned types, complex types, value conversions, precision, table names, column names, legacy schemas, and large production applications.

Conventions are good for simple models. Data annotations are useful for simple property-level rules, but they are limited and mix persistence configuration into entity classes. Fluent API is more complete and keeps configuration centralized.

##### Key Points to Mention

- Fluent API has the highest configuration power.
- It overrides conventions.
- Better for complex relationships.
- Better for indexes and delete behavior.
- Better for owned and complex types.
- Keeps persistence configuration separate from domain classes.
- Preferred in large applications.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q01 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q02 -->
#### Intermediate Q02: What is the difference between a principal entity and a dependent entity?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The principal entity is the entity being referenced. The dependent entity contains the foreign key.

Example:

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

`Customer` is the principal. `Order` is the dependent because it has `CustomerId`.

This distinction matters for foreign key configuration, required relationships, cascade delete, and one-to-one mapping.

##### Key Points to Mention

- Principal is referenced by the relationship.
- Dependent contains the foreign key.
- Foreign key points to principal key.
- Important for one-to-one relationships.
- Important for cascade delete.
- Required/optional depends on dependent FK nullability.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q02 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q03 -->
#### Intermediate Q03: How do you configure a one-to-one relationship and why can it be ambiguous?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A one-to-one relationship is configured with `HasOne`, `WithOne`, and `HasForeignKey<TDependent>`.

Example:

```csharp
modelBuilder.Entity<User>()
    .HasOne(u => u.Profile)
    .WithOne(p => p.User)
    .HasForeignKey<UserProfile>(p => p.UserId);
```

It can be ambiguous because EF Core must know which entity is the dependent and where the foreign key is. In a one-to-many relationship, the collection side usually makes this obvious. In a one-to-one relationship, both sides are references, so explicit configuration is often safer.

##### Key Points to Mention

- Use `HasOne` and `WithOne`.
- Use `HasForeignKey<TDependent>`.
- One-to-one needs a dependent side.
- The dependent contains the FK.
- Ambiguity is common with two reference navigations.
- Explicit configuration is recommended.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q03 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q04 -->
#### Intermediate Q04: When should you use a many-to-many skip navigation versus an explicit join entity?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use skip navigations when the join table only stores the relationship between two entities and has no extra business data.

Example:

```csharp
modelBuilder.Entity<Student>()
    .HasMany(s => s.Courses)
    .WithMany(c => c.Students);
```

Use an explicit join entity when the relationship has its own data, such as `EnrolledAtUtc`, `AssignedBy`, `SortOrder`, `Role`, or `IsPrimary`.

Example:

```csharp
public sealed class StudentCourse
{
    public int StudentId { get; set; }
    public int CourseId { get; set; }
    public DateTime EnrolledAtUtc { get; set; }
}
```

An explicit join entity gives you full control over the join table and relationship payload.

##### Key Points to Mention

- Skip navigation is good for simple many-to-many.
- Explicit join entity is needed for extra columns.
- Join entity can have its own configuration.
- Composite key is common for join entities.
- Extra relationship data should not be hidden.
- Use explicit mapping for legacy join tables.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q04 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q05 -->
#### Intermediate Q05: What is the difference between an owned entity type and a complex type?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

An owned entity type is still an entity type in EF Core. It has owner-dependent identity and is configured through an ownership relationship using `OwnsOne` or `OwnsMany`.

A complex type has no key and no identity. It is structured data contained inside an entity and is configured using `ComplexProperty` or `[ComplexType]`.

Use complex types for value-object-like data that has no identity, such as `Money` or `Address`. Use owned entity types when the object is part of an aggregate and needs ownership mapping semantics, especially for owned collections or entity-like owned components.

##### Key Points to Mention

- Owned types are entity types.
- Complex types have no identity or key.
- Owned types use `OwnsOne` or `OwnsMany`.
- Complex types use `ComplexProperty`.
- Complex types are good for value objects.
- Owned types are good for aggregate-owned components.
- Owned collections use `OwnsMany`.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q05 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q06 -->
#### Intermediate Q06: What are shadow foreign keys and when might you avoid them?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

A shadow foreign key is a foreign key property that exists in the EF Core model but not in the CLR entity class. EF Core stores its value in the change tracker.

Example:

```csharp
builder.HasOne<Post>()
    .WithMany()
    .HasForeignKey("BlogId");
```

Shadow foreign keys can keep the domain model cleaner, but they can make debugging, querying, DTO mapping, and relationship updates less obvious. Many teams prefer explicit foreign key properties for clarity.

##### Key Points to Mention

- Shadow property exists in EF model only.
- Not exposed on CLR class.
- Value is tracked by EF Core.
- Can be queried with `EF.Property<T>`.
- Useful for clean domain models.
- Can reduce clarity in application code.
- Explicit FK properties are often easier in business apps.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q06 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q07 -->
#### Intermediate Q07: How do nullable reference types affect EF Core required properties and relationships?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

When nullable reference types are enabled, EF Core uses C# nullability to infer whether reference properties are required or optional.

Example:

```csharp
public string Name { get; set; } = string.Empty; // Required
public string? Description { get; set; } // Optional
```

For relationships:

```csharp
public int CustomerId { get; set; }
public Customer Customer { get; set; } = null!;
```

This usually indicates a required relationship.

A nullable foreign key or nullable navigation indicates optional relationship:

```csharp
public int? CustomerId { get; set; }
public Customer? Customer { get; set; }
```

Be careful when enabling nullable reference types in existing projects because it may change migrations by making columns required.

##### Key Points to Mention

- NRT affects EF Core nullability conventions.
- Non-nullable reference property is usually required.
- Nullable reference property is usually optional.
- Nullable FK means optional relationship.
- Existing projects need migration review.
- Fluent API can override conventions.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q07 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q08 -->
#### Intermediate Q08: How do you configure delete behavior and why is it important?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Delete behavior is configured with `OnDelete`.

Example:

```csharp
builder.HasMany(c => c.Orders)
    .WithOne(o => o.Customer)
    .HasForeignKey(o => o.CustomerId)
    .OnDelete(DeleteBehavior.Restrict);
```

Delete behavior controls what happens to dependent rows when a principal row is deleted. For true parent-child relationships, cascade delete may be appropriate. For shared reference data or important business data, restrict or no-action behavior may be safer.

It is important because accidental cascade deletes can remove large amounts of data.

##### Key Points to Mention

- Use `OnDelete`.
- Common options include `Cascade`, `Restrict`, `NoAction`, and `SetNull`.
- Required relationships often cascade by default in some cases.
- Cascade is useful for true child data.
- Restrict is safer for shared data.
- Review generated migrations and database constraints.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q01 -->
#### Advanced Q01: How would you model value objects in EF Core?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Value objects in EF Core can be modeled using complex types, owned entity types, or value conversions depending on their shape and requirements.

For structured value objects with multiple properties and no identity, complex types are usually a good fit.

Example:

```csharp
public sealed record Money(decimal Amount, string Currency);

modelBuilder.Entity<Product>(builder =>
{
    builder.ComplexProperty(p => p.Price, money =>
    {
        money.Property(m => m.Amount)
            .HasPrecision(18, 2);

        money.Property(m => m.Currency)
            .HasMaxLength(3);
    });
});
```

Owned types are useful when ownership semantics or owned collections are needed. Value conversions are useful for single-column value objects, such as strongly typed IDs.

The decision depends on identity, query needs, database shape, provider capabilities, and lifecycle.

##### Key Points to Mention

- Complex types are good for no-identity structured values.
- Owned types are good for aggregate-owned components.
- Value converters are good for single-column values.
- Consider query requirements.
- Consider migrations and provider support.
- Avoid treating independent entities as value objects.
- Keep value object semantics clear.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q01 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q02 -->
#### Advanced Q02: What problems can happen if you rely too much on EF Core conventions?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Conventions are useful, but relying too much on them can cause ambiguous or unintended mappings. EF Core may infer relationships incorrectly, create shadow foreign keys, choose delete behavior you did not expect, generate table or column names that do not match standards, or create migrations that change schema unexpectedly.

This is especially risky with one-to-one relationships, multiple relationships between the same two entity types, legacy schemas, optional relationships, owned types, and complex domain models.

In production systems, important mappings should be explicit through Fluent API so that the generated model is predictable and reviewable.

##### Key Points to Mention

- Conventions can infer wrong relationships.
- One-to-one relationships can be ambiguous.
- Multiple relationships between same types need explicit mapping.
- Shadow FKs may be created unexpectedly.
- Delete behavior may surprise developers.
- Generated migrations should be reviewed.
- Fluent API improves predictability.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q02 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q03 -->
#### Advanced Q03: How would you organize EF Core mappings in a large Clean Architecture application?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

In a large application, EF Core mappings are usually placed in the Infrastructure or Persistence project, not in the Domain project. Each entity can have a separate `IEntityTypeConfiguration<T>` class. The `DbContext` then calls `ApplyConfigurationsFromAssembly`.

Example:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
```

This keeps mapping configuration maintainable and avoids a huge `OnModelCreating` method. It also helps keep the domain model cleaner by avoiding excessive persistence attributes.

However, the domain model still needs to be compatible with EF Core materialization and change tracking, so the team must balance persistence requirements with domain design.

##### Key Points to Mention

- Put mappings in Infrastructure/Persistence.
- Use `IEntityTypeConfiguration<T>`.
- Use `ApplyConfigurationsFromAssembly`.
- Keep `DbContext` clean.
- Avoid persistence attributes in domain when possible.
- Domain model must still be EF-compatible.
- Test mappings with integration tests.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q03 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q04 -->
#### Advanced Q04: How do you handle multiple relationships between the same two entity types?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Multiple relationships between the same two entity types should be configured explicitly because EF Core conventions may not know which navigation pairs belong together.

Example:

```csharp
public sealed class User
{
    public int Id { get; set; }

    public List<Document> CreatedDocuments { get; } = new();
    public List<Document> ApprovedDocuments { get; } = new();
}

public sealed class Document
{
    public int Id { get; set; }

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public int? ApprovedByUserId { get; set; }
    public User? ApprovedByUser { get; set; }
}
```

Configuration:

```csharp
modelBuilder.Entity<Document>(builder =>
{
    builder.HasOne(d => d.CreatedByUser)
        .WithMany(u => u.CreatedDocuments)
        .HasForeignKey(d => d.CreatedByUserId)
        .OnDelete(DeleteBehavior.Restrict);

    builder.HasOne(d => d.ApprovedByUser)
        .WithMany(u => u.ApprovedDocuments)
        .HasForeignKey(d => d.ApprovedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
});
```

Explicit configuration avoids ambiguity and prevents accidental cascade paths.

##### Key Points to Mention

- Multiple relationships need explicit pairing.
- Configure each relationship separately.
- Use different FK properties.
- Use different navigation properties.
- Be careful with delete behavior.
- Avoid cascade cycles.
- Review generated migration constraints.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q04 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q05 -->
#### Advanced Q05: How do owned types and aggregate boundaries relate?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Owned types are a good fit when the data is part of an aggregate and has no independent lifecycle outside the owner. For example, `OrderLine` can be owned by `Order` if order lines are only meaningful inside an order. An address can be owned by a customer if it is stored as part of that customer and not shared independently.

Owned types support the idea that the owner controls the lifecycle. Deleting the owner usually deletes the owned data. This matches aggregate composition.

However, do not use owned types for shared reference data or entities that need independent querying, identity, permissions, auditing, or lifecycle. Those should usually be regular entities.

##### Key Points to Mention

- Owned type lifecycle depends on owner.
- Good for aggregate parts.
- Not good for shared independent data.
- Ownership can imply cascade behavior.
- `OwnsOne` for single component.
- `OwnsMany` for owned collection.
- Aggregate boundaries should drive mapping decisions.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q05 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q06 -->
#### Advanced Q06: What are the trade-offs of mapping structured data to JSON columns?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Mapping structured data to JSON columns can simplify the schema when the data is naturally document-shaped and usually loaded with the parent entity. It can reduce joins and make certain value-object models more natural.

However, JSON columns have trade-offs. Relational constraints may be weaker, querying can become provider-specific, indexing requires database-specific design, migrations may be less clear, and reporting can be harder. JSON mapping should not be used simply to avoid proper relational modeling.

It is a good fit for contained data with no independent lifecycle. It is a poor fit for highly relational data that needs constraints, joins, independent updates, and frequent querying.

##### Key Points to Mention

- Good for document-shaped contained data.
- Can reduce joins.
- Provider support matters.
- Querying and indexing can be provider-specific.
- Constraints may be weaker.
- Reporting may be harder.
- Do not use JSON to hide a relational model.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q06 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q07 -->
#### Advanced Q07: How would you configure a domain model with private collections and backing fields?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

A domain model can expose read-only collections and modify them through methods while EF Core maps the private backing field.

Example:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = new();

    public int Id { get; private set; }

    public IReadOnlyCollection<OrderLine> Lines => _lines;

    public void AddLine(string productName, int quantity)
    {
        _lines.Add(new OrderLine(productName, quantity));
    }
}
```

Configuration:

```csharp
modelBuilder.Entity<Order>(builder =>
{
    builder.HasMany(typeof(OrderLine), "_lines")
        .WithOne()
        .HasForeignKey("OrderId");

    builder.Navigation("_lines")
        .UsePropertyAccessMode(PropertyAccessMode.Field);
});
```

This protects domain invariants while still allowing EF Core to materialize and persist the relationship.

##### Key Points to Mention

- Use backing fields for encapsulation.
- Expose read-only collection.
- Use methods to enforce invariants.
- Configure EF to use field access.
- Avoid public setters for important invariants.
- Test materialization and persistence.
- Balance domain purity with EF compatibility.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q07 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q08 -->
#### Advanced Q08: What should you check in generated migrations after changing EF Core mappings?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

After changing EF Core mappings, always review the generated migration to ensure it matches the intended schema change.

Check for unexpected column nullability changes, accidental table or column renames, dropped columns, cascade delete changes, foreign key changes, index changes, unique constraint changes, decimal precision changes, owned type column changes, and table splitting changes.

This is especially important when enabling nullable reference types, changing relationships, introducing owned or complex types, or refactoring navigation names.

##### Key Points to Mention

- Review every migration.
- Watch for dropped columns.
- Watch for nullability changes.
- Watch for cascade delete changes.
- Watch for FK and index changes.
- Watch for owned/complex type column changes.
- Test migration against realistic data.
- Do not blindly apply generated migrations to production.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q08 -->

<!-- question:start:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q09 -->
#### Advanced Q09: How do you decide between exposing foreign key properties and using shadow foreign keys?

<!-- question-id:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Exposing foreign key properties makes relationship state explicit in the entity. This is often useful in CRUD applications, APIs, DTO mapping, debugging, and queries. It allows changing a relationship by setting the FK value without loading the related entity.

Shadow foreign keys keep the domain class cleaner and avoid database details in the object model. However, they make relationship values less visible and require `EF.Property<T>` for some queries.

In most business applications, explicit FK properties are practical and easier to maintain. In domain-focused models, shadow FKs can be used carefully when encapsulation is more important.

##### Key Points to Mention

- Explicit FKs improve clarity.
- Explicit FKs simplify DTO mapping.
- Explicit FKs simplify relationship updates.
- Shadow FKs keep domain model cleaner.
- Shadow FKs can make debugging harder.
- Choose based on application style and maintainability.
- Be consistent within a project.

<!-- question:end:conventions-fluent-api-owned-complex-data-and-relationship-mapping-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
