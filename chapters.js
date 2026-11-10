// Curriculum: chapters (lesson markdown lives in ./lessons) + challenges with reference solutions.
// Challenge fields:
//   prompt   – markdown shown to the student
//   solution – reference SQL (result is compared with the student's)
//   ordered  – row order matters
//   setup    – SQL run first (inside the check transaction; also via "Prepare tables")
//   verify   – for DDL/DML: query run AFTER the student's SQL; its output is what gets compared
const fs = require('fs');
const path = require('path');
const md = f => fs.readFileSync(path.join(__dirname, 'lessons', f), 'utf8');

const MY_FILMS = `DROP TABLE IF EXISTS playground.my_films CASCADE;
CREATE TABLE playground.my_films AS SELECT film_id, title, rating, rental_rate, length FROM public.film;
ALTER TABLE playground.my_films ADD PRIMARY KEY (film_id);`;

const COLS_AND_CONSTRAINTS = t => `SELECT 'column' AS kind, column_name || ' ' || data_type || ' nullable=' || is_nullable || ' default=' || (column_default IS NOT NULL OR is_identity = 'YES')::text AS info
FROM information_schema.columns WHERE table_schema = 'playground' AND table_name = '${t}'
UNION ALL
SELECT 'constraint', contype::text || ' ' || COALESCE(NULLIF(confrelid, 0)::regclass::text, '') || ' cols=' || array_length(conkey, 1)
FROM pg_constraint WHERE conrelid = 'playground.${t}'::regclass AND contype IN ('p','f','c','u')`;

const INDEX_COLS = t => `SELECT (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
        FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum) AS indexed_columns,
       am.amname AS index_type
FROM pg_index i
JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN pg_am am ON am.oid = ic.relam
WHERE i.indrelid = 'playground.${t}'::regclass`;

