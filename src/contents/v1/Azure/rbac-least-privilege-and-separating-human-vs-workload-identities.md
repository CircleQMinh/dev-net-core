---
id: rbac-least-privilege-and-separating-human-vs-workload-identities
topic: Identity, secrets, and access control
subtopic: RBAC, least privilege, and separating human vs workload identities
category: Azure
---

## Overview

Azure role-based access control, or Azure RBAC, determines who or what can perform specific actions on Azure resources at a defined scope. A role assignment combines:

- A security principal.
- A role definition.
- A scope.

The security principal can be a user, group, service principal, or managed identity. The role definition lists allowed management-plane actions and, for supported services, data-plane actions. Scope limits where those permissions apply.

Least privilege means granting only the permissions required, at the narrowest practical scope, for the shortest necessary duration. It also means separating duties that should not be controlled by one identity.

Human and workload identities have different behavior:

- Humans sign in interactively, change jobs, use devices, complete MFA, request approval, and can activate eligible roles through Privileged Identity Management.
- Workloads run unattended and need stable, noninteractive access. They use managed identities, service principals, or federated workload identities and cannot complete human activation prompts.

Treating them as interchangeable causes security and operational problems. Applications should not run as employee accounts, people should not share pipeline credentials, and privileged human roles should not be permanently active merely because automation needs access.

For interviews, candidates should explain:

- How principal, role, and scope form a role assignment.
- How scope inheritance and additive permissions affect effective access.
- The difference between management-plane actions and data-plane actions.
- Why `Owner`, `Contributor`, and `User Access Administrator` are high-risk roles.
- How PIM, groups, access reviews, conditions, and separation of duties reduce standing privilege.
- Why workloads need dedicated identities and credential-free authentication.
- How CI/CD, emergency access, production operations, and application runtime identities should differ.
- How to diagnose role-assignment and authorization failures without broadening access.

## Core Concepts

### The Three Parts of a Role Assignment

Every Azure role assignment answers:

1. **Who:** A user, group, service principal, or managed identity.
2. **What:** A built-in or custom role definition.
3. **Where:** Management group, subscription, resource group, or resource scope.

Example:

```text
Principal: orders-api-prod managed identity
Role: Azure Service Bus Data Sender
Scope: production orders topic
```

This is better than:

```text
Principal: orders-api-prod managed identity
Role: Contributor
Scope: production subscription
```

The first assignment expresses the actual runtime need. The second grants broad management authority unrelated to sending messages.

### Security Principal Types

Azure RBAC roles can be assigned to:

- **User:** A human identity.
- **Group:** A collection of users or, in supported designs, other principals.
- **Service principal:** A tenant-local application identity.
- **Managed identity:** A special service principal whose credential is managed by Azure.

Human access is usually easier to govern through groups rather than direct user assignments. Workload access should be assigned to the specific workload identity whose code needs the permission.

Do not grant an application role to a developer's user identity and assume production is configured. Do not use an employee account as a scheduled-task credential.

### Role Definitions

A role definition contains:

- `Actions`: Allowed management-plane operations.
- `NotActions`: Management actions excluded from a broad action set.
- `DataActions`: Allowed data-plane operations.
- `NotDataActions`: Data actions excluded from a broad set.
- Assignable scopes.

Azure RBAC computes effective role permissions as:

```text
Actions - NotActions
DataActions - NotDataActions
```

`NotActions` and `NotDataActions` are not explicit denies. Another role assignment can still grant the excluded permission.

Prefer built-in job-function roles when they fit. Use a custom role when the required operation set is stable, understood, and materially narrower than available built-in roles. Avoid wildcard actions because future provider operations can expand the role unintentionally.

### Management Plane and Data Plane

The management plane creates and configures Azure resources through Azure Resource Manager. The data plane accesses the content or service hosted by a resource.

Examples:

| Management-plane operation | Data-plane operation |
| --- | --- |
| Configure a storage account | Read a blob |
| Configure a Key Vault firewall | Read a secret |
| Create a Service Bus queue | Send a message |
| Change SQL server settings | Query a database |

`Contributor` generally manages resources but does not automatically grant all data access. Service-specific roles such as `Storage Blob Data Reader`, `Key Vault Secrets User`, or `Azure Service Bus Data Sender` grant data actions.

Some powerful management permissions can indirectly lead to data access, such as changing credentials, deploying code, or modifying an authorization configuration. Threat modeling must consider indirect paths, not only listed data actions.

### Scope and Inheritance

Azure scopes form a hierarchy:

```text
Management group
  Subscription
    Resource group
      Resource
```

A role assignment applies to its scope and descendant scopes. A subscription-level assignment affects every resource group and resource in the subscription.

Least privilege therefore has two dimensions:

- Choose the narrowest role.
- Choose the narrowest scope.

A narrow role at the entire subscription may still be excessive. A broad role at one resource may also be excessive.

Design scopes around ownership and operational boundaries. Resource groups are useful lifecycle and authorization boundaries only when their resources genuinely share administration.

### Additive Effective Permissions

Azure RBAC is primarily additive. Effective access is the union of applicable assignments:

- Direct assignments.
- Group assignments.
- Parent-scope assignments.
- Eligible roles after activation.
- Other role assignments at the resource.

Adding `Reader` at a resource does not reduce `Contributor` inherited from the subscription. To understand access, inspect all applicable assignments rather than only the current resource's direct assignments.

Deny assignments can block access but are managed by specific Azure features and are not a general-purpose substitute for careful role design. Role assignment conditions filter a grant; they do not create an arbitrary explicit deny.

### Least Privilege

Least privilege requires answering:

1. Which operations are required?
2. On which resources?
3. For how long?
4. From which identity?
5. Under which conditions?

Practical techniques include:

- Use service-specific roles instead of `Owner` or `Contributor`.
- Assign at a resource or focused resource-group scope.
- Use separate identities for separate workloads.
- Use PIM eligible assignments for human administration.
- Remove obsolete assignments.
- Use access reviews.
- Add role-assignment conditions where supported.
- Use time-bound grants for migrations and incidents.
- Keep production separate from nonproduction.

Least privilege is not a one-time role selection. It is an ongoing lifecycle of provisioning, review, expiry, removal, and incident response.

### Privileged Administrator Roles

Roles with permission to grant access are especially sensitive:

- `Owner` can manage resources and role assignments.
- `User Access Administrator` can manage access.
- `Role Based Access Control Administrator` can manage role assignments.

`Contributor` cannot normally grant Azure roles, but it can make broad resource changes and may obtain indirect access by deploying code, changing configuration, or controlling resource behavior.

Limit subscription owners. Prefer job-function roles. If role-assignment administration must be delegated, use supported conditions to restrict which roles can be assigned, to which principals, and at which scope.

Role-assignment permissions should be separated from workload code deployment where practical. A person who can both deploy arbitrary code and attach a privileged managed identity can exercise that identity's authority.

### Human Identities

Human identities represent employees, contractors, partners, and administrators.

Controls appropriate to humans include:

- Multifactor authentication.
- Conditional Access.
- Managed devices and compliant locations.
- Privileged Identity Management.
- Approval and justification.
- Time-bound role activation.
- Group-based assignments.
- Joiner, mover, and leaver processes.
- Periodic access reviews.
- Separate privileged administration accounts.

Humans need traceability. Shared accounts weaken auditability and make revocation difficult.

Privileged administrators should use separate accounts or controlled privileged access workflows rather than ordinary productivity sessions. Emergency access accounts are exceptional identities with tightly monitored use, protected credentials, tested procedures, and minimal permanent roles.

### Workload Identities

Workload identities represent applications, services, scripts, pipelines, containers, and automation.

