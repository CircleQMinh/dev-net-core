---
id: observer-style-communication-in-csharp
topic: Modern C# patterns
subtopic: Observer-Style Communication in C#
category: .NET
---


## Overview

Observer-style communication is a design approach where one object publishes a notification and one or more other objects react to it without the publisher needing to know exactly who the subscribers are. In C#, this is commonly implemented with events, delegates, `EventHandler<TEventArgs>`, `INotifyPropertyChanged`, `IObservable<T>`, `IObserver<T>`, mediator-style messaging, or domain events.

The core idea is simple: instead of one component directly calling many other components, it exposes a notification mechanism. Interested components subscribe, and the publisher raises a notification when something important happens.

This matters because real applications often need loosely coupled communication. A button click should notify UI code. A view model should notify the UI when a property changes. A domain entity may record that an order was placed. A background service may publish progress updates. A cache may notify listeners when data changes. Observer-style communication helps separate the component that detects a change from the components that respond to that change.

For interviews, this topic is important because it tests both language knowledge and design judgment. A strong candidate should understand how C# events work, how the observer design pattern works, when to use `IObservable<T>`, how to avoid memory leaks caused by event subscriptions, and how observer-style communication compares with direct method calls, callbacks, mediator patterns, message queues, and pub/sub systems.

## Core Concepts

### What Observer-Style Communication Means

Observer-style communication is based on two roles:

- **Publisher, subject, provider, or observable**: the object that owns some state or detects an event.
- **Subscriber, observer, listener, or handler**: the object that wants to be notified when something happens.

The publisher does not need to know the concrete subscriber types. It only needs to provide a way for subscribers to register and unregister.

A simple real-world example is a notification system:

```csharp
public sealed class OrderService
{
    public event EventHandler<OrderPlacedEventArgs>? OrderPlaced;

    public void PlaceOrder(int orderId)
    {
        // Save order, validate business rules, update database, etc.

        OrderPlaced?.Invoke(this, new OrderPlacedEventArgs(orderId));
    }
}

public sealed class OrderPlacedEventArgs : EventArgs
{
    public OrderPlacedEventArgs(int orderId)
    {
        OrderId = orderId;
    }

    public int OrderId { get; }
}
```

A subscriber can react to the event:

```csharp
var orderService = new OrderService();

orderService.OrderPlaced += (sender, args) =>
{
    Console.WriteLine($"Order placed: {args.OrderId}");
};

orderService.PlaceOrder(123);
```

The `OrderService` does not know whether the subscriber logs to console, sends an email, updates a dashboard, or triggers another workflow.

### Why This Pattern Is Useful

Observer-style communication is useful when one action should trigger multiple independent reactions.

Common examples include:

- UI events such as button clicks, text changes, and form submissions.
- View model updates through `INotifyPropertyChanged`.
- Domain events such as `OrderPlaced`, `PaymentCaptured`, or `UserRegistered`.
- Progress notifications from background tasks.
- Cache invalidation notifications.
- Real-time data updates.
- Event-driven architecture inside an application.
- Reactive streams using `IObservable<T>`.
- Decoupling application services from side effects.

Without observer-style communication, a publisher often becomes tightly coupled to every component that needs to react:

```csharp
public void PlaceOrder(int orderId)
{
    SaveOrder(orderId);

    _emailService.SendOrderConfirmation(orderId);
    _auditService.LogOrderPlaced(orderId);
    _inventoryService.ReserveStock(orderId);
    _notificationService.PushOrderUpdate(orderId);
}
```

This can be acceptable for simple workflows, but it becomes harder to maintain when many independent actions must occur after the same event.

With observer-style communication, the publisher can focus on publishing the event, while subscribers own their own reactions.

### C# Events and Delegates

In C#, events are the most common built-in mechanism for observer-style communication.

An event is based on a delegate. A delegate represents a method signature. An event stores a list of subscribed handlers that match that delegate signature.

A custom delegate example:

```csharp
public delegate void TemperatureChangedHandler(decimal newTemperature);

public sealed class Thermostat
{
    public event TemperatureChangedHandler? TemperatureChanged;

    public void SetTemperature(decimal value)
    {
        TemperatureChanged?.Invoke(value);
    }
}
```

The more common .NET style is to use `EventHandler` or `EventHandler<TEventArgs>`:

```csharp
public sealed class TemperatureChangedEventArgs : EventArgs
{
    public TemperatureChangedEventArgs(decimal temperature)
    {
        Temperature = temperature;
    }

    public decimal Temperature { get; }
}

public sealed class Thermostat
{
    public event EventHandler<TemperatureChangedEventArgs>? TemperatureChanged;

    public void SetTemperature(decimal value)
    {
        TemperatureChanged?.Invoke(this, new TemperatureChangedEventArgs(value));
    }
}
```

`EventHandler<TEventArgs>` is usually preferred because it follows .NET conventions:

```csharp
void Handler(object? sender, TemperatureChangedEventArgs args)
{
    Console.WriteLine(args.Temperature);
}
```

The `sender` identifies the publisher, and the event args object carries event data.

### How Event Subscription Works

Subscribers use `+=` to subscribe and `-=` to unsubscribe:

```csharp
var thermostat = new Thermostat();

void OnTemperatureChanged(object? sender, TemperatureChangedEventArgs args)
{
    Console.WriteLine($"Temperature: {args.Temperature}");
}

thermostat.TemperatureChanged += OnTemperatureChanged;
thermostat.SetTemperature(25);

thermostat.TemperatureChanged -= OnTemperatureChanged;
```

This matters because event subscriptions create references. If a long-lived publisher holds an event handler reference to a short-lived subscriber, the subscriber may stay alive longer than expected.

This is one of the most important practical issues in interviews.

### Event Access Rules

An event can usually be raised only from inside the class that declares it.

```csharp
public sealed class Publisher
{
    public event EventHandler? SomethingHappened;

    public void DoWork()
    {
        SomethingHappened?.Invoke(this, EventArgs.Empty);
    }
}
```

External code can subscribe or unsubscribe:

```csharp
publisher.SomethingHappened += Handler;
publisher.SomethingHappened -= Handler;
```

But external code cannot directly invoke the event:

```csharp
// Not allowed from outside Publisher:
// publisher.SomethingHappened?.Invoke(publisher, EventArgs.Empty);
```

This protects the publisher from external code incorrectly raising its events.

### Standard Event Pattern

