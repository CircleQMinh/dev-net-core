---
id: configuration-sources-and-the-options-pattern
topic: Dependency injection, configuration, middleware, and logging
subtopic: Configuration Sources and the Options Pattern
category: .NET
---

## Overview

Configuration in .NET is the system used to load application settings from multiple sources, combine them into a single key-value configuration model, and make those settings available to the application. Common configuration sources include `appsettings.json`, environment-specific JSON files, environment variables, command-line arguments, user secrets, Azure Key Vault, Azure App Configuration, and custom providers.

The options pattern is the recommended way to read groups of related configuration values as strongly typed C# objects. Instead of repeatedly reading raw strings from `IConfiguration`, an application defines option classes such as `JwtOptions`, `StorageOptions`, or `EmailOptions`, binds configuration sections to those classes, validates them, and injects them using `IOptions<T>`, `IOptionsSnapshot<T>`, or `IOptionsMonitor<T>`.

This topic matters because almost every production .NET application needs configuration for connection strings, feature flags, API endpoints, security settings, retry policies, authentication, logging, and external service integration. Configuration mistakes can cause production outages, security leaks, hard-to-debug environment differences, or runtime failures.

For interviews, this topic is important because it tests whether a developer understands how real .NET applications are configured across development, staging, and production. A strong candidate should know provider ordering, environment-based overrides, secrets handling, strongly typed options, validation, reload behavior, and the difference between `IOptions<T>`, `IOptionsSnapshot<T>`, and `IOptionsMonitor<T>`.

## Core Concepts

### Configuration in .NET

Configuration is represented as a set of key-value pairs. Keys can be hierarchical, usually separated with `:` in code and JSON paths.

Example `appsettings.json`:

```json
{
  "ExternalApi": {
    "BaseUrl": "https://api.example.com",
    "TimeoutSeconds": 30,
    "RetryCount": 3
  }
}
```

The configuration values can be read directly with `IConfiguration`:

```csharp
var baseUrl = builder.Configuration["ExternalApi:BaseUrl"];
var timeoutSeconds = builder.Configuration.GetValue<int>("ExternalApi:TimeoutSeconds");
```

Direct reads are useful for simple startup decisions, but they become harder to maintain when settings grow. For grouped settings, the options pattern is usually better.

### Common Configuration Sources

A configuration source is where configuration data comes from. A configuration provider is the component that reads from that source.

Common providers include:

| Source | Typical Usage |
|---|---|
| `appsettings.json` | Default application settings |
| `appsettings.{Environment}.json` | Environment-specific overrides such as Development, Staging, Production |
| User Secrets | Local development secrets that should not be committed to source control |
| Environment variables | Deployment-specific overrides in containers, cloud apps, pipelines, and servers |
| Command-line arguments | Runtime overrides when starting the app |
| Azure Key Vault | Production secrets such as passwords, API keys, certificates |
| Azure App Configuration | Centralized configuration and feature flags |
| In-memory provider | Testing or programmatic configuration |
| Custom provider | Specialized sources such as databases or internal config services |

A typical ASP.NET Core application loads configuration automatically through `WebApplication.CreateBuilder(args)`.

```csharp
var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
```

### Provider Order and Override Behavior

Configuration providers are ordered. When multiple providers contain the same key, the later provider usually overrides the earlier value.

A common default order is:

1. `appsettings.json`
2. `appsettings.{Environment}.json`
3. User secrets in development
4. Environment variables
5. Command-line arguments

This means an environment variable can override a value from `appsettings.json`, and a command-line argument can override both.

Example:

```json
// appsettings.json
{
  "Payment": {
    "Provider": "Sandbox"
  }
}
```

Environment variable:

```bash
Payment__Provider=Stripe
```

Result in code:

```csharp
var provider = builder.Configuration["Payment:Provider"];
// Stripe
```

In environment variables, `__` is commonly used instead of `:` because `:` is not supported consistently across operating systems and shells.

### Environments

.NET applications commonly use environments such as `Development`, `Staging`, and `Production`.

Environment-specific files allow the same application to use different settings per environment:

```text
appsettings.json
appsettings.Development.json
appsettings.Staging.json
appsettings.Production.json
```

Example:

```json
// appsettings.Development.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug"
    }
  }
}
```

