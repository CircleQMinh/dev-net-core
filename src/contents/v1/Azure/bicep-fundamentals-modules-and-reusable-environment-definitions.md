---
id: bicep-fundamentals-modules-and-reusable-environment-definitions
topic: Delivery, infrastructure as code, scaling, and cost control
subtopic: Bicep fundamentals, modules, and reusable environment definitions
category: Azure
---

## Overview

Bicep is Azure's domain-specific language for declarative infrastructure as code. Instead of writing imperative scripts that create resources step by step, a Bicep file describes the desired Azure resources, properties, relationships, parameters, and outputs. Azure Resource Manager then orchestrates deployment.

Bicep matters because production Azure environments need repeatable infrastructure, reviewable changes, environment consistency, secure parameter handling, and predictable deployments. It is commonly used for resource groups, App Service, Azure SQL, Key Vault, managed identities, role assignments, networking, monitoring, and platform configuration.

For interviews, candidates should be able to explain idempotency, scopes, parameters, variables, resources, outputs, modules, `.bicepparam` files, secrets, what-if, complete versus incremental thinking, module registries, environment-specific configuration, and how Bicep fits into CI/CD.

## Core Concepts

### Declarative Infrastructure

Bicep is declarative. You describe what Azure should look like, not the exact sequence of commands to get there.

```bicep
param location string = resourceGroup().location
param storageAccountName string

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}
```

The deployment engine determines ordering from resource references and dependencies.

### Idempotency

Bicep deployments are intended to be repeatable. If a resource already exists with the desired configuration, redeploying should not recreate it unnecessarily.

This enables:

- CI/CD-driven infrastructure changes.
- Recovery from failed deployments.
- Drift correction.
- Environment rebuilds.
- Pull-request review of infrastructure changes.

Idempotency does not mean every change is safe. Changing a SKU, name, region, network rule, or data setting can still have operational consequences.

### Bicep and ARM Templates

Bicep is a more readable abstraction over Azure Resource Manager templates. Bicep compiles to ARM JSON templates during deployment.

Important implications:

- Bicep supports Azure resource types and API versions supported by ARM.
- ARM deployment behavior still applies.
- Bicep does not maintain a separate state file.
- Azure stores deployment state and resource state.
- You can use what-if to preview changes.

### Deployment Scopes

Bicep can deploy to different scopes:

- Resource group.
- Subscription.
- Management group.
- Tenant.

Choose scope based on what the template creates. A resource group-scoped template can deploy App Service and storage accounts. A subscription-scoped template can create resource groups and assign policies. Management group and tenant scopes are used for governance.

### Parameters

Parameters are values supplied to a Bicep file at deployment time. They make templates reusable across environments.

```bicep
@allowed([
  'dev'
  'test'
  'prod'
])
param environmentName string

@minValue(1)
@maxValue(10)
param appInstanceCount int = 1
```

Use decorators such as `@allowed`, `@minValue`, `@maxValue`, `@description`, and `@secure` to make contracts clearer and safer.

### Variables

Variables compute values inside a template. They reduce repetition and make naming or tagging rules consistent.

```bicep
var namePrefix = 'contoso-${environmentName}'
var commonTags = {
  environment: environmentName
  workload: 'orders'
}
```

Use variables for derived values, not for values that should be supplied by the environment or pipeline.

### Resources

Resources declare Azure objects.

```bicep
resource appPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan'
  location: location
  sku: {
    name: environmentName == 'prod' ? 'P1v3' : 'B1'
    capacity: environmentName == 'prod' ? 2 : 1
  }
}
```

Good resource declarations use stable names, explicit API versions, consistent tags, and environment-aware settings.

### Outputs

Outputs expose values from a deployment for later pipeline steps or dependent templates.

```bicep
output appServiceName string = app.name
output appUrl string = 'https://${app.properties.defaultHostName}'
```

Avoid outputting secrets. Outputs can be visible in deployment history.

### Existing Resources

