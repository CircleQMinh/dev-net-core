---
id: one-to-one-one-to-many-many-to-many-relationships
topic: Core querying and data retrieval
subtopic: One-to-one, one-to-many, and many-to-many relationships
category: SQL
---


# 1-to-1, 1-to-many, and many-to-many relationships

## Overview

Relational databases organize data into tables, and relationships describe how rows in one table are connected to rows in another table. The three most common relationship types are:

- **1-to-1**
- **1-to-many**
- **many-to-many**

These relationships are implemented using **primary keys**, **foreign keys**, **unique constraints**, and sometimes **junction tables**.

Understanding relationships is essential for SQL interviews because most real database queries involve connected data. A developer rarely works with one isolated table. A typical application has users, orders, products, payments, roles, permissions, invoices, comments, categories, tags, and audit records. These tables must be connected correctly so the database can preserve data integrity and queries can retrieve accurate results.

Example:

```text
Customer 1-to-many Orders
Order 1-to-many OrderItems
Product many-to-many Categories
User many-to-many Roles
Employee 1-to-1 EmployeeProfile
```

Relationships matter because they affect:

- Data integrity.
- Query design.
- Join logic.
- Normalization.
- Indexing.
- Delete behavior.
- Update behavior.
- Performance.
- Reporting.
- Application code.
- Entity Framework Core mapping.
- API response design.
- Database constraints.

A weak relationship design can cause serious problems:

- Duplicate data.
- Orphan rows.
- Inconsistent reports.
- Slow joins.
- Incorrect counts.
- Many-to-many data stored as comma-separated values.
- Accidental duplicate links.
- Deleting a parent row unexpectedly deleting too much data.
- Application code enforcing rules that the database should enforce.
- Queries that return duplicate rows because relationships are misunderstood.

In interviews, relationship questions are common because they test both database fundamentals and practical design judgment. A strong candidate should be able to explain not only the definitions, but also how to implement each relationship in SQL, how to query each relationship using joins, which constraints are needed, and what mistakes to avoid.

A good answer should connect relationship types to real examples:

```text
1-to-1:
One employee has one employee profile.

1-to-many:
One customer can place many orders.

Many-to-many:
One student can enroll in many courses, and one course can have many students.
```

The most important practical rule is:

```text
Relationships should be enforced by database constraints whenever possible, not only by application code.
```

## Core Concepts

### Primary Keys

A **primary key** uniquely identifies each row in a table. Every row should have a stable identifier that can be referenced by other tables.

Example:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    Email NVARCHAR(320) NOT NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId)
);
```

In this table, `CustomerId` uniquely identifies each customer.

Primary key characteristics:

- Must be unique.
- Cannot be `NULL`.
- There is one primary key constraint per table.
- Can be a single column or multiple columns.
- Is commonly referenced by foreign keys.
- Usually has an index automatically created by the database.

Composite primary key example:

```sql
CREATE TABLE CourseEnrollments
(
    StudentId INT NOT NULL,
    CourseId INT NOT NULL,
    EnrolledAtUtc DATETIME2 NOT NULL,

    CONSTRAINT PK_CourseEnrollments PRIMARY KEY (StudentId, CourseId)
);
```

Here, the combination of `StudentId` and `CourseId` uniquely identifies one enrollment.

### Foreign Keys

A **foreign key** is a column or set of columns in one table that references a primary key or unique key in another table. It creates and enforces a relationship between tables.

Example:

```sql
CREATE TABLE Orders
(
    OrderId INT IDENTITY(1,1) NOT NULL,
    CustomerId INT NOT NULL,
    OrderDateUtc DATETIME2 NOT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),

    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId)
);
```

This means every `Orders.CustomerId` must refer to an existing `Customers.CustomerId`.

Foreign keys help prevent:

- Orders assigned to non-existing customers.
- Child rows with invalid parent references.
- Orphan data.
- Inconsistent relationships.

Important terminology:

| Term | Meaning |
|---|---|
| Parent table | The table being referenced |
| Child table | The table containing the foreign key |
| Referenced key | The primary or unique key being referenced |
| Foreign key column | The column storing the reference |
| Referential integrity | Rule that relationships must remain valid |

In the customer/order example:

```text
Customers = parent table
Orders = child table
Orders.CustomerId = foreign key
Customers.CustomerId = referenced primary key
```

### Unique Constraints

A **unique constraint** ensures that values in one column or a combination of columns are unique.

Unique constraints are especially important for 1-to-1 relationships and many-to-many junction tables.

Example:

```sql
CREATE TABLE EmployeeProfiles
(
    EmployeeProfileId INT IDENTITY(1,1) NOT NULL,
    EmployeeId INT NOT NULL,
    Biography NVARCHAR(1000) NULL,

    CONSTRAINT PK_EmployeeProfiles PRIMARY KEY (EmployeeProfileId),

    CONSTRAINT UQ_EmployeeProfiles_EmployeeId UNIQUE (EmployeeId),

    CONSTRAINT FK_EmployeeProfiles_Employees
        FOREIGN KEY (EmployeeId)
        REFERENCES Employees(EmployeeId)
);
```

The foreign key links the profile to an employee. The unique constraint prevents two profiles from referencing the same employee. Together, they enforce 1-to-1.

Without the unique constraint, the design becomes 1-to-many.

### Cardinality

**Cardinality** describes how many rows in one table can be related to rows in another table.

Common relationship cardinalities:

| Relationship | Meaning |
|---|---|
| 1-to-1 | One row in table A relates to at most one row in table B |
| 1-to-many | One row in table A relates to many rows in table B |
| many-to-many | Many rows in table A relate to many rows in table B |

Examples:

```text
1-to-1:
Employee -> EmployeeProfile

1-to-many:
Customer -> Orders

Many-to-many:
Students <-> Courses
```

Cardinality should come from business rules, not convenience.

### Optional vs Required Relationships

A relationship can be required or optional.

Required relationship:

```sql
CustomerId INT NOT NULL
```

This means each order must have a customer.

Optional relationship:

```sql
SalesRepresentativeId INT NULL
```

This means a customer may or may not have a sales representative.

Example:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    SalesRepresentativeId INT NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId),

    CONSTRAINT FK_Customers_Employees
        FOREIGN KEY (SalesRepresentativeId)
        REFERENCES Employees(EmployeeId)
);
```

A nullable foreign key represents an optional relationship.

Interview point:

```text
NOT NULL foreign key = required relationship.
NULL foreign key = optional relationship.
```

### 1-to-1 Relationships

A **1-to-1 relationship** means one row in table A is related to at most one row in table B, and one row in table B is related to at most one row in table A.

Examples:

- One employee has one employee profile.
- One user has one user security setting row.
- One person has one passport record in a simplified country-specific system.
- One customer has one billing preference record.
- One product has one product detail row.

1-to-1 relationships are less common than 1-to-many. They are usually used when:

- Some data is optional and should be stored separately.
- Sensitive data should be isolated.
- Large rarely-used columns should be separated.
- Different parts of the system own different data.
- You want to split a wide table.
- You want separate permissions or auditing.
- You want to model an extension table.

Example:

```text
Employees
- EmployeeId
- FullName
- DepartmentId

EmployeeProfiles
- EmployeeProfileId
- EmployeeId
- Biography
- LinkedInUrl
```

