---
id: session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication
topic: Web application security threat modeling and attack patterns
subtopic: Session hijacking, credential stuffing, brute-force protection, lockout, and multi-factor authentication
category: Design & Architecture
---

## Overview

Authentication security is not limited to checking whether a password is correct. Applications must also protect credentials from automated guessing, recognize passwords reused from other breaches, issue and maintain sessions safely, and require stronger evidence for sensitive actions.

The major threats are related but distinct:

- **Brute force** tries many passwords against one or more accounts.
- **Password spraying** tries a small set of common passwords against many accounts.
- **Credential stuffing** tests username and password pairs stolen from other services.
- **Session hijacking** steals or abuses an already authenticated session.
- **Session fixation** causes a victim to authenticate using a session identifier selected or known by an attacker.
- **MFA fatigue and phishing** target weak or poorly designed second-factor flows.

No single control solves all of them. Password lockout can slow guessing but may enable denial of service. Rate limiting can reduce automation but must work across a distributed deployment. MFA can stop many password-only attacks, but SMS and one-time codes can be phished, and insecure recovery or factor-reset flows can bypass otherwise strong authentication.

This topic matters in interviews because candidates are expected to distinguish attack classes, design layered defenses, explain usability and availability trade-offs, and connect browser sessions, identity providers, ASP.NET Core Identity, monitoring, and incident response into one coherent security model.

## Core Concepts

### Authentication, Sessions, and Assurance

Authentication establishes evidence that a principal controls one or more authenticators. After authentication, the application normally creates a session so the principal does not repeat the full login process on every request.

A useful model is:

```text
credentials or authenticators
    -> authentication ceremony
    -> session or access token
    -> authorization decision
```

Protecting only the login step is insufficient. An attacker who steals a valid session cookie may bypass the password and MFA ceremony entirely until the session expires or is revoked.

### Brute Force, Password Spraying, and Credential Stuffing

**Brute force** searches a password space:

```text
alice@example.com + candidate password 1
alice@example.com + candidate password 2
alice@example.com + candidate password 3
```

**Password spraying** avoids rapid failures on one account:

```text
common password + alice@example.com
common password + bob@example.com
common password + carol@example.com
```

**Credential stuffing** uses credentials exposed elsewhere:

```text
breached-site username/password pair
    -> test against target application
```

Credential stuffing succeeds because users reuse passwords. Strong password hashing protects the application's own database but does not stop attackers from testing already known plaintext credentials at the login endpoint.

### Online and Offline Password Attacks

Online attacks interact with the application and can be slowed by:

- Rate limits.
- Progressive delays.
- Lockouts.
- Bot detection.
- MFA.
- Risk-based challenges.
- Monitoring and blocking.

Offline attacks occur after password verifier data is stolen. The attacker can guess without contacting the application.

Offline resistance depends on:

- A password hashing algorithm designed for password storage.
- A unique random salt for each password.
- A work factor appropriate to current hardware and operational capacity.
- Optional protected peppering with carefully managed secrets.
- Fast breach detection and password reset.

Network throttling does not slow an attacker who has stolen the password hashes.

### Password Storage and Password Policy

Passwords should be stored using a maintained password-hashing implementation such as ASP.NET Core Identity's password hasher. General-purpose hashes such as raw SHA-256 are too fast for password storage.

A practical password policy should:

- Permit long passwords and passphrases.
- Avoid arbitrary composition rules that produce predictable substitutions.
- Block known breached and commonly used passwords.
- Avoid silent truncation.
- Support password managers and paste.
- Change passwords after compromise or risk, rather than forcing frequent calendar-based rotation without evidence.

Password strength does not remove the need for login throttling or MFA.

### Rate Limiting Dimensions

Rate limiting should consider more than source IP.

Useful dimensions include:

- Account or normalized username.
- Source IP and network range.
- Device or session signal.
- Tenant.
- Endpoint and operation.
- Global authentication capacity.
- Combinations such as account plus IP.

IP-only controls are weak because:

- Botnets distribute attempts across many addresses.
- Corporate networks and carrier NAT place many legitimate users behind one address.
- Attackers may rotate cloud or residential proxies.

Account-only controls can let an attacker intentionally lock out a victim. Layer multiple limits and use telemetry to distinguish broad attacks from legitimate mistakes.

### Progressive Delay, Throttling, and Backoff

Progressive delay increases the cost of repeated failures without immediately disabling the account:

```text
first failures -> normal response
continued failures -> short delay
sustained failures -> longer delay or challenge
high risk -> temporary block and alert
```