```json
// appsettings.Production.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

In interviews, it is important to explain that environment files are for environment-specific non-secret settings. They should not contain production passwords, access keys, or private certificates.

### Secrets Management

Secrets should not be stored in source-controlled configuration files.

Bad example:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=prod;User Id=admin;Password=RealPassword123;"
  }
}
```

Better approaches:

- Use User Secrets for local development.
- Use environment variables in deployment platforms when appropriate.
- Use Azure Key Vault or another secret store for production.
- Use managed identity where possible instead of storing credentials.

User Secrets are useful for local development, but they are not a production secret management solution. In production, a secure external store such as Azure Key Vault is usually preferred.

### Binding Configuration to Strongly Typed Classes

The options pattern starts with a C# class that represents a configuration section.

```csharp
public sealed class ExternalApiOptions
{
    public const string SectionName = "ExternalApi";

    public string BaseUrl { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; }
    public int RetryCount { get; set; }
}
```

Register the options:

```csharp
builder.Services.Configure<ExternalApiOptions>(
    builder.Configuration.GetSection(ExternalApiOptions.SectionName));
```

Inject and use them:

```csharp
using Microsoft.Extensions.Options;

public sealed class ExternalApiClient
{
    private readonly ExternalApiOptions _options;

    public ExternalApiClient(IOptions<ExternalApiOptions> options)
    {
        _options = options.Value;
    }

    public HttpClient CreateClient()
    {
        return new HttpClient
        {
            BaseAddress = new Uri(_options.BaseUrl),
            Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds)
        };
    }
}
```

The main benefit is that the application works with typed properties instead of scattered string keys.

### `Bind`, `Configure`, and `Get<T>`

There are several ways to map configuration to objects.

`Get<T>` creates and returns an instance immediately:

```csharp
var options = builder.Configuration
    .GetSection("ExternalApi")
    .Get<ExternalApiOptions>();
```

`Bind` fills an existing object:

```csharp
var options = new ExternalApiOptions();
builder.Configuration.GetSection("ExternalApi").Bind(options);
```

`Configure<T>` registers binding with the dependency injection container:

```csharp
builder.Services.Configure<ExternalApiOptions>(
    builder.Configuration.GetSection("ExternalApi"));
```

For application services, `Configure<T>` with the options pattern is usually preferred because it integrates with dependency injection, validation, named options, and reload behavior.

### `IOptions<T>`

`IOptions<T>` provides access to a configured options instance through the `Value` property.

```csharp
public sealed class ReportService
{
    private readonly ReportOptions _options;

    public ReportService(IOptions<ReportOptions> options)
    {
        _options = options.Value;
    }
}
```

Use `IOptions<T>` when:

- The configuration is read once and does not need to change while the app is running.
- The service can be singleton, scoped, or transient.
- Named options are not needed.

A common interview point is that `IOptions<T>` is simple and stable, but it does not provide per-request snapshots or change notifications.

### `IOptionsSnapshot<T>`

`IOptionsSnapshot<T>` is scoped and is commonly used in ASP.NET Core request-scoped services. It provides options that are computed once per scope.

```csharp
public sealed class TenantSettingsService
{
    private readonly TenantOptions _options;

    public TenantSettingsService(IOptionsSnapshot<TenantOptions> options)
    {
        _options = options.Value;
    }
}
```

Use `IOptionsSnapshot<T>` when:

- The service is scoped or transient.
- You want updated configuration values per request when the provider supports reload.
- You need named options in scoped services.

Avoid injecting `IOptionsSnapshot<T>` into singleton services because it is scoped. Doing so creates a lifetime mismatch.

### `IOptionsMonitor<T>`

`IOptionsMonitor<T>` is a singleton-friendly options service that supports current values, named options, reloadable configuration, and change notifications.

```csharp
public sealed class CachePolicyService
{
    private CacheOptions _current;

    public CachePolicyService(IOptionsMonitor<CacheOptions> optionsMonitor)
    {
        _current = optionsMonitor.CurrentValue;

        optionsMonitor.OnChange(newOptions =>
        {
            _current = newOptions;
        });
    }
}
```

Use `IOptionsMonitor<T>` when:

- The consuming service is singleton.
- You need to react to configuration changes.
- You need named options in singleton services.
- The configuration provider supports reload.

A common use case is long-running services, background workers, singleton clients, and services that need to respond to runtime configuration changes.

### Comparing `IOptions<T>`, `IOptionsSnapshot<T>`, and `IOptionsMonitor<T>`

