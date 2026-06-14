---
id: command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics
topic: Web application security threat modeling and attack patterns
subtopic: Command injection, file upload risks, path traversal, secrets exposure, and DoS/DDoS basics
category: Design & Architecture
---

## Overview

Applications frequently cross dangerous boundaries: they invoke operating-system processes, accept files, construct paths, access credentials, and allocate finite resources in response to untrusted requests. A failure at any of these boundaries can turn ordinary input into code execution, data disclosure, persistent malware storage, or loss of service.

The major risks are:

- **Command injection:** untrusted data changes the meaning of an operating-system command.
- **File upload abuse:** uploaded content is executable, malicious, oversized, misleading, or later served unsafely.
- **Path traversal:** attacker-controlled paths escape an intended directory or select an unauthorized file.
- **Secrets exposure:** credentials, keys, or tokens leak through source code, configuration, logs, build artifacts, or runtime behavior.
- **Denial of Service (DoS):** one source exhausts application or dependency resources.
- **Distributed Denial of Service (DDoS):** many sources coordinate resource exhaustion or traffic flooding.

These problems are related by a common design rule: do not give untrusted input more interpretation, authority, or resource control than the use case requires. Avoid interpreters when a typed library can perform the operation, generate server-side filenames, retrieve secrets through managed identity or a secret store, and place admission controls before expensive work.

This topic matters in interviews because it tests practical secure coding, boundary validation, cloud and .NET architecture, defense in depth, and the ability to distinguish application-layer protections from infrastructure-layer controls.

## Core Concepts

### Data, Instructions, and Interpreters

Injection occurs when data is interpreted as instructions.

Dangerous interpreters include:

- Operating-system shells.
- SQL engines.
- Template engines.
- Expression languages.
- Regular-expression engines in pathological cases.
- Archive extractors and document parsers.
- Image, media, and office-file processors.

The strongest defense is often to remove the interpreter from the path. If the application needs to resize an image, use an image-processing API instead of constructing a shell command around a command-line utility.

### Command Injection

Command injection occurs when untrusted input changes a command's structure or causes an additional command, option, path, or redirection to be interpreted.

Unsafe example:

```csharp
var fileName = request.FileName;

Process.Start(new ProcessStartInfo
{
    FileName = "cmd.exe",
    Arguments = $"/c type uploads\\{fileName}",
    UseShellExecute = false
});
```

Input containing shell metacharacters can change the command. The exact metacharacters differ among Windows command shells, PowerShell, POSIX shells, and the invoked program.

### Avoid the Shell

Prefer a .NET API:

```csharp
var content = await File.ReadAllTextAsync(
    approvedPath,
    cancellationToken);
```

If a child process is genuinely required:

- Invoke a fixed executable directly.
- Set `UseShellExecute` to `false`.
- Pass arguments as separate values.
- Allowlist operations and values.
- Use a low-privilege service account.
- Set timeouts and output limits.
- Use a constrained working directory.
- Avoid inheriting unnecessary environment variables and handles.

```csharp
var startInfo = new ProcessStartInfo
{
    FileName = trustedExecutablePath,
    UseShellExecute = false,
    RedirectStandardOutput = true,
    RedirectStandardError = true
};

startInfo.ArgumentList.Add("--format");
startInfo.ArgumentList.Add(allowedFormat);
startInfo.ArgumentList.Add(serverGeneratedInputPath);
```

Separate arguments reduce shell parsing, but they do not make every value safe. Some programs interpret attacker-controlled arguments as options, paths, scripts, templates, or configuration. Validate according to the invoked program's grammar.

### Allowlisting Command Operations

Avoid accepting free-form command names or options.

Unsafe:

```json
{ "command": "convert --anything the-user-wants" }
```

Safer application contract:

```json
{ "operation": "thumbnail", "size": "small" }
```

Server mapping:

```csharp
var dimensions = request.Size switch
{
    "small" => (Width: 320, Height: 180),
    "medium" => (Width: 640, Height: 360),
    _ => throw new ValidationException("Unsupported size.")
};
```

