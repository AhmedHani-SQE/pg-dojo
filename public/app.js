// PG Dojo front-end
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem('pgdojo.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pgdojo.' + k, JSON.stringify(v)); } catch {} },
};

const S = {
  chapters: [],
  chapterId: null,
  tab: 'lesson',
  challengeId: null,
  progress: store.get('progress', {}),
  drafts: store.get('drafts', {}),
  chat: store.get('chat', []),
  autoReview: store.get('autoReview', true),
  config: { hasKey: false, model: '' },
  lastError: null,
  openHints: new Set(),
  schema: null,
};

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

const md = text => DOMPurify.sanitize(marked.parse(text || ''));

// ---------- tiny SQL highlighter for lesson code ----------
const KW = 'SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|CROSS|USING|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|UNION|ALL|INTERSECT|EXCEPT|WITH|RECURSIVE|CASE|WHEN|THEN|ELSE|END|BETWEEN|LIKE|ILIKE|EXISTS|ASC|DESC|NULLS|FIRST|LAST|INSERT|INTO|VALUES|UPDATE|SET|DELETE|RETURNING|CREATE|TABLE|VIEW|MATERIALIZED|INDEX|ALTER|ADD|DROP|COLUMN|RENAME|TO|IF|PRIMARY|KEY|REFERENCES|FOREIGN|UNIQUE|CHECK|DEFAULT|CONSTRAINT|CASCADE|GENERATED|ALWAYS|IDENTITY|BEGIN|COMMIT|ROLLBACK|TRUNCATE|CONFLICT|DO|NOTHING|EXPLAIN|ANALYZE|REFRESH|OVER|PARTITION|FILTER|INTERVAL|TRUE|FALSE|ANY|CAST|LATERAL|ROWS|TYPE|DELETE|OF|FOR';
const SQL_RE = new RegExp(`(--[^\\n]*)|('(?:[^']|'')*')|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b(?:${KW})\\b)`, 'gi');
function highlight(code) {
  let out = '', last = 0;
  code.replace(SQL_RE, (m, com, str, num, kw, idx) => {
    out += esc(code.slice(last, idx));
    const cls = com ? 'c' : str ? 's' : num ? 'num' : 'k';
    out += `<span class="${cls}">${esc(m)}</span>`;
    last = idx + m.length;
  });
  return out + esc(code.slice(last));
}

function enhanceCode(root, { tryButtons = true, chatButtons = false } = {}) {
  root.querySelectorAll('pre > code').forEach(code => {
    const isSql = code.classList.contains('language-sql');
    const text = code.textContent.replace(/\n$/, '');
    if (isSql) code.innerHTML = highlight(text);
    const pre = code.parentElement;
    const wrap = document.createElement('div');
    wrap.className = 'codeblock';
    pre.replaceWith(wrap); wrap.appendChild(pre);
    if (isSql && (tryButtons || chatButtons)) {
      const b = document.createElement('button');
      b.className = 'btn small try';
      b.textContent = chatButtons ? '↳ Use in editor' : '▶ Try it';
      b.onclick = () => {
        if (tryButtons && !chatButtons) { setEditor(text); run(); }
        else { setEditor(text); toast('Copied into the editor'); }
      };
      wrap.appendChild(b);
    }
  });
}

// ---------- editor ----------
const editor = $('#editor');
const gutter = $('#gutter');
function updateGutter() {
  const n = editor.value.split('\n').length;
  let s = ''; for (let i = 1; i <= n; i++) s += i + '\n';
  gutter.textContent = s;
  gutter.scrollTop = editor.scrollTop;
}
function draftKey() { return S.challengeId || 'scratch'; }
function setEditor(text, { save = true } = {}) {
  editor.value = text; updateGutter();
  if (save) { S.drafts[draftKey()] = text; store.set('drafts', S.drafts); }
}
let draftTimer;
editor.addEventListener('input', () => {
  updateGutter();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { S.drafts[draftKey()] = editor.value; store.set('drafts', S.drafts); }, 300);
});
editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
editor.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (e.shiftKey) check(); else run();
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b } = editor;
    editor.setRangeText('  ', a, b, 'end');
    editor.dispatchEvent(new Event('input'));
  }
});
function insertAtCursor(text) {
  const { selectionStart: a, selectionEnd: b } = editor;
  editor.setRangeText(text, a, b, 'end');
  editor.focus();
  editor.dispatchEvent(new Event('input'));
}

