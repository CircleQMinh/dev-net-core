---
id: char-vs-varchar-vs-nvarchar-and-unicode-storage-choices
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: CHAR vs VARCHAR vs NVARCHAR and Unicode storage choices
category: SQL
---

## Overview

`CHAR`, `VARCHAR`, and `NVARCHAR` are SQL Server string data types. They all store character data, but they make different trade-offs around fixed length versus variable length, Unicode support, storage size, collation behavior, indexing, and compatibility with multilingual data.

`CHAR` stores fixed-length non-Unicode or UTF-8 character data depending on collation. `VARCHAR` stores variable-length non-Unicode or UTF-8 character data depending on collation. `NVARCHAR` stores variable-length Unicode character data using UCS-2 or UTF-16 behavior depending on the collation. `NCHAR` is the fixed-length Unicode counterpart, but most practical comparisons focus on `CHAR`, `VARCHAR`, and `NVARCHAR`.

This topic matters because string column choices affect correctness, storage, index size, query performance, sorting, comparisons, API behavior, and internationalization. A bad choice can truncate data, corrupt names from other languages, waste storage, make indexes unnecessarily large, or create bugs when literals and parameters use the wrong type.

For interviews, strong candidates can explain the storage difference, know that length declarations are byte-oriented, understand when Unicode is required, and choose string types based on actual data shape rather than habit.

## Core Concepts

### Character Data Type Families

SQL Server has two major character data type families:

- Non-Unicode or UTF-8-capable types: `CHAR` and `VARCHAR`
- Unicode types: `NCHAR` and `NVARCHAR`

The older shorthand is that `VARCHAR` is non-Unicode and `NVARCHAR` is Unicode. That is still useful, but it needs nuance in modern SQL Server because `CHAR` and `VARCHAR` can store Unicode data when the database or column uses a UTF-8 enabled collation.

Practical rule:

- Use `VARCHAR` for variable-length text when the allowed character set is well understood and compatible with the chosen collation.
- Use `NVARCHAR` when the application must safely store multilingual text across languages and symbols, especially in systems that do not use UTF-8 collations.
- Use `CHAR` only for truly fixed-size values.

### CHAR

`CHAR(n)` stores fixed-size string data. The value is padded to the declared size.

Example:

```sql
CREATE TABLE dbo.Country
(
    CountryCode CHAR(2) NOT NULL PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL
);
```

`CHAR(2)` is reasonable for a fixed-length country code such as `US`, `CA`, or `VN`.

Less ideal example:

```sql
CREATE TABLE dbo.Customer
(
    FirstName CHAR(50) NOT NULL
);
```

Most names are not exactly 50 bytes. `CHAR(50)` wastes space and may introduce confusing trailing-space behavior. `VARCHAR(50)` or `NVARCHAR(50)` is usually better.

Use `CHAR` when:

- Values are always the same length.
- The column stores codes, flags, fixed-width hashes, or fixed-format identifiers.
- You can tolerate padding semantics.

Avoid `CHAR` when:

- Values vary widely in length.
- User-entered text is stored.
- Storage efficiency matters for many rows.
- Trailing spaces might confuse application logic.

### VARCHAR

`VARCHAR(n)` stores variable-length string data. It stores the actual bytes used by the value plus a small length overhead.

Example:

```sql
CREATE TABLE dbo.Product
(
    ProductId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    Sku VARCHAR(40) NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL
);
```

`VARCHAR(40)` can be a good fit for SKU values when the SKU format is ASCII or otherwise supported by the column collation. `DisplayName` is `NVARCHAR` because product names may include customer-facing multilingual text.

Use `VARCHAR` when:

- Values vary in length.
- The character set is limited or controlled.
- The database uses a collation that supports the needed characters.
- Storage and index width matter.
- You are storing technical identifiers, slugs, URLs, email addresses, or codes with predictable character sets.

Avoid using `VARCHAR` blindly for names, addresses, comments, and content that may need international characters unless you have intentionally selected UTF-8 collations and tested the application path.

### NVARCHAR

