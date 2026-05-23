---
id: factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility
topic: Software design principles and common .NET patterns
subtopic: Factory, Builder, Strategy, Adapter, Decorator, Facade, Proxy, and Chain of Responsibility
category: Design & Architecture
---


## Overview

Factory, Builder, Strategy, Adapter, Decorator, Facade, Proxy, and Chain of Responsibility are common object-oriented design patterns. They describe reusable ways to solve recurring software design problems. In C# and .NET, these patterns appear in everyday application code, framework internals, ASP.NET Core middleware, dependency injection, HTTP clients, validation pipelines, logging, caching, data access, payment processing, file generation, and integration with external systems.

Design patterns are not rules that must be applied everywhere. They are vocabulary and proven structures that help developers discuss and solve design problems. A pattern is useful when it reduces complexity, improves testability, improves extensibility, or makes responsibilities clearer. A pattern is harmful when it is applied mechanically and makes simple code harder to understand.

The patterns in this topic can be grouped by purpose:

| Pattern | Category | Main Purpose |
|---|---|---|
| Factory | Creational | Encapsulate object creation |
| Builder | Creational | Construct complex objects step by step |
| Strategy | Behavioral | Swap algorithms or behaviors behind a common interface |
| Adapter | Structural | Make an incompatible interface usable |
| Decorator | Structural | Add behavior while keeping the same interface |
| Facade | Structural | Provide a simplified interface over a complex subsystem |
| Proxy | Structural | Control access to another object |
| Chain of Responsibility | Behavioral | Pass a request through a chain of handlers |

These patterns are important for interviews because they test practical design judgment. Interviewers may ask you to explain the pattern, implement it in C#, compare it with similar patterns, or identify which pattern is already used in a framework feature.

For example:

- ASP.NET Core middleware is similar to Chain of Responsibility because each middleware can handle the request, call the next middleware, or short-circuit the pipeline.
- Dependency injection often works with Strategy because multiple implementations can be selected behind an interface.
- `IHttpClientFactory` is a factory-style abstraction for creating configured `HttpClient` instances.
- Decorator is commonly used for adding logging, caching, validation, retry, authorization, or metrics around an existing service.
- Adapter is used when wrapping a third-party library or legacy API behind a project-specific interface.
- Facade is used when a controller or application service should call one simple API instead of coordinating many subsystems.
- Proxy is used for lazy loading, caching, access control, remote calls, or expensive object protection.

A strong answer should explain not only what each pattern is, but also:

- What problem it solves.
- When it is useful.
- When it is overkill.
- How it relates to dependency injection.
- How to implement it in C#.
- What trade-offs it introduces.
- How to test code that uses it.
- How it differs from similar patterns.

## Core Concepts

### What Design Patterns Are

A design pattern is a named, reusable solution structure for a common software design problem.

A pattern usually describes:

- The problem.
- The context.
- The participating objects.
- The relationships between those objects.
- The trade-offs.
- The consequences.
- Common implementation variants.

Patterns are useful because they provide shared language.

Instead of saying:

```text
Let's create an object that wraps this service, implements the same interface, forwards calls to the original service, and adds logging before and after.
```

A developer can say:

```text
Let's use a decorator for logging.
```

Patterns are not copy-paste code. They are design ideas that can be implemented differently depending on the language and framework.

In modern C#, patterns often appear with:

- Interfaces.
- Abstract classes.
- Records and DTOs.
- Delegates and lambdas.
- Dependency injection.
- Extension methods.
- Middleware pipelines.
- Generic types.
- Options pattern.
- `IEnumerable<T>` injection.
- Keyed services.
- Source generators or dynamic proxies in advanced cases.

### Pattern Categories

The classic categories are:

| Category | Purpose |
|---|---|
| Creational | How objects are created |
| Structural | How objects and classes are composed |
| Behavioral | How objects communicate and vary behavior |

In this topic:

- **Factory** and **Builder** are creational patterns.
- **Adapter**, **Decorator**, **Facade**, and **Proxy** are structural patterns.
- **Strategy** and **Chain of Responsibility** are behavioral patterns.

These categories help, but real-world patterns often overlap. For example, a factory may create strategies. A decorator may be part of a chain. A proxy may use a strategy for access control. A facade may use factories internally.

### Factory Pattern

The Factory pattern encapsulates object creation. Instead of callers constructing concrete objects directly with `new`, they ask a factory to create the right object.

Use Factory when:

- Object creation is complex.
- The concrete type depends on input.
- The caller should not know implementation details.
- Creation requires configuration or dependencies.
- You need to centralize creation rules.
- You want to avoid large `switch` logic scattered across the codebase.

Simple example:

```csharp
public interface INotificationSender
{
    Task SendAsync(string recipient, string message, CancellationToken cancellationToken);
}

public sealed class EmailNotificationSender : INotificationSender
{
    public Task SendAsync(string recipient, string message, CancellationToken cancellationToken)
    {
        Console.WriteLine($"Email to {recipient}: {message}");
        return Task.CompletedTask;
    }
}

public sealed class SmsNotificationSender : INotificationSender
{
    public Task SendAsync(string recipient, string message, CancellationToken cancellationToken)
    {
        Console.WriteLine($"SMS to {recipient}: {message}");
        return Task.CompletedTask;
    }
}
```

Factory:

```csharp
public enum NotificationChannel
{
    Email,
    Sms
}

public sealed class NotificationSenderFactory
{
    private readonly IServiceProvider _serviceProvider;

    public NotificationSenderFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public INotificationSender Create(NotificationChannel channel)
    {
        return channel switch
        {
            NotificationChannel.Email =>
                _serviceProvider.GetRequiredService<EmailNotificationSender>(),

            NotificationChannel.Sms =>
                _serviceProvider.GetRequiredService<SmsNotificationSender>(),

            _ => throw new NotSupportedException($"Unsupported channel: {channel}")
        };
    }
}
```

Registration:

```csharp
builder.Services.AddTransient<EmailNotificationSender>();
builder.Services.AddTransient<SmsNotificationSender>();
builder.Services.AddSingleton<NotificationSenderFactory>();
```

Usage:

```csharp
public sealed class NotificationService
{
    private readonly NotificationSenderFactory _factory;

    public NotificationService(NotificationSenderFactory factory)
    {
        _factory = factory;
    }

    public Task SendAsync(
        NotificationChannel channel,
        string recipient,
        string message,
        CancellationToken cancellationToken)
    {
        var sender = _factory.Create(channel);

        return sender.SendAsync(recipient, message, cancellationToken);
    }
}
```

This centralizes the selection of the concrete sender.

### Factory Pattern Variants

Factory is a broad term. Common variants include:

| Variant | Description |
|---|---|
| Simple Factory | A class or method creates objects based on input |
| Factory Method | A base class defines a creation method that derived classes override |
| Abstract Factory | Creates families of related objects |
| DI Factory | Uses dependency injection to resolve concrete services |
| Static Factory Method | A static method creates instances with meaningful names |

Static factory example:

```csharp
public sealed class Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static Money Usd(decimal amount)
    {
        return new Money(amount, "USD");
    }

    public static Money Eur(decimal amount)
    {
        return new Money(amount, "EUR");
    }
}
```

Usage:

```csharp
var price = Money.Usd(49.99m);
```

This is clearer than exposing a constructor that accepts arbitrary currency strings everywhere.

Factory Method example:

```csharp
public abstract class ReportExporter
{
    public async Task ExportAsync(Report report, string path)
    {
        var formatter = CreateFormatter();
        var content = formatter.Format(report);

        await File.WriteAllTextAsync(path, content);
    }

    protected abstract IReportFormatter CreateFormatter();
}

public sealed class CsvReportExporter : ReportExporter
{
    protected override IReportFormatter CreateFormatter()
    {
        return new CsvReportFormatter();
    }
}
```

In modern .NET applications, simple factories and DI-based factories are more common than inheritance-heavy Factory Method implementations.

### Factory Pattern Trade-Offs

Benefits:

- Centralizes creation logic.
- Hides concrete types from callers.
- Improves testability when combined with interfaces.
- Supports runtime selection.
- Reduces duplicated `switch` or `new` logic.
- Keeps construction rules consistent.