The standard .NET event pattern uses:

- An event named after what happened.
- `EventHandler` when no custom data is needed.
- `EventHandler<TEventArgs>` when event data is needed.
- A protected virtual method named `OnEventName` in inheritable classes.

Example:

```csharp
public sealed class FileProcessor
{
    public event EventHandler<FileProcessedEventArgs>? FileProcessed;

    public void Process(string fileName)
    {
        // Process the file.

        OnFileProcessed(new FileProcessedEventArgs(fileName));
    }

    private void OnFileProcessed(FileProcessedEventArgs args)
    {
        FileProcessed?.Invoke(this, args);
    }
}

public sealed class FileProcessedEventArgs : EventArgs
{
    public FileProcessedEventArgs(string fileName)
    {
        FileName = fileName;
    }

    public string FileName { get; }
}
```

For inheritable classes, `OnEventName` is often `protected virtual`:

```csharp
public class FileProcessor
{
    public event EventHandler<FileProcessedEventArgs>? FileProcessed;

    protected virtual void OnFileProcessed(FileProcessedEventArgs args)
    {
        FileProcessed?.Invoke(this, args);
    }
}
```

This allows derived classes to customize event raising behavior.

### EventHandler vs Custom Delegate

A custom delegate is useful when the event shape does not match the standard .NET event pattern, but most application code should use `EventHandler<TEventArgs>`.

Custom delegate:

```csharp
public delegate void MessageReceivedHandler(string message);
```

Standard event style:

```csharp
public event EventHandler<MessageReceivedEventArgs>? MessageReceived;
```

The standard event style is usually better because it is familiar, consistent with .NET libraries, and easier for other developers to understand.

### `INotifyPropertyChanged`

`INotifyPropertyChanged` is a common observer-style interface used heavily in UI frameworks and data binding. It allows an object to notify listeners when one of its properties changes.

```csharp
using System.ComponentModel;
using System.Runtime.CompilerServices;

public sealed class CustomerViewModel : INotifyPropertyChanged
{
    private string _name = string.Empty;

    public event PropertyChangedEventHandler? PropertyChanged;

    public string Name
    {
        get => _name;
        set
        {
            if (_name == value)
            {
                return;
            }

            _name = value;
            OnPropertyChanged();
        }
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
```

Key points:

- The UI subscribes to `PropertyChanged`.
- The view model raises the event when a property changes.
- `CallerMemberName` avoids hardcoding property names.
- The setter checks whether the value actually changed before raising the event.

This pattern is important in WPF, MAUI, WinUI, and MVVM-style applications.

### `IObservable<T>` and `IObserver<T>`

C# events are common for simple notifications. For more formal observer-style communication, .NET provides `IObservable<T>` and `IObserver<T>`.

`IObservable<T>` represents a provider of notifications:

```csharp
public interface IObservable<out T>
{
    IDisposable Subscribe(IObserver<T> observer);
}
```

`IObserver<T>` represents a subscriber:

```csharp
public interface IObserver<in T>
{
    void OnNext(T value);
    void OnError(Exception error);
    void OnCompleted();
}
```

The three observer methods mean:

- `OnNext`: new data is available.
- `OnError`: the stream failed.
- `OnCompleted`: the stream ended successfully.

A simple observable implementation:

```csharp
public sealed class PriceFeed : IObservable<decimal>
{
    private readonly List<IObserver<decimal>> _observers = new();

    public IDisposable Subscribe(IObserver<decimal> observer)
    {
        if (!_observers.Contains(observer))
        {
            _observers.Add(observer);
        }

        return new Unsubscriber(_observers, observer);
    }

    public void Publish(decimal price)
    {
        foreach (var observer in _observers.ToArray())
        {
            observer.OnNext(price);
        }
    }

    public void Complete()
    {
        foreach (var observer in _observers.ToArray())
        {
            observer.OnCompleted();
        }

        _observers.Clear();
    }

    private sealed class Unsubscriber : IDisposable
    {
        private readonly List<IObserver<decimal>> _observers;
        private readonly IObserver<decimal> _observer;

        public Unsubscriber(List<IObserver<decimal>> observers, IObserver<decimal> observer)
        {
            _observers = observers;
            _observer = observer;
        }

        public void Dispose()
        {
            _observers.Remove(_observer);
        }
    }
}
```

An observer implementation:

```csharp
public sealed class PriceLogger : IObserver<decimal>
{
    public void OnNext(decimal value)
    {
        Console.WriteLine($"New price: {value}");
    }

    public void OnError(Exception error)
    {
        Console.WriteLine($"Error: {error.Message}");
    }

    public void OnCompleted()
    {
        Console.WriteLine("Price feed completed.");
    }
}
```

Usage:

```csharp
var feed = new PriceFeed();
var logger = new PriceLogger();

using IDisposable subscription = feed.Subscribe(logger);

feed.Publish(100.25m);
feed.Publish(101.10m);
feed.Complete();
```

`IObservable<T>` is especially useful when notifications form a stream of values over time.

### Events vs `IObservable<T>`

Both events and `IObservable<T>` support observer-style communication, but they are used differently.

| Feature | C# Events | `IObservable<T>` |
|---|---|---|
| Common use | Simple object notifications | Streams of data over time |
| Subscription | `+=` and `-=` | `Subscribe()` returns `IDisposable` |
| Completion signal | Not built in | `OnCompleted()` |
| Error signal | Not built in | `OnError(Exception)` |
| Data model | Individual event occurrence | Push-based sequence |
| Typical examples | Button click, property changed, file processed | Price feed, sensor stream, reactive pipelines |
| Complexity | Lower | Higher |
| Interview focus | Delegates, event patterns, memory leaks | Observer pattern, streams, disposal, reactive thinking |

Use events when the notification is simple and local. Use `IObservable<T>` when subscribers consume a stream, need completion/error semantics, or when reactive-style operators are useful.

### Events vs Direct Method Calls

Direct method calls are simple and explicit:

```csharp
_emailService.SendOrderConfirmation(orderId);
```

Observer-style communication is more flexible:

```csharp
OrderPlaced?.Invoke(this, new OrderPlacedEventArgs(orderId));
```

Direct calls are better when:

- The dependency is required.
- The action is part of the core use case.
- Failure should directly affect the operation.
- The workflow must be easy to trace.

Observer-style communication is better when:

- Multiple independent components may react.
- The publisher should not know the subscriber details.
- Subscribers may change over time.
- The reaction is a side effect, extension point, or notification.

