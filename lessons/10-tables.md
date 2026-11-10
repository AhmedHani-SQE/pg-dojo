## Building your own tables

Everything you create here goes into the **`playground`** schema (it's first in your search_path). Pagila's own tables are read‑only for you. Use **Reset playground** (top bar) to wipe your stuff.

### CREATE TABLE

```sql
CREATE TABLE pets (
  pet_id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  species    text DEFAULT 'cat',
  born_on    date,
  weight_kg  numeric(5,2) CHECK (weight_kg > 0),
  is_adopted boolean NOT NULL DEFAULT false
);
```

### The data types you'll actually use

| type | for |
|---|---|
| `integer` / `bigint` | whole numbers (bigint for huge ones, e.g. IDs of big tables) |
| `numeric(p,s)` | exact decimals — **money**. `numeric(8,2)` = up to 999999.99 |
| `real` / `double precision` | approximate floats (science stuff, never money) |
| `text` | strings. In Postgres `text` is as fast as `varchar(n)` — use `varchar(n)` only if you want a length limit |
| `boolean` | true / false |
| `date`, `timestamptz`, `interval` | time stuff (see chapter 6) |
| `uuid` | random unique IDs |
| `jsonb` | JSON documents (chapter 12) |
| `text[]`, `integer[]` | arrays — a Postgres special |

### Auto‑increment IDs

* Modern & standard: `integer GENERATED ALWAYS AS IDENTITY`
* Old‑school Postgres: `serial` (still everywhere in older code, Pagila included)

### Constraints — rules the database enforces for you

| constraint | meaning |
|---|---|
| `PRIMARY KEY` | unique + not null; identifies the row |
| `NOT NULL` | value required |
| `UNIQUE` | no duplicates in this column (or combination) |
| `CHECK (expr)` | expression must be true, e.g. `CHECK (stars BETWEEN 1 AND 5)` |
| `REFERENCES other(col)` | **foreign key** — value must exist in the other table |
| `DEFAULT x` | value used when you don't give one |

Table‑level constraints (for several columns) go after the columns:

```sql
CREATE TABLE favorite_films (
  pet_id  integer REFERENCES pets(pet_id) ON DELETE CASCADE,
  film_id integer REFERENCES film(film_id),
  PRIMARY KEY (pet_id, film_id)          -- composite key
);
```

`ON DELETE CASCADE` = if the pet is deleted, its favorites go too. (Default is to *refuse* the delete.)

### Changing a table: ALTER TABLE

```sql
ALTER TABLE pets ADD COLUMN color text;
ALTER TABLE pets RENAME COLUMN species TO kind;
ALTER TABLE pets DROP COLUMN color;
ALTER TABLE pets ALTER COLUMN name TYPE varchar(50);
ALTER TABLE pets ADD CONSTRAINT pets_name_unique UNIQUE (name);
```

### Removing: DROP TABLE

```sql
DROP TABLE IF EXISTS favorite_films;
DROP TABLE IF EXISTS pets CASCADE;   -- CASCADE also drops things that depend on it
```

### Create a table from a query

```sql
CREATE TABLE short_films AS
SELECT film_id, title, length FROM film WHERE length < 50;
```

(Copies the data, but **not** the constraints/indexes.)

### See what you built

The 🗂 Schema panel shows `playground` tables at the top. In SQL:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'playground' AND table_name = 'pets';
```

> 💡 In Postgres, **DDL is transactional**: `BEGIN; DROP TABLE x; ROLLBACK;` brings the table back. Most other databases can't do that. The Check button uses exactly this trick to test your answer without keeping it.
