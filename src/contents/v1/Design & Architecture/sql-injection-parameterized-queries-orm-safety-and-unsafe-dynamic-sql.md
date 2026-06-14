---
id: sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql
topic: Web application security threat modeling and attack patterns
subtopic: SQL Injection, parameterized queries, ORM safety, and unsafe dynamic SQL
category: Design & Architecture
---

## Overview

SQL injection occurs when untrusted input changes the structure or meaning of a database command. Instead of being handled only as data, attacker-controlled text becomes SQL syntax.

A vulnerable query might concatenate a username into SQL:

```csharp
var sql =
    "SELECT Id, Email FROM Users WHERE Email = '" +
    request.Email +
    "'";
```

An attacker can supply input that closes the string literal and adds new SQL logic.

The primary defense is parameterization:

```csharp
const string sql =
    "SELECT Id, Email FROM Users WHERE Email = @email";

await using var command = new SqlCommand(sql, connection);
command.Parameters.Add(
    new SqlParameter("@email", SqlDbType.NVarChar, 320)
    {
        Value = request.Email
    });
```

The SQL structure and value are transmitted separately. The database treats the value as data, even if it contains quotes or SQL keywords.

ORMs such as Entity Framework Core usually parameterize LINQ expressions, but they do not make every database operation automatically safe. Raw SQL, dynamic identifiers, interpolated-string misuse, stored procedures that build commands, and unsafe query libraries can reintroduce injection.

This topic matters in interviews because candidates should be able to:

- Explain why parameterization works.
- Distinguish values from identifiers and SQL syntax.
- Identify safe and unsafe EF Core APIs.
- Build dynamic filtering and sorting safely.
- Explain why validation, escaping, stored procedures, and ORMs are not complete defenses alone.
- Apply least privilege and testing as defense in depth.

## Core Concepts

### How SQL Injection Changes a Query

Suppose an application builds:

```sql
SELECT Id, Email
FROM Users
WHERE Email = '[USER INPUT]';
```

If input is inserted directly, an attacker may alter the predicate:

```text
' OR 1 = 1 --
```

The resulting command no longer means "find this email." It may mean "return every row."

Injection can affect:

- `SELECT`.
- `INSERT`.
- `UPDATE`.
- `DELETE`.
- Stored-procedure calls.
- Dynamic DDL.
- Search expressions.
- ORM query languages.
- Administrative and reporting tools.

The impact depends on database permissions, available SQL features, exposed error behavior, and whether multiple statements are allowed.

### Injection Is a Code-and-Data Boundary Failure

The root problem is not a malicious apostrophe. The problem is combining:

- Trusted command syntax.
- Untrusted data.

into one executable string.

Unsafe:

```csharp
var sql = $"SELECT * FROM Products WHERE Name = '{name}'";
```

Safe:

```csharp
const string sql =
    "SELECT * FROM Products WHERE Name = @name";

command.Parameters.AddWithValue("@name", name);
```

Prefer explicit parameter types and sizes over `AddWithValue` when database type inference could cause conversion or performance problems:

```csharp
command.Parameters.Add(
    "@name",
    SqlDbType.NVarChar,
    200).Value = name;
```

### Parameterized Queries

A parameterized query defines SQL syntax first and binds values separately:

```csharp
const string sql = """
    SELECT Id, Name, Price
    FROM Products
    WHERE CategoryId = @categoryId
      AND Price <= @maximumPrice
    """;

await using var command = new SqlCommand(sql, connection);
command.Parameters.Add(
    "@categoryId",
    SqlDbType.UniqueIdentifier).Value = categoryId;
command.Parameters.Add(
    "@maximumPrice",
    SqlDbType.Decimal).Value = maximumPrice;
```

Benefits:

- Input cannot terminate a literal and introduce syntax.
- Types are explicit.
- Query plans can often be reused.
- Code is easier to review than custom escaping.

Parameterization must happen in the database driver or query API. Replacing characters manually is not equivalent.

### What Parameters Can Represent

Parameters represent values:

```sql
WHERE CustomerId = @customerId
WHERE CreatedAt >= @from
SET DisplayName = @displayName
```

Parameters generally cannot represent:

- Table names.
- Column names.
- `ASC` or `DESC`.
- SQL operators.
- Keywords.
- Entire predicates.

This does not work as intended:

```sql
SELECT * FROM Orders ORDER BY @sortColumn @sortDirection
```

Identifiers and syntax require query redesign or an allowlist that selects trusted code fragments.

### Safe Dynamic Sorting

Map external values to known expressions:

```csharp
var query = dbContext.Orders
    .Where(order => order.TenantId == tenantId);

query = request.Sort switch
{
    "createdAt" => query
        .OrderBy(order => order.CreatedAt)
        .ThenBy(order => order.Id),

    "-createdAt" => query
        .OrderByDescending(order => order.CreatedAt)
        .ThenByDescending(order => order.Id),

    "total" => query
        .OrderBy(order => order.Total)
        .ThenBy(order => order.Id),

    _ => throw new InvalidSortFieldException(request.Sort)
};
```

The user selects a predefined behavior. Their text never becomes SQL syntax.

For raw SQL:

```csharp
var orderBy = request.Sort switch
{
    "createdAt" => "[CreatedAt] ASC, [Id] ASC",
    "-createdAt" => "[CreatedAt] DESC, [Id] DESC",
    "total" => "[Total] ASC, [Id] ASC",
    _ => throw new InvalidSortFieldException(request.Sort)
};

var sql = $"""
    SELECT Id, CreatedAt, Total
    FROM Orders
    WHERE TenantId = @tenantId
    ORDER BY {orderBy}
    """;
```

Only fixed developer-owned fragments are interpolated. Values still use parameters.

### Safe Dynamic Filtering

Compose typed query expressions:

```csharp
IQueryable<Order> query = dbContext.Orders
    .Where(order => order.TenantId == tenantId);

if (request.Status is not null)
{
    query = query.Where(
        order => order.Status == request.Status);
}

if (request.CreatedFrom is not null)
{
    query = query.Where(
        order => order.CreatedAt >= request.CreatedFrom);
}
```

LINQ providers translate captured values into parameters.

Avoid accepting arbitrary SQL-like predicates:

```text
?where=Status='Paid' OR 1=1
```

If a filter language is required:

- Define a grammar.
- Parse to an abstract syntax tree.
- Allowlist fields and operators.
- Type-check values.
- Generate parameterized expressions.
- Limit depth and complexity.

### EF Core LINQ Safety

Normal LINQ expressions are parameterized:

```csharp
var user = await dbContext.Users
    .SingleOrDefaultAsync(
        item => item.Email == request.Email,
        cancellationToken);
```

The email becomes a database parameter.

This protection applies to translated values, not to:

- Raw SQL strings.
- Dynamically generated expression text from unsafe libraries.
- Client-controlled table or column selection.
- Database functions invoked through unsafe SQL.
- Authorization errors in otherwise safe queries.

An ORM prevents many injection mistakes but cannot correct unsafe design.

### EF Core FromSql

EF Core can parameterize interpolated values passed through safe APIs:

```csharp
var minimumDate = request.CreatedFrom;

var orders = await dbContext.Orders
    .FromSql($"""
        SELECT *
        FROM Orders
        WHERE CreatedAt >= {minimumDate}
        """)
    .ToListAsync(cancellationToken);
```

The interpolated value becomes a database parameter rather than literal SQL.

The safety depends on passing the interpolated form directly to the parameterizing API.

### EF Core FromSqlRaw

`FromSqlRaw` accepts a raw SQL string and must be treated as a security-sensitive sink.

Unsafe:

```csharp
var sql = $"""
    SELECT *
    FROM Orders
    WHERE CustomerName = '{request.CustomerName}'
    """;

var orders = await dbContext.Orders
    .FromSqlRaw(sql)
    .ToListAsync(cancellationToken);
```

Safer:

```csharp
var orders = await dbContext.Orders
    .FromSqlRaw(
        """
        SELECT *
        FROM Orders
        WHERE CustomerName = {0}
        """,
        request.CustomerName)
    .ToListAsync(cancellationToken);
```

Prefer `FromSql` or explicit `DbParameter` objects when only values vary.

### Interpolated Strings Can Lose Safety

This is unsafe:

```csharp
var sql =
    $"SELECT * FROM Orders WHERE CustomerName = '{request.CustomerName}'";

var orders = dbContext.Orders.FromSqlRaw(sql);
```

The C# interpolation is completed before EF Core receives the string. EF sees one raw SQL value and cannot recover the data boundary.

Code review must examine the API and how the string was constructed.

### ExecuteSql and ExecuteSqlRaw

Use parameterizing execution methods for commands:

```csharp
await dbContext.Database.ExecuteSqlAsync($"""
    UPDATE Orders
    SET Archived = 1
    WHERE CreatedAt < {cutoff}
    """);
```

Treat `ExecuteSqlRaw` like `FromSqlRaw`: only trusted SQL structure should be present, and values should use parameters.

Raw methods are not inherently vulnerabilities. They are dangerous when untrusted input influences their command text.

### ADO.NET Commands

Safe ADO.NET:

```csharp
const string sql = """
    UPDATE Users
    SET DisplayName = @displayName
    WHERE Id = @userId
    """;

await using var command = new SqlCommand(sql, connection);
command.Parameters.Add(
    "@displayName",
    SqlDbType.NVarChar,
    100).Value = request.DisplayName;
command.Parameters.Add(
    "@userId",
    SqlDbType.UniqueIdentifier).Value = userId;

await command.ExecuteNonQueryAsync(cancellationToken);
```

Use `DBNull.Value` for database null:

```csharp
parameter.Value = value is null
    ? DBNull.Value
    : value;
```

### Stored Procedures

Stored procedures can be safe when:

- The application uses typed parameters.
- The procedure does not concatenate those parameters into SQL.
- Execute permissions follow least privilege.

Application call:

```csharp
await using var command = new SqlCommand(
    "GetOrdersByCustomer",
    connection)
{
    CommandType = CommandType.StoredProcedure
};

command.Parameters.Add(
    "@CustomerId",
    SqlDbType.UniqueIdentifier).Value = customerId;
```

Unsafe procedure:

```sql
CREATE PROCEDURE SearchOrders
    @WhereClause nvarchar(max)
AS
BEGIN
    EXEC(
        N'SELECT * FROM Orders WHERE ' +
        @WhereClause
    );
END
```

Moving concatenation into the database does not remove injection.

### Dynamic SQL Inside Stored Procedures

When dynamic SQL is unavoidable inside SQL Server, use:

- Fixed trusted command structure.
- `sp_executesql`.
- Typed value parameters.
- Allowlisted identifiers.
- `QUOTENAME` for identifiers after validation.

Do not treat identifier quoting as authorization. The set of permitted identifiers must still be controlled.

Audit procedures for:

- `EXEC`.
- `EXECUTE`.
- Dynamic command variables.
- Concatenated predicates.
- Dynamic object names.

### Input Validation

Validation is defense in depth:

- Parse numeric and date values into typed values.
- Enforce length and range.
- Allowlist enum-like choices.
- Reject unsupported filters and sorts.
- Normalize only when the domain requires it.

Validation does not replace parameters:

```csharp
if (IsValidEmail(email))
{
    // Still unsafe if concatenated into SQL.
}
```

Validated data can still contain SQL-significant characters, and future validation changes can expose the query.

### Escaping Is Not the Primary Defense

Manual escaping is fragile because:

- Rules differ by database and mode.
- Encodings and collations matter.
- Numeric and identifier contexts differ from strings.
- Double escaping and truncation can occur.
- Maintenance changes can bypass the helper.

Use the database driver's parameter API rather than trying to make arbitrary strings safe SQL.

### Least Privilege

Parameterization prevents injection. Least privilege limits damage if another flaw remains.

Application database accounts should:

- Avoid administrator or owner roles.
- Access only required schemas and objects.
- Have read-only access where writes are unnecessary.
- Avoid DDL permissions.
- Use separate credentials for different workloads where practical.
- Execute only required stored procedures.

Do not share one database administrator credential among all applications.

### Views and Separate Database Users

Database views can expose only required rows or columns. Separate users can distinguish:

- Read-only reporting.
- Transactional application writes.
- Background maintenance.
- Migrations.

