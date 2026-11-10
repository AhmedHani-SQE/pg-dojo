// PG Dojo — local server: runs your SQL against Pagila, checks challenges, talks to Groq.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
const chapters = require('./chapters');

// Keep dates/timestamps as the strings Postgres prints (no JS timezone surprises)
[1082, 1083, 1114, 1184, 1266, 1186].forEach(oid => types.setTypeParser(oid, v => v));

const PORT = Number(process.env.PORT || 3777);

// ---------- config (Groq key + DB settings live here; never sent to the browser) ----------
const CONFIG_PATH = path.join(__dirname, 'config.json');
function readConfigFile() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^﻿/, '')); } catch { return {}; }
}
function loadConfig() {
  const c = readConfigFile();
  return { groqApiKey: process.env.GROQ_API_KEY || c.groqApiKey || '', groqModel: c.groqModel || 'openai/gpt-oss-120b' };
}
function saveConfig(c) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2)); }

// Database settings: written by setup.ps1, all optional
const pgCfg = {
  host: 'localhost', port: 5432, adminUser: 'postgres', adminPassword: 'postgres', root: '',
  ...(readConfigFile().pg || {}),
};
const PG = { host: pgCfg.host, port: Number(pgCfg.port), database: 'pagila' };
const learner = new Pool({ ...PG, user: 'learner', password: 'learner', max: 6 });
const admin = new Pool({ ...PG, user: pgCfg.adminUser, password: pgCfg.adminPassword, max: 2 });
learner.on('error', () => {});
admin.on('error', () => {});

