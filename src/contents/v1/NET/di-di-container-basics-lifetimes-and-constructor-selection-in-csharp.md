---
id: di-di-container-basics-lifetimes-and-constructor-selection-in-csharp
topic: Dependency injection, configuration, middleware, and logging
subtopic: DI, DI Container Basics
category: .NET
---

## Overview

Dependency Injection, usually called DI, is a design technique where an object receives the objects it depends on from the outside instead of creating them directly. In C# and .NET applications, DI is commonly used with the built-in container from `Microsoft.Extensions.DependencyInjection`.

DI matters because it reduces tight coupling, improves testability, centralizes object creation, and makes applications easier to configure and maintain. Instead of a class deciding which concrete implementation to use, the class depends on an abstraction, and the DI container provides the concrete implementation at runtime.

DI is widely used in ASP.NET Core, worker services, background jobs, Clean Architecture, CQRS, MediatR pipelines, repositories, application services, logging, configuration, options, HTTP clients, and Entity Framework Core `DbContext` registration.

For interviews, DI is important because it connects many practical software engineering topics:

- Object-oriented design
- Inversion of Control
- Testability and mocking
- ASP.NET Core request lifetimes
- `DbContext` lifetime management
- Background services
- Thread safety
- Common production bugs such as captive dependencies and service lifetime mismatches
- Constructor injection and how the .NET DI container chooses constructors

A strong interview answer should explain not only how to register services with `AddScoped`, `AddTransient`, and `AddSingleton`, but also why the lifetime choice matters and what can go wrong when services are resolved incorrectly.

## Core Concepts

### Dependency

A dependency is an object that another object needs to do its work.

For example, an order service may depend on a repository, logger, payment gateway, and email sender.

```csharp
public class OrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository orderRepository,
        ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task SubmitAsync(Order order)
    {
        await _orderRepository.SaveAsync(order);
        _logger.LogInformation("Order {OrderId} submitted", order.Id);
    }
}
```

`OrderService` depends on `IOrderRepository` and `ILogger<OrderService>`. It does not create these dependencies directly. They are provided through the constructor.

### Dependency Injection

Dependency Injection is the practice of giving an object its dependencies from the outside.

Without DI, a class often creates concrete dependencies itself:

```csharp
public class OrderService
{
    private readonly SqlOrderRepository _repository = new();

    public void Submit(Order order)
    {
        _repository.Save(order);
    }
}
```

This is tightly coupled because `OrderService` directly depends on `SqlOrderRepository`.

With DI, the class depends on an abstraction:

```csharp
public interface IOrderRepository
{
    Task SaveAsync(Order order);
}

public class SqlOrderRepository : IOrderRepository
{
    public Task SaveAsync(Order order)
    {
        // Save to database
        return Task.CompletedTask;
    }
}

public class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
    }

    public Task SubmitAsync(Order order)
    {
        return _repository.SaveAsync(order);
    }
}
```

This makes the class easier to test and easier to change.

### Inversion of Control

Inversion of Control, or IoC, is a broader design principle where control over object creation is moved away from the class itself.

Without IoC:

```csharp
public class ReportService
{
    private readonly PdfExporter _exporter = new();
}
```

With IoC:

```csharp
public class ReportService
{
    private readonly IReportExporter _exporter;

    public ReportService(IReportExporter exporter)
    {
        _exporter = exporter;
    }
}
```

The object no longer controls the concrete dependency. The application composition root or DI container controls it.

DI is one way to implement IoC.

### DI Container

A DI container is a framework component that knows how to create objects and provide their dependencies.

In .NET, the core concepts are:

- `IServiceCollection`: used to register services
- `ServiceDescriptor`: describes a service type, implementation type, and lifetime
- `IServiceProvider`: used to resolve registered services
- `IServiceScope`: represents a scope for scoped services
- `IServiceScopeFactory`: creates scopes manually when needed

Example:

```csharp
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();

services.AddScoped<IOrderRepository, SqlOrderRepository>();
services.AddScoped<OrderService>();

using ServiceProvider provider = services.BuildServiceProvider();

using IServiceScope scope = provider.CreateScope();

var orderService = scope.ServiceProvider.GetRequiredService<OrderService>();
```

In ASP.NET Core, this setup usually happens in `Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<OrderService>();

var app = builder.Build();

app.Run();
```

### Composition Root

The composition root is the place where the object graph is assembled.

In an ASP.NET Core app, this is usually `Program.cs`:

```csharp
builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default"));
});

builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<IOrderService, OrderService>();
```

A good design keeps registration and wiring close to the application startup instead of scattering object creation throughout the codebase.

### Service Type and Implementation Type

A DI registration usually maps a service type to an implementation type.

```csharp
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
```

Here:

- `IEmailSender` is the service type
- `SmtpEmailSender` is the implementation type
- `Scoped` is the lifetime

A class should normally depend on the abstraction:

```csharp
public class AccountService
{
    private readonly IEmailSender _emailSender;

    public AccountService(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }
}
```

This allows the implementation to be replaced without changing the consumer.

### Constructor Injection

Constructor injection is the most common and recommended form of dependency injection in C#.

```csharp
public class InvoiceService
{
    private readonly IInvoiceRepository _repository;
    private readonly IClock _clock;

    public InvoiceService(IInvoiceRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }
}
```

Benefits:

- Required dependencies are explicit.
- The object cannot be created without its required dependencies.
- Dependencies can be marked `readonly`.
- Classes are easier to unit test.
- Invalid configuration fails early.

Constructor injection is preferred for required dependencies.

### Primary Constructor Injection

Modern C# allows primary constructor syntax for classes.

```csharp
public class InvoiceService(
    IInvoiceRepository repository,
    IClock clock)
{
    public Task CreateAsync()
    {
        var now = clock.UtcNow;
        return repository.CreateAsync(now);
    }
}
```