| Interface | Lifetime | Reload Support | Named Options | Common Use |
|---|---:|---:|---:|---|
| `IOptions<T>` | Singleton | No practical runtime refresh through `Value` | No | Simple stable configuration |
| `IOptionsSnapshot<T>` | Scoped | Per scope/request when supported | Yes | Request-scoped services |
| `IOptionsMonitor<T>` | Singleton | Yes | Yes | Singleton services and change notifications |

Practical rule:

- Use `IOptions<T>` for simple static settings.
- Use `IOptionsSnapshot<T>` for scoped web request settings that can refresh between requests.
- Use `IOptionsMonitor<T>` for singleton services or runtime change notifications.

### Options Validation

Options validation prevents invalid configuration from reaching business logic.

Example options class:

```csharp
using System.ComponentModel.DataAnnotations;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required]
    public string Issuer { get; set; } = string.Empty;

    [Required]
    public string Audience { get; set; } = string.Empty;

    [Range(1, 1440)]
    public int ExpirationMinutes { get; set; }
}
```

Register with validation:

```csharp
builder.Services
    .AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(options => options.ExpirationMinutes <= 120,
        "JWT expiration should not exceed 120 minutes.")
    .ValidateOnStart();
```

`ValidateOnStart()` is useful because it fails fast during application startup instead of allowing the application to start with invalid settings and fail later during a request.

### Named Options

Named options allow multiple configurations for the same options type.

Example:

```json
{
  "Storage": {
    "Images": {
      "ContainerName": "images"
    },
    "Documents": {
      "ContainerName": "documents"
    }
  }
}
```

Registration:

```csharp
builder.Services.Configure<StorageOptions>("Images",
    builder.Configuration.GetSection("Storage:Images"));

builder.Services.Configure<StorageOptions>("Documents",
    builder.Configuration.GetSection("Storage:Documents"));
```

Usage with `IOptionsSnapshot<T>`:

```csharp
public sealed class FileService
{
    private readonly StorageOptions _imageStorage;
    private readonly StorageOptions _documentStorage;

    public FileService(IOptionsSnapshot<StorageOptions> options)
    {
        _imageStorage = options.Get("Images");
        _documentStorage = options.Get("Documents");
    }
}
```

Named options are useful when one options type represents the same shape of settings for multiple clients, tenants, providers, or storage containers.

### Post-Configuration

Post-configuration runs after normal configuration. It is useful when you need to derive or normalize values.

```csharp
builder.Services.PostConfigure<ExternalApiOptions>(options =>
{
    options.BaseUrl = options.BaseUrl.TrimEnd('/');
});
```

Use post-configuration carefully. It is good for normalization, but complex business logic should usually live in services rather than configuration setup.

### Configuration Reload Behavior

Some configuration providers support reload when the underlying source changes. JSON files can be configured to reload on change, and some external providers also support refresh mechanisms.

Important points:

- Reload behavior depends on the provider.
- `IOptions<T>` is not designed for dynamic updates.
- `IOptionsSnapshot<T>` can see updated values per new scope or request.
- `IOptionsMonitor<T>` can provide current values and change notifications.
- A changed setting does not automatically rebuild every object that already copied the old value.

A common mistake is storing options values in a field during construction and expecting the field to update automatically.

```csharp
public sealed class BadService
{
    private readonly int _timeoutSeconds;

    public BadService(IOptionsMonitor<ApiOptions> options)
    {
        _timeoutSeconds = options.CurrentValue.TimeoutSeconds;
    }
}
```

The service above captures the current value once. To respond to changes, use `CurrentValue` when needed or subscribe to `OnChange`.

### Connection Strings

Connection strings are often stored under the `ConnectionStrings` section.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=AppDb;Trusted_Connection=True;TrustServerCertificate=True"
  }
}
```

Read using:

```csharp
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
```

For production, avoid committing real production connection strings. Use secure deployment configuration, environment variables, managed identity, or a secret store.

### Configuration in ASP.NET Core

In ASP.NET Core, configuration is available through `builder.Configuration` during startup and through `IConfiguration` or options classes in services.

Example registration:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddOptions<EmailOptions>()
    .Bind(builder.Configuration.GetSection(EmailOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddScoped<EmailService>();

var app = builder.Build();
app.Run();
```

Example service:

```csharp
public sealed class EmailService
{
    private readonly EmailOptions _options;

    public EmailService(IOptions<EmailOptions> options)
    {
        _options = options.Value;
    }
}
```

### Configuration in Worker Services and Console Apps

