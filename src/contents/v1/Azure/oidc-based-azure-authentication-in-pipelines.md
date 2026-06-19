---
id: oidc-based-azure-authentication-in-pipelines
topic: Delivery, infrastructure as code, scaling, and cost control
subtopic: OIDC-based Azure authentication in pipelines
category: Azure
---

## Overview

OIDC-based Azure authentication lets CI/CD pipelines authenticate to Azure without storing long-lived client secrets. Instead of keeping a password in GitHub Actions secrets or an Azure DevOps service connection, the pipeline receives a short-lived OpenID Connect token from the CI/CD platform. Microsoft Entra ID trusts that token through a federated credential and exchanges it for an Azure access token.

This pattern is commonly called workload identity federation. It is now the preferred direction for many Azure pipeline integrations because it reduces secret leakage risk and makes authentication more tied to the pipeline's identity, repository, branch, environment, or service connection.

For interviews, candidates should be able to explain the trust flow, why it is safer than client secrets, how GitHub Actions and Azure DevOps differ, what claims are trusted, why `id-token: write` matters in GitHub Actions, how service connections work in Azure DevOps, and how to apply least privilege.

## Core Concepts

### The Problem with Long-Lived Secrets

Traditional pipeline authentication often uses:

- Service principal client secrets.
- Publish profiles.
- Stored passwords.
- Long-lived certificates.

These create risks:

- Secrets can be copied from logs, variables, or developer machines.
- Rotation is often forgotten.
- A leaked secret can be used outside the pipeline.
- The secret may have broad Azure permissions.
- Pull-request or third-party action compromise can expose credentials.

OIDC reduces these risks by replacing stored deployment passwords with short-lived tokens and explicit trust rules.

### OIDC

OpenID Connect is an identity layer on top of OAuth 2.0. In a CI/CD context, the pipeline platform acts as an issuer of identity tokens for jobs.

The token contains claims such as:

- Issuer.
- Subject.
- Audience.
- Repository or project information.
- Branch, tag, environment, or service connection context.
- Job identity details.

Microsoft Entra ID validates the token against a configured federated credential before issuing Azure tokens.

### Workload Identity Federation

Workload identity federation creates a trust relationship between Microsoft Entra ID and an external workload identity provider such as GitHub Actions or Azure DevOps.

The basic flow:

1. A pipeline job starts.
2. The CI/CD provider issues an OIDC token for the job.
3. Azure login or a service connection presents that token to Microsoft Entra ID.
4. Microsoft Entra ID validates issuer, subject, and audience.
5. Microsoft Entra ID returns a short-lived access token.
6. The pipeline uses that token to deploy Azure resources.

No client secret is stored in the pipeline.

### Federated Credential

A federated credential is configured on a Microsoft Entra application or user-assigned managed identity. It specifies which external token should be trusted.

Important fields include:

- Issuer.
- Subject.
- Audience.
- Name.
 
The subject should be as narrow as practical. For example, trust only a specific repository branch or production environment rather than every workflow in an organization.

### GitHub Actions OIDC Flow

For GitHub Actions, the workflow must request permission to obtain an OIDC token:

```yaml
permissions:
  id-token: write
  contents: read
```

Then use Azure Login:

```yaml
- name: Azure login
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

The client ID, tenant ID, and subscription ID identify the trusted application or managed identity. They are identifiers, not secrets.

### GitHub Subject Scoping

GitHub OIDC subject claims can be scoped to repository, branch, tag, pull request, or environment patterns.

Examples of intent:

```text
Only main branch can deploy dev.
Only a protected production environment can deploy prod.
Pull requests cannot get production Azure tokens.
Release tags can deploy staging.
```

Use GitHub environments with required reviewers for production. The OIDC trust should align with the protected environment or branch policy.

### Azure DevOps Workload Identity Federation

Azure DevOps uses Azure Resource Manager service connections for Azure deployments. For new service connections, workload identity federation is recommended over service principal secrets.

The service connection represents:

- The Azure target scope.
- The identity used by the pipeline.
- The authentication method.
- Which pipelines are authorized to use it.

Avoid granting access to all pipelines by default. Authorize only the pipelines that need the connection.

### App Registration Versus Managed Identity

Federation can use a Microsoft Entra app registration or a user-assigned managed identity.

Use an app registration when:

- You want a pipeline identity not tied to an Azure resource.
- Your organization already manages deployment identities this way.
- You need broad compatibility.

Use a user-assigned managed identity when:

- You want an Azure-managed workload identity.
- A platform team owns identity lifecycle in Azure.
- You want to avoid app registration creation permissions for project teams.

Both still need least-privilege RBAC.

### RBAC Scope

The federated identity only authenticates the pipeline. Authorization still comes from Azure RBAC.

Scope permissions as narrowly as practical:

- Resource group for app team deployments.
- Subscription only when resources across many groups are needed.
- Management group only for governance pipelines.
- Specific roles instead of Owner when possible.

Common deployment roles may include Contributor plus specific role-assignment permissions when needed. Avoid Owner unless the pipeline truly needs to manage access.

### Separate Identities by Environment

Use different identities or service connections for dev, test, and production.

Benefits:

- Pull requests cannot accidentally deploy production.
- Compromising a lower environment does not grant production access.
- Audit logs show which environment identity acted.
- Production can require stricter approvals.
- RBAC can be tailored per environment.

One identity for everything is convenient until it becomes a blast-radius problem.

### Least Privilege

A pipeline identity should have only the permissions needed for its job.

Examples:

- App deployment identity can deploy to one App Service.
- Infrastructure identity can deploy to one resource group.
- Read-only validation identity can run what-if.
- Production identity can be used only from protected branches or environments.

Avoid assigning broad permissions just to make a pipeline pass. Fix the missing permission deliberately.

### Token Lifetime and Replay Risk

OIDC tokens and Azure access tokens are short-lived. This reduces risk but does not make pipelines automatically safe.

Still protect:

- Workflow files.
- Branch policies.
- Third-party actions.
- Self-hosted runners.
- Logs.
- Environment approvals.
- Federated credential subject patterns.

If an attacker can modify trusted pipeline YAML on a trusted branch, they may be able to use the federated identity.

### Pull Requests from Forks

Treat pull requests from forks and untrusted contributors carefully. They should not receive deployment permissions or access to production environments.

Safe pattern:

- Run build and tests with minimal permissions.
- Do not grant Azure tokens.
- Do not expose environment secrets.
- Require merge to protected branch before deployment.

OIDC does not remove the need for source control trust boundaries.

### Environments and Approvals

OIDC trust should align with deployment gates.

For GitHub Actions:

- Use protected environments for production.
- Require reviewers.
- Scope federated credentials to the environment where practical.

For Azure DevOps:

- Use environment checks and approvals.
- Restrict service connection use.
- Use separate service connections per environment.

The authentication policy should match the release policy.

### Auditing

Audit both sides:

- Pipeline run history.
- Environment approvals.
- Service connection usage.
- Microsoft Entra sign-in logs.
- Azure Activity Log deployment operations.
- Role assignment changes.
- Federated credential changes.

During an incident, you need to know which pipeline identity changed which resource from which run.

### Secretless Does Not Mean Riskless

OIDC removes stored secrets, but it does not secure bad deployment design.

Risks remain:

- Overbroad Azure RBAC.
- Unprotected production branch.
- Unsafe third-party action.
- Compromised self-hosted runner.
- Federated credential with overly broad subject.
- Pipeline YAML injection.
- No approval on production environment.

Treat pipeline code as privileged production code.

### Common Mistakes

- Thinking `AZURE_CLIENT_ID` is a secret.
- Granting Contributor at subscription scope for every pipeline.
- Using one identity for every environment.
- Trusting all branches or all repositories.
- Allowing all pipelines to use an Azure DevOps service connection.
- Giving pull-request workflows deployment permissions.
- Storing a client secret "just in case" after enabling OIDC.
- Not auditing federated credential changes.
- Using third-party actions without review.
- Forgetting that RBAC controls authorization after authentication.

### Best Practices

- Prefer OIDC or workload identity federation over long-lived secrets.
- Scope federated credentials narrowly.
- Use separate identities per environment.
- Use protected branches and environments.
- Assign least-privilege Azure roles.
- Avoid granting service connections to all pipelines.
- Keep pipeline YAML reviewed and protected.
- Pin or review third-party actions.
- Audit deployments and identity use.
- Rotate away old secrets after migration.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is OIDC-based Azure authentication in pipelines?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-beginner-q01 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

OIDC-based Azure authentication lets a CI/CD pipeline exchange a short-lived identity token from the pipeline provider for an Azure access token through Microsoft Entra ID. This avoids storing a long-lived client secret in the pipeline.

The trust is configured through a federated credential on an app registration or managed identity.

##### Key Points to Mention

- Uses OpenID Connect tokens.
- Avoids long-lived secrets.
- Requires Microsoft Entra federated credential.
- Azure RBAC still controls permissions.
- Common in GitHub Actions and Azure DevOps.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-beginner-q01 -->

#### Why is OIDC better than storing a client secret?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-beginner-q02 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

OIDC avoids storing a reusable password-like secret. The pipeline receives short-lived tokens only when a trusted job runs. If configured narrowly, tokens are tied to a specific repository, branch, environment, or service connection.

This reduces the risk of leaked secrets, stale credentials, and forgotten rotation. It does not remove the need for least privilege and protected pipelines.

##### Key Points to Mention

- No long-lived secret stored in CI/CD.
- Tokens are short-lived.
- Trust can be scoped with claims.
- Secret rotation burden is reduced.
- RBAC and pipeline protection still matter.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-beginner-q02 -->

#### What is a federated credential?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-beginner-q03 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A federated credential is a trust configuration on a Microsoft Entra application or managed identity. It tells Microsoft Entra ID which external OIDC tokens should be accepted, based on issuer, subject, and audience.

For a pipeline, it connects a specific workflow or service connection identity to an Azure identity without using a secret.

##### Key Points to Mention

- Configured in Microsoft Entra ID.
- Trusts an external token issuer.
- Checks issuer, subject, and audience.
- Can be attached to an app registration or managed identity.
- Should be scoped narrowly.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-beginner-q03 -->

#### What does `id-token: write` do in GitHub Actions?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-beginner-q04 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`id-token: write` gives a GitHub Actions job permission to request an OIDC token from GitHub. Without it, the Azure login action cannot obtain the token needed for OIDC authentication.

It should be granted only to jobs that actually need cloud authentication.

##### Key Points to Mention

- Required for GitHub OIDC token issuance.
- Used by Azure Login with OIDC.
- It is a job or workflow permission.
- Do not grant it to unnecessary jobs.
- It does not by itself grant Azure permissions.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How does the OIDC token exchange flow work?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-intermediate-q01 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The pipeline requests an OIDC token from its CI/CD provider. The Azure login step or service connection sends that token to Microsoft Entra ID. Microsoft Entra ID validates the token issuer, subject, and audience against the configured federated credential. If it matches, Entra ID issues an Azure access token for the associated application or managed identity.

The pipeline then uses that Azure token to call ARM, Azure CLI, Azure PowerShell, or deployment tasks.

##### Key Points to Mention

- CI/CD provider issues the OIDC token.
- Entra ID validates federated credential claims.
- Azure access token is short-lived.
- RBAC determines what the token can do.
- No client secret is exchanged.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-intermediate-q01 -->

#### How would you scope OIDC trust for production safely?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-intermediate-q02 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Scope trust to the specific repository, protected branch, tag, or environment that is allowed to deploy production. Use protected environments or approvals so production tokens are issued only after review. Use a separate production identity with only the permissions required for production deployment.

Do not trust all branches or all repositories unless there is a strong reason and compensating controls.

##### Key Points to Mention

- Narrow subject claims.
- Use protected branches and environments.
- Separate production identity.
- Require approval before production deployment.
- Avoid broad organization-wide trust.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-intermediate-q02 -->

#### How does Azure DevOps workload identity federation differ from GitHub Actions OIDC?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-intermediate-q03 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

GitHub Actions commonly uses the Azure Login action with an app registration or managed identity and workflow OIDC permissions. Azure DevOps typically uses an Azure Resource Manager service connection configured for workload identity federation.

In both cases, Microsoft Entra ID trusts a token from the CI/CD platform and issues Azure tokens. The management surface and policy controls differ.

##### Key Points to Mention

- GitHub uses workflow permissions and Azure Login.
- Azure DevOps uses service connections.
- Both rely on federated credentials.
- Both avoid long-lived client secrets.
- Both still require Azure RBAC and environment controls.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-intermediate-q03 -->

#### What Azure RBAC permissions should a pipeline identity receive?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-intermediate-q04 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Give the identity only the permissions needed at the narrowest practical scope. An app deployment identity might need access to a specific App Service. An infrastructure identity might need Contributor on one resource group. A governance pipeline might need broader scope, but that should be rare and reviewed.

Avoid Owner unless the pipeline truly needs to manage role assignments. Separate identities by environment.

##### Key Points to Mention

- Authentication and authorization are separate.
- Scope RBAC to resource group or resource where possible.
- Avoid broad subscription permissions.
- Avoid Owner unless required.
- Use different identities per environment.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you migrate a pipeline from client secrets to OIDC?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-advanced-q01 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Inventory current identities, secrets, scopes, roles, pipelines, and environments. Create a federated credential on an app registration or user-assigned managed identity. Update the pipeline to use OIDC or workload identity federation, run in a nonproduction environment, verify RBAC, audit logs, and deployment behavior, then migrate production behind environment approvals.

After cutover, remove old client secrets, update documentation, and monitor sign-in and deployment logs for unexpected use.

##### Key Points to Mention

- Inventory existing secret-based access.
- Create federated credentials with narrow claims.
- Test in nonproduction first.
- Remove old secrets after migration.
- Verify audit logs and RBAC behavior.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-advanced-q01 -->

#### How can OIDC be misconfigured dangerously?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-advanced-q02 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Dangerous misconfigurations include trusting all branches or repositories, assigning subscription Owner to the pipeline identity, letting all Azure DevOps pipelines use the same service connection, allowing pull-request workflows to request deployment tokens, and failing to protect production workflow files.

OIDC removes a stored secret, but if the trust and RBAC are broad, a compromised workflow can still deploy or modify Azure resources.

##### Key Points to Mention

- Broad subject claims increase blast radius.
- Overbroad RBAC is still dangerous.
- Production workflows must be protected.
- Pull-request jobs should not get production tokens.
- Service connection authorization should be restricted.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-advanced-q02 -->

#### How would you audit pipeline authentication and deployment activity?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-advanced-q03 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Correlate CI/CD run history, environment approvals, service connection usage, Microsoft Entra sign-in logs, Azure Activity Log, deployment history, and role assignment changes. Ensure each environment identity has a clear display name and tags or documentation that identify its owner and purpose.

During incident response, you should be able to answer which run used which identity to change which Azure resource.

##### Key Points to Mention

- Check pipeline run history.
- Review Entra sign-in logs.
- Review Azure Activity Log and deployments.
- Audit service connection usage.
- Use clear identity naming and ownership.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-advanced-q03 -->

#### How should self-hosted runners affect OIDC threat modeling?

<!-- question:start:oidc-based-azure-authentication-in-pipelines-advanced-q04 -->
<!-- question-id:oidc-based-azure-authentication-in-pipelines-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Self-hosted runners can access local networks, caches, files, and tooling that hosted runners cannot. If compromised, they may request OIDC tokens for trusted jobs and interact with internal systems. Use runner isolation, ephemeral runners where possible, restricted job assignment, minimal local secrets, patching, monitoring, and separate runners for production deployments.

OIDC protects against stored cloud secrets, but it does not protect a compromised runner that is allowed to run trusted deployment jobs.

##### Key Points to Mention

- Runner trust is part of cloud auth trust.
- Use isolation and least privilege.
- Prefer ephemeral or dedicated production runners.
- Do not run untrusted pull requests on privileged runners.
- Monitor runner and deployment activity.

<!-- question:end:oidc-based-azure-authentication-in-pipelines-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