// ---------- helpers ----------
const allChallenges = () => S.chapters.flatMap(ch => ch.challenges.map(c => ({ ...c, chapterId: ch.id })));
const currentChapter = () => S.chapters.find(c => c.id === S.chapterId);
const currentChallenge = () => allChallenges().find(c => c.id === S.challengeId);

function updateProgress() {
  const all = allChallenges();
  const done = all.filter(c => S.progress[c.id]).length;
  $('#progressText').textContent = `${done} / ${all.length} solved`;
  $('#progressFill').style.width = (all.length ? (100 * done / all.length) : 0) + '%';
}

function updateEditorMode() {
  const c = currentChallenge();
  $('#editorMode').innerHTML = c
    ? `🎯 <b>${esc(c.title)}</b> ${S.progress[c.id] ? '<span style="color:var(--ok)">✓ solved</span>' : ''}`
    : '📝 <b>Scratchpad</b> — free play (pick a challenge to enable Check)';
  $('#checkBtn').disabled = !c;
}

// ---------- sidebar ----------
function renderSidebar() {
  const list = $('#chapterList');
  list.innerHTML = '';
  S.chapters.forEach((ch, i) => {
    const total = ch.challenges.length;
    const done = ch.challenges.filter(c => S.progress[c.id]).length;
    const li = document.createElement('li');
    li.className = (ch.id === S.chapterId ? 'active ' : '') + (done === total && total ? 'done' : '');
    li.innerHTML = `<span class="ic">${ch.icon}</span><span class="t"><span class="n">Chapter ${i + 1}</span>${esc(ch.title)}</span><span class="cnt">${done === total && total ? '✓' : `${done}/${total}`}</span>`;
    li.onclick = () => { openChapter(ch.id); $('#sidebar').classList.remove('open'); };
    list.appendChild(li);
  });
  updateProgress();
}

// ---------- content ----------
function openChapter(id, tab = 'lesson') {
  S.chapterId = id;
  S.tab = tab;
  if (tab === 'lesson') selectChallenge(null, false);
  store.set('last', { chapterId: id });
  renderSidebar();
  renderContent();
  $('#content').scrollTop = 0;
}

function renderContent() {
  const ch = currentChapter();
  if (!ch) return;
  const idx = S.chapters.indexOf(ch);
  const done = ch.challenges.filter(c => S.progress[c.id]).length;
  const el = $('#content');
  el.innerHTML = `
    <div class="eyebrow">Chapter ${idx + 1} of ${S.chapters.length}</div>
    <h1>${ch.icon} ${esc(ch.title)}</h1>
    <p class="summary">${esc(ch.summary)}</p>
    <div class="tabs">
      <button class="tab ${S.tab === 'lesson' ? 'active' : ''}" data-tab="lesson">📖 Lesson</button>
      <button class="tab ${S.tab === 'challenges' ? 'active' : ''}" data-tab="challenges">🎯 Challenges <span class="badge">${done}/${ch.challenges.length}</span></button>
    </div>
    <div id="tabBody"></div>`;
  el.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    S.tab = b.dataset.tab;
    if (S.tab === 'challenges' && !S.challengeId) {
      const first = ch.challenges.find(c => !S.progress[c.id]) || ch.challenges[0];
      if (first) selectChallenge(first.id, false);
    }
    if (S.tab === 'lesson') selectChallenge(null, false);
    renderContent();
  });
  const body = $('#tabBody');
  if (S.tab === 'lesson') {
    body.innerHTML = `<div class="lesson">${md(ch.lesson)}</div>
      <div class="next-row"><button class="btn primary" id="goChallenges">Start the challenges →</button></div>`;
    enhanceCode(body.querySelector('.lesson'));
    $('#goChallenges').onclick = () => body.parentElement.querySelector('[data-tab=challenges]').click();
  } else {
    renderChallenges(body, ch);
  }
}