A common mistake is overusing events for business workflows that should be explicit. Loose coupling should not make important behavior invisible.

### Events vs Callbacks

A callback is usually a method or delegate passed directly into another method:

```csharp
public void Download(string url, Action<int> onProgress)
{
    for (int progress = 0; progress <= 100; progress += 10)
    {
        onProgress(progress);
    }
}
```

Usage:

```csharp
Download("https://example.com/file.zip", progress =>
{
    Console.WriteLine($"Progress: {progress}%");
});
```

Callbacks are useful for one-off behavior. Events are better when multiple subscribers may listen over a longer lifetime.

| Feature | Callback | Event |
|---|---|---|
| Subscription lifetime | Usually temporary | Usually longer-lived |
| Number of subscribers | Usually one | Usually many |
| Ownership | Passed by caller | Exposed by publisher |
| Common use | Completion callback, progress callback | UI events, state changes, notifications |

### Events vs Mediator and Pub/Sub

Observer-style events are usually in-process. They happen inside the same application memory space.

Mediator-style communication uses a mediator object to route messages between senders and handlers. This is common in CQRS architectures.

Example concept:

```csharp
public sealed record OrderPlacedNotification(int OrderId);
```

A handler might process the notification:

```csharp
public sealed class SendOrderEmailHandler
{
    public Task Handle(OrderPlacedNotification notification, CancellationToken cancellationToken)
    {
        // Send email.
        return Task.CompletedTask;
    }
}
```

Pub/sub systems, such as message brokers, are usually out-of-process. They support communication between services.

| Approach | Scope | Common Use |
|---|---|---|
| C# event | Same object/app | UI and local notifications |
| `IObservable<T>` | Same app | Streams of values |
| Mediator | Same app | Application/domain notifications |
| Message broker | Across processes/services | Distributed event-driven architecture |

A strong interview answer should mention that C# events are not a replacement for durable messaging. If a process crashes, an in-memory event is lost. For cross-service communication, use a message broker or event bus.

### Memory Leaks from Event Subscriptions

One of the most common mistakes with C# events is forgetting to unsubscribe.

Example problem:

```csharp
public sealed class DashboardWidget
{
    public DashboardWidget(OrderService orderService)
    {
        orderService.OrderPlaced += OnOrderPlaced;
    }

    private void OnOrderPlaced(object? sender, OrderPlacedEventArgs args)
    {
        // Update widget.
    }
}
```

If `OrderService` lives for the entire application lifetime and `DashboardWidget` is temporary, the event subscription can keep `DashboardWidget` alive.

Better:

```csharp
public sealed class DashboardWidget : IDisposable
{
    private readonly OrderService _orderService;

    public DashboardWidget(OrderService orderService)
    {
        _orderService = orderService;
        _orderService.OrderPlaced += OnOrderPlaced;
    }

    private void OnOrderPlaced(object? sender, OrderPlacedEventArgs args)
    {
        // Update widget.
    }

    public void Dispose()
    {
        _orderService.OrderPlaced -= OnOrderPlaced;
    }
}
```

Important habit:

- If you subscribe to an event on a longer-lived object, unsubscribe when the subscriber is disposed.
- If publisher and subscriber have the same lifetime, explicit unsubscription may be less critical.
- Avoid anonymous event handlers when you need to unsubscribe later.

Problematic:

```csharp
orderService.OrderPlaced += (sender, args) =>
{
    Console.WriteLine(args.OrderId);
};

// Hard to unsubscribe because the delegate instance is not stored.
```

Better:

```csharp
EventHandler<OrderPlacedEventArgs> handler = (sender, args) =>
{
    Console.WriteLine(args.OrderId);
};

orderService.OrderPlaced += handler;
orderService.OrderPlaced -= handler;
```

### Weak Event Pattern

A weak event pattern avoids keeping the subscriber alive only because it subscribed to an event. This is especially relevant in UI frameworks where a long-lived event source can accidentally retain many short-lived UI objects.

A weak event uses a weak reference to the subscriber instead of a strong reference. This allows the subscriber to be garbage collected if nothing else references it.

In most everyday C# backend code, explicit unsubscription is easier and clearer. Weak events are more common in UI frameworks, component libraries, and advanced infrastructure code.

### Thread Safety

Events and observer lists can create thread-safety problems.

For example, a subscriber may unsubscribe while the publisher is notifying subscribers. A common defensive approach is to copy the event delegate before invocation:

```csharp
var handler = SomethingHappened;
handler?.Invoke(this, EventArgs.Empty);
```

Modern C# code often uses:

```csharp
SomethingHappened?.Invoke(this, EventArgs.Empty);
```

For custom observer lists, snapshot the list before iterating:

```csharp
foreach (var observer in _observers.ToArray())
{
    observer.OnNext(value);
}
```

If multiple threads can subscribe, unsubscribe, and publish at the same time, protect the list with a lock or use an appropriate concurrent design.

Example:

```csharp
private readonly object _gate = new();
private readonly List<IObserver<decimal>> _observers = new();

public IDisposable Subscribe(IObserver<decimal> observer)
{
    lock (_gate)
    {
        _observers.Add(observer);
    }

    return new Unsubscriber(this, observer);
}

public void Publish(decimal value)
{
    IObserver<decimal>[] snapshot;

    lock (_gate)
    {
        snapshot = _observers.ToArray();
    }

    foreach (var observer in snapshot)
    {
        observer.OnNext(value);
    }
}
```

Thread safety is important in background services, UI applications, real-time updates, and server-side applications.

### Exception Handling

When an event has multiple subscribers, one subscriber throwing an exception can prevent later subscribers from running.

Example:

```csharp
public event EventHandler? SomethingHappened;

public void Raise()
{
    SomethingHappened?.Invoke(this, EventArgs.Empty);
}
```

If the first handler throws, the second handler may not execute.

If each subscriber should be isolated, you can manually invoke the invocation list:

```csharp
public void RaiseSafely()
{
    var handlers = SomethingHappened?.GetInvocationList();

    if (handlers is null)
    {
        return;
    }

    foreach (EventHandler handler in handlers)
    {
        try
        {
            handler(this, EventArgs.Empty);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Handler failed: {ex.Message}");
        }
    }
}
```

This is not always the right choice. Sometimes an exception should stop the operation. The important interview point is that event exception behavior should be deliberate.

