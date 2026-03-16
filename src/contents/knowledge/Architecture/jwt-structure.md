---
id: jwt-structure
topic: JWT (JSON Web Token) Structure and How It Works
category: Design & Architecture
---

## Overview

A **JWT (JSON Web Token)** is a compact, URL-safe token used to transmit claims between two parties.

Common use cases:

- Authentication
- Authorization
- API security
- Identity propagation between services

A JWT consists of **three parts** separated by dots:

```text
xxxxx.yyyyy.zzzzz
````

Each part is **Base64Url-encoded**.

---

#  The Three Parts of a JWT

| Order | Part      | Purpose                              |
| ----- | --------- | ------------------------------------ |
| 1     | Header    | Metadata about the token             |
| 2     | Payload   | Claims (data about the user/session) |
| 3     | Signature | Ensures integrity and authenticity   |

---

#  Part 1 — Header

The header contains metadata about **how the token is signed**.

Example decoded header:

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Header Fields

| Field | Meaning            |
| ----- | ------------------ |
| alg   | Signing algorithm  |
| typ   | Token type (`JWT`) |

---

## Common Algorithms

Examples:

```text
HS256 → HMAC SHA256 (shared secret)
RS256 → RSA public/private key
ES256 → ECDSA
```

---

#  Part 2 — Payload (Claims)

The payload contains **claims**, which are statements about the user or token.

Example payload:

```json
{
  "sub": "123",
  "name": "Minh",
  "role": "Admin",
  "exp": 1710000000
}
```

Important:

```text
The payload is NOT encrypted.
It is only Base64Url-encoded.
```

Anyone who has the token can decode the payload.

---

# Types of Claims

### Registered Claims (Standard)

| Claim | Meaning           |
| ----- | ----------------- |
| iss   | Issuer            |
| sub   | Subject (user id) |
| aud   | Audience          |
| exp   | Expiration time   |
| nbf   | Not before        |
| iat   | Issued at         |

Example:

```json
{
  "sub": "user123",
  "exp": 1710000000
}
```

---

### Public Claims

Claims defined by the application.

Example:

```json
{
  "role": "Admin",
  "permissions": ["read", "write"]
}
```

---

### Private Claims

Custom claims agreed upon between systems.

Example:

```json
{
  "tenantId": "companyA"
}
```

---

# Part 3 — Signature

The **signature protects the token from tampering**.

It ensures:

```text
The token was not modified
The token was issued by a trusted issuer
```

---

## How the Signature Is Created

Conceptually:

```text
Signature =
HMACSHA256(
  base64Url(header) + "." + base64Url(payload),
  secretKey
)
```

Example:

```text
signature = HMACSHA256(
   encodedHeader + "." + encodedPayload,
   secret
)
```

---

## Why the Signature Matters

If someone changes the payload, for example:

```text
role: User → Admin
```

the signature becomes invalid.

The server will reject the token.

---

#  Example Full JWT

Example token:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.
eyJzdWIiOiIxMjMiLCJuYW1lIjoiTWluaCIsInJvbGUiOiJBZG1pbiJ9
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

Structure:

```text
Header.Payload.Signature
```

---

#  How JWT Authentication Works

Typical flow:

### Step 1 — Login

User sends credentials:

```text
POST /login
username + password
```

---

### Step 2 — Server Generates JWT

Server returns a token:

```json
{
  "token": "xxxxx.yyyyy.zzzzz"
}
```

---

### Step 3 — Client Sends JWT

The client includes the token in requests:

```text
Authorization: Bearer <JWT>
```

Example:

```text
GET /api/orders
Authorization: Bearer eyJhbGciOiJIUzI1Ni...
```

---

### Step 4 — Server Validates Token

The server validates:

```text
Signature
Expiration
Issuer
Audience
```

If valid:

```text
User is authenticated
```

---

#  Why JWT Is Popular

Advantages:

```text
Stateless authentication
No server-side session storage
Works well with microservices
Easy API authentication
```

Because the token itself carries the claims needed for authentication.

---

#  Common JWT Security Rules

Important best practices:

---

## Always validate expiration

Check:

```text
exp
```

Example:

```text
Expired token → reject request
```

---

## Never store secrets in the payload

The payload is readable.

Bad example:

```json
{
  "password": "123456"
}
```

---

## Always use HTTPS

JWTs must be transmitted securely to avoid interception.

---

## Use short expiration times

Example:

```text
Access token → 15 minutes
Refresh token → longer lifetime
```

---

#  JWT vs Session Authentication

| Feature       | Session                | JWT                                        |
| ------------- | ---------------------- | ------------------------------------------ |
| Server state  | Stored on server       | Stateless                                  |
| Scalability   | Harder                 | Easier                                     |
| Microservices | Difficult              | Easier                                     |
| Token storage | Cookie / session store | Client-side token storage or secure cookie |

---

#  JWT in ASP.NET Core

Example configuration:

```csharp
services.AddAuthentication("Bearer")
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true
            };
    });
```

---

# Quick Interview Answer

If asked:

**What are the parts of a JWT?**

Good answer:

```text
A JWT has three parts:
Header, Payload, and Signature.
The header describes the signing algorithm,
the payload contains claims about the user,
and the signature ensures the token has not been modified.
```

---

# Mental Model

Think of JWT like this:

```text
Header → how the token is signed
Payload → user data (claims)
Signature → security verification
```


---

## Notes

1. The JWT payload is **encoded, not encrypted**.
2. Signature verification is what prevents tampering.
3. JWT is commonly used together with:

```text
OAuth2
OpenID Connect
API authentication
````

4. In modern web apps, storing JWTs in **HttpOnly secure cookies** is often safer than storing them in `localStorage`, because it reduces XSS exposure.
