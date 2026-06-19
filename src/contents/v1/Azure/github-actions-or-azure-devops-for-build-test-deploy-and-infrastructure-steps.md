---
id: github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps
topic: Delivery, infrastructure as code, scaling, and cost control
subtopic: GitHub Actions or Azure DevOps for build, test, deploy, and infrastructure steps
category: Azure
---

## Overview

GitHub Actions and Azure DevOps Pipelines both automate software delivery. They can build code, run tests, package artifacts, deploy infrastructure, deploy applications, run database migrations, perform security checks, and promote releases across environments.

The exact YAML syntax differs, but the delivery principles are similar:

- Build once from a known commit.
- Run tests before deployment.
- Publish immutable artifacts.
- Deploy infrastructure as code.
- Deploy applications using environment-specific configuration.
- Use least-privilege Azure authentication.
- Gate production with approvals and checks.
- Verify health after deployment.
- Keep secrets out of source control.

For interviews, strong answers explain pipeline stages, artifacts, environments, approvals, deployment jobs, service connections, OIDC or workload identity federation, Bicep deployment, rollback strategy, test placement, and why deployment automation must be both repeatable and observable.

## Core Concepts

### CI and CD

Continuous integration validates code changes frequently. Continuous delivery or deployment moves validated changes through environments.

Typical stages:

```text
Build -> Test -> Package -> Deploy infrastructure -> Deploy application -> Verify -> Promote
```

CI answers:

- Does the code compile?
- Do tests pass?
- Is the artifact valid?
- Are security and quality checks acceptable?

CD answers:

- Can the artifact be safely deployed?
- Is the target environment ready?
- Did the release pass health checks?
- Can the release be rolled back?

### GitHub Actions

GitHub Actions workflows live in `.github/workflows`. They run jobs in response to events such as pull requests, pushes, tags, schedules, or manual dispatch.

Example workflow shape:

```yaml
name: build-and-deploy

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'
      - run: dotnet restore
      - run: dotnet build --configuration Release --no-restore
      - run: dotnet test --configuration Release --no-build
```

Jobs should be small enough to understand and explicit enough to reproduce locally when needed.

### Azure DevOps Pipelines

Azure DevOps YAML pipelines are made of stages, jobs, and steps. They can target environments and use service connections for Azure access.

Example shape:

```yaml
trigger:
  branches:
    include:
      - main

stages:
- stage: Build
  jobs:
  - job: BuildAndTest
    pool:
      vmImage: ubuntu-latest
    steps:
    - task: UseDotNet@2
      inputs:
        packageType: sdk
        version: 9.0.x
    - script: dotnet restore
    - script: dotnet build --configuration Release --no-restore
    - script: dotnet test --configuration Release --no-build
```

Azure DevOps environments can add deployment history, approvals, checks, and environment-specific controls.

### Build Once, Deploy Many

A release should promote the same artifact through environments rather than rebuilding separately for dev, test, and production.

Benefits:

- The tested artifact is the deployed artifact.
- Production deployment is more predictable.
- Rollback can reference a known package.
- Supply-chain evidence is clearer.

Environment differences should come from configuration, parameters, and infrastructure settings, not from rebuilding different binaries.

### Artifacts

Artifacts are versioned outputs from a pipeline run. Examples:

- Web app package.
- Container image.
- Bicep files and parameter files.
- Database migration package.
- Test results.
- Software bill of materials.

Artifacts should be immutable after publication. If an artifact must change, produce a new version.

### Infrastructure Step

Infrastructure deployment often uses Bicep.

GitHub Actions example:

```yaml
- name: Azure login
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Deploy infrastructure
  run: |
    az deployment group create \
      --resource-group rg-orders-prod \
      --parameters infra/main.prod.bicepparam
```

Azure DevOps can use Azure CLI tasks, Azure PowerShell tasks, or ARM/Bicep deployment tasks through an Azure Resource Manager service connection.

### What-If Before Apply

For production infrastructure, run what-if before applying changes:

```bash
az deployment group what-if \
  --resource-group rg-orders-prod \
  --parameters infra/main.prod.bicepparam
```

Use what-if output during approval so reviewers see the expected resource changes.

### Application Deployment Step

Application deployment depends on the hosting model:

- App Service package deployment.
- Container image push and app revision update.
- Azure Functions deployment.
- AKS manifest or Helm deployment.
- Static Web App deployment.
- Database migration.

A safe app deployment should know:

- Which artifact is being deployed.
- Which environment is targeted.
- Which identity is performing the deployment.
- What health checks must pass.
- How to roll back.

### Separate Build and Deploy Permissions

Build jobs usually need source and artifact permissions. Deploy jobs need Azure permissions. Keep these identities separate where practical.

Benefits:

- Pull-request validation does not need production access.
- Compromised test jobs cannot deploy.
- Production approvals can control when deployment identity is used.
- Least privilege is easier to reason about.

### Environments and Approvals

Use environments or protected deployments for test, staging, and production.

Common gates:

- Manual approval for production.
- Required checks.
- Branch restrictions.
- Required reviewers.
- Change ticket validation.
- Security scan completion.
- What-if review.