module.exports = [
  // ───────────────────────────── 1
  {
    id: 'orientation', icon: '🧭', title: 'Welcome to Postgres & Pagila',
    summary: 'What Postgres is, how it organizes data, and a tour of the DVD-store database.',
    lesson: md('01-orientation.md'),
    challenges: [
      { id: 'orient-1', title: 'Say hi to the actors', prompt: 'Return **every column and every row** of the `actor` table.', hint: '`*` means all columns.', solution: `SELECT * FROM actor` },
      { id: 'orient-2', title: 'Languages', prompt: 'Return just the `name` column of the `language` table.', hint: 'SELECT column FROM table', solution: `SELECT name FROM language` },
      { id: 'orient-3', title: 'Film blurbs', prompt: 'Return the `title` and `description` of every film.', hint: 'Separate column names with commas.', solution: `SELECT title, description FROM film` },
    ],
  },
  // ───────────────────────────── 2
  {
    id: 'select', icon: '🔎', title: 'SELECT, sorting & limiting',
    summary: 'Columns, expressions, aliases, DISTINCT, ORDER BY, LIMIT/OFFSET.',
    lesson: md('02-select.md'),
    challenges: [
      { id: 'select-1', title: 'Price list', prompt: 'List the `title` and `rental_rate` of all films.', hint: 'Two columns from `film`.', solution: `SELECT title, rental_rate FROM film` },
      { id: 'select-2', title: 'The 10 longest films', ordered: true, prompt: 'Show `title` and `length` of the **10 longest** films. Longest first; if two films have the same length, sort them by title A→Z.', hint: 'ORDER BY two columns, then LIMIT.', solution: `SELECT title, length FROM film ORDER BY length DESC, title LIMIT 10` },
      { id: 'select-3', title: 'Which ratings exist?', prompt: 'Return each distinct `rating` found in `film` — each one only once.', hint: 'DISTINCT', solution: `SELECT DISTINCT rating FROM film` },
      { id: 'select-4', title: 'Cost gap', prompt: 'For every film return `title` and a column `cost_gap` = `replacement_cost` minus `rental_rate`.', hint: 'You can do math in SELECT and name it with AS.', solution: `SELECT title, replacement_cost - rental_rate AS cost_gap FROM film` },
      { id: 'select-5', title: 'Page 2 of the actor list', ordered: true, prompt: 'Sort actors by `last_name`, then `first_name` (both A→Z). Show `first_name, last_name` for **page 2** when each page has 10 rows (i.e. rows 11–20).', hint: 'LIMIT 10 OFFSET ?', solution: `SELECT first_name, last_name FROM actor ORDER BY last_name, first_name LIMIT 10 OFFSET 10` },
      { id: 'select-6', title: 'Cheapest to replace', ordered: true, prompt: 'Show `title` and `replacement_cost` of the **5 films that are cheapest to replace**, cheapest first, ties broken by title A→Z.', hint: 'ORDER BY ... ASC, title', solution: `SELECT title, replacement_cost FROM film ORDER BY replacement_cost, title LIMIT 5` },
    ],
  },
  // ───────────────────────────── 3
  {
    id: 'filtering', icon: '🧹', title: 'Filtering with WHERE',
    summary: 'Comparisons, AND/OR, IN, BETWEEN, LIKE/ILIKE and the strange world of NULL.',
    lesson: md('03-filtering.md'),
    challenges: [
      { id: 'where-1', title: 'Long PG-13 films', prompt: 'Return `title` and `length` of films rated `PG-13` that are **longer than 150** minutes.', hint: "rating = 'PG-13' AND ...", solution: `SELECT title, length FROM film WHERE rating = 'PG-13' AND length > 150` },
      { id: 'where-2', title: 'Family bargain bin', prompt: "Return the `title` of films that are rated **G or PG** *and* have a `rental_rate` of **0.99**.", hint: 'Parentheses around the OR — or use IN.', solution: `SELECT title FROM film WHERE rating IN ('G','PG') AND rental_rate = 0.99` },
      { id: 'where-3', title: 'The J-team', prompt: 'Return `first_name, last_name` of actors whose first name **starts with J**.', hint: "LIKE 'J%'", solution: `SELECT first_name, last_name FROM actor WHERE first_name LIKE 'J%'` },
      { id: 'where-4', title: 'All you need is love', prompt: 'Return the `title` of every film whose title contains the word **love** — in any letter case.', hint: 'ILIKE with % on both sides.', solution: `SELECT title FROM film WHERE title ILIKE '%love%'` },
      { id: 'where-5', title: 'About an hour', prompt: 'Return `title, length` for films between **60 and 70** minutes long (inclusive).', hint: 'BETWEEN is inclusive.', solution: `SELECT title, length FROM film WHERE length BETWEEN 60 AND 70` },
      { id: 'where-6', title: 'Still not returned', prompt: 'Return `rental_id, rental_date, customer_id` for every rental that has **not been returned** yet (`return_date` is empty).', hint: '`= NULL` never works. Use IS NULL.', solution: `SELECT rental_id, rental_date, customer_id FROM rental WHERE return_date IS NULL` },
      { id: 'where-7', title: 'Inactive at store 2', prompt: 'Return `first_name, last_name, email` of customers of **store 2** whose `active` column is **0**.', hint: 'Two conditions with AND.', solution: `SELECT first_name, last_name, email FROM customer WHERE store_id = 2 AND active = 0` },
      { id: 'where-8', title: 'Short and grown-up', prompt: "Return `title, rating, length` for films that are **not** rated G, PG or PG-13, and are **shorter than 50** minutes.", hint: 'NOT IN (...)', solution: `SELECT title, rating, length FROM film WHERE rating NOT IN ('G','PG','PG-13') AND length < 50` },
    ],
  },
  // ───────────────────────────── 4
  {
    id: 'functions', icon: '🧮', title: 'Functions, CASE & NULL handling',
    summary: 'Text and number functions, :: casting, CASE expressions, COALESCE and NULLIF.',
    lesson: md('04-functions.md'),
    challenges: [
      { id: 'fn-1', title: 'Proper names', prompt: "Return one column `full_name` for every actor, formatted like **`Penelope Guiness`** (first name, a space, last name, each word capitalized).", hint: 'INITCAP and ||', solution: `SELECT INITCAP(first_name || ' ' || last_name) AS full_name FROM actor` },
      { id: 'fn-2', title: 'Short, medium, long', prompt: "Return `title` and `length_label` for every film: `'short'` if under 60 minutes, `'medium'` if 60–120 (inclusive), `'long'` if over 120.", hint: 'CASE WHEN ... THEN ... END', solution: `SELECT title, CASE WHEN length < 60 THEN 'short' WHEN length <= 120 THEN 'medium' ELSE 'long' END AS length_label FROM film` },
      { id: 'fn-3', title: 'Wordy titles', prompt: 'Return `title` and `title_length` (number of characters) for films whose title is **longer than 20 characters**.', hint: 'LENGTH() works in WHERE too.', solution: `SELECT title, LENGTH(title) AS title_length FROM film WHERE LENGTH(title) > 20` },
      { id: 'fn-4', title: 'Best value per day', ordered: true, prompt: 'Rental price per day = `rental_rate / rental_duration`. Show `title` and `rate_per_day` **rounded to 2 decimals** for the **5 films with the highest** rate per day. Ties: title A→Z.', hint: 'ROUND(x, 2). You can ORDER BY the alias.', solution: `SELECT title, ROUND(rental_rate / rental_duration, 2) AS rate_per_day FROM film ORDER BY rate_per_day DESC, title LIMIT 5` },
      { id: 'fn-5', title: 'Usernames', prompt: 'Every customer email looks like `MARY.SMITH@sakilacustomer.org`. Return `customer_id` and `username` = the part **before the @**, in **lowercase** (e.g. `mary.smith`).', hint: "SPLIT_PART(text, '@', 1)", solution: `SELECT customer_id, LOWER(SPLIT_PART(email, '@', 1)) AS username FROM customer` },
      { id: 'fn-6', title: 'Out or back?', prompt: "For customer **75**, return `rental_id` and `returned_on`: the return date as a **date** (no time), or the text `'still out'` if it was never returned.", hint: "COALESCE needs matching types — return_date::date::text", solution: `SELECT rental_id, COALESCE(return_date::date::text, 'still out') AS returned_on FROM rental WHERE customer_id = 75` },
    ],
  },
  // ───────────────────────────── 5
  {
    id: 'aggregation', icon: '📊', title: 'Aggregation & GROUP BY',
    summary: 'COUNT/SUM/AVG/MIN/MAX, GROUP BY, HAVING and the Postgres FILTER clause.',
    lesson: md('05-aggregation.md'),
    challenges: [
      { id: 'agg-1', title: 'Films per rating', prompt: 'Return `rating` and `film_count` (how many films have that rating).', hint: 'GROUP BY rating', solution: `SELECT rating, COUNT(*) AS film_count FROM film GROUP BY rating` },
      { id: 'agg-2', title: 'Average length per rating', prompt: 'Return `rating` and `avg_length` — the average film length for that rating, **rounded to 1 decimal**.', hint: 'ROUND(AVG(...), 1)', solution: `SELECT rating, ROUND(AVG(length), 1) AS avg_length FROM film GROUP BY rating` },
      { id: 'agg-3', title: 'Payment stats', prompt: 'One row with 5 columns from `payment`: `payments` (count), `total` (sum of amount), `avg_amount` (rounded to 2 decimals), `min_amount`, `max_amount`.', hint: 'No GROUP BY needed when you want one row for the whole table.', solution: `SELECT COUNT(*) AS payments, SUM(amount) AS total, ROUND(AVG(amount), 2) AS avg_amount, MIN(amount) AS min_amount, MAX(amount) AS max_amount FROM payment` },
      { id: 'agg-4', title: 'Big spenders', prompt: 'Return `customer_id` and `total_paid` for customers whose payments add up to **more than 300**.', hint: 'Filter on an aggregate → HAVING.', solution: `SELECT customer_id, SUM(amount) AS total_paid FROM payment GROUP BY customer_id HAVING SUM(amount) > 300` },
      { id: 'agg-5', title: 'Popular rental durations', prompt: 'Return `rental_duration` and `films` (count) — but only for durations that more than **200** films have.', hint: 'GROUP BY + HAVING COUNT(*) > 200', solution: `SELECT rental_duration, COUNT(*) AS films FROM film GROUP BY rental_duration HAVING COUNT(*) > 200` },
      { id: 'agg-6', title: 'Unique renters of 2025', prompt: 'How many **different customers** rented at least one film during **2025**? Return a single number.', hint: "COUNT(DISTINCT ...) and rental_date >= '2025-01-01' AND rental_date < '2026-01-01'", solution: `SELECT COUNT(DISTINCT customer_id) FROM rental WHERE rental_date >= '2025-01-01' AND rental_date < '2026-01-01'` },
      { id: 'agg-7', title: 'Long films per rating (FILTER)', prompt: 'Per `rating`, return `total` (all films) and `long_films` (films longer than 120 minutes) — in one query.', hint: 'COUNT(*) FILTER (WHERE ...)', solution: `SELECT rating, COUNT(*) AS total, COUNT(*) FILTER (WHERE length > 120) AS long_films FROM film GROUP BY rating` },
    ],
  },
  // ───────────────────────────── 6
  {
    id: 'dates', icon: '📅', title: 'Dates & times',
    summary: 'date vs timestamptz, intervals, EXTRACT, DATE_TRUNC, TO_CHAR.',
    lesson: md('06-dates.md'),
    challenges: [
      { id: 'date-1', title: 'Busiest day', prompt: 'How many rentals happened on **31 July 2022**? Return one number.', hint: "rental_date::date = '2022-07-31'", solution: `SELECT COUNT(*) FROM rental WHERE rental_date::date = '2022-07-31'` },
      { id: 'date-2', title: 'Kept too long', prompt: 'How many rentals were kept **longer than 9 days** (time between `rental_date` and `return_date`)? Return one number.', hint: "return_date - rental_date > INTERVAL '9 days'", solution: `SELECT COUNT(*) FROM rental WHERE return_date - rental_date > INTERVAL '9 days'` },
      { id: 'date-3', title: 'Revenue per year', ordered: true, prompt: 'Return `year` and `revenue` (sum of payment amounts) for each year, oldest year first.', hint: 'EXTRACT(YEAR FROM payment_date)', solution: `SELECT EXTRACT(YEAR FROM payment_date) AS year, SUM(amount) AS revenue FROM payment GROUP BY 1 ORDER BY 1` },
      { id: 'date-4', title: 'Rentals per month in 2023', ordered: true, prompt: 'For **2023**, return `month` (as a **date** = first day of the month, e.g. `2023-01-01`) and `rentals` (count), in month order.', hint: "DATE_TRUNC('month', rental_date)::date", solution: `SELECT DATE_TRUNC('month', rental_date)::date AS month, COUNT(*) AS rentals FROM rental WHERE rental_date >= '2023-01-01' AND rental_date < '2024-01-01' GROUP BY 1 ORDER BY 1` },
      { id: 'date-5', title: 'Weekday champion', ordered: true, prompt: "Return `day_name` (like `Sunday` — no padding spaces) and `rentals` for each day of the week, the busiest day first.", hint: "TO_CHAR(rental_date, 'FMDay')", solution: `SELECT TO_CHAR(rental_date, 'FMDay') AS day_name, COUNT(*) AS rentals FROM rental GROUP BY 1 ORDER BY 2 DESC` },
      { id: 'date-6', title: 'Average rental duration', prompt: 'Return one value: the **average number of days** a returned rental was kept, rounded to 2 decimals. (Hint: convert the interval to seconds with `EXTRACT(EPOCH FROM interval)` and divide by 86400.)', hint: 'ROUND(AVG(EXTRACT(EPOCH FROM return_date - rental_date) / 86400), 2)', solution: `SELECT ROUND(AVG(EXTRACT(EPOCH FROM return_date - rental_date) / 86400), 2) FROM rental WHERE return_date IS NOT NULL` },
    ],
  },
  // ───────────────────────────── 7
  {
    id: 'joins', icon: '🔗', title: 'Joins',
    summary: 'INNER and LEFT joins, multi-table paths, anti-joins and self joins.',
    lesson: md('07-joins.md'),
    challenges: [
      { id: 'join-1', title: 'Film + language', prompt: 'Return `title` and `language` (the language **name**) for every film.', hint: 'JOIN language ON ...', solution: `SELECT f.title, l.name AS language FROM film f JOIN language l ON l.language_id = f.language_id` },
      { id: 'join-2', title: 'Comedy night', prompt: "Return the `title` of every film in the **Comedy** category.", hint: 'film → film_category → category', solution: `SELECT f.title FROM film f JOIN film_category fc ON fc.film_id = f.film_id JOIN category c ON c.category_id = fc.category_id WHERE c.name = 'Comedy'` },
      { id: 'join-3', title: 'The cast', prompt: "Return `first_name, last_name` of the actors in the film **ACADEMY DINOSAUR**.", hint: 'actor → film_actor → film', solution: `SELECT a.first_name, a.last_name FROM actor a JOIN film_actor fa ON fa.actor_id = a.actor_id JOIN film f ON f.film_id = fa.film_id WHERE f.title = 'ACADEMY DINOSAUR'` },
      { id: 'join-4', title: 'Not on the shelf', prompt: 'Return the `title` of films that have **no copies at all** in `inventory`.', hint: 'LEFT JOIN + IS NULL', solution: `SELECT f.title FROM film f LEFT JOIN inventory i ON i.film_id = f.film_id WHERE i.inventory_id IS NULL` },
      { id: 'join-5', title: 'Top 5 countries', ordered: true, prompt: 'Return `country` and `customers` (number of customers living there) for the **5 countries with the most customers**. Ties: country A→Z.', hint: 'customer → address → city → country, then GROUP BY', solution: `SELECT co.country, COUNT(*) AS customers FROM customer cu JOIN address a ON a.address_id = cu.address_id JOIN city ci ON ci.city_id = a.city_id JOIN country co ON co.country_id = ci.country_id GROUP BY co.country ORDER BY customers DESC, co.country LIMIT 5` },
      { id: 'join-6', title: 'Revenue by category', ordered: true, prompt: 'Return `category` and `revenue` (total payments for rentals of films in that category), highest revenue first.', hint: 'payment → rental → inventory → film_category → category', solution: `SELECT c.name AS category, SUM(p.amount) AS revenue FROM payment p JOIN rental r ON r.rental_id = p.rental_id JOIN inventory i ON i.inventory_id = r.inventory_id JOIN film_category fc ON fc.film_id = i.film_id JOIN category c ON c.category_id = fc.category_id GROUP BY c.name ORDER BY revenue DESC` },
      { id: 'join-7', title: 'Same length as the dinosaur', prompt: "Return the `title` of every **other** film that has exactly the same `length` as **ACADEMY DINOSAUR**.", hint: 'Self join: film a JOIN film b ON a.length = b.length', solution: `SELECT b.title FROM film a JOIN film b ON b.length = a.length AND b.film_id <> a.film_id WHERE a.title = 'ACADEMY DINOSAUR'` },
    ],
  },
  // ───────────────────────────── 8
  {
    id: 'subqueries', icon: '🪆', title: 'Subqueries, CTEs & set operations',
    summary: 'Scalar/IN/EXISTS subqueries, WITH (CTEs), recursion, UNION/INTERSECT/EXCEPT.',
    lesson: md('08-subqueries.md'),
    challenges: [
      { id: 'sub-1', title: 'Above average', prompt: 'Return `title, length` of films **longer than the average** film length.', hint: 'WHERE length > (SELECT AVG(length) FROM film)', solution: `SELECT title, length FROM film WHERE length > (SELECT AVG(length) FROM film)` },
      { id: 'sub-2', title: 'Most expensive to replace', prompt: 'Return the `title` of the film(s) with the **highest** `replacement_cost`. (There are several!)', hint: 'Compare with (SELECT MAX(...))', solution: `SELECT title FROM film WHERE replacement_cost = (SELECT MAX(replacement_cost) FROM film)` },
      { id: 'sub-3', title: 'Never been scared', prompt: "Return `first_name, last_name` of actors who have **never** appeared in a **Horror** film.", hint: 'NOT EXISTS (… film_actor → film_category → category …)', solution: `SELECT a.first_name, a.last_name FROM actor a WHERE NOT EXISTS (SELECT 1 FROM film_actor fa JOIN film_category fc ON fc.film_id = fa.film_id JOIN category c ON c.category_id = fc.category_id WHERE fa.actor_id = a.actor_id AND c.name = 'Horror')` },
      { id: 'sub-4', title: 'Dinosaur fans', prompt: "Return `first_name, last_name` of customers who rented **ACADEMY DINOSAUR** — each customer **only once**, even if they rented it several times.", hint: 'customer_id IN (subquery) avoids duplicates naturally', solution: `SELECT first_name, last_name FROM customer WHERE customer_id IN (SELECT r.customer_id FROM rental r JOIN inventory i ON i.inventory_id = r.inventory_id JOIN film f ON f.film_id = i.film_id WHERE f.title = 'ACADEMY DINOSAUR')` },
      { id: 'sub-5', title: 'Top 5 customers (CTE)', ordered: true, prompt: 'Using a `WITH` clause, return `first_name, last_name, total` for the **5 customers who paid the most**, biggest first.', hint: 'WITH totals AS (… GROUP BY customer_id) SELECT … JOIN customer', solution: `WITH totals AS (SELECT customer_id, SUM(amount) AS total FROM payment GROUP BY customer_id) SELECT c.first_name, c.last_name, t.total FROM totals t JOIN customer c ON c.customer_id = t.customer_id ORDER BY t.total DESC LIMIT 5` },
      { id: 'sub-6', title: 'Shared first names', prompt: 'Return every `first_name` that is used by **both** an actor and a customer (each name once).', hint: 'INTERSECT', solution: `SELECT first_name FROM actor INTERSECT SELECT first_name FROM customer` },
      { id: 'sub-7', title: 'Store 1 exclusives', prompt: 'Return the `film_id`s that have copies in **store 1** but **none in store 2**.', hint: 'EXCEPT', solution: `SELECT film_id FROM inventory WHERE store_id = 1 EXCEPT SELECT film_id FROM inventory WHERE store_id = 2` },
      { id: 'sub-8', title: 'Count to ten, recursively', ordered: true, prompt: 'Using `WITH RECURSIVE`, return a column `n` with the numbers **1 to 10** in order.', hint: 'Anchor SELECT 1, then UNION ALL SELECT n + 1 … WHERE n < 10', solution: `WITH RECURSIVE nums(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM nums WHERE n < 10) SELECT n FROM nums` },
    ],
  },
  // ───────────────────────────── 9
  {
    id: 'windows', icon: '🪟', title: 'Window functions',
    summary: 'OVER, PARTITION BY, ROW_NUMBER/RANK, running totals, LAG/LEAD, share of total.',
    lesson: md('09-windows.md'),
    challenges: [
      { id: 'win-1', title: 'Compared to its peers', prompt: 'For every film return `title, rating, length` and `rating_avg` = the average length of films **with the same rating**, rounded to 1 decimal.', hint: 'AVG(length) OVER (PARTITION BY rating)', solution: `SELECT title, rating, length, ROUND(AVG(length) OVER (PARTITION BY rating), 1) AS rating_avg FROM film` },
      { id: 'win-2', title: 'Length ranks', prompt: 'For every film return `title, rating, length` and `rnk` = its **DENSE_RANK** by length **within its rating** (longest = 1).', hint: 'DENSE_RANK() OVER (PARTITION BY rating ORDER BY length DESC)', solution: `SELECT title, rating, length, DENSE_RANK() OVER (PARTITION BY rating ORDER BY length DESC) AS rnk FROM film` },
      { id: 'win-3', title: 'Top 3 per category', prompt: 'Return `category, title, length` for the **3 longest films in each category**. Ties in length: title A→Z decides.', hint: 'ROW_NUMBER() OVER (PARTITION BY category ORDER BY length DESC, title) in a CTE, then WHERE rn <= 3', solution: `WITH ranked AS (SELECT c.name AS category, f.title, f.length, ROW_NUMBER() OVER (PARTITION BY c.name ORDER BY f.length DESC, f.title) AS rn FROM film f JOIN film_category fc ON fc.film_id = f.film_id JOIN category c ON c.category_id = fc.category_id) SELECT category, title, length FROM ranked WHERE rn <= 3` },
      { id: 'win-4', title: 'Running total 2023', ordered: true, prompt: 'For **2023**, return `month` (first day of month, as a date), `revenue` (sum of payments) and `running_total` (revenue accumulated since January), in month order.', hint: 'Aggregate per month in a CTE, then SUM(revenue) OVER (ORDER BY month)', solution: `WITH m AS (SELECT DATE_TRUNC('month', payment_date)::date AS month, SUM(amount) AS revenue FROM payment WHERE payment_date >= '2023-01-01' AND payment_date < '2024-01-01' GROUP BY 1) SELECT month, revenue, SUM(revenue) OVER (ORDER BY month) AS running_total FROM m ORDER BY month` },
      { id: 'win-5', title: 'Previous payment', ordered: true, prompt: "For customer **1**, return `payment_date, amount` and `prev_amount` (the amount of their previous payment; NULL for the first), ordered by payment date.", hint: 'LAG(amount) OVER (ORDER BY payment_date)', solution: `SELECT payment_date, amount, LAG(amount) OVER (ORDER BY payment_date) AS prev_amount FROM payment WHERE customer_id = 1 ORDER BY payment_date` },
      { id: 'win-6', title: 'Slice of the pie', ordered: true, prompt: 'Return `category`, `revenue` and `pct` = that category\'s share of **total** revenue in percent, rounded to 1 decimal. Biggest revenue first.', hint: 'ROUND(100 * SUM(amount) / SUM(SUM(amount)) OVER (), 1)', solution: `SELECT c.name AS category, SUM(p.amount) AS revenue, ROUND(100 * SUM(p.amount) / SUM(SUM(p.amount)) OVER (), 1) AS pct FROM payment p JOIN rental r ON r.rental_id = p.rental_id JOIN inventory i ON i.inventory_id = r.inventory_id JOIN film_category fc ON fc.film_id = i.film_id JOIN category c ON c.category_id = fc.category_id GROUP BY c.name ORDER BY revenue DESC` },
    ],
  },
  // ───────────────────────────── 10
  {
    id: 'tables', icon: '🏗️', title: 'Creating tables',
    summary: 'Data types, CREATE TABLE, constraints, foreign keys, ALTER and DROP.',
    lesson: md('10-tables.md'),
    challenges: [
      {
        id: 'ddl-1', kind: 'ddl', title: 'Your watchlist',
        prompt: "Create a table **`watchlist`** with:\n\n* `id` — integer, auto‑generated, primary key\n* `title` — text, required\n* `added_on` — date, defaults to today\n* `watched` — boolean, defaults to false",
        hint: 'integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, NOT NULL, DEFAULT CURRENT_DATE, DEFAULT false',
        setup: `DROP TABLE IF EXISTS playground.watchlist CASCADE;`,
        solution: `CREATE TABLE watchlist (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL, added_on date DEFAULT CURRENT_DATE, watched boolean DEFAULT false)`,
        verify: COLS_AND_CONSTRAINTS('watchlist'),
      },
      {
        id: 'ddl-2', kind: 'ddl', title: 'Film reviews with rules',
        prompt: "Create a table **`reviews`** with:\n\n* `review_id` — integer, auto‑generated, primary key\n* `film_id` — integer, required, must reference `film(film_id)`\n* `stars` — integer, required, must be between 1 and 5 (CHECK)\n* `body` — text (optional)\n* `created_at` — timestamptz, defaults to now()",
        hint: 'film_id integer NOT NULL REFERENCES film(film_id), stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5)',
        setup: `DROP TABLE IF EXISTS playground.reviews CASCADE;`,
        solution: `CREATE TABLE reviews (review_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, film_id integer NOT NULL REFERENCES film(film_id), stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5), body text, created_at timestamptz DEFAULT now())`,
        verify: COLS_AND_CONSTRAINTS('reviews'),
      },
      {
        id: 'ddl-3', kind: 'ddl', title: 'Renovate the members table',
        prompt: "A table `members (id integer PRIMARY KEY, name text, phone text)` already exists (click **⚙ Prepare tables** to create it). Change it so that:\n\n1. `name` is renamed to `full_name`\n2. a new column `email` (text) exists and must be **unique**\n3. the `phone` column is gone",
        hint: 'Three ALTER TABLE statements (or one with commas): RENAME COLUMN, ADD COLUMN … UNIQUE, DROP COLUMN',
        setup: `DROP TABLE IF EXISTS playground.members CASCADE; CREATE TABLE playground.members (id integer PRIMARY KEY, name text, phone text);`,
        solution: `ALTER TABLE members RENAME COLUMN name TO full_name; ALTER TABLE members ADD COLUMN email text UNIQUE; ALTER TABLE members DROP COLUMN phone;`,
        verify: COLS_AND_CONSTRAINTS('members'),
      },
      {
        id: 'ddl-4', kind: 'ddl', title: 'Table from a query',
        prompt: 'Create a table **`long_films`** containing `film_id, title, length` of every film **longer than 180** minutes — in one statement.',
        hint: 'CREATE TABLE … AS SELECT …',
        setup: `DROP TABLE IF EXISTS playground.long_films CASCADE;`,
        solution: `CREATE TABLE long_films AS SELECT film_id, title, length FROM film WHERE length > 180`,
        verify: `SELECT * FROM playground.long_films`,
      },
      {
        id: 'ddl-5', kind: 'ddl', title: 'Lists of films (two related tables)',
        prompt: "Create two tables:\n\n* **`lists`**: `list_id` integer auto‑generated primary key, `name` text required and **unique**\n* **`list_items`**: `list_id` integer referencing `lists` with **ON DELETE CASCADE**, `film_id` integer referencing `film`, and a **composite primary key** on (`list_id`, `film_id`)",
        hint: 'Create lists first. In list_items: PRIMARY KEY (list_id, film_id) as a table constraint.',
        setup: `DROP TABLE IF EXISTS playground.list_items, playground.lists CASCADE;`,
        solution: `CREATE TABLE lists (list_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL UNIQUE); CREATE TABLE list_items (list_id integer REFERENCES lists(list_id) ON DELETE CASCADE, film_id integer REFERENCES film(film_id), PRIMARY KEY (list_id, film_id));`,
        verify: `SELECT conrelid::regclass::text AS tbl, contype::text, COALESCE(NULLIF(confrelid, 0)::regclass::text, '') AS refs, confdeltype::text AS on_delete, array_length(conkey, 1) AS ncols FROM pg_constraint WHERE conrelid IN ('playground.lists'::regclass, 'playground.list_items'::regclass) AND contype IN ('p','f','u')
UNION ALL SELECT table_name::text, column_name::text, data_type::text, is_nullable::text, 0 FROM information_schema.columns WHERE table_schema = 'playground' AND table_name IN ('lists','list_items')`,
      },
    ],
  },
  // ───────────────────────────── 11
  {
    id: 'modifying', icon: '✏️', title: 'INSERT, UPDATE, DELETE & UPSERT',
    summary: 'Changing data safely: INSERT, UPDATE, DELETE, RETURNING, ON CONFLICT, transactions.',
    lesson: md('11-modifying.md'),
    challenges: [
      {
        id: 'dml-1', kind: 'ddl', title: 'Add a film',
        prompt: "Insert into `my_films` a film with `film_id` **1001**, title **POSTGRES PARTY**, rating **PG-13**, rental_rate **2.99**, length **95**.",
        hint: 'INSERT INTO my_films (cols…) VALUES (…)',
        setup: MY_FILMS,
        solution: `INSERT INTO my_films (film_id, title, rating, rental_rate, length) VALUES (1001, 'POSTGRES PARTY', 'PG-13', 2.99, 95)`,
        verify: `SELECT * FROM playground.my_films WHERE film_id > 1000 UNION ALL SELECT count(*), 'total rows', NULL, NULL, NULL FROM playground.my_films`,
      },
      {
        id: 'dml-2', kind: 'ddl', title: 'Price hike for R',
        prompt: "In `my_films`, raise the `rental_rate` by **1.00** for every film rated **R** (and only those).",
        hint: "UPDATE … SET rental_rate = rental_rate + 1 WHERE …",
        setup: MY_FILMS,
        solution: `UPDATE my_films SET rental_rate = rental_rate + 1 WHERE rating = 'R'`,
        verify: `SELECT rating, SUM(rental_rate) AS total_rate, COUNT(*) FROM playground.my_films GROUP BY rating`,
      },
      {
        id: 'dml-3', kind: 'ddl', title: 'Half price for epics',
        prompt: 'In `my_films`, cut the `rental_rate` **in half** for films **longer than 150** minutes.',
        hint: 'SET rental_rate = rental_rate / 2',
        setup: MY_FILMS,
        solution: `UPDATE my_films SET rental_rate = rental_rate / 2 WHERE length > 150`,
        verify: `SELECT film_id, rental_rate FROM playground.my_films`,
      },
      {
        id: 'dml-4', kind: 'ddl', title: 'Clear out the shorts',
        prompt: 'Delete every film shorter than **50** minutes from `my_films`.',
        hint: 'DELETE FROM … WHERE …',
        setup: MY_FILMS,
        solution: `DELETE FROM my_films WHERE length < 50`,
        verify: `SELECT COUNT(*) AS films_left, MIN(length) AS shortest FROM playground.my_films`,
      },
      {
        id: 'dml-5', kind: 'ddl', title: 'Upsert the stock',
        prompt: "Table `film_stock (film_id PRIMARY KEY, copies)` currently holds `(1, 3)` and `(2, 5)`. In **one statement**, add **4 copies of film 1** and **2 copies of film 7**: new films get a new row, existing films get the copies **added** to what's there.",
        hint: 'INSERT … ON CONFLICT (film_id) DO UPDATE SET copies = film_stock.copies + EXCLUDED.copies',
        setup: `DROP TABLE IF EXISTS playground.film_stock; CREATE TABLE playground.film_stock (film_id integer PRIMARY KEY, copies integer NOT NULL); INSERT INTO playground.film_stock VALUES (1, 3), (2, 5);`,
        solution: `INSERT INTO film_stock (film_id, copies) VALUES (1, 4), (7, 2) ON CONFLICT (film_id) DO UPDATE SET copies = film_stock.copies + EXCLUDED.copies`,
        verify: `SELECT * FROM playground.film_stock`,
      },
      {
        id: 'dml-6', kind: 'ddl', title: 'Fill the VIP table',
        prompt: "An empty table `vip (customer_id PRIMARY KEY, full_name text, total_paid numeric(8,2))` exists. Fill it with every customer who paid **more than 300** in total. `full_name` = first name, a space, last name (as stored, e.g. `KARL SEAL`).",
        hint: 'INSERT INTO vip (…) SELECT … FROM customer JOIN payment … GROUP BY … HAVING …',
        setup: `DROP TABLE IF EXISTS playground.vip; CREATE TABLE playground.vip (customer_id integer PRIMARY KEY, full_name text NOT NULL, total_paid numeric(8,2) NOT NULL);`,
        solution: `INSERT INTO vip (customer_id, full_name, total_paid) SELECT c.customer_id, c.first_name || ' ' || c.last_name, SUM(p.amount) FROM customer c JOIN payment p ON p.customer_id = c.customer_id GROUP BY c.customer_id HAVING SUM(p.amount) > 300`,
        verify: `SELECT * FROM playground.vip`,
      },
    ],
  },
  // ───────────────────────────── 12
  {
    id: 'superpowers', icon: '🐘', title: 'Postgres superpowers',
    summary: 'DISTINCT ON, arrays, string_agg, generate_series, JSONB and full-text search.',
    lesson: md('12-superpowers.md'),
    challenges: [
      { id: 'pg-1', title: 'Behind the scenes', prompt: "Return the `title` of films whose `special_features` array contains **Behind the Scenes**.", hint: "'Behind the Scenes' = ANY(special_features)", solution: `SELECT title FROM film WHERE 'Behind the Scenes' = ANY(special_features)` },
      { id: 'pg-2', title: 'Feature popularity', prompt: 'Return `feature` and `films` — for each special feature, how many films have it.', hint: 'unnest(special_features) in a subquery or CTE, then GROUP BY', solution: `SELECT feature, COUNT(*) AS films FROM (SELECT unnest(special_features) AS feature FROM film) s GROUP BY feature` },
      { id: 'pg-3', title: 'Latest rental per customer', ordered: true, prompt: "Return `customer_id` and `rental_date` of **each customer's most recent rental**, ordered by customer_id.", hint: 'DISTINCT ON (customer_id) … ORDER BY customer_id, rental_date DESC', solution: `SELECT DISTINCT ON (customer_id) customer_id, rental_date FROM rental ORDER BY customer_id, rental_date DESC` },
      { id: 'pg-4', title: 'Cast lists', prompt: "For films with `film_id` **1 to 5**, return `title` and `actors`: one string with the cast as `FIRST LAST`, sorted by last name then first name, separated by `, ` (comma + space).", hint: "string_agg(a.first_name || ' ' || a.last_name, ', ' ORDER BY a.last_name, a.first_name)", solution: `SELECT f.title, string_agg(a.first_name || ' ' || a.last_name, ', ' ORDER BY a.last_name, a.first_name) AS actors FROM film f JOIN film_actor fa ON fa.film_id = f.film_id JOIN actor a ON a.actor_id = fa.actor_id WHERE f.film_id BETWEEN 1 AND 5 GROUP BY f.film_id, f.title` },
      { id: 'pg-5', title: 'Calendar with gaps', ordered: true, prompt: "Return `day` (date) and `rentals` for **every day from 2022‑05‑24 to 2022‑06‑02** — including days with **0** rentals.", hint: "generate_series('2022-05-24'::date, '2022-06-02', '1 day') LEFT JOIN rental ON rental_date::date = day", solution: `SELECT d::date AS day, COUNT(r.rental_id) AS rentals FROM generate_series('2022-05-24'::date, '2022-06-02'::date, INTERVAL '1 day') d LEFT JOIN rental r ON r.rental_date::date = d::date GROUP BY 1 ORDER BY 1` },
      { id: 'pg-6', title: 'Astronauts on boats', prompt: "Using the `fulltext` column, return the `title` of films whose description mentions both an **astronaut** and a **boat**.", hint: "fulltext @@ to_tsquery('astronaut & boat')", solution: `SELECT title FROM film WHERE fulltext @@ to_tsquery('english', 'astronaut & boat')` },
      {
        id: 'pg-7', title: 'Digging into JSON',
        prompt: "A table `events (id int, payload jsonb)` holds app events (click **⚙ Prepare tables**, then `SELECT * FROM events`). Return `id`, `username` (the `user` field as text) and `amount` (as a number) for events whose `type` is **purchase** and amount is **greater than 20**.",
        hint: "payload->>'type' = 'purchase' AND (payload->>'amount')::numeric > 20",
        setup: `DROP TABLE IF EXISTS playground.events; CREATE TABLE playground.events (id int, payload jsonb); INSERT INTO playground.events VALUES
 (1, '{"type":"login","user":"mona"}'),
 (2, '{"type":"purchase","user":"mona","amount":15.5,"items":["dvd"]}'),
 (3, '{"type":"purchase","user":"karim","amount":42,"items":["dvd","popcorn"]}'),
 (4, '{"type":"logout","user":"karim"}'),
 (5, '{"type":"purchase","user":"sara","amount":20}'),
 (6, '{"type":"purchase","user":"omar","amount":99.99,"items":["box set"]}'),
 (7, '{"type":"refund","user":"karim","amount":42}');`,
        solution: `SELECT id, payload->>'user' AS username, (payload->>'amount')::numeric AS amount FROM events WHERE payload->>'type' = 'purchase' AND (payload->>'amount')::numeric > 20`,
      },
    ],
  },
  // ───────────────────────────── 13
  {
    id: 'performance', icon: '⚡', title: 'Views, indexes & EXPLAIN',
    summary: 'Views and materialized views, reading query plans, and when indexes help.',
    lesson: md('13-performance.md'),
    challenges: [
      {
        id: 'perf-1', kind: 'ddl', title: 'A view of totals',
        prompt: 'Create a view **`customer_totals`** with columns `customer_id` and `total_paid` (sum of that customer\'s payments).',
        hint: 'CREATE VIEW … AS SELECT … GROUP BY',
        setup: `DROP VIEW IF EXISTS playground.customer_totals CASCADE;`,
        solution: `CREATE VIEW customer_totals AS SELECT customer_id, SUM(amount) AS total_paid FROM payment GROUP BY customer_id`,
        verify: `SELECT * FROM playground.customer_totals`,
      },
      {
        id: 'perf-2', kind: 'ddl', title: 'Materialize it',
        prompt: 'Create a **materialized view** `monthly_revenue` with `month` (first day of month, as a **date**) and `revenue` (sum of payments) for every month in the data.',
        hint: "CREATE MATERIALIZED VIEW … AS SELECT DATE_TRUNC('month', payment_date)::date …",
        setup: `DROP MATERIALIZED VIEW IF EXISTS playground.monthly_revenue CASCADE;`,
        solution: `CREATE MATERIALIZED VIEW monthly_revenue AS SELECT DATE_TRUNC('month', payment_date)::date AS month, SUM(amount) AS revenue FROM payment GROUP BY 1`,
        verify: `SELECT month, revenue FROM playground.monthly_revenue`,
      },
      {
        id: 'perf-3', kind: 'ddl', title: 'Index the lookups',
        prompt: "`rentals_copy` is a copy of `rental` with **no indexes** (click **⚙ Prepare tables**). Queries like `WHERE customer_id = 5` are slow. Create a **B‑tree index** on `customer_id`. Bonus: compare `EXPLAIN ANALYZE` before and after.",
        hint: 'CREATE INDEX some_name ON rentals_copy (customer_id)',
        setup: `DROP TABLE IF EXISTS playground.rentals_copy; CREATE TABLE playground.rentals_copy AS SELECT * FROM public.rental;`,
        solution: `CREATE INDEX rentals_copy_customer_idx ON rentals_copy (customer_id)`,
        verify: INDEX_COLS('rentals_copy'),
      },
      {
        id: 'perf-4', kind: 'ddl', title: 'The right composite index',
        prompt: "The app runs this query constantly:\n\n```sql\nSELECT * FROM rentals_copy WHERE customer_id = 42 ORDER BY rental_date DESC LIMIT 5;\n```\n\nCreate **one** index on `rentals_copy` that lets Postgres both find the customer *and* read their rentals already sorted by date.",
        hint: 'A two-column index — which column goes first?',
        setup: `DROP TABLE IF EXISTS playground.rentals_copy; CREATE TABLE playground.rentals_copy AS SELECT * FROM public.rental;`,
        solution: `CREATE INDEX ON rentals_copy (customer_id, rental_date)`,
        verify: INDEX_COLS('rentals_copy'),
      },
    ],
  },
];
