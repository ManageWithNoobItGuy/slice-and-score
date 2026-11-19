/* Slice & Score — app UI */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = s => esc(s).replace(/"/g, '&quot;');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- state ---------- */
  const STORE_KEY = 'slice-and-score-v2';
  const defaults = () => ({ cur: 0, solved: {}, predicted: {}, checks: {}, projectCode: null, projectDone: {}, quiz: null, quizBest: 0, coach: false });
  let state = defaults();
  try { state = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* private mode */ }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };

  /* ---------- environments ---------- */
  const BASE_ENV = {}; Py.run(BASE_ENV_SRC, BASE_ENV);
  const QUIZ_ENV = {}; Py.run(QUIZ_DATA, QUIZ_ENV);
  const PROJ_ENV = {}; Py.run(PROJECT_DATA, PROJ_ENV);
  const envCopy = (e = BASE_ENV) => Object.assign({}, e);
  const valueOf = (expr, env = BASE_ENV) => Py.run(expr, envCopy(env)).value;

  const PAGES = [
    ...MISSIONS.map(m => ({ kind: 'mission', m, tab: m.tab, id: m.id })),
    { kind: 'project', tab: 'Project', id: 'proj' },
    { kind: 'quiz', tab: 'Quiz', id: 'quiz' },
  ];
  const TOTAL_CHAL = MISSIONS.reduce((n, m) => n + m.challenges.length, 0);
  const MAX_GOALS = TOTAL_CHAL + PROJECT_TASKS.length + QUIZ.length;

  function goals() {
    return Object.keys(state.solved).length + Object.keys(state.projectDone).length + Math.min(state.quizBest || 0, QUIZ.length);
  }
  function missionDone(m) { return m.challenges.every((_, i) => state.solved[m.id + ':' + i]); }
  function pageDone(p) {
    if (p.kind === 'mission') return missionDone(p.m);
    if (p.kind === 'project') return PROJECT_TASKS.filter(t => !t.bonus).every(t => state.projectDone[t.id]);
    return !!(state.quiz && state.quiz.finished);
  }

  /* ---------- friendly error tips ---------- */
  function coachTip(err) {
    const t = err.pyType, m = err.pyMsg || '';
    if (t === 'IndexError') return 'Out of play! That index is past the end of the line. Valid indexes go from 0 to len − 1 (or −1 back to −len).';
    if (t === 'NameError') { const nm = (m.match(/'(.+)'/) || [])[1]; return `Python doesn't know “${nm}”. Check the spelling (capitals matter!). Text needs quotes.`; }
    if (t === 'TypeError' && /indices must be integers/.test(m)) return "Indexes must be whole numbers like 3, not text like '3' and not 1.5.";
    if (t === 'TypeError' && /concatenate|unsupported operand/.test(m)) return "You're mixing text and numbers. int() turns text into a number; str() turns a number into text.";
    if (t === 'TypeError' && /not subscriptable/.test(m)) return 'You can only use [ ] on lists and strings, not on numbers.';
    if (t === 'TypeError' && /not callable/.test(m)) return 'Round brackets ( ) call a function. To pick an item, use square brackets [ ].';
    if (t === 'ValueError' && /step cannot be zero/.test(m)) return 'A step of 0 means you never move! Use 1, 2, −1 …';
    if (t === 'ValueError' && /invalid literal for int/.test(m)) return "int() can only turn digit text like '3' into a number.";
    if (t === 'SyntaxError' && /never closed/.test(m)) return 'A bracket was opened but never closed. Count your [ ] and ( ).';
    if (t === 'SyntaxError' && /unterminated|quote/.test(m)) return 'A quote is missing. Text needs a quote at both ends: "like this".';
    if (t === 'SyntaxError' && /parentheses/.test(m)) return 'In Python 3, print needs brackets: print(squad[0])';
    if (t === 'SyntaxError') return "Python can't read that. Check your brackets, colons, commas and quotes.";
    if (t === 'IndentationError') return 'Remove the spaces at the start of the line.';
    if (t === 'SimulatorLimit') return 'This training ground focuses on indexing & slicing.';
    return 'Read the last line of the error. It tells you what went wrong.';
  }
  const errLine = (e, withLine) => (withLine && e.line ? `Line ${e.line}: ` : '') + `${e.pyType}: ${e.pyMsg}`;

  /* ---------- tiny syntax highlighter ---------- */
  const HL_CONST = new Set(['None', 'True', 'False']);
  const HL_FUNC = new Set(['print', 'len', 'int', 'str', 'sum', 'max', 'min', 'abs', 'list']);
  const HL_KW = new Set(['for', 'in', 'if', 'elif', 'else', 'while', 'def', 'return', 'import', 'from', 'and', 'or', 'not']);
  // Colours one line of Python: comments, strings, numbers, keywords, built-ins, brackets
  function hlLine(line) {
    let out = '', i = 0;
    const span = (cls, text) => `<span class="${cls}">${esc(text)}</span>`;
    while (i < line.length) {
      const c = line[i];
      if (c === '#') { out += span('c', line.slice(i)); break; }
      const isF = (c === 'f' || c === 'F') && (line[i + 1] === '"' || line[i + 1] === "'") && !/\w/.test(line[i - 1] || '');
      if (c === '"' || c === "'" || isF) {
        const q = isF ? line[i + 1] : c;
        let j = i + (isF ? 2 : 1);
        while (j < line.length && line[j] !== q) j += line[j] === '\\' ? 2 : 1;
        out += span('s', line.slice(i, Math.min(j + 1, line.length)));
        i = j + 1; continue;
      }
      if (/\d/.test(c) && !/\w/.test(line[i - 1] || '')) {
        const m = line.slice(i).match(/^\d[\d_]*(\.\d+)?/)[0];
        out += span('n', m); i += m.length; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        const w = line.slice(i).match(/^\w+/)[0];
        const after = line.slice(i + w.length).match(/^\s*\(/);
        const cls = HL_CONST.has(w) ? 'k' : HL_KW.has(w) ? 'kw' : (HL_FUNC.has(w) && after) ? 'f' : '';
        out += cls ? span(cls, w) : esc(w); i += w.length; continue;
      }
      if ('[]()'.includes(c)) { out += span('b', c); i++; continue; }
      out += esc(c); i++;
    }
    return out;
  }
  const hl = code => code.split('\n').map(hlLine).join('\n');

  /* ---------- top-level UI ---------- */
  const main = $('#main');
  function renderTabs() {
    $('#tabs').innerHTML = PAGES.map((p, i) =>
      `<button class="tab${i === state.cur ? ' active' : ''}${pageDone(p) ? ' done' : ''}" data-go="${i}" aria-current="${i === state.cur ? 'page' : 'false'}">
        <b>${String(i).padStart(2, '0')}</b><span>${p.tab}</span></button>`).join('');
    const act = $('.tab.active');
    if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function renderScore(bump) {
    const el = $('#sbGoals');
    el.textContent = goals();
    if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    const pct = Math.round(100 * goals() / MAX_GOALS);
    $('#progBar').style.width = pct + '%';
    $('#progText').textContent = `${String(state.cur).padStart(2, '0')} / ${String(PAGES.length - 1).padStart(2, '0')} · ${PAGES[state.cur].tab} · ${goals()} of ${MAX_GOALS} goals`;
  }
  function go(i) {
    state.cur = Math.max(0, Math.min(PAGES.length - 1, i));
    save();
    animToken++;
    render();
    window.scrollTo({ top: 0 });
  }
  function render() {
    renderTabs();
    const p = PAGES[state.cur];
    if (p.kind === 'mission') { main.innerHTML = missionHTML(p.m); wireMission(p.m); }
    else if (p.kind === 'project') { main.innerHTML = projectHTML(); wireProject(); }
    else { main.innerHTML = quizHTML(); wireQuiz(); }
    main.insertAdjacentHTML('beforeend', `<p class="foot-note">Slice &amp; Score · Python 3 indexing &amp; slicing · progress is saved in this browser · <button id="resetAll">reset all progress</button></p>`);
    $('#resetAll').onclick = () => { if (confirm('Reset all goals, answers and project code?')) { state = defaults(); save(); render(); } };
    $('#prevBtn').disabled = state.cur === 0;
    $('#nextBtn').textContent = state.cur === PAGES.length - 1 ? 'Finish 🏁' : 'Next →';
    $('#nextBtn').disabled = state.cur === PAGES.length - 1;
    renderScore();
  }
  function celebrate() {
    const f = $('#goalFlash');
    f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
    renderScore(true);
    renderTabs();
  }

  /* ---------- mission page ---------- */
  function boardHTML(m) {
    const steps = m.board.map(b => `<div class="board-step"><div class="big">${esc(b.big)}</div><div class="lbl">${b.lbl}</div><div class="s">${esc(b.s)}</div></div>`);
    return `<div class="board" aria-label="Tactics board"><div class="board-h"><span>Tactics board</span><span>${m.tag.split('·')[1] || ''}</span></div>
      <div class="board-flow">${steps.join('<div class="board-arrow" aria-hidden="true">→</div>')}</div>
      <div class="think">${esc(m.think)}</div></div>`;
  }
  const JERSEY = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 3 8 5.5 1.5 12.5 6.5 18l3.5-3V37h20V15l3.5 3 5-5.5L32 5.5 26 3c-1.2 2.6-3.4 4-6 4s-4.8-1.4-6-4z"/></svg>';
  function vizHTML(name) {
    const v = BASE_ENV[name];
    if (name === 'table') return tableHTML(v);
    const n = v.length;
    const chips = Array.from(v).map((item, i) => {
      let face;
      if (name === 'squad') face = `<div class="jersey">${JERSEY}<b>${TEAM.shirts[i]}</b></div><span class="nm">${esc(item)}</span>`;
      else {
        const cls = name === 'form' ? ' ' + item : (item === ' ' ? ' sp' : '');
        face = `<div class="tile${cls}">${item === ' ' ? '␣' : esc(item)}</div>`;
      }
      const pos = name === 'squad' ? ' pos-' + TEAM.pos[i] : '';
      return `<div class="chip${pos}" data-i="${i}"><span class="ix">${i}</span>${face}<span class="ix ix-neg">${i - n}</span></div>`;
    }).join('');
    let legend = '';
    if (name === 'squad') legend = `<div class="legend"><span><i style="background:var(--gk)"></i>Goalkeeper</span><span><i style="background:var(--def)"></i>Defenders</span><span><i style="background:var(--mid)"></i>Midfielders</span><span><i style="background:var(--fwd)"></i>Forwards</span><span>· black number = index · orange = negative index · big number = shirt</span></div>`;
    if (name === 'form') legend = `<div class="legend"><span><i style="background:var(--green)"></i>W win</span><span><i style="background:#8d969a"></i>D draw</span><span><i style="background:var(--red)"></i>L loss</span><span>· oldest on the left → newest on the right</span></div>`;
    if (name === 'score' || name === 'clock') legend = `<div class="legend"><span>␣ = a space character</span></div>`;
    return `<div class="viz" data-var="${name}">
      <div class="viz-label"><b>${name}</b> = ${esc(Py.repr(v))} <span>· len ${n}</span></div>
      <div class="track"><div class="endzone l">◀ out</div>${chips}<div class="endzone r">out ▶</div><div class="ball" aria-hidden="true">⚽</div></div>
      <div class="viz-result" aria-live="polite"></div>${legend}</div>`;
  }
  function tableHTML(t) {
    const n = t.length;
    const rows = t.map((r, i) => {
      const zone = i < 4 ? '<span class="zone cl">top 4</span>' : i >= n - 3 ? '<span class="zone rel">danger</span>' : '';
      return `<div class="trow" data-r="${i}"><span class="ix">${i}</span><span class="ix ix-neg">${i - n}</span>
        <span class="cell" data-c="0">${esc(r[0])}${zone}</span><span class="cell pts" data-c="1">${r[1]}</span></div>`;
    }).join('');
    return `<div class="viz" data-var="table">
      <div class="viz-label"><b>table</b> = a list of ${n} rows · each row is <b>[name, points]</b></div>
      <div class="tbl"><div class="trow head"><span>row</span><span>neg</span><span>[0] name</span><span style="text-align:right">[1] points</span></div>${rows}<div class="ball" aria-hidden="true">⚽</div></div>
      <div class="viz-result" aria-live="polite"></div></div>`;
  }
  function labHTML(m) {
    const st = (key, label) => `<div class="stepper" data-k="${key}"><span class="kicker">${label}</span>
      <div class="ctl"><button data-d="-1" aria-label="${key} minus">−</button><span class="val blank">—</span><button data-d="1" aria-label="${key} plus">+</button><button class="blank-btn" data-d="0">empty</button></div></div>`;
    const vars = m.lab.vars.length > 1 ? `<span class="kicker">Slice</span><span class="seg">${m.lab.vars.map((v, i) => `<button data-v="${v}" class="${i ? '' : 'on'}">${v}</button>`).join('')}</span>` : '';
    return `<div class="lab-wrap"><h3 class="kicker" style="margin:8px 0">🧪 Slice Lab · change the numbers and press Kick</h3>
      <div class="lab"><div class="lab-var">${vars}</div>${st('start', 'start (included)')}${st('stop', 'stop (NOT included)')}${m.lab.step ? st('step', 'step (jump)') : '<div></div>'}
      <button class="btn primary lab-kick">Kick ⚽</button></div>
      <div class="lab-code"></div></div>`;
  }
  function consoleHTML(m) {
    return `<div class="console">
      <div class="console-log" aria-live="polite"><div class="out" style="color:#7fb59a"># Training Ground: type Python and press Enter. Variables ready: ${m.viz.join(', ')}</div></div>
      <div class="console-row"><span class="prompt-sym">&gt;&gt;&gt;</span>
        <input class="code-in" id="consoleIn" placeholder="try: ${escAttr(m.quick[0])}" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Python expression">
        <button class="btn primary" id="consoleRun">Run ▶</button></div>
      <div class="quick">${m.quick.map(q => `<button data-q="${escAttr(q)}">${esc(q)}</button>`).join('')}</div></div>`;
  }
  function predictHTML(m, p, i) {
    const key = m.id + ':' + i;
    return `<div class="predict" data-p="${i}"><div class="q"><span class="kicker">Play ${i + 1}</span><code>${esc(p.code)}</code><span>→ ?</span></div>
      <div class="opts">${p.opts.map((o, j) => `<button class="opt" data-o="${j}">${esc(o)}</button>`).join('')}</div>
      <div class="fb"></div></div>`;
  }
  function chalHTML(m, c, i) {
    const tags = [...(c.must || []), ...(c.mustNot || [])].map(r => `<span class="rtag">📏 ${esc(r.msg)}</span>`);
    if (c.maxBrackets) tags.push(`<span class="rtag">📏 Only ${c.maxBrackets} pair of [ ]</span>`);
    return `<div class="chal" data-c="${i}"><div class="chal-head"><span class="chal-num">${i + 1}</span>
      <div class="chal-text"><span class="stars" aria-label="${c.stars} star difficulty">${'★'.repeat(c.stars)}${'☆'.repeat(3 - c.stars)}</span><p>${c.p}</p>
      ${tags.length ? `<div class="rules-tags">${tags.join('')}</div>` : ''}</div></div>
      <div class="chal-row"><span class="prompt-sym">&gt;&gt;&gt;</span><input class="code-in" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="type your code" aria-label="Your answer for order ${i + 1}">
      <button class="btn dark chal-run">Shoot ⚽</button></div>
      <div class="chal-out"></div><div class="chal-msg"></div><div class="chal-hints"></div>
      <div class="chal-tools"><button class="btn small hint-btn">💡 Hint</button></div></div>`;
  }
  function coachHTML(c, extraTitle) {
    if (!c) return '';
    const li = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
    return `<section class="card coach"><div class="card-h"><h2>Coach Notes${extraTitle ? ' · ' + extraTitle : ''}</h2><span class="sub">for the teacher · ${c.time}</span></div>
      <dl><dt>How to run it</dt><dd>${li(c.flow)}</dd><dt>Watch out for</dt><dd>${li(c.watch)}</dd><dt>Ask</dt><dd>${li(c.ask)}</dd>
      ${c.extend ? `<dt>Stretch</dt><dd>${c.extend}</dd>` : ''}</dl></section>`;
  }
  function missionHTML(m) {
    const solvedN = m.challenges.filter((_, i) => state.solved[m.id + ':' + i]).length;
    return `<div class="mission-tag">${m.tag}</div><h1 class="mission-title">${m.title}</h1><p class="story">${m.story}</p>
      ${boardHTML(m)}
      <section class="card"><div class="card-h"><h2>Coach's Rules</h2><span class="sub">read it, then test it in the Training Ground</span></div>
        <div class="rules-grid"><pre class="code">${hl(m.code)}</pre><ul class="rule-list">${m.rules.map(r => `<li>${r}</li>`).join('')}</ul></div></section>
      <section class="card" id="ground"><div class="card-h"><h2>Training Ground</h2><span class="sub">the ball shows what Python picks</span></div>
        ${m.viz.map(vizHTML).join('')}${m.lab ? labHTML(m) : ''}${consoleHTML(m)}</section>
      <section class="card"><div class="card-h"><h2>Predict the Play</h2><span class="sub">guess first, then watch the replay</span></div>
        ${m.predict.map((p, i) => predictHTML(m, p, i)).join('')}</section>
      <section class="card"><div class="card-h"><h2>Coach's Orders</h2><span class="sub" id="ordersCount">${solvedN} / ${m.challenges.length} scored</span></div>
        ${m.challenges.map((c, i) => chalHTML(m, c, i)).join('')}</section>
      <section class="card"><div class="card-h"><h2>Now in Real Python</h2><span class="sub">this page is a simulator, so run the real thing too</span></div>
        <ul class="check">${m.real.map((r, i) => `<li><label><input type="checkbox" data-chk="${m.id}:${i}" ${state.checks[m.id + ':' + i] ? 'checked' : ''}><span>${r}</span></label></li>`).join('')}</ul>
        <div class="checkpoint"><span class="kicker">Before you move on</span><span>${m.checkpoint}</span></div></section>
      ${coachHTML(m.coach)}`;
  }

  /* ---------- animation ---------- */
  let animToken = 0;
  function placeBall(container, ball, target, dy) {
    const cr = container.getBoundingClientRect(), r = target.getBoundingClientRect();
    const x = r.left - cr.left + r.width / 2 - 12;
    const y = dy ? r.top - cr.top + r.height / 2 - 12 : r.top - cr.top - 22;
    if (dy === 'left') { ball.style.transform = `translate(${r.left - cr.left - 22}px,${y}px)`; ball.classList.add('on'); return; }
    ball.style.transform = `translate(${x}px,${y}px)`;
    ball.classList.add('on');
  }
  function resetViz(viz) {
    $$('.chip', viz).forEach(c => { c.classList.remove('dim', 'picked', 'is-start', 'is-stop'); const o = $('.ord', c); if (o) o.remove(); });
    $$('.trow', viz).forEach(r => r.classList.remove('dim', 'picked'));
    $$('.cell', viz).forEach(c => c.classList.remove('hit'));
    $$('.endzone', viz).forEach(z => { z.classList.remove('hit', 'stop-here'); z.textContent = z.classList.contains('l') ? '◀ out' : 'out ▶'; });
    const t = $('.track', viz); if (t) t.classList.remove('has-markers');
    const b = $('.ball', viz); if (b) b.classList.remove('on');
    $('.viz-result', viz).innerHTML = '';
  }
  async function animate(root, res, code) {
    const my = ++animToken;
    $$('.viz', root).forEach(resetViz);
    const trace = res.trace || [];
    const has = n => root.querySelector(`.viz[data-var="${n}"]`);
    let rec = [...trace].reverse().find(r => r.depth === 0 && has(r.name));
    const recT = trace.filter(r => r.name === 'table');
    if (recT.length && has('table')) rec = recT[0];
    let text;
    if (!res.ok) text = `<b>${esc(code)}</b> → <b>${esc(res.error.pyType)}</b>`;
    else text = `<b>${esc(code)}</b> → <b>${esc(res.value === undefined ? '' : Py.repr(res.value))}</b>`;
    if (!rec) {
      const v = $('.viz', root);
      if (v) { $('.viz-result', v).innerHTML = text; $('.viz-result', v).classList.toggle('err', !res.ok); }
      return;
    }
    const viz = has(rec.name);
    const out = $('.viz-result', viz);
    out.classList.toggle('err', !res.ok);
    out.innerHTML = '<span style="opacity:.6">⚽ …</span>';
    if (rec.name === 'table') await animTable(viz, recT, my);
    else await animStrip(viz, rec, my);
    if (my === animToken) out.innerHTML = text;
  }
  async function animStrip(viz, rec, my) {
    const chips = $$('.chip', viz), track = $('.track', viz), ball = $('.ball', viz);
    const n = chips.length;
    chips.forEach(c => c.classList.add('dim'));
    if (rec.error) {
      if (rec.kind === 'index' && rec.attempted !== null && rec.attempted !== undefined) {
        const zone = $(rec.attempted >= 0 ? '.endzone.r' : '.endzone.l', viz);
        placeBall(track, ball, zone);
        await sleep(350);
        zone.classList.add('hit'); zone.textContent = `[${rec.attempted}] OUT!`;
      }
      return;
    }
    const idx = rec.indices;
    if (rec.kind === 'slice') {
      track.classList.add('has-markers');
      if (idx.length) chips[idx[0]].classList.add('is-start');
      if (rec.stop >= 0 && rec.stop < n) chips[rec.stop].classList.add('is-stop');
      else { const z = $(rec.stop >= n ? '.endzone.r' : '.endzone.l', viz); z.classList.add('stop-here'); z.textContent = 'STOP ✋'; }
    }
    const dt = idx.length > 8 ? 190 : idx.length > 4 ? 260 : 340;
    for (let k = 0; k < idx.length; k++) {
      if (my !== animToken) return;
      const c = chips[idx[k]];
      placeBall(track, ball, c);
      await sleep(k === 0 ? 380 : dt);
      if (my !== animToken) return;
      c.classList.remove('dim'); c.classList.add('picked');
      if (rec.kind === 'slice') c.insertAdjacentHTML('beforeend', `<span class="ord">${k + 1}</span>`);
    }
    if (!idx.length) {
      const z = $('.endzone.r', viz);
      placeBall(track, ball, chips.length ? chips[Math.max(0, Math.min(n - 1, rec.start))] : z);
    }
  }
  async function animTable(viz, recs, my) {
    const rows = $$('.trow:not(.head)', viz), box = $('.tbl', viz), ball = $('.ball', viz);
    rows.forEach(r => r.classList.add('dim'));
    const d0 = recs.find(r => r.depth === 0), d1 = recs.find(r => r.depth === 1);
    if (!d0 || d0.error) return;
    for (let k = 0; k < d0.indices.length; k++) {
      if (my !== animToken) return;
      const row = rows[d0.indices[k]];
      placeBall(box, ball, $('.ix', row), 'mid');
      await sleep(k === 0 ? 380 : 260);
      row.classList.remove('dim'); row.classList.add('picked');
    }
    if (d1 && !d1.error && d1.kind === 'index' && my === animToken) {
      const cell = $(`.cell[data-c="${d1.indices[0]}"]`, rows[d1.row]);
      if (cell) { placeBall(box, ball, cell, 'left'); await sleep(350); cell.classList.add('hit'); }
    }
  }

  /* ---------- mission wiring ---------- */
  function wireMission(m) {
    const ground = $('#ground');
    const log = $('.console-log', ground), input = $('#consoleIn');
    const runConsole = code => {
      code = code.trim(); if (!code) return;
      const res = Py.run(code, envCopy(), { repl: true });
      let html = `<div class="in">&gt;&gt;&gt; ${esc(code)}</div>`;
      if (res.out.length) html += `<div class="out">${esc(res.out.join('\n'))}</div>`;
      if (!res.ok) html += `<div class="er">${esc(errLine(res.error))}</div><div class="tip">🗣️ Coach: ${esc(coachTip(res.error))}</div>`;
      log.insertAdjacentHTML('beforeend', html);
      log.scrollTop = log.scrollHeight;
      animate(ground, res, code);
    };
    $('#consoleRun').onclick = () => runConsole(input.value);
    input.onkeydown = e => { if (e.key === 'Enter') { runConsole(input.value); input.select(); } };
    $$('.quick button', ground).forEach(b => b.onclick = () => { input.value = b.dataset.q; runConsole(b.dataset.q); });

    if (m.lab) wireLab(m, ground);

    // predictions
    $$('.predict').forEach(box => {
      const i = +box.dataset.p, p = m.predict[i], key = m.id + ':' + i;
      const show = chosen => {
        $$('.opt', box).forEach((b, j) => { b.disabled = true; if (j === p.a) b.classList.add('right'); else if (j === chosen) b.classList.add('wrong'); });
        const fb = $('.fb', box);
        fb.className = 'fb show ' + (chosen === p.a ? 'good' : 'bad');
        fb.innerHTML = `${chosen === p.a ? '<b>Correct!</b> ' : '<b>Not quite.</b> '}${p.why} <button class="btn small replay">▶ Watch the replay</button>`;
        $('.replay', fb).onclick = () => { input.value = p.code; runConsole(p.code); ground.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      };
      if (state.predicted[key] !== undefined) show(state.predicted[key]);
      $$('.opt', box).forEach(b => b.onclick = () => { const j = +b.dataset.o; state.predicted[key] = j; save(); show(j); });
    });

    // challenges
    $$('.chal').forEach(box => {
      const i = +box.dataset.c, c = m.challenges[i], key = m.id + ':' + i;
      const inp = $('.code-in', box);
      let hintsShown = 0;
      const shoot = () => {
        const code = inp.value.trim(); if (!code) return;
        const r = judge(c, code, BASE_ENV);
        $('.chal-out', box).innerHTML = r.outHTML;
        const msg = $('.chal-msg', box);
        msg.className = 'chal-msg ' + r.cls; msg.innerHTML = r.msg;
        if (r.res) animate(ground, r.res, code);
        if (r.cls === 'good' && !state.solved[key]) {
          state.solved[key] = code; save();
          box.classList.add('solved');
          $('#ordersCount').textContent = `${m.challenges.filter((_, k) => state.solved[m.id + ':' + k]).length} / ${m.challenges.length} scored`;
          celebrate();
        }
      };
      $('.chal-run', box).onclick = shoot;
      inp.onkeydown = e => { if (e.key === 'Enter') shoot(); };
      const hb = $('.hint-btn', box);
      hb.onclick = () => {
        const wrap = $('.chal-hints', box);
        if (hintsShown < c.hints.length) {
          wrap.insertAdjacentHTML('beforeend', `<div class="hint">💡 ${c.hints[hintsShown]}</div>`);
          hintsShown++;
          if (hintsShown === c.hints.length) hb.textContent = '👀 Show an answer';
        } else {
          wrap.insertAdjacentHTML('beforeend', `<div class="hint">👀 One answer: <code>${esc(c.a || c.show)}</code>. Type it yourself and make sure you understand <b>why</b> it works.</div>`);
          hb.disabled = true;
        }
      };
      if (state.solved[key]) {
        box.classList.add('solved');
        inp.value = state.solved[key];
        $('.chal-msg', box).className = 'chal-msg good';
        $('.chal-msg', box).textContent = '⚽ Scored!';
      }
    });

    $$('[data-chk]').forEach(cb => cb.onchange = () => { state.checks[cb.dataset.chk] = cb.checked; save(); });
  }

  function wireLab(m, ground) {
    const lab = { v: m.lab.vars[0], start: null, stop: null, step: null };
    const codeEl = $('.lab-code', ground);
    const len = () => BASE_ENV[lab.v].length;
    const code = () => `${lab.v}[${lab.start ?? ''}:${lab.stop ?? ''}${lab.step !== null ? ':' + lab.step : ''}]`;
    const paint = () => {
      $$('.stepper', ground).forEach(s => {
        const k = s.dataset.k, v = lab[k], el = $('.val', s);
        el.textContent = v === null ? '—' : v;
        el.classList.toggle('blank', v === null);
      });
      codeEl.textContent = code();
    };
    const kick = () => { const c = code(); animate(ground, Py.run(c, envCopy(), { repl: true }), c); };
    $$('.stepper', ground).forEach(s => {
      const k = s.dataset.k;
      $$('button', s).forEach(b => b.onclick = () => {
        const d = +b.dataset.d;
        if (d === 0) lab[k] = null;
        else if (lab[k] === null) lab[k] = k === 'step' ? d : k === 'stop' ? len() : 0;
        else {
          const lim = len() + 2;
          let v = lab[k] + d;
          if (k === 'step' && v === 0) v += d;
          if (k === 'step') v = Math.max(-4, Math.min(4, v)); else v = Math.max(-lim, Math.min(lim, v));
          lab[k] = v;
        }
        paint(); kick();
      });
    });
    $$('.seg button', ground).forEach(b => b.onclick = () => {
      lab.v = b.dataset.v; $$('.seg button', ground).forEach(x => x.classList.toggle('on', x === b));
      paint(); kick();
    });
    $('.lab-kick', ground).onclick = kick;
    paint();
  }

  /* ---------- judging an answer ---------- */
  function judge(c, code, env) {
    const res = Py.run(code, envCopy(env), { repl: true });
    let outHTML = '';
    if (res.out.length) outHTML += `<span class="val">${esc(res.out.join('\n'))}</span>`;
    if (!res.ok) outHTML += `<span class="err">${esc(errLine(res.error))}</span>`;
    const rulesBroken = () => {
      for (const r of c.must || []) if (!new RegExp(r.re).test(code)) return r.msg;
      for (const r of c.mustNot || []) if (new RegExp(r.re).test(code)) return r.msg;
      if (c.maxBrackets && (code.match(/\[/g) || []).length > c.maxBrackets) return `Only ${c.maxBrackets} pair of [ ]`;
      return null;
    };
    if (c.expectError) {
      if (!res.ok && res.error.pyType === c.expectError) {
        const b = rulesBroken();
        if (b) return { res, outHTML, cls: 'near', msg: `🟨 The whistle blew, but the coach said: <b>${esc(b)}</b>.` };
        return { res, outHTML, cls: 'good', msg: '⚽ GOAL! Phweeet! You found the edge of the pitch.' };
      }
      if (!res.ok) return { res, outHTML, cls: 'bad', msg: `That's a ${esc(res.error.pyType)}, not an ${esc(c.expectError)}. ${esc(coachTip(res.error))}` };
      return { res, outHTML, cls: 'bad', msg: 'No whistle. That index exists! Try one that is off the pitch.' };
    }
    if (!res.ok) return { res, outHTML, cls: 'bad', msg: '🗣️ ' + esc(coachTip(res.error)) };
    if (res.value === undefined) return { res, outHTML, cls: 'bad', msg: 'Type an expression that gives a value, like <code>squad[0]</code> (no <code>=</code> needed here).' };
    const target = Py.run(c.a, envCopy(env)).value;
    if (Py.strictEq(res.value, target)) {
      if (/["']/.test(code) && !/["']/.test(c.a)) return { res, outHTML, cls: 'near', msg: '🟨 Right value, but you typed the answer by hand! Use indexing on the data instead.' };
      const b = rulesBroken();
      if (b) return { res, outHTML, cls: 'near', msg: `🟨 Right answer, but the coach's rule is: <b>${esc(b)}</b>. Try again!` };
      return { res, outHTML, cls: 'good', msg: '⚽ GOAL! Great finish.' };
    }
    return { res, outHTML, cls: 'bad', msg: nudge(res.value, target) };
  }
  // true when got has the same items as want, but in the opposite order
  function isBackwards(got, want) {
    const tg = Py.typeName(got);
    if (tg !== Py.typeName(want) || (tg !== 'str' && tg !== 'list') || want.length < 2) return false;
    const rev = tg === 'str' ? [...want].reverse().join('') : want.slice().reverse();
    return Py.strictEq(got, rev) && !Py.strictEq(got, want);
  }
  function nudge(got, want) {
    const tg = Py.typeName(got), tw = Py.typeName(want);
    if (isBackwards(got, want)) return `🔄 Right ${tg === 'str' ? 'characters' : 'items'}, but <b>backwards</b>! The coach wants them in the same order as the data. Do you need that negative step?`;
    if (tg !== tw && Py.str(got) === Py.str(want)) return `So close! You got the <b>${tg}</b> ${esc(Py.repr(got))}, but the coach wants the <b>${tw}</b> ${esc(Py.repr(want))}.`;
    if (tg === 'list' && tw !== 'list' && got.length === 1 && Py.strictEq(got[0], want)) return 'Nearly! A slice gives a <b>list</b>. To get one item on its own, use a single index.';
    if (tw === 'list' && tg !== 'list') return 'The coach wants a <b>list</b> of players. Use a slice with a colon <code>:</code>.';
    if (tw === 'list' && tg === 'list') {
      if (got.length === want.length + 1 || got.length === want.length - 1) return `You picked ${got.length} item${got.length === 1 ? '' : 's'}, and the coach wants ${want.length}. Check your <b>stop</b> (it's not included!).`;
      return `You picked ${got.length} item${got.length === 1 ? '' : 's'}, and the coach wants ${want.length}. Watch the ball in the picture!`;
    }
    if (tw === 'str' && tg === 'str' && want.length > 1 && got.length !== want.length) return `You got ${got.length} character${got.length === 1 ? '' : 's'}, and the coach wants ${want.length}. Check start and stop.`;
    return 'Not quite. Watch where the ball goes in the picture, then adjust.';
  }

  /* ---------- project ---------- */
  function projectHTML() {
    const tasks = PROJECT_TASKS.map(t => `<li class="task${t.bonus ? ' bonus' : ''}" data-t="${t.id}"><span class="ico">${t.bonus ? '⭐' : '○'}</span>
      <div><b class="ttl">${t.title}</b><p>${t.desc}</p><div class="tmsg"></div></div></li>`).join('');
    return `<div class="mission-tag">MISSION 05 · FINAL PROJECT</div><h1 class="mission-title">Matchday Analyst</h1>
      <p class="story">FC Python just beat the Tigers 4–2! You're the club's <b>data analyst</b>. The club computer gives you the squad, the form guide and today's result. Write a program that pulls out everything the coach needs, using <b>only indexing and slicing</b>, then print a match report.</p>
      <div class="board"><div class="board-h"><span>Your game plan</span><span>project</span></div><div class="board-flow">
        <div class="board-step"><div class="big">data</div><div class="lbl">Read the data</div><div class="s">don't change it!</div></div><div class="board-arrow">→</div>
        <div class="board-step"><div class="big">[ : ]</div><div class="lbl">Fill each variable</div><div class="s">replace every None</div></div><div class="board-arrow">→</div>
        <div class="board-step"><div class="big">print()</div><div class="lbl">Report</div><div class="s">at least 5 lines</div></div></div>
        <div class="think">Press "Run & check" often. Each task turns green when it's right. Typing the answers by hand doesn't count!</div></div>
      <div class="proj-grid">
        <section class="card"><div class="card-h"><h2>Tasks</h2><span class="sub" id="projCount"></span></div>
          <div class="meter"><i id="projMeter"></i></div><ul class="tasks" style="margin-top:12px">${tasks}</ul></section>
        <section class="card"><div class="card-h"><h2>matchday_analyst.py</h2><span class="sub">edit the code, then run it</span></div>
          <div class="editor"><div class="gutter" id="gutter" aria-hidden="true">1</div>
          <div class="code-wrap"><pre class="code-hl" id="projHl" aria-hidden="true"></pre>
          <textarea id="projCode" wrap="off" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Project code"></textarea></div></div>
          <div class="proj-bar"><button class="btn primary" id="projRun">Run &amp; check ▶</button>
            <button class="btn" id="projDownload">⬇ Download .py</button><button class="btn" id="projReset">↺ Reset code</button></div>
          <div class="kicker" style="margin-bottom:6px">Output</div><div class="terminal" id="projOut"><span class="muted">Press "Run &amp; check" to run your program.</span></div></section>
      </div>
      <section class="card"><div class="card-h"><h2>Now in Real Python</h2><span class="sub">finish the job like a real analyst</span></div>
        <ul class="check">${['Download your file (or copy it) and run it in your own Python editor. Does it print the same report?',
          'Change <code>result</code> to <code>"FCP 1-0 TIG"</code>. Does your report update by itself? (That\'s why we don\'t type answers by hand!)',
          'Add one more line of your own to the report, for example the bench players or the team in 3rd place.'].map((r, i) => `<li><label><input type="checkbox" data-chk="proj:${i}" ${state.checks['proj:' + i] ? 'checked' : ''}><span>${r}</span></label></li>`).join('')}</ul>
        <div class="checkpoint"><span class="kicker">Done when</span><span>All 7 tasks are green and your report prints in real Python.</span></div></section>
      ${coachHTML({
        time: '30–45 min', flow: ["Let the student work alone first. Only step in when they're stuck for 3+ minutes.", 'Encourage “Run & check” after every single task, not at the end.', 'When finished, do the real-Python checklist together, especially changing the result string.'],
        watch: ['Typing answers by hand (<code>keeper = "Nok"</code>). The checker flags this; talk about <i>why</i> data changes.', 'Captain = 11th player = index <b>10</b>.', 'Forgetting <code>int()</code> for the goals.'],
        ask: ['If a new player joins the bench, which of your variables still work without changes?'],
        extend: 'Bonus tasks: the penalty slice needs a negative step and a careful stop.',
      }, 'Project')}`;
  }
  function wireProject() {
    const ta = $('#projCode'), gutter = $('#gutter'), hlEl = $('#projHl');
    ta.value = state.projectCode || PROJECT_STARTER;
    const syncScroll = () => {
      gutter.scrollTop = ta.scrollTop;
      hlEl.scrollTop = ta.scrollTop;
      hlEl.scrollLeft = ta.scrollLeft;
    };
    const syncGutter = () => {
      const n = ta.value.split('\n').length;
      gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
      // trailing newline keeps the last (empty) line the same height as in the textarea
      hlEl.innerHTML = hl(ta.value) + '\n ';
      syncScroll();
    };
    let t;
    ta.addEventListener('input', () => { syncGutter(); clearTimeout(t); t = setTimeout(() => { state.projectCode = ta.value; save(); }, 400); });
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); syncGutter(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); runProject(true); }
    });
    syncGutter();
    $('#projRun').onclick = () => runProject(true);
    $('#projReset').onclick = () => { if (confirm('Go back to the starter code? Your code will be replaced.')) { ta.value = PROJECT_STARTER; state.projectCode = null; save(); syncGutter(); runProject(false); } };
    $('#projDownload').onclick = () => {
      const blob = new Blob([ta.value], { type: 'text/x-python' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'matchday_analyst.py';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $$('[data-chk]').forEach(cb => cb.onchange = () => { state.checks[cb.dataset.chk] = cb.checked; save(); });
    runProject(false);
  }
  function looksHardcoded(rhs) {
    return /["']/.test(rhs) || /^\s*\[/.test(rhs) || /^[\d\s+\-*/().]+$/.test(rhs);
  }
  function runProject(user) {
    const code = $('#projCode').value;
    state.projectCode = code; save();
    const env = {};
    const res = Py.run(code, env, {});
    const out = $('#projOut');
    let html = res.out.length ? esc(res.out.join('\n')) : '<span class="muted">(nothing printed yet)</span>';
    if (!res.ok) html += `\n<span class="er">${esc(errLine(res.error, true))}\n🗣️ Coach: ${esc(coachTip(res.error))}</span>`;
    const changed = ['squad', 'form', 'result'].filter(k => !(k in env) || !Py.strictEq(env[k], PROJ_ENV[k]));
    if (changed.length) html += `\n<span class="er">⚠ The club data was changed or deleted: ${changed.join(', ')}. Put it back (or press Reset code).</span>`;
    out.innerHTML = html;

    let doneN = 0, newGoal = false;
    for (const t of PROJECT_TASKS) {
      const li = $(`.task[data-t="${t.id}"]`), msg = $('.tmsg', li), ico = $('.ico', li);
      let status = 'todo', text = '';
      if (t.print) {
        const n = res.out.length;
        if (n >= t.print) status = 'ok'; else text = `${n} / ${t.print} lines printed`;
      } else {
        const parts = Object.keys(t.ref).map(v => {
          const a = res.assigns[v];
          const want = valueOf(t.ref[v], PROJ_ENV);
          if (!a || a.value === null) return { v, s: 'todo' };
          if (!Py.strictEq(a.value, want)) {
            if (isBackwards(a.value, want)) return { v, s: 'bad', m: `🔄 ${v} has the right ${a.value.length}, but backwards! Keep the same order as the data. Do you need that negative step?` };
            const shown = Py.repr(a.value);
            return { v, s: 'bad', m: `Not quite: ${v} is ${shown.length > 44 ? shown.slice(0, 44) + '…' : shown}` };
          }
          if (looksHardcoded(a.rhs)) return { v, s: 'warn', m: `${v}: right value, but typed by hand. Use indexing!` };
          return { v, s: 'ok' };
        });
        if (parts.every(p => p.s === 'ok')) status = 'ok';
        else if (parts.some(p => p.s === 'warn')) status = 'warn';
        else if (parts.some(p => p.s === 'bad')) status = 'bad';
        text = parts.filter(p => p.m).map(p => p.m).join(' ');
        if (status !== 'ok' && !text && parts.some(p => p.s === 'ok')) text = 'Half-way there!';
      }
      if (changed.length && status === 'ok') { status = 'warn'; text = 'Restore the club data first.'; }
      li.className = `task${t.bonus ? ' bonus' : ''} ${status}`;
      ico.textContent = status === 'ok' ? '✓' : status === 'warn' ? '!' : status === 'bad' ? '✗' : (t.bonus ? '⭐' : '○');
      msg.textContent = text;
      if (status === 'ok') {
        doneN++;
        if (!state.projectDone[t.id]) { state.projectDone[t.id] = true; newGoal = true; }
      }
    }
    save();
    $('#projCount').textContent = `${doneN} / ${PROJECT_TASKS.length} done`;
    $('#projMeter').style.width = Math.round(100 * doneN / PROJECT_TASKS.length) + '%';
    if (newGoal && user) celebrate(); else { renderScore(); renderTabs(); }
  }

  /* ---------- quiz ---------- */
  function quizState() {
    if (!state.quiz || state.quiz.n !== QUIZ.length) state.quiz = { i: 0, answers: [], finished: false, n: QUIZ.length };
    return state.quiz;
  }
  function rating(s, n) {
    if (s === n) return ['🏆', "Ballon d'Or", 'A perfect score. You are an indexing legend!'];
    if (s >= n - 1) return ['🥇', 'Golden Boot', 'Brilliant! Just one tiny slip.'];
    if (s >= n - 3) return ['⭐', 'Player of the Match', 'Great game. Check the ones you missed.'];
    if (s >= n / 2) return ['👕', 'First Team', 'Solid! Replay the missions where you slipped.'];
    if (s >= 2) return ['🏃', 'Training Squad', 'Good effort. Revisit Missions 02 and 03, then try again.'];
    return ['🎒', 'Academy', 'Everyone starts here! Rewatch the replays and give it another go.'];
  }
  function quizHTML() {
    const qs = quizState();
    const dots = QUIZ.map((_, i) => { const a = qs.answers[i]; return `<i class="${a ? (a.ok ? 'r' : 'w') : i === qs.i && !qs.finished ? 'now' : ''}"></i>`; }).join('');
    let body;
    if (qs.finished) {
      const score = qs.answers.filter(a => a && a.ok).length;
      const [icon, title, line] = rating(score, QUIZ.length);
      body = `<div class="result-hero"><div class="trophy">${icon}</div><div class="kicker">Full time</div><div class="big">${score} / ${QUIZ.length}</div>
        <h2 style="font-size:30px;text-transform:uppercase">${title}</h2><p>${line}</p><button class="btn primary" id="quizAgain">Play again ↺</button></div>
        <h3 class="kicker" style="margin:10px 0">Match review</h3>
        <ul class="review">${QUIZ.map((q, i) => { const a = qs.answers[i] || {}; return `<li class="${a.ok ? '' : 'w'}">${a.ok ? '✅' : '❌'} <b>Q${i + 1}.</b> ${q.q} ${a.ok ? '' : `<br><span>Your answer: <code>${esc(a.given || '—')}</code> · Answer: <code>${esc(answerText(q))}</code></span>`}</li>`; }).join('')}</ul>`;
    } else {
      const q = QUIZ[qs.i];
      const typeLbl = q.t === 'mcq' ? 'Pick one' : q.t === 'text' ? 'Type the result' : 'Write the code';
      let input;
      if (q.t === 'mcq') input = `<div class="qopts">${q.opts.map((o, j) => `<button class="opt" data-o="${j}">${esc(o)}</button>`).join('')}</div>`;
      else input = `<div class="chal-row"><span class="prompt-sym" style="color:var(--grass)">${q.t === 'code' ? '&gt;&gt;&gt;' : '→'}</span>
        <input class="code-in" id="qIn" style="background:#fff;color:var(--ink);border:2px solid var(--line)" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="${q.t === 'code' ? 'e.g. team[0]' : "e.g. 'ABC'"}" aria-label="Your answer">
        <button class="btn dark" id="qCheck">Check</button></div>${q.must || q.maxBrackets ? `<div class="rules-tags" style="margin-top:8px">${(q.must || []).map(r => `<span class="rtag">📏 ${esc(r.msg)}</span>`).join('')}${q.maxBrackets ? '<span class="rtag">📏 One pair of [ ]</span>' : ''}</div>` : ''}`;
      body = `<div class="kicker">Question ${qs.i + 1} of ${QUIZ.length} · ${typeLbl}</div><div class="qtext">${q.q}</div>${input}
        <div class="qexp" id="qExp"></div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn primary" id="qNext" hidden>${qs.i === QUIZ.length - 1 ? 'See the result 🏁' : 'Next question →'}</button></div>`;
    }
    return `<div class="mission-tag">MISSION 06 · FINAL WHISTLE</div><h1 class="mission-title">The Big Quiz</h1>
      <p class="story">${QUIZ.length} questions to check your skills. New team, new data, same rules. No simulator to help you this time, so think it through!</p>
      <section class="card"><div class="card-h"><h2>Today's data</h2><span class="sub">all questions use these variables</span></div><pre class="code">${hl(QUIZ_DATA)}</pre>
        <div style="font-family:var(--mono);font-size:13px;color:var(--muted);margin-top:8px">team:  0=Ana 1=Bo 2=Cy 3=Dan 4=Eve 5=Fin 6=Gus  ·  word: 7 letters</div></section>
      <section class="card quiz-card"><div class="qdots">${dots}</div>${body}</section>
      ${coachHTML({ time: '15 min', flow: ['Let the student do the quiz alone, without the Training Ground.', 'Afterwards, go through the Match review together. For each ❌, ask them to explain the right answer.'], watch: ['Q5 (<code>team[:1]</code> vs <code>team[0]</code>): list vs single item is a common confusion.', 'Q6: the stop is not included.'], ask: ['Which question was hardest, and why?'] }, 'Quiz')}`;
  }
  function answerText(q) { return q.t === 'mcq' ? q.opts[q.a] : q.t === 'text' ? Py.repr(valueOf(q.a, QUIZ_ENV)) : q.a; }
  function wireQuiz() {
    const qs = quizState();
    if (qs.finished) { $('#quizAgain').onclick = () => { state.quiz = { i: 0, answers: [], finished: false, n: QUIZ.length }; save(); render(); }; return; }
    const q = QUIZ[qs.i];
    const exp = $('#qExp'), next = $('#qNext');
    const finish = (ok, given, extra) => {
      qs.answers[qs.i] = { ok, given };
      exp.className = 'qexp show';
      exp.innerHTML = `${ok ? '✅ <b>Correct!</b>' : `❌ <b>Not this time.</b> Answer: <code>${esc(answerText(q))}</code>.`} ${extra || ''} ${q.why}`;
      next.hidden = false; next.focus();
      save();
    };
    if (q.t === 'mcq') {
      $$('.qopts .opt').forEach(b => b.onclick = () => {
        const j = +b.dataset.o;
        $$('.qopts .opt').forEach((x, k) => { x.disabled = true; if (k === q.a) x.classList.add('right'); else if (k === j) x.classList.add('wrong'); });
        finish(j === q.a, q.opts[j]);
      });
    } else {
      const inp = $('#qIn');
      const check = () => {
        const given = inp.value.trim(); if (!given) return;
        inp.disabled = true; $('#qCheck').disabled = true;
        const want = valueOf(q.a, QUIZ_ENV);
        if (q.t === 'text') {
          const r = Py.run(given, {}, {});
          const ok = (r.ok && r.value !== undefined && Py.strictEq(r.value, want)) || (typeof want === 'string' && given === want);
          finish(ok, given);
        } else {
          const r = judge({ a: q.a, must: q.must, maxBrackets: q.maxBrackets }, given, QUIZ_ENV);
          const usesData = /[A-Za-z_]\w*\s*\[/.test(given);
          const ok = r.cls === 'good' && usesData;
          const extra = r.res && r.res.ok && r.res.value !== undefined ? `Your code gave <code>${esc(Py.repr(r.res.value))}</code>.` : r.res && !r.res.ok ? `Your code gave <code>${esc(errLine(r.res.error))}</code>.` : '';
          finish(ok, given, extra + (r.cls === 'near' ? ' ' + r.msg.replace(/^🟨\s*/, '') : ''));
        }
      };
      $('#qCheck').onclick = check;
      inp.onkeydown = e => { if (e.key === 'Enter') check(); };
      inp.focus();
    }
    next.onclick = () => {
      if (qs.i < QUIZ.length - 1) qs.i++;
      else {
        qs.finished = true;
        const score = qs.answers.filter(a => a && a.ok).length;
        if (score > (state.quizBest || 0)) { state.quizBest = score; save(); render(); celebrate(); return; }
      }
      save(); render();
    };
  }

  /* ---------- global wiring ---------- */
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(+b.dataset.go); });
  $('#prevBtn').onclick = () => go(state.cur - 1);
  $('#nextBtn').onclick = () => go(state.cur + 1);
  const coachBtn = $('#coachToggle');
  const paintCoach = () => { document.body.classList.toggle('coach-on', !!state.coach); coachBtn.innerHTML = `📋 <span class="coach-lbl">Coach notes: ${state.coach ? 'on' : 'off'}</span>`; coachBtn.title = 'Coach notes for the teacher'; coachBtn.setAttribute('aria-pressed', state.coach ? 'true' : 'false'); };
  coachBtn.onclick = () => { state.coach = !state.coach; save(); paintCoach(); if (state.coach) { const c = $('.coach'); if (c) c.scrollIntoView({ behavior: 'smooth' }); } };
  paintCoach();
  if (state.cur >= PAGES.length) state.cur = 0;
  render();
})();
