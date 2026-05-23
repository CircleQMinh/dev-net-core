---
id: app-service-plans-paas-web-hosting-fit
topic: Azure compute choices and hosting models

subtopic: App Service plans and PaaS web hosting fit
category: Azure
---


## Overview

Azure App Service is a managed Platform as a Service hosting option for web applications, REST APIs, mobile backends, and background WebJobs. It is commonly used to host ASP.NET Core applications, Node.js applications, Java applications, Python applications, PHP applications, and containerized web apps without managing virtual machines directly.

An App Service plan defines the compute resources used by one or more App Service apps. The plan controls the pricing tier, operating system, region, instance size, instance count, scale behavior, and feature availability. The app itself contains the deployed application code and configuration, while the App Service plan provides the underlying compute capacity.

This topic matters because choosing the wrong Azure compute model can create cost, scaling, security, deployment, and operations problems. App Service is often the right fit when a team wants managed web hosting with strong platform features and low infrastructure management overhead. It is not always the right fit when the application needs full machine control, complex container orchestration, special networking requirements, or event-driven scale-to-zero behavior.

For interviews, this topic is important because it tests practical Azure architecture judgment. A strong candidate should be able to explain:

- What an App Service plan is.
- How apps share compute inside a plan.
- How scale up and scale out work.
- How pricing tiers affect features.
- When App Service is better than virtual machines, Azure Functions, Azure Container Apps, or AKS.
- How deployment slots, custom domains, TLS, managed identity, diagnostics, autoscaling, and VNet integration fit into production hosting.
- What risks appear when too many apps share one plan.
- How to reason about cost, availability, performance, security, and operations.

The practical goal is not to always choose App Service. The goal is to choose it when PaaS web hosting matches the workload requirements.

## Core Concepts

### What is Azure App Service?

Azure App Service is a managed hosting platform for web applications and APIs. Instead of managing the operating system, web server, patching, base runtime installation, load balancing, and much of the hosting infrastructure, the development team deploys application code to the platform.

Common workloads include:

- ASP.NET Core Web APIs.
- MVC or Razor Pages web apps.
- Backend-for-frontend APIs.
- Admin portals.
- Public marketing websites with server-side logic.
- REST APIs consumed by React, mobile, desktop, or third-party clients.
- WebJobs for small background tasks tied to the same application.
- Containerized web apps that do not require full Kubernetes orchestration.

App Service gives developers a higher-level hosting model. The platform handles much of the environment so the team can focus on application behavior.

### What is an App Service plan?

An App Service plan is the compute container for App Service apps. It defines the physical or virtual resources that run your applications.

Important plan properties include:

- Azure region.
- Operating system: Windows or Linux.
- Pricing tier.
- VM size or SKU.
- Number of worker instances.
- Scale settings.
- Feature availability.
- Billing boundary.
- Resource sharing boundary.

Multiple apps can run in the same App Service plan. Those apps share the same compute resources. This can reduce cost, but it also means one noisy app can affect other apps in the same plan.

Conceptually:

```text
App Service Plan
  - Region: Southeast Asia
  - OS: Linux
  - Tier: Premium
  - Instances: 3

  Apps running on the plan:
    - customer-api
    - admin-portal
    - reporting-api
```

All apps in that plan share the plan's compute. Scaling the plan usually affects the compute available to all apps in the plan.

### App Service app vs App Service plan

A common interview mistake is confusing the app and the plan.

| Concept | Meaning |
|---|---|
| App Service app | The deployed application, app settings, connection strings, deployment slots, custom domain bindings, identity, logs, and runtime configuration |
| App Service plan | The compute resource that runs one or more apps |
| Pricing tier | The feature and compute class used by the plan |
| Instance count | How many worker instances the plan runs |
| Scale up | Move the plan to a larger or more capable SKU |
| Scale out | Increase the number of running instances |

A useful mental model:

```text
The app is what you deploy.
The plan is where it runs.
The tier controls capacity and features.
```

### Pricing tiers and feature levels

App Service provides multiple pricing tiers. Exact capabilities can change over time, but the general idea is:

- **Free and Shared**: low-cost or no-cost options for learning, demos, experiments, and very small workloads.
- **Basic**: dedicated compute for lower-traffic apps and development/test environments.
- **Standard**: production-oriented features such as scale-out and deployment slots.
- **Premium families**: higher performance, more scale, stronger features, and newer hardware generations.
- **Isolated / App Service Environment**: dedicated and isolated hosting for high-security, high-scale, or network-isolated scenarios.

The higher tiers generally provide more compute power, scale options, deployment features, networking capabilities, backup options, and production readiness.

For interviews, avoid memorizing every SKU detail. Instead, explain the decision factors:

- Is this production or non-production?
- Does it need scale-out?
- Does it need deployment slots?
- Does it need VNet integration?
- Does it need private access?
- Does it need zone redundancy?
- Does it need high memory or CPU?
- Is predictable cost more important than scale-to-zero?
- How many apps will share the plan?
- What is the required availability and recovery target?

### Billing model

App Service plans are billed based on the plan's compute resources and tier. In dedicated compute tiers, the plan is billed for the worker instances whether one app or many apps run on it.

Example:

```text
One Premium plan with 3 instances:
  - app-a
  - app-b
  - app-c

Billing is based on the plan's 3 instances,
not separately for each app's request count.
```

This can be cost-effective when several related apps have moderate traffic and can safely share capacity. It can become risky when a heavy app consumes shared CPU, memory, connections, or outbound resources.