The same configuration and options pattern works outside ASP.NET Core.

```csharp
HostApplicationBuilder builder = Host.CreateApplicationBuilder(args);

builder.Services
    .AddOptions<WorkerOptions>()
    .Bind(builder.Configuration.GetSection("Worker"))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddHostedService<MyWorker>();

using IHost host = builder.Build();
host.Run();
```

This is important because modern .NET uses the same hosting, configuration, logging, and dependency injection model across web apps, workers, and console applications.

### Best Practices

Use strongly typed options for related settings.

```csharp
public sealed class PaymentOptions
{
    public const string SectionName = "Payment";
    public string Provider { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; }
}
```

Validate options at startup for required production settings.

```csharp
builder.Services
    .AddOptions<PaymentOptions>()
    .Bind(builder.Configuration.GetSection(PaymentOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

Keep secrets out of source control.

Use environment-specific files for non-secret environment differences.

Prefer `IOptionsMonitor<T>` for singleton services that need reloadable configuration.

Prefer `IOptionsSnapshot<T>` only in scoped or transient services.

Avoid scattering magic strings across the application. Store section names as constants.

Avoid directly injecting `IConfiguration` into many business services unless the service truly needs dynamic key-based lookup. Typed options are usually clearer and more testable.

### Common Mistakes

A common mistake is storing secrets in `appsettings.json` and committing them to source control.

Another common mistake is injecting `IOptionsSnapshot<T>` into a singleton service. `IOptionsSnapshot<T>` is scoped, so it does not match singleton lifetime.

Another mistake is assuming provider order does not matter. Provider order determines which values win when the same key exists in multiple places.

Another mistake is assuming all providers reload automatically. Reload depends on the provider and configuration setup.

Another mistake is reading configuration directly everywhere:

```csharp
public sealed class OrderService
{
    public OrderService(IConfiguration configuration)
    {
        var timeout = configuration.GetValue<int>("Payment:TimeoutSeconds");
    }
}
```

This works, but it is harder to validate, test, and refactor than a typed options class.

Better:

```csharp
public sealed class OrderService
{
    private readonly PaymentOptions _options;

    public OrderService(IOptions<PaymentOptions> options)
    {
        _options = options.Value;
    }
}
```

### Configuration Sources vs Options Pattern

Configuration sources answer the question: "Where do settings come from?"

The options pattern answers the question: "How does application code consume related settings safely and cleanly?"

They work together:

1. Configuration providers load key-value pairs.
2. Configuration sections group related settings.
3. Options classes model those groups.
4. Binding maps configuration values to C# objects.
5. Validation checks correctness.
6. Services consume options through dependency injection.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:configuration-sources-and-the-options-pattern-beginner-q01 -->
#### Beginner Q01: What is configuration in .NET?
<!-- question-id:configuration-sources-and-the-options-pattern-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Configuration in .NET is the system used to load application settings from one or more sources and expose them as key-value pairs. These settings can come from JSON files, environment variables, command-line arguments, user secrets, Azure Key Vault, Azure App Configuration, in-memory collections, or custom providers.

Configuration is used for values that can vary by environment or deployment, such as connection strings, API endpoints, feature flags, logging levels, authentication settings, and retry policies.

A good answer should mention that configuration should not be confused with application code. Code defines behavior, while configuration supplies environment-specific values used by that behavior.

##### Key Points to Mention

- Configuration is key-value based.
- It can come from multiple providers.
- Later providers can override earlier values.
- It is used for environment-specific settings.
- Secrets should not be committed to source control.

<!-- question:end:configuration-sources-and-the-options-pattern-beginner-q01 -->

<!-- question:start:configuration-sources-and-the-options-pattern-beginner-q02 -->
#### Beginner Q02: What are common configuration sources in ASP.NET Core?
<!-- question-id:configuration-sources-and-the-options-pattern-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Common configuration sources include `appsettings.json`, `appsettings.{Environment}.json`, user secrets, environment variables, command-line arguments, Azure Key Vault, Azure App Configuration, and custom providers.

In a typical ASP.NET Core application, `WebApplication.CreateBuilder(args)` sets up common configuration providers automatically. `appsettings.json` usually provides default settings, environment-specific JSON files override those defaults, user secrets are used for local development secrets, environment variables are common in deployed environments, and command-line arguments can provide final runtime overrides.

##### Key Points to Mention

- JSON files are common for default and environment-specific settings.
- User Secrets are for local development only.
- Environment variables are common in cloud, Docker, and CI/CD.
- Azure Key Vault is commonly used for production secrets.
- Command-line arguments can override earlier sources.

<!-- question:end:configuration-sources-and-the-options-pattern-beginner-q02 -->

<!-- question:start:configuration-sources-and-the-options-pattern-beginner-q03 -->
#### Beginner Q03: What is the options pattern in .NET?
<!-- question-id:configuration-sources-and-the-options-pattern-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The options pattern is a way to bind related configuration values to strongly typed C# classes and inject those classes into services using dependency injection.

Instead of reading values like `configuration["ExternalApi:BaseUrl"]` throughout the codebase, a developer creates an options class such as `ExternalApiOptions`, binds it to the `ExternalApi` configuration section, and injects `IOptions<ExternalApiOptions>` or a related options interface into services.

This improves type safety, testability, validation, readability, and maintainability.

##### Key Points to Mention

- Groups related settings into a class.
- Avoids scattered string-based configuration keys.
- Works with dependency injection.
- Supports validation.
- Supports different access patterns through `IOptions<T>`, `IOptionsSnapshot<T>`, and `IOptionsMonitor<T>`.

<!-- question:end:configuration-sources-and-the-options-pattern-beginner-q03 -->

<!-- question:start:configuration-sources-and-the-options-pattern-beginner-q04 -->
#### Beginner Q04: How do you bind a configuration section to an options class?
<!-- question-id:configuration-sources-and-the-options-pattern-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

First, define an options class that matches the configuration section.

```csharp
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string Sender { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; }
}
```

Then register it in `Program.cs`:

```csharp
builder.Services.Configure<EmailOptions>(
    builder.Configuration.GetSection(EmailOptions.SectionName));