Approval should be meaningful. Do not ask humans to approve blind deployments with no diff, test result, or health context.

### Variables and Secrets

Use variables for non-secret configuration and secret stores for sensitive data.

Examples of variables:

- Environment name.
- Region.
- Resource group name.
- SKU.
- Feature flag.

Examples of secrets:

- API keys.
- Publish profiles.
- Client secrets.
- Connection strings.

Prefer OIDC or workload identity federation over long-lived client secrets.

### Branch and Trigger Strategy

Common pattern:

- Pull request: build, unit test, lint, static analysis, Bicep build.
- Main branch: build, test, publish artifact, deploy to dev.
- Release tag or approval: promote to test or production.

Avoid deploying arbitrary branches to shared environments unless the environment is intentionally isolated.

### Test Placement

Different tests belong at different stages:

- Unit tests during build.
- Static analysis and linting before artifact publication.
- Infrastructure validation before deployment.
- Integration tests after deployment to test environment.
- Smoke tests after production deployment.
- Availability or synthetic tests after traffic shift.

Do not wait until production to discover packaging or infrastructure errors.

### Deployment Strategies

Common strategies:

- Direct deployment for low-risk environments.
- Slot swap for App Service.
- Rolling deployment for multiple instances.
- Canary deployment for controlled traffic exposure.
- Blue-green deployment for fast rollback.

The strategy should match the platform, risk, and rollback needs.

### Database Migrations

Database changes need special care because rollback is harder than app rollback.

Best practices:

- Use backward-compatible migrations.
- Expand before contract.
- Deploy schema changes before app changes when needed.
- Avoid destructive changes in the same release.
- Backup or validate recovery for risky changes.
- Make migration jobs idempotent.

Pipelines should make database changes visible and auditable.

### Pipeline Security

Secure pipeline design includes:

- OIDC or workload identity federation instead of secrets.
- Least-privilege Azure roles.
- Protected environments.
- Required reviews for production.
- Pinning trusted actions or tasks where appropriate.
- Avoiding script injection through untrusted inputs.
- Separating pull-request jobs from deployment jobs.
- Auditing service connection use.

CI/CD is part of the production attack surface.

### Observability After Deployment

A deployment is not done when the command exits. Verify:

- App health endpoint.
- Availability tests.
- Error rate.
- Latency.
- Dependency failures.
- Queue backlog.
- App logs.
- Deployment annotations or release markers.

Good pipelines make release impact visible.

### Common Mistakes

- Rebuilding separately for production.
- Deploying directly from a developer machine.
- Giving every pipeline production contributor rights.
- Storing Azure client secrets in repository secrets.
- Skipping tests for infrastructure changes.
- Running destructive migrations without review.
- Using one pipeline identity for every environment.
- No rollback path.
- No health verification after deployment.
- Treating YAML duplication as harmless forever.

### Best Practices

- Build once and promote artifacts.
- Keep infrastructure as code beside application delivery.
- Run tests before deployment.
- Use environment gates for production.
- Use OIDC or workload identity federation.
- Separate CI validation from CD deployment.
- Deploy infrastructure before application when app depends on it.
- Use what-if for production infrastructure.
- Include smoke tests and health checks.
- Keep pipelines modular but readable.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are GitHub Actions and Azure DevOps Pipelines used for?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q01 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

They are CI/CD systems used to automate software delivery. They can build code, run tests, package artifacts, deploy infrastructure, deploy applications, run checks, and promote releases across environments.

Both use YAML-based pipelines or workflows, but their syntax, marketplace, environment model, and integrations differ.

##### Key Points to Mention

- Automate build, test, package, and deployment.
- Support Azure deployments.
- Can run on repository events and manual triggers.
- Should use secure Azure authentication.
- Production deployments should use approvals or gates.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q01 -->

#### What is the difference between CI and CD?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q02 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Continuous integration validates code changes by building and testing frequently. Continuous delivery or deployment moves validated changes into environments such as dev, test, staging, and production.

CI proves the change is technically valid. CD proves the change can be safely released.

##### Key Points to Mention

- CI runs build and tests.
- CD deploys artifacts and infrastructure.
- CI should run on pull requests.
- CD should use environment controls.
- Both should be repeatable and automated.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q02 -->

#### What does build once, deploy many mean?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q03 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Build once, deploy many means the pipeline creates one immutable artifact from a known source commit and promotes that same artifact through environments. The app should not be rebuilt separately for production.

Environment differences should come from configuration, infrastructure parameters, and deployment settings rather than different binaries.

##### Key Points to Mention

- One artifact is promoted.
- Reduces production surprises.
- Improves traceability.
- Supports rollback to known versions.
- Environment configuration is separate from the artifact.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q03 -->

#### What is a pipeline artifact?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q04 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A pipeline artifact is a versioned output produced by a pipeline run. It can be an application package, container image, test result, deployment manifest, Bicep template package, or other file needed by later stages.

Artifacts help separate build from deployment and make releases traceable.

##### Key Points to Mention