Each employee can have one profile, and each profile belongs to one employee.

### Implementing 1-to-1 with a Unique Foreign Key

One common way to implement 1-to-1 is to place a foreign key in one table and add a unique constraint on that foreign key.

```sql
CREATE TABLE Employees
(
    EmployeeId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Employees PRIMARY KEY (EmployeeId)
);

CREATE TABLE EmployeeProfiles
(
    EmployeeProfileId INT IDENTITY(1,1) NOT NULL,
    EmployeeId INT NOT NULL,
    Biography NVARCHAR(1000) NULL,
    LinkedInUrl NVARCHAR(500) NULL,

    CONSTRAINT PK_EmployeeProfiles PRIMARY KEY (EmployeeProfileId),

    CONSTRAINT UQ_EmployeeProfiles_EmployeeId UNIQUE (EmployeeId),

    CONSTRAINT FK_EmployeeProfiles_Employees
        FOREIGN KEY (EmployeeId)
        REFERENCES Employees(EmployeeId)
);
```

Important parts:

```text
EmployeeProfiles.EmployeeId is a foreign key to Employees.EmployeeId.
EmployeeProfiles.EmployeeId is also unique.
```

The foreign key ensures the employee exists. The unique constraint ensures one employee cannot have multiple profile rows.

Query:

```sql
SELECT
    e.EmployeeId,
    e.FullName,
    p.Biography,
    p.LinkedInUrl
FROM Employees e
LEFT JOIN EmployeeProfiles p
    ON p.EmployeeId = e.EmployeeId;
```

Use `LEFT JOIN` because an employee may not have a profile yet.

### Implementing 1-to-1 with a Shared Primary Key

Another strong 1-to-1 pattern is a shared primary key. The child table's primary key is also a foreign key to the parent table.

```sql
CREATE TABLE Employees
(
    EmployeeId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Employees PRIMARY KEY (EmployeeId)
);

CREATE TABLE EmployeeProfiles
(
    EmployeeId INT NOT NULL,
    Biography NVARCHAR(1000) NULL,
    LinkedInUrl NVARCHAR(500) NULL,

    CONSTRAINT PK_EmployeeProfiles PRIMARY KEY (EmployeeId),

    CONSTRAINT FK_EmployeeProfiles_Employees
        FOREIGN KEY (EmployeeId)
        REFERENCES Employees(EmployeeId)
);
```

Here, `EmployeeProfiles.EmployeeId` is both:

- The primary key of `EmployeeProfiles`.
- The foreign key to `Employees`.

This naturally enforces one profile per employee.

Benefits:

- Simple constraint model.
- No separate surrogate key needed in the child table.
- Strong 1-to-1 enforcement.
- Good for extension tables.

Trade-offs:

- Child row identity is fully dependent on parent row.
- Less flexible if the child table later needs independent identity.
- Insert order matters: parent must exist first.

### When to Use 1-to-1

Use 1-to-1 when the split has a clear purpose.

Good reasons:

- Security separation.
- Optional data.
- Rarely accessed large data.
- Different ownership/lifecycle.
- Reducing row width.
- Isolating sensitive information.
- Extension table pattern.
- Legacy migration.
- Table-per-type style modeling.

Example: security separation

```text
Users
- UserId
- Email
- DisplayName

UserSecrets
- UserId
- PasswordHash
- PasswordSalt
- LastPasswordChangedAtUtc
```

This can help separate sensitive data and access permissions.

Bad reasons:

- Splitting tables without a clear need.
- Thinking every logical object must have many tables.
- Creating 1-to-1 tables because a table has "too many columns" without performance or ownership evidence.
- Avoiding nullable columns without understanding whether the split adds value.

### 1-to-many Relationships

A **1-to-many relationship** means one row in a parent table can be related to many rows in a child table, but each child row belongs to one parent row.

This is the most common relationship type.

Examples:

- One customer can have many orders.
- One order can have many order items.
- One category can have many products.
- One blog post can have many comments.
- One department can have many employees.
- One invoice can have many invoice lines.

Implementation rule:

```text
Put the foreign key on the many side.
```

Example:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId)
);

CREATE TABLE Orders
(
    OrderId INT IDENTITY(1,1) NOT NULL,
    CustomerId INT NOT NULL,
    OrderDateUtc DATETIME2 NOT NULL,
    Status NVARCHAR(50) NOT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),

    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId)
);
```

One customer can have many rows in `Orders`.

Query:

```sql
SELECT
    c.CustomerId,
    c.FullName,
    o.OrderId,
    o.OrderDateUtc,
    o.Status
FROM Customers c
INNER JOIN Orders o
    ON o.CustomerId = c.CustomerId
WHERE c.CustomerId = 1
ORDER BY o.OrderDateUtc DESC;
```

### Required 1-to-many

A required 1-to-many relationship means each child row must have a parent.

Example:

```sql
CustomerId INT NOT NULL
```

In this design, every order must belong to a customer.

This is common for:

- Orders belonging to customers.
- Order items belonging to orders.
- Comments belonging to posts.
- Invoice lines belonging to invoices.

### Optional 1-to-many

An optional 1-to-many relationship means a child row may or may not have a parent.

Example:

```sql
CREATE TABLE Employees
(
    EmployeeId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    ManagerId INT NULL,

    CONSTRAINT PK_Employees PRIMARY KEY (EmployeeId),

    CONSTRAINT FK_Employees_Manager
        FOREIGN KEY (ManagerId)
        REFERENCES Employees(EmployeeId)
);
```

This is a self-referencing relationship:

```text
One manager can manage many employees.
An employee may have zero or one manager.
```

Query:

```sql
SELECT
    e.EmployeeId,
    e.FullName AS EmployeeName,
    m.FullName AS ManagerName
FROM Employees e
LEFT JOIN Employees m
    ON m.EmployeeId = e.ManagerId;
```

Use `LEFT JOIN` because some employees may not have a manager.

### many-to-many Relationships

A **many-to-many relationship** means many rows in table A can relate to many rows in table B.

Examples:

- Students can enroll in many courses; courses can have many students.
- Users can have many roles; roles can belong to many users.
- Products can belong to many categories; categories can contain many products.
- Posts can have many tags; tags can apply to many posts.
- Doctors can have many patients; patients can have many doctors.
- Books can have many authors; authors can write many books.

Relational databases do not model many-to-many directly with only two tables. They use a third table called a **junction table**, **join table**, **bridge table**, **association table**, or **link table**.

Example:

```text
Students
Courses
CourseEnrollments
```

`CourseEnrollments` connects students and courses.

### Implementing many-to-many with a Junction Table

Example:

```sql
CREATE TABLE Students
(
    StudentId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Students PRIMARY KEY (StudentId)
);

CREATE TABLE Courses
(
    CourseId INT IDENTITY(1,1) NOT NULL,
    CourseName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Courses PRIMARY KEY (CourseId)
);