```

Then inject it into a service:

```csharp
public sealed class EmailService
{
    private readonly EmailOptions _options;

    public EmailService(IOptions<EmailOptions> options)
    {
        _options = options.Value;
    }
}
```

##### Key Points to Mention

- The class properties should match configuration keys.
- `Configure<T>` registers the binding with DI.
- `IOptions<T>.Value` provides the configured instance.
- Section name constants reduce magic strings.

<!-- question:end:configuration-sources-and-the-options-pattern-beginner-q04 -->

<!-- question:start:configuration-sources-and-the-options-pattern-beginner-q05 -->
#### Beginner Q05: Why should secrets not be stored in `appsettings.json`?
<!-- question-id:configuration-sources-and-the-options-pattern-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Secrets should not be stored in `appsettings.json` because configuration files are often committed to source control, shared with developers, included in build artifacts, or copied across environments. If a real password, API key, connection string, or certificate secret is committed, it can be leaked and may require rotation.

For local development, .NET User Secrets can be used. For production, secrets should come from secure sources such as Azure Key Vault, deployment platform secret stores, managed identity, or protected environment variables.

##### Key Points to Mention

- Source-controlled files are not safe for secrets.
- Use User Secrets for local development.
- Use Azure Key Vault or secure platform secrets in production.
- Prefer managed identity when possible.
- If a secret is leaked, rotate it.

<!-- question:end:configuration-sources-and-the-options-pattern-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:configuration-sources-and-the-options-pattern-intermediate-q01 -->
#### Intermediate Q01: How does configuration provider ordering work?
<!-- question-id:configuration-sources-and-the-options-pattern-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Configuration providers are applied in order. When more than one provider contains the same key, the value from the later provider usually overrides the earlier value.

For example, if `appsettings.json` contains `Payment:Provider = Sandbox` and an environment variable contains `Payment__Provider = Stripe`, the environment variable value wins if the environment variable provider is registered after the JSON provider.

This is important because deployment systems often override default application settings using environment variables or command-line arguments.

##### Key Points to Mention

- Provider order determines override behavior.
- Later providers generally win for duplicate keys.
- Environment variables commonly override JSON files.
- Command-line arguments are often registered last.
- Understanding order helps debug configuration issues.

<!-- question:end:configuration-sources-and-the-options-pattern-intermediate-q01 -->

<!-- question:start:configuration-sources-and-the-options-pattern-intermediate-q02 -->
#### Intermediate Q02: What is the difference between `IOptions<T>`, `IOptionsSnapshot<T>`, and `IOptionsMonitor<T>`?
<!-- question-id:configuration-sources-and-the-options-pattern-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`IOptions<T>` is the simplest form. It is suitable for stable configuration that does not need to change while the app is running. It is singleton-friendly and exposes values through `.Value`.

`IOptionsSnapshot<T>` is scoped. In ASP.NET Core, it is commonly used to get options once per request. It can see updated configuration values in new scopes when the provider supports reload. It should not be injected into singleton services.

`IOptionsMonitor<T>` is singleton-friendly and supports current values, named options, reloadable configuration, and change notifications through `OnChange`. It is the right choice for singleton services that need updated configuration.

##### Key Points to Mention

- `IOptions<T>`: simple, stable settings.
- `IOptionsSnapshot<T>`: scoped, per-request snapshot.
- `IOptionsMonitor<T>`: singleton-friendly, supports change notifications.
- Do not inject scoped `IOptionsSnapshot<T>` into singleton services.
- Reload support depends on the configuration provider.

<!-- question:end:configuration-sources-and-the-options-pattern-intermediate-q02 -->

<!-- question:start:configuration-sources-and-the-options-pattern-intermediate-q03 -->
#### Intermediate Q03: How do you validate options in .NET?
<!-- question-id:configuration-sources-and-the-options-pattern-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Options can be validated using data annotations, custom validation delegates, or custom validators. A common approach is to use `AddOptions<T>()`, bind a configuration section, call `ValidateDataAnnotations()`, add custom validation with `Validate(...)`, and call `ValidateOnStart()` so invalid configuration fails during startup.

Example:

```csharp
builder.Services
    .AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(options => options.ExpirationMinutes <= 120,
        "JWT expiration should not exceed 120 minutes.")
    .ValidateOnStart();
