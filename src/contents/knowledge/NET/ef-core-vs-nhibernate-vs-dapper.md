---
id: ef-core-vs-nhibernate-vs-dapper
topic: EF Core vs NHibernate vs Dapper in .NET
category: .NET
---

## Overview

This document provides a practical comparison of three popular .NET data access technologies:

- **Entity Framework Core (EF Core)**
- **NHibernate**
- **Dapper**

Each tool has different strengths and is suitable for different architectural and performance requirements.

---

## Philosophy & Abstraction Level

| Technology | Description |
|------------|------------|
| **EF Core** | Full ORM, high abstraction, supports code-first and database-first development. |
| **NHibernate** | Full ORM with advanced mapping and strong domain-driven design (DDD) capabilities. |
| **Dapper** | Micro ORM with minimal abstraction; focuses on raw SQL for speed and control. |

---

## Performance

| Technology | Performance Characteristics |
|------------|----------------------------|
| **EF Core** | Good performance; slightly slower than Dapper in raw query scenarios. |
| **NHibernate** | Good performance; supports batching and lazy loading. |
| **Dapper** | Excellent performance; very close to raw ADO.NET speed. |

---

## Ease of Use & Learning Curve

| Technology | Learning Curve |
|------------|----------------|
| **EF Core** | Easy to learn; strong LINQ integration and migrations support. |
| **NHibernate** | Steeper learning curve; more complex setup. |
| **Dapper** | Very lightweight; easy to use but requires strong SQL knowledge. |

---

## Feature Set

| Technology | Feature Highlights |
|------------|-------------------|
| **EF Core** | Migrations, change tracking, lazy loading, LINQ support. |
| **NHibernate** | Advanced mapping, powerful caching, mature ORM features. |
| **Dapper** | Minimal ORM features; manual implementation required for tracking or advanced behavior. |

---

## Control & Flexibility

| Technology | Flexibility |
|------------|------------|
| **EF Core** | Moderate flexibility; supports raw SQL via `FromSqlRaw`. |
| **NHibernate** | Highly customizable mappings and query capabilities. |
| **Dapper** | Maximum control; full raw SQL execution. |

---

## Community & Ecosystem

| Technology | Ecosystem |
|------------|-----------|
| **EF Core** | Official Microsoft support; strong tooling and documentation. |
| **NHibernate** | Community-driven; mature but less frequently updated. |
| **Dapper** | Developed by Stack Overflow; widely adopted and well-maintained. |

---

## Best Use Cases

| Technology | Recommended Scenario |
|------------|---------------------|
| **EF Core** | General-purpose applications needing full ORM productivity. |
| **NHibernate** | Enterprise or legacy systems with complex mapping requirements. |
| **Dapper** | Microservices or performance-critical components using raw SQL. |

---

## Interview Cheat Sheet

| Category | EF Core | NHibernate | Dapper |
|----------|----------|------------|--------|
| Type | Full ORM | Full ORM | Micro ORM |
| Abstraction Level | High | High | Low |
| Performance | Good | Good | Fastest |
| Change Tracking | Yes | Yes | No |
| Lazy Loading | Yes | Yes | No |
| Migrations | Built-in | Manual | None |
| Caching | 1st-level | 1st & 2nd-level | None |
| Custom SQL | Supported | Supported | Native |
| Learning Curve | Easy | Steep | Easy |
| Setup | Simple | Verbose | Minimal |
| LINQ Support | Excellent | Supported | Limited |
| Documentation | Rich | Moderate | Moderate |
| Ideal Use Case | General apps | Complex DDD apps | High-performance systems |

---

## Summary Recommendation

- Use **EF Core** for general development with strong support, productivity, and flexibility.
- Use **NHibernate** for complex domain-driven designs requiring powerful mapping and caching.
- Use **Dapper** for lightweight, high-performance, SQL-centric applications.

Choose the right tool for the right scenario. Avoid overengineering or underengineering your data access layer.

---

## Notes

1. “Dapper – Fastest” is generally accurate in raw SQL scenarios, but EF Core performance has improved significantly in recent versions.
2. NHibernate’s caching advantage refers to its mature second-level caching support.
3. EF Core lazy loading requires enabling proxies or explicit configuration.
4. Dapper does not provide change tracking, migrations, or built-in caching.

```