CREATE TABLE CourseEnrollments
(
    StudentId INT NOT NULL,
    CourseId INT NOT NULL,
    EnrolledAtUtc DATETIME2 NOT NULL,
    Grade NVARCHAR(5) NULL,

    CONSTRAINT PK_CourseEnrollments PRIMARY KEY (StudentId, CourseId),

    CONSTRAINT FK_CourseEnrollments_Students
        FOREIGN KEY (StudentId)
        REFERENCES Students(StudentId),

    CONSTRAINT FK_CourseEnrollments_Courses
        FOREIGN KEY (CourseId)
        REFERENCES Courses(CourseId)
);
```

The junction table has:

- A foreign key to `Students`.
- A foreign key to `Courses`.
- A primary key or unique constraint to prevent duplicate relationships.
- Optional attributes about the relationship, such as `EnrolledAtUtc` or `Grade`.

Query students and their courses:

```sql
SELECT
    s.StudentId,
    s.FullName,
    c.CourseId,
    c.CourseName,
    e.EnrolledAtUtc,
    e.Grade
FROM Students s
INNER JOIN CourseEnrollments e
    ON e.StudentId = s.StudentId
INNER JOIN Courses c
    ON c.CourseId = e.CourseId
ORDER BY s.FullName, c.CourseName;
```

Query all courses for one student:

```sql
SELECT
    c.CourseId,
    c.CourseName,
    e.EnrolledAtUtc,
    e.Grade
FROM CourseEnrollments e
INNER JOIN Courses c
    ON c.CourseId = e.CourseId
WHERE e.StudentId = 1
ORDER BY c.CourseName;
```

Query all students in one course:

```sql
SELECT
    s.StudentId,
    s.FullName,
    e.EnrolledAtUtc,
    e.Grade
FROM CourseEnrollments e
INNER JOIN Students s
    ON s.StudentId = e.StudentId
WHERE e.CourseId = 10
ORDER BY s.FullName;
```

### Junction Table Naming

Common naming styles:

```text
StudentCourses
CourseStudents
CourseEnrollments
UserRoles
ProductCategories
PostTags
BookAuthors
```

Prefer a domain name when the relationship has meaning or attributes.

Examples:

```text
CourseEnrollments instead of StudentCourses
OrderItems instead of OrderProducts
ProjectAssignments instead of EmployeeProjects
Memberships instead of UserGroups
```

If the relationship has its own data, it is often a real business entity.

### Composite Key vs Surrogate Key in Junction Tables

A junction table can use either a composite primary key or a surrogate primary key.

Composite key:

```sql
CREATE TABLE UserRoles
(
    UserId INT NOT NULL,
    RoleId INT NOT NULL,

    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId)
);
```

Surrogate key plus unique constraint:

```sql
CREATE TABLE UserRoles
(
    UserRoleId INT IDENTITY(1,1) NOT NULL,
    UserId INT NOT NULL,
    RoleId INT NOT NULL,

    CONSTRAINT PK_UserRoles PRIMARY KEY (UserRoleId),

    CONSTRAINT UQ_UserRoles_UserId_RoleId UNIQUE (UserId, RoleId)
);
```

Composite key benefits:

- Natural uniqueness.
- No extra identity column.
- Prevents duplicates directly.
- Good for pure link tables.

Composite key trade-offs:

- Foreign keys to the junction table require multiple columns.
- Some ORMs or APIs may prefer a single-column key.
- If the relationship later needs independent identity, migration may be needed.

Surrogate key benefits:

- Simple single-column identity.
- Easier for APIs and ORMs in some cases.
- Useful when the relationship has its own lifecycle.
- Useful when other tables reference the relationship.

Surrogate key trade-offs:

- Must still add unique constraint on `(UserId, RoleId)` to prevent duplicates.
- Extra column.
- Can hide duplicate relationship bugs if unique constraint is missing.

Best practice:

```text
For pure junction tables, a composite primary key is often sufficient.
For relationship entities with their own lifecycle or references, a surrogate key plus a unique constraint can be useful.
```

### Relationship Attributes

Sometimes the relationship itself has data.

Example many-to-many:

```text
Student <-> Course
```

Relationship data:

```text
EnrolledAtUtc
Grade
Status
CompletedAtUtc
```

This data belongs in the junction table because it describes the relationship, not only the student or the course.

```sql
CREATE TABLE CourseEnrollments
(
    EnrollmentId INT IDENTITY(1,1) NOT NULL,
    StudentId INT NOT NULL,
    CourseId INT NOT NULL,
    EnrolledAtUtc DATETIME2 NOT NULL,
    CompletedAtUtc DATETIME2 NULL,
    Grade NVARCHAR(5) NULL,
    Status NVARCHAR(50) NOT NULL,

    CONSTRAINT PK_CourseEnrollments PRIMARY KEY (EnrollmentId),

    CONSTRAINT UQ_CourseEnrollments_StudentId_CourseId
        UNIQUE (StudentId, CourseId),

    CONSTRAINT FK_CourseEnrollments_Students
        FOREIGN KEY (StudentId)
        REFERENCES Students(StudentId),

    CONSTRAINT FK_CourseEnrollments_Courses
        FOREIGN KEY (CourseId)
        REFERENCES Courses(CourseId)
);
```

This is sometimes called an associative entity.

### Inner Join vs Left Join for Relationships

When querying relationships, the join type affects which rows appear.

`INNER JOIN` returns only matching rows.

Example:

```sql
SELECT
    c.CustomerId,
    c.FullName,
    o.OrderId
FROM Customers c
INNER JOIN Orders o
    ON o.CustomerId = c.CustomerId;
```

This returns only customers who have orders.

`LEFT JOIN` returns all rows from the left table, even when there is no match.

```sql
SELECT
    c.CustomerId,
    c.FullName,
    o.OrderId
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId;
```

This returns all customers, including customers with no orders.

Interview point:

```text
Use INNER JOIN when the related row must exist.
Use LEFT JOIN when the parent row should appear even if related data does not exist.
```

### Counting Related Rows

A common relationship query is counting child rows.

Count orders per customer:

```sql
SELECT
    c.CustomerId,
    c.FullName,
    COUNT(o.OrderId) AS OrderCount
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId
GROUP BY
    c.CustomerId,
    c.FullName
ORDER BY OrderCount DESC;
```

Use `LEFT JOIN` when you want customers with zero orders included.

Important:

```sql
COUNT(o.OrderId)
```

counts matching child rows.

```sql
COUNT(*)
```

with `LEFT JOIN` can return 1 for a parent with no child because the parent row still exists in the result.

### Filtering with Outer Joins

A common mistake is accidentally turning a `LEFT JOIN` into an `INNER JOIN`.

Bad:

```sql
SELECT
    c.CustomerId,
    c.FullName,
    o.OrderId
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = 'Completed';
```

The `WHERE` clause removes rows where `o.Status` is `NULL`, so customers with no completed orders disappear.

Better if you want all customers and only completed matching orders:

```sql
SELECT
    c.CustomerId,
    c.FullName,
    o.OrderId
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId
   AND o.Status = 'Completed';