```

Validation is important because configuration errors should be caught early instead of causing failures deep inside business logic during a real request.

##### Key Points to Mention

- Use `ValidateDataAnnotations()` for attribute-based validation.
- Use `Validate(...)` for custom rules.
- Use `ValidateOnStart()` to fail fast.
- Validation improves production reliability.
- Complex validation can be moved to custom validators.

<!-- question:end:configuration-sources-and-the-options-pattern-intermediate-q03 -->

<!-- question:start:configuration-sources-and-the-options-pattern-intermediate-q04 -->
#### Intermediate Q04: When should you inject `IConfiguration` directly instead of using the options pattern?
<!-- question-id:configuration-sources-and-the-options-pattern-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Injecting `IConfiguration` directly is acceptable for simple startup code, framework setup, dynamic key lookup, or cases where the service genuinely needs to inspect arbitrary configuration sections. However, for business services that depend on known groups of settings, the options pattern is usually better.

The options pattern gives stronger typing, clearer dependencies, easier unit testing, centralized validation, and fewer string-based key mistakes.

A good rule is to use `IConfiguration` at application composition boundaries and use typed options inside application services.

##### Key Points to Mention

- `IConfiguration` is useful during startup and dynamic scenarios.
- Typed options are better for known grouped settings.
- Options improve testability and validation.
- Avoid scattering configuration key strings through business code.
- Prefer explicit dependencies in services.

<!-- question:end:configuration-sources-and-the-options-pattern-intermediate-q04 -->

<!-- question:start:configuration-sources-and-the-options-pattern-intermediate-q05 -->
#### Intermediate Q05: What are named options and when are they useful?
<!-- question-id:configuration-sources-and-the-options-pattern-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Named options allow multiple configured instances of the same options type. Each instance has a name and can be retrieved using that name.

They are useful when the same options shape is needed for multiple clients, providers, tenants, storage containers, external APIs, or authentication schemes.

Example:

```csharp
builder.Services.Configure<StorageOptions>("Images",
    builder.Configuration.GetSection("Storage:Images"));

builder.Services.Configure<StorageOptions>("Documents",
    builder.Configuration.GetSection("Storage:Documents"));