Costs:

- Adds another abstraction.
- Can hide dependencies if overused.
- Can become a service locator if it exposes `IServiceProvider` too broadly.
- Can grow into a large conditional factory.
- May be unnecessary when DI can inject the needed implementation directly.

Common mistakes:

- Creating factories for every class.
- Using factories when a normal constructor or DI registration is enough.
- Putting business logic inside the factory.
- Returning `object` instead of a meaningful interface.
- Injecting `IServiceProvider` into many classes and resolving dependencies manually.
- Building a complex abstract factory when a simple method is enough.

Best practices:

- Use factories when creation logic is meaningful.
- Keep factories focused on creation and selection.
- Prefer typed factories over exposing `IServiceProvider` everywhere.
- Use DI to supply dependencies to objects created by the factory.
- Avoid factories that know too much about business workflows.

### Builder Pattern

The Builder pattern constructs complex objects step by step. It is useful when an object has many optional parts, complex validation, readable test setup needs, or multiple construction representations.

Use Builder when:

- Constructors have too many parameters.
- Object construction requires multiple steps.
- Test data setup is noisy.
- You need readable object creation.
- You need to enforce construction order.
- You need to build different representations from similar inputs.

Example problem:

```csharp
var report = new Report(
    title: "Monthly Sales",
    startDate: new DateOnly(2026, 1, 1),
    endDate: new DateOnly(2026, 1, 31),
    includeCharts: true,
    includeSummary: true,
    includeDetails: false,
    format: ReportFormat.Pdf,
    timezone: "UTC");
```

This constructor is hard to read and easy to misuse.

Builder:

```csharp
public sealed class ReportRequest
{
    public required string Title { get; init; }
    public required DateOnly StartDate { get; init; }
    public required DateOnly EndDate { get; init; }
    public bool IncludeCharts { get; init; }
    public bool IncludeSummary { get; init; }
    public bool IncludeDetails { get; init; }
    public ReportFormat Format { get; init; } = ReportFormat.Pdf;
    public string Timezone { get; init; } = "UTC";
}
```

```csharp
public sealed class ReportRequestBuilder
{
    private string _title = "Untitled Report";
    private DateOnly _startDate = DateOnly.FromDateTime(DateTime.UtcNow);
    private DateOnly _endDate = DateOnly.FromDateTime(DateTime.UtcNow);
    private bool _includeCharts;
    private bool _includeSummary = true;
    private bool _includeDetails;
    private ReportFormat _format = ReportFormat.Pdf;
    private string _timezone = "UTC";

    public ReportRequestBuilder WithTitle(string title)
    {
        _title = title;
        return this;
    }

    public ReportRequestBuilder ForDateRange(DateOnly startDate, DateOnly endDate)
    {
        _startDate = startDate;
        _endDate = endDate;
        return this;
    }

    public ReportRequestBuilder IncludeCharts()
    {
        _includeCharts = true;
        return this;
    }

    public ReportRequestBuilder IncludeDetails()
    {
        _includeDetails = true;
        return this;
    }

    public ReportRequestBuilder AsExcel()
    {
        _format = ReportFormat.Excel;
        return this;
    }

    public ReportRequest Build()
    {
        if (_endDate < _startDate)
            throw new InvalidOperationException("End date cannot be before start date.");

        return new ReportRequest
        {
            Title = _title,
            StartDate = _startDate,
            EndDate = _endDate,
            IncludeCharts = _includeCharts,
            IncludeSummary = _includeSummary,
            IncludeDetails = _includeDetails,
            Format = _format,
            Timezone = _timezone
        };
    }
}
```

Usage:

```csharp
var request = new ReportRequestBuilder()
    .WithTitle("Monthly Sales")
    .ForDateRange(
        new DateOnly(2026, 1, 1),
        new DateOnly(2026, 1, 31))
    .IncludeCharts()
    .AsExcel()
    .Build();
```

The code is more readable and reduces constructor confusion.

### Builder Pattern in Tests

Builders are very useful for test data.

Without builder:

```csharp
var order = new Order
{
    Id = Guid.NewGuid(),
    CustomerId = Guid.NewGuid(),
    Status = OrderStatus.Draft,
    CreatedAtUtc = DateTimeOffset.UtcNow,
    Items =
    {
        new OrderItem
        {
            ProductId = Guid.NewGuid(),
            UnitPrice = 10m,
            Quantity = 2
        }
    }
};
```

With test data builder:

```csharp
public sealed class OrderBuilder
{
    private readonly List<OrderItem> _items = new();
    private Guid _customerId = Guid.NewGuid();
    private OrderStatus _status = OrderStatus.Draft;

    public OrderBuilder ForCustomer(Guid customerId)
    {
        _customerId = customerId;
        return this;
    }

    public OrderBuilder WithItem(decimal unitPrice, int quantity)
    {
        _items.Add(new OrderItem
        {
            ProductId = Guid.NewGuid(),
            UnitPrice = unitPrice,
            Quantity = quantity
        });

        return this;
    }

    public OrderBuilder Submitted()
    {
        _status = OrderStatus.Submitted;
        return this;
    }

    public Order Build()
    {
        var order = new Order(_customerId);

        foreach (var item in _items)
        {
            order.AddItem(item.ProductId, item.UnitPrice, item.Quantity);
        }

        if (_status == OrderStatus.Submitted)
        {
            order.Submit();
        }

        return order;
    }
}
```

Usage:

```csharp
var order = new OrderBuilder()
    .WithItem(10m, 2)
    .WithItem(5m, 1)
    .Submitted()
    .Build();
```

This makes tests more focused on what matters.

### Builder Pattern Trade-Offs

Benefits:

- Improves readability for complex construction.
- Avoids long constructors with many optional parameters.
- Can enforce validation before object creation.
- Helps test setup.
- Supports fluent object creation.
- Makes default values explicit.

Costs:

- Adds extra code.
- Can duplicate object properties.
- Can hide required fields if poorly designed.
- Can create mutable builder state.
- May be overkill for simple objects.

Common mistakes:

- Creating builders for simple DTOs with two or three properties.
- Allowing invalid objects to be built.
- Making builder methods too generic.
- Using builders instead of proper domain constructors.
- Putting business workflows inside builders.

Best practices:

- Use builders for complex construction or test data.
- Keep builders focused on construction.
- Validate in `Build`.
- Prefer meaningful method names such as `Submitted()` instead of `WithStatus(OrderStatus.Submitted)` when it improves readability.
- Do not use builder to bypass domain invariants.

### Strategy Pattern

The Strategy pattern defines a family of algorithms or behaviors behind a common interface and makes them interchangeable.

Use Strategy when:

- You have multiple ways to perform the same kind of operation.
- You want to avoid large `switch` statements.
- You want to select behavior at runtime.
- You want to test algorithms independently.
- You want to add new behavior without changing existing code.
- You want to follow Open/Closed Principle.

Example problem:

```csharp
public decimal CalculateShipping(Order order, string shippingMethod)
{
    return shippingMethod switch
    {
        "standard" => 10m,
        "express" => 25m,
        "overnight" => 50m,
        _ => throw new NotSupportedException()
    };
}
```

This works for small cases, but it grows poorly as logic becomes complex.

Strategy:

```csharp
public interface IShippingCostStrategy
{
    string Method { get; }

    decimal Calculate(Order order);
}

public sealed class StandardShippingStrategy : IShippingCostStrategy
{
    public string Method => "standard";

    public decimal Calculate(Order order)
    {
        return 10m;
    }
}

public sealed class ExpressShippingStrategy : IShippingCostStrategy
{
    public string Method => "express";

    public decimal Calculate(Order order)
    {
        return 25m;
    }
}
```

Resolver:

```csharp
public sealed class ShippingCostCalculator
{
    private readonly IReadOnlyDictionary<string, IShippingCostStrategy> _strategies;

    public ShippingCostCalculator(IEnumerable<IShippingCostStrategy> strategies)
    {
        _strategies = strategies.ToDictionary(
            strategy => strategy.Method,
            StringComparer.OrdinalIgnoreCase);
    }

    public decimal Calculate(Order order, string method)
    {
        if (!_strategies.TryGetValue(method, out var strategy))
            throw new NotSupportedException($"Unsupported shipping method: {method}");

        return strategy.Calculate(order);
    }
}
```