```

This preserves customers with no completed orders.

Interview point:

```text
Filters on the right table of a LEFT JOIN usually belong in the ON clause if you still want unmatched left-side rows.
```

### Delete Behavior and Referential Actions

Foreign keys can define what happens when a referenced parent row is deleted or updated.

Common delete behaviors:

| Behavior | Meaning |
|---|---|
| NO ACTION / RESTRICT | Prevent deleting parent if child rows exist |
| CASCADE | Delete child rows automatically when parent is deleted |
| SET NULL | Set child foreign key to NULL when parent is deleted |
| SET DEFAULT | Set child foreign key to default value |

Example cascade delete:

```sql
CREATE TABLE OrderItems
(
    OrderItemId INT IDENTITY(1,1) NOT NULL,
    OrderId INT NOT NULL,
    ProductId INT NOT NULL,
    Quantity INT NOT NULL,

    CONSTRAINT PK_OrderItems PRIMARY KEY (OrderItemId),

    CONSTRAINT FK_OrderItems_Orders
        FOREIGN KEY (OrderId)
        REFERENCES Orders(OrderId)
        ON DELETE CASCADE
);
```

If an order is deleted, its order items are deleted too.

Use cascade delete carefully.

Good cascade examples:

- Order -> OrderItems.
- BlogPost -> Comments in some systems.
- Parent temporary record -> child temporary record.

Dangerous cascade examples:

- Customer -> Orders in systems where order history must be preserved.
- User -> AuditLogs if audit logs must remain.
- Product -> OrderItems if historical order lines must remain.

Best practice:

```text
Choose delete behavior based on business rules and data retention requirements.
```

### Indexing Foreign Keys

Foreign keys are often used in joins and filters, so indexing foreign key columns is usually important for performance.

Example:

```sql
CREATE INDEX IX_Orders_CustomerId
ON Orders(CustomerId);
```

For a junction table:

```sql
CREATE INDEX IX_CourseEnrollments_CourseId
ON CourseEnrollments(CourseId);
```

If primary key is `(StudentId, CourseId)`, this index helps queries that start from `CourseId`.

Why indexes matter:

- Faster joins.
- Faster lookups of child rows.
- Faster cascade checks.
- Better query plans.
- Reduced table scans.

Common mistake:

```text
Assuming the foreign key automatically creates an index.
```

In SQL Server, creating a foreign key does not automatically create an index on the child column. You often need to create the index yourself.

### Normalization and Relationships

Normalization is the process of organizing relational data to reduce duplication and improve integrity.

Relationships are central to normalization.

Example bad design:

```sql
CREATE TABLE Customers
(
    CustomerId INT PRIMARY KEY,
    FullName NVARCHAR(200),
    Order1Id INT NULL,
    Order2Id INT NULL,
    Order3Id INT NULL
);
```

Problems:

- Fixed number of orders.
- Many nullable columns.
- Hard to query.
- Hard to add more orders.
- Violates relational design principles.

Better 1-to-many design:

```sql
CREATE TABLE Customers
(
    CustomerId INT PRIMARY KEY,
    FullName NVARCHAR(200) NOT NULL
);

CREATE TABLE Orders
(
    OrderId INT PRIMARY KEY,
    CustomerId INT NOT NULL,
    OrderDateUtc DATETIME2 NOT NULL,

    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId)
);
```

Another bad design for many-to-many:

```sql
CREATE TABLE Students
(
    StudentId INT PRIMARY KEY,
    FullName NVARCHAR(200),
    CourseIds NVARCHAR(500)
);
```

Example value:

```text
"1,2,5,9"
```

Problems:

- Hard to enforce foreign keys.
- Hard to query.
- Hard to index correctly.
- Hard to prevent duplicates.
- Hard to update.
- Breaks normalization.

Better:

```sql
CREATE TABLE CourseEnrollments
(
    StudentId INT NOT NULL,
    CourseId INT NOT NULL,

    CONSTRAINT PK_CourseEnrollments PRIMARY KEY (StudentId, CourseId)
);
```

### Denormalization and Relationships

Sometimes systems intentionally denormalize data for performance or reporting, but this should be done carefully.

Example:

```sql
CREATE TABLE Orders
(
    OrderId INT PRIMARY KEY,
    CustomerId INT NOT NULL,
    CustomerNameSnapshot NVARCHAR(200) NOT NULL,
    OrderDateUtc DATETIME2 NOT NULL
);
```

`CustomerNameSnapshot` duplicates data, but it may be intentional because the order should preserve the customer name as it appeared at purchase time.

Good denormalization reasons:

- Historical snapshots.
- Reporting performance.
- Read-heavy query optimization.
- Avoiding expensive joins in read models.
- Event-sourced projections.
- Search indexes.

Bad denormalization reasons:

- Avoiding joins because they are misunderstood.
- Storing comma-separated IDs.
- Duplicating business data with no synchronization plan.
- Premature optimization.

Best practice:

```text
Normalize first for correctness. Denormalize intentionally for specific performance or historical requirements.
```

### Relationship Modeling Examples

#### E-commerce

```text
Customer 1-to-many Orders
Order 1-to-many OrderItems
Product 1-to-many OrderItems
Product many-to-many Categories
User many-to-many Roles
```

Tables:

```text
Customers
Orders
OrderItems
Products
Categories
ProductCategories
Users
Roles
UserRoles
```

#### Blog System

```text
Author 1-to-many Posts
Post 1-to-many Comments
Post many-to-many Tags
User 1-to-1 UserProfile
```

Tables:

```text
Users
UserProfiles
Posts
Comments
Tags
PostTags
```

#### Course Management

```text
Instructor 1-to-many Courses
Student many-to-many Courses through Enrollments
Course 1-to-many Assignments
Assignment 1-to-many Submissions
```

Tables:

```text
Instructors
Courses
Students
CourseEnrollments
Assignments
Submissions
```

### Modeling Direction

Relationships are often described in one direction, but SQL queries can navigate either direction using joins.

Example:

```text
One customer has many orders.
```

This also means:

```text
Each order belongs to one customer.
```

The foreign key is stored on the child table:

```text
Orders.CustomerId
```

To get orders for a customer:

```sql
SELECT *
FROM Orders
WHERE CustomerId = 1;
```

To get customer for an order:

```sql
SELECT
    o.OrderId,
    c.FullName
FROM Orders o
INNER JOIN Customers c
    ON c.CustomerId = o.CustomerId
WHERE o.OrderId = 100;
```

The physical foreign key placement matters.

### Self-Referencing Relationships

A self-referencing relationship is a relationship where a table references itself.

Example: employee-manager hierarchy

```sql
CREATE TABLE Employees
(
    EmployeeId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    ManagerId INT NULL,

    CONSTRAINT PK_Employees PRIMARY KEY (EmployeeId),

    CONSTRAINT FK_Employees_Manager
        FOREIGN KEY (ManagerId)
        REFERENCES Employees(EmployeeId)
);
```

This represents:

```text
One manager can have many employees.
One employee can have zero or one manager.
```

Query:

```sql
SELECT
    e.FullName AS EmployeeName,
    m.FullName AS ManagerName
FROM Employees e
LEFT JOIN Employees m
    ON m.EmployeeId = e.ManagerId;