Migration credentials should not be used by the normal application runtime.

### Connection Secrets

Protect connection strings with:

- A secret manager.
- Workload or managed identity where supported.
- Rotation.
- Restricted access.
- No logging.

SQL injection and credential leakage are separate threats, but powerful leaked credentials increase impact.

### Authorization Is Still Required

This query is parameterized but may still be insecure:

```csharp
var order = await dbContext.Orders
    .SingleAsync(
        item => item.Id == requestedOrderId,
        cancellationToken);
```

If the caller may access only their tenant's orders:

```csharp
var order = await dbContext.Orders
    .SingleOrDefaultAsync(
        item =>
            item.Id == requestedOrderId &&
            item.TenantId == currentTenantId,
        cancellationToken);
```

SQL injection prevention does not prevent insecure direct object reference or broken access control.

### Second-Order SQL Injection

In second-order injection, unsafe text is stored safely first and later concatenated into a different query.

Example:

```text
User input -> parameterized INSERT -> stored value
Stored value -> later string-built maintenance SQL -> injection
```

Treat database content as untrusted when it reaches a SQL-construction sink. Trust is based on provenance and validation, not storage location.

### LIKE Queries

Parameters prevent SQL injection:

```csharp
var pattern = $"%{searchTerm}%";

var products = await dbContext.Products
    .Where(product =>
        EF.Functions.Like(product.Name, pattern))
    .ToListAsync(cancellationToken);
```

However, `%` and `_` remain wildcard syntax. If the product requirement is a literal search, escape wildcard characters using a defined escape character.

This is a search-semantics issue, not SQL injection, because the value remains parameterized.

### IN Clauses

LINQ:

```csharp
var orders = await dbContext.Orders
    .Where(order => requestedIds.Contains(order.Id))
    .ToListAsync(cancellationToken);
```

For large lists, consider:

- Table-valued parameters.
- Temporary tables.
- Bulk-loading a typed input.
- Database-specific array parameters.

Do not join a list into SQL text.

### Multi-Tenant Queries

Tenant filters should be applied consistently:

```csharp
modelBuilder.Entity<Order>()
    .HasQueryFilter(
        order => order.TenantId == currentTenant.Id);
```

Global filters can help but require care for:

- Background jobs.
- Administrative access.
- Context lifetime.
- Raw SQL that bypasses expected filters.

Database row-level security can add defense in depth.

### Error Handling

Do not expose:

- SQL text.
- Table names.
- Connection details.
- Stack traces.
- Database error numbers without a consumer need.

Return a stable problem response and log detailed diagnostics securely with a correlation ID.

Verbose errors can help attackers discover query structure, but hiding errors does not fix injection.

### Logging

Log:

- Operation and route.
- Safe query identifier.
- Duration.
- Row count where appropriate.
- Correlation ID.
- Database failure category.

Avoid logging:

- Full raw SQL containing secrets or personal data.
- Parameter values by default.
- Connection strings.
- Authentication tokens.

Development logging that includes sensitive data must not be enabled in production.

### Code Review

Search for security-sensitive APIs and patterns:

```text
FromSqlRaw
ExecuteSqlRaw
SqlCommand
DbCommand
EXEC(
sp_executesql
ORDER BY "
WHERE " +
string interpolation near SQL
```

For each occurrence, trace whether untrusted input can influence:

- Command text.
- Identifiers.
- Operators.
- Sort direction.
- Stored dynamic fragments.

Do not classify an API as safe solely by name.

### Static and Dynamic Testing

Use:

- Static analysis for concatenated SQL.
- Dependency and code review.
- Integration tests with hostile input.
- Database audit logs.
- Dynamic application security testing.
- Penetration testing for critical systems.

Tests should verify:

- Quotes remain data.
- Sort and filter fields are allowlisted.
- Raw-SQL parameters are bound.
- Unauthorized rows remain inaccessible.
- Error responses do not leak details.

Do not run destructive attack payloads against production data.

### Performance and Parameterization

Parameterized queries often improve plan reuse, but query plans can be suboptimal for skewed data. Solve performance issues with:

- Appropriate indexes.
- Query redesign.
- Database-supported plan controls.
- Purpose-specific query variants.
- Measured recompilation strategies.