### Async Event Handlers

C# events are traditionally synchronous. If an event handler is `async void`, exceptions can be hard to handle.

Example:

```csharp
button.Click += async (sender, args) =>
{
    await SaveAsync();
};
```

`async void` is common and acceptable for UI event handlers, but should generally be avoided in business logic.

For application-level async notifications, prefer explicit async methods, mediator notifications, channels, background queues, or custom async event patterns.

Example of an explicit async notification approach:

```csharp
public interface IOrderPlacedHandler
{
    Task HandleAsync(OrderPlacedEvent notification, CancellationToken cancellationToken);
}

public sealed record OrderPlacedEvent(int OrderId);
```

This is often easier to test and reason about than many `async void` event handlers.

### Domain Events

Domain events are a design pattern used in domain-driven design. A domain event represents something important that happened in the business domain.

Examples:

- `OrderPlaced`
- `PaymentReceived`
- `PolicyRenewed`
- `CustomerRegistered`
- `InvoiceGenerated`

A simple domain event:

```csharp
public interface IDomainEvent
{
    DateTime OccurredOnUtc { get; }
}

public sealed record OrderPlacedDomainEvent(
    int OrderId,
    DateTime OccurredOnUtc) : IDomainEvent;
```

An entity may collect domain events:

```csharp
public sealed class Order
{
    private readonly List<IDomainEvent> _domainEvents = new();

    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    public int Id { get; private set; }

    public void Place()
    {
        // Business logic.

        _domainEvents.Add(new OrderPlacedDomainEvent(Id, DateTime.UtcNow));
    }

    public void ClearDomainEvents()
    {
        _domainEvents.Clear();
    }
}
```

Domain events are not the same as C# events. They are usually stored as data objects and dispatched by application infrastructure after the business operation succeeds.

This is often better for Clean Architecture because domain entities stay independent from infrastructure concerns.

### Observer-Style Communication in ASP.NET Core

In ASP.NET Core backend applications, C# events are less common for request workflows because web requests are short-lived and dependency lifetimes matter.

Common backend alternatives include:

- Direct service calls for required behavior.
- MediatR notifications or similar mediator patterns for in-process notifications.
- Background queues for asynchronous processing.
- Message brokers for cross-service communication.
- Domain events for business-significant changes.
- SignalR for real-time client notifications.

Example use cases:

| Scenario | Better Choice |
|---|---|
| Button click in UI | C# event |
| View model property update | `INotifyPropertyChanged` |
| Background progress stream | `IObservable<T>` or channel |
| Required business step | Direct service call |
| Domain state change | Domain event |
| Cross-service notification | Message broker |
| Real-time browser update | SignalR |
| CQRS notification handlers | Mediator notification |

### Common Mistakes

Common mistakes include:

- Using events when a direct method call would be clearer.
- Forgetting to unsubscribe from long-lived publishers.
- Using anonymous handlers when later unsubscription is required.
- Putting critical hidden business logic in event handlers.
- Not considering exception behavior across multiple handlers.
- Assuming event handlers run asynchronously.
- Raising events before state is fully updated.
- Modifying the subscriber list while iterating over it.
- Creating custom observer infrastructure without thread-safety.
- Using in-memory events for cross-service communication.
- Exposing mutable event data that subscribers can accidentally change.
- Ignoring cancellation and error handling in async workflows.

### Best Practices

Good habits include:

- Use `EventHandler` or `EventHandler<TEventArgs>` for normal .NET events.
- Name events after something that happened, such as `OrderPlaced`, not `PlaceOrder`.
- Use immutable event data when possible.
- Raise events after the publisher reaches a consistent state.
- Keep event handlers small and focused.
- Unsubscribe from longer-lived publishers.
- Implement `IDisposable` when an object owns event subscriptions that must be released.
- Prefer explicit service calls for required business behavior.
- Prefer domain events or mediator notifications for application-level business events.
- Prefer message brokers for distributed communication.
- Consider thread safety when events can be raised from multiple threads.
- Consider exception isolation if one bad subscriber should not block others.
- Avoid `async void` except for UI event handlers.
- Use `IObservable<T>` when modeling streams of values over time.
- Avoid overengineering simple code with unnecessary observer abstractions.

### Practical Example: Event-Based Notification

```csharp
public sealed class PaymentService
{
    public event EventHandler<PaymentCompletedEventArgs>? PaymentCompleted;

    public void CompletePayment(int paymentId, decimal amount)
    {
        // Validate and persist payment.

        PaymentCompleted?.Invoke(
            this,
            new PaymentCompletedEventArgs(paymentId, amount));
    }
}

public sealed class PaymentCompletedEventArgs : EventArgs
{
    public PaymentCompletedEventArgs(int paymentId, decimal amount)
    {
        PaymentId = paymentId;
        Amount = amount;
    }

    public int PaymentId { get; }
    public decimal Amount { get; }
}
```

Subscriber:

```csharp
public sealed class ReceiptEmailSender : IDisposable
{
    private readonly PaymentService _paymentService;

    public ReceiptEmailSender(PaymentService paymentService)
    {
        _paymentService = paymentService;
        _paymentService.PaymentCompleted += OnPaymentCompleted;
    }

    private void OnPaymentCompleted(object? sender, PaymentCompletedEventArgs args)
    {
        Console.WriteLine($"Send receipt for payment {args.PaymentId}");
    }

    public void Dispose()
    {
        _paymentService.PaymentCompleted -= OnPaymentCompleted;
    }
}
```

This is simple and useful when everything runs in the same process.

### Practical Example: Domain Event Instead of C# Event

```csharp
public sealed record PaymentCompletedDomainEvent(
    int PaymentId,
    decimal Amount,
    DateTime OccurredOnUtc);

public sealed class Payment
{
    private readonly List<PaymentCompletedDomainEvent> _events = new();

    public IReadOnlyCollection<PaymentCompletedDomainEvent> Events => _events;

    public int Id { get; private set; }
    public decimal Amount { get; private set; }
    public bool IsCompleted { get; private set; }

    public void Complete()
    {
        if (IsCompleted)
        {
            return;
        }

        IsCompleted = true;

        _events.Add(new PaymentCompletedDomainEvent(
            Id,
            Amount,
            DateTime.UtcNow));
    }
}
```

This approach is often better in business applications because the event is represented as data. Application infrastructure can dispatch it after saving changes.

### Practical Example: `IObservable<T>` Stream

