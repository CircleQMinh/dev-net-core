---
id: schema-migrations-source-control-reviewable-sql-scripts-and-release-safety
topic: Database programmability and schema evolution
subtopic: Schema migrations, source control, reviewable SQL scripts, and release safety
category: SQL
---

## Overview

Schema migrations are controlled changes to a database structure over time. They add, alter, or remove tables, columns, indexes, constraints, views, procedures, functions, triggers, permissions, and sometimes data needed by a release. Source control and reviewable SQL scripts make those changes visible, repeatable, auditable, and safer to deploy.

This topic matters because database changes are stateful. Application code can often be rolled back by redeploying a previous artifact, but a database migration may have changed live data, dropped columns, locked large tables, or introduced compatibility problems between old and new application versions. Release safety means designing database changes so they can be reviewed, tested, deployed, monitored, and recovered from with minimal production risk.

For interviews, this topic tests whether you think beyond `ALTER TABLE`. Strong candidates can explain migration files, idempotent scripts, source-controlled database projects, DACPACs, EF Core migrations, review workflows, expand-and-contract deployments, transactional safety, data backfills, rollback planning, and zero-downtime compatibility.

## Core Concepts

### What A Schema Migration Is

A schema migration is a versioned change to the database schema.

Examples:

- Add a table.
- Add a nullable column.
- Backfill data.
- Add a constraint.
- Create or alter a stored procedure.
- Create an index.
- Rename or drop a column.
- Split a table.
- Add permissions.

Migrations should be repeatable in lower environments and traceable in production.

### Why Source Control Matters

Database changes should be versioned like application code.

Source control provides:

- Review history.
- Ownership and accountability.
- Reproducible deployments.
- Pull request review.
- CI validation.
- Diff visibility.
- A way to coordinate database and application changes.
- Disaster recovery context.

If production schema changes happen manually with no script in source control, the team loses the ability to reliably recreate or review the system.

### Migration-Based Vs State-Based Approaches

There are two common styles:

| Approach | Description |
| --- | --- |
| Migration-based | Store ordered change scripts or migration classes |
| State-based | Store desired final schema and generate a deployment plan |

Migration-based tools track each change step. EF Core migrations are an example: model changes generate migration files, and applied migrations are tracked in a history table.

State-based tools store object definitions as the source of truth. SQL database projects can build a DACPAC that represents desired schema state; deployment tools compare that artifact with the target database and generate a plan.

Both approaches need review, testing, and production safety.

### Reviewable SQL Scripts

Reviewable SQL scripts let humans inspect exactly what will run.

Good review scripts show:

- Objects being created, altered, or dropped.
- Data movement.
- Backfill logic.
- Index build options.
- Constraint validation.
- Permissions.
- Potential data loss.
- Transaction boundaries.
- Rollback or roll-forward plan.

For production, directly applying generated changes without review is risky. Generated scripts can misunderstand intent, especially for renames, column splits, destructive changes, and data migrations.

### Idempotent Scripts

An idempotent script can be run safely even if part or all of the change has already been applied. This is useful when deploying to multiple databases or when the exact migration state may vary.

Example:

```sql
IF COL_LENGTH('sales.Orders', 'ExternalReference') IS NULL
BEGIN
    ALTER TABLE sales.Orders
    ADD ExternalReference varchar(100) NULL;
END;
```

Idempotency is useful, but it is not a license to skip review. A script can be idempotent and still unsafe.

### Transactional Deployment

Some schema changes can be wrapped in a transaction. If a step fails, the transaction can roll back. This is useful for many metadata changes and small data changes.

However, not every change should be wrapped in one large transaction:

- Large backfills can create huge logs.
- Long index operations can block.
- Some operations have special transaction restrictions.
- Rolling back a huge transaction can take a long time.
- Long transactions can block application traffic.

Release safety requires understanding the operational effect, not just the syntax.

### Expand And Contract

Expand-and-contract is a safe deployment pattern for changes that must remain compatible with old and new application versions.

Example column replacement:

- Expand: add the new nullable column.
- Deploy app version that writes both old and new columns.
- Backfill existing data.
- Deploy app version that reads the new column.
- Contract: stop writing old column.
- Later drop the old column.

This avoids breaking old code while a rolling deployment or rollback is possible.

### Backfills

A backfill updates existing data to match a new schema or rule.

Backfill safety considerations:

- Batch large updates.
- Use predictable ordering.
- Avoid long transactions.
- Monitor log growth.
- Avoid blocking hot tables.
- Make the script restartable.
- Validate row counts.
- Consider off-peak execution.

Example batched backfill:

```sql
WHILE 1 = 1
BEGIN
    UPDATE TOP (1000) sales.Orders
    SET ExternalReference = CONVERT(varchar(100), OrderId)
    WHERE ExternalReference IS NULL;

    IF @@ROWCOUNT = 0
        BREAK;
END;
```

### Destructive Changes

Destructive changes include dropping columns, dropping tables, changing data types, making nullable columns non-nullable, and shrinking column lengths.

Treat destructive changes as high risk:

- Confirm no callers use the old object.
- Keep backups or recovery options.
- Prefer staged removal.
- Deploy observability before deletion.
- Use feature flags or compatibility windows.
- Review generated scripts carefully.

Renames are also risky because tools may interpret a rename as drop-and-create unless told otherwise.

### Database Projects And DACPACs

SQL database projects store database object definitions in files and can build a DACPAC artifact. A deployment tool can compare the DACPAC to a target database and generate a plan to update the target.

Benefits include:

- Source-controlled object definitions.
- Build-time validation.
- CI integration.
- Repeatable deployment artifact.
- Deployment scripts and reports.
- Reviewable differences.

Risks include:

- Generated plans still need review.
- Data movement may need custom scripts.
- Some changes require careful sequencing with application deployments.

### EF Core Migrations

EF Core migrations track model changes in source-controlled migration files. A history table records which migrations have been applied.

For production, generated SQL scripts are usually safer than letting application startup or a command-line tool directly apply migrations without review. Scripts can be reviewed, adjusted, tested, approved, archived, and run through deployment automation.

### Review Checklist

A database migration review should ask:

- Is this change backward compatible?
- Does it support rolling deployment?
- Is data loss possible?
- Are there long locks?
- Are there large log writes?
- Is the script idempotent or state-aware?
- Is there a rollback or roll-forward plan?
- Have dependencies been checked?
- Are permissions included?
- Is the script tested on production-like data volume?
- Does the application deploy depend on this change?

### Release Safety

Release-safe migrations are designed around production behavior.

Important practices include:

- Deploy schema expansions before code that depends on them.
- Avoid dropping objects in the same release that stops using them.
- Use small steps for risky changes.
- Keep old and new app versions compatible during rolling deploys.
- Test against production-like data.
- Generate reviewable SQL.
- Monitor after deployment.
- Have a rollback or roll-forward plan.

### Rollback Vs Roll-Forward

Rollback means undoing the change. Roll-forward means applying a new fix that moves the system to a safe state.

For databases, roll-forward is often safer than rollback when live data may have changed after the migration. Dropping a new column might be easy. Reconstructing dropped data may not be.

Plan this before release. Do not invent the recovery strategy during the incident.

### Common Mistakes

Common mistakes include:

- Making manual production changes that are not in source control.
- Applying generated migrations without review.
- Dropping or renaming columns in the same release that changes application code.
- Running large backfills in one transaction.
- Forgetting permissions, views, procedures, or reporting dependencies.
- Assuming rollback is easy after data changes.
- Deploying code before required schema expansion.
- Not testing scripts on realistic data volume.
- Ignoring locks, log growth, and index build impact.
- Treating migration files as generated noise instead of production code.

### Best Practices

Best practices include:

- Keep all schema changes in source control.
- Use pull requests for SQL changes.
- Generate reviewable SQL scripts for production.
- Test migrations in CI and staging.
- Prefer expand-and-contract for breaking changes.
- Make long-running data changes batchable and restartable.
- Review execution plans for backfills and validation queries.
- Include permissions and dependent objects.
- Use deployment reports or dry runs where available.
- Monitor locks, errors, duration, and application health after deployment.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a schema migration?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q01 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A schema migration is a controlled change to a database structure or database objects. It can add or change tables, columns, indexes, constraints, views, procedures, functions, triggers, permissions, or data needed for a release.

Migrations should be versioned, reviewed, tested, and applied consistently across environments.

##### Key Points to Mention

- Controlled database change.
- Can affect schema, programmable objects, permissions, and data.
- Should be versioned.
- Should be tested before production.
- Must account for existing data.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q01 -->

#### Why should database changes be in source control?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q02 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Database changes should be in source control so the team can review them, reproduce them, audit who changed what, run them through CI, coordinate them with application releases, and rebuild environments consistently. Source control also prevents production schema from becoming an undocumented special case.

Without source control, database changes are hard to review, hard to rollback or fix, and easy to lose.

##### Key Points to Mention

- Review history.
- Reproducible deployments.
- Coordination with application code.
- CI validation.
- Avoid undocumented manual changes.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q02 -->

#### Why are reviewable SQL scripts important for production migrations?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q03 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Reviewable SQL scripts show exactly what will run against production. This lets developers, DBAs, and reviewers catch data loss, locking risk, missing permissions, expensive backfills, unintended drops, and deployment-order problems before the change is applied.

Generated migrations are helpful, but generated output should still be inspected because tools may not understand the developer's intent, especially for renames or destructive changes.

##### Key Points to Mention

- Shows exact production commands.
- Enables human review.
- Helps catch data loss and locking risks.
- Useful for DBA approval and audit.
- Generated scripts still need inspection.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q03 -->

#### What is an idempotent migration script?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q04 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

An idempotent migration script is written so it can be run safely even if the change has already been applied. It checks the current database state or migration history before applying a change.

This is useful when deploying to multiple databases or environments that may not all be at exactly the same version. Idempotency improves safety, but it does not replace testing and review.

##### Key Points to Mention