Do not switch to string-concatenated literals as a casual performance fix.

### Threat Modeling Dynamic Reporting

Reporting systems often need flexible columns, filters, grouping, and sorting.

Safer design:

```text
External query model
  -> parser and authorization
  -> allowlisted report fields
  -> typed query expression
  -> parameterized execution
```

Enforce:

- Per-field authorization.
- Maximum query complexity.
- Row and time limits.
- Export limits.
- Read-only credentials.
- Auditing.

### Common Mistakes

- Concatenating or interpolating user input into SQL.
- Assuming validation makes concatenation safe.
- Assuming every ORM operation is safe.
- Passing prebuilt interpolated strings to raw SQL APIs.
- Letting users supply column or table names directly.
- Treating stored procedures as inherently safe.
- Building dynamic SQL inside procedures without parameters.
- Escaping quotes as the primary defense.
- Using administrator database credentials.
- Logging sensitive SQL parameters.
- Forgetting tenant and resource authorization.
- Joining `IN` values into text.
- Treating stored database values as trusted.
- Ignoring wildcard semantics in `LIKE`.
- Disabling parameterization to solve performance problems.

### Best Practices

- Keep SQL structure fixed and bind all values as parameters.
- Prefer typed LINQ for dynamic filtering and sorting.
- Treat raw SQL APIs as security-sensitive sinks.
- Pass interpolated values directly only to APIs that parameterize them.
- Map client sort and field names to trusted expressions.
- Use typed parameters with appropriate size and precision.
- Audit dynamic SQL inside stored procedures.
- Apply validation as defense in depth, not as the primary barrier.
- Run the application with least database privilege.
- Separate migration and runtime credentials.
- Enforce tenant and object authorization in the query.
- Test raw SQL, dynamic reports, and hostile inputs.
- Avoid exposing database details in errors and logs.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is SQL injection?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q01 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

SQL injection occurs when untrusted input is combined with SQL command text so that the input changes query structure or meaning. An attacker may alter predicates, read unauthorized data, modify records, or invoke database capabilities. The root problem is failing to separate executable SQL syntax from data values.

##### Key Points to Mention

- String concatenation is the classic cause.
- The impact depends on database permissions.
- Hiding database errors does not prevent injection.
- Use parameterized queries as the primary defense.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q01 -->

#### How do parameterized queries prevent SQL injection?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q02 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The application defines the SQL command structure with placeholders and sends each value separately through the database driver. The database parses the command independently from the values, so quotes and SQL keywords inside a value remain data and cannot become executable syntax.

##### Key Points to Mention

- Parameters represent values, not SQL fragments.
- Use driver or ORM parameter APIs.
- Prefer explicit types and sizes.
- Manual escaping is not equivalent.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q02 -->

#### Does using an ORM eliminate SQL injection?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q03 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

No. Normal typed ORM queries usually parameterize values, but raw SQL APIs, dynamic query strings, unsafe third-party expression libraries, and client-controlled identifiers can reintroduce injection. Developers must understand which APIs parameterize and how the command text is constructed.

##### Key Points to Mention

- EF Core LINQ values are normally parameterized.
- Raw methods require careful review.
- ORM safety does not provide authorization.
- Stored procedures called by an ORM can also be unsafe internally.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q03 -->

#### Are stored procedures always safe from SQL injection?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q04 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

No. A stored procedure is safe when it receives typed parameters and uses fixed SQL or safely parameterized dynamic SQL. A procedure that concatenates input into an `EXEC` command remains injectable. Stored procedures can also lead to excessive database privileges if execute permissions are configured poorly.

##### Key Points to Mention

- Location of SQL does not determine safety.
- Audit dynamic execution inside procedures.
- Use typed procedure parameters.
- Apply least privilege to execute permissions.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you safely implement a user-selected sort column?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q01 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

SQL parameters cannot represent column names or sort direction. Map each supported external value to a predefined LINQ expression or trusted SQL fragment and reject everything else. Add a stable tie-breaker and ensure the caller is allowed to use the selected field. Never append the raw query parameter to `ORDER BY`.

##### Key Points to Mention

