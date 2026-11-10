## WHERE — keep only the rows you want

```sql
SELECT title, length
FROM film
WHERE length > 180;
```

### Comparison operators

| operator | meaning |
|---|---|
| `=` | equal (just one `=`, not `==`) |
| `<>` or `!=` | not equal |
| `<  >  <=  >=` | the usual |

Text and dates compare too: `WHERE title < 'B'`, `WHERE rental_date >= '2024-01-01'`. Text values go in **single quotes**.

### AND, OR, NOT — and parentheses!

`AND` binds tighter than `OR`. This is a classic trap:

```sql
-- ❌ means: (rating = 'G') OR (rating = 'PG' AND length > 150)
SELECT title, rating, length FROM film
WHERE rating = 'G' OR rating = 'PG' AND length > 150;
```

```sql
-- ✅ what you probably meant
SELECT title, rating, length FROM film
WHERE (rating = 'G' OR rating = 'PG') AND length > 150;
```

### IN and BETWEEN — shortcuts

```sql
SELECT title, rating FROM film WHERE rating IN ('G', 'PG');
```

```sql
SELECT title, length FROM film WHERE length BETWEEN 90 AND 95;   -- inclusive both ends
```

`NOT IN`, `NOT BETWEEN` work too.

### LIKE and ILIKE — pattern matching

* `%` = any number of characters (including zero)
* `_` = exactly one character

```sql
SELECT title FROM film WHERE title LIKE 'AIR%';      -- starts with AIR
```

```sql
SELECT title FROM film WHERE title ILIKE '%dog%';    -- contains dog, ANY case
```

`ILIKE` is a **Postgres extra**: case‑insensitive LIKE. Standard SQL would make you write `LOWER(title) LIKE '%dog%'`.

### NULL — the "unknown" value

`NULL` means "no value / unknown". It is **not** zero and **not** an empty string. Any comparison with NULL gives NULL (not true), so this finds **nothing**:

```sql
SELECT * FROM rental WHERE return_date = NULL;   -- ❌ always empty
```

Use `IS NULL` / `IS NOT NULL`:

```sql
SELECT rental_id, rental_date FROM rental WHERE return_date IS NULL;  -- ✅ DVDs still out
```

### Updated logical order

`FROM` → **`WHERE`** → `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT`

WHERE runs *before* SELECT, so you **can't** use a SELECT alias inside WHERE.