The delay should be enforced server-side. Avoid holding expensive application threads or database transactions while sleeping. A distributed rate limiter, gateway, identity provider, or queue-aware admission control is usually more scalable.

Responses should not reveal whether a username exists through status codes, text, or large timing differences.

### Account Lockout

Lockout temporarily prevents password authentication after a configured number of failed attempts.

Benefits:

- Slows concentrated online guessing.
- Creates a clear signal for detection.
- Gives users and operators time to respond.

Risks:

- Attackers can deliberately lock out known users.
- Help-desk and recovery workload can increase.
- Permanent or long lockouts can become an availability incident.
- Distributed attempts may stay below per-account thresholds.

Prefer temporary lockout or progressive throttling, combine it with IP and risk signals, notify the affected user, and provide a secure recovery path. Privileged accounts may need stricter controls but also stronger resistance to deliberate denial of service.

### ASP.NET Core Identity Lockout

ASP.NET Core Identity provides lockout behavior that can be configured centrally:

```csharp
builder.Services.Configure<IdentityOptions>(options =>
{
    options.Lockout.AllowedForNewUsers = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
});
```

The sign-in call must enable lockout counting:

```csharp
var result = await signInManager.PasswordSignInAsync(
    request.Email,
    request.Password,
    request.RememberMe,
    lockoutOnFailure: true);
```

Application behavior should:

- Return a generic failure message.
- Log lockout and suspicious patterns without logging passwords.
- Reset failure counters after successful authentication according to framework behavior.
- Avoid relying on one application instance's memory in a scaled deployment.
- Add broader rate limiting because account lockout alone does not address spraying or distributed stuffing.

### Credential Stuffing Defenses

Credential stuffing requires controls beyond password complexity:

- Block breached passwords at enrollment and password change.
- Encourage unique passwords and password managers.
- Require or strongly encourage MFA.
- Detect abnormal login velocity and distributed patterns.
- Compare device, geography, network, and historical behavior.
- Challenge high-risk attempts.
- Notify users of suspicious sign-ins.
- Revoke sessions and reset credentials after confirmed compromise.
- Prevent username enumeration.

CAPTCHA can raise automation cost, but it has accessibility and usability costs and can be outsourced or bypassed. Use it as one adaptive layer rather than the entire defense.

### Username Enumeration

Attackers benefit when login, registration, reset, and recovery flows reveal whether an account exists.

Avoid differences such as:

```text
"Unknown user"
"Incorrect password"
```

Prefer a generic response:

```text
"The credentials are invalid."
```

Password reset can respond:

```text
"If an account matches that address, recovery instructions will be sent."
```

Also consider:

- Response timing.
- HTTP status differences.
- Different redirects.
- Rate-limit behavior.
- Registration validation.
- MFA enrollment and account-recovery messages.

Perfectly equal timing is difficult, but avoid obvious alternate code paths and data-dependent delays.

### Session Identifiers

A session identifier should be:

- Generated with a cryptographically secure random source.
- Long enough to resist guessing.
- Free of meaningful user or permission data.
- Transmitted only over protected channels.
- Stored and logged carefully.
- Rotated when privilege changes.
- Revocable.

Do not build session IDs from usernames, timestamps, counters, or predictable random generators.

### Secure Session Cookies

A browser session cookie commonly uses:

```http
Set-Cookie: __Host-session=opaque-value; Path=/; Secure; HttpOnly; SameSite=Lax
```

Important attributes:

- `Secure` sends the cookie only over HTTPS.
- `HttpOnly` prevents ordinary JavaScript access.
- `SameSite` reduces some cross-site request exposure.
- A narrow `Path` and no unnecessary `Domain` reduce scope.
- The `__Host-` prefix requires secure host-only behavior and `Path=/`.

Cookie flags do not compensate for XSS, CSRF, weak session generation, excessive lifetime, or failure to rotate and revoke sessions.

### Session Fixation

In session fixation, an attacker knows or controls a session identifier before the victim authenticates. If the application preserves the same identifier after login, the attacker may reuse it as an authenticated session.

Regenerate the session identifier:

- After login.
- After MFA completion.
- After privilege elevation.
- After impersonation begins or ends.
- After other authentication-level changes.

Do not accept session identifiers from URLs because they leak through history, logs, referrers, and shared links.

### Session Hijacking

Session hijacking occurs when an attacker obtains or abuses a valid session.

Common causes include:

- XSS reading non-`HttpOnly` tokens or acting within the origin.
- Malware or a compromised browser.
- Unencrypted transport.
- Session identifiers in URLs or logs.
- Leaked tokens in telemetry or support tools.
- Weak randomness.
- Overly broad cookie domain scope.
- Stolen refresh tokens.
- Compromised reverse proxies or infrastructure.