This can reduce boilerplate, but interview candidates should still understand that DI is injecting dependencies into the constructor.

Use primary constructors carefully in larger classes because overusing constructor parameters can make a class harder to read.

### Property Injection

Property injection means dependencies are assigned through public properties.

```csharp
public class ReportGenerator
{
    public ILogger<ReportGenerator>? Logger { get; set; }
}
```

This is less common in the built-in .NET DI container.

Property injection can be useful for optional dependencies in some frameworks, but for most application services, constructor injection is clearer and safer.

Common problem:

```csharp
public class ReportGenerator
{
    public IReportFormatter? Formatter { get; set; }

    public string Generate()
    {
        return Formatter.Format();
    }
}
```

This can throw a `NullReferenceException` if `Formatter` was not assigned.

For required dependencies, prefer constructor injection.

### Method Injection

Method injection means passing a dependency as a method parameter.

```csharp
public class FileImportService
{
    public Task ImportAsync(Stream file, IFileParser parser)
    {
        return parser.ParseAsync(file);
    }
}
```

This is useful when a dependency is needed only for one operation, or when the dependency varies per call.

Constructor injection is better for dependencies used across the lifetime of the object.

### Service Lifetimes

A lifetime controls how long a service instance lives.

The built-in .NET DI container supports three common lifetimes:

- Transient
- Scoped
- Singleton

Choosing the wrong lifetime can cause bugs, performance issues, memory leaks, stale data, or thread-safety problems.

### Transient Lifetime

A transient service is created every time it is requested.

```csharp
builder.Services.AddTransient<IReportFormatter, PdfReportFormatter>();
```

Use transient for:

- Lightweight stateless services
- Small helpers
- Services that should not be shared
- Short-lived operations

Example:

```csharp
public class PdfReportFormatter : IReportFormatter
{
    public string Format(Report report)
    {
        return $"PDF: {report.Title}";
    }
}
```

Trade-offs:

- Simple and safe for stateless services
- More allocations because a new instance is created each time
- Not ideal for expensive objects that can be reused safely

### Scoped Lifetime

A scoped service is created once per scope.

In ASP.NET Core web applications, a scope is usually created for each HTTP request.

```csharp
builder.Services.AddScoped<IOrderService, OrderService>();
```

Use scoped for:

- Request-specific application services
- Unit-of-work style services
- EF Core `DbContext`
- Services that need consistent state during one request

Example:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default"));
});

builder.Services.AddScoped<IOrderRepository, EfOrderRepository>();
```

Within one HTTP request, every service that depends on `AppDbContext` receives the same scoped instance.

This is useful because multiple repository operations can participate in the same unit of work.

### Singleton Lifetime

A singleton service is created once and reused for the entire application lifetime.

```csharp
builder.Services.AddSingleton<ICacheProvider, MemoryCacheProvider>();
```

Use singleton for:

- Stateless shared services
- Caches
- Configuration readers
- Expensive thread-safe resources
- Services that are safe to share across requests

Example:

```csharp
public class AppClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}

builder.Services.AddSingleton<IClock, AppClock>();
```

Singleton services must be thread-safe because the same instance can be used by many requests at the same time.

Avoid storing request-specific state in a singleton.

Bad example:

```csharp
public class CurrentUserStore
{
    public string? UserId { get; set; }
}

builder.Services.AddSingleton<CurrentUserStore>();
```

This is dangerous because different users could overwrite the same shared instance.

### Lifetime Comparison

| Lifetime | Instance Created | Typical Use | Main Risk |
|---|---:|---|---|
| Transient | Every resolution | Lightweight stateless services | Too many allocations for expensive services |
| Scoped | Once per scope/request | `DbContext`, repositories, request services | Cannot be injected into singleton |
| Singleton | Once per application | Caches, stateless shared services | Thread-safety bugs and captured scoped dependencies |

### Captive Dependency

A captive dependency happens when a long-lived service depends on a shorter-lived service.

The most common example is a singleton depending on a scoped service.

Bad example:

```csharp
builder.Services.AddDbContext<AppDbContext>();
builder.Services.AddSingleton<ReportCache>();
```

```csharp
public class ReportCache
{
    private readonly AppDbContext _dbContext;

    public ReportCache(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }
}
```

`ReportCache` is singleton, but `AppDbContext` is scoped. This can cause the scoped dependency to effectively live like a singleton, which is incorrect.

Problems:

- Stale data
- Shared request state
- Thread-safety issues
- Disposed object errors
- Hard-to-debug production bugs

Better approach:

```csharp
public class ReportCache
{
    private readonly IServiceScopeFactory _scopeFactory;

    public ReportCache(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public async Task RefreshAsync()
    {
        using IServiceScope scope = _scopeFactory.CreateScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Use dbContext inside this scope only
        await dbContext.Reports.ToListAsync();
    }
}
```

This is especially relevant in hosted services and background workers.

### Resolving Scoped Services in Background Services

`BackgroundService` and `IHostedService` are usually singleton services. They should not directly inject scoped services such as `DbContext`.

Bad example:

```csharp
public class Worker : BackgroundService
{
    private readonly AppDbContext _dbContext;

