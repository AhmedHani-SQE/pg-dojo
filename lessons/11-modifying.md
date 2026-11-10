## Changing data: INSERT, UPDATE, DELETE

Pagila is read‑only for you, so these challenges work on **copies** in your playground. Each challenge has a **⚙ Prepare tables** button that (re)creates the table it needs, e.g. `my_films` — a copy of `film_id, title, rating, rental_rate, length` from `film`.

### INSERT

```sql
INSERT INTO my_films (film_id, title, rating, rental_rate, length)
VALUES (2000, 'MY FIRST FILM', 'PG', 1.99, 100);
```

Several rows at once:

```sql
INSERT INTO my_films (film_id, title, rating, rental_rate, length)
VALUES (2001, 'SEQUEL', 'PG', 2.99, 110),
       (2002, 'TRILOGY', 'R', 3.99, 125);
```

From a query:

```sql
INSERT INTO my_films (film_id, title, rating, rental_rate, length)
SELECT film_id + 5000, title || ' (REMASTERED)', rating, rental_rate, length
FROM film WHERE length > 180;
```

### UPDATE

```sql
UPDATE my_films
SET rental_rate = rental_rate + 0.50,
    title = UPPER(title)
WHERE rating = 'G';
```

> ☠️ An UPDATE or DELETE **without WHERE** hits every row. Write the WHERE first, or test it as a SELECT first.

### DELETE

```sql
DELETE FROM my_films WHERE length < 50;
```

`TRUNCATE my_films;` empties a table instantly (no WHERE possible).

### RETURNING — a Postgres favorite

Get back the rows you just changed, without a second query:

```sql
UPDATE my_films SET rental_rate = 0.99
WHERE film_id = 1
RETURNING film_id, title, rental_rate;
```

Works on INSERT (great for getting generated IDs) and DELETE too.

### UPSERT — INSERT … ON CONFLICT

"Insert, but if the key already exists, do something else instead":

```sql
INSERT INTO film_stock (film_id, copies) VALUES (1, 4)
ON CONFLICT (film_id)
DO UPDATE SET copies = film_stock.copies + EXCLUDED.copies;
```

`EXCLUDED` is the row you *tried* to insert. Use `DO NOTHING` to just skip duplicates.

### Transactions — all or nothing

```sql
BEGIN;
UPDATE my_films SET rental_rate = rental_rate - 1 WHERE film_id = 1;
UPDATE my_films SET rental_rate = rental_rate + 1 WHERE film_id = 2;
COMMIT;      -- or ROLLBACK; to undo everything since BEGIN
```

Either both updates happen or neither does — think bank transfers. Without `BEGIN`, each statement is its own auto‑committed transaction.

> 💡 In this app, **Run** commits for real (inside playground). **Check** always runs your SQL in a transaction and rolls it back, then compares the resulting table with what the reference answer produces.
