---
id: browser-storage-local-session-cookie
topic: Local Storage, Session Storage, and Cookies
category: React
---

## Overview

Modern web applications use several mechanisms to store data in the browser. The three most common are:

- **Local Storage**
- **Session Storage**
- **Cookies**

Understanding their differences is important for **frontend architecture, security, and performance decisions**.

---

#  Local Storage

### Description

Local Storage stores data in the browser for a specific domain.

### Key Characteristics

| Feature | Description |
|------|-------------|
| Scope | Per domain |
| Size Limit | ~5–10 MB (varies by browser) |
| Lifetime | Persists indefinitely until cleared |
| Accessibility | JavaScript only (`window.localStorage`) |
| Automatic Server Access | ❌ Not sent with HTTP requests |
| Typical Use Case | UI preferences, application state |

---

### Example

```javascript
localStorage.setItem("theme", "dark");

const theme = localStorage.getItem("theme");
````

---

#  Session Storage

### Description

Session Storage stores data per **tab/window session**.

Data persists only while the browser tab remains open.

### Key Characteristics

| Feature                 | Description                               |
| ----------------------- | ----------------------------------------- |
| Scope                   | Per domain + per tab                      |
| Size Limit              | ~5–10 MB                                  |
| Lifetime                | Cleared when the tab or window closes     |
| Accessibility           | JavaScript only (`window.sessionStorage`) |
| Automatic Server Access | ❌ Not sent with HTTP requests             |
| Typical Use Case        | Temporary session state                   |

---

### Example

```javascript
sessionStorage.setItem("step", "2");
```

---

### Important Behavior

Each browser tab has its **own session storage instance**.

Example:

* Tab A → sessionStorage["step"] = 2
* Tab B → sessionStorage["step"] = null

They do not share data.

---

#  Cookies

### Description

Cookies store small pieces of data associated with a domain and path.

Unlike storage APIs, cookies are **automatically sent with HTTP requests**.

### Key Characteristics

| Feature                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| Scope                   | Domain + path                                    |
| Size Limit              | ~4 KB per cookie                                 |
| Lifetime                | Configurable via `Expires` or `Max-Age`          |
| Accessibility           | JavaScript (`document.cookie`) unless `HttpOnly` |
| Automatic Server Access | ✅ Sent with every HTTP request                   |
| Typical Use Case        | Authentication, sessions, CSRF protection        |

---

### Example

```javascript
document.cookie = "username=John; path=/; max-age=3600";
```

---

# Security Considerations

| Storage Type    | Safe for Sensitive Data?   | Reason                                        |
| --------------- | -------------------------- | --------------------------------------------- |
| Local Storage   | ❌ No                       | Accessible via JavaScript → vulnerable to XSS |
| Session Storage | ❌ No                       | Same XSS exposure                             |
| Cookies         | ✅ When properly configured | Can be protected with `HttpOnly` and `Secure` |

---

### Secure Cookie Flags

Recommended production cookie configuration:

* `HttpOnly` → prevents JavaScript access
* `Secure` → only transmitted over HTTPS
* `SameSite` → prevents cross-site request forgery

Example server-side cookie:

```text
Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Strict
```

---

# Comparison Table

| Feature                 | Local Storage  | Session Storage         | Cookie                 |
| ----------------------- | -------------- | ----------------------- | ---------------------- |
| Size Limit              | ~5 MB          | ~5 MB                   | ~4 KB                  |
| Expiration              | Manual         | On tab close            | Configurable           |
| Accessible by JS        | ✅ Yes          | ✅ Yes                   | Depends on HttpOnly    |
| Sent with HTTP Requests | ❌ No           | ❌ No                    | ✅ Yes                  |
| Typical Use             | UI preferences | Temporary session state | Authentication/session |

---

# Rule of Thumb

| Requirement                                 | Recommended Storage                  |
| ------------------------------------------- | ------------------------------------ |
| Store authentication/session tokens         | Secure cookies (`HttpOnly + Secure`) |
| Store UI theme or layout settings           | `localStorage`                       |
| Temporary state during a single tab session | `sessionStorage`                     |

---

# Best Practices

* Never store **sensitive tokens in localStorage**
* Use **HttpOnly cookies for authentication**
* Implement **SameSite cookie policies**
* Clear storage when logging out
* Avoid storing large data objects in cookies

---

# Summary

* **Local Storage** → persistent client-side storage
* **Session Storage** → temporary per-tab storage
* **Cookies** → small data automatically sent to the server

Each mechanism serves different purposes and has different security implications.



---

## Notes

1. Cookie size limits vary slightly by browser, but ~4 KB per cookie is the common practical limit.
2. While cookies can be accessed via JavaScript, using the `HttpOnly` flag prevents JS access and improves security.
3. LocalStorage and SessionStorage are vulnerable to XSS attacks because they are fully accessible via JavaScript.
4. Modern authentication best practice is **HttpOnly secure cookies**, not localStorage tokens, for improved security.


```