```

Self-referencing many-to-many example:

```text
Users can follow many users.
Users can be followed by many users.
```

```sql
CREATE TABLE UserFollows
(
    FollowerUserId INT NOT NULL,
    FollowedUserId INT NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL,

    CONSTRAINT PK_UserFollows PRIMARY KEY (FollowerUserId, FollowedUserId),

    CONSTRAINT FK_UserFollows_Follower
        FOREIGN KEY (FollowerUserId)
        REFERENCES Users(UserId),

    CONSTRAINT FK_UserFollows_Followed
        FOREIGN KEY (FollowedUserId)
        REFERENCES Users(UserId),

    CONSTRAINT CK_UserFollows_NoSelfFollow
        CHECK (FollowerUserId <> FollowedUserId)
);
```

### Composite Foreign Keys

A foreign key can reference multiple columns.

Example:

```sql
CREATE TABLE Tenants
(
    TenantId INT NOT NULL,
    RegionCode NVARCHAR(10) NOT NULL,

    CONSTRAINT PK_Tenants PRIMARY KEY (TenantId, RegionCode)
);

CREATE TABLE TenantUsers
(
    TenantUserId INT IDENTITY(1,1) NOT NULL,
    TenantId INT NOT NULL,
    RegionCode NVARCHAR(10) NOT NULL,
    Email NVARCHAR(320) NOT NULL,

    CONSTRAINT PK_TenantUsers PRIMARY KEY (TenantUserId),

    CONSTRAINT FK_TenantUsers_Tenants
        FOREIGN KEY (TenantId, RegionCode)
        REFERENCES Tenants(TenantId, RegionCode)
);
```

Composite keys can be useful, but they make joins and foreign keys more verbose. Many systems use surrogate keys for simplicity and unique constraints for business rules.

### Business Keys vs Surrogate Keys

A **surrogate key** is an artificial identifier, such as `CustomerId INT IDENTITY` or `uniqueidentifier`.

A **business key** is a real-world unique value, such as `Email`, `NationalId`, `Sku`, or `PolicyNumber`.

Example:

```sql
CREATE TABLE Products
(
    ProductId INT IDENTITY(1,1) NOT NULL,
    Sku NVARCHAR(50) NOT NULL,
    ProductName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku)
);
```

Relationships often use surrogate keys because they are stable and compact. Business keys should still be protected with unique constraints when required.

Best practice:

```text
Use a surrogate primary key for technical relationships when useful.
Use unique constraints to enforce natural business uniqueness.
```

### Relationship Constraints vs Application Logic

Application code can validate relationships, but the database should enforce critical integrity rules.

Bad:

```text
Application checks whether CustomerId exists before inserting Order.
Database has no foreign key.
```

This is fragile because:

- Another application can insert invalid data.
- A background job can bypass the check.
- Race conditions can occur.
- Manual scripts can corrupt data.
- Reports can become unreliable.

Better:

```sql
CONSTRAINT FK_Orders_Customers
    FOREIGN KEY (CustomerId)
    REFERENCES Customers(CustomerId)
```

Application validation is still useful for user-friendly errors, but database constraints are the final protection.

### Querying Across Multiple Relationships

Real queries often cross multiple relationships.

Example: order details with customer and products

```sql
SELECT
    o.OrderId,
    o.OrderDateUtc,
    c.FullName AS CustomerName,
    p.ProductName,
    oi.Quantity,
    oi.UnitPrice,
    oi.Quantity * oi.UnitPrice AS LineTotal
FROM Orders o
INNER JOIN Customers c
    ON c.CustomerId = o.CustomerId
INNER JOIN OrderItems oi
    ON oi.OrderId = o.OrderId
INNER JOIN Products p
    ON p.ProductId = oi.ProductId
WHERE o.OrderId = 100;
```

Relationships:

```text
Customers 1-to-many Orders
Orders 1-to-many OrderItems
Products 1-to-many OrderItems
```

The query joins from parent to child and child to related parent.

### Avoiding Duplicate Rows in Relationship Queries

Joining 1-to-many or many-to-many relationships naturally produces multiple rows.

Example:

```sql
SELECT
    c.CustomerId,
    c.FullName,
    o.OrderId
FROM Customers c
INNER JOIN Orders o
    ON o.CustomerId = c.CustomerId;
```

If one customer has 5 orders, that customer appears 5 times.

This is not necessarily wrong. It reflects the result grain.

Important concept:

```text
The result grain is the level represented by one row in the result.
```

In the query above, the result grain is:

```text
One row per customer-order pair.
```

If you want one row per customer, aggregate:

```sql
SELECT
    c.CustomerId,
    c.FullName,
    COUNT(o.OrderId) AS OrderCount
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId
GROUP BY c.CustomerId, c.FullName;
```

Common mistake:

```text
Using DISTINCT to hide duplicate rows without understanding why the join produced them.
```

`DISTINCT` can hide modeling or query mistakes and may add unnecessary cost.

### Handling Duplicate Links in Many-to-Many

A many-to-many junction table should prevent duplicate links.

Bad:

```sql
CREATE TABLE UserRoles
(
    UserRoleId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    RoleId INT NOT NULL
);
```

This allows duplicate rows:

```text
UserId = 1, RoleId = 2
UserId = 1, RoleId = 2
```

Better:

```sql
CREATE TABLE UserRoles
(
    UserId INT NOT NULL,
    RoleId INT NOT NULL,

    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),

    CONSTRAINT FK_UserRoles_Users
        FOREIGN KEY (UserId)
        REFERENCES Users(UserId),

    CONSTRAINT FK_UserRoles_Roles
        FOREIGN KEY (RoleId)
        REFERENCES Roles(RoleId)
);
```

Or:

```sql
CREATE TABLE UserRoles
(
    UserRoleId INT IDENTITY(1,1) NOT NULL,
    UserId INT NOT NULL,
    RoleId INT NOT NULL,

    CONSTRAINT PK_UserRoles PRIMARY KEY (UserRoleId),

    CONSTRAINT UQ_UserRoles_UserId_RoleId UNIQUE (UserId, RoleId)
);
```

Always enforce uniqueness on the pair.

### Relationship Design and EF Core

Even though this topic is SQL, .NET developers often map these relationships in EF Core.

Common mapping concepts:

```text
1-to-many:
Customer has many Orders.
Order has one Customer.

1-to-1:
User has one UserProfile.
UserProfile has one User.