Map a narrow business operation to trusted implementation details instead of exposing an interpreter interface.

### Command Execution Containment

Assume child processes and parsers may contain vulnerabilities.

Use:

- A dedicated low-privilege identity.
- Read-only filesystems where practical.
- A temporary isolated working directory.
- No access to application secrets.
- Network restrictions.
- CPU, memory, process, and execution-time limits.
- Sandboxed containers or worker services.
- Patch and dependency management.
- Auditing of executable, fixed options, duration, and outcome.

Do not log attacker-controlled command strings in a way that creates log injection or leaks secret arguments.

### File Upload Threats

An uploaded file may be:

- Executable content disguised with another extension.
- Active HTML, SVG, or script content.
- Malware or a malicious document.
- A decompression bomb.
- A parser exploit.
- An oversized file or excessive number of files.
- A filename containing traversal characters.
- A file that overwrites an existing object.
- Public content that exposes sensitive information.
- A polyglot valid under multiple formats.

Validation must consider how the file will be stored, processed, and served.

### Secure Upload Pipeline

A robust upload flow commonly performs:

1. Authenticate and authorize the upload operation.
2. Enforce request and per-file size limits before buffering.
3. Stream to a quarantine location.
4. Generate a server-side storage name.
5. Validate allowed extension and expected media type.
6. Inspect file signatures and parse with a maintained library when feasible.
7. Scan for malware or send the file through content disarm and reconstruction.
8. Process in an isolated worker with resource limits.
9. Store outside the web root or on a separate storage service.
10. Mark the object available only after validation succeeds.
11. Serve through an authorized download endpoint or carefully configured object URL.
12. Retain audit and lifecycle metadata.

No individual check proves that a file is safe.

### Filename Handling

Treat the client filename as display metadata, not a storage path.

```csharp
var storageName = $"{Guid.NewGuid():N}.upload";
var destination = Path.Combine(quarantineRoot, storageName);
```

If the original name is retained for display:

- Extract only the final name component.
- Normalize or replace unsupported characters.
- Limit length.
- Encode it correctly when displayed.
- Set a safe `Content-Disposition` value when downloaded.
- Never concatenate it into a filesystem path.

Names can contain Unicode confusables, control characters, reserved device names, alternate separators, and trailing characters that different filesystems interpret differently.

### Extension, Content Type, and File Signature

Each signal has limitations:

- The extension is attacker-controlled.
- The HTTP `Content-Type` is attacker-controlled.
- Magic-byte or signature checks cover only part of a file.
- A valid file can still contain malicious active content.
- A parser may have vulnerabilities.

Use an allowlist based on a real business requirement. Where possible, parse and rewrite the file into a known-safe representation rather than preserving arbitrary source bytes.

### Active Content and Download Behavior

Even a non-executable upload may become dangerous when served from the application's origin.

Risks include:

- HTML or SVG executing script.
- Browser MIME sniffing.
- Inline rendering of user-controlled content.
- Public object-store permissions.
- Predictable URLs.
- Stored XSS through metadata or filenames.

Defenses include:

- Serve untrusted content from a separate origin.
- Use `Content-Disposition: attachment` when inline rendering is unnecessary.
- Set an explicit safe `Content-Type`.
- Use `X-Content-Type-Options: nosniff`.
- Apply authorization on every private download.
- Avoid public-read storage by default.

### Archive Extraction and Zip Slip

Archives introduce path traversal and resource-exhaustion risks. An archive entry may contain:

```text
../../application/config.json
```

Safe extraction must:

- Limit entry count and total expanded size.
- Reject absolute paths.
- Canonicalize each destination.
- Verify containment within the extraction root.
- Handle symbolic links and reparse points deliberately.
- Avoid overwriting sensitive files.
- Extract in an isolated temporary directory.

Compression ratio and nested archive depth should be constrained to prevent decompression bombs.

### Path Traversal

Path traversal occurs when user input changes a path so it escapes the intended root:

```text
../../secrets.json
..\..\web.config
```