In Microsoft Entra ID, common workload identity forms are:

- Managed identities.
- Application registrations and service principals.
- Federated workload identities.

Controls appropriate to workloads include:

- Dedicated identity per workload boundary.
- Managed identity on supported Azure compute.
- Workload identity federation for external CI/CD or Kubernetes scenarios.
- Certificate credentials when federation or managed identity is unavailable.
- Short-lived tokens.
- No interactive MFA dependency.
- Direct, narrow role assignments.
- Ownership, inventory, monitoring, and expiration.
- Rotation for any remaining credentials.

Do not use a human account for automation. Password expiry, MFA, employment changes, and interactive challenges make human accounts operationally unsuitable and difficult to govern as workloads.

### Separating Human and Workload Access

Consider a production API:

```text
Human operator:
  Eligible Website Contributor on one resource group
  Activates through PIM
  MFA and approval required

Application runtime:
  Managed identity
  Key Vault Secrets User on one application vault
  Service Bus Data Sender on one topic

Deployment pipeline:
  Federated service principal
  Website Contributor on one application
  No runtime secret-read role
```

These identities have different purposes:

- The operator manages the application temporarily.
- The runtime accesses dependencies continuously.
- The pipeline deploys artifacts without reading production business data.

Combining them creates unnecessary attack paths. A compromised pipeline should not automatically gain all runtime data permissions. A runtime identity should not deploy new code or assign roles.

### Groups for Humans, Direct Boundaries for Workloads

Assign human roles to groups where practical:

- Reduces individual role assignments.
- Aligns access with team membership.
- Simplifies joiner and leaver processes.
- Enables group access reviews and PIM for Groups.

For workloads, a direct role assignment to a managed identity or service principal often provides clearer ownership and faster authorization change behavior. Group membership for managed identities can be useful but token and membership caching can delay changes.

A user-assigned managed identity can act as a shared workload boundary for true replicas. Do not use one shared identity for unrelated applications merely to reduce assignment count.

### Privileged Identity Management

Microsoft Entra Privileged Identity Management reduces standing human privilege by making assignments eligible rather than permanently active.

Activation can require:

- MFA.
- Approval.
- Business justification.
- A limited activation duration.
- Conditional Access authentication context.

PIM also provides notifications, audit history, access reviews, and assignment expiration.

Workloads cannot complete an interactive PIM activation flow. Their required runtime roles must be active, so the defense is:

- Narrow role.
- Narrow scope.
- Dedicated identity.
- Credential-free or federated authentication.
- Monitoring and lifecycle governance.

Do not design an unattended application around a role that requires a human to activate it every few hours.

### CI/CD Identities

A deployment pipeline is a workload and needs its own identity.

Prefer workload identity federation for platforms such as GitHub Actions or supported CI systems. Federation exchanges a trusted external token for a Microsoft Entra token without storing a long-lived Azure client secret.

Pipeline permissions should be limited to deployment operations:

- Deploy to the intended application or resource group.
- Read required deployment metadata.
- Avoid production data-plane access.
- Avoid broad subscription `Owner`.
- Avoid role-assignment permission unless the pipeline is explicitly an infrastructure authorization pipeline.

Separate:

- Application deployment.
- Infrastructure deployment.
- Role-assignment management.
- Runtime dependency access.

Not every organization needs four pipelines, but the security boundaries should be explicit.

### Service Principals and Credentials

When a service principal must use a credential:

Preference generally follows:

1. Managed identity when hosted on supported Azure compute.
2. Workload identity federation.
3. Certificate credential.
4. Client secret as a constrained legacy option.

For client secrets:

- Store them in an appropriate secret store.
- Rotate before expiration.
- Restrict who can add credentials.
- Monitor credential additions.
- Use a short validity period.
- Record owner and purpose.

A credential proves which workload is calling. It does not define what the workload can do; Azure RBAC and resource authorization do that.

### Custom Roles