function renderChallenges(body, ch) {
  body.innerHTML = '';
  ch.challenges.forEach((c, i) => {
    const active = c.id === S.challengeId;
    const card = document.createElement('div');
    card.className = `ch-card ${active ? 'active' : ''} ${S.progress[c.id] ? 'solved' : ''}`;
    const tags = [];
    if (c.ordered) tags.push('<span class="tag" title="Row order is checked">order matters</span>');
    if (c.kind === 'ddl') tags.push('<span class="tag" title="Checked by inspecting the table afterwards">builds / changes tables</span>');
    card.innerHTML = `
      <div class="ch-head"><span class="ch-num">${S.progress[c.id] ? '✓' : i + 1}</span><span class="ch-title">${esc(c.title)}</span>${tags.join(' ')}</div>
      ${active ? `<div class="ch-body">
        <div class="prompt md">${md(c.prompt)}</div>
        <div class="ch-actions">
          <button class="btn small" data-act="hint">💡 Hint</button>
          ${c.setup ? '<button class="btn small" data-act="prepare" title="(Re)create the tables this challenge uses, so you can experiment with Run">⚙ Prepare tables</button>' : ''}
          <button class="btn small" data-act="expected">👀 Expected output</button>
          <button class="btn small" data-act="ai">🤖 Ask AI</button>
          <button class="btn small ghost" data-act="solution">🔑 Solution</button>
        </div>
        <div class="hint-box" ${S.openHints.has(c.id) ? '' : 'hidden'}>💡 ${md(c.hint)}</div>
        <div class="solution-box"></div>
      </div>` : ''}`;
    card.querySelector('.ch-head').onclick = () => { selectChallenge(c.id); renderContent(); };
    if (active) {
      enhanceCode(card.querySelector('.prompt'), { tryButtons: false });
      card.querySelectorAll('[data-act]').forEach(b => b.onclick = () => challengeAction(b.dataset.act, c, card));
    }
    body.appendChild(card);
  });
}

function selectChallenge(id, rerender = true) {
  S.challengeId = id;
  setEditor(S.drafts[draftKey()] ?? '', { save: false });
  updateEditorMode();
  if (rerender) renderSidebar();
}

async function challengeAction(act, c, card) {
  if (act === 'hint') {
    S.openHints.has(c.id) ? S.openHints.delete(c.id) : S.openHints.add(c.id);
    card.querySelector('.hint-box').hidden = !S.openHints.has(c.id);
  } else if (act === 'prepare') {
    const r = await api('/api/run', { sql: c.setup });
    if (r.error) toast('Setup failed: ' + r.error.message);
    else { toast('Tables ready in playground ✔'); if (S.schema) loadSchema(); }
  } else if (act === 'expected') {
    showExpected(c);
  } else if (act === 'ai') {
    openChat();
    $('#chatText').value = `I'm stuck on "${c.title}". Can you give me a hint without the full answer?`;
    $('#chatText').focus();
  } else if (act === 'solution') {
    if (!confirm('Reveal the reference solution? 🤔\n(Try the hint or the AI tutor first — struggling is where the learning happens.)')) return;
    const r = await api('/api/solution', { id: c.id });
    const box = card.querySelector('.solution-box');
    box.innerHTML = md('```sql\n' + r.solution + '\n```');
    enhanceCode(box, { tryButtons: false, chatButtons: true });
  }
}