Registration:

```csharp
builder.Services.AddScoped<IShippingCostStrategy, StandardShippingStrategy>();
builder.Services.AddScoped<IShippingCostStrategy, ExpressShippingStrategy>();
builder.Services.AddScoped<ShippingCostCalculator>();
```

Now adding a new shipping method means adding a new class and registering it.

### Strategy Pattern with Delegates

In C#, Strategy can also be implemented with delegates when behavior is simple.

```csharp
public sealed class DiscountCalculator
{
    private readonly Func<Customer, decimal, decimal> _discountStrategy;

    public DiscountCalculator(Func<Customer, decimal, decimal> discountStrategy)
    {
        _discountStrategy = discountStrategy;
    }

    public decimal Calculate(Customer customer, decimal subtotal)
    {
        return _discountStrategy(customer, subtotal);
    }
}
```

Usage:

```csharp
var calculator = new DiscountCalculator((customer, subtotal) =>
{
    return customer.IsPremium ? subtotal * 0.10m : subtotal * 0.02m;
});
```

Use interface-based strategies when:

- The algorithm is complex.
- The strategy has dependencies.
- You need named implementations.
- You need DI.
- You need separate tests.
- You expect multiple implementations.

Use delegates when:

- The behavior is small.
- No dependencies are needed.
- A lightweight functional style is clearer.

### Strategy Pattern Trade-Offs

Benefits:

- Removes large conditionals.
- Supports Open/Closed Principle.
- Improves testability.
- Makes algorithms independently replaceable.
- Works well with dependency injection.
- Keeps each behavior cohesive.

Costs:

- Adds more classes.
- Can be overkill for simple `if` or `switch`.
- Requires strategy selection logic.
- Can make flow harder to follow if overused.
- May hide simple business rules behind unnecessary indirection.

Common mistakes:

- Replacing every `switch` with Strategy even when the switch is simple and stable.
- Creating strategies with unclear boundaries.
- Putting selection logic inside each strategy.
- Creating a large strategy interface that forces unused methods.
- Forgetting to handle unknown strategy keys.

Best practices:

- Use Strategy when behavior varies meaningfully.
- Keep strategy interfaces small.
- Keep each strategy focused.
- Use DI for strategies with dependencies.
- Use a resolver or keyed services for runtime selection.
- Keep simple logic simple.

### Adapter Pattern

The Adapter pattern converts one interface into another interface expected by the client.

Use Adapter when:

- A third-party API has an inconvenient interface.
- A legacy class does not match your application's interface.
- You want to isolate external library details.
- You need to convert data formats.
- You want to protect your application from vendor changes.
- You want a testable wrapper around external code.

Example: third-party payment SDK

```csharp
public sealed class ThirdPartyPaymentClient
{
    public Task ChargeCardAsync(
        string cardToken,
        int amountInCents,
        string currencyCode)
    {
        // External SDK call
        return Task.CompletedTask;
    }
}
```

Your application wants this interface:

```csharp
public interface IPaymentGateway
{
    Task<PaymentResult> ChargeAsync(
        PaymentRequest request,
        CancellationToken cancellationToken);
}
```

Adapter:

```csharp
public sealed class ThirdPartyPaymentAdapter : IPaymentGateway
{
    private readonly ThirdPartyPaymentClient _client;

    public ThirdPartyPaymentAdapter(ThirdPartyPaymentClient client)
    {
        _client = client;
    }

    public async Task<PaymentResult> ChargeAsync(
        PaymentRequest request,
        CancellationToken cancellationToken)
    {
        var amountInCents = (int)(request.Amount * 100);

        await _client.ChargeCardAsync(
            request.CardToken,
            amountInCents,
            request.Currency);

        return PaymentResult.Success();
    }
}
```

Registration:

```csharp
builder.Services.AddSingleton<ThirdPartyPaymentClient>();
builder.Services.AddScoped<IPaymentGateway, ThirdPartyPaymentAdapter>();
```

The rest of the application depends on `IPaymentGateway`, not the third-party SDK.

### Adapter Pattern in Real .NET Projects

Common Adapter examples:

- Wrapping a payment provider SDK.
- Wrapping a legacy SOAP service behind a clean interface.
- Wrapping a file system API behind `IFileStorage`.
- Wrapping Azure Blob Storage behind `IObjectStorage`.
- Wrapping SMTP behind `IEmailSender`.
- Wrapping a message broker behind `IMessagePublisher`.
- Mapping external DTOs to internal models.
- Adapting old code to a new interface during migration.
- Wrapping `DateTime.UtcNow` behind `TimeProvider` or a clock abstraction.

Example file storage adapter:

```csharp
public interface IFileStorage
{
    Task UploadAsync(
        string path,
        Stream content,
        CancellationToken cancellationToken);
}

public sealed class AzureBlobFileStorage : IFileStorage
{
    private readonly BlobContainerClient _container;

    public AzureBlobFileStorage(BlobContainerClient container)
    {
        _container = container;
    }

    public async Task UploadAsync(
        string path,
        Stream content,
        CancellationToken cancellationToken)
    {
        var blob = _container.GetBlobClient(path);

        await blob.UploadAsync(content, overwrite: true, cancellationToken);
    }
}
```

This adapter keeps cloud-specific code outside the application layer.

### Adapter Pattern Trade-Offs

Benefits:

- Isolates external APIs.
- Protects domain/application code from vendor-specific details.
- Improves testability.
- Supports migration from legacy systems.
- Makes integration boundaries explicit.
- Converts incompatible interfaces.

Costs:

- Adds mapping code.
- Can hide important external behavior if oversimplified.
- Requires maintenance when external APIs change.
- May introduce performance overhead if excessive conversion occurs.

Common mistakes:

- Letting third-party models leak through the adapter.
- Making the adapter too generic.
- Putting business rules in the adapter instead of application/domain logic.
- Not handling external errors consistently.
- Adapting only the happy path and ignoring failure modes.

Best practices:

- Keep adapters at infrastructure boundaries.
- Convert external models to internal models.
- Normalize external errors into application-specific exceptions or results.
- Do not leak vendor-specific types into core application code.
- Write integration tests for adapters.
- Use fake implementations for unit tests.

### Decorator Pattern

The Decorator pattern adds behavior to an object while keeping the same interface. A decorator wraps another implementation of the same interface and forwards calls to it, adding behavior before or after.

Use Decorator when:

- You want to add cross-cutting behavior.
- You want to avoid modifying the original class.
- You want to compose behaviors.
- You want logging, caching, validation, retry, metrics, authorization, or transactions around a service.
- You want behavior to be optional or configurable.
- You want to follow Open/Closed Principle.

Base interface:

```csharp
public interface IProductService
{
    Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
}
```

Core implementation:

```csharp
public sealed class ProductService : IProductService
{
    private readonly AppDbContext _context;

    public ProductService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ProductDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        return await _context.Products
            .Where(product => product.Id == id)
            .Select(product => new ProductDto(product.Id, product.Name))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
```

Caching decorator:

```csharp
public sealed class CachedProductService : IProductService
{
    private readonly IProductService _inner;
    private readonly IMemoryCache _cache;

    public CachedProductService(
        IProductService inner,
        IMemoryCache cache)
    {
        _inner = inner;
        _cache = cache;
    }

    public async Task<ProductDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var cacheKey = $"product:{id}";

        if (_cache.TryGetValue(cacheKey, out ProductDto? cached))
            return cached;

        var product = await _inner.GetByIdAsync(id, cancellationToken);

        if (product is not null)
        {
            _cache.Set(cacheKey, product, TimeSpan.FromMinutes(5));
        }

        return product;
    }
}
```

The caller still depends on `IProductService`.

### Decorator Pattern in .NET

Common .NET decorator examples:

- Logging decorators.
- Caching decorators.
- Retry decorators.
- Validation decorators.
- Authorization decorators.
- Metrics decorators.
- Transaction decorators.
- MediatR pipeline behaviors.
- ASP.NET Core middleware.
- Stream wrappers such as compression streams.
- `HttpMessageHandler` chains.
- `ILogger` provider pipelines.