`NVARCHAR(n)` stores variable-length Unicode string data. In SQL Server, the `n` value is expressed in byte-pairs, not a guaranteed number of user-perceived characters.

Example:

```sql
CREATE TABLE dbo.CustomerProfile
(
    CustomerId BIGINT NOT NULL PRIMARY KEY,
    FullName NVARCHAR(200) NOT NULL,
    City NVARCHAR(100) NULL,
    Bio NVARCHAR(1000) NULL
);
```

`NVARCHAR` is a strong default for user-facing text in international applications. It reduces the chance that characters are lost because the database code page cannot represent them.

Use `NVARCHAR` when:

- User-entered text can include multiple languages.
- Names, addresses, product titles, comments, or free-form content need Unicode.
- The system integrates with modern APIs that use Unicode strings.
- The application has no strict single-code-page assumption.

Trade-off: `NVARCHAR` often uses more storage than `VARCHAR` for simple Latin text. Wider strings also make indexes larger, reduce rows per page, increase memory use, and can slow comparisons.

### The Length Parameter Is Not Always Characters

One of the most common interview traps is assuming `VARCHAR(50)` always means 50 characters and `NVARCHAR(50)` always means 50 characters.

In SQL Server:

- For `CHAR(n)` and `VARCHAR(n)`, `n` is the string length in bytes.
- For `NCHAR(n)` and `NVARCHAR(n)`, `n` is the string length in byte-pairs.
- With UTF-8 or supplementary Unicode characters, one visible character can require multiple bytes or byte-pairs.

Example:

```sql
CREATE TABLE dbo.Messages
(
    ShortCode VARCHAR(10) NOT NULL,
    DisplayText NVARCHAR(10) NOT NULL
);
```

This is not a guarantee that every possible 10-character human string can fit. Some Unicode characters can require more storage units than a simple Latin letter.

Interview answer: declare lengths based on the real maximum stored value, understand whether the length is bytes or byte-pairs, and test with representative characters, not only ASCII test data.

### Unicode Literals And The N Prefix

Unicode string literals should be prefixed with `N`.

Correct:

```sql
SELECT *
FROM dbo.CustomerProfile
WHERE FullName = N'Nguyen Van A';
```

The `N` prefix tells SQL Server to treat the literal as Unicode input. Without it, the literal may be converted through the database default code page before it is compared or stored. Characters unsupported by that code page can be lost or changed before SQL Server ever compares them to the `NVARCHAR` column.

Common mistake:

```sql
INSERT INTO dbo.CustomerProfile (CustomerId, FullName)
VALUES (1, 'Pham Thi Hoa');
```

For simple ASCII text this may appear to work, which is why the bug hides. It becomes a real issue when names, symbols, accents, or non-Latin characters appear.

### Collation And Unicode Storage

Collation controls sorting, comparison, case sensitivity, accent sensitivity, and code page behavior for character data.

Examples of collation-sensitive behavior:

- Whether `abc` equals `ABC`.
- Whether accented characters compare as equal to unaccented forms.
- How strings sort.
- Which code page is used for `CHAR` and `VARCHAR` data when a UTF-8 collation is not used.
- Whether `VARCHAR` can store Unicode through UTF-8.

Example with a column-level collation:

```sql
CREATE TABLE dbo.SearchTerm
(
    TermId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    Term VARCHAR(200) COLLATE Latin1_General_100_CI_AI_SC_UTF8 NOT NULL
);
```

This uses a UTF-8 capable collation for a `VARCHAR` column. That can reduce storage for mostly Latin text while still supporting Unicode. The trade-off is that every part of the system must understand and consistently use the chosen collation behavior.

### VARCHAR With UTF-8 Vs NVARCHAR

Modern SQL Server supports UTF-8 collations for `CHAR` and `VARCHAR`. This gives teams another Unicode storage option.

`VARCHAR` with UTF-8 can be attractive when:

- Most text is Latin-based.
- Unicode support is needed.
- Storage size matters.
- The system standardizes on UTF-8 collations.
- Application and integration paths are tested with UTF-8 data.

`NVARCHAR` remains attractive when:

- The system already uses Unicode `NVARCHAR` widely.
- You want compatibility with existing SQL Server conventions.
- Data contains many characters that may not be smaller under UTF-8.
- You want to avoid mixing Unicode strategies.
- Third-party tools and procedures expect `NVARCHAR`.

A good interview answer does not say "`NVARCHAR` is always better" or "`VARCHAR` is always faster." It explains the data, collation, storage, and compatibility trade-offs.

### Storage And Index Impact

String data type choice affects index size.

Example:

```sql
CREATE TABLE dbo.Users
(
    UserId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    Email VARCHAR(320) NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL
);

CREATE UNIQUE INDEX UX_Users_Email
ON dbo.Users (Email);
```

Email addresses are typically constrained to a predictable character set in many systems, so `VARCHAR` may be appropriate. `DisplayName` is user-facing and may need Unicode.

Larger index keys can cause:

- More storage.
- More memory use.
- More page splits.
- Lower cache efficiency.
- Slower sorts and joins.
- Lower maximum index key flexibility.

Best practice: use the narrowest type that safely represents the required data. Narrow does not mean unsafe. A compact column that corrupts names is not a good design.

### VARCHAR(MAX) And NVARCHAR(MAX)

`VARCHAR(MAX)` and `NVARCHAR(MAX)` are for large values, not for avoiding design decisions.

Use `MAX` types for:

- Long descriptions.
- Documents or message bodies.
- Large JSON text.
- Free-form content that can exceed normal row-size expectations.

Avoid `MAX` types for:

- Names.
- Codes.
- Email addresses.
- Titles with known limits.
- Indexed search keys.

Example:

```sql
CREATE TABLE dbo.Article
(
    ArticleId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    Title NVARCHAR(250) NOT NULL,
    Body NVARCHAR(MAX) NOT NULL
);
```

This is better than making every string column `NVARCHAR(MAX)`. The title has a real limit. The body is long-form content.

### Parameters And Implicit Conversions

Application parameters should match column types.

Problem pattern:

```sql
-- Column is VARCHAR, parameter is NVARCHAR
SELECT *
FROM dbo.Users
WHERE Email = @Email;
```

If `@Email` is sent as `NVARCHAR` while `Email` is `VARCHAR`, SQL Server may need implicit conversion. Depending on data type precedence and query shape, implicit conversions can make indexes less useful or produce unexpected comparison behavior.

Better:

- Match parameter types to column types.
- Use `NVARCHAR` parameters for `NVARCHAR` columns.
- Use `VARCHAR` parameters for `VARCHAR` columns when Unicode is not needed.
- Avoid wrapping indexed columns in conversion functions in predicates.

### Common Mistakes

Common mistakes include:

- Using `VARCHAR` for multilingual names and addresses without a UTF-8 collation.
- Forgetting the `N` prefix for Unicode literals.
- Assuming `VARCHAR(50)` means 50 characters under every collation.
- Making every string column `NVARCHAR(MAX)`.
- Using `CHAR` for variable-length user-entered text.
- Mixing `VARCHAR` columns with `NVARCHAR` parameters and ignoring implicit conversions.
- Choosing string types without considering indexes.
- Treating collation as an afterthought.
- Storing structured data in strings instead of proper typed columns.

### Best Practices

Best practices:

- Use `VARCHAR` for variable-length controlled character data.
- Use `NVARCHAR` for user-facing multilingual text unless UTF-8 `VARCHAR` is an intentional standard.
- Use `CHAR` only for truly fixed-length values.
- Always specify explicit lengths.
- Prefix Unicode literals with `N`.
- Avoid `MAX` unless values can genuinely be large.
- Match parameter types to column types.
- Choose collations intentionally and document the decision.
- Test with real multilingual examples, not only ASCII data.
- Consider storage and index width before choosing broad types.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is the difference between CHAR and VARCHAR?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q01 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

`CHAR` is fixed-length, so SQL Server stores the value using the declared size and pads shorter values. `VARCHAR` is variable-length, so it stores the actual value length plus a small overhead. `CHAR` is useful for values that are always the same size, while `VARCHAR` is usually better for text whose length varies.

