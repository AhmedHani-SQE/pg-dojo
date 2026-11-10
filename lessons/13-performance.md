## Views, indexes and EXPLAIN

### Views — saved queries

A view is a named query you can SELECT from like a table. It stores **no data**; it re‑runs every time.

```sql
CREATE VIEW film_with_category AS
SELECT f.film_id, f.title, c.name AS category
FROM film f
JOIN film_category fc USING (film_id)
JOIN category c USING (category_id);
```

```sql
SELECT * FROM film_with_category WHERE category = 'Music';
```

Use `CREATE OR REPLACE VIEW` to change it. Pagila ships with a few views (see 🗂 Schema): `customer_list`, `film_list`, `sales_by_store`…

### Materialized views — saved results

Stores the result like a table (fast to read), but goes stale until you refresh it:

```sql
CREATE MATERIALIZED VIEW yearly_revenue AS
SELECT EXTRACT(YEAR FROM payment_date)::int AS year, SUM(amount) AS revenue
FROM payment GROUP BY 1;
```

```sql
REFRESH MATERIALIZED VIEW yearly_revenue;
```

### EXPLAIN — how will Postgres run my query?

```sql
EXPLAIN SELECT * FROM rental WHERE customer_id = 5;
```

```sql
EXPLAIN ANALYZE SELECT * FROM rental WHERE customer_id = 5;   -- actually runs it and times it
```

Read the plan bottom‑up. Words to know:

| node | meaning |
|---|---|
| **Seq Scan** | read the whole table, row by row |
| **Index Scan** | use an index to jump straight to matching rows |
| **Bitmap Heap Scan** | use an index to collect many matches, then fetch them |
| **Hash Join / Nested Loop / Merge Join** | three ways to join |
| `cost=0.00..123.45` | planner's estimate (startup..total), in arbitrary units |
| `rows=` | estimated rows; with ANALYZE you also get the *actual* rows and time |

### Indexes — the book's index for your table

Without an index, finding `customer_id = 5` means scanning all 51k rentals. A **B‑tree index** keeps the values sorted so Postgres can jump right there.

```sql
CREATE TABLE my_rentals AS SELECT * FROM rental;    -- copy into playground
```

```sql
EXPLAIN ANALYZE SELECT * FROM my_rentals WHERE customer_id = 5;   -- Seq Scan
```

```sql
CREATE INDEX my_rentals_customer_idx ON my_rentals (customer_id);
```

```sql
EXPLAIN ANALYZE SELECT * FROM my_rentals WHERE customer_id = 5;   -- now uses the index
```

**Multi‑column indexes** are ordered by the first column, then the second:
`CREATE INDEX ON my_rentals (customer_id, rental_date);` helps `WHERE customer_id = 5 ORDER BY rental_date` — but not a query filtering on `rental_date` alone.

### When are indexes worth it?

* ✅ Columns you filter (`WHERE`), join (`ON`) or sort (`ORDER BY`) by often, on big tables
* ✅ Foreign key columns (Postgres does **not** index them automatically — primary keys and UNIQUE get one automatically)
* ❌ Tiny tables (a Seq Scan is already instant)
* ❌ Every column "just in case" — each index slows down INSERT/UPDATE and takes disk space
* 🤔 Low‑selectivity columns (e.g. a boolean) rarely benefit

Other index types: **GIN** (arrays, jsonb, full‑text — Pagila's `film_fulltext_idx` is a GiST), **BRIN** (huge time‑ordered tables), and **partial indexes** (`CREATE INDEX ... WHERE return_date IS NULL`).