Example logging decorator:

```csharp
public sealed class LoggingProductService : IProductService
{
    private readonly IProductService _inner;
    private readonly ILogger<LoggingProductService> _logger;

    public LoggingProductService(
        IProductService inner,
        ILogger<LoggingProductService> logger)
    {
        _inner = inner;
        _logger = logger;
    }

    public async Task<ProductDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Getting product {ProductId}.", id);

        var product = await _inner.GetByIdAsync(id, cancellationToken);

        _logger.LogInformation(
            "Product {ProductId} found: {Found}.",
            id,
            product is not null);

        return product;
    }
}
```

Decorators can be stacked:

```text
LoggingProductService
  -> CachedProductService
    -> ProductService
```

Order matters. Caching before logging produces different behavior than logging before caching.

### Decorator Pattern Trade-Offs

Benefits:

- Adds behavior without changing core implementation.
- Supports composition.
- Keeps cross-cutting concerns separate.
- Improves Open/Closed Principle.
- Makes behavior reusable.
- Works well with interfaces and DI.

Costs:

- More classes.
- More registrations.
- Debugging call flow can be harder.
- Order of decorators matters.
- Too many decorators can hide behavior.
- Some DI containers need extra setup for decorators.

Common mistakes:

- Changing the interface in the decorator.
- Adding unrelated business logic to a cross-cutting decorator.
- Creating decorators with hidden side effects.
- Ignoring decorator order.
- Wrapping too many layers around simple logic.

Best practices:

- Decorators should implement the same interface.
- Keep decorator behavior focused.
- Make order explicit.
- Use decorators for cross-cutting concerns.
- Test core implementation and decorators separately.
- Avoid decorators when a simple method call is clearer.

### Facade Pattern

The Facade pattern provides a simplified interface over a complex subsystem.

Use Facade when:

- A client must coordinate many services.
- A subsystem is complex.
- You want to hide implementation details.
- You want a simpler use-case-level API.
- You want to reduce coupling to many subsystem classes.
- You want to make common workflows easier to use.

Example without facade:

```csharp
public sealed class CheckoutController : ControllerBase
{
    public async Task<IActionResult> Checkout(CheckoutRequest request)
    {
        await _inventory.ReserveAsync(request.Items);
        var payment = await _payments.ChargeAsync(request.Payment);
        var order = await _orders.CreateAsync(request, payment);
        await _shipping.CreateShipmentAsync(order);
        await _notifications.SendConfirmationAsync(order);

        return Ok(order.Id);
    }
}
```

The controller knows too much about the checkout workflow.

Facade:

```csharp
public interface ICheckoutFacade
{
    Task<CheckoutResult> CheckoutAsync(
        CheckoutRequest request,
        CancellationToken cancellationToken);
}
```

```csharp
public sealed class CheckoutFacade : ICheckoutFacade
{
    private readonly IInventoryService _inventory;
    private readonly IPaymentGateway _payments;
    private readonly IOrderService _orders;
    private readonly IShippingService _shipping;
    private readonly INotificationService _notifications;

    public CheckoutFacade(
        IInventoryService inventory,
        IPaymentGateway payments,
        IOrderService orders,
        IShippingService shipping,
        INotificationService notifications)
    {
        _inventory = inventory;
        _payments = payments;
        _orders = orders;
        _shipping = shipping;
        _notifications = notifications;
    }

    public async Task<CheckoutResult> CheckoutAsync(
        CheckoutRequest request,
        CancellationToken cancellationToken)
    {
        await _inventory.ReserveAsync(request.Items, cancellationToken);

        var payment = await _payments.ChargeAsync(
            request.Payment,
            cancellationToken);

        var order = await _orders.CreateAsync(
            request,
            payment,
            cancellationToken);

        await _shipping.CreateShipmentAsync(order, cancellationToken);
        await _notifications.SendConfirmationAsync(order, cancellationToken);

        return new CheckoutResult(order.Id);
    }
}
```

Controller:

```csharp
[HttpPost]
public async Task<ActionResult<CheckoutResult>> Checkout(
    CheckoutRequest request,
    CancellationToken cancellationToken)
{
    var result = await _checkout.CheckoutAsync(request, cancellationToken);

    return Ok(result);
}
```

The controller now depends on one simplified interface.

### Facade Pattern Trade-Offs

Benefits:

- Simplifies clients.
- Reduces coupling to subsystem details.
- Centralizes common workflow coordination.
- Improves readability.
- Makes complex subsystems easier to use.
- Can create a stable API over changing internals.

Costs:

- Facade can become a God service.
- May hide important failure details.
- Can centralize too much orchestration.
- Can become a bottleneck for changes.
- May duplicate application service responsibilities.

Common mistakes:

- Calling every service facade.
- Putting all business logic in one huge facade.
- Hiding errors too aggressively.
- Creating a facade that only forwards calls without simplifying anything.
- Using a facade to cover poor subsystem design instead of improving it.

Best practices:

- Use facades for meaningful workflows or subsystem simplification.
- Keep facade methods use-case-oriented.
- Avoid making facades too broad.
- Do not hide important domain errors.
- Keep subsystem boundaries clear.

### Proxy Pattern

The Proxy pattern provides a substitute object that controls access to another object. A proxy usually implements the same interface as the real object and decides how or when to call it.

Use Proxy when:

- You need lazy loading.
- You need access control.
- You need caching.
- You need remote communication.
- You need logging or metrics around access.
- You need to protect an expensive object.
- You need to delay object creation.
- You need to control concurrency.

Example:

```csharp
public interface IReportLoader
{
    Task<Report> LoadAsync(Guid reportId, CancellationToken cancellationToken);
}
```

Real object:

```csharp
public sealed class DatabaseReportLoader : IReportLoader
{
    private readonly AppDbContext _context;

    public DatabaseReportLoader(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Report> LoadAsync(
        Guid reportId,
        CancellationToken cancellationToken)
    {
        return await _context.Reports
            .SingleAsync(report => report.Id == reportId, cancellationToken);
    }
}
```

Caching proxy:

```csharp
public sealed class CachedReportLoaderProxy : IReportLoader
{
    private readonly IReportLoader _inner;
    private readonly IMemoryCache _cache;

    public CachedReportLoaderProxy(
        IReportLoader inner,
        IMemoryCache cache)
    {
        _inner = inner;
        _cache = cache;
    }

    public async Task<Report> LoadAsync(
        Guid reportId,
        CancellationToken cancellationToken)
    {
        var cacheKey = $"report:{reportId}";

        if (_cache.TryGetValue(cacheKey, out Report? cached))
            return cached!;

        var report = await _inner.LoadAsync(reportId, cancellationToken);

        _cache.Set(cacheKey, report, TimeSpan.FromMinutes(10));

        return report;
    }
}
```

This looks similar to Decorator. The difference is intent. Decorator adds responsibilities. Proxy controls access to the underlying object.

### Proxy Pattern Variants

Common proxy types:

| Proxy Type | Purpose |
|---|---|
| Virtual Proxy | Lazy-load expensive objects |
| Protection Proxy | Check permissions before access |
| Remote Proxy | Represent an object in another process or service |
| Caching Proxy | Return cached results instead of calling real object |
| Logging/Monitoring Proxy | Observe access to real object |
| Smart Proxy | Add lifecycle, reference counting, or concurrency control |

Protection proxy example:

```csharp
public sealed class AuthorizedDocumentServiceProxy : IDocumentService
{
    private readonly IDocumentService _inner;
    private readonly ICurrentUser _currentUser;

    public AuthorizedDocumentServiceProxy(
        IDocumentService inner,
        ICurrentUser currentUser)
    {
        _inner = inner;
        _currentUser = currentUser;
    }

    public async Task<Document> GetAsync(
        Guid documentId,
        CancellationToken cancellationToken)
    {
        if (!_currentUser.HasPermission("documents.read"))
            throw new UnauthorizedAccessException();

        return await _inner.GetAsync(documentId, cancellationToken);
    }
}
```

Remote proxy example:

```csharp
public sealed class HttpCatalogProxy : ICatalogService
{
    private readonly HttpClient _httpClient;

    public HttpCatalogProxy(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ProductDto?> GetProductAsync(
        Guid productId,
        CancellationToken cancellationToken)
    {
        return await _httpClient.GetFromJsonAsync<ProductDto>(
            $"api/products/{productId}",
            cancellationToken);
    }
}
```

The caller sees `ICatalogService`, while the proxy communicates with a remote API.

### Proxy vs Decorator

Proxy and Decorator often look similar because both wrap another object and usually implement the same interface.

The difference is intent:

| Pattern | Main Intent |
|---|---|
| Decorator | Add behavior or responsibilities |
| Proxy | Control access to the real object |

Example:

- A logging decorator adds logging around a service.
- A caching proxy controls whether the real service is called.
- An authorization proxy controls whether the real service can be accessed.
- A remote proxy controls access to an object in another process.

In practice, some implementations can be described as either depending on intent. In interviews, explain the intent and trade-offs clearly.

### Proxy Pattern Trade-Offs

Benefits:

- Controls access to expensive or sensitive objects.
- Supports lazy loading.
- Adds security checks.
- Encapsulates remote communication.
- Can reduce repeated calls through caching.
- Keeps caller interface stable.

Costs:

- Adds indirection.
- Can hide remote or expensive operations.
- Caching proxies can return stale data.
- Authorization proxies can duplicate policy logic if not designed carefully.
- Dynamic proxies can be harder to debug.
- Remote proxies may hide network failure complexity.

Common mistakes:

- Making remote calls look too much like local calls and ignoring latency/failure.
- Caching data without invalidation strategy.
- Putting too much business logic in a proxy.
- Using proxy when decorator or adapter is more accurate.
- Hiding exceptions or failure modes.

Best practices:

- Make expensive or remote behavior observable.
- Keep proxy responsibility clear.
- Use cancellation tokens for remote proxies.
- Define caching and invalidation rules.
- Do not hide important failure semantics.
- Test access control and cache behavior.

### Chain of Responsibility Pattern

Chain of Responsibility passes a request through a sequence of handlers. Each handler can process the request, pass it to the next handler, or stop the chain.

Use Chain of Responsibility when:

- Multiple handlers may process a request.
- Processing steps should be composable.
- Order matters.
- Each step should be independent.
- You want to add/remove steps without changing the caller.
- You need a pipeline.
- A request may be short-circuited.

ASP.NET Core middleware is a common example. Each middleware receives an `HttpContext`, can do work, can call `next`, or can stop the pipeline.

Simple custom chain:

```csharp
public sealed class SupportTicket
{
    public required string Title { get; init; }
    public required string Category { get; init; }
    public bool Handled { get; set; }
}
```

Handler interface:

```csharp
public interface ITicketHandler
{
    Task HandleAsync(
        SupportTicket ticket,
        TicketHandlerDelegate next,
        CancellationToken cancellationToken);
}

public delegate Task TicketHandlerDelegate(
    SupportTicket ticket,
    CancellationToken cancellationToken);
```

Handlers:

```csharp
public sealed class BillingTicketHandler : ITicketHandler
{
    public async Task HandleAsync(
        SupportTicket ticket,
        TicketHandlerDelegate next,
        CancellationToken cancellationToken)
    {
        if (ticket.Category == "billing")
        {
            ticket.Handled = true;
            return;
        }

        await next(ticket, cancellationToken);
    }
}

public sealed class TechnicalTicketHandler : ITicketHandler
{
    public async Task HandleAsync(
        SupportTicket ticket,
        TicketHandlerDelegate next,
        CancellationToken cancellationToken)
    {
        if (ticket.Category == "technical")
        {
            ticket.Handled = true;
            return;
        }

        await next(ticket, cancellationToken);
    }
}
```

Pipeline builder:

```csharp
public sealed class TicketPipeline
{
    private readonly IReadOnlyList<ITicketHandler> _handlers;

    public TicketPipeline(IEnumerable<ITicketHandler> handlers)
    {
        _handlers = handlers.ToList();
    }

    public Task HandleAsync(
        SupportTicket ticket,
        CancellationToken cancellationToken)
    {
        TicketHandlerDelegate terminal = (_, _) => Task.CompletedTask;

        var pipeline = _handlers
            .Reverse()
            .Aggregate(terminal, (next, handler) =>
            {
                return (currentTicket, token) =>
                    handler.HandleAsync(currentTicket, next, token);
            });

        return pipeline(ticket, cancellationToken);
    }
}
```

This creates a request pipeline.

### Chain of Responsibility in ASP.NET Core

ASP.NET Core middleware is a practical Chain of Responsibility / pipeline example.

```csharp
app.Use(async (context, next) =>
{
    Console.WriteLine("Before next middleware");

    await next(context);

    Console.WriteLine("After next middleware");
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

Each middleware can:

- Run before the next component.
- Call the next component.
- Run after the next component.
- Short-circuit the request.
- Add data to `HttpContext`.
- Handle exceptions.
- Apply authentication/authorization.
- Add response headers.
- Log request details.

Short-circuit example:

```csharp
app.Use(async (context, next) =>
{
    if (!context.Request.Headers.ContainsKey("X-Correlation-Id"))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsync("Missing correlation id.");
        return;
    }

    await next(context);
});
```

The request is not passed further if the header is missing.

### Chain of Responsibility vs Decorator

Both can involve wrapping and ordering.

| Pattern | Structure | Main Intent |
|---|---|---|
| Decorator | One object wraps another object with the same interface | Add behavior to an object |
| Chain of Responsibility | Multiple handlers process/pass a request | Route or process a request through steps |

Decorator usually wraps one service call. Chain usually processes a request through multiple independent handlers.

Example:

- Logging decorator around `IOrderService`.
- ASP.NET Core middleware chain processing `HttpContext`.

### Chain of Responsibility Trade-Offs

Benefits:

- Decouples sender from handlers.
- Supports flexible pipelines.
- Allows adding/removing/reordering handlers.
- Supports short-circuiting.
- Keeps each handler focused.
- Useful for validation, middleware, authorization, and processing pipelines.

Costs:

- Order can be hard to understand.
- Debugging can be harder.
- A request may not be handled if chain is misconfigured.
- Too many handlers can create hidden behavior.
- Shared mutable context can become messy.
- Error handling across the chain needs design.

Common mistakes:

- Making handlers depend heavily on each other.
- Relying on unclear ordering.
- Using global mutable context.
- Swallowing errors in a handler.
- Creating too many tiny handlers without clarity.
- Not testing pipeline order.

Best practices:

- Keep handlers focused.
- Make ordering explicit.
- Use a clear context object.
- Avoid hidden side effects.
- Add tests for important chain order.
- Use short-circuiting intentionally.
- Log or trace pipeline behavior when debugging matters.

### Pattern Comparison Summary

| Pattern | Problem It Solves | Common .NET Example |
|---|---|---|
| Factory | Object creation varies or is complex | `IHttpClientFactory`, service resolver |
| Builder | Complex object construction | Test data builders, options builders |
| Strategy | Algorithm/behavior varies | Payment strategy, shipping calculation |
| Adapter | Interface mismatch | Wrapper around third-party SDK |
| Decorator | Add behavior to same interface | Logging/caching around a service |
| Facade | Simplify complex subsystem | Checkout facade coordinating services |
| Proxy | Control access to object | Lazy loading, caching, authorization, remote service proxy |
| Chain of Responsibility | Process request through handlers | ASP.NET Core middleware pipeline |

### Choosing the Right Pattern

Use this decision guide:

```text
Do I need to choose which object to create?
Use Factory.

Do I need to construct a complex object step by step?
Use Builder.

Do I need to swap algorithms or behaviors?
Use Strategy.

Do I need to make an incompatible API fit my interface?
Use Adapter.

Do I need to add behavior while keeping the same interface?
Use Decorator.

Do I need to simplify a complex subsystem?
Use Facade.

Do I need to control access to another object?
Use Proxy.