```csharp
public sealed class ProgressObserver : IObserver<int>
{
    public void OnNext(int value)
    {
        Console.WriteLine($"Progress: {value}%");
    }

    public void OnError(Exception error)
    {
        Console.WriteLine($"Failed: {error.Message}");
    }

    public void OnCompleted()
    {
        Console.WriteLine("Completed.");
    }
}
```

A stream-like provider can push multiple values over time:

```csharp
public sealed class ProgressReporter : IObservable<int>
{
    private readonly List<IObserver<int>> _observers = new();

    public IDisposable Subscribe(IObserver<int> observer)
    {
        _observers.Add(observer);
        return new Subscription(_observers, observer);
    }

    public void Report(int progress)
    {
        foreach (var observer in _observers.ToArray())
        {
            observer.OnNext(progress);
        }
    }

    public void Complete()
    {
        foreach (var observer in _observers.ToArray())
        {
            observer.OnCompleted();
        }
    }

    private sealed class Subscription : IDisposable
    {
        private readonly List<IObserver<int>> _observers;
        private readonly IObserver<int> _observer;

        public Subscription(List<IObserver<int>> observers, IObserver<int> observer)
        {
            _observers = observers;
            _observer = observer;
        }

        public void Dispose()
        {
            _observers.Remove(_observer);
        }
    }
}
```

Usage:

```csharp
var reporter = new ProgressReporter();
var observer = new ProgressObserver();

using var subscription = reporter.Subscribe(observer);

reporter.Report(10);
reporter.Report(50);
reporter.Report(100);
reporter.Complete();
```

### Interview Decision Guide

A good decision process is:

1. Use a direct method call if the dependency is required and part of the main workflow.
2. Use a C# event for simple local notifications.
3. Use `INotifyPropertyChanged` for property change notifications in data binding.
4. Use `IObservable<T>` for streams of values over time.
5. Use domain events for business-significant changes inside the domain model.
6. Use mediator notifications for in-process application events.
7. Use message brokers for cross-service or durable event-driven communication.
8. Use SignalR when server-side events must be pushed to connected clients.

The best choice depends on lifetime, coupling, reliability, threading, error handling, and whether the communication is in-process or distributed.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:observer-style-communication-in-csharp-beginner-q01 -->
<!-- question-id:observer-style-communication-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->
#### What is observer-style communication in C#?

##### Expected Answer

Observer-style communication is a way for one object to notify other objects when something happens without directly depending on their concrete types. The object that sends the notification is often called the publisher, subject, provider, or observable. The objects that receive notifications are called subscribers, observers, or listeners.

In C#, this is commonly implemented with events and delegates. A publisher exposes an event, subscribers attach handlers to that event, and the publisher raises the event when something important happens.

Example:

```csharp
public event EventHandler? SomethingHappened;
```

When the event is raised, all subscribed handlers are invoked.

This pattern helps reduce tight coupling because the publisher does not need to know every component that reacts to the event.

##### Key Points to Mention

- Publisher sends notifications.
- Subscribers register handlers.
- The publisher does not need concrete subscriber dependencies.
- C# events are the most common implementation.
- Useful for UI events, property changes, and local notifications.
<!-- question:end:observer-style-communication-in-csharp-beginner-q01 -->

<!-- question:start:observer-style-communication-in-csharp-beginner-q02 -->
<!-- question-id:observer-style-communication-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->
#### What is a C# event?

##### Expected Answer

A C# event is a class or struct member that allows other code to subscribe to notifications. It is based on a delegate type, which defines the method signature that subscribers must match.

Example:

```csharp
public event EventHandler<OrderPlacedEventArgs>? OrderPlaced;
```

Subscribers attach handlers using `+=` and detach using `-=`:

```csharp
orderService.OrderPlaced += OnOrderPlaced;
orderService.OrderPlaced -= OnOrderPlaced;
```

The publisher raises the event by invoking it:

```csharp
OrderPlaced?.Invoke(this, new OrderPlacedEventArgs(orderId));
```

Events are useful because they support multicast notification. Multiple subscribers can listen to the same event.

##### Key Points to Mention

- Events are based on delegates.
- Subscribers use `+=` and `-=`.
- Multiple handlers can subscribe.
- Events are usually raised by the declaring class.
- `EventHandler<TEventArgs>` is the standard .NET pattern.
<!-- question:end:observer-style-communication-in-csharp-beginner-q02 -->

<!-- question:start:observer-style-communication-in-csharp-beginner-q03 -->
<!-- question-id:observer-style-communication-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->
#### What is the difference between a delegate and an event?

##### Expected Answer

A delegate is a type that represents a reference to a method with a specific signature. An event is a restricted wrapper around a delegate that exposes subscription and unsubscription but protects invocation.

With a public delegate field, external code could replace the delegate or invoke it directly. With an event, external code can usually only subscribe or unsubscribe. Only the declaring class can raise the event.

Example:

```csharp
public delegate void MyHandler();

public event MyHandler? SomethingHappened;
```

The delegate defines the shape of the handler. The event exposes a safe notification mechanism based on that delegate.

##### Key Points to Mention

- A delegate defines a method signature.
- An event uses a delegate internally.
- Events restrict external access.
- External code can subscribe/unsubscribe but not normally invoke the event.
- Events are safer for publisher-subscriber communication.
<!-- question:end:observer-style-communication-in-csharp-beginner-q03 -->

<!-- question:start:observer-style-communication-in-csharp-beginner-q04 -->
<!-- question-id:observer-style-communication-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->
#### What is `EventHandler<TEventArgs>` used for?

##### Expected Answer

`EventHandler<TEventArgs>` is the standard .NET delegate type for events that need to pass data to subscribers. It has a consistent method shape:

```csharp
void Handler(object? sender, TEventArgs args)
```

The `sender` parameter identifies the object that raised the event. The `args` parameter contains event-specific data.

Example:

```csharp
public event EventHandler<FileProcessedEventArgs>? FileProcessed;
```

This is preferred over creating custom delegate types in most cases because it follows .NET conventions and is easy for other developers to understand.

##### Key Points to Mention

- Standard .NET event delegate type.
- Uses `sender` and event args.
- Good for consistency and readability.
- Prefer it for most custom events.
- Use `EventHandler` when no custom event data is needed.
<!-- question:end:observer-style-communication-in-csharp-beginner-q04 -->