Use `existing` when a template needs to reference a resource it does not create.

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}
```

This is common for shared Key Vaults, existing virtual networks, shared log workspaces, or centralized identities.

### Dependencies

Bicep infers dependencies when one resource references another by symbolic name.

```bicep
resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appPlan.id
  }
}
```

Avoid manual `dependsOn` unless inference is not possible. Excessive explicit dependencies can serialize deployments and hide the actual resource relationship.

### Modules

A module is a Bicep file deployed by another Bicep file. Modules encapsulate related resources and support reuse.

```bicep
module webApp './modules/web-app.bicep' = {
  params: {
    name: appName
    location: location
    appServicePlanId: appPlan.id
    tags: commonTags
  }
}
```

Use modules for stable boundaries such as:

- Web app plus settings.
- Storage account plus containers.
- Key Vault plus diagnostics.
- SQL server plus database.
- Monitoring resources.

Do not create tiny modules for every single property. Module boundaries should match ownership and reuse.

### Module Outputs

Modules can expose outputs to the parent template.

```bicep
module app './modules/web-app.bicep' = {
  params: {
    name: appName
    location: location
  }
}

output appHostname string = app.outputs.defaultHostName
```

Use outputs to connect modules without duplicating naming logic.

### Module Registry and Template Specs

Shared modules can be published to a private registry or packaged as template specs. This helps organizations standardize patterns such as secure storage, diagnostics, networking, and identity.

Use shared modules when:

- The pattern is used by multiple teams.
- Security and compliance settings must be consistent.
- Versioning and review are required.
- A platform team owns the baseline.

Avoid central modules that become so generic they are impossible to understand.

### Parameter Files

`.bicepparam` files separate environment values from the main template.

```bicep
using './main.bicep'

param environmentName = 'dev'
param location = 'eastus'
param appSku = 'B1'
param minInstanceCount = 1
```

Use separate parameter files such as:

```text
main.dev.bicepparam
main.test.bicepparam
main.prod.bicepparam
```

This keeps the infrastructure definition consistent while allowing environment-specific capacity, region, naming, and feature choices.

### Reusable Environment Definitions

A reusable environment definition usually combines:

- A shared `main.bicep`.
- Modules for resource groups, app hosting, data, identity, networking, and monitoring.
- Environment-specific `.bicepparam` files.
- Tags for ownership and cost attribution.
- Naming conventions.
- Secure parameter handling.
- Pipeline stages that pass the correct parameters.

Example layout:

```text
infra/
  main.bicep
  main.dev.bicepparam
  main.test.bicepparam
  main.prod.bicepparam
  modules/
    app-service.bicep
    key-vault.bicep
    monitoring.bicep
    sql-database.bicep