    public Worker(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Incorrect: scoped service captured by singleton worker
        return Task.CompletedTask;
    }
}
```

Better example:

```csharp
public class Worker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public Worker(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using IServiceScope scope = _scopeFactory.CreateScope();

            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            await ProcessAsync(dbContext, stoppingToken);

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private static Task ProcessAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
```

### Scope Validation

Scope validation helps detect lifetime mistakes.

In development, the default .NET service provider can detect common problems such as:

- Resolving scoped services from the root provider
- Injecting scoped services into singleton services

Example problem:

```csharp
var app = builder.Build();

var dbContext = app.Services.GetRequiredService<AppDbContext>();
```

This resolves a scoped service from the root provider, which is usually wrong.

Correct approach:

```csharp
using IServiceScope scope = app.Services.CreateScope();

var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
```

### Registering Services

Common registration methods:

```csharp
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddSingleton<IClock, SystemClock>();
```

You can also register concrete types:

```csharp
builder.Services.AddScoped<OrderService>();
```

This allows `OrderService` to be injected directly.

However, for business services, depending on interfaces is often better when you need test doubles, multiple implementations, or clean boundaries.

### Registering with Factory Functions

A factory registration gives you custom control over object creation.

```csharp
builder.Services.AddSingleton<IFileStorage>(serviceProvider =>
{
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();

    string connectionString = configuration.GetConnectionString("Storage")
        ?? throw new InvalidOperationException("Storage connection string is missing.");

    return new AzureBlobFileStorage(connectionString);
});
```

Use factories when:

- Creation requires configuration
- The constructor needs runtime values
- The implementation depends on environment-specific logic
- You need to validate setup during startup

Avoid doing expensive runtime work inside factories unless it is intentional.

### Registering Existing Instances

You can register an already-created instance.

```csharp
var clock = new SystemClock();

builder.Services.AddSingleton<IClock>(clock);
```

Use this carefully because the container did not create the instance. In many cases, it is cleaner to let the container construct and manage the singleton.

### Multiple Implementations

You can register multiple implementations of the same interface.

```csharp
builder.Services.AddScoped<INotificationSender, EmailNotificationSender>();
builder.Services.AddScoped<INotificationSender, SmsNotificationSender>();
```

Inject all implementations with `IEnumerable<T>`:

```csharp
public class NotificationService
{
    private readonly IEnumerable<INotificationSender> _senders;

    public NotificationService(IEnumerable<INotificationSender> senders)
    {
        _senders = senders;
    }

    public async Task NotifyAsync(string message)
    {
        foreach (var sender in _senders)
        {
            await sender.SendAsync(message);
        }
    }
}
```

If you inject a single `INotificationSender`, the last registration is typically the one resolved.

### Keyed Services

Modern .NET supports keyed services, which allow multiple registrations of the same service type to be selected by a key.

```csharp
builder.Services.AddKeyedScoped<IMessageSender, EmailMessageSender>("email");
builder.Services.AddKeyedScoped<IMessageSender, SmsMessageSender>("sms");
```

Example consumer:

```csharp
public class AlertService(
    [FromKeyedServices("email")] IMessageSender sender)
{
    public Task SendAlertAsync(string message)
    {
        return sender.SendAsync(message);
    }
}
```

Use keyed services when:

- Multiple named implementations are valid
- The selection is part of application configuration
- You want to avoid large `switch` statements or manual service locators

Do not overuse keyed services when a simpler abstraction or strategy pattern would be clearer.

### Open Generic Registrations

Open generic registrations allow one registration to cover many closed generic types.

```csharp
builder.Services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
```

Then the container can resolve:

```csharp
IRepository<Customer>
IRepository<Order>
IRepository<Product>
```

This is common in repository patterns, validation, MediatR pipelines, and generic services.

### Options Pattern and DI

The options pattern is often used with DI to inject configuration.

```csharp
builder.Services.Configure<SmtpOptions>(
    builder.Configuration.GetSection("Smtp"));
```

```csharp
public class SmtpEmailSender
{
    private readonly SmtpOptions _options;

    public SmtpEmailSender(IOptions<SmtpOptions> options)
    {
        _options = options.Value;
    }
}
```

Common options types:

- `IOptions<T>`: basic options, often singleton-friendly
- `IOptionsSnapshot<T>`: scoped, useful in web apps when options may reload per request
- `IOptionsMonitor<T>`: singleton-friendly and supports change notifications

Interviewers often ask about this because configuration, DI, and lifetimes are closely connected.

### Constructor Selection

When the .NET service provider creates a service, it uses constructor injection.

Important rules:

- The constructor must be public.
- If there is one public constructor, that constructor is used.
- If there are multiple public constructors, the container selects the public constructor with the most parameters it can resolve.
- If two constructors are equally valid and neither is clearly better, resolution can fail with an ambiguity error.
- Constructor parameters not supplied by DI must have default values when used in supported activation scenarios.
- `ActivatorUtilities` can create objects not registered in the container by combining provided arguments and services from `IServiceProvider`.

Example:

```csharp
public class ReportService
{
    public ReportService()
    {
    }

    public ReportService(ILogger<ReportService> logger)
    {
    }

    public ReportService(ILogger<ReportService> logger, IReportRepository repository)
    {
    }
}
```

If both `ILogger<ReportService>` and `IReportRepository` are resolvable, the constructor with two parameters is selected.

If only `ILogger<ReportService>` is resolvable, the constructor with one parameter is selected.

### Constructor Ambiguity

Ambiguous constructors are a common interview topic.

Bad example:

```csharp
public class PaymentService
{
    public PaymentService(ILogger<PaymentService> logger)
    {
    }

    public PaymentService(IOptions<PaymentOptions> options)
    {
    }
}
```

If both `ILogger<PaymentService>` and `IOptions<PaymentOptions>` are resolvable, the container cannot clearly decide which constructor should be used.

Better approach:

```csharp
public class PaymentService
{
    private readonly ILogger<PaymentService> _logger;
    private readonly PaymentOptions _options;

    public PaymentService(
        ILogger<PaymentService> logger,
        IOptions<PaymentOptions> options)
    {
        _logger = logger;
        _options = options.Value;
    }
}
```

Best practice:

- Prefer one public constructor for DI-managed services.
- Make all required dependencies explicit.
- Avoid optional dependencies unless they are truly optional.
- Avoid multiple public constructors unless there is a clear reason.

### ActivatorUtilities

`ActivatorUtilities` can create objects that are not registered as services while still resolving constructor dependencies from the container.

Example:

```csharp
public class ExportJob
{
    private readonly ILogger<ExportJob> _logger;
    private readonly string _fileName;

    public ExportJob(ILogger<ExportJob> logger, string fileName)
    {
        _logger = logger;
        _fileName = fileName;
    }
}
```

```csharp
var job = ActivatorUtilities.CreateInstance<ExportJob>(
    serviceProvider,
    "orders.csv");
```

The `ILogger<ExportJob>` comes from DI, and `"orders.csv"` is provided manually.

This is useful when:

- Some constructor values are runtime values
- The type is not registered in DI
- Framework code needs to activate a type dynamically

### ActivatorUtilitiesConstructor Attribute

When using `ActivatorUtilities`, you can mark the constructor that should be used.

```csharp
public class ExportJob
{
    public ExportJob()
    {
    }

    [ActivatorUtilitiesConstructor]
    public ExportJob(ILogger<ExportJob> logger, string fileName)
    {
    }
}
```

This is not a replacement for clean constructor design. For most services, prefer a single public constructor.

### Service Locator Anti-Pattern

The service locator anti-pattern occurs when a class asks the container for dependencies instead of declaring them.

Bad example:

```csharp
public class OrderService
{
    private readonly IServiceProvider _serviceProvider;

    public OrderService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task SubmitAsync(Order order)
    {
        var repository = _serviceProvider.GetRequiredService<IOrderRepository>();

        await repository.SaveAsync(order);
    }
}
```

Problems:

- Dependencies are hidden.
- The class is harder to test.
- Runtime errors replace compile-time clarity.
- The class is coupled to the DI container.

Better example:

```csharp
public class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
    }