<!-- question:start:observer-style-communication-in-csharp-beginner-q05 -->
<!-- question-id:observer-style-communication-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->
#### How do you subscribe and unsubscribe from an event?

##### Expected Answer

Use `+=` to subscribe and `-=` to unsubscribe.

```csharp
publisher.SomethingHappened += OnSomethingHappened;
publisher.SomethingHappened -= OnSomethingHappened;
```

The handler method must match the event delegate signature.

```csharp
private void OnSomethingHappened(object? sender, EventArgs args)
{
    Console.WriteLine("Something happened.");
}
```

Unsubscribing is important when the publisher lives longer than the subscriber. Otherwise, the publisher may keep the subscriber alive through the event handler reference.

##### Key Points to Mention

- Use `+=` to subscribe.
- Use `-=` to unsubscribe.
- Handler signature must match the event delegate.
- Unsubscribe from long-lived publishers.
- Forgetting to unsubscribe can cause memory leaks.
<!-- question:end:observer-style-communication-in-csharp-beginner-q05 -->

<!-- question:start:observer-style-communication-in-csharp-beginner-q06 -->
<!-- question-id:observer-style-communication-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->
#### What is `INotifyPropertyChanged`?

##### Expected Answer

`INotifyPropertyChanged` is an interface used to notify listeners that a property value has changed. It is commonly used in UI data binding and MVVM applications.

It exposes one event:

```csharp
public event PropertyChangedEventHandler? PropertyChanged;
```

A view model raises this event when a property changes:

```csharp
PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Name)));
```

This allows the UI to update automatically when the underlying data changes.

##### Key Points to Mention

- Used for property change notifications.
- Common in WPF, MAUI, WinUI, and MVVM.
- Exposes `PropertyChanged`.
- Usually raised from property setters.
- `CallerMemberName` helps avoid hardcoded property names.
<!-- question:end:observer-style-communication-in-csharp-beginner-q06 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:observer-style-communication-in-csharp-intermediate-q01 -->
<!-- question-id:observer-style-communication-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->
#### What problem does the observer pattern solve?

##### Expected Answer

The observer pattern solves the problem of notifying multiple dependent objects about a change without tightly coupling the publisher to each subscriber.

Without the pattern, the publisher may need direct dependencies on every component that reacts to a change. That makes the publisher harder to test and maintain.

With observer-style communication, subscribers register interest, and the publisher simply sends a notification. This supports loose coupling and extensibility.

Example use cases include UI events, view model property changes, progress updates, domain events, and plugin-style extension points.

##### Key Points to Mention

- Reduces tight coupling.
- Supports one-to-many notification.
- Lets subscribers be added or removed independently.
- Useful when reactions are optional or extensible.
- Should not hide required business workflow steps.
<!-- question:end:observer-style-communication-in-csharp-intermediate-q01 -->

<!-- question:start:observer-style-communication-in-csharp-intermediate-q02 -->
<!-- question-id:observer-style-communication-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->
#### When should you use events instead of direct method calls?

##### Expected Answer

Use events when a publisher needs to notify one or more optional subscribers that something happened, and the publisher should not directly depend on those subscribers.

Use direct method calls when the behavior is required, part of the main workflow, or must be easy to trace and control.

For example, if placing an order must reserve inventory, a direct service call may be clearer. If placing an order should also notify optional listeners such as audit logging or dashboard updates, an event or domain notification may be appropriate.

Events are good for local notifications, but they should not be used to hide critical business logic.

##### Key Points to Mention

- Events are good for optional local notifications.
- Direct calls are better for required workflow steps.
- Events reduce coupling but can reduce traceability.
- Avoid hiding important business behavior in event handlers.
- Consider mediator or domain events for application-level notifications.
<!-- question:end:observer-style-communication-in-csharp-intermediate-q02 -->

<!-- question:start:observer-style-communication-in-csharp-intermediate-q03 -->
<!-- question-id:observer-style-communication-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->
#### How can event subscriptions cause memory leaks?

##### Expected Answer

An event subscription creates a reference from the publisher to the subscriber's handler. If the publisher lives longer than the subscriber, the subscriber may not be garbage collected because the publisher still holds a reference to it.

Example:

```csharp
public DashboardWidget(OrderService orderService)
{
    orderService.OrderPlaced += OnOrderPlaced;
}
```

If `OrderService` is a singleton and `DashboardWidget` is temporary, the widget can be retained in memory unless it unsubscribes.

The usual fix is to unsubscribe when the subscriber is disposed:

```csharp
public void Dispose()
{
    _orderService.OrderPlaced -= OnOrderPlaced;
}
```

##### Key Points to Mention

- Event publishers hold references to subscribed handlers.
- Long-lived publishers can keep short-lived subscribers alive.
- This can cause memory leaks.
- Implement `IDisposable` when needed.
- Avoid anonymous handlers if you need to unsubscribe later.
<!-- question:end:observer-style-communication-in-csharp-intermediate-q03 -->

<!-- question:start:observer-style-communication-in-csharp-intermediate-q04 -->
<!-- question-id:observer-style-communication-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->
#### What is the difference between C# events and `IObservable<T>`?

##### Expected Answer

C# events are best for simple local notifications. They use delegates and the `+=` / `-=` subscription model.

`IObservable<T>` represents a push-based stream of values over time. Subscribers implement `IObserver<T>` and receive `OnNext`, `OnError`, and `OnCompleted` calls. Subscription returns an `IDisposable`, which is used to unsubscribe.

Events do not have built-in completion or error signaling. `IObservable<T>` does.

Use events for simple cases such as button clicks and object state changes. Use `IObservable<T>` when modeling streams, reactive pipelines, or sequences of values.

##### Key Points to Mention

- Events are simpler.
- `IObservable<T>` models streams.
- `IObservable<T>` supports `OnNext`, `OnError`, and `OnCompleted`.
- `Subscribe()` returns `IDisposable`.
- Use the simplest abstraction that fits the problem.
<!-- question:end:observer-style-communication-in-csharp-intermediate-q04 -->

<!-- question:start:observer-style-communication-in-csharp-intermediate-q05 -->
<!-- question-id:observer-style-communication-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->
#### What happens if one event handler throws an exception?

##### Expected Answer

When a normal multicast event is invoked, handlers are called in order. If one handler throws an exception, the invocation stops and later handlers may not run. The exception propagates to the code that raised the event.

If each handler should be isolated, the publisher can manually iterate through the invocation list and handle exceptions per subscriber.

