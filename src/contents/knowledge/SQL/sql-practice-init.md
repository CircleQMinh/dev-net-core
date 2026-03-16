---
id: sql-practice-init
topic: SQL Server Practice - Init SQL
category: SQL
---

```sql

IF DB_ID('SqlPracticeDb') IS NOT NULL
BEGIN
    ALTER DATABASE SqlPracticeDb SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE SqlPracticeDb;
END;
GO

CREATE DATABASE SqlPracticeDb;
GO

USE SqlPracticeDb;
GO

-- =========================
-- 1. Departments
-- =========================
CREATE TABLE Departments
(
    DepartmentId INT PRIMARY KEY,
    DepartmentName NVARCHAR(100) NOT NULL
);
GO

-- =========================
-- 2. Employees
-- =========================
CREATE TABLE Employees
(
    EmployeeId INT PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150) NOT NULL,
    Salary DECIMAL(10,2) NOT NULL,
    DepartmentId INT NOT NULL,
    ManagerId INT NULL,
    HireDate DATE NOT NULL,
    CONSTRAINT FK_Employees_Departments
        FOREIGN KEY (DepartmentId) REFERENCES Departments(DepartmentId),
    CONSTRAINT FK_Employees_Manager
        FOREIGN KEY (ManagerId) REFERENCES Employees(EmployeeId)
);
GO

-- =========================
-- 3. Customers
-- =========================
CREATE TABLE Customers
(
    CustomerId INT PRIMARY KEY,
    CustomerName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150) NOT NULL,
    Country NVARCHAR(50) NOT NULL,
    CreatedDate DATE NOT NULL
);
GO

-- =========================
-- 4. Products
-- =========================
CREATE TABLE Products
(
    ProductId INT PRIMARY KEY,
    ProductName NVARCHAR(100) NOT NULL,
    Category NVARCHAR(50) NOT NULL,
    Price DECIMAL(10,2) NOT NULL
);
GO

-- =========================
-- 5. Orders
-- =========================
CREATE TABLE Orders
(
    OrderId INT PRIMARY KEY,
    CustomerId INT NOT NULL,
    OrderDate DATE NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId)
);
GO

-- =========================
-- 6. OrderItems
-- =========================
CREATE TABLE OrderItems
(
    OrderItemId INT PRIMARY KEY,
    OrderId INT NOT NULL,
    ProductId INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(10,2) NOT NULL,
    CONSTRAINT FK_OrderItems_Orders
        FOREIGN KEY (OrderId) REFERENCES Orders(OrderId),
    CONSTRAINT FK_OrderItems_Products
        FOREIGN KEY (ProductId) REFERENCES Products(ProductId)
);
GO

-- =========================
-- Seed: Departments
-- =========================
INSERT INTO Departments (DepartmentId, DepartmentName)
VALUES
(1, 'Engineering'),
(2, 'HR'),
(3, 'Sales'),
(4, 'Finance');
(5, 'Empty');
GO

-- =========================
-- Seed: Employees
-- =========================
INSERT INTO Employees (EmployeeId, FullName, Email, Salary, DepartmentId, ManagerId, HireDate)
VALUES
(1, 'Alice Johnson',   'alice@company.com',   120000, 1, NULL, '2020-01-15'),
(2, 'Bob Smith',       'bob@company.com',      90000, 1, 1,    '2021-03-10'),
(3, 'Carol Lee',       'carol@company.com',    95000, 1, 1,    '2022-07-01'),
(4, 'David Brown',     'david@company.com',    70000, 2, NULL, '2021-05-20'),
(5, 'Emma Wilson',     'emma@company.com',     72000, 2, 4,    '2023-01-11'),
(6, 'Frank Miller',    'frank@company.com',   110000, 3, NULL, '2019-11-25'),
(7, 'Grace Taylor',    'grace@company.com',    80000, 3, 6,    '2022-02-14'),
(8, 'Henry Davis',     'henry@company.com',    78000, 3, 6,    '2023-09-01'),
(9, 'Ivy Moore',       'ivy@company.com',      98000, 4, NULL, '2020-08-05'),
(10,'Jack White',      'jack@company.com',     60000, 4, 9,    '2024-01-08');
GO

-- =========================
-- Seed: Customers
-- =========================
INSERT INTO Customers (CustomerId, CustomerName, Email, Country, CreatedDate)
VALUES
(1, 'Nguyen Van A',   'a@gmail.com',          'Vietnam', '2024-01-10'),
(2, 'Tran Thi B',     'b@gmail.com',          'Vietnam', '2024-02-05'),
(3, 'John Carter',    'john@gmail.com',       'USA',     '2024-02-20'),
(4, 'Maria Lopez',    'maria@gmail.com',      'Spain',   '2024-03-12'),
(5, 'David Kim',      'david@gmail.com',      'Korea',   '2024-04-01'),
(6, 'Sophia Chen',    'sophia@gmail.com',     'Singapore','2024-04-15'),
(7, 'Liam Brown',     'liam@gmail.com',       'UK',      '2024-05-10'),
(8, 'No Order User',  'noorder@gmail.com',    'Vietnam', '2024-06-01');
GO

-- =========================
-- Seed: Products
-- =========================
INSERT INTO Products (ProductId, ProductName, Category, Price)
VALUES
(1, 'Laptop Pro',      'Electronics', 1500),
(2, 'Wireless Mouse',  'Electronics',   25),
(3, 'Mechanical KB',   'Electronics',   80),
(4, 'Office Chair',    'Furniture',    200),
(5, 'Standing Desk',   'Furniture',    450),
(6, 'Notebook Pack',   'Stationery',    15),
(7, 'Pen Set',         'Stationery',     8),
(8, 'Monitor 27',      'Electronics',  300);
GO

-- =========================
-- Seed: Orders
-- =========================
INSERT INTO Orders (OrderId, CustomerId, OrderDate, Status)
VALUES
(1,  1, '2024-06-01', 'Completed'),
(2,  1, '2024-06-15', 'Completed'),
(3,  2, '2024-06-20', 'Completed'),
(4,  3, '2024-07-01', 'Pending'),
(5,  3, '2024-07-10', 'Completed'),
(6,  4, '2024-07-12', 'Cancelled'),
(7,  5, '2024-08-01', 'Completed'),
(8,  5, '2024-08-03', 'Completed'),
(9,  6, '2024-08-15', 'Pending'),
(10, 7, '2024-09-01', 'Completed'),
(11, 1, '2024-09-03', 'Completed'),
(12, 2, '2024-09-10', 'Completed');
GO

-- =========================
-- Seed: OrderItems
-- =========================
INSERT INTO OrderItems (OrderItemId, OrderId, ProductId, Quantity, UnitPrice)
VALUES
(1,  1, 1, 1, 1500),
(2,  1, 2, 2,   25),

(3,  2, 3, 1,   80),
(4,  2, 6, 3,   15),

(5,  3, 4, 1,  200),
(6,  3, 7, 2,    8),

(7,  4, 8, 1,  300),

(8,  5, 1, 1, 1500),
(9,  5, 2, 1,   25),
(10, 5, 3, 1,   80),

(11, 6, 5, 1,  450),

(12, 7, 4, 2,  200),
(13, 7, 7, 5,    8),

(14, 8, 2, 4,   25),
(15, 8, 6, 10,  15),

(16, 9, 8, 2,  300),

(17,10, 5, 1,  450),
(18,10, 2, 2,   25),

(19,11, 1, 1, 1500),
(20,11, 8, 2,  300),

(21,12, 3, 2,   80),
(22,12, 7, 3,    8);
GO

-- =========================
-- Helpful indexes
-- =========================
CREATE INDEX IX_Employees_DepartmentId ON Employees(DepartmentId);
CREATE INDEX IX_Employees_ManagerId ON Employees(ManagerId);
CREATE INDEX IX_Orders_CustomerId ON Orders(CustomerId);
CREATE INDEX IX_Orders_OrderDate ON Orders(OrderDate);
CREATE INDEX IX_OrderItems_OrderId ON OrderItems(OrderId);
CREATE INDEX IX_OrderItems_ProductId ON OrderItems(ProductId);
GO

```