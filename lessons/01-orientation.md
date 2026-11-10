## What is PostgreSQL?

PostgreSQL ("Postgres") is a **relational database**: it stores data in **tables** (rows × columns) and you talk to it with **SQL**. It's free, open source, and one of the most loved databases among developers — mostly because it follows the SQL standard closely *and* adds a ton of extras (arrays, JSON, window functions, full‑text search…).

You're running **PostgreSQL 18.6** locally on this laptop.

## How Postgres organizes things

```
server (cluster)
 └── database        ← we use one called "pagila"
      └── schema     ← a folder for tables. Pagila lives in "public", your stuff goes in "playground"
           └── table ← rows and columns
```

When you write `film`, Postgres looks through your **search_path** (here: `playground`, then `public`) to find it. You can always be explicit: `public.film`.

## Meet Pagila — your practice database

Pagila is a fake **DVD rental store** (think 2000s Blockbuster). It's the classic Postgres learning dataset because it has real relationships to join through:

```
 actor ──< film_actor >── film ──< film_category >── category
                           │ └──── language
                           │
                       inventory  (a physical DVD copy, sits in a store)
                           │
 customer ──────────< rental >── staff ── store
    │                      │
 address ── city ── country payment (money paid for a rental)
```

`──<` means "one to many". E.g. one film has many copies in `inventory`, and each copy can be rented many times.

| table | what's in it |
|---|---|
| `film` | 1000 movies: title, description, length (minutes), rating, rental_rate, … |
| `actor`, `film_actor` | 200 actors and which films they're in |
| `category`, `film_category` | genres (Action, Comedy, …) |
| `inventory` | DVD copies of each film per store |
| `rental` | ~51k rentals: who rented which copy, when, when returned |
| `payment` | ~51k payments (amount, date) |
| `customer`, `address`, `city`, `country` | who the customers are and where they live |

Use the **🗂 Schema** button (top right) any time to see every table's columns.

## How this app works

* **Run** (Ctrl + Enter) executes your SQL and shows the result. Try the examples below — click **▶ Try it** to load them into the editor.
* **Check** compares your result with the reference answer. Column names don't matter, values do. Row order only matters when the challenge says so.
* Pagila tables are **read‑only** for you, so go wild — you can't break anything. Tables you create go into the `playground` schema (and you can reset it anytime).
* **🤖 AI review / Ask AI** sends your attempt to an AI tutor (Groq) for feedback and lets you chat about it.

## Your very first query

`SELECT` = "give me these columns", `FROM` = "from this table". `*` means all columns.

```sql
SELECT * FROM film LIMIT 5;
```

```sql
SELECT title, length FROM film LIMIT 5;
```

> 💡 SQL keywords aren't case‑sensitive (`select` = `SELECT`), but writing them in caps makes queries easier to read. The `;` at the end is optional here.