Example:

```csharp
foreach (EventHandler handler in SomethingHappened?.GetInvocationList() ?? [])
{
    try
    {
        handler(this, EventArgs.Empty);
    }
    catch (Exception ex)
    {
        // Log and continue.
    }
}
```

This should be a deliberate design choice. Sometimes stopping on the first failure is correct.

##### Key Points to Mention

- Events are synchronous by default.
- One failing handler can prevent later handlers from running.
- Exceptions propagate to the publisher.
- Use invocation list handling if subscribers should be isolated.
- Decide exception behavior based on business requirements.
<!-- question:end:observer-style-communication-in-csharp-intermediate-q05 -->

<!-- question:start:observer-style-communication-in-csharp-intermediate-q06 -->
<!-- question-id:observer-style-communication-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->
#### Are C# events asynchronous?

##### Expected Answer

No. C# events are synchronous by default. When the publisher invokes an event, handlers run on the same thread unless the handler or publisher explicitly starts asynchronous work.

An `async` lambda can be attached to an event, but for standard event signatures it often becomes `async void`. This is acceptable for UI event handlers but should generally be avoided in business logic because exceptions and completion are harder to control.

For application-level asynchronous workflows, prefer explicit `Task`-returning methods, mediator handlers, background queues, channels, or message brokers.

##### Key Points to Mention

- Events are synchronous by default.
- Handlers run on the raising thread unless explicitly changed.
- `async void` is risky outside UI event handlers.
- Use `Task`-based abstractions for async business workflows.
- Do not assume event handlers run in parallel.
<!-- question:end:observer-style-communication-in-csharp-intermediate-q06 -->

<!-- question:start:observer-style-communication-in-csharp-intermediate-q07 -->
<!-- question-id:observer-style-communication-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->
#### How do you make observer-style communication thread-safe?

##### Expected Answer

Thread safety depends on whether multiple threads can subscribe, unsubscribe, and publish at the same time.

For C# events, use safe invocation:

```csharp
SomethingHappened?.Invoke(this, EventArgs.Empty);
```

For custom observer lists, avoid iterating over a list that can be modified at the same time. Take a snapshot before notifying:

```csharp
foreach (var observer in _observers.ToArray())
{
    observer.OnNext(value);
}
```

If multiple threads can mutate the subscriber list, protect the list with a lock or use a carefully designed concurrent approach.

Thread safety also includes deciding which thread handlers should run on, especially in UI applications where UI updates must happen on the UI thread.

##### Key Points to Mention

- Snapshot subscriber lists before iterating.
- Use locks or concurrent structures when needed.
- Consider subscribe/unsubscribe/publish races.
- UI updates may need marshaling to the UI thread.
- Do not assume observer code is thread-safe.
<!-- question:end:observer-style-communication-in-csharp-intermediate-q07 -->

<!-- question:start:observer-style-communication-in-csharp-intermediate-q08 -->
<!-- question-id:observer-style-communication-in-csharp-intermediate-q08 -->
<!-- question-level:intermediate -->
#### What is the weak event pattern?

##### Expected Answer

The weak event pattern is a way to subscribe to events without creating a strong reference from the publisher to the subscriber. This helps prevent memory leaks when the publisher lives longer than the subscriber.

In normal event subscriptions, the publisher holds a reference to the subscriber's handler. In a weak event pattern, the subscription uses weak references so the subscriber can still be garbage collected.

This pattern is most common in UI frameworks and component libraries. In normal backend application code, explicit unsubscription through `IDisposable` is usually simpler and clearer.

##### Key Points to Mention

- Prevents event subscriptions from keeping subscribers alive.
- Useful when listeners may not know when to unsubscribe.
- Common in UI frameworks.
- More complex than normal events.
- Explicit unsubscription is often preferred when practical.
<!-- question:end:observer-style-communication-in-csharp-intermediate-q08 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:observer-style-communication-in-csharp-advanced-q01 -->
<!-- question-id:observer-style-communication-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->
#### How would you choose between events, domain events, mediator notifications, and message brokers?

##### Expected Answer

The choice depends on scope, reliability, coupling, and lifetime.

Use C# events for simple in-process notifications where publisher and subscribers live in the same application and durability is not required.

Use domain events to represent business-significant facts inside the domain model, such as `OrderPlaced` or `PaymentCompleted`. These are usually data objects collected by entities and dispatched by application infrastructure.

Use mediator notifications for in-process application-level communication, especially in CQRS-style architectures where multiple handlers may react to a notification.

Use message brokers for cross-service or distributed communication where durability, retries, and process boundaries matter.

A strong design avoids using in-memory C# events as a replacement for distributed messaging. If another service must reliably receive the event, use a broker or outbox-based integration event approach.

##### Key Points to Mention

- Events: simple in-process notifications.
- Domain events: business facts inside the domain.
- Mediator notifications: in-process application dispatch.
- Message brokers: distributed and durable communication.
- Match the tool to reliability and process-boundary requirements.
<!-- question:end:observer-style-communication-in-csharp-advanced-q01 -->

<!-- question:start:observer-style-communication-in-csharp-advanced-q02 -->
<!-- question-id:observer-style-communication-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->
#### Why can observer-style communication make code harder to debug?

##### Expected Answer

Observer-style communication can make code harder to debug because the publisher does not directly show all behavior that happens after an event is raised. Subscribers may be registered in different places, and event handlers may run as side effects.

This can reduce traceability. A method may appear to only raise an event, but several handlers may update state, call services, or throw exceptions.

To manage this risk:

- Keep events focused and named clearly.
- Avoid hiding critical business behavior in event handlers.
- Use logging around important notifications.
- Prefer explicit direct calls for required workflow steps.
- Use mediator/domain event infrastructure when application-level dispatch needs structure.
- Keep handlers small and testable.

Observer-style communication improves decoupling, but too much hidden behavior can hurt maintainability.

##### Key Points to Mention

- Loose coupling can reduce traceability.
- Subscribers may be registered far from the publisher.
- Hidden side effects can surprise maintainers.
- Required workflow steps should often be explicit.
- Use logging, naming, and structured dispatch to improve visibility.
<!-- question:end:observer-style-communication-in-csharp-advanced-q02 -->

<!-- question:start:observer-style-communication-in-csharp-advanced-q03 -->
<!-- question-id:observer-style-communication-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->
#### How should you handle failures in event handlers?