```

Then retrieve them:

```csharp
var imageOptions = options.Get("Images");
var documentOptions = options.Get("Documents");
```

##### Key Points to Mention

- Named options support multiple instances of one options type.
- Useful for repeated configuration shapes.
- Supported by `IOptionsSnapshot<T>` and `IOptionsMonitor<T>`.
- `IOptions<T>` does not support named options in the same way.
- Common for multiple external clients or tenants.

<!-- question:end:configuration-sources-and-the-options-pattern-intermediate-q05 -->

<!-- question:start:configuration-sources-and-the-options-pattern-intermediate-q06 -->
#### Intermediate Q06: How do environment variables represent nested configuration keys?
<!-- question-id:configuration-sources-and-the-options-pattern-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Nested configuration keys are represented with `:` in .NET configuration paths, such as `Payment:Provider`. However, `:` does not work consistently in environment variable names across all platforms. The common cross-platform approach is to use double underscores `__`.

Example:

```bash
Payment__Provider=Stripe
Payment__TimeoutSeconds=30
```

These map to:

```csharp
builder.Configuration["Payment:Provider"]
builder.Configuration["Payment:TimeoutSeconds"]
```

This is especially important in Docker, Kubernetes, Linux hosting, and CI/CD environments.

##### Key Points to Mention

- `:` is the logical hierarchy separator in configuration keys.
- `__` is commonly used in environment variables.
- Environment variables often override JSON settings.
- This is important for cross-platform deployments.
- Common in containers and cloud hosting.

<!-- question:end:configuration-sources-and-the-options-pattern-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:configuration-sources-and-the-options-pattern-advanced-q01 -->
#### Advanced Q01: How does reloadable configuration interact with options?
<!-- question-id:configuration-sources-and-the-options-pattern-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Reloadable configuration depends on the provider. Some providers can detect changes and reload values; others cannot. Even when configuration reloads, different options interfaces observe changes differently.

`IOptions<T>` is not designed for runtime refresh. `IOptionsSnapshot<T>` can see updated values when a new scope is created, such as a new web request. `IOptionsMonitor<T>` can expose current values and notify listeners using `OnChange`.

However, a service must be written correctly to benefit from reload. If a service copies `optionsMonitor.CurrentValue.SomeSetting` into a field once in the constructor, that field will not automatically change. The service should read `CurrentValue` when needed or update internal state inside an `OnChange` callback.

##### Key Points to Mention

- Reload support depends on the provider.
- `IOptionsMonitor<T>` is best for change notifications.
- `IOptionsSnapshot<T>` updates per new scope/request.
- Capturing values once prevents automatic updates.
- Reload does not automatically rebuild all dependent services.

<!-- question:end:configuration-sources-and-the-options-pattern-advanced-q01 -->

<!-- question:start:configuration-sources-and-the-options-pattern-advanced-q02 -->
#### Advanced Q02: How would you design configuration for a production ASP.NET Core app deployed to Azure?
<!-- question-id:configuration-sources-and-the-options-pattern-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

A strong production design separates defaults, environment-specific values, and secrets.

`appsettings.json` should contain safe defaults and non-secret settings. `appsettings.{Environment}.json` can contain non-secret environment-specific settings. Real secrets should come from Azure Key Vault, managed identity, secure app settings, or another secret store. Centralized operational settings and feature flags can be managed through Azure App Configuration.

The app should bind related settings to typed options classes, validate required settings during startup, and fail fast if critical configuration is missing. CI/CD should provide environment-specific values securely. Production should avoid storing sensitive values in source control or build artifacts.

##### Key Points to Mention

- Keep source-controlled JSON free of production secrets.
- Use Key Vault or secure platform secrets for sensitive values.
- Prefer managed identity over stored credentials.
- Use typed options with validation.
- Fail fast on missing critical configuration.
- Consider Azure App Configuration for centralized settings and feature flags.

<!-- question:end:configuration-sources-and-the-options-pattern-advanced-q02 -->

<!-- question:start:configuration-sources-and-the-options-pattern-advanced-q03 -->
#### Advanced Q03: Why can `IOptionsSnapshot<T>` be a problem in singleton services?
<!-- question-id:configuration-sources-and-the-options-pattern-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`IOptionsSnapshot<T>` is registered as a scoped service. Singleton services are created once and live for the lifetime of the application. Injecting a scoped dependency into a singleton creates a lifetime mismatch because the singleton would capture a dependency that is supposed to be tied to a scope.

In ASP.NET Core with scope validation enabled, this can cause an error. Even if not caught immediately, it is a design problem because the singleton would not get a proper per-request snapshot.

For singleton services that need options, use `IOptions<T>` for stable configuration or `IOptionsMonitor<T>` for reloadable configuration and change notifications.

##### Key Points to Mention

- `IOptionsSnapshot<T>` is scoped.
- Singleton services cannot safely depend on scoped services.
- It creates a lifetime mismatch.
- Use `IOptions<T>` or `IOptionsMonitor<T>` in singletons.
- Scope validation helps detect this issue.

<!-- question:end:configuration-sources-and-the-options-pattern-advanced-q03 -->

<!-- question:start:configuration-sources-and-the-options-pattern-advanced-q04 -->
#### Advanced Q04: What is the difference between options validation at runtime and `ValidateOnStart()`?
<!-- question-id:configuration-sources-and-the-options-pattern-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Without `ValidateOnStart()`, options validation usually happens when the options instance is first created or accessed. That might happen during the first request, the first background job execution, or the first time a specific named option is requested.

With `ValidateOnStart()`, validation is performed during application startup. This makes the application fail fast if required settings are missing or invalid.

Fail-fast validation is usually better for critical configuration such as authentication, external service URLs, connection strings, queue names, and security-sensitive settings.

##### Key Points to Mention

- Runtime validation can fail later during real work.
- `ValidateOnStart()` validates during startup.
- Fail-fast behavior improves production reliability.
- Useful for critical required settings.
- Validation may run again when reloadable options change.

<!-- question:end:configuration-sources-and-the-options-pattern-advanced-q04 -->

<!-- question:start:configuration-sources-and-the-options-pattern-advanced-q05 -->
#### Advanced Q05: How would you test services that depend on options?
<!-- question-id:configuration-sources-and-the-options-pattern-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

For services that depend on `IOptions<T>`, tests can use `Options.Create(...)` to provide an options instance.

```csharp
var options = Options.Create(new EmailOptions
{
    Sender = "test@example.com",
    TimeoutSeconds = 10
});