Many-to-many:
Student has many Courses.
Course has many Students.
```

EF Core can create many-to-many relationships with skip navigations, but the relational database still uses a junction table.

Interview point:

```text
ORM navigation properties do not replace relational constraints. The database still needs keys, foreign keys, and unique constraints.
```

### Common Mistakes

Common mistakes include:

- Not defining foreign keys.
- Enforcing relationships only in application code.
- Putting the foreign key on the wrong side of a 1-to-many relationship.
- Forgetting the unique constraint in a 1-to-1 relationship.
- Modeling many-to-many with comma-separated IDs.
- Modeling many-to-many with repeated columns such as `Course1Id`, `Course2Id`, `Course3Id`.
- Forgetting to prevent duplicate rows in a junction table.
- Not indexing foreign keys.
- Using `INNER JOIN` when `LEFT JOIN` is required.
- Filtering the right table of a `LEFT JOIN` in the `WHERE` clause incorrectly.
- Using `DISTINCT` to hide duplicate rows from misunderstood joins.
- Choosing cascade delete without understanding data retention rules.
- Sharing one table for unrelated concepts.
- Over-normalizing without a practical reason.
- Denormalizing without a synchronization strategy.
- Using business keys as primary keys when they can change.
- Not naming constraints clearly.
- Not understanding optional vs required relationships.
- Not considering delete behavior.
- Ignoring relationship attributes in many-to-many designs.

### Best Practices

Use primary keys to uniquely identify rows.

Use foreign keys to enforce relationships.

Use `NOT NULL` foreign keys for required relationships.

Use nullable foreign keys for optional relationships.

Put the foreign key on the many side of a 1-to-many relationship.

Use a unique foreign key or shared primary key for 1-to-1 relationships.

Use a junction table for many-to-many relationships.

Add a primary key or unique constraint on junction table key pairs.

Store relationship attributes in the junction table.

Index foreign key columns used in joins and filters.

Use clear table and constraint names.

Choose cascade delete only when it matches business rules.

Use `LEFT JOIN` when parent rows without children should be returned.

Understand the result grain before using `DISTINCT`.

Normalize data for correctness first.

Denormalize only when there is a clear performance, historical, or reporting reason.

Let the database enforce critical integrity rules.

Keep business rules and database constraints aligned.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q01 -->
#### Beginner Q01: What is a relationship in a relational database?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A relationship describes how rows in one table are connected to rows in another table. Relationships are usually enforced with primary keys and foreign keys.

For example, a customer can have many orders. The `Customers` table has a primary key such as `CustomerId`, and the `Orders` table has a foreign key such as `CustomerId` that references it.

Relationships help maintain data integrity and make it possible to query related data using joins.

##### Key Points to Mention

- Relationships connect rows between tables.
- Implemented with primary keys and foreign keys.
- Help enforce referential integrity.
- Used heavily in joins.
- Common types are 1-to-1, 1-to-many, and many-to-many.
- Important for normalization and query correctness.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q01 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q02 -->
#### Beginner Q02: What is a primary key?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A primary key is a column or set of columns that uniquely identifies each row in a table. It cannot contain duplicate values and cannot be `NULL`.

Example:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId)
);
```

`CustomerId` uniquely identifies each customer.

##### Key Points to Mention

- Uniquely identifies rows.
- Cannot be `NULL`.
- Cannot contain duplicates.
- Can be single-column or composite.
- Often referenced by foreign keys.
- Each table has one primary key constraint.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q02 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q03 -->
#### Beginner Q03: What is a foreign key?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A foreign key is a column or set of columns in one table that references a primary key or unique key in another table. It enforces a relationship between the tables.

Example:

```sql
CREATE TABLE Orders
(
    OrderId INT IDENTITY(1,1) NOT NULL,
    CustomerId INT NOT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),

    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId)
);
```

This prevents an order from referencing a non-existing customer.

##### Key Points to Mention

- References a primary key or unique key.
- Enforces referential integrity.
- Usually stored in the child table.
- Prevents invalid relationships.
- Can be nullable for optional relationships.
- Important for joins and data correctness.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q03 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q04 -->
#### Beginner Q04: What is a 1-to-many relationship?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A 1-to-many relationship means one row in a parent table can be related to many rows in a child table, while each child row belongs to one parent row.

Example:

```text
One customer can have many orders.
Each order belongs to one customer.
```

In SQL, the foreign key goes on the many side:

```sql
CREATE TABLE Orders
(
    OrderId INT PRIMARY KEY,
    CustomerId INT NOT NULL,

    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId)
);
```

##### Key Points to Mention

- One parent row can have many child rows.
- Each child row references one parent row.
- Foreign key is stored on the many side.
- Most common relationship type.
- Examples: customer-orders, order-order items, post-comments.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q04 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q05 -->
#### Beginner Q05: What is a 1-to-1 relationship?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A 1-to-1 relationship means one row in one table is related to at most one row in another table, and vice versa.

Example:

```text
One employee has one employee profile.
One employee profile belongs to one employee.
```

It can be implemented with a foreign key plus a unique constraint, or with a shared primary key.

The unique constraint is important because without it, the relationship becomes 1-to-many.

##### Key Points to Mention

- One row relates to at most one row.
- Often used for optional, sensitive, or rarely-used data.
- Can use unique foreign key.
- Can use shared primary key.
- Unique constraint enforces the one-to-one rule.
- Less common than 1-to-many.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q05 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q06 -->
#### Beginner Q06: What is a many-to-many relationship?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

A many-to-many relationship means many rows in one table can relate to many rows in another table.

Example:

```text
One student can enroll in many courses.
One course can have many students.
```

In a relational database, this is implemented using a junction table.

```text
Students
Courses
CourseEnrollments
```

The junction table contains foreign keys to both related tables.

##### Key Points to Mention

- Many rows on both sides can relate to many rows.
- Requires a junction table.
- Junction table has foreign keys to both tables.
- Junction table should prevent duplicate pairs.
- Examples: users-roles, students-courses, posts-tags.
- Do not store comma-separated IDs.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q06 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q07 -->
#### Beginner Q07: What is a junction table?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

A junction table is a table used to implement a many-to-many relationship. It contains foreign keys to the two related tables and usually has a composite primary key or unique constraint to prevent duplicate links.

Example:

```sql
CREATE TABLE UserRoles
(
    UserId INT NOT NULL,
    RoleId INT NOT NULL,

    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),

    CONSTRAINT FK_UserRoles_Users
        FOREIGN KEY (UserId)
        REFERENCES Users(UserId),

    CONSTRAINT FK_UserRoles_Roles
        FOREIGN KEY (RoleId)
        REFERENCES Roles(RoleId)
);
```

##### Key Points to Mention

- Also called join table, bridge table, or association table.
- Used for many-to-many relationships.
- Contains foreign keys to both tables.
- Should prevent duplicate pairs.
- Can contain relationship attributes.
- Example: `UserRoles`, `PostTags`, `CourseEnrollments`.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q07 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q08 -->
#### Beginner Q08: What is the difference between `INNER JOIN` and `LEFT JOIN` when querying relationships?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q08 -->
<!-- question-level:beginner -->

##### Expected Answer

`INNER JOIN` returns only rows where matching related rows exist. `LEFT JOIN` returns all rows from the left table, even if there is no matching row in the right table.

Example:

```sql
SELECT c.CustomerId, o.OrderId
FROM Customers c
INNER JOIN Orders o
    ON o.CustomerId = c.CustomerId;
```

This returns only customers with orders.

```sql
SELECT c.CustomerId, o.OrderId
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId;
```

This returns all customers, including customers with no orders.

##### Key Points to Mention

- `INNER JOIN` requires a match.
- `LEFT JOIN` keeps unmatched left-side rows.
- Use `LEFT JOIN` to include parents with zero children.
- Join type affects result rows.
- Important for counts and reports.
- Filtering after a `LEFT JOIN` must be done carefully.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-beginner-q08 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q01 -->
#### Intermediate Q01: How do you implement a 1-to-1 relationship in SQL?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

A 1-to-1 relationship can be implemented in two common ways.

First, use a foreign key with a unique constraint:

```sql
CREATE TABLE EmployeeProfiles
(
    EmployeeProfileId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL UNIQUE,

    CONSTRAINT FK_EmployeeProfiles_Employees
        FOREIGN KEY (EmployeeId)
        REFERENCES Employees(EmployeeId)
);
```

Second, use a shared primary key:

```sql
CREATE TABLE EmployeeProfiles
(
    EmployeeId INT NOT NULL PRIMARY KEY,

    CONSTRAINT FK_EmployeeProfiles_Employees
        FOREIGN KEY (EmployeeId)
        REFERENCES Employees(EmployeeId)
);
```

The important idea is that the child table must not allow multiple rows for the same parent row.

##### Key Points to Mention

- Use foreign key plus unique constraint.
- Or use shared primary key.
- The unique rule enforces one-to-one.
- Without uniqueness, it becomes one-to-many.
- Useful for optional, sensitive, or extension data.
- Parent usually inserted first.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q01 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q02 -->
#### Intermediate Q02: How do you implement a 1-to-many relationship in SQL?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A 1-to-many relationship is implemented by placing the foreign key on the many side.

Example:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(200) NOT NULL
);

CREATE TABLE Orders
(
    OrderId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    OrderDateUtc DATETIME2 NOT NULL,

    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId)
);
```

One customer can have many orders because many rows in `Orders` can reference the same `CustomerId`.

##### Key Points to Mention

- Foreign key goes on the many side.
- Child table references parent table.
- `NOT NULL` makes the relationship required.
- Nullable foreign key makes it optional.
- Indexing the foreign key is often useful.
- Common examples include customer-orders and order-order items.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q02 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q03 -->
#### Intermediate Q03: How do you implement a many-to-many relationship in SQL?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A many-to-many relationship is implemented using a junction table. The junction table contains foreign keys to both related tables and a primary key or unique constraint on the pair.

Example:

```sql
CREATE TABLE CourseEnrollments
(
    StudentId INT NOT NULL,
    CourseId INT NOT NULL,
    EnrolledAtUtc DATETIME2 NOT NULL,

    CONSTRAINT PK_CourseEnrollments PRIMARY KEY (StudentId, CourseId),

    CONSTRAINT FK_CourseEnrollments_Students
        FOREIGN KEY (StudentId)
        REFERENCES Students(StudentId),

    CONSTRAINT FK_CourseEnrollments_Courses
        FOREIGN KEY (CourseId)
        REFERENCES Courses(CourseId)
);
```

This allows each student to enroll in many courses and each course to have many students.

##### Key Points to Mention

- Use a junction table.
- Junction table has two foreign keys.
- Use composite primary key or unique constraint.
- Prevent duplicate links.
- Store relationship attributes in the junction table.
- Query with joins through the junction table.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q03 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q04 -->
#### Intermediate Q04: Why should many-to-many relationships not be stored as comma-separated IDs?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Comma-separated IDs violate relational design principles and make the data difficult to query, validate, and index. The database cannot enforce foreign keys for individual values inside a string. It is also hard to prevent duplicates, join efficiently, update one relationship, or count related rows accurately.

Instead, use a junction table with one row per relationship.

Bad:

```text
Student.CourseIds = '1,2,5'
```

Good:

```text
CourseEnrollments
StudentId | CourseId
```

##### Key Points to Mention

- Cannot enforce foreign keys properly.
- Hard to query and index.
- Hard to prevent duplicates.
- Hard to update individual links.
- Breaks normalization.
- Use a junction table instead.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q04 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q05 -->
#### Intermediate Q05: What is the difference between a composite key and a surrogate key in a junction table?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

A composite key uses the two foreign key columns as the primary key, such as `(StudentId, CourseId)`. This naturally prevents duplicate relationships.

A surrogate key uses a separate identity column such as `EnrollmentId`, but it should still have a unique constraint on `(StudentId, CourseId)` to prevent duplicates.

Composite keys are simple and good for pure link tables. Surrogate keys can be useful when the relationship has its own lifecycle, is referenced by other tables, or needs a single-column identifier for APIs or ORMs.

##### Key Points to Mention

- Composite key uses both foreign keys.
- Surrogate key uses separate identity column.
- Surrogate key still needs unique constraint on the pair.
- Composite key is good for pure junction tables.
- Surrogate key is useful for relationship entities.
- Choice depends on business and access needs.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q05 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q06 -->
#### Intermediate Q06: How do you count child rows in a 1-to-many relationship?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `LEFT JOIN` and `GROUP BY` if you want to include parent rows with zero children.

Example:

```sql
SELECT
    c.CustomerId,
    c.FullName,
    COUNT(o.OrderId) AS OrderCount
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId
GROUP BY
    c.CustomerId,
    c.FullName
ORDER BY OrderCount DESC;
```

Use `COUNT(o.OrderId)` instead of `COUNT(*)` because `COUNT(*)` may count the parent row even when no child row exists in a `LEFT JOIN`.

##### Key Points to Mention

- Use `LEFT JOIN` to include zero-child parents.
- Use `GROUP BY`.
- Use `COUNT(child.PrimaryKey)`.
- `COUNT(*)` can be misleading with `LEFT JOIN`.
- Result grain is one row per parent.
- Useful for reports and dashboards.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q06 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q07 -->
#### Intermediate Q07: What is a common mistake when filtering after a `LEFT JOIN`?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

A common mistake is putting a filter on the right-side table in the `WHERE` clause, which can accidentally turn the `LEFT JOIN` into an `INNER JOIN`.

Bad:

```sql
SELECT c.CustomerId, o.OrderId
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = 'Completed';
```

This removes customers with no matching completed orders.

If you want all customers and only completed matching orders, put the condition in the `ON` clause:

```sql
SELECT c.CustomerId, o.OrderId
FROM Customers c
LEFT JOIN Orders o
    ON o.CustomerId = c.CustomerId
   AND o.Status = 'Completed';
