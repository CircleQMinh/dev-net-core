---
id: aspnet-core-integration-testing
topic: ASP.NET Core Integration Testing
category: .NET
---

## Overview

Integration testing in ASP.NET Core verifies that **multiple parts of the application work together correctly**.

Unlike unit tests that isolate a single class, integration tests validate **real interactions between components** such as controllers, services, middleware, and the database.

Typical components tested together:

```text
Controllers
Services
Database
Middleware
Authentication
External integrations
````

Example request flow tested:

```text
HTTP Request → Controller → Service → Repository → Database
```

---

# 1. What Is an Integration Test

An **integration test** ensures that multiple components integrate correctly.

Instead of testing isolated logic, it verifies that the **system wiring works as expected**.

Example integration test scenario:

Testing a real API endpoint:

```text
POST /orders
```

The test verifies:

```text
Controller routing
Validation
Business logic
Database persistence
Response serialization
```

---

# 2. Difference Between Unit Test and Integration Test

| Feature      | Unit Test         | Integration Test    |
| ------------ | ----------------- | ------------------- |
| Scope        | Single class      | Multiple components |
| Dependencies | Mocked            | Real or semi-real   |
| Speed        | Fast              | Slower              |
| Purpose      | Logic correctness | System interaction  |
| Database     | No                | Often yes           |

---

## Interview Summary

```text
Unit tests verify behavior.
Integration tests verify wiring.
```

---

# 3. What is WebApplicationFactory

`WebApplicationFactory<TEntryPoint>` is a testing utility in ASP.NET Core that **boots the entire application pipeline in memory**.

Meaning:

```text
Real dependency injection
Middleware executed
Routing works
Controllers invoked
```

However:

```text
No real web server is required
```

---

## What WebApplicationFactory Provides

```text
HttpClient
TestServer
Application host
```

Example:

```csharp
var client = factory.CreateClient();
```

You can send real HTTP requests:

```csharp
var response = await client.GetAsync("/api/users");
```

---

# 4. What is TestServer

`TestServer` is the **in-memory web server used internally by WebApplicationFactory**.

Characteristics:

```text
No network port
Runs inside the test process
Executes the full ASP.NET Core pipeline
```

Architecture:

```text
HttpClient
     ↓
TestServer
     ↓
ASP.NET Core pipeline
```

---

# 5. Example Integration Test

Example using `WebApplicationFactory`.

```csharp
public class UsersTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public UsersTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetUsers_ReturnsSuccess()
    {
        var response = await _client.GetAsync("/api/users");

        response.EnsureSuccessStatusCode();
    }
}
```

This test executes:

```text
Controller
Dependency Injection container
Middleware
Routing
```

---

# 6. Database Testing in Integration Tests

A common question in interviews.

### Should integration tests use a real database?

Best practice:

```text
Use a real or containerized database
```

Instead of:

```text
EF Core InMemory provider
```

---

# Why EF InMemory Is Problematic

EF InMemory:

```text
Is NOT relational
Ignores constraints
Behaves differently from SQL databases
```

Examples:

```text
Foreign keys ignored
Transactions behave differently
Query translation differences
```

Because of this, tests might **pass locally but fail in production**.

---

# Better Approaches

Use:

```text
SQLite in-memory
Docker database
Testcontainers
```

These approaches behave closer to real databases.

---

# 7. Why Remove DbContext Registration in Tests

Common code in integration tests:

```csharp
var descriptor = services.SingleOrDefault(
    d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
);

if (descriptor != null)
    services.Remove(descriptor);
```

---

## Why This Is Done

The application may already register a real database:

```text
SQL Server
PostgreSQL
```

If not removed:

```text
Tests may hit the real database
```

or cause:

```text
Conflicting DbContext registrations
```

Integration tests must be **isolated from shared state**.

---

# 8. Using SQLite In-Memory for Tests

A common pattern.

Example:

```csharp
services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlite("DataSource=:memory:");
});
```

Benefits:

```text
Relational database behavior
Constraint enforcement
Closer to real SQL database behavior
```

This catches issues that EF InMemory would miss.

---

# Why SQLite Is Better Than EF InMemory

| Feature            | EF InMemory | SQLite InMemory |
| ------------------ | ----------- | --------------- |
| Relational         | ❌           | ✔               |
| Foreign keys       | ❌           | ✔               |
| SQL translation    | ❌           | ✔               |
| Realistic behavior | ❌           | ✔               |

---

# 9. Typical Integration Test Architecture

```text
Test
 ↓
HttpClient
 ↓
TestServer
 ↓
ASP.NET Pipeline
 ↓
Application Layer
 ↓
Infrastructure
 ↓
Test Database
```

---

# 10. Real Production Testing Strategy

Most production systems use a testing pyramid:

```text
Unit tests → fast logic verification
Integration tests → system wiring
End-to-end tests → full system validation
```

Example pyramid:

```text
       E2E
      /   \
Integration
    /       \
  Unit tests
```

---

# Interview Quick Answers

### What is an integration test?

```text
An integration test verifies that multiple components of a system
work together correctly, such as controllers, services, and the database.
```

---

### What is WebApplicationFactory?

```text
WebApplicationFactory boots the ASP.NET Core pipeline in memory
for testing without requiring a real web server.
```

---

### What is TestServer?

```text
TestServer is the in-memory web server used by WebApplicationFactory
to execute the ASP.NET Core request pipeline during tests.
```

---

### Why not use EF InMemory?

```text
Because it does not behave like a relational database and can hide
real-world issues such as constraints and SQL translation problems.
```



---

## Notes

1. Integration tests should focus on **system behavior and integration points**, not internal implementation details.
2. Reliable integration testing usually involves **SQLite in-memory databases or containerized databases (e.g., Testcontainers)** to better simulate production environments.
3. Integration tests run slower than unit tests but provide **much stronger confidence that the application behaves correctly in real scenarios**.
```