// If Postgres isn't up and we know where the portable install lives, start it.
async function ensurePostgres() {
  try { await learner.query('SELECT 1'); return true; } catch (e) {
    if (!pgCfg.root || e.code === '28P01' || e.code === '3D000') {
      console.error(`Can't connect to PostgreSQL at ${PG.host}:${PG.port} - ${e.message}\nRun setup.ps1 first (see README).`);
      return false;
    }
  }
  const pgCtl = path.join(pgCfg.root, 'pgsql', 'bin', process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
  console.log('Starting PostgreSQL...');
  // detached + ignored stdio: the database keeps running on its own and never holds our console/pipes
  const code = await new Promise(resolve => {
    const p = require('child_process').spawn(pgCtl,
      ['-D', path.join(pgCfg.root, 'data'), '-l', path.join(pgCfg.root, 'pg.log'), '-o', `-p ${PG.port}`, '-w', 'start'],
      { stdio: 'ignore', detached: true, windowsHide: true });
    p.on('error', e => { console.error('Could not run pg_ctl: ' + e.message); resolve(-1); });
    p.on('exit', resolve);
  });
  if (code !== 0) { console.error(`PostgreSQL did not start - see ${path.join(pgCfg.root, 'pg.log')}`); return false; }
  try { await learner.query('SELECT 1'); console.log('PostgreSQL is up.'); return true; } catch (e) { console.error(e.message); return false; }
}

// ---------- challenge index ----------
const challengeIndex = {};
for (const ch of chapters) for (const c of ch.challenges || []) challengeIndex[c.id] = { ...c, chapter: ch };

// ---------- SQL helpers ----------
const MAX_ROWS_SENT = 500;

function pgError(e) {
  return { message: e.message, hint: e.hint || null, detail: e.detail || null, position: e.position ? Number(e.position) : null, code: e.code || null };
}

function shape(res) {
  const arr = Array.isArray(res) ? res : [res];
  const statements = arr.map(r => ({ command: r.command, rowCount: r.rowCount }));
  let last = null;
  for (const r of arr) if (r.fields && r.fields.length) last = r;
  if (!last) return { statements, columns: [], rows: [], totalRows: 0 };
  return {
    statements,
    columns: last.fields.map(f => f.name),
    rows: last.rows,
    totalRows: last.rows.length,
  };
}

async function withClient(pool, fn) {
  const client = await pool.connect();
  try { return await fn(client); }
  finally {
    try { await client.query('ROLLBACK'); } catch {}
    try { await client.query('DISCARD ALL'); } catch {}
    client.release();
  }
}

const q = (client, text) => client.query({ text, rowMode: 'array' });

// Run something inside a transaction that is always rolled back.
async function sandboxed(setup, sql, verify) {
  return withClient(learner, async client => {
    await client.query('BEGIN');
    if (setup) await q(client, setup);
    let out = shape(await q(client, sql));
    if (verify) out = shape(await q(client, verify));
    return out;
  });
}

// ---------- result comparison ----------
function norm(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return String(Math.round(v * 10000) / 10000);
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (Array.isArray(v)) return JSON.stringify(v.map(norm));
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(Math.round(Number(s) * 10000) / 10000);
  return s;
}
const rowKey = r => JSON.stringify(r.map(norm));

function sameRows(exp, got, ordered) {
  if (exp.length !== got.length) return false;
  const a = exp.map(rowKey), b = got.map(rowKey);
  if (!ordered) { a.sort(); b.sort(); }
  return a.every((x, i) => x === b[i]);
}

// Try to line up the user's columns with the expected ones (if they're in a different order)
function reorderColumns(exp, got) {
  const ncol = exp.columns.length;
  if (got.columns.length !== ncol) return null;
  const sig = (rows, i) => JSON.stringify(rows.map(r => norm(r[i])).sort());
  const used = new Set(), map = [];
  for (let i = 0; i < ncol; i++) {
    const s = sig(exp.rows, i);
    let found = -1;
    for (let j = 0; j < ncol; j++) if (!used.has(j) && sig(got.rows, j) === s) { found = j; break; }
    if (found < 0) return null;
    used.add(found); map.push(found);
  }
  return { columns: map.map(j => got.columns[j]), rows: got.rows.map(r => map.map(j => r[j])) };
}

function compare(exp, got, ordered) {
  if (sameRows(exp.rows, got.rows, ordered) && exp.columns.length === got.columns.length)
    return { correct: true, message: 'Correct! Your result matches exactly.' };
  const re = reorderColumns(exp, got);
  if (re && sameRows(exp.rows, re.rows, ordered))
    return { correct: true, message: 'Correct! (Your columns are in a different order than asked, but the data is right.)' };

  const notes = [];
  if (got.columns.length !== exp.columns.length)
    notes.push(`Expected ${exp.columns.length} column(s), you returned ${got.columns.length}.`);
  if (got.rows.length !== exp.rows.length)
    notes.push(`Expected ${exp.rows.length} row(s), you returned ${got.rows.length}.`);
  if (!notes.length) {
    if (ordered && sameRows(exp.rows, got.rows, false)) notes.push('Right rows, wrong order — check your ORDER BY.');
    else {
      const expSet = new Set(exp.rows.map(rowKey));
      const wrong = got.rows.filter(r => !expSet.has(rowKey(r))).length;
      notes.push(`Same shape, but ${wrong} of your rows don't match the expected data.`);
    }
  }
  return { correct: false, message: 'Not quite. ' + notes.join(' ') };
}

const expectedCache = {};
async function expectedFor(c) {
  if (!expectedCache[c.id]) expectedCache[c.id] = await sandboxed(c.setup, c.solution, c.verify);
  return expectedCache[c.id];
}

// ---------- Groq ----------
async function groq(messages) {
  const { groqApiKey, groqModel } = loadConfig();
  if (!groqApiKey) throw new Error('No Groq API key yet — click the ⚙ AI settings button and paste it in.');
  const body = { model: groqModel, messages, temperature: 0.4, max_completion_tokens: 2048 };
  if (groqModel.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Groq error ${r.status}: ${data.error?.message || r.statusText}`);
  return data.choices?.[0]?.message?.content?.trim() || '(empty reply)';
}

const TUTOR_SYSTEM = `You are a friendly, sharp PostgreSQL tutor inside "PG Dojo", a local app where the student practices SQL on the Pagila sample database (a DVD rental store: film, actor, film_actor, category, film_category, language, inventory, rental, payment, customer, address, city, country, staff, store).
The student learned SQL long ago and is refreshing it while learning PostgreSQL specifically. They are casual; you can be too (light humor is fine), but be precise.
Rules:
- Keep answers short and focused. Use markdown and \`\`\`sql code blocks.
- When a reference solution is provided, NEVER paste it or a near-copy unless the student explicitly asks for the answer/solution. Prefer hints, pointing at the exact part of their query that is wrong, and asking a guiding question.
- Point out PostgreSQL-specific details when relevant (ILIKE, ::casts, DISTINCT ON, FILTER, RETURNING, etc.).
- The student's tables live in the "playground" schema; Pagila tables in "public" are read-only for them.`;

function challengeContext(c) {
  if (!c) return '';
  return `\n\nCURRENT CHALLENGE (chapter "${c.chapter.title}"): ${c.title}\nTask: ${c.prompt}\n${c.ordered ? 'Row order matters.\n' : ''}${c.setup ? `Setup that runs first: ${c.setup}\n` : ''}${c.verify ? `Checked by running afterwards: ${c.verify}\n` : ''}Reference solution (secret, do not reveal unless asked): ${c.solution}`;
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
  });
}

const routes = {
  'GET /api/chapters': async () => chapters.map(ch => ({
    id: ch.id, title: ch.title, icon: ch.icon, summary: ch.summary, lesson: ch.lesson,
    challenges: (ch.challenges || []).map(c => ({ id: c.id, title: c.title, prompt: c.prompt, hint: c.hint, kind: c.kind || 'query', ordered: !!c.ordered, setup: c.setup || '' })),
  })),

  'GET /api/schema': async () => withClient(learner, async client => {
    const r = await client.query(`
      SELECT c.table_schema, c.table_name, c.column_name, c.data_type, t.table_type
      FROM information_schema.columns c
      JOIN information_schema.tables t USING (table_schema, table_name)
      JOIN pg_class pc ON pc.relname = c.table_name
      JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = c.table_schema
      WHERE c.table_schema IN ('public','playground') AND NOT pc.relispartition
      ORDER BY c.table_schema DESC, t.table_type, c.table_name, c.ordinal_position`);
    const out = {};
    for (const row of r.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      out[key] ||= { schema: row.table_schema, name: row.table_name, view: row.table_type === 'VIEW', columns: [] };
      out[key].columns.push({ name: row.column_name, type: row.data_type });
    }
    return Object.values(out);
  }),

  'POST /api/run': async body => {
    const sql = String(body.sql || '').trim();
    if (!sql) return { error: { message: 'Write some SQL first 🙂' } };
    const t0 = Date.now();
    try {
      const out = await withClient(learner, client => q(client, sql).then(shape));
      out.ms = Date.now() - t0;
      out.truncated = out.rows.length > MAX_ROWS_SENT;
      out.rows = out.rows.slice(0, MAX_ROWS_SENT);
      return out;
    } catch (e) { return { error: pgError(e) }; }
  },

  'POST /api/check': async body => {
    const c = challengeIndex[body.id];
    if (!c) return { error: { message: 'Unknown challenge' } };
    const sql = String(body.sql || '').trim();
    if (!sql) return { error: { message: 'Write your answer in the editor first.' } };
    let exp;
    try { exp = await expectedFor(c); }
    catch (e) { return { error: { message: 'Internal: reference solution failed: ' + e.message } }; }
    let got;
    try { got = await sandboxed(c.setup, sql, c.verify); }
    catch (e) { return { correct: false, message: 'Your SQL raised an error.', error: pgError(e) }; }
    const verdict = compare(exp, got, c.ordered);
    if (c.verify && !verdict.correct)
      verdict.message = "Not quite — I inspected your table(s) afterwards and they don't match the spec yet. Hit \"Compare with expected\" to see the difference.";
    return { ...verdict, result: { columns: got.columns, rows: got.rows.slice(0, MAX_ROWS_SENT), totalRows: got.rows.length, truncated: got.rows.length > MAX_ROWS_SENT }, verified: !!c.verify };
  },

  'POST /api/expected': async body => {
    const c = challengeIndex[body.id];
    if (!c) return { error: { message: 'Unknown challenge' } };
    const exp = await expectedFor(c);
    return { columns: exp.columns, rows: exp.rows.slice(0, MAX_ROWS_SENT), totalRows: exp.rows.length, truncated: exp.rows.length > MAX_ROWS_SENT, verify: c.verify || null };
  },

  'POST /api/solution': async body => {
    const c = challengeIndex[body.id];
    return c ? { solution: c.solution } : { error: { message: 'Unknown challenge' } };
  },

  'POST /api/reset-playground': async () => {
    await admin.query('DROP SCHEMA IF EXISTS playground CASCADE');
    await admin.query('CREATE SCHEMA playground AUTHORIZATION learner');
    return { ok: true };
  },

  'GET /api/config': async () => { const c = loadConfig(); return { hasKey: !!c.groqApiKey, model: c.groqModel }; },
  'POST /api/config': async body => {
    let c = {};
    try { c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch {}
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) c.groqApiKey = body.apiKey.trim();
    if (body.clearKey) delete c.groqApiKey;
    if (typeof body.model === 'string' && body.model.trim()) c.groqModel = body.model.trim();
    saveConfig(c);
    const now = loadConfig();
    return { hasKey: !!now.groqApiKey, model: now.groqModel };
  },

  'POST /api/ai/review': async body => {
    const c = challengeIndex[body.id];
    const outcome = body.error
      ? `Their SQL raised an error: ${body.error.message}${body.error.hint ? ' (hint: ' + body.error.hint + ')' : ''}`
      : `The automatic checker said: ${body.correct ? 'CORRECT' : 'WRONG'} — "${body.message}"`;
    const messages = [
      { role: 'system', content: TUTOR_SYSTEM + challengeContext(c) },
      { role: 'user', content: `Review my answer.\n\n\`\`\`sql\n${body.sql}\n\`\`\`\n\n${outcome}\n\nStart with a one-line verdict and a score out of 10 for how close I am (10 = correct and clean). Then: if wrong, explain what is off and give a hint (no full solution). If correct, mention one improvement or alternative PostgreSQL way to write it, if there is a meaningful one. Max ~150 words.` },
    ];
    try { return { reply: await groq(messages) }; } catch (e) { return { error: { message: e.message } }; }
  },

  'POST /api/ai/chat': async body => {
    const c = challengeIndex[body.challengeId];
    const ch = chapters.find(x => x.id === body.chapterId);
    let ctx = TUTOR_SYSTEM;
    if (ch) ctx += `\n\nThe student is currently on chapter "${ch.title}" (${ch.summary}).`;
    ctx += challengeContext(c);
    if (body.editorSql) ctx += `\n\nWhat is in their SQL editor right now:\n${body.editorSql}`;
    if (body.lastError) ctx += `\n\nTheir last error: ${body.lastError}`;
    const history = (body.messages || []).slice(-16).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 6000) }));
    try { return { reply: await groq([{ role: 'system', content: ctx }, ...history]) }; }
    catch (e) { return { error: { message: e.message } }; }
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const key = `${req.method} ${url.pathname}`;
  if (routes[key]) {
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      send(res, 200, await routes[key](body));
    } catch (e) { send(res, 500, { error: { message: e.message } }); }
    return;
  }
  let p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.join(__dirname, 'public', path.normalize(p));
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// Tiny self-test mode: node server.js --selftest  -> runs every reference solution
if (process.argv.includes('--selftest')) {
  (async () => {
    let bad = 0;
    for (const c of Object.values(challengeIndex)) {
      try {
        const r = await expectedFor(c);
        console.log(`ok   ${c.id.padEnd(22)} ${r.rows.length} rows  [${r.columns.join(', ')}]`);
        if (!r.rows.length) { console.log('     ^ WARNING: empty result'); }
      } catch (e) { bad++; console.log(`FAIL ${c.id}: ${e.message}`); }
    }
    console.log(bad ? `${bad} failing` : 'all reference solutions run');
    process.exit(bad ? 1 : 0);
  })();
} else {
  ensurePostgres().then(ok => {
    if (!ok) console.error('Starting the web app anyway - queries will fail until PostgreSQL is reachable.');
    server.listen(PORT, '127.0.0.1', () => {
      const url = `http://localhost:${PORT}`;
      console.log(`PG Dojo running -> ${url}  (Ctrl+C or close this window to stop)`);
      if (process.argv.includes('--open')) {
        const cmd = process.platform === 'win32' ? `start "" ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
        require('child_process').exec(cmd);
      }
    });
    server.on('error', e => {
      if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is busy - PG Dojo is probably already running. Open ${`http://localhost:${PORT}`}`);
      else console.error(e);
      process.exit(1);
    });
  });
}