// ---------- results rendering ----------
function cell(v) {
  if (v === null || v === undefined) return '<td class="null">NULL</td>';
  if (typeof v === 'object') return `<td title="${esc(JSON.stringify(v))}">${esc(Array.isArray(v) ? '{' + v.join(',') + '}' : JSON.stringify(v))}</td>`;
  const s = String(v);
  const isNum = typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(s);
  return `<td class="${isNum ? 'n' : ''}" title="${esc(s)}">${esc(s)}</td>`;
}
function tableHtml(columns, rows) {
  if (!columns.length) return '';
  return `<div class="table-wrap"><table class="grid"><thead><tr><th></th>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td class="rownum">${i + 1}</td>${r.map(cell).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function errorHtml(err, sql) {
  let where = '';
  if (err.position && sql) {
    const before = sql.slice(0, err.position - 1);
    const lineNo = before.split('\n').length;
    const line = sql.split('\n')[lineNo - 1] ?? '';
    const col = before.length - before.lastIndexOf('\n') - 1;
    where = `<pre>${esc(`line ${lineNo}: `)}${esc(line)}\n${' '.repeat(`line ${lineNo}: `.length + col)}<span class="caret">^</span></pre>`;
  }
  return `<div class="err"><div class="msg">ERROR: ${esc(err.message)}</div>
    ${err.detail ? `<div class="small">Detail: ${esc(err.detail)}</div>` : ''}
    ${err.hint ? `<div class="small">Hint: ${esc(err.hint)}</div>` : ''}${where}</div>`;
}
function statementsSummary(st) {
  return (st || []).filter(s => s.command && s.command !== 'SELECT').map(s => `${s.command}${s.rowCount != null ? ' ' + s.rowCount : ''}`).join(' · ');
}
function loading(msg = 'Running…') { $('#results').innerHTML = `<div class="meta"><span class="spinner"></span> ${msg}</div>`; }

// ---------- run / check ----------
async function run() {
  const sql = editor.value.trim();
  if (!sql) return toast('Editor is empty');
  loading();
  const r = await api('/api/run', { sql });
  const box = $('#results');
  if (r.error) { S.lastError = r.error.message; box.innerHTML = errorHtml(r.error, editor.value) + aiAskRow(); bindAiAsk(); return; }
  S.lastError = null;
  const st = statementsSummary(r.statements);
  box.innerHTML = `<div class="meta"><span>${r.columns.length ? `${r.totalRows} row${r.totalRows === 1 ? '' : 's'}` : '✔ Done'}</span>
      ${st ? `<span>${esc(st)}</span>` : ''}<span>${r.ms} ms</span>${r.truncated ? '<span>(showing first 500)</span>' : ''}</div>
    ${tableHtml(r.columns, r.rows)}`;
  if (/\b(create|drop|alter)\b/i.test(sql) && S.schema) loadSchema();
}

function aiAskRow() { return `<div style="margin-top:8px"><button class="btn small" id="askAboutError">🤖 Ask AI about this</button></div>`; }
function bindAiAsk() {
  const b = $('#askAboutError'); if (!b) return;
  b.onclick = () => { openChat(); $('#chatText').value = 'Why am I getting this error, and how do I fix it?'; $('#chatText').focus(); };
}

async function check() {
  const c = currentChallenge();
  if (!c) return toast('Pick a challenge first');
  const sql = editor.value.trim();
  if (!sql) return toast('Write your answer first');
  loading('Checking…');
  const r = await api('/api/check', { id: c.id, sql });
  const box = $('#results');
  if (r.error && r.correct === undefined) { box.innerHTML = errorHtml(r.error, editor.value); return; }
  S.lastError = r.error ? r.error.message : null;
  const wasSolved = !!S.progress[c.id];
  if (r.correct) { S.progress[c.id] = true; store.set('progress', S.progress); }

  const next = nextChallenge(c);
  box.innerHTML = `
    <div class="verdict ${r.correct ? 'ok' : 'bad'}">${r.correct ? '🎉' : '✗'} ${esc(r.message)}<span class="spacer"></span>
      ${r.correct && next ? '<button class="btn small success" id="nextBtn">Next challenge →</button>' : ''}
      ${!r.correct && !r.error ? '<button class="btn small" id="cmpBtn">👀 Compare with expected</button>' : ''}
    </div>
    ${r.error ? errorHtml(r.error, editor.value) : ''}
    <div id="aiReview"></div>
    ${r.result ? `<div class="label">${r.verified ? 'Your table, as seen by the checking query' : 'Your result'} · ${r.result.totalRows} rows</div>${tableHtml(r.result.columns, r.result.rows)}` : ''}
    <div id="expectedSlot"></div>`;
  if ($('#nextBtn')) $('#nextBtn').onclick = () => goToChallenge(next);
  if ($('#cmpBtn')) $('#cmpBtn').onclick = () => showExpected(c, true);

  if (r.correct && !wasSolved) { renderSidebar(); renderContent(); updateEditorMode(); }
  if (S.config.hasKey && S.autoReview) aiReview(c, sql, r);
  else renderAiPrompt(c, sql, r);
}

function nextChallenge(c) {
  const all = allChallenges();
  const i = all.findIndex(x => x.id === c.id);
  return all.slice(i + 1).find(x => !S.progress[x.id]) || all[i + 1] || null;
}
function goToChallenge(c) {
  if (c.chapterId !== S.chapterId) { S.chapterId = c.chapterId; store.set('last', { chapterId: c.chapterId }); }
  S.tab = 'challenges';
  selectChallenge(c.id);
  renderContent();
  $('#results').innerHTML = '<div class="empty-state">New challenge — you got this 💪</div>';
}

async function showExpected(c, inline = false) {
  const r = await api('/api/expected', { id: c.id });
  if (r.error) return toast(r.error.message);
  const html = `<div class="label">Expected output · ${r.totalRows} rows ${r.truncated ? '(first 500)' : ''}</div>
    ${r.verify ? '<div class="small muted" style="margin-bottom:6px">This challenge is checked by running a query on your table afterwards — this is what that query returns for a correct answer.</div>' : ''}
    ${tableHtml(r.columns, r.rows)}`;
  if (inline && $('#expectedSlot')) { $('#expectedSlot').innerHTML = html; $('#expectedSlot').scrollIntoView({ behavior: 'smooth' }); }
  else $('#results').innerHTML = html;
}

// ---------- AI ----------
function renderAiPrompt(c, sql, r) {
  const slot = $('#aiReview'); if (!slot) return;
  slot.innerHTML = `<div class="ai-box"><div class="head">🤖 AI tutor<span class="spacer"></span>
    <button class="btn small" id="reviewBtn">${S.config.hasKey ? 'Get AI review' : 'Set up AI (Groq key)'}</button></div>
    <div class="small muted">${S.config.hasKey ? 'Get feedback on how close you are, plus hints.' : 'Add your free Groq API key to get AI feedback and chat.'}</div></div>`;
  $('#reviewBtn').onclick = () => S.config.hasKey ? aiReview(c, sql, r) : openSettings();
}

async function aiReview(c, sql, r) {
  const slot = $('#aiReview'); if (!slot) return;
  slot.innerHTML = `<div class="ai-box"><div class="head">🤖 AI tutor</div><div class="muted"><span class="spinner"></span> Reviewing your answer…</div></div>`;
  const res = await api('/api/ai/review', { id: c.id, sql, correct: r.correct, message: r.message, error: r.error || null });
  if (!$('#aiReview')) return;
  if (res.error) { slot.innerHTML = `<div class="ai-box"><div class="head">🤖 AI tutor</div><div style="color:var(--bad)">${esc(res.error.message)}</div></div>`; return; }
  slot.innerHTML = `<div class="ai-box"><div class="head">🤖 AI tutor<span class="spacer"></span><button class="btn small" id="followUp">💬 Ask a follow-up</button></div><div class="md">${md(res.reply)}</div></div>`;
  enhanceCode(slot, { tryButtons: false, chatButtons: true });
  $('#followUp').onclick = () => { openChat(); $('#chatText').focus(); };
  // keep it in the chat thread so follow-ups have context
  S.chat.push({ role: 'user', content: `Review my answer to "${c.title}":\n\`\`\`sql\n${sql}\n\`\`\`\nChecker: ${r.error ? 'error — ' + r.error.message : r.message}` });
  S.chat.push({ role: 'assistant', content: res.reply });
  saveChat(); renderChat();
}