Encodings, mixed separators, absolute paths, Unicode normalization, alternate data streams, symbolic links, and platform-specific names can complicate detection.

The best design does not accept paths from clients. Accept an opaque object ID and resolve it through trusted metadata:

```csharp
var document = await repository.FindAuthorizedAsync(
    request.DocumentId,
    currentUser,
    cancellationToken);
```

### Canonicalization and Containment

If a relative path is necessary:

1. Reject absolute paths.
2. Combine it with a trusted root.
3. Resolve the canonical full path.
4. Verify that the result remains inside the canonical root.
5. Account for case sensitivity and platform behavior.
6. Consider symbolic links and races.

Conceptual .NET example:

```csharp
var root = Path.GetFullPath(configuredRoot)
    .TrimEnd(Path.DirectorySeparatorChar)
    + Path.DirectorySeparatorChar;

var candidate = Path.GetFullPath(Path.Combine(root, requestedRelativePath));

if (!candidate.StartsWith(root, StringComparison.Ordinal))
{
    throw new SecurityException("Path escapes the allowed root.");
}
```

The string comparison must match the target filesystem's case behavior. A prefix check also requires the root to end with a separator so `/allowed-other` is not mistaken for a child of `/allowed`.

For high-risk cases, open files using APIs and operating-system controls that resist symbolic-link and time-of-check/time-of-use races, or isolate files into storage where clients never control filesystem paths.

### Path Traversal Is Also an Authorization Problem

Even a path that remains under the storage root may select another user's file:

```text
/tenant-a/reports/report.pdf
```

The server must check:

- The file belongs to the active tenant.
- The caller may perform the requested action.
- The object is in an allowed state.
- The storage key matches trusted metadata.

Canonicalization prevents directory escape. It does not provide object-level authorization.

### Secrets and Sensitive Configuration

Secrets include:

- Database credentials.
- API keys.
- OAuth client secrets.
- Signing and encryption keys.
- Private certificates.
- Storage access keys.
- Webhook signing secrets.
- Passwords and recovery material.

Secrets should not be committed to source code or copied into container images, frontend bundles, mobile applications, or documentation.

Browser and mobile clients cannot reliably keep a distributed static secret. Anything shipped to the client should be assumed discoverable.

### Secret Storage and Managed Identity

Prefer eliminating secrets through workload identity or managed identity. The application receives a short-lived identity from the platform and requests narrowly scoped access without storing a long-lived credential.

When secrets remain necessary:

- Store them in a dedicated secret manager.
- Restrict access by workload identity and least privilege.
- Encrypt them in transit and at rest.
- Rotate them.
- Version and audit access.
- Separate production from development.
- Avoid exposing them as command-line arguments.
- Keep them out of crash dumps and diagnostic endpoints.

Development secrets tools reduce accidental source commits but are not necessarily production vaults.

### Secret Exposure Paths

Common exposure paths include:

- Git history and pull requests.
- CI/CD variables and build logs.
- Container layers.
- Environment dumps and support bundles.
- Exception messages.
- Application logs and traces.
- Metrics labels.
- Browser source maps and frontend configuration.
- Process listings and shell history.
- Infrastructure state files.
- Chat, tickets, and documentation.

Redaction should happen before data reaches shared telemetry. A secret accidentally committed to Git must be rotated; deleting the current file does not remove copies or history.

### Secret Rotation and Incident Response

Rotation needs a tested process:

1. Create a new credential.
2. Allow the application to accept or use both old and new during transition when supported.
3. Deploy the new credential.
4. Verify usage and health.
5. Revoke the old credential.
6. investigate where it was exposed.

Emergency response should prioritize containment and revocation over repository cleanup. For signing keys, rotation may affect token validation and requires an explicit overlap and trust-removal plan.

### Denial of Service

DoS attacks make a service unavailable by exhausting a constrained resource:

- CPU.
- Memory.
- Threads or event-loop capacity.
- Database connections.
- Outbound sockets.
- Disk space or I/O.
- Queue capacity.
- Third-party quotas.
- Expensive cryptographic operations.
- Human operations such as account recovery.