For example, `CHAR(2)` can make sense for a country code, but `VARCHAR(100)` or `NVARCHAR(100)` is usually better for a name.

##### Key Points to Mention

- `CHAR` is fixed-length.
- `VARCHAR` is variable-length.
- `CHAR` can waste space for variable text.
- `CHAR` can introduce trailing-space concerns.
- Choose based on actual data shape.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q01 -->

#### What is the difference between VARCHAR and NVARCHAR?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q02 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

`VARCHAR` stores variable-length character data using the column collation. With non-UTF-8 collations, it is limited to the characters supported by that code page. `NVARCHAR` stores variable-length Unicode data and is safer for multilingual text.

Modern SQL Server can store Unicode in `VARCHAR` when using UTF-8 collations, so the best choice depends on collation, storage, compatibility, and the characters the application must support.

##### Key Points to Mention

- `VARCHAR` is variable-length character data.
- `NVARCHAR` is variable-length Unicode data.
- UTF-8 collations make `VARCHAR` capable of Unicode storage.
- `NVARCHAR` is common for multilingual user text.
- Storage and index width are part of the trade-off.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q02 -->

#### When should you use NVARCHAR?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q03 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Use `NVARCHAR` when the column must store Unicode text, especially names, addresses, titles, comments, or content that may contain multiple languages, accents, symbols, or characters outside a single code page.

It is a strong default for user-facing text in international applications, but it may use more storage than `VARCHAR` for simple Latin text.

##### Key Points to Mention

- Best for multilingual text.
- Useful for names, addresses, and free-form content.
- Avoids code page data loss.
- Often wider than `VARCHAR`.
- Requires `N` prefix for Unicode literals.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q03 -->

#### Why should Unicode string literals use the N prefix?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q04 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

The `N` prefix tells SQL Server that the string literal is Unicode. Without the prefix, the literal can be converted through the database default code page before it is stored or compared. Characters unsupported by that code page can be changed or lost.

For an `NVARCHAR` column, write `N'some text'` for Unicode literals.

##### Key Points to Mention

- `N` marks the literal as Unicode.
- It matters for `NVARCHAR` comparisons and inserts.
- Without it, code page conversion can occur.
- Bugs may only appear with non-ASCII characters.
- Application parameters should also use the right type.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### Does VARCHAR(50) always mean 50 characters?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q01 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

No. In SQL Server, the `n` in `CHAR(n)` and `VARCHAR(n)` defines length in bytes, not guaranteed characters. With single-byte encodings, this often matches the number of characters. With UTF-8 or other multibyte encodings, one character can require multiple bytes.

For `NVARCHAR(n)`, `n` is byte-pairs. Supplementary Unicode characters can require two byte-pairs, so even there it is not always the same as user-perceived characters.

##### Key Points to Mention

- `CHAR` and `VARCHAR` lengths are byte-based.
- `NCHAR` and `NVARCHAR` lengths are byte-pair based.
- Multibyte characters can reduce the number of stored characters.
- Test with representative Unicode data.
- Do not design only around ASCII examples.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q01 -->

#### How does collation affect string data type choices?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q02 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Collation controls string comparison, sorting, case sensitivity, accent sensitivity, and code page behavior. For `CHAR` and `VARCHAR`, non-UTF-8 collations limit storage to the characters supported by the collation's code page. UTF-8 collations allow `VARCHAR` to store Unicode using UTF-8.

Collation also affects query results, indexes, uniqueness checks, and joins between string columns.

##### Key Points to Mention

- Collation controls comparison and sorting.
- It affects case and accent sensitivity.
- It determines code page behavior for `VARCHAR`.
- UTF-8 collations allow Unicode in `VARCHAR`.
- Collation mismatches can cause query issues.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q02 -->

#### Why is making every string column NVARCHAR(MAX) a bad design?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q03 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

`NVARCHAR(MAX)` is for large values. Using it for every string column hides real business limits, can make validation weaker, can complicate indexing, and may increase memory and sorting costs. Columns such as names, titles, emails, and codes usually have practical maximum lengths and should use explicit bounded types.