- Use an allowlist implemented as code mapping.
- Identifiers and values require different handling.
- Arbitrary sorting can create performance risks.
- Parameterize all filter values separately.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q01 -->

#### What is the EF Core risk when an interpolated string is passed to FromSqlRaw?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q02 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

If C# interpolation produces a complete string before `FromSqlRaw` receives it, untrusted values are already embedded in command text and cannot be converted back into parameters. Pass interpolated values directly to a parameterizing API such as `FromSql`, or use placeholders and explicit database parameters with the raw API.

##### Key Points to Mention

- Review both the sink and string construction.
- A variable of type `string` has lost interpolation metadata.
- Raw APIs are acceptable only with trusted structure.
- Test generated SQL and parameters.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q02 -->

#### Why are validation and least privilege still needed with parameterized queries?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q03 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Parameterization protects the SQL boundary. Validation enforces supported types, ranges, fields, and query complexity. Least privilege limits damage from another flaw, leaked credentials, or unintended application behavior. These controls solve different problems and form defense in depth.

##### Key Points to Mention

- Validated data must still be parameterized.
- Restrict runtime accounts to required objects and operations.
- Separate migration credentials.
- Authorization remains necessary for rows and tenants.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q03 -->

#### What is second-order SQL injection?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q04 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Second-order injection occurs when attacker-controlled text is initially stored safely, then later retrieved and concatenated into a new SQL command. Storage does not make data trustworthy. Every value reaching a SQL-construction sink must remain parameterized or mapped to trusted syntax.

##### Key Points to Mention

- The first write may be safe.
- The later use creates the vulnerability.
- Database content can remain untrusted.
- Trace data flow across jobs, reports, and maintenance scripts.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a flexible reporting API without allowing arbitrary SQL?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q01 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Define a typed external query model and parse it into an abstract syntax tree. Allowlist report fields, operators, aggregates, and sort options, enforce per-field authorization and complexity limits, then translate values into parameterized expressions. Use read-only credentials, row limits, timeouts, and audited export jobs for expensive requests.

##### Key Points to Mention

- Do not expose a SQL `where` parameter.
- Query structure comes from trusted mappings.
- Values remain parameters.
- Performance abuse and data exposure are part of the threat model.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q01 -->

#### How would you review a large .NET codebase for SQL injection risk?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q02 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Inventory raw database sinks such as `FromSqlRaw`, `ExecuteSqlRaw`, `SqlCommand`, stored-procedure dynamic execution, and third-party query builders. Trace whether HTTP input, files, messages, or stored values influence command text, identifiers, or operators. Verify parameter types, allowlists, least privilege, authorization filters, and error handling. Add static rules and targeted integration tests.

##### Key Points to Mention

- Prioritize data flow into command text.
- Include database-side procedures and scheduled scripts.
- Review generated SQL where abstractions obscure behavior.
- Do not mark every raw query vulnerable without tracing trust.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q02 -->

#### How do you handle a dynamic table or column name when parameters cannot be used?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q03 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

First redesign the query to avoid client-controlled identifiers. If the requirement remains, map a small external enum to fixed developer-owned identifiers and reject all other values. Apply identifier quoting only after this selection and parameterize every data value. Also assess authorization and performance because a syntactically safe column may expose sensitive or unindexed data.

##### Key Points to Mention

- Parameters cannot bind schema identifiers.
- Quoting is not an allowlist.
- Trusted mapping should be local to the query.
- Avoid generic identifier validators reused across unrelated queries.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q03 -->

#### How do parameterization and query-plan performance concerns interact?

<!-- question:start:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q04 -->
<!-- question-id:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Parameterization often improves plan reuse, but skewed data can produce poor plans for some parameter values. Diagnose this with measurements and query plans, then use indexes, query redesign, purpose-specific safe query shapes, database plan controls, or measured recompilation. Do not concatenate literal values into SQL as a casual optimization because that reopens injection and plan-cache risks.

##### Key Points to Mention

- Security should not be traded for an unmeasured optimization.
- Different trusted query templates can remain parameterized.
- Database-specific behavior requires evidence.
- Monitor both latency and plan stability.

<!-- question:end:sql-injection-parameterized-queries-orm-safety-and-unsafe-dynamic-sql-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