Create a custom role when:

- No built-in role matches the required operation set.
- The role will be reused enough to justify governance.
- Required actions and data actions are understood.
- The organization can review provider changes.

Avoid:

- Wildcards without careful `NotActions`.
- Combining unrelated job functions.
- Assignable scope at the tenant root without need.
- Custom roles created for one temporary incident.
- Assuming `NotActions` is a deny.

Custom roles require versioning, ownership, testing, and periodic review.

### Azure ABAC and Role Assignment Conditions

Azure attribute-based access control adds conditions to supported Azure role assignments. A condition narrows a grant based on attributes such as:

- Resource tags.
- Blob path or container.
- Principal custom security attributes.
- Network path or private-link context.
- Request environment.

Conditions are useful when ordinary role and scope combinations would require many assignments or cannot express a data boundary.

Conditions:

- Apply only to supported actions and services.
- Filter permissions granted by a role assignment.
- Do not create a general explicit deny.
- Add policy complexity that must be tested and monitored.

Use RBAC role and scope first. Add conditions when they materially improve control or manageability.

### Separation of Duties

Separation of duties prevents one identity from controlling every step of a sensitive operation.

Examples:

- One team deploys application code; another controls production role assignments.
- A Key Vault Secrets Officer can rotate values but cannot grant itself access-management roles.
- An approver authorizes PIM elevation; the requester performs the operation.
- A pipeline builds artifacts; a separate protected stage deploys to production.
- Purge permission is separate from ordinary secret deletion.

Avoid creating a process so fragmented that emergency recovery is impossible. Document and test both normal and break-glass procedures.

### Infrastructure as Code

Role definitions and assignments should be managed through infrastructure as code when possible.

Benefits:

- Reviewable intent.
- Repeatable environment setup.
- Drift detection.
- Stable use of principal and role IDs.
- Easier cleanup.

Use immutable identifiers:

- Principal object ID for the intended identity.
- Built-in role definition ID rather than display name.
- Exact resource scope ID.

Deployment ordering matters. A managed identity or service principal must exist before its role assignment can reference the principal ID. Directory and RBAC propagation may require bounded retry.

Avoid mixing manual and automated ownership of the same assignment unless reconciliation behavior is understood.

### Access Reviews and Lifecycle

Human access changes when people join, change teams, or leave. Workload access changes when applications are replaced, retired, or split.

Review:

- Subscription and management-group owners.
- Role-assignment administrators.
- Permanent privileged assignments.
- Guest-user access.
- Service principals with broad roles.
- Managed identities no longer attached to resources.
- Expired or unused credentials.
- Direct user assignments that should be group-based.
- Production roles inherited from broad parent scopes.

Automated inventory should include identity owner, business purpose, environments, scopes, credentials, last activity, and retirement date.

### Emergency and Break-Glass Access

Emergency access exists for identity-provider failures, lockouts, or severe incidents.

It should be:

- Extremely limited in number.
- Excluded from ordinary daily use.
- Protected with strong independent credentials.
- Monitored with high-severity alerts.
- Tested periodically.
- Documented with a post-use review.

Emergency access is not a reason to give every operator permanent `Owner`. It is a distinct control for rare failure scenarios.

### Troubleshooting Effective Access

When access fails:

1. Confirm the caller's principal object ID.
2. Confirm the requested operation and whether it is management or data plane.
3. Identify the exact resource scope.
4. List direct, group, and inherited role assignments.
5. Check deny assignments and role-assignment conditions.
6. Inspect `Actions` or `DataActions` in the role definition.
7. Check token, group, and role-assignment propagation.
8. Confirm network and resource-specific authorization controls.

A 403 does not imply that `Contributor` should be added. Determine the missing action and grant the smallest appropriate role.

For security investigations, record role changes, PIM activations, credential changes, pipeline identity use, and sensitive data-plane access.

### Common Mistakes