Do I need to pass a request through multiple handlers?
Use Chain of Responsibility.
```

Do not force a pattern. Many problems are solved best with simple methods, functions, or dependency injection.

### Patterns and Dependency Injection

Dependency injection is not a replacement for design patterns, but it changes how they are implemented.

Examples:

- Factory can use DI to create objects with dependencies.
- Strategy implementations can be registered as `IEnumerable<IStrategy>`.
- Decorators can wrap services registered in the container.
- Adapters can be registered behind application interfaces.
- Facades can receive subsystem services through constructor injection.
- Proxies can be registered as implementations of the same interface.
- Chain handlers can be registered in a specific order.

DI improves testability and makes dependencies explicit. However, overusing DI with unnecessary interfaces can make code harder to navigate.

Best practices:

- Register patterns at meaningful boundaries.
- Use constructor injection.
- Avoid service locator style.
- Prefer explicit dependencies.
- Keep lifetimes correct.
- Avoid injecting scoped services into singletons.
- Keep runtime selection logic clear.

### Patterns and Over-Engineering

Design patterns can improve architecture, but they can also become over-engineering.

Warning signs:

- The pattern adds more complexity than it removes.
- There is only one implementation and no real boundary.
- A simple method becomes many classes.
- Developers struggle to follow the call flow.
- The pattern is used because it is "best practice" but no problem requires it.
- Tests become harder instead of easier.
- The abstraction has a vague name.
- There are many empty pass-through classes.

Example over-engineering:

```text
Controller -> Facade -> Manager -> Processor -> Strategy -> Factory -> Handler -> Service
```

If most layers only forward calls, the design may violate KISS and YAGNI.

Good use of patterns should make code easier to understand or change.

### Testing Code That Uses Patterns

Testing guidance:

| Pattern | Testing Approach |
|---|---|
| Factory | Test selection logic and unsupported cases |
| Builder | Test required fields, defaults, validation, and object result |
| Strategy | Test each strategy independently and resolver selection |
| Adapter | Unit test mapping; integration test real external API wrapper |
| Decorator | Test added behavior and that inner service is called |
| Facade | Test orchestration and failure handling |
| Proxy | Test access control, caching/lazy behavior, and fallback |
| Chain of Responsibility | Test each handler and important pipeline order |

Example strategy test:

```csharp
[Fact]
public void ExpressShippingStrategy_ReturnsExpectedCost()
{
    var strategy = new ExpressShippingStrategy();
    var order = new OrderBuilder().WithItem(10m, 2).Build();

    var cost = strategy.Calculate(order);

    Assert.Equal(25m, cost);
}
```

Example factory test:

```csharp
[Fact]
public void Create_WhenChannelIsEmail_ReturnsEmailSender()
{
    var factory = CreateFactory();

    var sender = factory.Create(NotificationChannel.Email);

    Assert.IsType<EmailNotificationSender>(sender);
}
```

Good tests verify behavior, not just pattern structure.

### Common Mistakes

Common mistakes include:

- Using patterns without a real problem.
- Naming a class after a pattern instead of its domain role.
- Creating too many interfaces.
- Replacing simple conditionals with unnecessary Strategy classes.
- Using Factory as a service locator.
- Putting business logic inside object factories.
- Using Builder for simple DTOs.
- Letting Adapter leak third-party types into the core application.
- Making Decorators change the interface contract.
- Creating a Facade that becomes a God service.
- Using Proxy while hiding important remote latency and failure.
- Creating Chain of Responsibility handlers with unclear order.
- Not testing pipeline order.
- Ignoring DI lifetimes.
- Overusing inheritance in Factory Method when simple composition would be clearer.
- Confusing Decorator, Proxy, Adapter, and Facade.
- Applying design patterns mechanically instead of pragmatically.

### Best Practices

Use patterns to solve real design problems.

Prefer simple code until a pattern provides clear value.

Name classes by business purpose, not only by pattern name.

Use interfaces at meaningful boundaries.

Keep pattern implementations focused.

Keep object creation separate from business workflow logic.

Use Strategy for meaningful behavior variation.

Use Adapter to isolate external and legacy systems.

Use Decorator for cross-cutting behavior around a service.

Use Facade to simplify complex subsystem usage.

Use Proxy when access control, lazy loading, caching, or remote representation is the main concern.

Use Chain of Responsibility for pipelines with ordered handlers.

Use dependency injection carefully with correct lifetimes.

Test both the individual components and the selection/pipeline behavior.

Document ordering rules for pipelines and decorators.

Avoid over-engineering small features with too many patterns.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q01 -->
#### Beginner Q01: What is a design pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A design pattern is a reusable solution structure for a common software design problem. It is not copy-paste code, but a way to organize classes, interfaces, and responsibilities. Design patterns give developers a shared vocabulary for discussing design.

For example, instead of explaining that one object wraps another object to add caching while keeping the same interface, a developer can say "use a decorator."

##### Key Points to Mention

- Reusable solution to common design problem.
- Provides shared vocabulary.
- Not tied to one language.
- Not copy-paste code.
- Should solve a real problem.
- Can improve maintainability, testability, and extensibility.
- Can cause over-engineering if applied mechanically.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q01 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q02 -->
#### Beginner Q02: What is the Factory pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The Factory pattern encapsulates object creation. Instead of callers constructing concrete objects directly, they ask a factory to create the correct object.

It is useful when object creation is complex, when the concrete type depends on input, or when creation logic should be centralized.

Example:

```csharp
public interface INotificationSender
{
    Task SendAsync(string recipient, string message);
}

public sealed class NotificationSenderFactory
{
    public INotificationSender Create(string channel)
    {
        return channel switch
        {
            "email" => new EmailNotificationSender(),
            "sms" => new SmsNotificationSender(),
            _ => throw new NotSupportedException()
        };
    }
}
```

##### Key Points to Mention

- Encapsulates object creation.
- Hides concrete types from callers.
- Useful when creation varies by input.
- Centralizes creation logic.
- Can work with dependency injection.
- Avoid using factories for every simple class.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q02 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q03 -->
#### Beginner Q03: What is the Builder pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The Builder pattern constructs complex objects step by step. It is useful when an object has many optional properties, complex validation, or noisy construction code.

A builder usually has fluent methods and a final `Build` method.

Example:

```csharp
var report = new ReportRequestBuilder()
    .WithTitle("Monthly Sales")
    .ForDateRange(startDate, endDate)
    .IncludeCharts()
    .Build();
```

Builders are also useful in unit tests because they make test data setup readable.

##### Key Points to Mention

- Builds complex objects step by step.
- Avoids long constructors with many optional parameters.
- Improves readability.
- Useful for test data setup.
- Can validate before object creation.
- Overkill for simple DTOs.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q03 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q04 -->
#### Beginner Q04: What is the Strategy pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The Strategy pattern defines a family of algorithms or behaviors behind a common interface and makes them interchangeable.

Example:

```csharp
public interface IShippingCostStrategy
{
    decimal Calculate(Order order);
}
```

Different implementations can calculate standard, express, or overnight shipping. The caller depends on the interface and can use the correct strategy at runtime.

Strategy is useful when behavior varies and you want to avoid large conditional statements.

##### Key Points to Mention

- Encapsulates interchangeable algorithms.
- Uses a common interface.
- Helps avoid large `switch` or `if` chains.
- Supports Open/Closed Principle.
- Works well with dependency injection.
- Can be overkill for simple stable conditions.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q04 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q05 -->
#### Beginner Q05: What is the Adapter pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

The Adapter pattern converts one interface into another interface expected by the client. It is commonly used to wrap third-party libraries, legacy code, or external services behind an application-specific interface.

For example, an application may define `IPaymentGateway`, while a third-party SDK has a different API. An adapter implements `IPaymentGateway` and internally calls the SDK.

##### Key Points to Mention

- Converts incompatible interfaces.
- Common for third-party libraries and legacy APIs.
- Keeps external details out of core application code.
- Improves testability.
- Translates external models and errors.
- Should not leak vendor-specific types.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q05 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q06 -->
#### Beginner Q06: What is the Decorator pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

The Decorator pattern adds behavior to an object while keeping the same interface. A decorator wraps another implementation of the same interface and forwards calls to it, adding behavior before or after.

Example uses include logging, caching, validation, retry, metrics, and authorization.

```csharp
public sealed class LoggingProductService : IProductService
{
    private readonly IProductService _inner;

    public LoggingProductService(IProductService inner)
    {
        _inner = inner;
    }

