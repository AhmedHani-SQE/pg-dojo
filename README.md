# PG Dojo 🐘

An interactive PostgreSQL course that runs on your own machine.
**13 chapters · 79 auto‑checked challenges · an AI tutor (Groq)**, all on the [Pagila](https://github.com/devrimgunduz/pagila) sample database (a DVD rental store: films, actors, customers, rentals, payments).

Each chapter has a **lesson** (explanations + runnable examples) and **challenges** ("find me all PG‑13 films longer than 150 minutes…"). You write SQL, hit **Check**, and the app compares your result with the reference answer. It tells you what's off (row count, wrong order, error position…), and the AI tutor gives you a score and hints and answers follow‑up questions.

| # | Chapter |
|---|---|
| 1 | Welcome to Postgres & Pagila |
| 2 | SELECT, sorting & limiting |
| 3 | Filtering with WHERE (and NULL) |
| 4 | Functions, CASE & NULL handling |
| 5 | Aggregation & GROUP BY (+ FILTER) |
| 6 | Dates & times |
| 7 | Joins |
| 8 | Subqueries, CTEs & set operations |
| 9 | Window functions |
| 10 | Creating tables & constraints |
| 11 | INSERT, UPDATE, DELETE & UPSERT |
| 12 | Postgres superpowers (arrays, JSONB, DISTINCT ON, full‑text search) |
| 13 | Views, indexes & EXPLAIN |

---

## Setup (Windows) — about 5 minutes

**You need:** [Git](https://git-scm.com/download/win) and [Node.js LTS](https://nodejs.org) (v18 or newer). You do **not** need PostgreSQL or admin rights — the setup script downloads a portable copy.

```powershell
git clone https://github.com/AhmedHani-SQE/pg-dojo.git
cd pg-dojo
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

The script:
1. downloads portable **PostgreSQL 18.6** into `C:\pgdojo-postgres` (~380 MB),
2. creates a database cluster and starts it on port **5432**,
3. downloads and loads the **Pagila** database,
4. creates a restricted `learner` user (can read Pagila, can't break it, owns a `playground` schema for your own tables),
5. writes `config.json` and runs `npm install`.

It's safe to run again — finished steps are skipped.

**Then start the app:** double‑click **`start.bat`** (or run `node server.js --open`). It starts PostgreSQL if needed and opens http://localhost:3777.

### Setup options

| Situation | Command |
|---|---|
| Install somewhere else | `.\setup.ps1 -PgRoot "D:\tools\postgres"` |
| Port 5432 already used (another Postgres running) | `.\setup.ps1 -Port 5433` |
| You **already have PostgreSQL installed** (e.g. EDB installer) | `.\setup.ps1 -ExistingPgBin "C:\Program Files\PostgreSQL\17\bin" -AdminPassword "<your postgres password>"` |

(Prefix each with `powershell -ExecutionPolicy Bypass -File`.)

### macOS / Linux

There's no setup script yet, but it's four commands once you have PostgreSQL (`brew install postgresql@18` / `sudo apt install postgresql`) and Node:

```bash
curl -LO https://raw.githubusercontent.com/devrimgunduz/pagila/6ea53f812254c91a602f61c0ef62beca3fa676b1/pagila-schema.sql
curl -LO https://raw.githubusercontent.com/devrimgunduz/pagila/6ea53f812254c91a602f61c0ef62beca3fa676b1/pagila-data.sql
createdb pagila && psql -d pagila -q -f pagila-schema.sql && psql -d pagila -q -f pagila-data.sql
psql -d pagila -f db/learner.sql && npm install && node server.js --open
```

(Errors mentioning `vector` / `film_embedding` are expected — that optional table needs the pgvector extension and isn't used.) If your superuser isn't `postgres`/`postgres`, create `config.json` with:
`{ "pg": { "host": "localhost", "port": 5432, "adminUser": "<you>", "adminPassword": "<pw>" } }`

---

## Connect the AI tutor (Groq — free)

The app works without AI (checking is automatic), but the tutor is the fun part: it scores each attempt out of 10, explains what's wrong without spoiling the answer, and you can chat with it about anything SQL.

1. Go to **[console.groq.com](https://console.groq.com)** and sign up (Google, GitHub or email — free, no credit card).
2. In the left menu open **API Keys** → **Create API Key** → give it a name (e.g. `pg-dojo`) → **Submit**.
3. **Copy the key now** (starts with `gsk_…`) — Groq only shows it once.
4. In PG Dojo click **⚙ AI settings** (top right), paste the key, choose a model, click **Save**.
5. Solve something and hit **Check** — the 🤖 review appears under the result. Click **🤖 Ask AI** to open the chat.

| Model | Notes |
|---|---|
| `openai/gpt-oss-120b` | default — smartest explanations |
| `openai/gpt-oss-20b` | faster, a bit less sharp |
| `llama-3.3-70b-versatile` / `llama-3.1-8b-instant` | alternatives if you hit rate limits |

**Where the key is stored:** only in `config.json` next to `server.js`, on your machine. The browser never sees it, and `.gitignore` keeps it out of git — **never commit or share that file**. You can also set it as an environment variable instead: `setx GROQ_API_KEY gsk_...`.

**"Groq error 429"** = free‑tier rate limit; wait a minute or switch to a smaller model. **"401"** = key typo or revoked — create a new one.

---

## Using the app

* **▶ Run** (`Ctrl+Enter`) runs whatever is in the editor. **✔ Check** (`Ctrl+Shift+Enter`) grades it against the current challenge.
* Column names don't matter when checking; values do. Row order only matters when the challenge says *"order matters"*.
* **💡 Hint**, **👀 Expected output**, **🔑 Solution** (if you're really stuck), **⚙ Prepare tables** (for challenges that work on playground tables).
* **🗂 Schema** lists every table and column; click a column name to insert it.
* **♻ Reset playground** drops everything you created. Pagila itself is read‑only for the app, so you can't damage it.
* Progress and drafts are saved in your browser.

## Connect other tools (optional)

The database is a normal PostgreSQL server, so DBeaver, pgAdmin, DataGrip or VS Code can connect too:

| | |
|---|---|
| Host / port | `localhost` / `5432` |
| Database | `pagila` |
| Superuser | `postgres` / `postgres` (or the `-AdminPassword` you chose) |
| App user | `learner` / `learner` |

psql: `C:\pgdojo-postgres\pgsql\bin\psql.exe -U postgres -h localhost -d pagila`
Stop PostgreSQL: `C:\pgdojo-postgres\pgsql\bin\pg_ctl.exe -D C:\pgdojo-postgres\data stop`

> These passwords are fine for a local learning database that only listens on localhost. Don't reuse them anywhere real.

## Project layout

```
server.js        local web server: runs SQL, checks answers, talks to Groq
chapters.js      chapters + challenges + reference solutions
lessons/*.md     lesson text
public/          the web UI (HTML/CSS/JS)
db/learner.sql   restricted user + playground schema
setup.ps1        one-shot Windows setup
start.bat        launcher
```

`node server.js --selftest` runs every reference solution against the database.

Adding a challenge = add an object to `chapters.js` (`id`, `title`, `prompt`, `hint`, `solution`, optional `ordered`, `setup`, `verify`). The checker compares the student's result with the result of `solution`.