Defenses combine prevention, short exposure windows, detection, and revocation.

### Session Expiration and Revocation

Use multiple lifetime concepts:

- **Idle timeout:** expires a session after inactivity.
- **Absolute timeout:** expires it regardless of activity.
- **Renewal or rotation:** replaces identifiers during a long session.
- **Risk-based reauthentication:** requests fresh evidence when context changes.

Logout should invalidate the server-side session or otherwise make the token unusable, not merely delete a browser cookie. Password changes, MFA reset, account disablement, suspected compromise, and privileged role changes may need to revoke some or all active sessions.

Provide users with a way to review and terminate active sessions when practical.

### Stateful Sessions and Stateless Tokens

Stateful sessions store server-side session records and give the browser an opaque ID. Revocation and device listing are straightforward, but shared storage must scale and remain available.

Self-contained access tokens can be validated without a central lookup, but remain valid until expiration unless the architecture adds:

- Short token lifetimes.
- Refresh-token rotation.
- Token revocation or introspection.
- Security-stamp or version checks.
- Signing-key emergency procedures.

"Stateless" does not mean there is no session lifecycle. Refresh tokens, consent, revocation, and account state still require security design.

### Multi-Factor Authentication

MFA requires authenticators from different categories or independent factors. Common categories include:

- Something known, such as a password or PIN.
- Something possessed, such as a cryptographic security key or authenticator device.
- Something inherent, such as a biometric used to unlock a local authenticator.

Two passwords are not two factors. A password plus a security question is still knowledge-based authentication.

### MFA Method Strength

MFA methods have different resistance to phishing and interception.

**Passkeys and hardware security keys**

- Use public-key cryptography.
- Bind authentication to the legitimate origin.
- Are strongly resistant to conventional phishing.
- Avoid shared secrets at the server.

**Authenticator-app one-time passwords**

- Work offline.
- Are widely supported.
- Can still be phished or captured in real time.

**Push approval**

- Can be convenient.
- Is vulnerable to approval fatigue unless the prompt clearly binds the transaction and context.

**SMS or voice codes**

- Are better than password-only authentication in many scenarios.
- Face SIM-swap, interception, account-recovery, and delivery risks.
- Should not be treated as equivalent to phishing-resistant cryptographic authentication.

Choose factors according to account impact and threat model.

### MFA Enrollment, Reset, and Recovery

The weakest MFA lifecycle step often determines the real assurance.

Protect:

- Initial factor enrollment.
- Adding another factor.
- Replacing a lost device.
- Disabling MFA.
- Generating and using recovery codes.
- Help-desk recovery.
- Changing the recovery email or phone.

Strong controls include:

- Recent primary authentication.
- Confirmation with an existing factor.
- Step-up authentication.
- Delayed or reviewed high-risk changes.
- User notifications.
- Single-use, hashed recovery codes.
- Audit trails.
- Session revocation after suspicious factor changes.

Security questions and easily researched personal information are weak recovery evidence.

### Adaptive and Step-Up Authentication

Risk-based authentication evaluates signals such as:

- New device.
- Unusual geography or impossible travel.
- Anonymous or hostile network.
- Credential-stuffing indicators.
- Sensitive requested action.
- Recent password or MFA change.
- Abnormal user behavior.

Low-risk activity may continue with the existing session. Higher-risk activity can require:

- Fresh password entry.
- A stronger factor.
- A phishing-resistant authenticator.
- Manual review.

Risk signals should not silently become the only factor for high-impact operations, and users need a safe path when legitimate travel or device changes occur.

### Privileged Accounts

Administrator and operator accounts should receive stronger treatment:

- Phishing-resistant MFA.
- Separate privileged identities where appropriate.
- Shorter sessions and reauthentication for critical actions.
- Restricted networks or managed devices.
- Just-in-time privilege elevation.
- Detailed audit logs.
- Alerts for new devices, recovery, and role changes.
- No shared administrator credentials.

A compromised administrator session has a much larger blast radius than a normal user session.

### Monitoring and Incident Response

Useful signals include:

- Failure rates by account, IP, network, tenant, and device.
- Password-spray patterns across many accounts.
- Successful login after many distributed failures.
- New-device and unusual-location events.
- MFA failures, push denials, and repeated prompts.
- Lockout volume.
- Recovery and factor-change events.
- Concurrent sessions with implausible context.
- Refresh-token reuse.

Do not log passwords, one-time codes, session identifiers, recovery codes, or full access tokens. Logs need access controls, retention limits, integrity protection, and alerting.

Response capabilities should include:

