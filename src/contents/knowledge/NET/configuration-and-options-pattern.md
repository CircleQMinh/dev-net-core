---
id: configuration-and-options-pattern
topic: Configuration and Options Pattern in ASP.NET Core
category: .NET
---

Configuration in ASP.NET Core provides a flexible system for loading application settings from multiple sources and binding them to strongly typed objects.


---

# Basic Concepts of Configuration

## What is Configuration in ASP.NET Core?

Configuration is the system responsible for:

- Reading application settings
- Supporting multiple configuration sources
- Making settings available via dependency injection

Common configuration sources:

- `appsettings.json`
- `appsettings.{Environment}.json`
- Environment variables
- Command-line arguments
- Azure Key Vault
- Custom configuration providers

---

## How is Configuration Loaded?

Configuration is typically built automatically by the host in modern ASP.NET Core.  
Manually, it can be built using `ConfigurationBuilder`.

```csharp
public void ConfigureServices(IServiceCollection services)
{
    var configuration = new ConfigurationBuilder()
        .SetBasePath(Directory.GetCurrentDirectory())
        .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
        .AddEnvironmentVariables()
        .Build();

    services.AddSingleton<IConfiguration>(configuration);
}
````

---

## What is IConfiguration?

`IConfiguration`:

* Represents the configuration system
* Provides key-based access to settings

Example:

```csharp
public class MyService
{
    private readonly IConfiguration _configuration;

    public MyService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public void LogSettings()
    {
        var mySetting = _configuration["MySetting"];
    }
}
```

---

# Binding Configuration to a Class

Example `appsettings.json`:

```json
{
  "AppSettings": {
    "MaxItems": 100,
    "AppName": "My App"
  }
}
```

POCO class:

```csharp
public class AppSettings
{
    public int MaxItems { get; set; }
    public string AppName { get; set; }
}
```

Register in `ConfigureServices`:

```csharp
services.Configure<AppSettings>(
    Configuration.GetSection("AppSettings"));
```

---

# The Options Pattern

## What is the Options Pattern?

The Options Pattern:

* Binds configuration to strongly typed classes
* Supports validation
* Supports change tracking
* Improves maintainability

---

## Using IOptions<T>

```csharp
public class MySettings
{
    public string MyKey { get; set; }
}
```

Registration:

```csharp
services.Configure<MySettings>(
    Configuration.GetSection("MySettings"));
```

Usage:

```csharp
public class MyService
{
    private readonly MySettings _settings;

    public MyService(IOptions<MySettings> options)
    {
        _settings = options.Value;
    }

    public void LogSettings()
    {
        Console.WriteLine(_settings.MyKey);
    }
}
```

---

# IOptions vs IOptionsSnapshot vs IOptionsMonitor

| Interface           | Lifetime  | Reload Support    | Typical Use         |
| ------------------- | --------- | ----------------- | ------------------- |
| IOptions<T>         | Singleton | No                | Static config       |
| IOptionsSnapshot<T> | Scoped    | Yes (per request) | Web apps            |
| IOptionsMonitor<T>  | Singleton | Yes (real-time)   | Background services |

---

## IOptionsSnapshot<T>

* Scoped lifetime
* Reloaded per request
* Only works in scoped services (e.g., controllers)

---

## IOptionsMonitor<T>

* Singleton
* Supports change notifications

```csharp
public class MyService
{
    public MyService(IOptionsMonitor<MySettings> monitor)
    {
        monitor.OnChange(settings =>
        {
            // React to changes
        });
    }
}
```

---

# Validating Configuration

Use `IValidateOptions<T>`:

```csharp
public class MySettingsValidator : IValidateOptions<MySettings>
{
    public ValidateOptionsResult Validate(string name, MySettings options)
    {
        if (string.IsNullOrEmpty(options.MyKey))
        {
            return ValidateOptionsResult.Fail("MyKey cannot be empty.");
        }

        return ValidateOptionsResult.Success;
    }
}
```

Register:

```csharp
services.AddSingleton<
    IValidateOptions<MySettings>,
    MySettingsValidator>();
```

---

# Reloading Configuration

Enable reload on change:

```csharp
.AddJsonFile("appsettings.json",
    optional: false,
    reloadOnChange: true);
```

Use `IOptionsMonitor<T>` to respond to updates dynamically.

---

# Secure Configuration Storage

Sensitive data should NOT be stored in plain JSON.

Recommended approaches:

* Environment variables
* Azure Key Vault
* Managed Identity (for Azure-hosted apps)

Example (Azure Key Vault client):

```csharp
var client = new SecretClient(
    new Uri(keyVaultEndpoint),
    new DefaultAzureCredential());
```

---

# Environment-Specific Settings

ASP.NET Core supports:

* `appsettings.json`
* `appsettings.Development.json`
* `appsettings.Production.json`

The correct file is selected based on:

* `ASPNETCORE_ENVIRONMENT`

Example:

```json
{
  "AppSettings": {
    "ConnectionString": "DevelopmentConnectionString"
  }
}
```

---

# Key Interview Points

* Configuration supports multiple providers.
* Order of providers matters (later overrides earlier).
* Options Pattern provides strong typing.
* Use IOptionsMonitor for dynamic reload.
* Store secrets outside source code.
* Environment-specific configs are automatically supported.

---

## Notes

* In modern .NET (6+), configuration is automatically built by the generic host.
* `Startup.cs` is optional; configuration and services are typically registered in `Program.cs`.
* `IOptionsSnapshot<T>` only works in scoped services.
* Environment variables override JSON configuration by default.
* In .NET 6+ minimal hosting, `ConfigurationBuilder` is typically not manually created unless customizing behavior.
* Azure Key Vault integration usually uses `builder.Configuration.AddAzureKeyVault()` rather than manually creating `SecretClient` unless advanced customization is needed.
```
