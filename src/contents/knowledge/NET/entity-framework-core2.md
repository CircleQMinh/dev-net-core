---
id: entity-framework-core2
topic: Entity Framework Core (EF Core) Part 2
category: .NET
---

Entity Framework Core supports two primary development approaches: **Code-First** and **Database-First**. Each approach is suited for different project scenarios.


---

# General Understanding

## What is the Code-First Approach?

In Code-First:

- You create C# entity classes (POCOs) first.
- EF Core generates the database schema using migrations.
- Best suited for **greenfield (new) applications**.

Workflow:

1. Define entity classes.
2. Configure model (Fluent API / Data Annotations).
3. Create migrations.
4. Update database.

---

## What is the Database-First Approach?

In Database-First:

- You start with an existing database.
- EF tools generate entity classes and DbContext from the database schema.

EF Core uses:

- `Scaffold-DbContext` to reverse engineer models.

Example:

```bash
dotnet ef dbcontext scaffold "Connection_String" \
Microsoft.EntityFrameworkCore.SqlServer -o Models
````

Suitable for:

* Legacy databases
* DBA-managed schemas
* Enterprise environments

---

# Tools Used

## Code-First

* `dotnet ef migrations add`
* `dotnet ef database update`
* Fluent API
* Data Annotations

## Database-First

* EF6 → EDMX Designer
* EF Core → `Scaffold-DbContext`
* Reverse engineering

---

# Can You Switch Between Them?

Switching is not straightforward.

* Designed for different workflows.
* Requires careful syncing of:

  * Schema
  * Entities
  * Migrations

Best practice: choose one approach per DbContext.

---

# Advantages & Disadvantages

## Code-First

### Advantages

* Full control over domain model.
* Migrations tracked in version control.
* Good fit for:

  * DDD
  * TDD
  * Agile workflows.

### Disadvantages

* Requires good EF knowledge.
* Harder with complex legacy databases.

---

## Database-First

### Advantages

* Quick start if DB already exists.
* Suitable for DBA-controlled schemas.
* Good for integration projects.

### Disadvantages

* Generated code can be hard to maintain.
* Regeneration may overwrite custom changes.
* Less control over domain model design.

---

# Technical Deep Dive

## How Migrations Work (Code-First)

Commands:

* `Add-Migration`
* `Update-Database`

EF:

* Compares model snapshot
* Generates migration class
* Tracks history in `__EFMigrationsHistory` table

---

## What is Scaffold-DbContext?

Used in EF Core Database-First to:

* Reverse engineer entities
* Generate DbContext
* Map relationships

Example:

```bash
dotnet ef dbcontext scaffold \
"Connection_String" \
Microsoft.EntityFrameworkCore.SqlServer \
-o Models
```

---

# When to Choose Each Approach

## Choose Code-First When:

* Starting a new project
* Domain-driven design matters
* Schema evolves frequently
* Agile development model

---

## Choose Database-First When:

* Integrating with legacy DB
* Schema owned by DBA
* Strict database governance

---

# Using Code-First with Existing Database

Possible, but:

* Entities must match schema.
* Migrations may need manual control.
* Consider disabling automatic migrations.

---

# Schema Changes Management

| Approach       | How Changes Are Managed       |
| -------------- | ----------------------------- |
| Code-First     | Migrations                    |
| Database-First | Modify DB → Regenerate models |

---

# Version Control Strategy

| Approach       | Version Control                 |
| -------------- | ------------------------------- |
| Code-First     | Migration files stored in repo  |
| Database-First | Often SQL scripts or DB tooling |

---

# Agile Alignment

Code-First aligns better with Agile because:

* Easy refactoring
* Schema tracked in Git
* Code-driven evolution

---

# Common Real-World Challenges

When reverse engineering:

* Naming mismatches
* Complex relationships
* Missing primary keys
* Non-standard constraints

---

# Can You Combine Both?

Not recommended.

Reasons:

* Schema conflicts
* Migration inconsistencies
* Hard-to-maintain synchronization

Best practice:

* Use one approach per data context.

---

# Comparison Summary

| Feature            | Code-First | Database-First       |
| ------------------ | ---------- | -------------------- |
| Starting point     | C# classes | Existing DB          |
| Schema generation  | From code  | From DB              |
| Migrations         | Built-in   | Not primary workflow |
| Agile-friendly     | Yes        | Less flexible        |
| Legacy integration | Harder     | Ideal                |
| Domain control     | High       | Limited              |

---

# Key Interview Takeaways

* Code-First → model drives database.
* Database-First → database drives model.
* Code-First fits DDD and Agile.
* Database-First fits legacy systems.
* Avoid mixing approaches in same context.
* Scaffold-DbContext is EF Core reverse engineering tool.

---

## Notes

* In EF Core, Model-First is not officially supported like EF6.
* Regenerating models in Database-First can overwrite custom code unless partial classes are used.
* Code-First with existing database requires careful migration baseline management.
* EF Core does not support the classic EDMX designer like EF6.
* Database-First in EF Core relies entirely on scaffolding (no visual designer).
* Model-First is effectively obsolete in EF Core.
```