Cost implications:

- An empty paid App Service plan can still cost money.
- Adding more apps to a plan does not necessarily add direct compute cost, but it consumes shared capacity.
- Scaling out the plan increases cost because more instances run.
- Scaling up to a larger SKU increases cost because each instance is more expensive.
- Premium and isolated tiers cost more but provide stronger performance and features.
- Extra services such as Application Insights, Front Door, Traffic Manager, Key Vault, databases, and networking can add cost.

### Apps sharing an App Service plan

Apps in the same App Service plan share CPU, memory, networking, and worker instance capacity. Sharing a plan is useful for cost efficiency, but it must be done carefully.

Good candidates for sharing one plan:

- Small internal tools.
- Related low-traffic APIs.
- Multiple apps in the same environment with predictable load.
- Apps owned by the same team with similar scaling and availability requirements.
- Non-production workloads.

Poor candidates for sharing one plan:

- A critical production API and a heavy reporting job.
- Apps with very different traffic patterns.
- Apps owned by different teams with different release cadences.
- A public customer-facing API and an experimental workload.
- Apps with separate compliance or isolation requirements.
- Apps where one app could starve others.

A practical rule:

```text
Share plans for cost efficiency when workloads are predictable and related.
Separate plans for isolation when workloads are critical, noisy, or independently scaled.
```

### Scale up vs scale out

App Service supports two main scaling directions.

#### Scale up

Scale up means changing the plan to a larger or more capable pricing tier or SKU. This gives each instance more resources or more features.

Use scale up when:

- CPU or memory per instance is insufficient.
- The application needs features available only in higher tiers.
- The app has high memory pressure.
- A larger machine size is easier than adding instances.
- The app is not yet designed to scale horizontally.

Example:

```text
Basic B1 -> Standard S1
Standard S1 -> Premium P1v3
Premium P1v3 -> Premium P2v3
```

#### Scale out

Scale out means increasing the number of instances running the app. This spreads traffic across multiple workers.

Use scale out when:

- The app is stateless or mostly stateless.
- Request volume is high.
- Availability matters.
- Horizontal scaling is more cost-effective than one large instance.
- You want capacity across multiple workers.

Example:

```text
1 instance -> 3 instances -> 5 instances
```

For web APIs, scale out is usually preferred once the application is stateless and externalizes session state, file storage, cache, and background work.

### Autoscaling

Autoscaling adjusts instance count based on rules or platform capabilities. Common autoscale signals include:

- CPU percentage.
- Memory percentage.
- HTTP queue length.
- Schedule-based rules.
- Custom metrics.

Example autoscale thinking:

```text
If average CPU > 70% for 10 minutes:
  scale out by 1 instance.

If average CPU < 30% for 30 minutes:
  scale in by 1 instance.

Minimum instances: 2
Maximum instances: 6
```

Autoscaling is useful for variable traffic, but it is not a replacement for performance testing. The app must still be designed to run on multiple instances.

Common autoscaling mistakes:

- Scaling based only on CPU when the bottleneck is database, memory, thread pool, SNAT ports, or external APIs.
- Allowing scale-in too aggressively.
- Not setting a safe minimum instance count for production.
- Keeping session state in memory.
- Using local disk for files that must be shared between instances.
- Forgetting that all apps in a plan may be affected by plan-level scaling.

### Stateless application design

App Service works best when the app is stateless. Stateless means any instance can handle any request because important state is stored outside the local process.

Good external state locations:

- Azure SQL Database.
- Azure Cosmos DB.
- Azure Cache for Redis.
- Azure Blob Storage.
- Azure Service Bus.
- Distributed cache.
- External identity provider.
- Durable workflow or queue system.

Avoid relying on:

- In-memory session for critical user state.
- Local files for uploaded documents.
- Local process state for workflow progress.
- Background threads that must survive restarts.
- Single-instance assumptions.

Stateless design makes scale-out, deployment slots, failover, and restarts safer.

### Deployment slots

Deployment slots are separate deployment environments within the same App Service app, commonly used for staging and production-style validation.

Typical flow:

```text
Deploy new version to staging slot.
Warm up staging slot.
Run smoke tests against staging slot.
Swap staging with production.
Monitor production.
Rollback by swapping back if needed.
```

Benefits:

- Reduced downtime deployments.
- Warm-up before production traffic.
- Quick rollback by swapping slots.
- Safer release validation.
- Separation of slot-specific settings.

Slot-specific settings are important. For example, production and staging may use different connection strings, feature flags, or external service endpoints.

Common mistakes:

- Forgetting to mark settings as slot-specific.
- Running staging against production dependencies unintentionally.
- Assuming slot swap replaces all configuration exactly.
- Not warming up the app before swap.
- Using deployment slots without smoke tests.

### Custom domains and TLS

Production App Service apps commonly use custom domains and TLS certificates.

Common production setup:

```text
https://api.contoso.com -> Azure Front Door or App Service custom domain -> App Service app
```

Important points:

- Use HTTPS for production.
- Configure custom domains through DNS records.
- Use managed certificates where appropriate.
- Understand certificate renewal and ownership.
- Consider Azure Front Door or Application Gateway for global routing, WAF, and edge TLS.
- Avoid exposing default hostnames as the only production URL if a branded domain is required.

App Service can handle custom domains and TLS bindings, but the broader architecture may still include Front Door, CDN, WAF, or Application Gateway depending on requirements.

### App settings and configuration

App Service app settings are exposed to the application as environment variables. They are commonly used for:

- ASP.NET Core environment name.
- Feature flags.
- Connection strings.
- API endpoints.
- Runtime configuration.
- Logging settings.
- Integration settings.

Example app settings:

```text
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=...
AzureAd__TenantId=...
FeatureManagement__NewCheckout=false
```

In ASP.NET Core, double underscores represent nested configuration:

```csharp
builder.Configuration.GetConnectionString("DefaultConnection");
```

For secrets, app settings are better than hardcoding values in source code, but production-grade secret handling often uses Key Vault references or managed identity.

### Managed identity

Managed identity allows an App Service app to authenticate to Azure resources without storing credentials in code or configuration.

Common uses:

- Access Azure Key Vault.
- Access Azure Storage.
- Access Azure SQL Database with Azure AD authentication.
- Access Azure Service Bus.
- Access Azure App Configuration.
- Access Azure Monitor resources.

Example concept:

```text
App Service has a system-assigned managed identity.
Key Vault grants that identity permission to read selected secrets.
The app uses DefaultAzureCredential to retrieve secrets.
```

C# example:

```csharp
var credential = new DefaultAzureCredential();

var secretClient = new SecretClient(
    new Uri("https://my-vault.vault.azure.net/"),
    credential);

KeyVaultSecret secret = await secretClient.GetSecretAsync(
    "DatabasePassword",
    cancellationToken);
```

Managed identity supports least privilege because access can be granted to a specific app identity instead of sharing credentials across applications.

### Networking options

App Service provides several networking features, but it is not the same as running a VM inside your own subnet by default.

Important concepts:

| Feature | Purpose |
|---|---|
| VNet integration | Allows the app to make outbound calls into a virtual network |
| Private Endpoint | Allows inbound private access to the app from a virtual network |
| Access restrictions | Restrict inbound access by IP, service endpoint, or other rules |
| NAT Gateway with VNet integration | Helps provide stable outbound IP and mitigate outbound port exhaustion |
| App Service Environment | Provides stronger isolation and network control |

A common distinction:

```text
VNet integration is mainly for outbound access from the app to private resources.
Private Endpoint is for private inbound access to the app.
```

Example use cases:

- App Service needs to call a private Azure SQL Database endpoint.
- App Service needs to access an internal API in a VNet.
- Corporate traffic should reach the web app privately.
- Outbound IPs need to be controlled.
- Public access should be disabled.

### Diagnostics and monitoring

Production App Service apps should be observable. Common tools include:

- Application Insights.
- Azure Monitor metrics.
- Log stream.
- App Service diagnostics.
- Health checks.
- Availability tests.
- Structured application logs.
- Distributed tracing.
- Alerts for error rate, latency, CPU, memory, restarts, and dependency failures.

Important metrics include:

- HTTP 5xx count.
- Response time.
- Requests per second.
- CPU percentage.
- Memory usage.
- Thread pool starvation indicators.
- Dependency duration.
- Failed dependencies.
- App restarts.
- Queue length.
- Instance count.

Good monitoring answers in interviews should connect hosting to operations:

```text
I would not just deploy the app. I would configure logs, metrics, health checks, alerts, dashboards, and deployment rollback signals.
```

### Health checks

Health checks help load balancers and monitoring systems understand whether an app is healthy.

ASP.NET Core example:

```csharp
builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")!);

app.MapHealthChecks("/health");
```

Good health check design:

- Liveness check: is the app process running?
- Readiness check: can the app handle traffic?
- Dependency checks: are critical dependencies reachable?
- Avoid extremely expensive checks.
- Avoid checking every downstream service on every request.
- Use health checks for monitoring and deployment validation.

### Always On and cold starts

Some tiers support Always On to keep the app loaded even when there is little traffic. This is important for production apps that should avoid cold-start delays.

Cold-start risks include:

- First request after idle is slow.
- Background jobs may not run consistently if the app idles.
- App initialization takes time after deployment or scale-out.
- JIT compilation, dependency initialization, and cache warm-up can delay first request.

Production web APIs often enable Always On where supported.

### Background work in App Service

App Service can run WebJobs and background tasks, but it is not always the best hosting model for long-running or mission-critical background processing.

Suitable background work:

- Lightweight scheduled jobs.
- Maintenance tasks.
- Queue processing with modest load.
- Tasks closely tied to the web app.

Better alternatives for heavier background work:

- Azure Functions for event-driven jobs.
- Azure Container Apps jobs for containerized tasks.
- Azure WebJobs when tightly coupled to App Service.
- Azure Kubernetes Service for complex orchestration.
- Azure Batch for large compute jobs.
- Azure Service Bus plus dedicated workers for reliable processing.

Common mistake:

```text
Starting a long-running fire-and-forget Task inside a controller and assuming it will always complete.
```

A better design uses a queue and a worker.

### When App Service is the right fit

App Service is usually a strong fit when:

- The workload is a web app or HTTP API.
- The team wants managed hosting without managing VMs.
- The app uses a supported runtime or container.
- The app is mostly stateless.
- The app needs custom domains and TLS.
- The app benefits from deployment slots.
- The app needs moderate to high production reliability without Kubernetes complexity.
- The team wants built-in diagnostics and integration with Azure Monitor.
- The app needs managed identity integration with Azure services.
- The app can scale horizontally.
- The operations team wants a mature PaaS platform.

Example good fit:

```text
A .NET 8 Web API used by a React frontend.
Traffic is steady with daily peaks.
The team needs custom domain, HTTPS, deployment slots, Application Insights,
managed identity to Key Vault, and autoscaling.
App Service is a strong candidate.
```

### When App Service may not be the right fit

App Service may not be the best fit when:

- The workload is primarily event-driven and should scale to zero.
- The workload needs complex container orchestration.
- The app requires full control over the OS.
- The app needs custom kernel modules, special drivers, or privileged containers.
- The app has many independent microservices requiring service mesh or advanced orchestration.
- The app needs batch compute or GPU-heavy processing.
- The app has long-running jobs that do not fit web hosting behavior.
- The app must run inside a highly customized network appliance pattern.
- The application needs per-request consumption billing rather than always-on compute.
- The team already has mature Kubernetes operations and needs Kubernetes-specific capabilities.

Alternatives:

| Requirement | Possible better fit |
|---|---|
| Event-driven code with scale-to-zero | Azure Functions |
| Containerized microservices with simple managed hosting | Azure Container Apps |
| Full container orchestration and Kubernetes APIs | Azure Kubernetes Service |
| Full OS control | Azure Virtual Machines or VM Scale Sets |
| Static frontend only | Azure Static Web Apps or Azure Storage static website |
| Global edge routing and WAF | Azure Front Door in front of App Service |
| Heavy batch processing | Azure Batch or container jobs |

### App Service vs Azure Functions

App Service is usually better for continuously running web apps and APIs with predictable hosting needs. Azure Functions is usually better for event-driven workloads where code runs in response to triggers.

Use App Service when:

- The app is a traditional web API.
- You need always-on behavior.
- You need predictable hosting.
- You want to host several web apps in the same plan.
- Request/response behavior is central.

Use Azure Functions when:

- Work is event-driven.
- Triggers such as queues, timers, blobs, or events are central.
- Scale-to-zero or consumption-based billing is important.
- Functions are small and independently triggered.
- Background processing is more important than web hosting.

### App Service vs Azure Container Apps

Azure Container Apps is usually better when the application is container-first and needs managed microservice features such as revision-based deployments, Dapr integration, event-driven scaling, or scale-to-zero.

Use App Service when:

- The app is a normal web app or API.
- Runtime support is built in.
- You want a mature web hosting platform.
- Deployment slots and App Service features are attractive.
- Container orchestration needs are simple.

Use Azure Container Apps when:

- Every service is containerized.
- Event-driven scaling matters.
- Scale-to-zero matters.
- Multiple containerized services communicate internally.
- Dapr or KEDA-style scaling is useful.
- Revision traffic splitting is needed.

### App Service vs AKS

Azure Kubernetes Service is more powerful but more operationally complex. App Service is simpler for standard web apps.

Use App Service when:

- You do not need Kubernetes.
- You want lower operational overhead.
- The app is a normal web app or API.
- Built-in PaaS features are enough.
- Team size or operational maturity does not justify Kubernetes.

Use AKS when:

- You need Kubernetes APIs and ecosystem.
- You need complex microservice orchestration.
- You need service mesh, custom controllers, or advanced deployment patterns.
- You need deep container scheduling control.
- Your organization already operates Kubernetes well.

A good interview answer avoids saying AKS is always more advanced and therefore better. It is more flexible, but flexibility comes with operational cost.

### App Service vs Virtual Machines

Virtual machines provide full control but require more management. App Service removes much of the infrastructure burden.

Use App Service when:

- The app can run on a supported runtime or container.
- You do not need full OS control.
- You want managed patching and platform features.
- You want faster delivery and simpler operations.

Use VMs when:

- You need full administrative control.
- Legacy software requires machine-level customization.
- You need custom services, drivers, or OS-level configuration.
- Licensing or compliance requires a VM-based model.
- Migration constraints make PaaS difficult.

### Production architecture example

A typical production App Service architecture for a .NET API:

```text
Users / React frontend
  -> Azure Front Door with WAF
  -> App Service custom domain
  -> ASP.NET Core Web API
  -> Managed identity
  -> Key Vault
  -> Azure SQL Database
  -> Azure Cache for Redis
  -> Application Insights / Azure Monitor
```

Key production choices:

- Use custom domain and TLS.
- Place Front Door or Application Gateway if WAF/global routing is required.
- Use managed identity for Azure resources.
- Store secrets in Key Vault.
- Use deployment slots for safer releases.
- Use Application Insights for logs, traces, metrics, and dependency tracking.
- Configure autoscale rules.
- Use distributed cache or database state instead of local memory for shared state.
- Configure health checks and alerts.
- Use private endpoints and VNet integration where needed.

### Example Azure CLI deployment

Create a resource group:

```bash
az group create \
  --name rg-web-prod \
  --location southeastasia
```

Create an App Service plan:

```bash
az appservice plan create \
  --name asp-prod-web \
  --resource-group rg-web-prod \
  --sku P1V3 \
  --is-linux
```

Create a web app:

```bash
az webapp create \
  --name my-prod-api \
  --resource-group rg-web-prod \
  --plan asp-prod-web \
  --runtime "DOTNET:8"
```

Set app settings:

```bash
az webapp config appsettings set \
  --name my-prod-api \
  --resource-group rg-web-prod \
  --settings \
    ASPNETCORE_ENVIRONMENT=Production \
    FeatureManagement__NewCheckout=false
```

Enable a system-assigned managed identity:

```bash
az webapp identity assign \
  --name my-prod-api \
  --resource-group rg-web-prod
```

