---
id: merge-and-upsert-patterns-including-concurrency-cautions
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: MERGE and upsert patterns, including concurrency cautions
category: SQL
---

## Overview

An upsert is an operation that updates a row when it already exists and inserts it when it does not. SQL Server supports several upsert patterns, including `MERGE`, explicit `UPDATE` then `INSERT`, `INSERT` then handle duplicate-key errors, and stored-procedure patterns wrapped in transactions.

`MERGE` is a single statement that can compare a source row set with a target table and then run `INSERT`, `UPDATE`, or `DELETE` actions based on match conditions. It is powerful for synchronization and data-loading scenarios, but it is also easy to misuse. A correct `MERGE` statement needs a stable match key, duplicate-safe source data, correct predicates, and careful concurrency thinking.

This topic matters because upsert logic appears in APIs, import jobs, ETL pipelines, configuration management, identity/profile updates, inventory updates, and synchronization tasks. The wrong pattern can create duplicates, overwrite newer data, deadlock under load, update the same row twice, or silently change too many rows.

For interviews, strong candidates can explain what `MERGE` does, when separate statements are safer, why unique constraints are still required, and how transaction isolation, locks, error handling, and retries affect correctness under concurrency.

## Core Concepts

### What MERGE Does

`MERGE` compares a source row set with a target table and applies actions based on whether rows match.

Basic shape:

```sql
MERGE dbo.CustomerProfile AS target
USING
(
    SELECT
        @Email AS Email,
        @DisplayName AS DisplayName
) AS source
ON target.Email = source.Email
WHEN MATCHED THEN
    UPDATE SET
        DisplayName = source.DisplayName,
        UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Email, DisplayName, CreatedAt, UpdatedAt)
    VALUES (source.Email, source.DisplayName, SYSUTCDATETIME(), SYSUTCDATETIME());
```

The `ON` clause defines how source rows match target rows. `WHEN MATCHED` handles existing rows. `WHEN NOT MATCHED BY TARGET` handles source rows that do not exist in the target.

`MERGE` can also support `WHEN NOT MATCHED BY SOURCE`, commonly used for synchronization cleanup, but that clause is dangerous if the source is only a partial feed.

### What Upsert Means

An upsert combines two intents:

- Update the existing row for a business key.
- Insert a new row when no row exists for that business key.

The business key might be:

- `Email`
- `ExternalCustomerId`
- `Sku`
- `TenantId` plus `Name`
- `Provider` plus `ProviderUserId`

Example table:

```sql
CREATE TABLE dbo.Users
(
    UserId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    TenantId INT NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL,

    CONSTRAINT UX_Users_Tenant_Email UNIQUE (TenantId, Email)
);
```

The unique constraint is not optional. It is the database-level protection that prevents duplicate users for the same tenant and email.

### MERGE For A Simple Upsert

Example:

```sql
MERGE dbo.Users WITH (HOLDLOCK) AS target
USING
(
    SELECT
        @TenantId AS TenantId,
        @Email AS Email,
        @DisplayName AS DisplayName
) AS source
ON target.TenantId = source.TenantId
AND target.Email = source.Email
WHEN MATCHED THEN
    UPDATE SET
        DisplayName = source.DisplayName,
        UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (TenantId, Email, DisplayName, CreatedAt, UpdatedAt)
    VALUES (source.TenantId, source.Email, source.DisplayName, SYSUTCDATETIME(), SYSUTCDATETIME())
OUTPUT
    $action AS MergeAction,
    inserted.UserId,
    inserted.Email;
```

This pattern uses:

- A unique business key.
- `HOLDLOCK` to reduce race conditions around the target key range.
- `OUTPUT` to return whether the row was inserted or updated.
- A clear `ON` clause based only on identity or business-key matching.

Even with this pattern, many teams prefer separate statements for high-concurrency OLTP upserts because the behavior is easier to reason about and test.

### Separate UPDATE Then INSERT Pattern

One common alternative is to update first, then insert when no row was affected.

Example:

```sql
BEGIN TRANSACTION;

UPDATE dbo.Users WITH (UPDLOCK, HOLDLOCK)
SET
    DisplayName = @DisplayName,
    UpdatedAt = SYSUTCDATETIME()
WHERE TenantId = @TenantId
  AND Email = @Email;

IF @@ROWCOUNT = 0
BEGIN
    INSERT dbo.Users (TenantId, Email, DisplayName, CreatedAt, UpdatedAt)
    VALUES (@TenantId, @Email, @DisplayName, SYSUTCDATETIME(), SYSUTCDATETIME());
END;

COMMIT TRANSACTION;
```

This is often easier to review than `MERGE`. The update path and insert path are explicit, and locking hints can protect the searched key range.

However, the unique constraint is still required. Locks are part of the correctness strategy, but constraints are the final guardrail.

### INSERT Then Handle Duplicate Key Pattern

Another pattern inserts first and handles duplicate-key errors by updating.

Example:

```sql
BEGIN TRY
    INSERT dbo.Users (TenantId, Email, DisplayName, CreatedAt, UpdatedAt)
    VALUES (@TenantId, @Email, @DisplayName, SYSUTCDATETIME(), SYSUTCDATETIME());
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() IN (2601, 2627)
    BEGIN
        UPDATE dbo.Users
        SET
            DisplayName = @DisplayName,
            UpdatedAt = SYSUTCDATETIME()
        WHERE TenantId = @TenantId
          AND Email = @Email;
    END
    ELSE
    BEGIN
        THROW;
    END;
END CATCH;
```

This can work well when inserts are the common case and duplicate conflicts are rare. It relies on a unique index or unique constraint to detect races. It must be used carefully so the update path does not hide unrelated constraint errors.

### Concurrency Risks In Upserts

The classic upsert race looks like this:

- Session A checks for a row and sees none.
- Session B checks for the same row and sees none.
- Both sessions try to insert.
- Without a unique constraint, duplicates are created.
- With a unique constraint, one session succeeds and the other gets a duplicate-key error.

That is why interview answers should include both transaction design and database constraints.

Concurrency tools include:

- Unique constraints or unique indexes.
- Explicit transactions.
- Correct isolation level.
- Lock hints such as `UPDLOCK` and `HOLDLOCK`.
- Retry logic for deadlocks or duplicate-key races.
- Idempotent application behavior.

No SQL syntax removes the need to model the key correctly.

### HOLDLOCK, UPDLOCK, And Serializable Range Protection

`HOLDLOCK` is equivalent to serializable behavior for the table reference. It can protect the searched key range until the transaction completes, which helps prevent another transaction from inserting a matching row into the gap.

`UPDLOCK` asks SQL Server to take update locks when reading rows that may later be updated. This can reduce conversion deadlocks and coordinate writers.

Example:

```sql
UPDATE dbo.Users WITH (UPDLOCK, HOLDLOCK)
SET
    DisplayName = @DisplayName,
    UpdatedAt = SYSUTCDATETIME()
WHERE TenantId = @TenantId
  AND Email = @Email;
```

These hints are not decoration. They communicate the concurrency intent: "I am checking this key because I may insert or update it, and other writers should not slip through the same key range."

Trade-offs:

- Stronger locks reduce race conditions.
- Stronger locks can reduce concurrency.
- Poor indexes can cause broader locking than intended.
- Locking strategy must be tested under concurrent load.

### Source Duplicates And MERGE Failures

`MERGE` expects the source-to-target match to be well-defined. If multiple source rows match the same target row and the action tries to update or delete that target row, SQL Server can fail because the same target row cannot be updated more than once by one `MERGE` statement.

Problem:

```sql
MERGE dbo.Products AS target
USING @ImportedProducts AS source
ON target.Sku = source.Sku
WHEN MATCHED THEN
    UPDATE SET Name = source.Name;
```

If `@ImportedProducts` contains the same `Sku` twice, the result is ambiguous.

Better:

```sql
WITH DedupedSource AS
(
    SELECT
        Sku,
        MAX(Name) AS Name
    FROM @ImportedProducts
    GROUP BY Sku
)
MERGE dbo.Products AS target
USING DedupedSource AS source
ON target.Sku = source.Sku
WHEN MATCHED THEN
    UPDATE SET Name = source.Name;
```

In real systems, do not hide source duplicates with `MAX` unless that rule is correct. Often, duplicates should be rejected and reported as import errors.

### The ON Clause Must Define Matching Only

A common `MERGE` mistake is putting target filters in the `ON` clause that are not truly part of the key.

Risky:

```sql
MERGE dbo.Users AS target
USING @Rows AS source
ON target.TenantId = source.TenantId
AND target.Email = source.Email
AND target.IsDeleted = 0
WHEN NOT MATCHED BY TARGET THEN
    INSERT (TenantId, Email, DisplayName)
    VALUES (source.TenantId, source.Email, source.DisplayName);
```

If a soft-deleted row exists with the same tenant and email, the `ON` clause does not match it, so the `NOT MATCHED` branch may try to insert a duplicate. That might fail due to a unique constraint or create a logical duplicate if the constraint does not cover the right key.

Better approach:

- Keep the `ON` clause focused on the match key.
- Put action-specific conditions in `WHEN MATCHED AND ...`.
- Decide explicitly how soft-deleted rows should be handled.

### WHEN NOT MATCHED BY SOURCE Caution

`WHEN NOT MATCHED BY SOURCE` means the target row did not appear in the source row set. It is useful for full synchronization jobs.

Example:

```sql
WHEN NOT MATCHED BY SOURCE THEN
    UPDATE SET IsActive = 0;
```

This is dangerous when the source is only a partial feed. If today's import file contains only changed rows, then almost every target row is "not matched by source" and could be deactivated or deleted incorrectly.

Interview answer: only use `WHEN NOT MATCHED BY SOURCE` when the source represents the complete desired state for the target scope, such as all products for one tenant or all assignments for one role.

### OUTPUT With MERGE

`MERGE` supports `OUTPUT`, including the special `$action` value.

Example:

```sql
DECLARE @Changes TABLE
(
    ActionName NVARCHAR(10) NOT NULL,
    ProductId BIGINT NOT NULL,
    Sku NVARCHAR(50) NOT NULL
);

MERGE dbo.Products AS target
USING @Source AS source
ON target.Sku = source.Sku
WHEN MATCHED THEN
    UPDATE SET Name = source.Name
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Sku, Name)
    VALUES (source.Sku, source.Name)
OUTPUT
    $action,
    inserted.ProductId,
    inserted.Sku
INTO @Changes;
```

This is useful for auditing, returning changed keys to the application, or triggering downstream work. The output should be treated as part of the data-change contract, not just debug information.

### MERGE Vs Separate Statements

`MERGE` can be a good fit when:

- You are synchronizing a clean source set with a target table.
- You need multiple actions in one statement.
- You need an output stream of inserted, updated, and deleted rows.
- The source has been deduplicated and validated.
- Concurrency requirements are understood and tested.

Separate statements can be a better fit when:

- The operation is a simple single-row API upsert.
- The code must be easy to review and debug.
- You need very explicit locking and error handling.
- You have high write concurrency.
- Different branches need different business rules.

Many senior SQL developers are cautious with `MERGE` in OLTP code. That does not mean `MERGE` is never useful. It means the pattern must be justified and tested.

### Common Mistakes

Common mistakes include:

- Using `MERGE` without a unique constraint on the business key.
- Allowing duplicate source rows.
- Putting non-key filters in the `ON` clause.
- Using `WHEN NOT MATCHED BY SOURCE` with a partial source feed.
- Assuming `MERGE` automatically solves concurrency.
- Ignoring duplicate-key and deadlock retry behavior.
- Forgetting to capture changed rows when downstream logic needs them.
- Running upsert logic without a transaction.
- Using broad locks because the target key is not indexed.
- Updating columns unnecessarily, causing extra writes and row-version churn.

### Best Practices

Best practices:

- Define and enforce the business key with a unique constraint or unique index.
- Validate or deduplicate the source before `MERGE`.
- Keep the `ON` clause focused on matching keys.
- Use `WHEN MATCHED AND ...` for action-specific filters.
- Be very cautious with `WHEN NOT MATCHED BY SOURCE`.
- Use transactions and concurrency-appropriate locks.
- Add retry handling for deadlocks and expected duplicate-key races.
- Test with concurrent sessions, not just one user.
- Prefer separate statements when they are clearer and safer.
- Use `OUTPUT` when the caller or audit process needs changed keys.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is an upsert?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q01 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

An upsert updates a row when it already exists and inserts a new row when it does not. The operation is usually based on a business key such as email, SKU, external ID, or a composite key like tenant plus name.

In SQL Server, upserts can be implemented with `MERGE`, with explicit `UPDATE` then `INSERT`, or with an insert-first pattern that handles duplicate-key errors.

##### Key Points to Mention

- Combines update and insert behavior.
- Depends on a stable business key.
- Must be protected by a unique constraint or unique index.
- Can be implemented with several patterns.
- Concurrency matters.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q01 -->

#### What does MERGE do in SQL Server?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q02 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

`MERGE` compares a source row set with a target table and performs actions based on match conditions. It can update matched target rows, insert source rows that are not matched by the target, and optionally delete or update target rows not matched by the source.

It is useful for synchronization and upsert scenarios, but it must be written carefully because the match logic, source duplicates, and concurrency behavior affect correctness.

##### Key Points to Mention

- Compares source and target.
- Uses an `ON` clause to define matches.
- Supports insert, update, and delete actions.
- Can return changed rows through `OUTPUT`.
- Not automatically safe under concurrency.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q02 -->

#### Why is a unique constraint important for upserts?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q03 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A unique constraint or unique index enforces the business key at the database level. Without it, two concurrent sessions can both decide a row does not exist and both insert duplicates. Application checks are not enough because they can race.

The upsert query should be written correctly, but the constraint is the final guardrail that preserves data integrity.

##### Key Points to Mention

- Prevents duplicate business keys.
- Protects against concurrency races.
- Application-only checks are not enough.
- Helps make errors explicit.
- Should match the real business uniqueness rule.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q03 -->

#### What does the MERGE ON clause represent?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q04 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

The `ON` clause defines how rows from the source match rows in the target. It should represent the key or identity relationship between source and target rows. It should not be used as a general filter for whether an action should run.

Action-specific filters should usually go in `WHEN MATCHED AND ...` or in the source query.

##### Key Points to Mention

- Defines source-to-target matching.
- Should use stable keys.
- Should not hide target rows with non-key filters.
- Bad `ON` clauses can create duplicates.
- Action filters belong in action conditions.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### Why can MERGE be risky with duplicate source rows?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q01 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

If multiple source rows match the same target row, a `MERGE` that updates or deletes the target can become ambiguous because the same target row would be affected more than once. SQL Server can fail the statement in that situation.

The source should be validated or deduplicated before `MERGE`, and duplicates should often be treated as data-quality errors instead of silently collapsed.

##### Key Points to Mention

- One target row should not match multiple source rows for update or delete.
- Source data must be clean for the match key.
- Deduplication must follow business rules.
- Silent `MAX` or `MIN` choices can hide bad data.
- Import validation should happen before merge logic.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q01 -->

#### How can two concurrent upserts create duplicates?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q02 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Two sessions can both check for a row, both see that it does not exist, and both attempt to insert. Without a unique constraint, both inserts may succeed. With a unique constraint, one insert succeeds and the other fails with a duplicate-key error, which the application or procedure can handle.

Correct upsert design uses constraints plus appropriate transactions, locks, isolation, and retry behavior.

##### Key Points to Mention

- Read-then-insert logic can race.
- Unique constraints prevent duplicates.
- Locks or serializable range protection can reduce races.
- Duplicate-key errors may be expected under contention.
- Retry logic may be needed.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q02 -->

