---
id: sql-practice-sol
topic: SQL Server Practice - Solutions
category: SQL
---
```sql
SELECT * FROM Departments;
SELECT * FROM Employees;
SELECT * FROM Customers;
SELECT * FROM Products;
SELECT * FROM Orders;
SELECT * FROM OrderItems;


-- Return all employees ordered by salary descending.

select * from Employees e
order by e.Salary desc

-- Find all customers from Vietnam.

select * from Customers c
where c.Country = 'Vietnam'

-- Return all completed orders.

select * from Orders o
where o.Status = 'Completed'

-- Show employee name with department name.

select e.FullName, d.DepartmentName
from Employees e
join Departments d on e.DepartmentId = d.DepartmentId

-- Show order id, customer name, and order date.

Select o.OrderId, c.CustomerName, o.OrderDate
from Orders o
join Customers c on o.CustomerId = c.CustomerId

-- Show order item details with product name.

select i.OrderId, p.ProductName, i.Quantity, i.UnitPrice
from Products p
join OrderItems i on p.ProductId = i.ProductId

-- Count employees in each department.

select d.DepartmentId, d.DepartmentName, Count(e.EmployeeId) as Count
from Departments d
left join Employees e on e.DepartmentId = d.DepartmentId
group by d.DepartmentId,  d.DepartmentName


-- Find average salary by department.

select d.DepartmentId, d.DepartmentName, ISNULL(AVG(e.Salary),0) as AVGSalary
from Departments d
left join Employees e on e.DepartmentId = d.DepartmentId
group by d.DepartmentId,  d.DepartmentName

-- Find total number of orders per customer.

select c.CustomerId, c.CustomerName, COUNT(o.OrderId) as NumOfOrders
from Customers c
left join Orders o on c.CustomerId = o.CustomerId
group by c.CustomerId, c.CustomerName

-- Find customers with at least 2 orders.

select c.CustomerId, c.CustomerName, Count(o.OrderId) as NumOfOrders
from Customers c
join Orders o on o.CustomerId = c.CustomerId
group by c.CustomerId, c.CustomerName
having Count(o.OrderId) > 1

-- Find departments with more than 2 employees.

select d.DepartmentId,d.DepartmentName, Count(e.EmployeeId) as NumOfEmps
from Departments d
join Employees e on d.DepartmentId = e.DepartmentId
group by d.DepartmentId, d.DepartmentName
having Count(e.EmployeeId) > 2

-- Find employees earning above average salary.

Select * from Employees e
where e.Salary > 
(
	Select AVG(Salary)
	from Employees 
)


-- Find products more expensive than the average product price.

Select * from Products p
where p.Price > 
(
	Select AVG(Price)
	from Products 
)

-- Find customers who have placed at least one order.

Select * from Customers c
where Exists (select 1 from Orders o where o.CustomerId = c.CustomerId)

-- Find customers who never placed an order.

Select * from Customers c
where not Exists (select 1 from Orders o where o.CustomerId = c.CustomerId)

-- Rank employees by salary within each department.

-- If you want no gaps, use DENSE_RANK().
-- If you want every row to have a unique sequence, use ROW_NUMBER().

select e.EmployeeId, e.FullName, e.DepartmentId, e.Salary,
	   rank() over (partition by e.DepartmentId order by e.Salary desc) as Rank
from Employees e

-- Find the highest-paid employee in each department.

select * from (
select e.EmployeeId, e.FullName, d.DepartmentName, e.Salary , rank() over (partition by e.DepartmentId order by e.Salary desc) as RankInDep
from Employees e
join Departments d on d.DepartmentId = e.DepartmentId

) as t
where t.RankInDep = 1

-- Find the second highest salary in the company.

select * from (
select  e.EmployeeId, e.FullName, e.DepartmentId, e.Salary,
	   dense_rank() over ( order by e.Salary desc) as RankInCom
from Employees e
) as t
where t.RankInCom = 2


-- Find the first order date for each customer.

select c.CustomerId, c.CustomerName, Min(o.OrderDate) as FirstOrderDate
from Customers c
join Orders o on o.CustomerId = c.CustomerId
group by c.CustomerId, c.CustomerName


-- Find the latest order for each customer.

with CustomerLatestOrder as 
(

	select c.CustomerId, c.CustomerName, o.OrderId, o.OrderDate, o.Status
	, ROW_NUMBER() over(partition by o.CustomerId order by o.OrderDate desc, o.OrderId desc ) as ThOrder
	from Customers c
	join Orders o on o.CustomerId = c.CustomerId

)

select c.*
from CustomerLatestOrder c
where c.ThOrder = 1


-- Find monthly revenue.


with ProfitPerOrder as (
select o.OrderId, o.OrderDate, Sum(oi.Quantity * oi.UnitPrice) as Profit
from Orders o 
join OrderItems oi on o.OrderId = oi.OrderId
WHERE o.Status = 'Completed'
group by o.OrderId, o.OrderDate
)

select MONTH(p.OrderDate) as Month, YEAR(p.OrderDate) as Year, Sum(p.Profit) ProfitOfMonth
from ProfitPerOrder p
group by MONTH(p.OrderDate), YEAR(p.OrderDate)

select MONTH(o.OrderDate) as Month, Year(o.OrderDate) as Year, Sum(oi.Quantity * oi.UnitPrice) ProfitOfMonth
from Orders o
join OrderItems oi on oi.OrderId = o.OrderId
WHERE o.Status = 'Completed'
group by MONTH(o.OrderDate), Year(o.OrderDate)

-- Find top 3 selling products by total quantity sold.

select y.*
from 
(
	select t.*, DENSE_RANK() over(order by Quantity desc) as RankOfT
	from
	(
		select p.ProductId,p.ProductName, sum(oi.Quantity) as Quantity
		from Orders o
		join OrderItems oi on oi.OrderId = o.OrderId
		join Products p on p.ProductId = oi.ProductId
		WHERE o.Status = 'Completed'
		group by p.ProductId,p.ProductName

	) t
) y
where y.RankOfT <= 3


-- Find customers who bought Laptop Pro.

select distinct c.CustomerId, c.CustomerName
from Orders o
join OrderItems oi on oi.OrderId = o.OrderId
join Products p on p.ProductId = oi.ProductId
join Customers c on o.CustomerId = c.CustomerId
WHERE o.Status = 'Completed' and p.ProductName = 'Laptop Pro'

-- Find customers who bought Laptop Pro but never bought Standing Desk.

select c.CustomerId, c.CustomerName
from Customers c
WHERE 
Not Exists (
select * from  Orders o
join OrderItems oi on oi.OrderId = o.OrderId
join Products p on p.ProductId = oi.ProductId
where o.CustomerId = c.CustomerId
and o.Status = 'Completed'
and p.ProductName = 'Standing Desk'
)
and 
Exists (
select * from  Orders o
join OrderItems oi on oi.OrderId = o.OrderId
join Products p on p.ProductId = oi.ProductId
where o.CustomerId = c.CustomerId
and p.ProductName = 'Laptop Pro'
and o.Status = 'Completed'
)
```