- Assigning `Owner` when a service-specific role is sufficient.
- Assigning a narrow role at subscription scope without considering inheritance.
- Using a human account for automation.
- Sharing one service principal among unrelated applications.
- Giving a deployment pipeline runtime data access.
- Assuming `Contributor` grants all data-plane access.
- Assuming `NotActions` is an explicit deny.
- Adding direct user assignments instead of governed group membership.
- Making privileged human roles permanently active.
- Expecting a workload to activate PIM.
- Using client secrets where managed identity or federation is available.
- Ignoring inherited assignments while troubleshooting.
- Creating wildcard custom roles that silently expand over time.
- Leaving retired identities, credentials, and assignments in place.

### Interview Design Checklist

For an authorization design, identify:

1. The human and workload principals.
2. Each principal's job or runtime function.
3. Required management and data actions.
4. The narrowest useful scope.
5. Whether access is permanent, eligible, or time-bound.
6. Which identities can grant access.
7. Which duties must be separated.
8. How credentials are eliminated or protected.
9. How assignments are deployed, reviewed, and removed.
10. How effective access and suspicious use are monitored.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are the three parts of an Azure RBAC role assignment?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q01 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A role assignment combines a security principal, a role definition, and a scope. The principal identifies who or what receives access, the role defines allowed operations, and the scope limits the resources where those operations apply. Least privilege requires choosing both the narrowest role and the narrowest practical scope.

##### Key Points to Mention

- Principals include users, groups, service principals, and managed identities.
- Scope can be management group, subscription, resource group, or resource.
- Parent-scope assignments are inherited.
- Assignments grant access; role definitions alone do not.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q01 -->

#### What does least privilege mean in Azure?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q02 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Least privilege means granting only the operations a principal needs, only on the required resources, and only for the necessary duration. It includes using service-specific roles, narrow scopes, temporary human elevation, dedicated workload identities, and regular removal of obsolete access.

##### Key Points to Mention

- Role and scope must both be minimized.
- Human privileged access can be just in time.
- Workload access should follow application boundaries.
- Least privilege requires ongoing review.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q02 -->

#### What is the difference between a human identity and a workload identity?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q03 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A human identity represents a person and supports interactive controls such as MFA, Conditional Access, approval, and PIM activation. A workload identity represents software such as an application, pipeline, or script and authenticates noninteractively through managed identity, federation, or a service-principal credential. Workloads cannot complete human activation prompts.

##### Key Points to Mention

- Applications should not use employee accounts.
- People should not share workload credentials.
- Each identity type needs different lifecycle controls.
- Both can receive Azure RBAC roles.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q03 -->

#### What is the difference between management-plane and data-plane permissions?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q04 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Management-plane permissions create and configure Azure resources through Azure Resource Manager. Data-plane permissions access the content or service within a resource, such as reading blobs, secrets, or messages. A role such as `Contributor` may manage a resource without granting its data access, while service-specific data roles grant the required `DataActions`.

##### Key Points to Mention

- Role definitions list `Actions` and `DataActions`.
- Service-specific data roles are usually better for runtimes.
- Some management access can create indirect data-access paths.
- Troubleshooting must identify which plane failed.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why should privileged human roles use PIM?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q01 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

PIM reduces standing privilege by making a human eligible to activate a role only when needed. Activation can require MFA, approval, justification, and a limited duration. It provides notifications and audit history. This reduces the window in which a stolen or misused account has privileged access.

##### Key Points to Mention

- Eligible differs from permanently active.
- Use job-function roles and narrow scopes.
- PIM does not make an excessive role appropriately scoped.
- Workloads cannot perform interactive activation.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q01 -->

#### Why is assigning roles to groups preferred for human users?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q02 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Group-based assignment ties resource access to team or job membership, reduces direct assignments, and simplifies onboarding, transfer, offboarding, and access review. Privileged groups can also be governed through PIM for Groups. Direct user assignments are still appropriate for exceptional, documented cases but should not become the default.

