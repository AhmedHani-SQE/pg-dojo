## Time is a data type

| type | example | notes |
|---|---|---|
| `date` | `2024-03-15` | just a day |
| `time` | `14:30:00` | time of day |
| `timestamp` | `2024-03-15 14:30:00` | no time zone |
| `timestamptz` | `2024-03-15 14:30:00+02` | **with time zone** — the recommended one; Pagila uses it |
| `interval` | `3 days 04:00:00` | a duration |

Your server's time zone is `Africa/Cairo`, so timestamps display with `+02` / `+03`.

### Now

```sql
SELECT NOW(), CURRENT_DATE, CURRENT_TIMESTAMP;
```

### Converting and comparing

```sql
SELECT rental_date,
       rental_date::date AS day        -- drop the time part
FROM rental LIMIT 3;
```

```sql
-- all rentals during March 2023 — the clean way (half-open range)
SELECT COUNT(*) FROM rental
WHERE rental_date >= '2023-03-01' AND rental_date < '2023-04-01';
```

> 💡 Prefer `>= start AND < next_start` over `BETWEEN` for timestamps — `BETWEEN '2023-03-01' AND '2023-03-31'` silently misses everything after midnight on the 31st.

### Interval arithmetic

```sql
SELECT rental_date,
       return_date,
       return_date - rental_date        AS kept_for,     -- an interval
       rental_date + INTERVAL '7 days'  AS due_back,
       AGE(return_date, rental_date)    AS age_style
FROM rental
WHERE return_date IS NOT NULL
LIMIT 5;
```

Subtracting two `date`s gives an **integer** (days); subtracting two timestamps gives an **interval**. You can compare intervals: `WHERE return_date - rental_date > INTERVAL '5 days'`.

### Pulling parts out: EXTRACT and DATE_TRUNC

```sql
SELECT EXTRACT(YEAR  FROM payment_date) AS yr,
       EXTRACT(MONTH FROM payment_date) AS mon,
       EXTRACT(DOW   FROM payment_date) AS weekday,   -- 0 = Sunday
       DATE_TRUNC('month', payment_date) AS month_start
FROM payment LIMIT 3;
```

`DATE_TRUNC` is the king of reporting — round every timestamp down to its month/week/day, then GROUP BY it:

```sql
SELECT DATE_TRUNC('month', payment_date)::date AS month,
       SUM(amount) AS revenue
FROM payment
GROUP BY 1          -- "1" = the first SELECT column
ORDER BY 1;
```

### Formatting: TO_CHAR

```sql
SELECT TO_CHAR(rental_date, 'YYYY-MM-DD')      AS iso,
       TO_CHAR(rental_date, 'Dy DD Mon YYYY')  AS pretty,
       TO_CHAR(rental_date, 'FMDay')           AS day_name   -- FM = no padding spaces
FROM rental LIMIT 3;
```