Application-layer DoS may use valid-looking requests that trigger disproportionate work.

### Distributed Denial of Service

DDoS uses many sources or reflectors, making source blocking and network capacity more difficult.

Broad categories include:

- Volumetric traffic that saturates bandwidth.
- Protocol or connection-state exhaustion.
- Application-layer request floods.
- Dependency exhaustion against databases, caches, identity systems, or third-party APIs.

Application code cannot absorb a large volumetric attack by itself. Edge networks, CDNs, cloud DDoS protection, load balancers, firewalls, and upstream providers are part of the architecture.

### Admission Control and Work Bounding

Reject or defer excess work before expensive operations.

Useful controls include:

- Request body and upload-size limits.
- Header and URL length limits.
- Timeouts and cancellation.
- Rate limits by identity, IP, tenant, and endpoint.
- Concurrency limits.
- Bounded queues.
- Pagination and maximum page sizes.
- Query cost or complexity limits.
- Maximum decompressed size.
- Database statement timeouts.
- Circuit breakers and bulkheads.
- Caching of safe repeated results.
- Backpressure.

Every loop, parser, query, and remote call influenced by input should have a meaningful bound.

### ASP.NET Core Rate Limiting

ASP.NET Core provides rate-limiting middleware:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("uploads", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});

var app = builder.Build();
app.UseRateLimiter();

app.MapPost("/api/uploads", UploadAsync)
    .RequireRateLimiting("uploads");