```

This is easier to review than maintaining unrelated templates for every environment.

### Secrets

Do not store passwords, connection strings, or certificates in parameter files. Parameter files are source-controlled plain text unless you build a separate secure process.

Use:

- Key Vault references.
- Managed identities.
- `@secure()` parameters only when the secret must be passed.
- Pipeline secret variables only when unavoidable.
- No secret outputs.

Prefer identity and Key Vault over injecting secrets into templates.

### What-If

What-if previews planned resource changes before deployment. It helps reviewers understand whether a template will create, modify, or delete resources.

Typical pipeline flow:

```text
bicep build
bicep lint
az deployment group what-if
approval
az deployment group create
```

What-if is not a substitute for review or testing, but it is a strong guardrail.

### Validation and Linting

Use Bicep build and linting in CI:

```bash
az bicep build --file infra/main.bicep
az bicep lint --file infra/main.bicep
```

Validation catches syntax, type, and rule issues before deployment. Organization-specific policies should also be enforced with Azure Policy, pipeline checks, and pull-request review.

### Incremental and Complete Thinking

Most deployments use incremental behavior: resources declared in the template are created or updated, and unrelated resources are left alone.

Complete-mode style thinking is dangerous unless the template truly owns everything in scope. Accidentally removing resources can cause outages.

For environment definitions, be explicit about ownership:

- Which resources are managed by this template?
- Which resources are referenced as existing?
- Which resources are intentionally outside the deployment?

### Naming and Tags

Names and tags are not decoration. They support operations, cost attribution, automation, and security.

Common tags:

```text
environment
workload
owner
costCenter
dataClassification
managedBy
```

Names should be deterministic but not leak sensitive business details.

### Common Mistakes

- Copying portal-generated templates without simplifying them.
- Hardcoding production values in `main.bicep`.
- Storing secrets in parameter files.
- Creating modules with unclear ownership.
- Overusing explicit `dependsOn`.
- Ignoring what-if output.
- Not pinning meaningful API versions.
- Mixing manually managed and IaC-managed settings without ownership rules.
- Using one giant template with no modular boundaries.
- Making dev and prod templates drift.

### Best Practices

- Keep the desired infrastructure in source control.
- Use modules for real reuse and ownership boundaries.
- Use `.bicepparam` files for environment differences.
- Use what-if before production deployments.
- Use linting and pull requests.
- Keep secrets in Key Vault or identity-based access.
- Tag resources consistently.
- Prefer managed identities over connection strings.
- Document module contracts with parameters and outputs.
- Review cost and reliability differences between environments intentionally.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Bicep?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q01 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Bicep is a declarative infrastructure-as-code language for deploying Azure resources. It provides a more concise syntax than ARM JSON templates and compiles to ARM templates for deployment through Azure Resource Manager.

It is used to define repeatable Azure infrastructure such as App Service, storage, databases, identities, role assignments, networking, and monitoring.

##### Key Points to Mention

- Azure-specific declarative language.
- Compiles to ARM templates.
- Supports parameters, resources, modules, and outputs.
- Deployments are repeatable and idempotent.
- No separate state file is managed by the user.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q01 -->

#### What does idempotent infrastructure deployment mean?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q02 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Idempotent deployment means the same template can be applied repeatedly and Azure converges resources toward the same desired state. If a resource already matches the template, it should not be recreated unnecessarily.

This makes infrastructure safe to deploy through CI/CD and helps reduce drift between environments.

##### Key Points to Mention

- Repeated deployment should produce the same desired state.
- Useful for CI/CD and recovery.
- Azure Resource Manager handles orchestration.
- Idempotent does not mean risk-free.
- Changes still need review and testing.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q02 -->

#### What are Bicep parameters used for?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q03 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Parameters let a Bicep file accept values at deployment time. They make a template reusable across environments by allowing values such as location, environment name, SKU, instance count, and resource names to vary.

Parameters should be constrained with decorators where appropriate and should avoid storing secrets directly in parameter files.

##### Key Points to Mention

- Parameters are deployment-time inputs.
- They support reuse across dev, test, and production.
- Decorators can validate allowed values or ranges.
- Sensitive values need secure handling.
- Parameter files can provide environment-specific values.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q03 -->

#### What is a Bicep module?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q04 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A Bicep module is a Bicep file that is deployed from another Bicep file. Modules encapsulate related resources and make templates easier to read, reuse, and maintain.

For example, a web app module can deploy an App Service app, app settings, diagnostics, and identity settings behind a clear parameter and output contract.

##### Key Points to Mention

- Modules encapsulate related resources.
- Modules accept parameters and expose outputs.
- They improve reuse and readability.
- They can be local or shared through a registry.
- Module boundaries should match real ownership or reuse.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you structure Bicep for dev, test, and production environments?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q01 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use one shared infrastructure definition with modules and separate environment parameter files. For example, `main.bicep` calls modules for app hosting, data, identity, and monitoring, while `main.dev.bicepparam`, `main.test.bicepparam`, and `main.prod.bicepparam` provide environment-specific values such as SKUs, capacity, regions, names, and feature flags.

This keeps structure consistent while allowing production to use stronger reliability, scale, and security settings.

##### Key Points to Mention

- Shared template prevents environment drift.
- Parameter files hold environment differences.
- Modules define reusable boundaries.
- Production can have different SKU and capacity.
- Secrets should not be stored in parameter files.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q01 -->

#### How should secrets be handled in Bicep deployments?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q02 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Avoid storing secrets in Bicep files, parameter files, outputs, or deployment logs. Prefer managed identities and Key Vault references. If a secret must be passed as a parameter, mark it secure and source it from a secure pipeline secret or Key Vault.

Do not output secrets because deployment outputs can be visible in deployment history.

##### Key Points to Mention

- Prefer identity over secrets.
- Use Key Vault for secret storage.
- Do not commit secrets in `.bicepparam` files.
- Mark sensitive parameters secure when needed.
- Never expose secrets through outputs.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q02 -->

#### What is the purpose of what-if in Bicep deployment?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q03 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

What-if previews the changes Azure Resource Manager expects to make before deployment. It can show resources that will be created, modified, deleted, or left unchanged. This helps reviewers catch unexpected changes before they affect production.

What-if should be part of the review process, especially for production infrastructure changes, but it does not replace human review or environment testing.

##### Key Points to Mention

- Previews planned deployment changes.
- Helps detect accidental modifications or deletions.
- Useful in pull requests and release approvals.
- Should be paired with linting and review.
- Not a full substitute for testing.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q03 -->

#### How do Bicep dependencies work?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q04 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Bicep infers dependencies when a resource uses another resource's symbolic name or output. Azure Resource Manager uses that dependency graph to deploy resources in the correct order and parallelize where possible.

Manual `dependsOn` should be used only when implicit dependency inference is not possible. Overusing explicit dependencies can slow deployments and make templates harder to understand.

##### Key Points to Mention

- Symbolic references create implicit dependencies.
- ARM orchestrates resource order.
- Independent resources can deploy in parallel.
- Explicit `dependsOn` is sometimes needed but should be rare.
- Dependencies should reflect real resource relationships.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design reusable Bicep modules for a platform team?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q01 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Start with repeated, policy-sensitive patterns such as secure storage accounts, Key Vault, diagnostics, App Service, private networking, and managed identity. Define modules with clear parameters, safe defaults, outputs, tags, diagnostics, and optional features. Version the modules and publish them through a private registry or another approved sharing mechanism.

The platform team should document contracts, test modules in representative environments, avoid excessive generic complexity, and provide upgrade guidance for consumers.

##### Key Points to Mention

- Build modules around repeated secure patterns.
- Use versioning and clear contracts.
- Provide safe defaults and diagnostics.
- Publish through a controlled sharing mechanism.
- Avoid modules that become overly abstract.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q01 -->

#### How would you prevent drift between manually changed Azure resources and Bicep?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q02 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Define which resources and settings are owned by Bicep and discourage portal changes except for emergency operations. Use pull requests, deployment history, what-if, Azure Policy, resource locks where appropriate, and periodic redeployment or drift checks. Emergency portal changes should be captured back into source control quickly.

For shared or externally managed resources, reference them as existing resources and document ownership boundaries.

##### Key Points to Mention

- Source control should be the desired state.
- What-if helps detect unexpected differences.
- Azure Policy can enforce guardrails.
- Emergency manual changes need follow-up commits.
- Ownership boundaries must be explicit.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q02 -->

#### How do you balance reusable environment definitions with environment-specific differences?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q03 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep the resource topology and module contracts consistent, but allow environment-specific parameters for capacity, SKUs, regions, availability zones, retention, backup, and feature flags. Production should usually have stronger reliability and security settings than dev, while dev may use smaller tiers for cost control.

Avoid forking entire templates per environment because the environments will drift. Also avoid making one template so parameterized that nobody can reason about it.

##### Key Points to Mention

- Share structure and module contracts.
- Vary capacity, region, reliability, and cost settings.
- Avoid copy-paste environment templates.
- Avoid excessive parameter complexity.
- Review production differences deliberately.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q03 -->

#### What should a production Bicep deployment pipeline check before applying changes?

<!-- question:start:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q04 -->
<!-- question-id:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

It should build and lint Bicep, validate parameter files, run what-if against the target scope, enforce policy or security checks, review expected cost and SKU changes, require approval for sensitive environments, and deploy using least-privilege federated identity. After deployment, it should verify outputs, application health, and diagnostic settings.

The goal is to catch both syntax errors and dangerous operational changes before they affect production.

##### Key Points to Mention

- Build, lint, and validate before deployment.
- Run what-if for production.
- Enforce security and policy checks.
- Use least-privilege pipeline identity.
- Verify health after deployment.

<!-- question:end:bicep-fundamentals-modules-and-reusable-environment-definitions-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
