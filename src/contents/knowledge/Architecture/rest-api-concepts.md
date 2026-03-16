---
id: rest-api-concepts
topic: REST & RESTful APIs
category: Design & Architecture
---

## Overview

REST (Representational State Transfer) is a widely used architectural style for designing web APIs. It emphasizes simple, scalable communication between clients and servers using HTTP and standard web principles.

REST is commonly used in backend systems such as **ASP.NET Core Web APIs**.

---

#  Basic REST Concepts

### What is REST?

REST (**Representational State Transfer**) is an **architectural style** for designing networked applications.

Key ideas:

- Resources are identified by **URLs**
- Uses **HTTP methods** to operate on resources
- Communication is **stateless**
- Data is typically exchanged as **JSON**

Example:

```

GET /api/users/10

```

This request returns the representation of user `10`.

---

### What is a RESTful API?

A **RESTful API** is an API that follows REST principles.

Characteristics:

- Resource-based URLs
- Proper use of HTTP methods
- Stateless communication
- Standard HTTP status codes
- Supports caching when appropriate

---

### What is a resource in REST?

A **resource** is any entity exposed by the API.

Examples:

```

/users
/orders
/products
/invoices

```

A specific resource:

```

/users/10

```

---

#  HTTP Methods

### Common HTTP methods used in REST

| Method | Purpose |
|------|---------|
| GET | Retrieve a resource |
| POST | Create a resource |
| PUT | Replace a resource |
| PATCH | Partially update a resource |
| DELETE | Remove a resource |

Example endpoints:

```

GET /users
POST /users
GET /users/10
PUT /users/10
DELETE /users/10

```

---

### Difference between PUT and PATCH

**PUT**

- Replaces the **entire resource**

Example:

```

PUT /users/10

```

Request body:

```

{
"name": "John",
"email": "[john@test.com](mailto:john@test.com)"
}

```

The entire resource representation is replaced.

---

**PATCH**

- Updates **only specific fields**

Example:

```

PATCH /users/10

```

Request body:

```

{
"email": "[new@email.com](mailto:new@email.com)"
}

```

---

### Difference between POST and PUT

| POST | PUT |
|-----|-----|
| Creates a resource | Updates or replaces a resource |
| Server usually generates the ID | Client may specify the ID |
| Not idempotent | Idempotent |

Example:

```

POST /users

```
```

PUT /users/10

```

---

#  HTTP Status Codes

### Common status codes used in REST APIs

| Code | Meaning |
|-----|--------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

Example response when creating a resource:

```

POST /users

```

Response:

```

201 Created
Location: /users/15

```

---

#  REST Constraints

REST defines **six architectural constraints**:

1. Client–Server
2. Stateless
3. Cacheable
4. Uniform Interface
5. Layered System
6. Code on Demand (optional)

---

### What does stateless mean?

Each request must contain **all information required to process it**.

The server does **not store client session state**.

Example request:

```

Authorization: Bearer JWT_TOKEN

```

Each request carries its own authentication data.

---

#  REST API Design

### Good REST API URL design

Use **nouns**, not verbs.

Bad examples:

```

/getUsers
/createUser
/deleteUser

```

Good examples:

```

GET /users
POST /users
GET /users/{id}
DELETE /users/{id}

```

---

### API Versioning Strategies

Common versioning approaches:

**URL versioning**

```

/api/v1/users
/api/v2/users

```

**Header versioning**

```

Accept: application/vnd.myapi.v1+json

```

**Query parameter versioning**

```

/api/users?version=1

```

Most common in real-world APIs:

```

/api/v1/

```

---

#  Pagination, Filtering, Sorting

### Pagination

Example request:

```

GET /users?page=1&pageSize=20

````

Example response:

```json
{
  "data": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 200
}
````

---

### Filtering

Example:

```
GET /users?role=admin
```

Multiple filters:

```
GET /users?role=admin&status=active
```

---

### Sorting

Example:

```
GET /users?sort=name
GET /users?sort=-createdDate
```

The minus sign often indicates **descending order**.

---

#  Authentication & Security

### How do you secure a REST API?

Common approaches:

* JWT (Bearer Token)
* OAuth2
* API Keys
* Mutual TLS (mTLS)

Typical request header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI...
```

---

### What is CORS?

CORS (**Cross-Origin Resource Sharing**) allows browsers to access APIs from **different origins**.

Example:

Frontend:

```
https://app.com
```

API:

```
https://api.com
```

The API must explicitly allow cross-origin access.

---

#  Advanced REST Topics

### What is HATEOAS?

HATEOAS = **Hypermedia As The Engine Of Application State**

The API response includes links to related actions.

Example:

```json
{
  "id": 10,
  "name": "John",
  "links": [
    { "rel": "self", "href": "/users/10" },
    { "rel": "orders", "href": "/users/10/orders" }
  ]
}
```

In practice, most production APIs **do not fully implement HATEOAS**.

---

### What is idempotency?

An operation is **idempotent** if repeating the same request produces the **same result**.

Example:

```
PUT /users/10
```

Calling it multiple times results in the same resource state.

Idempotent methods:

```
GET
PUT
DELETE
```

Non-idempotent method:

```
POST
```

---

#  Practical .NET Interview Questions

### How do you create a REST API in ASP.NET Core?

Typical project structure:

```
Controllers
Services
Repositories
DTOs
Entities
```

Example controller:

```csharp
[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult Get(int id)
    {
        return Ok();
    }
}
```

---

### Returning proper HTTP responses

Example:

```csharp
return Ok(user);          // 200
return CreatedAtAction(); // 201
return NotFound();        // 404
return BadRequest();      // 400
```

---

### Difference between Web API and REST API

* **Web API** → Any API accessible via HTTP
* **REST API** → API that follows REST principles

All REST APIs are Web APIs, but not all Web APIs are RESTful.

---

#  Common Trick Questions

### Is REST tied to HTTP?

No.

REST is an **architectural style**.

HTTP is simply the **most common implementation protocol**.

---

### Can REST APIs return XML?

Yes.

REST can return many representations:

* JSON
* XML
* HTML
* Binary

JSON is just the most commonly used format.

---

### Is REST always stateless?

Yes.

Statelessness is one of the **core REST constraints**.



---

## Notes

1. REST itself is **protocol-agnostic**, although HTTP is almost always used in practice.
2. `PUT` is technically defined as **replace or create** in HTTP semantics, though most APIs use it primarily for updates.
3. Many modern REST APIs relax strict REST constraints (e.g., HATEOAS) for simplicity and performance.
4. API versioning via URL (`/api/v1/`) is the most widely adopted approach in real-world systems.
```
