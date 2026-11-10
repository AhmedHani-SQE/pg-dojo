## SELECT, the workhorse

```sql
SELECT column1, column2, ...
FROM some_table;
```

### Expressions and aliases

You can compute things right in the SELECT list, and rename any output column with `AS`:

```sql
SELECT title,
       rental_rate,
       rental_rate * 2 AS double_rate
FROM film;
```

If an alias has spaces or capitals, wrap it in **double quotes**: `AS "Rate x2"`. (In Postgres: double quotes = names, single quotes = text values. Mixing them up is the #1 beginner error.)

### DISTINCT — remove duplicate rows

```sql
SELECT DISTINCT rental_duration FROM film;
```

`DISTINCT` applies to the **whole row**, so `SELECT DISTINCT rating, rental_duration` gives unique *combinations*.

### ORDER BY — sorting

Without `ORDER BY`, rows come back in **no guaranteed order**. Ever. Postgres returns whatever is fastest.

```sql
SELECT title, length
FROM film
ORDER BY length DESC, title ASC;   -- longest first; ties broken alphabetically
```

* `ASC` (default) = smallest first, `DESC` = biggest first
* You can sort by several columns — the second only breaks ties of the first
* You can sort by an alias: `ORDER BY double_rate`
* NULLs sort **last** in ASC and **first** in DESC by default; override with `NULLS FIRST` / `NULLS LAST`

### LIMIT and OFFSET — top‑N and paging

```sql
SELECT title, rental_rate
FROM film
ORDER BY rental_rate DESC, title
LIMIT 5;          -- only 5 rows
```

```sql
-- page 3 with 10 rows per page = skip 20, take 10
SELECT title FROM film ORDER BY title LIMIT 10 OFFSET 20;
```

> ⚠️ LIMIT without ORDER BY gives you "some 5 rows", not "the top 5". Always pair them.

### Logical order of a query

You *write* `SELECT … FROM … ORDER BY … LIMIT`, but Postgres *thinks* in this order:

1. `FROM` – get the table
2. `SELECT` – compute the columns
3. `DISTINCT`
4. `ORDER BY`
5. `LIMIT / OFFSET`

That's why `ORDER BY` can use a SELECT alias. We'll add more steps (WHERE, GROUP BY…) to this list soon.