The exact runtime names and SKUs should be checked against the current Azure CLI and region availability when implementing.

### Example Bicep App Service plan

```bicep
param location string = resourceGroup().location
param appServicePlanName string = 'asp-prod-web'
param webAppName string = 'app-prod-api'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
    size: 'P1v3'
    capacity: 2
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      alwaysOn: true
      healthCheckPath: '/health'
      appSettings: [
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
        }
      ]
    }
  }
}
```

Bicep is useful because hosting configuration becomes versioned, repeatable, reviewable, and deployable through CI/CD.

### Security considerations

Important App Service security practices include:

- Enable HTTPS-only.
- Use managed identity instead of stored credentials where possible.
- Store secrets in Key Vault or use Key Vault references.
- Restrict inbound access when the app should not be public.
- Use private endpoints for private inbound access where required.
- Use VNet integration for private outbound dependencies.
- Apply least privilege to managed identities.
- Use separate plans or subscriptions for stronger environment isolation when needed.
- Keep runtime versions current.
- Configure authentication and authorization explicitly.
- Place a WAF in front of public apps when threat model requires it.
- Monitor logs and alerts for suspicious behavior.
- Do not expose diagnostic endpoints publicly without protection.

### Reliability considerations

Production App Service reliability requires more than choosing a paid tier.

Important practices:

- Run at least two instances for production where availability matters.
- Use health checks.
- Use deployment slots and smoke tests.
- Use autoscale with safe minimum and maximum instance counts.
- Externalize state.
- Avoid local disk dependency.
- Use retry policies with backoff for transient dependencies.
- Protect downstream systems from overload.
- Use Application Insights and Azure Monitor alerts.
- Design for dependency failures.
- Use regional redundancy or multi-region architecture for high availability requirements.
- Use backups where appropriate.
- Test rollback procedures.

### Performance considerations

Performance tuning should consider both the App Service plan and application behavior.

Common performance factors:

- CPU and memory pressure.
- Thread pool starvation.
- Slow database queries.
- Missing indexes.
- Excessive synchronous blocking.
- Inefficient serialization.
- Large request/response bodies.
- Cold starts.
- Dependency latency.
- Outbound connection exhaustion.
- Too many apps sharing one plan.
- Logging overhead.
- Lack of caching.

Scaling up or out can help, but it does not fix inefficient code or a slow database. Interviewers often expect candidates to discuss both infrastructure scaling and application profiling.

### Cost considerations

App Service cost depends on the selected plan, instance count, and related services. A production plan may be cost-effective, but unnecessary overprovisioning can be expensive.

Cost-control habits:

- Right-size the SKU.
- Use separate smaller plans for non-production.
- Delete unused paid plans.
- Avoid leaving empty plans running.
- Use autoscale carefully.
- Monitor utilization.
- Do not put noisy apps into shared plans without capacity review.
- Use budgets and alerts.
- Consider whether Azure Functions or Container Apps scale-to-zero is more appropriate for intermittent workloads.
- Consider reserved capacity or savings options where available and appropriate.

### Common mistakes

Common mistakes include:

- Confusing App Service app with App Service plan.
- Putting too many unrelated production apps into one plan.
- Using Free or Shared tiers for production workloads.
- Forgetting that paid plans can cost money even when no app is actively receiving traffic.
- Scaling out a stateful app that stores session or files locally.
- Not enabling Always On for production workloads where supported.
- Not using deployment slots for safer releases.
- Forgetting slot-specific configuration during swaps.
- Storing secrets directly in source code or plain app settings without Key Vault strategy.
- Assuming VNet integration makes the app private inbound.
- Not configuring monitoring, health checks, and alerts.
- Treating App Service as if it were a full VM with unrestricted OS control.
- Using App Service for workloads better suited to Functions, Container Apps, AKS, or Batch.
- Scaling the web tier while ignoring the database bottleneck.

### Best practices

Good App Service design practices include:

- Choose App Service for web/API workloads that benefit from managed hosting.
- Keep apps stateless.
- Use the smallest tier that meets production requirements.
- Separate critical or noisy apps into separate plans.
- Use deployment slots for production deployments.
- Use Application Insights and structured logging.
- Use managed identity and Key Vault for secrets.
- Use HTTPS-only.
- Configure custom domains and certificates properly.
- Use VNet integration and private endpoints intentionally.
- Configure health checks.
- Use autoscale rules based on meaningful metrics.
- Use at least two instances for production availability where required.
- Store shared files in Blob Storage, not local disk.
- Use queues for background work that must be reliable.
- Version infrastructure with Bicep, Terraform, or another Infrastructure as Code tool.
- Review cost and utilization regularly.

### Practical decision guide

Use this decision guide in interviews:

```text
Is the workload mainly a web app or HTTP API?
  -> App Service is a strong candidate.

Does it need full OS control or custom machine-level software?
  -> Consider VMs.

Is it event-driven and mostly idle between events?
  -> Consider Azure Functions.

Is it container-first and needs scale-to-zero or microservice features?
  -> Consider Azure Container Apps.

Does it need full Kubernetes orchestration?
  -> Consider AKS.

Is it static frontend only?
  -> Consider Azure Static Web Apps or Storage static website.

Does it need low-ops managed hosting with deployment slots, TLS, diagnostics, and autoscale?
  -> App Service is likely a good fit.
```

The best answer explains trade-offs instead of naming a service by habit.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is an App Service plan in Azure?