    public Task SubmitAsync(Order order)
    {
        return _repository.SaveAsync(order);
    }
}
```

Inject `IServiceProvider` only when you truly need dynamic resolution, and prefer `IServiceScopeFactory` for scope creation scenarios.

### Manual Disposal of DI Services

Services created by the DI container should generally be disposed by the container.

Bad example:

```csharp
public class OrderService
{
    private readonly AppDbContext _dbContext;

    public OrderService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
```

This is wrong because the container owns the lifetime of `AppDbContext`.

Correct idea:

- Register disposable services with the correct lifetime.
- Let the container dispose them at the end of the scope or application lifetime.
- Use `using` only for objects you create manually.

### Building ServiceProvider Manually

Avoid calling `BuildServiceProvider()` inside application service registration.

Bad example:

```csharp
builder.Services.AddScoped<IOrderService, OrderService>();

var provider = builder.Services.BuildServiceProvider();
var logger = provider.GetRequiredService<ILogger<Program>>();
```

Problems:

- Creates a second container.
- Can produce duplicate singleton instances.
- Can break disposal behavior.
- Can hide lifetime issues.

Better approach:

```csharp
builder.Services.AddScoped<IOrderService, OrderService>();

var app = builder.Build();

var logger = app.Services.GetRequiredService<ILogger<Program>>();
```

For scoped services after building the app, create a scope.

### DI and Unit Testing

DI makes testing easier because dependencies can be replaced with test doubles.

```csharp
public class FakeOrderRepository : IOrderRepository
{
    public List<Order> SavedOrders { get; } = [];

    public Task SaveAsync(Order order)
    {
        SavedOrders.Add(order);
        return Task.CompletedTask;
    }
}
```

```csharp
var repository = new FakeOrderRepository();
var logger = NullLogger<OrderService>.Instance;

var service = new OrderService(repository, logger);

await service.SubmitAsync(new Order { Id = 1 });

Assert.Single(repository.SavedOrders);
```

The test does not need a real database.

### DI and Clean Architecture

In Clean Architecture, DI helps enforce direction of dependencies.

Typical setup:

- Domain layer has no DI container dependency.
- Application layer defines interfaces.
- Infrastructure layer implements interfaces.
- API layer wires implementations into the container.

Example:

```csharp
// Application layer
public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id);
}
```

```csharp
// Infrastructure layer
public class EfProductRepository : IProductRepository
{
    private readonly AppDbContext _dbContext;

