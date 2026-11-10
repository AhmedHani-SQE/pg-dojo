## Doing things with values

### Text functions

```sql
SELECT first_name || ' ' || last_name AS full_name,   -- || glues strings
       LOWER(first_name),
       INITCAP(last_name),                             -- 'GUINESS' -> 'Guiness'
       LENGTH(last_name),
       LEFT(last_name, 3),
       REPLACE(last_name, 'A', '4')
FROM actor
LIMIT 5;
```

More handy ones: `UPPER`, `TRIM`, `SUBSTRING(s FROM 2 FOR 3)`, `POSITION('x' IN s)`, `SPLIT_PART(s, '@', 1)`, `CONCAT(a, b, c)` (like `||` but treats NULL as empty).

### Numbers and math

```sql
SELECT title,
       rental_rate / rental_duration           AS per_day,
       ROUND(rental_rate / rental_duration, 2) AS per_day_rounded,
       CEIL(length / 60.0)                     AS hours_rounded_up
FROM film LIMIT 5;
```

> ⚠️ **Integer division:** `7 / 2` = `3` in Postgres (both are integers). Use `7 / 2.0` or `7::numeric / 2` to get `3.5`.

```sql
SELECT 7 / 2 AS int_div, 7 / 2.0 AS real_div, 7 % 2 AS remainder;
```

### Casting types — `::`

Postgres has a short cast syntax:

```sql
SELECT '2024-03-15'::date,
       '42'::int + 1,
       3.14159::numeric(4,2),
       CAST(length AS text) AS standard_way
FROM film LIMIT 1;
```

### CASE — if/else inside a query

```sql
SELECT title, rental_rate,
       CASE
         WHEN rental_rate < 1 THEN 'cheap'
         WHEN rental_rate < 3 THEN 'normal'
         ELSE 'premium'
       END AS price_band
FROM film;
```

Conditions are tested top to bottom; the first true one wins. No ELSE → NULL.

### Dealing with NULL: COALESCE and NULLIF

* `COALESCE(a, b, c)` returns the first non‑NULL argument — perfect for defaults
* `NULLIF(a, b)` returns NULL if `a = b`, else `a` — handy to turn `''` into NULL, or to avoid division by zero: `x / NULLIF(y, 0)`

```sql
SELECT rental_id,
       COALESCE(return_date::text, 'not back yet') AS returned
FROM rental
WHERE customer_id = 284;
```

Note `return_date::text` — COALESCE needs all its arguments to be the same type.