- Revoke one or all sessions.
- Disable or challenge an account.
- Reset passwords and factors.
- Block abusive infrastructure.
- Notify affected users.
- Preserve evidence.
- Review related authorization and data-access events.

### Common Mistakes

Common failures include:

- Rate limiting only by IP.
- Permanent lockout after a few failures.
- Revealing account existence through login or recovery.
- Counting failures only in one application instance.
- Treating CAPTCHA as complete bot prevention.
- Using long-lived bearer or refresh tokens without rotation and revocation.
- Failing to rotate session IDs after login or privilege elevation.
- Logging tokens or placing them in URLs.
- Assuming `HttpOnly` prevents all session abuse.
- Calling SMS and passkeys equivalent forms of MFA.
- Allowing MFA reset with weaker evidence than normal login.
- Leaving old sessions active after credential compromise.

### Best-Practice Defense Strategy

A layered authentication design should:

1. Store passwords with a maintained adaptive password hasher.
2. Block breached passwords and support password managers.
3. Apply distributed throttling across account, network, device, and global dimensions.
4. Use temporary lockout or progressive delays without creating an easy denial-of-service primitive.
5. Prevent username enumeration across all identity workflows.
6. Offer and prioritize phishing-resistant MFA.
7. Secure enrollment, reset, recovery, and factor replacement.
8. Issue random, narrowly scoped, secure sessions and rotate them after authentication changes.
9. Use idle and absolute expiration plus reliable revocation.
10. Require step-up authentication for sensitive or anomalous actions.
11. Monitor attack patterns and maintain tested incident-response controls.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between brute force, password spraying, and credential stuffing?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q01 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Brute force tries many candidate passwords, often against a specific account. Password spraying tries a few common passwords across many accounts to avoid per-account thresholds. Credential stuffing tests username and password pairs stolen from other services and exploits password reuse. Defenses overlap, but distributed stuffing and spraying require broader signals than a simple per-account counter.

##### Key Points to Mention

- Credential stuffing starts with previously exposed credentials.
- Spraying distributes failures across accounts.
- Per-IP and per-account limits are both incomplete alone.
- MFA and breached-password screening reduce password-reuse impact.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q01 -->

#### What is session hijacking?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q02 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Session hijacking is the unauthorized use of a valid authenticated session identifier or token. The attacker may obtain it through XSS, malware, insecure transport, logs, URL leakage, weak randomness, or compromised infrastructure. Because authentication has already occurred, the attacker may bypass password and MFA checks until the session expires or is revoked.

##### Key Points to Mention

- Protect the full session lifecycle, not only login.
- Use HTTPS and secure cookie attributes.
- Rotate identifiers after authentication and privilege changes.
- Support expiration, detection, and revocation.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q02 -->

#### Why is account lockout not a complete brute-force defense?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q03 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Lockout slows concentrated guessing, but attackers can distribute attempts, spray many accounts, or deliberately lock out victims. It should be temporary and combined with progressive delay, account and network rate limits, risk signals, MFA, user notification, and monitoring. Recovery must be secure enough that it does not become an easier bypass.

##### Key Points to Mention

- Lockout creates a denial-of-service trade-off.
- Distributed attacks may remain below thresholds.
- Use multiple throttling dimensions.
- Generic responses should avoid username enumeration.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q03 -->

#### What is multi-factor authentication?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q04 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

MFA requires independent evidence from different authenticator categories, such as a password plus possession of a cryptographic authenticator. Two knowledge secrets are not true MFA. Methods differ in strength: passkeys and security keys are phishing-resistant, while one-time codes and push prompts can be captured or socially engineered.

##### Key Points to Mention

- Factor independence matters.
- MFA reduces the impact of password compromise.
- Phishing resistance is a key quality distinction.
- Enrollment and recovery must preserve the same assurance.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you design rate limiting for a public login endpoint?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q01 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use distributed limits across normalized account, source IP or network, device signals, tenant, and global capacity. Apply progressive delays or temporary challenges before hard blocks, and use a shared data store or gateway so all instances observe the same counters. Return generic responses, measure false positives, exempt no privileged path silently, and alert on spraying, stuffing, and successful login after suspicious failures.

##### Key Points to Mention

- IP-only and account-only limits each have bypasses.
- Limits must work across scaled application instances.
- Avoid expensive work before admission checks when possible.
- Preserve accessibility and legitimate recovery paths.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q01 -->

#### How should an ASP.NET Core application protect its authentication cookie?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q02 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Require HTTPS and configure `Secure`, `HttpOnly`, appropriate `SameSite`, and the narrowest practical host, domain, and path scope. Use a cryptographically protected opaque ticket, rotate or renew it according to policy, expire sessions with idle and absolute limits, regenerate authentication state after login or privilege elevation, and revoke sessions after compromise or security-sensitive account changes.