    public EfProductRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Product?> GetByIdAsync(Guid id)
    {
        return _dbContext.Products.FindAsync(id).AsTask();
    }
}
```

```csharp
// API layer
builder.Services.AddScoped<IProductRepository, EfProductRepository>();
```

This keeps business logic independent from infrastructure details.

### Common DI Mistakes

Common mistakes include:

- Injecting scoped services into singleton services
- Resolving scoped services from the root provider
- Using `IServiceProvider` everywhere instead of constructor injection
- Creating services manually with `new` when they should be DI-managed
- Calling `BuildServiceProvider()` inside registration code
- Registering stateful services as singleton
- Forgetting that singleton services must be thread-safe
- Using too many dependencies in one constructor
- Registering interfaces but injecting concrete types
- Manually disposing DI-created services
- Hiding real dependencies behind factories or service locators
- Using DI to compensate for poor class design

### Constructor Over-Injection

Constructor over-injection happens when a class has too many constructor dependencies.

```csharp
public class CheckoutService
{
    public CheckoutService(
        ICartRepository cartRepository,
        IInventoryService inventoryService,
        IPaymentGateway paymentGateway,
        IEmailSender emailSender,
        IDiscountService discountService,
        ITaxCalculator taxCalculator,
        IShippingService shippingService,
        ILogger<CheckoutService> logger)
    {
    }
}
```

This may indicate the class has too many responsibilities.

Possible improvements:

- Split the service into smaller services.
- Introduce domain services.
- Use orchestration carefully.
- Group related behavior behind meaningful abstractions.
- Re-check whether the class violates the Single Responsibility Principle.

Do not hide too many dependencies inside a generic wrapper just to make the constructor look smaller. Fix the design problem.

### Best Practices

Good DI practice in C# includes:

- Prefer constructor injection for required dependencies.
- Depend on abstractions where it improves testability and flexibility.
- Keep services small and focused.
- Choose lifetimes intentionally.
- Use scoped lifetime for EF Core `DbContext`.
- Avoid injecting scoped services into singletons.
- Keep singleton services stateless or thread-safe.
- Let the container dispose services it creates.
- Avoid service locator patterns.
- Avoid unnecessary manual calls to `BuildServiceProvider()`.
- Use `IServiceScopeFactory` when a singleton needs to perform scoped work.
- Prefer one public constructor for DI-managed services.
- Keep DI registration close to the application composition root.
- Validate configuration and registrations early when possible.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q01 -->
#### Beginner Q01: What is Dependency Injection in C#?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Dependency Injection is a design technique where a class receives the objects it depends on from the outside instead of creating them directly. In C# and .NET, this is commonly done through constructor injection and the built-in DI container.

For example, instead of `OrderService` creating `SqlOrderRepository` with `new`, it depends on `IOrderRepository`, and the DI container provides the concrete implementation.

This improves testability, reduces coupling, centralizes object creation, and makes it easier to change implementations.

##### Key Points to Mention

- DI means dependencies are provided from outside the class.
- It helps implement Inversion of Control.
- Constructor injection is the most common style in C#.
- It improves unit testing and maintainability.
- The .NET built-in DI container is configured through `IServiceCollection`.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q01 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q02 -->
#### Beginner Q02: What problem does DI solve?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

DI solves the problem of tight coupling between classes and their concrete dependencies. When a class creates its own dependencies using `new`, it becomes difficult to replace those dependencies, test the class, or change implementation details.

With DI, classes depend on abstractions and receive concrete implementations from the container. This makes the application more flexible and easier to maintain.

##### Key Points to Mention

- Avoids hard-coded dependencies.
- Makes dependencies explicit.
- Supports mocking and unit testing.
- Centralizes configuration.
- Helps follow the Dependency Inversion Principle.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q02 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q03 -->
#### Beginner Q03: What is a DI container?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A DI container is a component that creates objects and supplies their dependencies. In .NET, services are registered in `IServiceCollection`, and the container resolves them through `IServiceProvider`.

The container also manages service lifetimes and disposes services it creates when their lifetime ends.

##### Key Points to Mention

- `IServiceCollection` is used for registration.
- `IServiceProvider` is used for resolution.
- The container builds object graphs.
- The container manages lifetimes.
- ASP.NET Core uses the built-in DI container by default.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q03 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q04 -->
#### Beginner Q04: What are the three common service lifetimes in .NET DI?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The three common service lifetimes are transient, scoped, and singleton.

A transient service is created every time it is requested. A scoped service is created once per scope, which usually means once per HTTP request in ASP.NET Core. A singleton service is created once and shared for the whole application lifetime.

##### Key Points to Mention

- `AddTransient`: new instance every resolution.
- `AddScoped`: one instance per scope/request.
- `AddSingleton`: one shared instance for the application lifetime.
- Lifetime choice affects correctness, performance, disposal, and thread safety.
- EF Core `DbContext` is commonly registered as scoped.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q04 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q05 -->
#### Beginner Q05: What is constructor injection?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Constructor injection means dependencies are provided through a class constructor.

```csharp
public class ProductService
{
    private readonly IProductRepository _repository;