<!-- question:start:app-service-plans-paas-web-hosting-fit-beginner-q01 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An App Service plan defines the compute resources used by one or more Azure App Service apps. It controls the region, operating system, pricing tier, instance size, instance count, scaling behavior, and feature availability.

The App Service app contains the deployed application and configuration. The App Service plan is the compute environment that runs it.

Multiple apps can run in the same plan and share the same compute resources. This can reduce cost, but it also means apps can affect each other's performance if the plan is overloaded.

##### Key Points to Mention

- The app is what you deploy.
- The plan is where the app runs.
- The plan controls SKU, region, OS, and instance count.
- Multiple apps can share one plan.
- Apps in the same plan share CPU, memory, and worker capacity.
- Paid plans can cost money even if traffic is low.

<!-- question:end:app-service-plans-paas-web-hosting-fit-beginner-q01 -->

#### What is Azure App Service used for?

<!-- question:start:app-service-plans-paas-web-hosting-fit-beginner-q02 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Azure App Service is used to host web applications, REST APIs, mobile backends, and background WebJobs on a managed platform. It supports common runtimes such as .NET, Node.js, Java, Python, and PHP, and it can also run containerized web apps.

It is a PaaS hosting option, meaning Azure manages much of the underlying infrastructure, such as OS patching, web server hosting, load balancing, scaling features, and platform integration.

It is commonly used when a team wants to deploy a web app quickly without managing virtual machines.

##### Key Points to Mention

- Managed hosting for web apps and APIs.
- Supports many runtimes and containers.
- Reduces infrastructure management.
- Good fit for ASP.NET Core APIs.
- Includes platform features like custom domains, TLS, deployment slots, diagnostics, and scaling.
- Not the same as full VM hosting.

<!-- question:end:app-service-plans-paas-web-hosting-fit-beginner-q02 -->

#### What is the difference between scale up and scale out?

<!-- question:start:app-service-plans-paas-web-hosting-fit-beginner-q03 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Scale up means moving to a larger or more capable pricing tier or SKU. This gives each instance more resources or more features.

Scale out means increasing the number of running instances. This allows the app to handle more traffic across multiple workers.

For production web APIs, scale out is often useful when the app is stateless. Scale up is useful when each instance needs more CPU, memory, or tier-specific capabilities.

##### Key Points to Mention

- Scale up means bigger instance or higher tier.
- Scale out means more instances.
- Scale out requires stateless design.
- Scale up can unlock more features.
- Autoscaling usually changes instance count.
- Both scaling methods can increase cost.

<!-- question:end:app-service-plans-paas-web-hosting-fit-beginner-q03 -->

#### Why should production apps usually avoid Free or Shared App Service tiers?

<!-- question:start:app-service-plans-paas-web-hosting-fit-beginner-q04 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Free and Shared tiers are intended for learning, experiments, small demos, or very low-importance workloads. They have limited resources and fewer production features.

Production apps usually need predictable performance, custom domains, TLS, diagnostics, deployment slots, scaling, and reliability features. Higher dedicated tiers are more appropriate for production workloads.

The exact tier depends on workload requirements, but production apps should not be placed on tiers that cannot meet availability, performance, and operational needs.

##### Key Points to Mention

- Free and Shared tiers have limited resources.
- Production apps need predictable performance.
- Production often needs scale, TLS, custom domains, slots, and monitoring.
- Use lower tiers for dev/test or demos.
- Choose tier based on requirements, not only cost.
- Always verify current tier feature support.

<!-- question:end:app-service-plans-paas-web-hosting-fit-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When is Azure App Service the right hosting choice?

<!-- question:start:app-service-plans-paas-web-hosting-fit-intermediate-q01 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Azure App Service is a good fit when the workload is a web app or HTTP API, the team wants managed hosting, the application can run on a supported runtime or container, and the application benefits from platform features such as custom domains, TLS, deployment slots, managed identity, diagnostics, and autoscale.

It is especially strong for ASP.NET Core APIs and web apps that are mostly stateless and do not require full OS control.

It may not be the best fit for event-driven scale-to-zero workloads, complex Kubernetes orchestration, full OS customization, GPU-heavy processing, or large batch jobs.

##### Key Points to Mention

- Best for web apps and APIs.
- Strong managed PaaS features.
- Good for low-operations hosting.
- Works well with stateless apps.
- Not ideal for full OS control or complex orchestration.
- Compare against Functions, Container Apps, AKS, and VMs.

<!-- question:end:app-service-plans-paas-web-hosting-fit-intermediate-q01 -->

#### What are the risks of hosting many apps in one App Service plan?

<!-- question:start:app-service-plans-paas-web-hosting-fit-intermediate-q02 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Hosting many apps in one App Service plan can reduce cost because they share the same compute. However, all apps in the plan share CPU, memory, network, and worker capacity. A noisy or resource-heavy app can affect the performance of other apps.

It can also create scaling and ownership problems. If one app needs to scale out, the plan may scale for all apps. If apps have different availability, security, compliance, or release requirements, they may be better placed in separate plans.

Sharing is best for related, predictable, low-to-moderate workloads. Critical or noisy apps should often be isolated.

##### Key Points to Mention

- Apps share compute resources.
- One noisy app can affect others.
- Scaling the plan affects capacity for apps in the plan.
- Shared plans can reduce cost.
- Separate critical or high-load apps.
- Consider team ownership, environment, security, and scaling requirements.

<!-- question:end:app-service-plans-paas-web-hosting-fit-intermediate-q02 -->

#### How do deployment slots improve production releases?