##### Key Points to Mention

- Cookie flags reduce specific risks but are not the entire design.
- Protect data-protection keys used to issue cookies.
- Handle CSRF separately for cookie-authenticated state changes.
- Avoid session values in URLs and logs.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q02 -->

#### How should MFA reset and account recovery be secured?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q03 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Recovery must not be weaker than the assurance it replaces. Require recent authentication and an existing factor when available, use single-use protected recovery codes, apply risk checks and delays for high-impact changes, notify the user through independent channels, audit support-assisted recovery, and revoke affected sessions after suspicious factor changes. Avoid knowledge questions and easily researched personal data.

##### Key Points to Mention

- MFA lifecycle operations are high-risk authentication events.
- Help-desk workflows need explicit verification and auditing.
- Recovery codes should be single-use and stored securely.
- Users need a safe lost-device path without a trivial bypass.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q03 -->

#### What is session fixation and how is it prevented?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q04 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Session fixation occurs when a victim authenticates using a session identifier already known or selected by an attacker. Prevent it by rejecting externally supplied session IDs, never accepting them through URLs, and regenerating the identifier after login, MFA completion, privilege elevation, and impersonation changes. Invalidate the pre-authentication session state appropriately.

##### Key Points to Mention

- Fixation differs from stealing an already authenticated session.
- Identifier rotation separates anonymous and authenticated contexts.
- Privilege changes also require rotation.
- Session IDs must be server-generated and unpredictable.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you defend a large distributed service against credential stuffing?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q01 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Combine breached-password prevention, phishing-resistant MFA, distributed account and network throttling, bot and device signals, risk-based challenges, generic identity responses, and user notifications. Aggregate telemetry across regions to identify low-and-slow patterns, but enforce limits near the edge to protect origin capacity. Use temporary controls that avoid mass lockout, tune against false positives, and maintain rapid session revocation and incident-response procedures for successful account takeover.

##### Key Points to Mention

- Credential stuffing is commonly distributed and uses valid passwords.
- Edge and identity-layer controls serve different purposes.
- Successful suspicious logins are more important than failure volume alone.
- Privacy, accessibility, and support impact must be considered.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q01 -->

#### How do passkeys improve security compared with passwords and one-time codes?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q02 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Passkeys use asymmetric cryptography and bind credentials to the legitimate relying-party origin, so a phishing site cannot request a valid assertion for another origin. The server stores a public key rather than a reusable shared secret, and the user unlocks the authenticator locally. They resist credential stuffing and conventional real-time phishing, though enrollment, device synchronization, account recovery, session theft, and compromised endpoints still require protection.

##### Key Points to Mention

- Origin binding provides phishing resistance.
- The server does not store a password-equivalent private key.
- Passkeys do not repair insecure recovery or active-session handling.
- Deployment needs account-linking and authenticator lifecycle design.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q02 -->

#### How would you design revocation for access tokens, refresh tokens, and browser sessions?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q03 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Use short-lived access tokens and treat refresh tokens as high-value session credentials. Rotate refresh tokens on use, detect reuse, bind them to the client context where appropriate, and store server-side grant or session state that can be revoked. Browser sessions should have idle and absolute expiration plus server-side invalidation or security-version checks. Password reset, MFA reset, account disablement, role changes, and incident response should trigger a defined scope of revocation.

##### Key Points to Mention

- Self-contained tokens remain valid until expiry unless checked against state.
- Refresh-token reuse can signal theft.
- Revocation scope may be one device, one grant, or all sessions.
- Signing-key rotation is not a routine per-user revocation mechanism.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q03 -->

#### How would you balance lockout security, usability, and denial-of-service risk?

<!-- question:start:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q04 -->
<!-- question-id:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use progressive delays and short temporary lockouts rather than permanent disablement, combine account thresholds with network, device, and attack-campaign signals, and require stronger challenges as risk rises. Keep responses generic, notify users without exposing sensitive details, and provide secure recovery. Monitor lockout volume as both an attack and availability signal, tune thresholds by account sensitivity, and prefer phishing-resistant MFA for privileged users instead of relying on aggressive password lockout alone.

##### Key Points to Mention

- One threshold is not appropriate for every risk level.
- Attackers can weaponize predictable lockout rules.
- Distributed telemetry helps distinguish mistakes from campaigns.
- Measure false positives, support cost, and recovery abuse.

<!-- question:end:session-hijacking-credential-stuffing-brute-force-protection-lockout-and-multi-factor-authentication-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