##### Expected Answer

Failure handling depends on the meaning of the notification.

If an event represents part of a required workflow, a handler failure may need to fail the whole operation. In that case, letting the exception propagate may be correct.

If the event represents optional side effects, such as logging, metrics, or notifications, one failing handler should not necessarily stop other handlers. In that case, the publisher or dispatcher can catch exceptions per handler, log them, and continue.

For asynchronous or distributed side effects, a background queue or message broker is often better because it can support retries, dead-lettering, and operational visibility.

The key is to make failure behavior explicit instead of relying accidentally on multicast delegate behavior.

##### Key Points to Mention

- Required behavior may need exception propagation.
- Optional side effects may need isolation.
- One handler can block later handlers by throwing.
- Background queues or brokers can improve reliability.
- Failure semantics should be intentionally designed.
<!-- question:end:observer-style-communication-in-csharp-advanced-q03 -->

<!-- question:start:observer-style-communication-in-csharp-advanced-q04 -->
<!-- question-id:observer-style-communication-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->
#### How would you implement a custom observable safely?

##### Expected Answer

A custom observable should manage subscription, unsubscription, notification, completion, error handling, and thread safety.

Important practices include:

- Store observers in a private collection.
- Return an `IDisposable` from `Subscribe()` so observers can unsubscribe.
- Avoid duplicate subscriptions if that matters.
- Snapshot the observer list before notifying.
- Use locking if multiple threads can subscribe, unsubscribe, or publish.
- Call `OnError` for stream failures.
- Call `OnCompleted` when the stream ends.
- Avoid notifying observers while holding a lock if observer code may call back into the observable.

A safe implementation should also define what happens after completion or error. For example, it may reject new subscribers or immediately notify them that the stream completed.

##### Key Points to Mention

- `Subscribe()` returns `IDisposable`.
- Snapshot before notifying.
- Use locking for shared observer state.
- Avoid calling unknown observer code while holding locks.
- Support `OnNext`, `OnError`, and `OnCompleted` semantics.
<!-- question:end:observer-style-communication-in-csharp-advanced-q04 -->

<!-- question:start:observer-style-communication-in-csharp-advanced-q05 -->
<!-- question-id:observer-style-communication-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->
#### Why is `async void` dangerous in observer-style communication?

##### Expected Answer

`async void` is dangerous because callers cannot await it, cannot easily observe completion, and exception handling is different from `Task`-returning methods. In event handlers, `async void` may be acceptable for UI events because the event delegate requires `void`, but it is risky for business workflows.

If an application event triggers important asynchronous work, a better design is usually to use `Task`-returning handlers:

```csharp
public interface INotificationHandler<TNotification>
{
    Task HandleAsync(TNotification notification, CancellationToken cancellationToken);
}
```

This makes the workflow easier to test, await, retry, and handle errors.

##### Key Points to Mention

- `async void` cannot be awaited.
- Exceptions are harder to handle.
- Acceptable mainly for UI event handlers.
- Prefer `Task`-returning abstractions for business logic.
- Async workflows need clear completion and failure behavior.
<!-- question:end:observer-style-communication-in-csharp-advanced-q05 -->

<!-- question:start:observer-style-communication-in-csharp-advanced-q06 -->
<!-- question-id:observer-style-communication-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->
#### How are domain events different from C# events?

##### Expected Answer

C# events are language-level notification mechanisms based on delegates. They are raised in memory and immediately invoke subscribed handlers.

Domain events are design-level concepts that represent business facts. They are often modeled as immutable data objects, stored temporarily on entities or aggregate roots, and dispatched by application infrastructure after a successful operation.

Example C# event:

```csharp
public event EventHandler? SomethingHappened;
```

Example domain event:

```csharp
public sealed record OrderPlacedDomainEvent(int OrderId, DateTime OccurredOnUtc);
```

Domain events are often preferred in Clean Architecture because the domain model can record important facts without depending on infrastructure handlers.

##### Key Points to Mention

- C# events are language mechanisms.
- Domain events are business facts.
- Domain events are usually data objects.
- Domain events can be dispatched after persistence.
- Domain events fit Clean Architecture and DDD better than entity-level C# events.
<!-- question:end:observer-style-communication-in-csharp-advanced-q06 -->

<!-- question:start:observer-style-communication-in-csharp-advanced-q07 -->
<!-- question-id:observer-style-communication-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->
#### What are the trade-offs of observer-style communication?

##### Expected Answer

Observer-style communication improves loose coupling and extensibility, but it introduces trade-offs.

Benefits:

- Reduces direct dependencies.
- Supports one-to-many notifications.
- Makes optional reactions easy to add.
- Works well for UI events, data binding, and extension points.

Costs:

- Can make control flow harder to trace.
- Can hide important side effects.
- Can cause memory leaks if subscribers are not removed.
- Can complicate exception handling.
- Can create thread-safety issues.
- In-memory notifications are not durable.

A strong design uses observer-style communication only where the benefits outweigh the loss of explicitness.

##### Key Points to Mention

- Good for decoupling and extensibility.
- Bad when it hides required behavior.
- Requires lifetime management.
- Requires deliberate exception and threading behavior.
- Not a substitute for durable messaging.
<!-- question:end:observer-style-communication-in-csharp-advanced-q07 -->

<!-- question:start:observer-style-communication-in-csharp-advanced-q08 -->
<!-- question-id:observer-style-communication-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->
#### In an ASP.NET Core application, when would you avoid C# events?

##### Expected Answer

In ASP.NET Core, C# events should usually be avoided for request workflow logic, cross-service communication, and important asynchronous processing.

Reasons include:

- Request-scoped services have short lifetimes.
- Singleton publishers can accidentally retain scoped or transient subscribers.
- In-memory events are lost if the process restarts.
- Event handlers are harder to coordinate with transactions.
- Async handlers are awkward with standard event signatures.
- Distributed systems need durable messaging, not in-process events.

Better alternatives include direct service calls for required behavior, domain events for business facts, mediator notifications for in-process dispatch, background queues for async local processing, and message brokers for cross-service integration.

##### Key Points to Mention

- Beware dependency lifetimes.
- Avoid singleton-to-scoped event subscription problems.
- In-memory events are not durable.
- Prefer direct calls, mediator notifications, domain events, queues, or brokers.
- C# events are better suited to local object-level notifications.
<!-- question:end:observer-style-communication-in-csharp-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