function saveChat() { S.chat = S.chat.slice(-40); store.set('chat', S.chat); }
function renderChat() {
  const body = $('#chatBody');
  if (!S.chat.length) {
    body.innerHTML = `<div class="muted small" style="text-align:center;margin-top:30px">Ask me anything about Postgres, your current challenge, or an error you got.<br><br>Try: <i>"What's the difference between WHERE and HAVING?"</i></div>`;
  } else {
    body.innerHTML = S.chat.map(m => m.role === 'user'
      ? `<div class="msg user">${esc(m.content)}</div>`
      : m.role === 'error' ? `<div class="msg error">${esc(m.content)}</div>`
      : `<div class="msg assistant md">${md(m.content)}</div>`).join('');
    body.querySelectorAll('.msg.assistant').forEach(el => enhanceCode(el, { tryButtons: false, chatButtons: true }));
  }
  body.scrollTop = body.scrollHeight;
  const c = currentChallenge(), ch = currentChapter();
  $('#chatContext').innerHTML = `Context the AI sees: ${ch ? `chapter <b>${esc(ch.title)}</b>` : 'no chapter'}${c ? `, challenge <b>${esc(c.title)}</b>` : ''}, your editor${S.lastError ? ', your last error' : ''}.`;
  $('#chatModel').textContent = S.config.model ? `· ${S.config.model}` : '';
}