##### Key Points to Mention

- Group inheritance contributes to effective access.
- Nested groups can make diagnosis more complex.
- Group ownership and membership need governance.
- Workload identities often benefit from direct, explicit assignments.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q02 -->

#### How should a CI/CD pipeline authenticate and be authorized?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q03 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Treat the pipeline as a workload with its own service principal or managed identity. Prefer workload identity federation so no long-lived client secret is stored in the CI system. Grant only the deployment operations and scopes it requires. Separate artifact deployment from role-assignment administration and avoid granting runtime data access unless the deployment process genuinely needs it.

##### Key Points to Mention

- Do not run pipelines as a developer account.
- Avoid subscription `Owner`.
- Federation uses short-lived tokens.
- Production environments should use protected approvals and distinct identities.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q03 -->

#### Why does adding a Reader role not reduce inherited Contributor access?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q04 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Azure RBAC is additive. Effective permissions are the union of applicable direct, group, and inherited assignments. A `Reader` assignment at a resource does not subtract permissions granted by `Contributor` at a subscription. The broader assignment must be removed, narrowed, or redesigned; adding a smaller role does not override it.

##### Key Points to Mention

- Inspect parent-scope and group assignments.
- `NotActions` is not an explicit deny.
- Conditions filter a grant but do not generally negate another grant.
- Effective-access analysis must consider every applicable assignment.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you separate operator, pipeline, and runtime permissions for a production API?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q01 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Give operators eligible PIM roles for specific management tasks, with MFA and approval where risk warrants it. Give the deployment pipeline a federated identity with narrow deployment rights but no routine production data access. Give the runtime a managed identity with only required data-plane roles on dependencies. Keep role-assignment administration separate or constrained.

##### Key Points to Mention

- Each identity has one purpose and lifecycle.
- Runtime identities should not deploy code.
- Pipelines should not automatically read business secrets or data.
- Operators should not have broad permanent access.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q01 -->

#### When should you create a custom Azure role?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q02 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Create a custom role when no built-in role provides the stable set of required actions without substantial excess privilege. Define explicit actions and data actions, limit assignable scopes, avoid broad wildcards, and establish ownership and review. Do not create a custom role for a one-time task when a time-bound built-in role at a narrow scope is adequate.

##### Key Points to Mention

- `NotActions` does not create a deny.
- Provider operations can change over time.
- Custom roles require versioning and testing.
- Built-in roles reduce maintenance when they fit.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q02 -->

#### How can permission to assign roles become a privilege-escalation path?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q03 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

An identity with unrestricted role-assignment write permission can grant itself or another controlled principal a powerful role. Similarly, someone who can attach a privileged managed identity to compute they control may exercise that identity's permissions. Limit role-assignment administrators, narrow their scope, use supported conditions to constrain roles and principals, and separate access administration from code execution.

##### Key Points to Mention

- `Owner`, `User Access Administrator`, and RBAC administrator roles are sensitive.
- Code deployment can create indirect access paths.
- Audit role changes and identity attachments.
- Separation of duties must consider practical bypasses.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q03 -->

#### How would you investigate an unexpected 403 without granting broader access?

<!-- question:start:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q04 -->
<!-- question-id:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Identify the caller's principal ID, the exact failed operation, whether it is management or data plane, and the resource scope. Enumerate direct, group, inherited, eligible, and conditional assignments. Inspect the role definition's relevant action or data action, deny assignments, token audience, propagation delay, and resource-specific network or authorization controls. Grant only the missing permission if it is genuinely required.

##### Key Points to Mention

- Do not default to `Contributor` or `Owner`.
- Confirm the application selected the intended identity.
- Role and token changes can take time to propagate.
- Use activity logs, sign-in logs, and service diagnostics.

<!-- question:end:rbac-least-privilege-and-separating-human-vs-workload-identities-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