- Artifacts are outputs from a pipeline.
- They should be immutable.
- Deploy stages consume artifacts.
- They improve traceability.
- They support repeatable releases.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should infrastructure deployment fit into a CI/CD pipeline?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q01 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Infrastructure should be deployed from source-controlled IaC such as Bicep. The pipeline should build and lint Bicep, run what-if for review, deploy infrastructure before dependent application code, and use environment-specific parameter files.

Production infrastructure changes should require approval and use a least-privilege identity. The pipeline should verify outputs and resource health after deployment.

##### Key Points to Mention

- Use source-controlled Bicep.
- Validate and lint before deployment.
- Run what-if before production apply.
- Use environment parameter files.
- Deploy with least-privilege identity.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q01 -->

#### How do approvals and environments improve deployment safety?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q02 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Approvals and environments add controlled promotion points. They can require human review, protected branch rules, deployment history, checks, or change-management validation before a job can deploy to production.

They reduce accidental releases and make sensitive environments more auditable. Approvals are most useful when reviewers can see artifacts, test results, what-if output, and risk context.

##### Key Points to Mention

- Environments represent deployment targets.
- Approvals gate sensitive stages.
- Deployment history improves auditability.
- Gates should include useful context.
- Pull-request jobs should not have production access.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q02 -->

#### What tests should run before and after deployment?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q03 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Before deployment, run compilation, unit tests, static analysis, dependency checks, IaC build and lint, and packaging validation. After deployment, run smoke tests, health checks, integration tests in nonproduction, availability checks, and telemetry checks.

Production post-deployment checks should be fast and focused on proving the release is healthy enough to keep serving traffic.

##### Key Points to Mention

- Unit tests belong in CI.
- IaC validation belongs before deployment.
- Integration tests usually need a deployed environment.
- Production smoke tests should be fast and safe.
- Telemetry should confirm health after release.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q03 -->

#### How should database migrations be handled in pipelines?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q04 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Database migrations should be source-controlled, reviewed, tested, and run in a controlled stage. Prefer backward-compatible migrations, such as expand-before-contract, so old and new app versions can both work during rollout. Destructive changes should be separated and require extra review.

Migration jobs should be idempotent or safely repeatable, and risky changes should have backup or recovery plans.

##### Key Points to Mention

- Database rollback is harder than app rollback.
- Use backward-compatible migrations.
- Separate destructive changes.
- Test migrations before production.
- Make migration execution auditable.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a full pipeline for an Azure-hosted .NET API?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q01 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

On pull requests, build, test, lint, scan dependencies, and validate Bicep. On main, build once, publish an immutable artifact, deploy infrastructure to dev with environment parameters, deploy the app, run integration tests, and publish release metadata. For staging and production, promote the same artifact through protected environments with approvals, what-if review, smoke tests, and telemetry verification.

Use OIDC or workload identity federation for Azure access, separate identities per environment, and store secrets in Key Vault or platform secret stores.

##### Key Points to Mention

- Pull requests validate without production access.
- Main creates immutable artifacts.
- Infrastructure and app deployments are staged.
- Production requires approval and health verification.
- Pipeline identities are least privilege and environment scoped.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q01 -->

#### How do you secure CI/CD for production deployments?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q02 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use protected branches or environments, required reviews, OIDC or workload identity federation instead of long-lived secrets, least-privilege Azure roles, separate identities per environment, restricted service connection access, trusted actions or tasks, and audit logs. Pull-request workflows from untrusted contributors should not receive deployment credentials.

Also protect artifacts, verify what is deployed, and avoid passing secrets through logs or command-line output.

##### Key Points to Mention

- Prefer federated identity over secrets.
- Scope permissions per environment.
- Protect production environments.
- Restrict service connection use.
- Treat pipeline YAML as privileged code.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q02 -->

#### How would you handle rollback in a pipeline?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q03 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Rollback depends on the artifact and platform. For App Service, deploy to a slot and swap back if needed. For containers, redeploy the previous image tag or revision. For infrastructure, rollback may mean applying a previous template version, but some changes are not safely reversible. For databases, prefer forward fixes and backward-compatible migrations.

The pipeline should record deployed versions, keep previous artifacts available, and include health gates that stop or reverse rollout before full user impact.

##### Key Points to Mention

- App rollback and database rollback differ.
- Keep previous artifacts available.
- Use slots, revisions, or previous image tags.
- Infrastructure rollback may be limited.
- Health checks should trigger stop or rollback decisions.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q03 -->

#### How do you reduce duplication in pipeline YAML without hiding important behavior?

<!-- question:start:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q04 -->
<!-- question-id:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use reusable workflows, composite actions, templates, or shared task files for repeated build and deployment patterns. Keep environment-specific values in variables or parameters. However, do not abstract so aggressively that reviewers cannot tell what deploys to production or which identity and parameters are used.

Shared pipeline components should be versioned, reviewed, and owned like application code.

##### Key Points to Mention

- Use reusable workflows or templates for repeated patterns.
- Keep production behavior readable.
- Parameterize environment differences.
- Version shared pipeline components.
- Avoid clever abstractions that hide risk.

<!-- question:end:github-actions-or-azure-devops-for-build-test-deploy-and-infrastructure-steps-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