async function sendChat(text) {
  if (!S.config.hasKey) { openSettings(); return toast('Add your Groq API key first'); }
  S.chat.push({ role: 'user', content: text });
  saveChat(); renderChat();
  const body = $('#chatBody');
  const typing = document.createElement('div');
  typing.className = 'msg assistant'; typing.innerHTML = '<span class="spinner"></span>';
  body.appendChild(typing); body.scrollTop = body.scrollHeight;
  const res = await api('/api/ai/chat', {
    messages: S.chat.filter(m => m.role !== 'error'),
    chapterId: S.chapterId, challengeId: S.challengeId,
    editorSql: editor.value, lastError: S.lastError,
  });
  if (res.error) S.chat.push({ role: 'error', content: res.error.message });
  else S.chat.push({ role: 'assistant', content: res.reply });
  saveChat(); renderChat();
}

// ---------- drawers, modal ----------
function openDrawer(id) {
  document.querySelectorAll('.drawer').forEach(d => d.classList.toggle('open', d.id === id));
  $('#scrim').classList.add('show');
}
function closeAll() {
  document.querySelectorAll('.drawer.open, .modal.open').forEach(d => d.classList.remove('open'));
  $('#sidebar').classList.remove('open');
  $('#scrim').classList.remove('show');
}
function openChat() { renderChat(); openDrawer('chatDrawer'); }

async function loadSchema() {
  $('#schemaBody').innerHTML = '<span class="spinner"></span>';
  S.schema = await api('/api/schema');
  renderSchema();
}
function renderSchema() {
  const q = $('#schemaSearch').value.trim().toLowerCase();
  const body = $('#schemaBody');
  if (!Array.isArray(S.schema)) { body.textContent = S.schema?.error?.message || 'Could not load schema'; return; }
  const groups = { playground: [], public: [] };
  for (const t of S.schema) {
    if (q && !t.name.includes(q) && !t.columns.some(c => c.name.includes(q))) continue;
    groups[t.schema]?.push(t);
  }
  let html = '';
  html += `<div class="schema-group">playground (yours)</div>`;
  html += groups.playground.length ? groups.playground.map(tblHtml).join('') : '<div class="small muted">Nothing yet — create a table!</div>';
  html += `<div class="schema-group">public (Pagila, read-only)</div>` + groups.public.map(tblHtml).join('');
  body.innerHTML = html;
  body.querySelectorAll('.tbl-head').forEach(h => h.onclick = e => {
    if (e.target.dataset.peek) { setEditor(`SELECT * FROM ${e.target.dataset.peek} LIMIT 20;`); run(); closeAll(); return; }
    const cols = h.nextElementSibling; cols.hidden = !cols.hidden;
    h.querySelector('.arrow').textContent = cols.hidden ? '▶' : '▼';
  });
  body.querySelectorAll('.tbl-cols div').forEach(d => d.onclick = () => { insertAtCursor(d.dataset.col); toast(`Inserted "${d.dataset.col}"`); });
  function tblHtml(t) {
    const open = !!q;
    return `<div class="tbl"><div class="tbl-head"><span class="arrow">${open ? '▼' : '▶'}</span>${t.view ? '👁 ' : ''}${esc(t.name)}<span class="spacer"></span><button class="btn small ghost" data-peek="${esc(t.schema === 'playground' ? t.name : t.name)}" title="SELECT * … LIMIT 20">peek</button></div>
      <div class="tbl-cols" ${open ? '' : 'hidden'}>${t.columns.map(c => `<div data-col="${esc(c.name)}"><span>${esc(c.name)}</span><span class="ty">${esc(c.type)}</span></div>`).join('')}</div></div>`;
  }
}