var service = new EmailService(options);
```

For `IOptionsMonitor<T>`, tests can use a simple fake implementation or a mocking library. Another option is to build a small service provider and register options normally.

The main idea is that typed options make tests easier because the test can pass a strongly typed object instead of building a complete configuration tree.

##### Key Points to Mention

- Use `Options.Create` for `IOptions<T>`.
- Use fake or mocked `IOptionsMonitor<T>` when needed.
- Typed options are easier to test than raw `IConfiguration` reads.
- Tests should cover validation for critical options.
- Avoid requiring real configuration files in unit tests.

<!-- question:end:configuration-sources-and-the-options-pattern-advanced-q05 -->

<!-- question:start:configuration-sources-and-the-options-pattern-advanced-q06 -->
#### Advanced Q06: What are common production issues caused by poor configuration design?
<!-- question-id:configuration-sources-and-the-options-pattern-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Poor configuration design can cause missing settings, wrong environment values, leaked secrets, runtime failures, inconsistent behavior between environments, and difficult debugging.

Examples include committing production secrets to source control, assuming `appsettings.Development.json` is used in production, using incorrect environment variable names, misunderstanding provider override order, failing to validate options at startup, and injecting the wrong options interface for the service lifetime.

A good production design uses secure secret storage, clear provider order, environment-specific deployment configuration, typed options, validation, and logging that helps diagnose which configuration provider is active without exposing sensitive values.

##### Key Points to Mention

- Leaked secrets are a major risk.
- Wrong provider order can produce unexpected values.
- Missing validation causes late runtime failures.
- Environment mismatches are common deployment bugs.
- Logging should help diagnostics without printing secrets.
- Options lifetimes must match service lifetimes.

<!-- question:end:configuration-sources-and-the-options-pattern-advanced-q06 -->

<!-- question:start:configuration-sources-and-the-options-pattern-advanced-q07 -->
#### Advanced Q07: How do configuration sources and the options pattern fit into Clean Architecture?
<!-- question-id:configuration-sources-and-the-options-pattern-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

In Clean Architecture, configuration is usually part of the outer application composition layer. The API or host project reads configuration sources and registers typed options with dependency injection. Application services should depend on abstractions and strongly typed settings where appropriate, not on deployment-specific configuration providers.

For example, the API project can bind `BlobStorageOptions` from configuration and register an `IBlobStorageService` implementation in Infrastructure. The Application layer should not know whether the value came from JSON, environment variables, Key Vault, or App Configuration.

This keeps business logic independent from configuration infrastructure while still allowing production settings to be supplied externally.

##### Key Points to Mention

- Configuration loading belongs near the composition root.
- Business logic should not depend on provider details.
- Typed options can be injected into infrastructure services.
- Application layer should avoid direct dependency on deployment configuration.
- The source of configuration should be replaceable without changing business logic.

<!-- question:end:configuration-sources-and-the-options-pattern-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