```

##### Key Points to Mention

- `WHERE` filters after the join.
- Right-table filters can remove NULL matches.
- This can make `LEFT JOIN` behave like `INNER JOIN`.
- Put right-table filter in `ON` when preserving unmatched left rows.
- Important for reports with zero counts.
- Understand desired result first.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q07 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q08 -->
#### Intermediate Q08: Why should foreign key columns often be indexed?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Foreign key columns are commonly used in joins, filters, and delete/update checks. Indexing them can improve join performance, speed up lookups of child rows, and help the database enforce referential actions more efficiently.

In SQL Server, creating a foreign key does not automatically create an index on the child column, so you often need to create one manually.

Example:

```sql
CREATE INDEX IX_Orders_CustomerId
ON Orders(CustomerId);
```

##### Key Points to Mention

- Foreign keys are used in joins.
- Indexes improve child lookup performance.
- Useful for delete/update checks.
- SQL Server does not automatically index foreign keys.
- Junction tables may need indexes in both directions.
- Indexes have write and storage costs.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q01 -->
#### Advanced Q01: How do you decide between 1-to-1 and putting columns in the same table?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A 1-to-1 split is useful when there is a clear reason to separate the data, such as optional data, sensitive data, rarely accessed large columns, different ownership, different lifecycle, security isolation, or extension-table design.

If the data is always required, always loaded together, has the same lifecycle, and has the same security requirements, keeping it in the same table may be simpler.

A 1-to-1 split should not be done only because the table has many columns. It should be justified by access pattern, security, ownership, or lifecycle.

##### Key Points to Mention

- Use 1-to-1 for optional, sensitive, or rarely accessed data.
- Use it for different lifecycle or ownership.
- Shared primary key is common for extension tables.
- Same table may be better when data is always used together.
- Avoid unnecessary table splitting.
- Design should follow business and access requirements.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q01 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q02 -->
#### Advanced Q02: How would you model users and roles?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Users and roles are usually many-to-many because one user can have many roles and one role can be assigned to many users. This should be modeled with a junction table such as `UserRoles`.

Example:

```sql
CREATE TABLE UserRoles
(
    UserId INT NOT NULL,
    RoleId INT NOT NULL,
    AssignedAtUtc DATETIME2 NOT NULL,

    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),

    CONSTRAINT FK_UserRoles_Users
        FOREIGN KEY (UserId)
        REFERENCES Users(UserId),

    CONSTRAINT FK_UserRoles_Roles
        FOREIGN KEY (RoleId)
        REFERENCES Roles(RoleId)
);
```

If role assignment has extra data such as who assigned it, when it expires, or tenant scope, store that data in the junction table.

##### Key Points to Mention

- Users and roles are many-to-many.
- Use `UserRoles` junction table.
- Add foreign keys to `Users` and `Roles`.
- Prevent duplicate role assignments.
- Store relationship attributes in the junction table.
- Consider tenant scope and role expiration if required.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q02 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q03 -->
#### Advanced Q03: How do delete behaviors affect relationship design?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Delete behavior defines what happens to child rows when a parent row is deleted. Common options include preventing the delete, cascading deletes to children, setting the foreign key to `NULL`, or setting it to a default value.

The correct choice depends on business rules and retention requirements. For example, cascading from `Orders` to `OrderItems` may be acceptable because order items do not exist without the order. But cascading from `Customers` to `Orders` may be dangerous if order history must be retained.

Delete behavior must be chosen carefully because it can cause data loss or orphaned data if incorrect.

##### Key Points to Mention

- Foreign keys can define delete actions.
- `CASCADE` deletes child rows automatically.
- `NO ACTION` or `RESTRICT` prevents invalid deletes.
- `SET NULL` keeps child row but removes parent link.
- Choose based on business rules.
- Be careful with audit/history data.
- Cascade can be dangerous if too broad.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q03 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q04 -->
#### Advanced Q04: How do you avoid duplicate rows in many-to-many relationships?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a composite primary key or a unique constraint on the pair of foreign keys in the junction table.

Example:

```sql
CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId)
```

or:

```sql
CONSTRAINT UQ_UserRoles_UserId_RoleId UNIQUE (UserId, RoleId)
```

If the junction table has a surrogate key such as `UserRoleId`, the unique constraint on `(UserId, RoleId)` is still needed.

Application checks are not enough because concurrent requests, scripts, imports, or other applications can still create duplicates.

##### Key Points to Mention

- Add composite primary key or unique constraint.
- Enforce uniqueness at database level.
- Surrogate key alone does not prevent duplicates.
- Application checks are not enough.
- Prevents duplicate role assignments, enrollments, tags, etc.
- Improves data integrity and query correctness.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q04 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q05 -->
#### Advanced Q05: How do relationship attributes affect many-to-many design?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

If the relationship itself has attributes, those attributes belong in the junction table. This often turns the junction table into an associative entity.

Example: a student-course relationship may have `EnrolledAtUtc`, `Grade`, `Status`, and `CompletedAtUtc`. These fields do not belong only to the student or only to the course; they describe the enrollment.

In this case, the table should be named according to the domain concept, such as `CourseEnrollments`, rather than a generic name like `StudentCourses`.

##### Key Points to Mention

- Relationship data belongs in the junction table.
- Junction table may become an associative entity.
- Use domain names like `Enrollments` or `Assignments`.
- Attributes can include dates, status, grade, role, quantity, etc.
- Still enforce foreign keys and uniqueness.
- May justify surrogate key if the relationship has its own lifecycle.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q05 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q06 -->
#### Advanced Q06: How do you model a self-referencing relationship?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A self-referencing relationship is modeled by a foreign key that references the same table.

Example: employees and managers.

```sql
CREATE TABLE Employees
(
    EmployeeId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(200) NOT NULL,
    ManagerId INT NULL,

    CONSTRAINT FK_Employees_Manager
        FOREIGN KEY (ManagerId)
        REFERENCES Employees(EmployeeId)
);
```

This models a 1-to-many relationship where one manager can have many employees, and an employee may have one manager.

For self-referencing many-to-many, such as users following users, use a junction table with two foreign keys to the same table.

##### Key Points to Mention

- Foreign key references the same table.
- Useful for hierarchies.
- Nullable FK supports root rows.
- Use aliases when joining the table to itself.
- Many-to-many self-reference needs a junction table.
- Add checks to prevent invalid relationships when needed.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q06 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q07 -->
#### Advanced Q07: Why can joins create duplicate-looking rows?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Joins create one result row for each matching combination. In a 1-to-many relationship, a parent row appears once for every matching child row. In a many-to-many relationship, rows can multiply even more because the result includes combinations through a junction table.

These are not always duplicates; they reflect the result grain.

For example, joining customers to orders creates one row per customer-order pair. If you want one row per customer, use aggregation such as `COUNT`, `SUM`, or a subquery.

Using `DISTINCT` without understanding the relationship can hide query mistakes and hurt performance.

##### Key Points to Mention

- Joins return matching combinations.
- Parent rows repeat for each child row.
- Understand the result grain.
- Use aggregation for one row per parent.
- Many-to-many joins can multiply rows.
- Avoid using `DISTINCT` blindly.
- Re-check join conditions if row counts are unexpected.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q07 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q08 -->
#### Advanced Q08: How do you choose between normalization and denormalization for relationships?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Start with normalized relationships for correctness and integrity. Use separate tables, primary keys, foreign keys, and junction tables to avoid duplication and enforce rules.

Denormalization can be added intentionally for performance, reporting, search, read models, or historical snapshots. For example, storing `CustomerNameSnapshot` on an order can be valid because the order should preserve the name at the time of purchase.

Denormalization should have a clear reason and a synchronization strategy. It should not be used just to avoid learning joins.

##### Key Points to Mention

- Normalize first for correctness.
- Use relationships to avoid duplicated data.
- Denormalize for specific performance or historical reasons.
- Denormalization requires sync strategy.
- Snapshots are valid in some domains.
- Avoid comma-separated IDs.
- Do not denormalize prematurely.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q08 -->

<!-- question:start:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q09 -->
#### Advanced Q09: How do ORM relationships differ from database relationships?

<!-- question-id:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

ORM relationships are object-level navigation properties and mappings. Database relationships are enforced by keys, foreign keys, unique constraints, and indexes. An ORM like EF Core can make relationships easier to work with in code, but it does not replace proper database constraints.

For example, EF Core may let you navigate from `Customer` to `Orders`, but the database should still have a foreign key from `Orders.CustomerId` to `Customers.CustomerId`.

The database is the final authority for data integrity, especially when multiple applications, scripts, background jobs, or imports can write data.

##### Key Points to Mention

- ORM relationships are code mappings.
- Database relationships are constraints.
- Navigation properties do not replace foreign keys.
- Database should enforce critical integrity.
- ORMs still use junction tables for many-to-many.
- Keep object model and relational model aligned.
- Be careful with cascade delete behavior in both ORM and database.

<!-- question:end:one-to-one-one-to-many-and-many-to-many-relationships-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
