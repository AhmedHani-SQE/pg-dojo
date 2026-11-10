## Squashing rows into answers

Aggregate functions turn many rows into one value:

```sql
SELECT COUNT(*)          AS films,
       AVG(length)       AS avg_length,
       MIN(rental_rate),
       MAX(rental_rate),
       SUM(replacement_cost)
FROM film;
```

### COUNT flavors

* `COUNT(*)` – counts rows
* `COUNT(column)` – counts rows where that column is **not NULL**
* `COUNT(DISTINCT column)` – counts unique non‑NULL values

```sql
SELECT COUNT(*) AS rentals,
       COUNT(return_date) AS returned,
       COUNT(DISTINCT customer_id) AS unique_customers
FROM rental;
```

### GROUP BY — one result per group

```sql
SELECT rating, COUNT(*) AS films, ROUND(AVG(length), 1) AS avg_len
FROM film
GROUP BY rating
ORDER BY films DESC;
```

**The golden rule:** every column in SELECT must either be in the `GROUP BY` or be inside an aggregate. Otherwise Postgres complains *"must appear in the GROUP BY clause or be used in an aggregate function"* — because which `title` should it show for a whole group?

### HAVING — filter the groups

`WHERE` filters **rows before** grouping. `HAVING` filters **groups after** aggregation.

```sql
SELECT customer_id, SUM(amount) AS total
FROM payment
WHERE amount > 0            -- row filter
GROUP BY customer_id
HAVING SUM(amount) > 320    -- group filter
ORDER BY total DESC;
```

### FILTER — a Postgres gem

Count/sum only some rows *inside* an aggregate, so you get several breakdowns in one pass:

```sql
SELECT rating,
       COUNT(*)                                    AS all_films,
       COUNT(*) FILTER (WHERE length > 150)        AS long_films,
       ROUND(AVG(rental_rate) FILTER (WHERE length < 60), 2) AS short_avg_rate
FROM film
GROUP BY rating;
```

(The standard‑SQL way is `SUM(CASE WHEN length > 150 THEN 1 ELSE 0 END)` — FILTER is cleaner.)

### The full logical order

`FROM` → `WHERE` → **`GROUP BY`** → **aggregates** → **`HAVING`** → `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT`

> 💡 Aggregates ignore NULLs (except `COUNT(*)`). `AVG` of 10, NULL, 20 is 15, not 10.