<!-- question:start:app-service-plans-paas-web-hosting-fit-intermediate-q03 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Deployment slots allow a team to deploy a new version to a staging slot, warm it up, run smoke tests, and then swap it into production. This reduces downtime and allows faster rollback by swapping back.

Slots also help validate configuration and startup behavior before production traffic reaches the new version.

The team must manage slot-specific settings carefully. Some settings, such as production connection strings or external endpoints, should stay with the production slot during swaps.

##### Key Points to Mention

- Deploy to staging first.
- Warm up and smoke test before swap.
- Swap staging with production.
- Rollback can be done by swapping back.
- Use slot-specific settings carefully.
- Slots reduce deployment risk but do not replace testing.

<!-- question:end:app-service-plans-paas-web-hosting-fit-intermediate-q03 -->

#### What is the difference between VNet integration and Private Endpoint for App Service?

<!-- question:start:app-service-plans-paas-web-hosting-fit-intermediate-q04 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

VNet integration allows an App Service app to make outbound calls into a virtual network. For example, the app can call a private database, internal API, or private Azure resource.

Private Endpoint is used for inbound private access to the App Service app. It allows clients inside a virtual network to reach the app privately instead of through the public internet.

A common mistake is assuming VNet integration automatically makes the app privately accessible inbound. It does not. VNet integration is mainly for outbound connectivity.

##### Key Points to Mention

- VNet integration is primarily outbound from the app to the VNet.
- Private Endpoint is for private inbound access to the app.
- Access restrictions can limit inbound traffic.
- NAT Gateway can help control outbound IP and port exhaustion.
- Networking features depend on tier and configuration.
- Private architecture requires DNS planning.

<!-- question:end:app-service-plans-paas-web-hosting-fit-intermediate-q04 -->

#### How would you secure secrets for an App Service app?

<!-- question:start:app-service-plans-paas-web-hosting-fit-intermediate-q05 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Secrets should not be hardcoded in source code. In App Service, basic configuration can be stored in app settings, but production secrets should usually be stored in Azure Key Vault or referenced through Key Vault integration.

The App Service app should use managed identity to access Key Vault or other Azure resources. The managed identity should be granted only the permissions it needs.

In .NET, the application can use `DefaultAzureCredential` to authenticate with Azure services using managed identity in production and developer credentials locally.

##### Key Points to Mention

- Do not hardcode secrets.
- Use app settings for configuration.
- Use Key Vault for production secrets.
- Use managed identity to avoid stored credentials.
- Apply least privilege.
- Rotate and monitor secrets where applicable.

<!-- question:end:app-service-plans-paas-web-hosting-fit-intermediate-q05 -->

#### Why should App Service apps usually be stateless?

<!-- question:start:app-service-plans-paas-web-hosting-fit-intermediate-q06 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

App Service apps should usually be stateless because the platform can run multiple instances, restart workers, swap deployment slots, and scale out. If the app stores important state in local memory or local files, another instance may not see that state, and the state may be lost during restart or deployment.

Shared state should be stored in external services such as Azure SQL Database, Cosmos DB, Blob Storage, Redis, or a queue.

Stateless design makes scaling, failover, deployment, and recovery safer.

##### Key Points to Mention

- Multiple instances need shared state.
- Local memory and local disk are not reliable for critical state.
- Use distributed cache, database, blob storage, or queues.
- Stateless design supports scale-out.
- Deployment slots and restarts are safer.
- Avoid sticky-session assumptions when possible.

<!-- question:end:app-service-plans-paas-web-hosting-fit-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you choose between App Service, Azure Functions, Container Apps, AKS, and VMs?

<!-- question:start:app-service-plans-paas-web-hosting-fit-advanced-q01 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start with the workload shape and operational requirements.

For a traditional web app or HTTP API that needs managed hosting, custom domains, TLS, deployment slots, diagnostics, and predictable hosting, App Service is a strong fit.

For event-driven workloads that should scale to zero or run on triggers, Azure Functions is often better.

For containerized services that need managed microservice features, revisions, event-driven scaling, or scale-to-zero, Azure Container Apps may be better.

For complex Kubernetes orchestration, service mesh, custom controllers, or deep scheduling control, AKS is appropriate if the team can handle the operational complexity.

For full OS control, legacy workloads, custom drivers, or machine-level dependencies, VMs may be required.

##### Key Points to Mention

- App Service: managed web/API hosting.
- Functions: event-driven serverless.
- Container Apps: managed containers and scale-to-zero.
- AKS: full Kubernetes control with more operations.
- VMs: full OS control.
- Choose based on workload shape, operations, cost, scaling, and control needs.

<!-- question:end:app-service-plans-paas-web-hosting-fit-advanced-q01 -->

#### How would you design a production App Service architecture for a .NET API?

<!-- question:start:app-service-plans-paas-web-hosting-fit-advanced-q02 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

A production .NET API on App Service would typically use a paid production tier, multiple instances, HTTPS-only, custom domain, deployment slots, managed identity, Key Vault for secrets, Application Insights for monitoring, health checks, and autoscale rules.

If the app is public and needs edge routing or WAF, I would place Azure Front Door or Application Gateway in front. If it needs private dependencies, I would use VNet integration and private endpoints where appropriate.

The app should be stateless, store files in Blob Storage, use a database for persistent data, use Redis for distributed cache if needed, and use queues for reliable background work.

##### Key Points to Mention