Use `MAX` for genuinely large text such as article bodies, comments with high limits, or documents.

##### Key Points to Mention

- `MAX` should be intentional.
- Bounded lengths document business rules.
- Indexing large-value columns is limited.
- Wide rows can hurt memory and sort operations.
- Use realistic limits for normal attributes.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q03 -->

#### How can implicit conversion hurt string query performance?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q04 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

If a query compares a `VARCHAR` column to an `NVARCHAR` parameter or literal, SQL Server may perform an implicit conversion. Depending on the conversion direction and query shape, this can prevent efficient index usage or change comparison behavior.

The best practice is to match application parameter types to column types and avoid applying conversion functions to indexed columns in predicates.

##### Key Points to Mention

- Type mismatches can introduce implicit conversions.
- Conversions can affect index seek ability.
- Parameter types should match column types.
- Unicode literals should use `N` for `NVARCHAR`.
- Check execution plans for conversion warnings.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you choose between NVARCHAR and VARCHAR with a UTF-8 collation?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q01 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Choose based on data distribution, compatibility, collation standards, storage, and operational consistency. `VARCHAR` with a UTF-8 collation can store Unicode and may be more compact for mostly Latin text. `NVARCHAR` is often simpler in SQL Server ecosystems that already use Unicode types and tools expecting UTF-16-style behavior.

A strong design standardizes the choice, tests representative multilingual data, matches application parameter types, and documents collation decisions.

##### Key Points to Mention

- UTF-8 `VARCHAR` can store Unicode in modern SQL Server.
- `NVARCHAR` remains a common safe default for multilingual text.
- Storage depends on character mix.
- Compatibility with existing schema and tools matters.
- Do not mix strategies casually.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q01 -->

#### What string type would you use for email, display name, and article body?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q02 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Email is often stored as `VARCHAR(320)` if the application constrains addresses to a predictable character set, although internationalized email rules may change that decision. Display name should usually be `NVARCHAR` because it is user-facing and may contain multilingual characters. Article body should often be `NVARCHAR(MAX)` if it can be long and multilingual.

The answer should mention business validation, Unicode requirements, length limits, indexing, and search behavior.

##### Key Points to Mention

- Email often has a bounded length.
- Display names are user-facing and multilingual.
- Article bodies may need `MAX`.
- Business rules drive the exact choice.
- Indexing and search requirements matter.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q02 -->

#### How do string type choices affect indexing strategy?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q03 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

String type choices affect key width, storage, memory use, page density, sort costs, and comparison costs. Wider keys reduce how many rows fit per page and can make nonclustered indexes larger. `NVARCHAR` may be necessary for correctness, but using it for every indexed technical code without reason can add cost.

A good indexing strategy keeps keys narrow when possible, uses included columns carefully, avoids `MAX` types as search keys, and aligns data types between columns and parameters.

##### Key Points to Mention

- Wider strings create wider indexes.
- Wider indexes use more memory and I/O.
- Correctness still comes before compactness.
- Avoid indexing unnecessary long text.
- Match parameter and column data types.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q03 -->

#### How would you migrate a VARCHAR column to support multilingual text?

<!-- question:start:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q04 -->
<!-- question-id:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

First assess existing data, collation, application parameters, indexes, constraints, stored procedures, and downstream integrations. Then choose either `NVARCHAR` or a UTF-8 `VARCHAR` collation as a deliberate standard. Plan a migration that updates column definitions, parameters, literals, indexes, tests, and validation rules.

The migration must test non-ASCII and supplementary characters. It should also check index width, query plans, and compatibility with reports or integrations.

##### Key Points to Mention

- Assess current data and dependencies.
- Choose `NVARCHAR` or UTF-8 `VARCHAR` intentionally.
- Update literals and parameters.
- Test multilingual data.
- Review indexes and query plans.
- Coordinate application and database changes.

<!-- question:end:char-vs-varchar-vs-nvarchar-and-unicode-storage-choices-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