    public Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken token)
    {
        Console.WriteLine($"Getting product {id}");
        return _inner.GetByIdAsync(id, token);
    }
}
```

##### Key Points to Mention

- Adds behavior while keeping same interface.
- Wraps another implementation.
- Good for cross-cutting concerns.
- Supports composition.
- Order of decorators can matter.
- Different from Adapter because it does not change the interface.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q06 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q07 -->
#### Beginner Q07: What is the Facade pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

The Facade pattern provides a simplified interface over a complex subsystem. Instead of making a client coordinate many services directly, the facade exposes a simpler operation.

For example, a `CheckoutFacade` may coordinate inventory reservation, payment, order creation, shipping, and notification. The controller calls one facade method instead of knowing all subsystem details.

##### Key Points to Mention

- Simplifies a complex subsystem.
- Reduces client coupling to many services.
- Useful for workflows.
- Hides internal coordination.
- Can become a God service if too broad.
- Should provide real simplification, not just pass-through methods.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q07 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q08 -->
#### Beginner Q08: What is the Proxy pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q08 -->
<!-- question-level:beginner -->

##### Expected Answer

The Proxy pattern provides a substitute object that controls access to another object. It usually implements the same interface as the real object.

Common proxy uses include lazy loading, access control, caching, remote calls, and protecting expensive objects.

Example: an authorization proxy checks permissions before calling the real document service.

##### Key Points to Mention

- Controls access to another object.
- Usually implements same interface.
- Used for lazy loading, caching, authorization, and remote access.
- Similar structure to Decorator but different intent.
- Should not hide important latency or failure behavior.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q08 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q09 -->
#### Beginner Q09: What is Chain of Responsibility?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q09 -->
<!-- question-level:beginner -->

##### Expected Answer

Chain of Responsibility passes a request through a chain of handlers. Each handler can process the request, pass it to the next handler, or stop the chain.

ASP.NET Core middleware is a common example. Each middleware receives the request, can do work, can call the next middleware, or can short-circuit the pipeline.

##### Key Points to Mention

- Request moves through a chain of handlers.
- Each handler decides whether to handle or pass along.
- Supports pipelines.
- Order matters.
- ASP.NET Core middleware is a practical example.
- Useful for validation, middleware, authorization, and processing steps.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-beginner-q09 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q01 -->
#### Intermediate Q01: How do Factory and Strategy work together?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Strategy defines interchangeable behavior behind a common interface. Factory can be used to select or create the correct strategy based on runtime input.

For example, `IShippingCostStrategy` may have `StandardShippingStrategy` and `ExpressShippingStrategy`. A factory or resolver can choose the correct strategy based on the shipping method.

The strategy handles the algorithm. The factory handles creation or selection.

##### Key Points to Mention

- Strategy defines interchangeable behavior.
- Factory selects or creates the right implementation.
- Common in DI-based applications.
- Keeps selection logic separate from algorithm logic.
- Avoid scattering `switch` statements.
- Keep factory focused on creation/selection.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q01 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q02 -->
#### Intermediate Q02: What is the difference between Adapter, Decorator, Facade, and Proxy?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

These patterns can look similar because they wrap or hide other objects, but their intent is different.

Adapter changes an incompatible interface into the interface the client expects. Decorator adds behavior while keeping the same interface. Facade provides a simplified interface over a complex subsystem. Proxy controls access to another object.

Example:

- Adapter wraps a third-party payment SDK behind `IPaymentGateway`.
- Decorator adds logging around `IProductService`.
- Facade exposes `CheckoutAsync` over inventory, payment, shipping, and notification services.
- Proxy checks authorization before calling `IDocumentService`.

##### Key Points to Mention

- Adapter changes interface.
- Decorator adds behavior.
- Facade simplifies subsystem usage.
- Proxy controls access.
- Structure can look similar, but intent differs.
- Explain patterns by problem solved, not only class shape.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q02 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q03 -->
#### Intermediate Q03: How would you implement Strategy with dependency injection in .NET?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Define a strategy interface, create multiple implementations, register them with DI, and inject `IEnumerable<TStrategy>` into a resolver or service. The resolver selects the correct strategy based on a key.

Example:

```csharp
builder.Services.AddScoped<IShippingCostStrategy, StandardShippingStrategy>();
builder.Services.AddScoped<IShippingCostStrategy, ExpressShippingStrategy>();
```

```csharp
public sealed class ShippingCostCalculator
{
    private readonly Dictionary<string, IShippingCostStrategy> _strategies;