- Use production tier with sufficient instances.
- Enable HTTPS-only and custom domain.
- Use deployment slots.
- Use managed identity and Key Vault.
- Configure Application Insights, health checks, and alerts.
- Use VNet integration/private endpoints as required.
- Keep the app stateless.
- Use queues for reliable background processing.

<!-- question:end:app-service-plans-paas-web-hosting-fit-advanced-q02 -->

#### How do you reason about cost when using App Service plans?

<!-- question:start:app-service-plans-paas-web-hosting-fit-advanced-q03 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Cost is based mainly on the App Service plan tier and instance count. In dedicated tiers, the plan costs money for the allocated worker instances whether one app or many apps run on it.

Sharing a plan can reduce cost, but it increases resource-sharing risk. Scaling out increases cost because more instances run. Scaling up increases cost because each instance is more capable and expensive.

I would right-size the plan, separate critical or noisy apps, use smaller tiers for non-production, delete unused paid plans, configure budgets and alerts, and review utilization. For intermittent workloads, I would compare App Service with services that can scale to zero, such as Functions or Container Apps.

##### Key Points to Mention

- Paid plans charge for allocated compute.
- Empty paid plans can still cost money.
- Sharing apps can reduce cost but increases coupling.
- Scale-up and scale-out both affect cost.
- Monitor utilization and right-size.
- Consider scale-to-zero alternatives for intermittent workloads.

<!-- question:end:app-service-plans-paas-web-hosting-fit-advanced-q03 -->

#### What can go wrong if you scale out an App Service app without changing application design?

<!-- question:start:app-service-plans-paas-web-hosting-fit-advanced-q04 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

If the app is not designed for multiple instances, scale-out can cause inconsistent behavior. Problems include in-memory session state not being shared, local files not being visible to all instances, background tasks running multiple times, cache inconsistency, race conditions, and dependency overload.

The app should externalize state to a database, distributed cache, Blob Storage, or queues. Background work should be designed to be idempotent and coordinated through reliable infrastructure.

Scaling out also increases load on downstream dependencies, so the database, cache, APIs, and network limits must be monitored and scaled appropriately.

##### Key Points to Mention

- In-memory state may break.
- Local files are unsafe for shared persistent state.
- Background tasks can duplicate.
- Downstream dependencies may become bottlenecks.
- Use distributed storage and queues.
- Design for idempotency and concurrency.
- Monitor database and dependency load.

<!-- question:end:app-service-plans-paas-web-hosting-fit-advanced-q04 -->

#### How would you troubleshoot performance problems in an App Service app?

<!-- question:start:app-service-plans-paas-web-hosting-fit-advanced-q05 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

I would first determine whether the bottleneck is in the app, the App Service plan, or a dependency. I would check Application Insights, Azure Monitor metrics, logs, CPU, memory, response time, request rate, failed requests, dependency duration, database query performance, and app restarts.

If CPU or memory is consistently high, scaling up or out may help. If database dependencies are slow, scaling the web tier may not fix the issue. If requests are blocked, I would look for synchronous blocking, thread pool starvation, connection exhaustion, slow external APIs, or inefficient queries.

I would also check whether too many apps are sharing the same plan and whether autoscale rules match the real bottleneck.

##### Key Points to Mention

- Use metrics, logs, traces, and dependency telemetry.
- Check CPU, memory, response time, 5xx, restarts, and dependency latency.
- Scaling web tier does not fix database bottlenecks.
- Look for thread pool starvation and sync blocking.
- Review plan sharing and autoscale rules.
- Profile and optimize before only increasing SKU.

<!-- question:end:app-service-plans-paas-web-hosting-fit-advanced-q05 -->

#### When would you use App Service Environment or isolated hosting?

<!-- question:start:app-service-plans-paas-web-hosting-fit-advanced-q06 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

I would consider App Service Environment or isolated hosting when the workload needs stronger network isolation, high scale, dedicated hosting environment, or stricter compliance and security boundaries than a normal multi-tenant App Service plan provides.

It can be useful for internal line-of-business apps, highly regulated workloads, apps requiring private network exposure, or scenarios where isolation is more important than cost.

However, isolated hosting is more expensive and should be justified by security, compliance, scale, or network requirements.

##### Key Points to Mention

- Provides stronger isolation.
- Useful for private or regulated workloads.
- Supports advanced network control.
- More expensive than normal plans.
- Should be justified by requirements.
- Not needed for every production app.

<!-- question:end:app-service-plans-paas-web-hosting-fit-advanced-q06 -->

#### What are the most important App Service production readiness checks?

<!-- question:start:app-service-plans-paas-web-hosting-fit-advanced-q07 -->
<!-- question-id:app-service-plans-paas-web-hosting-fit-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Important production readiness checks include using an appropriate production tier, running enough instances for availability, enabling HTTPS-only, configuring custom domains and TLS, using managed identity and Key Vault for secrets, enabling Application Insights, configuring health checks and alerts, using deployment slots, validating slot-specific settings, setting autoscale rules, and ensuring the app is stateless.

I would also review network access, private dependencies, backup needs, rollback strategy, cost alerts, and dependency capacity.

The key is to treat App Service as part of a complete production system, not just a deployment target.

##### Key Points to Mention

- Proper tier and instance count.
- HTTPS-only and custom domain.
- Managed identity and Key Vault.
- Application Insights, logs, health checks, and alerts.
- Deployment slots and rollback strategy.
- Autoscale and stateless design.
- Networking and private dependency review.
- Cost monitoring and budgets.

<!-- question:end:app-service-plans-paas-web-hosting-fit-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