```

Production design should consider:

- Whether limits are per instance or coordinated.
- Which partition key represents fairness.
- What happens behind proxies.
- Whether authenticated identity should override raw IP.
- How queued requests consume memory and latency budgets.
- Whether edge controls protect the application before traffic reaches it.

### Expensive Queries and Algorithmic Complexity

Valid syntax can still be abusive:

- Unbounded search.
- Deep GraphQL queries.
- Regex patterns with catastrophic backtracking.
- Large JSON nesting.
- Sorting on unindexed fields.
- Exporting entire tenant histories.
- Repeated cache misses.
- High-cost password hashing at unbounded concurrency.

Validate query shape, cap result sizes, precompute where appropriate, use timeouts, and monitor cost per operation rather than only request count.

### Resilience Is Not Abuse Prevention

Retries improve transient-failure handling but can amplify overload. Autoscaling helps legitimate spikes but may increase cost without stopping an attack. Circuit breakers protect dependencies but do not authenticate callers.

Availability design needs:

- Prevention and filtering.
- Bounded resource consumption.
- Graceful degradation.
- Isolation of critical workloads.
- Cost controls.
- Operational detection and response.

### Logging and Detection

Log security-relevant outcomes without recording dangerous content or secrets:

- Rejected command operations.
- Upload validation and scanning results.
- Path traversal attempts.
- Secret-store access failures and anomalous reads.
- Rate-limit decisions.
- Resource saturation and queue depth.
- Dependency timeouts.

Avoid logging:

- Uploaded file contents.
- Raw malicious payloads without containment.
- Full filesystem paths when sensitive.
- Credentials, tokens, or secret values.
- Unbounded attacker-controlled strings.

Alert on patterns and service impact, not every isolated validation failure.

### Common Mistakes

Common failures include:

- Escaping a shell string instead of avoiding the shell.
- Assuming separated process arguments make every argument safe.
- Trusting file extension or MIME type alone.
- Saving uploads under client-provided names.
- Serving untrusted uploads from the primary application origin.
- Extracting archives without path and expansion limits.
- Blocking only literal `../` while ignoring encoding and platform behavior.
- Canonicalizing paths without authorizing the selected file.
- Storing secrets in source code or frontend configuration.
- Removing a leaked secret without rotating it.
- Adding retries during overload.
- Applying only per-instance or per-IP rate limits.
- Buffering huge request bodies before size validation.
- Assuming autoscaling alone is DDoS protection.

### Best-Practice Defense Strategy

For these boundaries:

1. Replace shell and interpreter calls with typed APIs.
2. Expose narrow business operations rather than free-form commands.
3. Isolate unavoidable process and parser execution.
4. Stream uploads through size, type, signature, malware, and authorization checks.
5. Generate storage names and keep uploads outside the web root.
6. Resolve client object IDs through trusted metadata instead of accepting paths.
7. Canonicalize and verify containment when paths are unavoidable.
8. Use managed identity and secret stores with rotation and audit.
9. Put limits before expensive parsing, hashing, querying, and dependency calls.
10. Combine application rate limits with edge and infrastructure DDoS controls.
11. Monitor resource cost, rejection patterns, and operational impact.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is command injection and how is it prevented?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q01 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Command injection occurs when untrusted input changes the structure or meaning of an operating-system command. The strongest defense is to avoid shell execution and use a typed library. If a child process is required, invoke a fixed executable directly, separate arguments, allowlist values, run with low privilege, and enforce time and resource limits.

##### Key Points to Mention

- Data must not become shell syntax.
- Escaping is weaker than removing the shell.
- Program arguments can have their own dangerous grammar.
- Containment reduces impact if validation fails.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q01 -->

#### Why is checking only a file extension unsafe for uploads?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q02 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The client controls the filename and can rename executable or active content with an allowed extension. HTTP content type is also untrusted, and even a file with a valid signature may contain malicious content or exploit a parser. Use an allowlist, size limits, signature and parser validation, scanning, server-generated names, isolated processing, and safe storage and download behavior.

##### Key Points to Mention

- No single file attribute proves safety.
- Validation follows the intended processing and serving context.
- Store uploads outside the web root.
- Authorize both upload and download.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q02 -->

#### What is path traversal?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q03 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Path traversal occurs when attacker-controlled path input escapes an intended directory or selects an unauthorized file, often through parent-directory segments, encodings, absolute paths, or platform-specific behavior. Prefer opaque object IDs instead of paths. When paths are required, canonicalize them, verify containment under a trusted root, handle links carefully, and still perform object authorization.

##### Key Points to Mention

- Blocking the literal string `../` is insufficient.
- Normalize before checking containment.
- Filesystem containment and user authorization are separate checks.
- Client filenames should not become storage paths.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q03 -->

#### What is the difference between DoS and DDoS?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q04 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

DoS is an attempt to make a service unavailable by exhausting a resource or triggering failure, while DDoS distributes the attack across many sources or reflectors. Application-layer controls can bound expensive operations, but large volumetric and protocol attacks also require edge, network, CDN, cloud-provider, and upstream defenses.

##### Key Points to Mention

- Availability depends on many finite resources.
- Valid-looking requests can cause application-layer DoS.
- Distributed sources make simple IP blocking ineffective.
- Layered infrastructure and application controls are required.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you design a secure file-upload service?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q01 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Authenticate and authorize first, enforce request and file-size limits while streaming, save to quarantine under a generated name, validate an explicit type allowlist with multiple signals, scan or reconstruct content, and process it in an isolated worker with CPU, memory, and time limits. Publish only after success, store outside the application origin or web root, and require authorization for private downloads.

##### Key Points to Mention

- Do not buffer unbounded files in memory.
- Client names are display metadata only.
- Archive expansion and parser cost need limits.
- Failed and abandoned uploads need cleanup and audit.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q01 -->

#### How should an application manage secrets in development and production?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q02 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Keep secrets out of source, images, frontend bundles, and shared configuration. Use local development secret tooling for developer machines and a managed secret store or workload identity in production. Grant each workload least privilege, audit access, rotate credentials, redact telemetry before emission, and maintain an emergency revocation procedure. Prefer managed identity so long-lived secrets are eliminated where possible.

##### Key Points to Mention

- Client-side applications cannot protect embedded static secrets.
- Environment variables can still leak through diagnostics and process context.
- Secret stores require access-control and rotation design.
- A committed secret must be rotated, not merely deleted.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q02 -->

#### How do you prevent archive extraction from becoming path traversal or DoS?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q03 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Extract into an isolated temporary directory, reject absolute and escaping entry paths after canonicalization, handle links and reparse points explicitly, and prevent overwrites. Limit compressed size, expanded size, entry count, nesting, compression ratio, CPU, memory, and execution time. Scan or validate extracted content before moving approved files into durable storage.

##### Key Points to Mention

- Zip Slip is traversal through archive entry names.
- Decompression bombs exploit expansion cost.
- Validation must occur for every entry.
- Cleanup must run after failure or timeout.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q03 -->

#### How would you protect an expensive API endpoint from application-layer DoS?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q04 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Authenticate when possible, reject oversized or invalid requests early, rate-limit by appropriate identity and network dimensions, cap concurrency, queue length, query complexity, result size, and execution time, and propagate cancellation to dependencies. Cache safe results, isolate the workload with bulkheads, apply circuit breakers without retry amplification, and monitor cost per request and saturation signals.

##### Key Points to Mention

- Admission control should occur before expensive work.
- Request count is not the same as request cost.
- Bounded queues prevent hidden memory growth.
- Edge protection and dependency limits are also necessary.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### When is direct process execution still risky without a shell?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q01 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The executable itself may interpret options, response files, paths, templates, environment variables, plugins, configuration, or input documents as instructions. An attacker-controlled value beginning with an option prefix may change behavior, and the program or parser may contain vulnerabilities. Use a fixed executable and operation allowlist, insert option terminators where supported, generate trusted paths, constrain the environment, and run the process in an isolated low-privilege worker with resource and network limits.

##### Key Points to Mention

- Removing shell parsing addresses only one interpretation layer.
- Argument injection and malicious input files remain possible.
- Executable search paths and working directories must be trusted.
- Containment and patching are required defense in depth.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q01 -->

#### How would you safely serve private user uploads at scale?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q02 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Store objects under generated keys in private object storage and keep tenant, owner, classification, scan status, and content metadata in trusted records. Authorize each download against that record, then stream through the application or issue a narrowly scoped, short-lived signed URL. Serve active content from a separate origin, set safe response headers, include tenant and authorization dimensions in caches, and revoke or expire capabilities when access changes.

##### Key Points to Mention

- Object keys are not authorization tokens by default.
- Signed URLs intentionally grant capability through possession.
- Cache and CDN configuration must preserve privacy.
- Scan status must fail closed before publication.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q02 -->

#### How should a team respond to a secret committed to a public repository?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q03 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Assume compromise, revoke or rotate the credential immediately, identify its permissions and usage, review provider and application logs for abuse, and contain affected systems. Replace deployments with the new credential, verify recovery, and only then clean repository history where appropriate. Add secret scanning, least privilege, managed identity, logging redaction, and tested rotation to prevent recurrence. Repository cleanup does not invalidate copies already obtained.

##### Key Points to Mention

- Rotation is the primary containment action.
- Scope and blast radius determine the investigation.
- Signing or encryption keys may need specialized migration.
- Preserve evidence while avoiding further secret disclosure.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q03 -->

#### How would you design layered DDoS protection for a cloud application?

<!-- question:start:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q04 -->
<!-- question-id:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use upstream DDoS protection, anycast or cloud edge capacity, CDN caching, WAF and bot controls, load balancers, and origin shielding so hostile traffic is filtered before scarce application resources. At the application layer, authenticate, rate-limit, cap body and query cost, bound concurrency and queues, isolate dependencies, and degrade noncritical features. Monitor saturation and cost, rehearse provider escalation and failover, and protect origin addresses from direct bypass.

##### Key Points to Mention

- Volumetric defense must occur upstream of the constrained link.
- Application-layer attacks require operation-aware limits.
- Autoscaling can amplify cost and dependency failure.
- Runbooks, observability, and provider coordination are part of the design.

<!-- question:end:command-injection-file-upload-risks-path-traversal-secrets-exposure-and-dos-ddos-basics-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