    public ShippingCostCalculator(IEnumerable<IShippingCostStrategy> strategies)
    {
        _strategies = strategies.ToDictionary(x => x.Method);
    }
}
```

This avoids hard-coding concrete classes in the caller.

##### Key Points to Mention

- Define small strategy interface.
- Register multiple implementations.
- Inject `IEnumerable<IStrategy>`.
- Select by key or metadata.
- Keep selection logic separate.
- Test each strategy independently.
- Handle unknown strategy keys.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q03 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q04 -->
#### Intermediate Q04: When is Builder better than optional constructor parameters?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Builder is better when object construction has many optional values, complex validation, step-by-step setup, or readability problems. Optional parameters are fine for small simple objects, but they become hard to read when there are many booleans or optional values.

For example, a report request with title, date range, format, timezone, chart options, summary options, and detail options may be clearer with a fluent builder.

Builder is also useful in tests because it provides sensible defaults and lets each test override only the relevant parts.

##### Key Points to Mention

- Use Builder for complex construction.
- Avoid long constructors with many optional parameters.
- Useful when validation is needed before construction.
- Good for readable test data setup.
- Optional parameters are fine for simple cases.
- Builder is overkill for simple DTOs.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q04 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q05 -->
#### Intermediate Q05: How does Chain of Responsibility relate to ASP.NET Core middleware?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

ASP.NET Core middleware is a practical pipeline similar to Chain of Responsibility. Each middleware receives `HttpContext`, performs work, and decides whether to call the next middleware. It can also short-circuit the pipeline by writing a response and not calling next.

Examples include exception handling, routing, authentication, authorization, logging, CORS, and endpoint execution.

Order matters because each middleware runs in the order it is registered.

##### Key Points to Mention

- Middleware forms an ordered pipeline.
- Each component can call next or short-circuit.
- Order matters.
- Used for cross-cutting request behavior.
- Similar to Chain of Responsibility.
- Important examples: authentication before authorization, exception handling early.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q05 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q06 -->
#### Intermediate Q06: How do you test a Decorator?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Test the decorator separately from the inner implementation. Use a fake or mock inner service, call the decorator, and assert that the decorator adds the expected behavior and forwards the call correctly.

For example, a caching decorator test should verify that the first call invokes the inner service and stores the result, while the second call returns the cached result without calling the inner service again.

A logging decorator may verify that the inner service is called and logs are emitted if logging is part of the requirement.

##### Key Points to Mention

- Use fake/mock inner service.
- Verify added behavior.
- Verify inner service is called when expected.
- Verify caching/retry/validation logic separately.
- Test decorator order when multiple decorators are composed.
- Do not retest the entire inner implementation through the decorator.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q06 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q07 -->
#### Intermediate Q07: What are common real-world uses of Adapter in .NET?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Adapter is commonly used to wrap external or legacy systems behind application-specific interfaces. Examples include wrapping a payment SDK behind `IPaymentGateway`, wrapping Azure Blob Storage behind `IFileStorage`, wrapping SMTP behind `IEmailSender`, wrapping a legacy SOAP service behind a clean interface, or converting external DTOs into internal models.

This keeps third-party details out of the domain and application layers and makes unit testing easier.

##### Key Points to Mention

- Wrap third-party SDKs.
- Wrap legacy systems.
- Wrap cloud services.
- Convert external DTOs to internal models.
- Normalize external errors.
- Protect core code from vendor-specific APIs.
- Improve testability.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q07 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q08 -->
#### Intermediate Q08: When can a Facade become a problem?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

A Facade becomes a problem when it grows into a God service that coordinates too many unrelated workflows. It may hide too much, become a bottleneck for changes, collect unrelated dependencies, and make testing difficult.

A good facade simplifies a meaningful subsystem or workflow. A bad facade becomes a dumping ground for business logic that does not belong together.

If a facade has many unrelated methods and many dependencies, it may need to be split into smaller use-case-specific services.

##### Key Points to Mention

- Facade can become a God service.
- Too many unrelated methods indicate low cohesion.
- Too many dependencies are a warning sign.
- Should simplify a meaningful subsystem.
- Should not hide important errors.
- Split broad facades into focused use-case services.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q01 -->
#### Advanced Q01: How would you choose between Strategy and a simple `switch` expression?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would use a simple `switch` when the logic is small, stable, and easy to understand. A `switch` is not automatically bad. I would use Strategy when each case has meaningful behavior, dependencies, separate tests, or frequent extension. Strategy is also useful when new behavior should be added without modifying existing logic.

For example, a simple enum-to-label mapping can remain a switch. Payment processing, tax calculation, shipping calculation, or document generation may deserve strategies because each implementation has different rules and dependencies.

##### Key Points to Mention

- `switch` is fine for simple stable logic.
- Strategy is better for complex or changing behavior.
- Strategy supports Open/Closed Principle.
- Strategy improves independent testing.
- Strategy adds classes and indirection.
- Avoid replacing every conditional with a pattern.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q01 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q02 -->
#### Advanced Q02: How would you design a payment integration using these patterns?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

I would define an application interface such as `IPaymentGateway` or `IPaymentStrategy`. Each provider, such as Stripe or PayPal, could be implemented as an adapter around that provider's SDK. If the application supports multiple providers at runtime, a factory or resolver can select the correct strategy.

I might use decorators for logging, metrics, retries, or idempotency behavior around the payment gateway. A facade could coordinate checkout steps such as inventory reservation, payment, order creation, and notification. A proxy could enforce authorization or rate limits if needed.

The key is to keep provider-specific code isolated and keep the application layer dependent on stable abstractions.

##### Key Points to Mention

- Use Adapter for third-party SDKs.
- Use Strategy for multiple payment providers.
- Use Factory/resolver for provider selection.
- Use Decorator for logging, metrics, retry, idempotency support.
- Use Facade for checkout workflow.
- Keep provider-specific models out of core code.
- Consider idempotency, error handling, and observability.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q02 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q03 -->
#### Advanced Q03: How can a Factory become a service locator anti-pattern?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A factory becomes a service locator anti-pattern when it exposes a generic way to resolve arbitrary services, often by passing around `IServiceProvider` and calling `GetService` throughout the codebase. This hides dependencies, makes classes harder to understand and test, and moves errors from startup to runtime.

A better factory should be specific and typed. It should expose a focused creation method such as `Create(NotificationChannel channel)` and return a known abstraction. Dependencies should still be explicit wherever possible.

##### Key Points to Mention

- Service locator hides dependencies.
- Generic `IServiceProvider` usage spreads runtime resolution.
- Makes testing and reasoning harder.
- Can hide missing registrations until runtime.
- Prefer typed, focused factories.
- Use constructor injection for normal dependencies.
- Keep factory responsibility limited to creation/selection.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q03 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q04 -->
#### Advanced Q04: How would you implement cross-cutting concerns with Decorator vs Chain of Responsibility?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use Decorator when the concern wraps a specific service interface. For example, add caching or logging around `IProductService`. The decorator implements the same interface and calls the inner service.

Use Chain of Responsibility when the concern is part of an ordered request pipeline. For example, ASP.NET Core middleware handles exception handling, routing, authentication, authorization, and endpoints through a request pipeline.

Decorator is object/service-focused. Chain of Responsibility is request/pipeline-focused.

##### Key Points to Mention

- Decorator wraps one service interface.
- Chain passes a request through handlers.
- Decorator keeps same interface.
- Chain order matters and can short-circuit.
- Middleware is a Chain-style example.
- Both can implement cross-cutting concerns.
- Choose based on whether the problem is service wrapping or pipeline processing.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q04 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q05 -->
#### Advanced Q05: How do you avoid over-engineering when using design patterns?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

I avoid over-engineering by starting with the simplest design that satisfies current requirements. I introduce a pattern only when it solves a clear problem such as complex creation, behavior variation, interface mismatch, cross-cutting behavior, subsystem complexity, access control, or pipeline processing.

I also check whether the pattern improves readability, testability, or extensibility. If it adds classes and indirection without reducing complexity, it may not be justified.

Patterns should be applied pragmatically, not mechanically.

##### Key Points to Mention

- Start simple.
- Use patterns to solve real problems.
- Avoid pattern-driven design.
- Check readability and testability.
- Avoid unnecessary interfaces and layers.
- Prefer direct code for simple stable logic.
- Refactor into patterns when the need becomes clear.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q05 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q06 -->
#### Advanced Q06: What are the risks of using Proxy for remote services?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A remote proxy can make a remote service look like a local object, which can be dangerous if developers forget about network latency, timeouts, partial failures, retries, authentication, serialization, rate limits, and versioning.

Remote calls are not the same as local method calls. A good remote proxy should make failure behavior clear, use cancellation tokens, apply timeouts, handle errors carefully, and expose observability.

The proxy should simplify usage but not hide important distributed-system concerns.

##### Key Points to Mention

- Remote calls have latency and failure modes.
- Do not treat remote calls like local calls.
- Need timeouts and cancellation tokens.
- Need retries only when safe.
- Need error handling and observability.
- Need versioning and serialization care.
- Avoid hiding important failure semantics.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q06 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q07 -->
#### Advanced Q07: How would you test a Chain of Responsibility pipeline?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

I would test individual handlers in isolation and also test important pipeline combinations. Individual handler tests verify whether a handler processes, modifies, passes, or short-circuits correctly. Pipeline tests verify ordering and interaction between handlers.

For ASP.NET Core middleware, integration tests can verify that middleware order produces the expected HTTP behavior, such as authentication happening before authorization or exception middleware catching downstream exceptions.

I would avoid testing every possible combination if the pipeline is large, but important order-sensitive behavior should be covered.

##### Key Points to Mention

- Test handlers individually.
- Test important pipeline order.
- Verify short-circuit behavior.
- Verify context changes.
- Test error handling.
- Use integration tests for middleware pipelines.
- Avoid excessive combination testing.
- Make ordering explicit.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q07 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q08 -->
#### Advanced Q08: How do these patterns support SOLID principles?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

These patterns support SOLID when used appropriately. Strategy and Decorator support Open/Closed Principle by allowing behavior to be extended without modifying existing code. Adapter and Facade support Dependency Inversion and Separation of Concerns by isolating external or complex subsystems. Factory centralizes creation and can hide concrete implementations. Chain of Responsibility keeps handlers focused and supports Single Responsibility. Builder can improve construction clarity and object validity.

However, patterns can also violate SOLID if overused. A huge facade can violate Single Responsibility. A factory that knows every concrete type can become too coupled. A large strategy interface can violate Interface Segregation.

##### Key Points to Mention

- Strategy supports OCP.
- Decorator supports OCP and composition.
- Adapter supports DIP and external isolation.
- Facade supports SoC when focused.
- Chain supports SRP for handlers.
- Factory centralizes creation.
- Patterns can violate SOLID if overused.
- Apply patterns pragmatically.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q08 -->

<!-- question:start:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q09 -->
#### Advanced Q09: How would you explain which pattern to use in a code review?

<!-- question-id:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start with the problem, not the pattern name. If the issue is object creation complexity, I might suggest Factory or Builder. If the issue is multiple algorithms, Strategy. If the issue is a third-party API mismatch, Adapter. If the issue is adding caching or logging around a service, Decorator. If the issue is a complex subsystem leaking into a controller, Facade. If the issue is access control or lazy loading, Proxy. If the issue is ordered processing steps, Chain of Responsibility.

I would also ask whether the pattern makes the code simpler and more maintainable. If a simple method solves the problem clearly, I would avoid adding a pattern just for style.

##### Key Points to Mention

- Start with the design problem.
- Match pattern to intent.
- Avoid pattern-first thinking.
- Consider simplicity.
- Consider testability.
- Consider future change.
- Explain trade-offs.
- Prefer pragmatic design over textbook purity.

<!-- question:end:factory-builder-strategy-adapter-decorator-facade-proxy-and-chain-of-responsibility-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
