## Things that make Postgres special

### DISTINCT ON — "first row per group"

Keep only the first row for each distinct value of some columns (according to ORDER BY):

```sql
-- each customer's very first rental
SELECT DISTINCT ON (customer_id) customer_id, rental_date, rental_id
FROM rental
ORDER BY customer_id, rental_date;
```

The `ORDER BY` must **start** with the DISTINCT ON columns; what follows decides which row wins. Often simpler than the ROW_NUMBER pattern.

### Arrays

Pagila's `film.special_features` is a `text[]`:

```sql
SELECT title, special_features FROM film LIMIT 5;
```

```sql
SELECT title FROM film
WHERE 'Commentaries' = ANY(special_features);       -- contains this element?
```

```sql
SELECT title, special_features[1] AS first_feature,   -- arrays are 1-indexed!
       cardinality(special_features) AS how_many
FROM film LIMIT 5;
```

`unnest()` turns an array into rows; `array_agg()` does the opposite:

```sql
SELECT unnest(special_features) AS feature, title FROM film LIMIT 6;
```

```sql
SELECT rating, array_agg(title ORDER BY title) AS titles
FROM film WHERE length > 183 GROUP BY rating;
```

### string_agg — glue rows into one string

```sql
SELECT c.name, string_agg(f.title, ', ' ORDER BY f.title) AS films
FROM category c
JOIN film_category fc USING (category_id)
JOIN film f USING (film_id)
WHERE f.length > 180
GROUP BY c.name;
```

### generate_series — make rows out of thin air

```sql
SELECT generate_series(1, 5) AS n;
```

```sql
SELECT d::date AS day
FROM generate_series('2024-01-01'::date, '2024-01-07', INTERVAL '1 day') AS d;
```

Classic use: a calendar to LEFT JOIN against, so days with **zero** sales still show up.

### JSONB

Postgres stores JSON natively and lets you query inside it:

```sql
SELECT '{"user": "ahmed", "tags": ["sql", "pg"], "score": 9}'::jsonb AS doc;
```

| operator | returns |
|---|---|
| `doc -> 'user'` | the value **as jsonb** (`"ahmed"`) |
| `doc ->> 'user'` | the value **as text** (`ahmed`) |
| `doc -> 'tags' ->> 0` | first array element as text |
| `doc ? 'score'` | does the key exist? |
| `doc @> '{"user":"ahmed"}'` | does it contain this? |

```sql
SELECT jsonb_build_object('title', title, 'minutes', length) AS doc
FROM film LIMIT 3;
```

`->>` gives text, so cast when doing math: `(doc ->> 'score')::int > 5`.

### Full‑text search

Pagila has a `fulltext` column (`tsvector`) on `film` built from title + description. Search it with `@@` and a `tsquery`:

```sql
SELECT title, description
FROM film
WHERE fulltext @@ to_tsquery('english', 'shark & boat');
```

`&` = and, `|` = or, `!` = not. Words are stemmed, so `'sharks'` matches `shark`. Try `plainto_tsquery('english', 'mad scientist')` for plain text input.