    public ProductService(IProductRepository repository)
    {
        _repository = repository;
    }
}
```

It is preferred because required dependencies are explicit and the object cannot be created without them.

##### Key Points to Mention

- Dependencies are passed through the constructor.
- Works well with `readonly` fields.
- Makes required dependencies obvious.
- Helps unit testing.
- Preferred over property injection for required services.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q05 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q06 -->
#### Beginner Q06: How do you register a service in ASP.NET Core?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

Services are registered in `Program.cs` using `builder.Services`.

```csharp
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<IClock, SystemClock>();
```

The registration tells the container which implementation to create when a service type is requested.

##### Key Points to Mention

- Registration usually happens in `Program.cs`.
- `AddScoped`, `AddTransient`, and `AddSingleton` define lifetime.
- Register abstractions to implementations when appropriate.
- The container resolves dependencies automatically.
- Controllers and services can receive registered services through constructors.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q06 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q07 -->
#### Beginner Q07: Why is DI useful for unit testing?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

DI makes unit testing easier because a class can receive fake, mock, or stub implementations instead of real dependencies.

For example, a service that depends on `IOrderRepository` can be tested with an in-memory fake repository instead of a real database.

This allows tests to focus on business logic without requiring external systems.

##### Key Points to Mention

- Dependencies can be replaced in tests.
- Avoids real databases, APIs, and file systems in unit tests.
- Makes classes easier to instantiate.
- Encourages small, focused services.
- Works well with interfaces and mocking libraries.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-beginner-q07 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q01 -->
#### Intermediate Q01: What is the difference between transient, scoped, and singleton services?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Transient services are created every time they are requested. They are suitable for lightweight stateless services.

Scoped services are created once per scope. In ASP.NET Core, one HTTP request usually has one scope. Scoped services are suitable for request-specific services and EF Core `DbContext`.

Singleton services are created once and shared for the entire application lifetime. They are suitable for stateless, thread-safe, shared services such as caches or clocks.

The key interview point is that lifetime affects object sharing, disposal, thread safety, and correctness.

##### Key Points to Mention

- Transient means new instance each resolution.
- Scoped means one instance per request/scope.
- Singleton means one instance for the application lifetime.
- Singleton must be thread-safe.
- Scoped services should not be injected into singletons.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q01 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q02 -->
#### Intermediate Q02: Why should you not inject a scoped service into a singleton?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A singleton lives for the entire application lifetime, while a scoped service is intended to live only for one scope or request. If a singleton captures a scoped service through constructor injection, the scoped service can effectively become a singleton.

This is called a captive dependency. It can cause stale state, thread-safety issues, incorrect request data sharing, and disposed object problems.

A common example is injecting `DbContext` into a singleton background service. The correct approach is to inject `IServiceScopeFactory`, create a scope when needed, resolve the scoped service inside that scope, and dispose the scope after use.

##### Key Points to Mention

- This is called a captive dependency.
- Singleton outlives scoped service.
- Can cause stale data or shared request state.
- `DbContext` should not be captured by singleton.
- Use `IServiceScopeFactory` for scoped work inside singleton services.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q02 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q03 -->
#### Intermediate Q03: Why is `DbContext` usually registered as scoped?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`DbContext` is usually registered as scoped because it represents a unit of work. In a web application, one request often performs multiple database operations that should use the same context instance.

Scoped lifetime also avoids sharing `DbContext` across requests, which is important because `DbContext` is not intended to be used concurrently by multiple threads.

Transient `DbContext` can make unit-of-work consistency harder, while singleton `DbContext` is dangerous because it can cause memory growth, stale tracking data, and thread-safety bugs.

##### Key Points to Mention

- `DbContext` is commonly a unit-of-work object.
- Scoped lifetime gives one context per request.
- Avoid sharing `DbContext` across requests.
- `DbContext` is not thread-safe.
- Singleton `DbContext` is a serious bug.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q03 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q04 -->
#### Intermediate Q04: What is the service locator anti-pattern?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

The service locator anti-pattern happens when a class injects `IServiceProvider` and manually asks for dependencies inside methods.

```csharp
public class OrderService
{
    private readonly IServiceProvider _provider;

    public OrderService(IServiceProvider provider)
    {
        _provider = provider;
    }