async function loadConfig() {
  S.config = await api('/api/config');
  $('#chatModel').textContent = S.config.model ? `· ${S.config.model}` : '';
}
function openSettings() {
  $('#keyStatus').textContent = S.config.hasKey ? 'saved ✓' : 'not set';
  $('#keyStatus').className = 'pill ' + (S.config.hasKey ? 'on' : 'off');
  $('#apiKey').value = '';
  const sel = $('#modelSelect');
  if (![...sel.options].some(o => o.value === S.config.model)) sel.add(new Option(S.config.model, S.config.model));
  sel.value = S.config.model;
  $('#autoReview').checked = S.autoReview;
  closeAll();
  $('#settingsModal').classList.add('open');
  $('#scrim').classList.add('show');
}

// ---------- wire up ----------
$('#runBtn').onclick = run;
$('#checkBtn').onclick = check;
$('#clearBtn').onclick = () => { setEditor(''); editor.focus(); };
$('#schemaBtn').onclick = () => { openDrawer('schemaDrawer'); if (!S.schema) loadSchema(); };
$('#schemaReload').onclick = loadSchema;
$('#schemaSearch').oninput = renderSchema;
$('#chatBtn').onclick = openChat;
$('#chatClear').onclick = () => { S.chat = []; saveChat(); renderChat(); };
$('#settingsBtn').onclick = openSettings;
$('#menuBtn').onclick = () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('show'); };
$('#scrim').onclick = closeAll;
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeAll);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

$('#resetBtn').onclick = async () => {
  if (!confirm('Drop EVERYTHING you created in the playground schema? (Pagila data is untouched.)')) return;
  const r = await api('/api/reset-playground', {});
  toast(r.ok ? 'Playground wiped clean ✨' : 'Reset failed: ' + r.error?.message);
  if (S.schema) loadSchema();
};

$('#saveSettings').onclick = async () => {
  S.autoReview = $('#autoReview').checked; store.set('autoReview', S.autoReview);
  S.config = await api('/api/config', { apiKey: $('#apiKey').value, model: $('#modelSelect').value });
  closeAll(); renderChat();
  toast(S.config.hasKey ? `AI ready · ${S.config.model}` : 'Saved (no API key yet)');
};
$('#clearKeyBtn').onclick = async () => {
  if (!confirm('Remove the saved Groq API key from this laptop?')) return;
  S.config = await api('/api/config', { clearKey: true });
  openSettings();
};

$('#chatForm').onsubmit = e => {
  e.preventDefault();
  const t = $('#chatText').value.trim();
  if (!t) return;
  $('#chatText').value = '';
  sendChat(t);
};
$('#chatText').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); }
});

(async function init() {
  try {
    S.chapters = await api('/api/chapters');
  } catch {
    $('#content').innerHTML = '<h1>Server not reachable</h1><p>Start it with <code>start.bat</code> (or <code>node server.js</code>) and refresh.</p>';
    return;
  }
  loadConfig();
  const last = store.get('last', null);
  openChapter(last && S.chapters.some(c => c.id === last.chapterId) ? last.chapterId : S.chapters[0].id);
  updateGutter();
})();
