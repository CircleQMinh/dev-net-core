---
id: web-application-security
topic: Web Application Security
category: Design & Architecture
---

## Overview

Web applications face many security threats. Understanding common attack types and their mitigations is critical for building secure systems.

This guide covers:

- Injection attacks
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Authentication and session attacks
- Insecure Direct Object Reference (IDOR)
- Denial of Service (DoS/DDoS)
- Rate limiting strategies

---

# Injection Attacks

## SQL Injection

SQL Injection occurs when malicious SQL code is injected through user input fields to manipulate database queries.

Example attack vector:

```sql
SELECT * FROM Users WHERE Email = 'user@example.com' OR 1=1
````

### Mitigation

* Always use **parameterized queries**
* Use **ORMs like Entity Framework**
* Never concatenate SQL with user input

Example (EF Core safe query):

```csharp
var user = await context.Users
    .FirstOrDefaultAsync(u => u.Email == email);
```

---

## Command Injection

Command injection occurs when attackers inject OS-level commands through application input.

Example:

```text
userInput = "; rm -rf /"
```

### Mitigation

* Avoid executing shell commands using user input
* Validate and sanitize inputs
* Prefer internal libraries over shell execution

---

#  Cross-Site Scripting (XSS)

XSS occurs when malicious JavaScript is injected into pages viewed by other users.

## Types

* Stored XSS
* Reflected XSS
* DOM-based XSS

### Mitigation

* Encode output
* Use Content Security Policy (CSP)
* Sanitize HTML inputs if HTML content is allowed

---

## Example HTML Sanitization (Ganss.XSS)

```csharp
public class SanitizeModelAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext filterContext)
    {
        foreach (var value in filterContext.ActionArguments.Values)
        {
            if (value is ISanitizable sanitizable)
            {
                var sanitizer = new HtmlSanitizer();
                sanitizable.Sanitize(sanitizer);
            }
        }
    }
}
```

---

```csharp
public interface ISanitizable
{
    void Sanitize(HtmlSanitizer sanitizer);
}
```

---

```csharp
public class CommentModel : ISanitizable
{
    public string Content { get; set; }

    public void Sanitize(HtmlSanitizer sanitizer)
    {
        Content = sanitizer.Sanitize(Content);
    }
}
```

---

### Usage

```csharp
[HttpPost]
[SanitizeModel]
public IActionResult PostComment(CommentModel model)
{
    // model.Content is sanitized
}
```

---

#  Cross-Site Request Forgery (CSRF)

CSRF attacks trick a logged-in user into performing unintended actions.

Example attack:

* Changing account settings
* Submitting financial transactions

### Mitigation

* Use anti-forgery tokens
* Validate Origin and Referer headers

---

### Razor Example

```csharp
@Html.AntiForgeryToken()
```

---

### Controller Validation

```csharp
[ValidateAntiForgeryToken]
public IActionResult UpdateProfile(ProfileModel model)
{
}
```

---

#  Authentication and Session Attacks

## Brute Force / Credential Stuffing

Repeated login attempts using stolen credentials.

### Mitigation

* Account lockout
* Rate limiting
* CAPTCHA
* Two-Factor Authentication (2FA)

---

## Session Hijacking / Session Fixation

Attackers steal or set session IDs to impersonate users.

### Mitigation

* Regenerate session ID after login
* Use secure cookies
* Enable security flags

---

### ASP.NET Core Cookie Security

```csharp
services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
});
```

---

#  Insecure Direct Object Reference (IDOR)

IDOR occurs when users access resources by manipulating identifiers.

Example:

```text
GET /api/orders/123
```

If authorization checks are missing, a user could access another user's order.

---

### Mitigation

* Always validate resource ownership
* Perform authorization checks at the object level

Example:

```csharp
var order = await _context.Orders
    .FirstOrDefaultAsync(o => o.Id == id && o.UserId == currentUserId);

if (order == null)
    return Forbid();
```

---

#  Denial of Service (DoS / DDoS)

DoS attacks attempt to overwhelm systems with traffic to exhaust resources.

### Mitigation

* Rate limiting
* Web Application Firewalls (WAF)
* CDN protection
* Autoscaling infrastructure

---

## Enable Rate Limiting and Throttling

Limit requests per IP or API key at the application or gateway level.

---

## CAPTCHA / Bot Protection

Prevent automated abuse using:

* reCAPTCHA
* Cloudflare Turnstile
* Honeypot fields
* JavaScript challenges

---

# Implementing Rate Limiting

## API Gateway Level (Recommended)

Use gateway-based protection:

* Azure API Management
* AWS API Gateway
* Kong

Benefits:

* Centralized configuration
* Protection across services
* Easy policy enforcement

Example policy:

```text
60 requests/min for free users
600 requests/min for premium users
```

---

## ASP.NET Core Rate Limiting Example

Using **AspNetCoreRateLimit**:

```csharp
services.Configure<IpRateLimitOptions>(options =>
{
    options.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule
        {
            Endpoint = "*",
            Period = "1m",
            Limit = 60
        }
    };
});
```

---

## Custom Rate Limiting Middleware

```csharp
public class RateLimitingMiddleware
{
    public async Task Invoke(HttpContext context)
    {
        var clientKey = context.Connection.RemoteIpAddress.ToString();

        var count = await _cache.GetAsync(clientKey); // e.g., Redis

        if (count > limit)
        {
            context.Response.StatusCode = 429;
            return;
        }

        await _next(context);
    }
}
```

---

# Middleware vs Action Filters for Rate Limiting

## Middleware

* Runs before model binding
* Works globally across endpoints
* Early access to headers, path, IP
* Ideal for cross-cutting concerns
* Lower performance overhead

---

## Action Filters

* Execute after routing
* Limited request pipeline access
* Higher overhead for global policies

---

## Summary

Security best practices include:

* Prevent injection attacks with parameterized queries
* Encode output to prevent XSS
* Use anti-forgery tokens for CSRF protection
* Protect authentication flows with rate limiting and MFA
* Enforce authorization checks to prevent IDOR
* Protect infrastructure against DoS with rate limiting and WAF layers

````

---

## Notes

1. In **ASP.NET Core Razor**, output is automatically HTML-encoded when using `@variable`. Explicit encoding like `@Html.Encode` is rarely needed.
2. CSRF protection in ASP.NET Core primarily relies on **anti-forgery tokens**. Origin/Referer validation is secondary protection.
3. Production cookie security often includes:

```text
SameSite = SameSiteMode.Strict
````

to prevent cross-site cookie usage.

4. Since **.NET 7+, ASP.NET Core includes built-in rate limiting middleware**:

```csharp
app.UseRateLimiter();
```

which is generally preferred over third-party libraries.

5. Large-scale **DDoS protection usually relies on CDN/WAF layers** such as Cloudflare, Azure Front Door, or AWS Shield.