    public Task SubmitAsync(Order order)
    {
        var repository = _provider.GetRequiredService<IOrderRepository>();
        return repository.SaveAsync(order);
    }
}
```

This hides the real dependencies of the class, makes testing harder, and moves errors from compile time to runtime.

A better approach is constructor injection:

```csharp
public class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
    }
}
```

##### Key Points to Mention

- Dependencies become hidden.
- Makes code harder to test.
- Couples the class to the container.
- Can cause runtime resolution errors.
- Constructor injection is preferred.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q04 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q05 -->
#### Intermediate Q05: How does the .NET DI container choose which constructor to use?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

The .NET DI container uses public constructors. If there is one public constructor, it uses that constructor.

If there are multiple public constructors, the container selects the constructor with the most parameters that can be resolved from the container. If more than one constructor is valid and the container cannot clearly choose one, it throws an exception for ambiguous constructors.

The best practice is to have one public constructor for DI-managed services.

##### Key Points to Mention

- DI uses public constructors.
- The container chooses the constructor with the most resolvable parameters.
- Ambiguous constructors cause runtime errors.
- Prefer a single public constructor.
- Required dependencies should be explicit.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q05 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q06 -->
#### Intermediate Q06: What happens if a service is not registered?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

If a required service is not registered, resolving a service that depends on it fails at runtime.

For example:

```csharp
public class OrderService
{
    public OrderService(IOrderRepository repository)
    {
    }
}
```

If `IOrderRepository` is not registered, the container cannot create `OrderService`.

Using `GetRequiredService<T>()` throws an exception if the service is missing. Using `GetService<T>()` returns `null` if the service is missing.

##### Key Points to Mention

- Missing dependencies cause runtime resolution failures.
- `GetRequiredService<T>()` throws when missing.
- `GetService<T>()` returns `null`.
- Constructor injection makes missing dependencies visible.
- Integration tests can catch registration problems.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q06 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q07 -->
#### Intermediate Q07: How do you resolve scoped services inside a background service?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

A background service is usually registered as a singleton, so it should not directly inject scoped services such as `DbContext`. Instead, inject `IServiceScopeFactory`, create a scope inside the background operation, resolve scoped services from that scope, and dispose the scope when finished.

```csharp
public class Worker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public Worker(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.SaveChangesAsync(stoppingToken);
    }
}
```

##### Key Points to Mention

- `BackgroundService` is singleton-like.
- Do not inject scoped services directly into it.
- Inject `IServiceScopeFactory`.
- Create a scope for each unit of work.
- Resolve scoped services inside the scope.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q07 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q08 -->
#### Intermediate Q08: What is the difference between injecting one service and injecting `IEnumerable<T>`?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

If multiple implementations of the same interface are registered and a class injects a single service, the container usually resolves the last registered implementation.

If the class injects `IEnumerable<T>`, it receives all registered implementations.

```csharp
builder.Services.AddScoped<INotificationSender, EmailSender>();
builder.Services.AddScoped<INotificationSender, SmsSender>();
```

```csharp
public class NotificationService
{
    public NotificationService(IEnumerable<INotificationSender> senders)
    {
    }
}
```

This is useful for pipeline, strategy, validator, and notification scenarios.

##### Key Points to Mention

- Single service resolution usually gives the last registration.
- `IEnumerable<T>` gives all registered implementations.
- Useful for multiple strategies or handlers.
- Registration order can matter.
- Avoid relying on order unless intentional.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q08 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q09 -->
#### Intermediate Q09: Why should you avoid calling `BuildServiceProvider()` manually inside service registration?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q09 -->
<!-- question-level:intermediate -->

##### Expected Answer

Calling `BuildServiceProvider()` manually inside registration code creates a second service provider. This can lead to duplicate singleton instances, incorrect disposal, broken scopes, and hidden lifetime bugs.

In ASP.NET Core, the framework builds the service provider when `builder.Build()` is called. Application code should usually register services first and then resolve services from the built app provider when necessary.

##### Key Points to Mention

- Can create a second container.
- Can duplicate singleton instances.
- Can break disposal behavior.
- Can hide lifetime problems.
- Usually avoid it in `Program.cs` registration code.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q09 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q10 -->
#### Intermediate Q10: When would you use a factory registration?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q10 -->
<!-- question-level:intermediate -->

##### Expected Answer

A factory registration is useful when service construction needs custom logic, configuration values, environment-specific behavior, validation, or runtime decisions.

```csharp
builder.Services.AddSingleton<IFileStorage>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();

    string connectionString = config.GetConnectionString("Storage")
        ?? throw new InvalidOperationException("Missing storage connection string.");

    return new AzureBlobFileStorage(connectionString);
});
```

Factories should be used carefully. They should not become a place for complex business logic or hidden service locator patterns.

##### Key Points to Mention

- Useful for custom object creation.
- Can use configuration and other services.
- Can validate required setup.
- Avoid complex business logic in factories.
- Respect service lifetimes inside factories.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-intermediate-q10 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q01 -->
#### Advanced Q01: Explain captive dependency and how to fix it.
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A captive dependency is when a long-lived service captures a shorter-lived dependency. The most common example is a singleton depending on a scoped service.

```csharp
builder.Services.AddScoped<AppDbContext>();
builder.Services.AddSingleton<ReportScheduler>();
```

```csharp
public class ReportScheduler
{
    public ReportScheduler(AppDbContext dbContext)
    {
    }
}
```

This is wrong because the singleton may hold the scoped `DbContext` for the entire application lifetime.

Fixes include:

- Make the parent service scoped if it logically belongs to a request.
- Move scoped work into a scoped service.
- Inject `IServiceScopeFactory` into the singleton and create scopes when needed.
- Avoid storing scoped services in singleton fields.

##### Key Points to Mention

- Long-lived service captures short-lived service.
- Common with singleton plus scoped dependency.
- Causes stale state and thread-safety problems.
- Use `IServiceScopeFactory` for background scoped work.
- Prefer aligning lifetimes correctly.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q01 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q02 -->
#### Advanced Q02: How does DI relate to the Dependency Inversion Principle?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

The Dependency Inversion Principle says high-level modules should not depend on low-level modules; both should depend on abstractions. It also says abstractions should not depend on details; details should depend on abstractions.

DI helps implement this principle by allowing high-level classes to depend on interfaces while the container provides the concrete implementations.

For example, an application service depends on `IProductRepository`, while the infrastructure layer provides `EfProductRepository`.

DI is the mechanism; Dependency Inversion is the design principle.

##### Key Points to Mention

- Dependency Inversion is a principle.
- DI is a technique that helps implement it.
- High-level code depends on abstractions.
- Infrastructure implements application-defined interfaces.
- Common in Clean Architecture.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q02 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q03 -->
#### Advanced Q03: How should constructor ambiguity be handled in DI-managed services?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Constructor ambiguity happens when a class has multiple public constructors and the DI container cannot clearly decide which one to use.

The best solution is to design DI-managed services with one public constructor containing all required dependencies.

Bad example:

```csharp
public class ReportService
{
    public ReportService(ILogger<ReportService> logger)
    {
    }