- Safe to run more than once.
- Checks current state before changing it.
- Useful across multiple environments.
- Can use migration history or object checks.
- Still needs review.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### What is the difference between migration-based and state-based database deployment?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q01 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Migration-based deployment stores ordered changes, such as migration files or numbered SQL scripts. Each migration describes a step from one version to the next, and a history table or process tracks what has already run.

State-based deployment stores the desired final schema, often as source-controlled object definitions. A tool compares the desired state to the target database and generates a deployment plan. SQL database projects and DACPAC publishing are examples. Both approaches need review and testing.

##### Key Points to Mention

- Migration-based stores ordered changes.
- State-based stores desired final schema.
- Migration history tracks applied steps.
- DACPAC-style deployment compares source and target.
- Both need script review and safety checks.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q01 -->

#### What is expand-and-contract deployment?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q02 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Expand-and-contract is a safe migration pattern where the database first expands to support both old and new application versions, then the application migrates to the new behavior, and only later does the database remove the old structure.

For example, add a new nullable column, deploy code that writes both old and new columns, backfill data, deploy code that reads the new column, then remove the old column in a later release. This supports rolling deployment and safer rollback.

##### Key Points to Mention

- Expand first with backward-compatible schema.
- Support old and new app versions.
- Backfill safely.
- Switch reads and writes gradually.
- Contract later after old callers are gone.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q02 -->

#### Why can large data backfills be risky?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q03 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Large backfills can hold locks for a long time, generate a large transaction log, block application traffic, cause deadlocks, fill tempdb, and take longer than the deployment window. If they run in one huge transaction, rollback can also be painful.

Safer backfills are batched, restartable, monitored, tested on production-like data, and scheduled with awareness of workload patterns.

##### Key Points to Mention

- Can lock hot tables.
- Can generate large logs.
- Can block production traffic.
- Huge rollback can be slow.
- Batch and monitor large updates.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q03 -->

#### Why are destructive schema changes dangerous?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q04 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Destructive changes such as dropping columns, shrinking data types, removing tables, or making nullable columns non-nullable can lose data or break old application versions, reports, jobs, and integrations. They are especially risky during rolling deployments where old and new code may run at the same time.

A safer approach is to stage the change: add new structures first, migrate callers, verify no dependencies remain, then remove old structures in a later release.

##### Key Points to Mention

- Can cause data loss.
- Can break old code and integrations.
- Risky during rolling deployments.
- Use staged removal.
- Verify dependencies before dropping.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you design a safe migration to replace one column with another?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q01 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would use expand-and-contract. First add the new nullable column without removing the old one. Deploy code that can write both columns or derive the new column from the old value. Backfill existing rows in batches and validate counts. Then deploy code that reads from the new column, while keeping backward compatibility if rollback is needed. After monitoring confirms no old callers remain, drop the old column in a later release.

The migration should be source-controlled, reviewed as SQL, tested on production-like data, and include a roll-forward plan for partial failures.

##### Key Points to Mention

- Add new column first.
- Keep old and new versions compatible.
- Backfill in batches.
- Switch reads after validation.
- Drop old column later.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q01 -->

#### How would you review a production migration script?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q02 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

I would check whether the script is backward compatible, whether it can cause data loss, whether it takes long locks, whether it creates or rebuilds indexes on hot tables, whether data updates are batched, whether permissions and dependent objects are included, and whether it has a rollback or roll-forward plan.

I would also verify that it was tested in a representative environment, that generated SQL matches intent, that deployment order works with application code, and that monitoring is planned for errors, blocking, duration, and application health.

##### Key Points to Mention

- Check compatibility and data-loss risk.
- Review locks, logs, and long-running operations.
- Verify batching and restartability.
- Confirm app deployment order.
- Require test evidence and monitoring plan.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q02 -->

#### When is rollback not the right recovery strategy for a database migration?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q03 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Rollback may be unsafe when live data has changed after the migration, when undoing the change would lose new writes, or when rolling back a large transaction would take too long. For example, after a new application version writes data in a new format, simply reverting the schema can corrupt or lose that data.

In those cases, roll-forward is often safer: apply a corrective migration or code fix that moves the system to a known good state while preserving data. The team should decide this before deployment.

##### Key Points to Mention

- Live data may have changed.
- Rollback can lose new writes.
- Large rollback can be operationally risky.
- Roll-forward may preserve data better.
- Recovery strategy should be planned before release.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q03 -->

#### How do SQL database projects and DACPACs support release safety?

<!-- question:start:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q04 -->
<!-- question-id:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

SQL database projects store desired database object definitions in source control and can build a DACPAC artifact. The build validates object references and target-platform syntax. Deployment tools can compare the DACPAC to a target database and generate a deployment plan, script, or report before applying changes.

This supports release safety because schema definitions are versioned, buildable, reviewable, and deployable through CI/CD. However, generated plans still need review, especially for data movement, destructive changes, and application compatibility.

##### Key Points to Mention

- Source-controlled database object definitions.
- Build-time validation.
- DACPAC as deployment artifact.
- Deployment plan can be reviewed.
- Generated changes still require human safety review.

<!-- question:end:schema-migrations-source-control-reviewable-sql-scripts-and-release-safety-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
