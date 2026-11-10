## Queries inside queries

A **subquery** is a `SELECT` wrapped in parentheses, used where a value, a list, or a table is expected.

### Scalar subquery — returns one value

```sql
SELECT title, length
FROM film
WHERE length > (SELECT AVG(length) FROM film);
```

### IN (subquery) — returns a list

```sql
-- customers who live in Canada
SELECT first_name, last_name
FROM customer
WHERE address_id IN (
  SELECT a.address_id
  FROM address a
  JOIN city ci USING (city_id)
  JOIN country co USING (country_id)
  WHERE co.country = 'Canada'
);
```

### EXISTS / NOT EXISTS — "is there at least one…?"

A **correlated** subquery refers to the outer row (`f.film_id` below) and runs per row conceptually:

```sql
-- films that have at least one copy in store 2
SELECT f.title
FROM film f
WHERE EXISTS (
  SELECT 1 FROM inventory i
  WHERE i.film_id = f.film_id AND i.store_id = 2
);
```

`NOT EXISTS` is the cleanest anti‑join. ⚠️ Avoid `NOT IN (subquery)` when the subquery can return NULL — one NULL makes the whole thing return nothing.

### Subquery in FROM (derived table)

```sql
SELECT ROUND(AVG(total), 2) AS avg_customer_spend
FROM (
  SELECT customer_id, SUM(amount) AS total
  FROM payment
  GROUP BY customer_id
) AS per_customer;          -- derived tables need an alias
```

### CTEs — `WITH` makes it readable

A **Common Table Expression** names a subquery up front, so you read top‑to‑bottom like steps:

```sql
WITH per_customer AS (
  SELECT customer_id, SUM(amount) AS total
  FROM payment
  GROUP BY customer_id
),
big_spenders AS (
  SELECT * FROM per_customer WHERE total > 300
)
SELECT c.first_name, c.last_name, b.total
FROM big_spenders b
JOIN customer c USING (customer_id)
ORDER BY b.total DESC;
```

### Recursive CTEs

`WITH RECURSIVE` lets a CTE refer to itself — used for hierarchies (org charts, categories trees) or generating sequences:

```sql
WITH RECURSIVE countdown(n) AS (
  SELECT 5                 -- anchor: starting row
  UNION ALL
  SELECT n - 1 FROM countdown WHERE n > 1   -- step: repeat until no rows
)
SELECT n FROM countdown;
```

### Set operations: UNION, INTERSECT, EXCEPT

Stack the results of two queries (same number of columns, compatible types):

| operator | result |
|---|---|
| `UNION` | rows in either (duplicates removed) |
| `UNION ALL` | rows in either (duplicates kept — faster) |
| `INTERSECT` | rows in both |
| `EXCEPT` | rows in the first but not the second |

```sql
SELECT first_name FROM actor
UNION
SELECT first_name FROM staff
ORDER BY first_name;     -- ORDER BY applies to the combined result
```