    public ReportService(IOptions<ReportOptions> options)
    {
    }
}
```

If both dependencies are registered, the container may report an ambiguous constructor error.

Better example:

```csharp
public class ReportService
{
    public ReportService(
        ILogger<ReportService> logger,
        IOptions<ReportOptions> options)
    {
    }
}
```

For `ActivatorUtilities`, `[ActivatorUtilitiesConstructor]` can mark a constructor, but it should not be used as a substitute for clean design.

##### Key Points to Mention

- Multiple public constructors can be ambiguous.
- DI selects the most resolvable constructor when possible.
- Ambiguity causes runtime errors.
- Prefer one public constructor.
- `[ActivatorUtilitiesConstructor]` is mainly for `ActivatorUtilities`.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q03 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q04 -->
#### Advanced Q04: What lifetime should application services, repositories, and domain services usually have?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

In typical ASP.NET Core applications, application services and repositories are often registered as scoped because they participate in a request and often depend on scoped services such as `DbContext`.

Domain services may not always need DI. If they are stateless and pure, they can be simple classes or even methods. If they depend on other services, they can be registered with an appropriate lifetime.

A safe common default for business services in web apps is scoped. Use transient for lightweight stateless helpers and singleton only for shared thread-safe services.

##### Key Points to Mention

- Application services are often scoped.
- Repositories using `DbContext` should usually be scoped.
- Stateless helpers can be transient.
- Singleton requires thread safety.
- Lifetime should match dependencies and state.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q04 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q05 -->
#### Advanced Q05: What are the risks of injecting `IServiceProvider`?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Injecting `IServiceProvider` can be useful in rare cases, but overusing it leads to the service locator anti-pattern. It hides dependencies, weakens compile-time clarity, makes testing harder, and can lead to lifetime mistakes.

It is acceptable in infrastructure-level code that genuinely needs dynamic resolution, scope creation, framework integration, or factory behavior. Even then, the design should be intentional and limited.

For normal application services, constructor injection of explicit dependencies is preferred.

##### Key Points to Mention

- Can hide real dependencies.
- Makes unit tests harder.
- Can cause lifetime bugs.
- Sometimes acceptable for factories or infrastructure.
- Prefer explicit constructor dependencies.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q05 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q06 -->
#### Advanced Q06: How do you manage disposable services with DI?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

The DI container is responsible for disposing services that it creates. Scoped and transient disposable services resolved within a scope are disposed when the scope ends. Singleton disposable services are disposed when the root provider is disposed, usually during application shutdown.

Application code should not manually dispose services that were injected by DI.

If code manually creates an object with `new`, then that code is responsible for disposing it. If the container creates the object, the container owns its disposal.

##### Key Points to Mention

- Container disposes services it creates.
- Scoped services are disposed at scope end.
- Singleton services are disposed when the provider shuts down.
- Do not manually dispose injected services.
- Be careful with transient disposable services resolved from the root provider.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q06 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q07 -->
#### Advanced Q07: How can too many constructor dependencies indicate a design problem?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Too many constructor dependencies can indicate that a class has too many responsibilities. This is sometimes called constructor over-injection.

For example, a service that depends on repositories, payment gateways, email senders, inventory services, tax services, shipping services, and logging may be doing too much orchestration and business logic in one place.

The solution is not always to hide dependencies inside a wrapper. A better solution is often to split responsibilities, introduce smaller services, use domain services, or model the workflow more clearly.

##### Key Points to Mention

- Many dependencies can signal SRP violation.
- Do not hide dependencies just to reduce constructor length.
- Split responsibilities into smaller services.
- Group dependencies only when they form a meaningful abstraction.
- Review design boundaries.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q07 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q08 -->
#### Advanced Q08: How do keyed services compare with the strategy pattern?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Keyed services allow the DI container to register and resolve different implementations of the same service type using a key.

The strategy pattern models interchangeable algorithms behind a common interface. Keyed services can help wire strategy implementations, but they are not a replacement for good domain design.

Use keyed services when the selection is mostly configuration or infrastructure-driven. Use the strategy pattern when the selection is part of business behavior and should be expressed clearly in application code.

##### Key Points to Mention

- Keyed services are a DI feature.
- Strategy pattern is a design pattern.
- Keyed services can wire strategies.
- Avoid hiding business decisions in DI keys.
- Use clear abstractions for business behavior.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q08 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q09 -->
#### Advanced Q09: How should DI be organized in a Clean Architecture solution?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

In Clean Architecture, the domain layer should not depend on the DI container. The application layer usually defines interfaces for external concerns. The infrastructure layer implements those interfaces. The API or host layer wires everything together in the DI container.

A common approach is to provide extension methods such as `AddApplication()` and `AddInfrastructure()`.

```csharp
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
```

This keeps the composition root clean while preserving dependency direction.

##### Key Points to Mention

- Domain should not depend on DI framework.
- Application defines interfaces.
- Infrastructure implements interfaces.
- API/host wires dependencies.
- Extension methods can organize registration.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q09 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q10 -->
#### Advanced Q10: How would you diagnose DI lifetime bugs in production?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q10 -->
<!-- question-level:advanced -->

##### Expected Answer

To diagnose DI lifetime bugs, check service registrations, constructor dependencies, background services, and root provider resolutions. Look for scoped services captured by singletons, stateful singleton services, manually built service providers, and services resolved outside a scope.

Symptoms can include stale data, cross-request data leaks, disposed object exceptions, concurrency bugs, and memory growth.

Useful approaches include:

- Enable scope validation in development.
- Add integration tests that build the real service provider.
- Review registrations by lifetime.
- Search for `IServiceProvider`, `BuildServiceProvider`, and `CreateScope`.
- Check singleton services for mutable state.
- Check background workers for scoped service usage.

##### Key Points to Mention

- Look for captive dependencies.
- Check singleton mutable state.
- Search for manual provider creation.
- Validate scopes in development.
- Use integration tests for registration validation.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q10 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q11 -->
#### Advanced Q11: What are the limitations of the built-in .NET DI container?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q11 -->
<!-- question-level:advanced -->

##### Expected Answer

The built-in .NET DI container is intentionally simple and works well for most ASP.NET Core applications. It supports constructor injection, lifetimes, open generics, multiple registrations, `IEnumerable<T>`, factory registrations, and keyed services.

However, it is less feature-rich than some third-party containers. Some advanced features, such as property injection, advanced convention scanning, child containers, or complex interception, may require additional libraries or different design approaches.

In many applications, the built-in container is preferred because it is simple, integrated, and sufficient.

##### Key Points to Mention

- Built-in container is intentionally simple.
- Good enough for most ASP.NET Core apps.
- Supports common DI features.
- Third-party containers may offer more advanced features.
- Prefer simple design before adding container complexity.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q11 -->

<!-- question:start:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q12 -->
#### Advanced Q12: How does `ActivatorUtilities` differ from normal service resolution?
<!-- question-id:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q12 -->
<!-- question-level:advanced -->

##### Expected Answer

Normal service resolution uses the DI container to resolve a registered service. `ActivatorUtilities` can create an instance of a type that may not be registered, while still resolving some constructor parameters from `IServiceProvider`.

It can also accept explicit runtime parameters.

```csharp
var job = ActivatorUtilities.CreateInstance<ExportJob>(
    serviceProvider,
    "orders.csv");
```

In this example, services such as `ILogger<ExportJob>` can come from DI, while `"orders.csv"` is supplied manually.

This is useful for framework activation, runtime-created objects, and cases where only part of the constructor comes from DI.

##### Key Points to Mention

- Normal resolution resolves registered services.
- `ActivatorUtilities` can create unregistered types.
- It combines DI services with explicit parameters.
- Useful for runtime values.
- Constructor selection and ambiguity still matter.

<!-- question:end:di-di-container-basics-lifetimes-and-constructor-selection-in-csharp-advanced-q12 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