#### When would you choose UPDATE then INSERT instead of MERGE?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q03 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Choose explicit `UPDATE` then `INSERT` when the upsert is simple, high-concurrency, or easier to reason about as separate branches. This pattern makes the update path, insert path, locking, row-count check, and error handling very clear.

`MERGE` can still be useful for batch synchronization, but separate statements are often preferred for single-row OLTP upserts.

##### Key Points to Mention

- Separate statements are easier to review.
- Good for simple API upserts.
- Locking can be explicit.
- Error handling can be branch-specific.
- `MERGE` is not always simpler in practice.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q03 -->

#### What is dangerous about WHEN NOT MATCHED BY SOURCE?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q04 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

`WHEN NOT MATCHED BY SOURCE` affects target rows that do not appear in the source. It is dangerous if the source is only a partial feed. A partial import may omit most target rows, causing the statement to delete or deactivate rows that should remain unchanged.

Use it only when the source represents the complete desired state for the target scope.

##### Key Points to Mention

- It acts on target rows missing from the source.
- Partial feeds can cause accidental deletes or deactivations.
- It is appropriate for full synchronization scopes.
- The source scope must be clearly defined.
- Tests should include missing-source scenarios.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you design a concurrency-safe upsert for a web API?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q01 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Start with a unique constraint on the real business key. Use a transaction and either an explicit `UPDATE` with `UPDLOCK, HOLDLOCK` followed by `INSERT`, or an insert-first pattern that handles duplicate-key errors. Keep the transaction short, ensure the key is indexed, and add retry handling for deadlocks or expected duplicate-key races.

For a simple single-row API upsert, separate statements are often clearer than `MERGE`. If `MERGE` is used, add appropriate locking, validate source uniqueness, and test concurrent calls.

##### Key Points to Mention

- Unique constraint is mandatory.
- Transaction should be short.
- Use indexed key lookups.
- Consider `UPDLOCK` and `HOLDLOCK`.
- Handle duplicate-key and deadlock retries.
- Test with concurrent sessions.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q01 -->

#### How would you audit what MERGE changed?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q02 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Use the `OUTPUT` clause to capture `$action`, inserted values, and deleted values into a table variable, temp table, or audit table. `$action` identifies whether the row was inserted, updated, or deleted. `inserted` contains the new row version, and `deleted` contains the old row version for updates and deletes.

The audit design should capture enough keys and values to support troubleshooting and downstream processing without logging unnecessary sensitive data.

##### Key Points to Mention

- `MERGE` supports `OUTPUT`.
- `$action` shows insert, update, or delete.
- `inserted` and `deleted` expose row versions.
- Output can feed auditing or downstream work.
- Avoid logging more sensitive data than needed.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q02 -->

#### What should be included in a MERGE code review?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q03 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Review the target unique constraint, source uniqueness, `ON` clause correctness, action-specific predicates, handling of `WHEN NOT MATCHED BY SOURCE`, transaction isolation, locking hints, expected row counts, and output/audit needs. Also review indexes, execution plans, and concurrency tests.

The reviewer should ask whether `MERGE` is actually clearer than separate statements and whether the source represents a full or partial data set.

##### Key Points to Mention

- Verify business-key constraint.
- Validate source duplicates.
- Check `ON` clause semantics.
- Review delete or deactivate branches carefully.
- Check transaction and lock strategy.
- Compare with simpler alternatives.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q03 -->

#### How should retry logic fit into upsert design?

<!-- question:start:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q04 -->
<!-- question-id:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Retry logic should handle transient failures such as deadlocks and, in some insert-first patterns, duplicate-key races. Retries should be limited, logged, and safe to repeat. The operation must be idempotent or use a stable business key so repeating it does not create duplicate side effects.

Retries are not a substitute for correct constraints and transaction design. They are a final resilience layer for expected contention.

##### Key Points to Mention

- Retry deadlocks carefully.
- Duplicate-key races may be expected in insert-first patterns.
- Retries must be bounded.
- Operations should be idempotent.
- Constraints and locks still matter.
- Log repeated failures for investigation.

<!-- question:end:merge-and-upsert-patterns-including-concurrency-cautions-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
