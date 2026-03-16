---
id: sql-server-templates
topic: SQL Server Templates & Patterns
category: SQL
---

## Common SELECT Boilerplate (SQL Server)

```sql
SELECT [DISTINCT] column1, column2, aggregate_function(...)
FROM table_name
[JOIN another_table ON join_condition]
[WHERE condition]
[GROUP BY column1, column2, ...]
[HAVING condition]
[ORDER BY column1 ASC|DESC, column2 ASC|DESC]
[OFFSET number ROWS FETCH NEXT number ROWS ONLY];
````

---

## Views

### Create View (Simple View)

```sql
CREATE VIEW dbo.vw_ActiveEmployees
AS
SELECT
    Id,
    EmployeeCode,
    FirstName,
    LastName
FROM dbo.Employees
WHERE Status = 'Active';
```

### Query View

```sql
SELECT * FROM dbo.vw_ActiveEmployees;
```

### Notes

* Views do not store data (unless using an indexed view)
* Useful for reads, reporting, and security abstraction
* Centralizes reusable query logic

---

## Create Table (Basic Template)

```sql
CREATE TABLE dbo.Employees
(
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeCode NVARCHAR(20) NOT NULL,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    Status NVARCHAR(20) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT UQ_Employees_EmployeeCode UNIQUE (EmployeeCode),
    CONSTRAINT CK_Employees_Status CHECK (Status IN ('Active','Inactive'))
);
```

### Notes

* `PRIMARY KEY` → identity column + clustered index by default
* `UNIQUE` → enforces business rules
* `CHECK` → domain validation
* `DEFAULT` → system-generated values

---

## ALTER TABLE

```sql
-- Add column
ALTER TABLE dbo.TableName
ADD NewColumn INT NOT NULL;

-- Add column with default for existing rows
ALTER TABLE dbo.TableName
ADD CreatedAt DATETIME2 NOT NULL
CONSTRAINT DF_TableName_CreatedAt DEFAULT (SYSDATETIME());

-- Drop column
ALTER TABLE dbo.TableName
DROP COLUMN OldColumn;
```

---

## Index Creation

```sql
-- Nonclustered index
CREATE NONCLUSTERED INDEX IX_Table_Column
ON dbo.TableName (ColumnName);

-- Composite index
CREATE NONCLUSTERED INDEX IX_Table_Col1_Col2
ON dbo.TableName (Column1, Column2);
```

**Rule**

* Place the most selective column first in composite indexes.

---

## Functions

### Scalar Function (Single Value)

```sql
CREATE FUNCTION dbo.GetFullName
(
    @FirstName NVARCHAR(50),
    @LastName NVARCHAR(50)
)
RETURNS NVARCHAR(101)
AS
BEGIN
    RETURN CONCAT(@FirstName, ' ', @LastName);
END;
```

⚠ Scalar functions may negatively impact performance in large queries.

---

### Inline Table-Valued Function (Best Practice)

```sql
CREATE FUNCTION dbo.GetActiveUsers()
RETURNS TABLE
AS
RETURN
(
    SELECT Id, Name, Email
    FROM Users
    WHERE IsActive = 1
);
```

---

### Multi-Statement Table-Valued Function

```sql
CREATE FUNCTION dbo.GetUserStats()
RETURNS @Result TABLE
(
    UserId INT,
    OrderCount INT
)
AS
BEGIN
    INSERT INTO @Result
    SELECT UserId, COUNT(*)
    FROM Orders
    GROUP BY UserId;

    RETURN;
END;
```

---

## Stored Procedures

### Simple Stored Procedure

```sql
CREATE PROCEDURE dbo.GetUserById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Users
    WHERE Id = @UserId;
END;
```

---

### Stored Procedure with INSERT

```sql
CREATE PROCEDURE dbo.CreateUser
    @Name NVARCHAR(100),
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Users (Name, Email)
    VALUES (@Name, @Email);
END;
```

---

### Stored Procedure with Transaction & Error Handling (Enterprise Pattern)

```sql
CREATE PROCEDURE dbo.AssignUserRole
    @UserId INT,
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO UserRoles (UserId, RoleId)
        VALUES (@UserId, @RoleId);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
```

---

### Stored Procedure with OUTPUT Parameter

```sql
CREATE PROCEDURE dbo.CreateEmployee
    @Name NVARCHAR(100),
    @EmployeeId INT OUTPUT
AS
BEGIN
    INSERT INTO Employees (Name)
    VALUES (@Name);

    SET @EmployeeId = SCOPE_IDENTITY();
END;
```

---

## Computed Columns

### Basic Computed Column

```sql
ALTER TABLE dbo.Employees
ADD FullName AS (FirstName + ' ' + LastName);
```

### Persisted Computed Column (Indexable)

```sql
ALTER TABLE dbo.Employees
ADD FullName AS (FirstName + ' ' + LastName) PERSISTED;
```

### Computed Column with Logic

```sql
ALTER TABLE dbo.Employees
ADD IsActive AS (
    CASE
        WHEN Status = 'Active' THEN 1
        ELSE 0
    END
) PERSISTED;
```

---

## SELECT with JOIN

```sql
SELECT
    e.Id,
    e.EmployeeCode,
    e.FirstName,
    e.LastName,
    d.Name AS DepartmentName
FROM dbo.Employees AS e
INNER JOIN dbo.Departments AS d
    ON e.DepartmentId = d.Id;
```

---

## MERGE (Upsert Pattern)

```sql
MERGE dbo.TargetB AS target
USING dbo.SourceA AS source
ON target.Id = source.Id

WHEN MATCHED THEN
    UPDATE SET
        target.Name = source.Name,
        target.Status = source.Status,
        target.UpdatedAt = SYSDATETIME()

WHEN NOT MATCHED BY TARGET THEN
    INSERT (Id, Name, Status, CreatedAt)
    VALUES (source.Id, source.Name, source.Status, SYSDATETIME())

WHEN NOT MATCHED BY SOURCE THEN
    DELETE;
```

### Optional Conditional Delete

```sql
WHEN NOT MATCHED BY SOURCE
AND target.IsSystemRecord = 0
THEN DELETE;
```

---

## Foreign Keys

### Create Foreign Key During Table Creation

```sql
CREATE TABLE Employees (
    EmployeeId INT PRIMARY KEY,
    FullName NVARCHAR(200) NOT NULL,
    DepartmentId INT NOT NULL,

    CONSTRAINT FK_Employees_Departments
    FOREIGN KEY (DepartmentId)
    REFERENCES Departments(DepartmentId)
);
```

### Add Foreign Key Later

```sql
ALTER TABLE Employees
ADD CONSTRAINT FK_Employees_Departments
FOREIGN KEY (DepartmentId)
REFERENCES Departments(DepartmentId);
```

---

## Notes

* SQL Server uses `OFFSET ... FETCH` for pagination instead of `LIMIT`.
* Scalar UDFs may degrade performance (especially before SQL Server 2019).
* `MERGE` should be used carefully in high-concurrency systems; explicit UPSERT logic is often safer in production.
* Only **PERSISTED** computed columns can be indexed.
* Views do not store data unless implemented as indexed views.