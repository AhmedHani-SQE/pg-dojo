## Window functions — aggregates that don't squash

`GROUP BY` collapses rows. A **window function** computes across a set of related rows but **keeps every row**. That's what makes rankings, running totals and "compare to previous row" possible.

```sql
SELECT title, rating, length,
       AVG(length) OVER (PARTITION BY rating) AS avg_for_rating
FROM film;
```

Every film stays, and each gets the average length of *its* rating group next to it.

### Anatomy of OVER( )

```
function(...) OVER (
  PARTITION BY ...   -- split rows into groups (optional; default = all rows)
  ORDER BY ...       -- order inside each group (needed for ranks, running totals, LAG)
  ROWS BETWEEN ...   -- the frame (optional, advanced)
)
```

### Ranking

```sql
SELECT title, length,
       ROW_NUMBER() OVER (ORDER BY length DESC) AS row_num,   -- 1,2,3,4 (always unique)
       RANK()       OVER (ORDER BY length DESC) AS rnk,       -- 1,1,3,4 (gaps after ties)
       DENSE_RANK() OVER (ORDER BY length DESC) AS dense      -- 1,1,2,3 (no gaps)
FROM film
LIMIT 10;
```

### Top‑N per group — the famous pattern

You can't use a window function in `WHERE` (it's computed later), so wrap it:

```sql
WITH ranked AS (
  SELECT rating, title, rental_rate,
         ROW_NUMBER() OVER (PARTITION BY rating ORDER BY rental_rate DESC, title) AS rn
  FROM film
)
SELECT rating, title, rental_rate
FROM ranked
WHERE rn <= 2;
```

### Running totals

With `ORDER BY` inside `OVER`, `SUM` becomes cumulative:

```sql
WITH monthly AS (
  SELECT DATE_TRUNC('month', payment_date)::date AS month, SUM(amount) AS revenue
  FROM payment
  WHERE payment_date >= '2024-01-01' AND payment_date < '2025-01-01'
  GROUP BY 1
)
SELECT month, revenue,
       SUM(revenue) OVER (ORDER BY month) AS running_total
FROM monthly
ORDER BY month;
```

### Looking at neighbours: LAG and LEAD

```sql
SELECT payment_date, amount,
       LAG(amount)  OVER (ORDER BY payment_date) AS previous_amount,
       LEAD(amount) OVER (ORDER BY payment_date) AS next_amount
FROM payment
WHERE customer_id = 5
ORDER BY payment_date;
```

`LAG(col, 2)` looks two rows back; `LAG(col, 1, 0)` uses 0 instead of NULL when there's no previous row.

### Share of total

An empty `OVER ()` means "the whole result":

```sql
SELECT rating, COUNT(*) AS films,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM film
GROUP BY rating;
```

Yes — `SUM(COUNT(*)) OVER ()` is a window over an aggregate. Windows run **after** GROUP BY.

**Logical order:** `FROM` → `WHERE` → `GROUP BY` → `HAVING` → **window functions** → `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT`
