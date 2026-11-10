## Joins — combining tables

Data is split across tables to avoid repetition: `film` stores a `language_id`, not the word "English". A **join** stitches rows back together using matching keys.

### INNER JOIN

Only rows that have a match on both sides.

```sql
SELECT f.title, l.name AS language
FROM film AS f
JOIN language AS l ON l.language_id = f.language_id;
```

* `JOIN` = `INNER JOIN`
* `f` and `l` are **table aliases** — they keep things short, and you *need* them when two tables share column names
* When the key column has the same name on both sides: `JOIN language USING (language_id)`

### Joining many tables — follow the path

Films → categories needs the bridge table `film_category` (many‑to‑many):

```sql
SELECT f.title, c.name AS category
FROM film f
JOIN film_category fc ON fc.film_id = f.film_id
JOIN category c       ON c.category_id = fc.category_id
WHERE c.name = 'Horror';
```

Look at the map in Chapter 1 and walk the arrows: *payment → rental → inventory → film*.

### LEFT JOIN — keep everything from the left

Rows from the left table are kept even with no match; the right‑side columns become NULL.

```sql
SELECT f.title, i.inventory_id
FROM film f
LEFT JOIN inventory i ON i.film_id = f.film_id
ORDER BY i.inventory_id NULLS FIRST
LIMIT 5;
```

**Anti‑join pattern:** "rows in A with no match in B" = LEFT JOIN + `IS NULL` on B's key:

```sql
SELECT f.title
FROM film f
LEFT JOIN inventory i ON i.film_id = f.film_id
WHERE i.inventory_id IS NULL;     -- films the store doesn't stock
```

> ⚠️ Filtering a LEFT JOIN's right‑hand table in `WHERE` (e.g. `WHERE i.store_id = 1`) silently turns it back into an inner join. Put such conditions in the `ON` clause instead.

### RIGHT, FULL and CROSS JOIN

* `RIGHT JOIN` — mirror of LEFT (rarely used; just swap the tables)
* `FULL JOIN` — keep unmatched rows from both sides
* `CROSS JOIN` — every row × every row (careful: 1000 × 1000 = 1,000,000)

### Self join

A table joined to itself, with two aliases:

```sql
-- pairs of films with identical length and rating
SELECT a.title, b.title, a.length
FROM film a
JOIN film b ON a.length = b.length AND a.rating = b.rating AND a.film_id < b.film_id
LIMIT 10;
```

### Joins + GROUP BY = real reports

```sql
SELECT c.name AS category, COUNT(*) AS films
FROM category c
JOIN film_category fc USING (category_id)
GROUP BY c.name
ORDER BY films DESC;
```

> 💡 Watch for **row explosion**: joining one customer to their 30 rentals gives 30 rows. If you then `SUM` a column from the customer side, you count it 30 times.
