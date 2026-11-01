// Bloom for Blackboard — runs on your Blackboard Learn (Ultra) site.
// Shows your upcoming deadlines in a small floating panel, and restyles Blackboard to your taste.
// Everything is read from your own Blackboard session and kept in your browser. Nothing is sent anywhere else.

(() => {
  if (window.__bloomLoaded) return;
  window.__bloomLoaded = true;

  const ORIGIN = location.origin;
  const DEFAULTS = {
    days: 14, hideSubmitted: false, accent: '#FF6FAE', font: 'default', dark: false,
    theme: true, widget: true, side: 'right',
  };
  const DAY = 86400000;

  /* ---------------- storage ---------------- */
  const store = {
    get: (keys) => chrome.storage.local.get(keys),
    set: (obj) => chrome.storage.local.set(obj),
  };
  let settings = { ...DEFAULTS };
  let items = [];
  let done = {};          // manually ticked items
  let loading = false;
  let lastError = '';
  let note = '';          // short message under the panel buttons

  /* ---------------- Blackboard API (same session you're logged in with) ---------------- */
  async function api(path) {
    const r = await fetch(ORIGIN + path, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  /** "2026_1_SEHS2306_A01: 2026-1 SEHS2306 INTRO TO …" → code "SEHS2306", name "Intro to …" */
  function parseCourse(calendarName = '') {
    let code = (calendarName.match(/\b([A-Z]{2,6}\d{3,5}[A-Z]?)\b/) || [])[1] || '';
    let name = calendarName.includes(':') ? calendarName.split(':').slice(1).join(':').trim() : calendarName;
    name = name.replace(/^\d{4}-\d\s+/, '').replace(code, '').replace(/\(.*?\)\s*$/, '').trim();
    name = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    if (!code && calendarName.includes(':')) {
      // course ID like "2026_1_ACI-UD" or "2026_1-UNIT_LC-EEP-AEEW" → "ACI-UD" / "LC-EEP-AEEW"
      const id = calendarName.split(':')[0].replace(/^\d{4}_\d+[-_]?/, '');
      code = id.split('_').filter(Boolean).pop() || '';
    }
    return { code: (code || name.split(' ').slice(0, 2).join(' ')).slice(0, 14), name };
  }

  async function pool(list, n, fn) {
    const queue = [...list];
    await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    }));
  }

  async function fetchDeadlines() {
    const now = Date.now();
    const since = new Date(now - 3 * DAY).toISOString();
    const until = new Date(now + settings.days * DAY).toISOString();
    let path = `/learn/api/public/v1/calendars/items?since=${since}&until=${until}`;
    const raw = [];
    for (let page = 0; path && page < 8; page++) {
      const data = await api(path);
      raw.push(...(data.results || []));
      path = data.paging && data.paging.nextPage;
    }
    const seen = new Set();
    const list = raw
      .filter((i) => i.type === 'GradebookColumn' && (i.end || i.start))
      .filter((i) => !seen.has(i.id) && seen.add(i.id))
      .map((i) => {
        const c = parseCourse(i.calendarName);
        return {
          id: i.id, courseId: i.calendarId, code: c.code, course: c.name, title: i.title,
          due: i.end || i.start, color: i.color || '#999999', submitted: null,
          url: `${ORIGIN}/ultra/courses/${i.calendarId}/outline`,
        };
      });
    // Have you already handed it in? (Blackboard's own attempt records)
    await pool(list, 4, async (it) => {
      try {
        const a = await api(`/learn/api/public/v2/courses/${it.courseId}/gradebook/columns/${it.id}/attempts?fields=id,status`);
        const ok = ['NeedsGrading', 'Completed', 'Submitted', 'InProgressGraded'];
        it.submitted = (a.results || []).some((x) => ok.includes(x.status));
      } catch (e) { it.submitted = null; }
    });
    list.sort((a, b) => new Date(a.due) - new Date(b.due));
    return list;
  }

  async function refresh() {
    if (loading) return items;
    loading = true; lastError = ''; render();
    try {
      items = await fetchDeadlines();
      await store.set({ cache: { updated: Date.now(), origin: ORIGIN, items } });
    } catch (e) {
      lastError = /401|403/.test(e.message) ? 'Please sign in to Blackboard.' : 'Could not load deadlines.';
    }
    loading = false; render();
    return items;
  }

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isDone = (it) => it.submitted === true || !!done[it.id];

  function urgency(it, now = Date.now()) {
    const t = new Date(it.due).getTime();
    if (isDone(it)) return 'done';
    if (t < now) return 'overdue';
    if (t - now < DAY) return 'today';
    if (t - now < 3 * DAY) return 'soon';
    return 'later';
  }

  function countdown(iso, now = Date.now()) {
    const ms = new Date(iso).getTime() - now;
    const a = Math.abs(ms), m = Math.round(a / 60000), h = Math.round(a / 3600000), d = Math.round(a / DAY);
    const span = m < 60 ? `${m}m` : h < 48 ? `${h}h` : `${d}d`;
    return ms < 0 ? `${span} ago` : `in ${span}`;
  }

  function when(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  const COLORS = { overdue: '#E5484D', today: '#F76B15', soon: '#E2A400', later: '#8E8E93', done: '#30A46C' };

  function visible() {
    const now = Date.now();
    return items.filter((it) => {
      const t = new Date(it.due).getTime();
      if (settings.hideSubmitted && isDone(it)) return false;
      if (t < now - 2 * DAY) return false;            // only recent overdue
      if (t < now && isDone(it)) return false;          // past + handed in → gone
      return true;
    });
  }

  /* ---------------- theme ---------------- */
  const FONTS = {
    default: '',
    rounded: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Nunito", sans-serif',
    clean: '"Inter", "Helvetica Neue", -apple-system, "Segoe UI", sans-serif',
    serif: '"Iowan Old Style", "Georgia", "Noto Serif", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  };

  let schoolColor = '';      // e.g. "rgb(166, 46, 66)" — measured once from the sidebar
  const COLOR_PROPS = ['background-color', 'background', 'color', 'border-color', 'border-left-color',
    'border-bottom-color', 'border-top-color', 'fill', 'stroke', 'outline-color'];

  /** Raise a selector's priority above Blackboard's without changing what it matches. */
  function boost(sel) {
    const i = sel.indexOf('::');
    return i >= 0 ? sel.slice(0, i) + ':not(#bloom-x)' + sel.slice(i) : sel + ':not(#bloom-x)';
  }

  /** Blackboard paints its sidebar, active tabs and buttons with the school's color, in many rules
   *  (some with !important). Find all of them and override each with your accent. */
  function accentRules(accent) {
    if (!schoolColor) return '';
    const target = schoolColor.replace(/\s/g, '');
    const out = [];
    const walk = (list) => {
      for (const r of list) {
        if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
        if (!r.selectorText || !r.style) continue;
        const props = COLOR_PROPS.filter((p) => (r.style.getPropertyValue(p) || '').replace(/\s/g, '').includes(target));
        if (!props.length) continue;
        const sel = r.selectorText.split(',').map((x) => boost(x.trim())).join(', ');
        out.push(`${sel} { ${props.map((p) => `${p === 'background' ? 'background-color' : p}: ${accent} !important;`).join(' ')} }`);
      }
    };
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode && sheet.ownerNode.id === 'bloom-theme') continue;
      try { walk(sheet.cssRules); } catch (e) { /* stylesheet from another site — skip */ }
    }
    return out.join('\n');
  }

  function measureSchoolColor() {
    const paper = document.querySelector('.MuiDrawer-paper');
    if (!paper) return false;
    const el = document.getElementById('bloom-theme');
    const saved = el ? el.textContent : '';
    if (el) el.textContent = '';
    const c = getComputedStyle(paper).backgroundColor;
    if (el) el.textContent = saved;
    if (c && c !== 'rgba(0, 0, 0, 0)') { schoolColor = c; return true; }
    return false;
  }

  function applyTheme() {
    let el = document.getElementById('bloom-theme');
    if (!el) { el = document.createElement('style'); el.id = 'bloom-theme'; (document.head || document.documentElement).appendChild(el); }
    if (!settings.theme) { el.textContent = ''; document.documentElement.classList.remove('bloom-dark'); return; }
    if (!schoolColor) measureSchoolColor();
    const a = settings.accent, f = FONTS[settings.font];
    el.textContent = `
      ${accentRules(a)}
      .MuiDrawer-paper:not(#bloom-x) { background-color: ${a} !important; }
      .MuiDrawer-paper .active:not(#bloom-x), .MuiDrawer-paper [aria-current="page"]:not(#bloom-x),
      .MuiDrawer-paper .Mui-selected:not(#bloom-x) { background-color: rgba(0,0,0,.16) !important; }
      ${f ? `body, body .MuiTypography-root, body .MuiButtonBase-root, body input, body button, body textarea,
             body h1, body h2, body h3, body h4, body p, body span, body a { font-family: ${f} !important; }` : ''}
      html.bloom-dark { filter: invert(.92) hue-rotate(180deg); background: #111 !important; }
      html.bloom-dark img, html.bloom-dark video, html.bloom-dark iframe, html.bloom-dark canvas,
      html.bloom-dark picture, html.bloom-dark svg image, html.bloom-dark [style*="background-image"],
      html.bloom-dark .MuiAvatar-root, html.bloom-dark #bloom-root { filter: invert(1) hue-rotate(180deg); }
    `;
    document.documentElement.classList.toggle('bloom-dark', !!settings.dark);
  }

  /* ---------------- floating widget (Shadow DOM keeps it separate from Blackboard's styles) ---------------- */
  let host, root, open = false;

  function mountWidget() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'bloom-root';
    root = host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(host);
    root.addEventListener('click', onClick);
  }

  function css() {
    const a = settings.accent, f = FONTS[settings.font] || '-apple-system, "Segoe UI", "Open Sans", sans-serif';
    const side = settings.side === 'left' ? 'left: 18px;' : 'right: 18px;';
    return `
      :host { all: initial; }
      * { box-sizing: border-box; font-family: ${f}; }
      .wrap { position: fixed; bottom: 18px; ${side} z-index: 2147483000; display: flex; flex-direction: column; align-items: ${settings.side === 'left' ? 'flex-start' : 'flex-end'}; gap: 10px; }
      .pill { display: inline-flex; align-items: center; gap: 8px; border: none; cursor: pointer;
        background: #fff; color: #1c1c1e; padding: 10px 16px; border-radius: 99px; font-size: 14px; font-weight: 700;
        box-shadow: 0 6px 24px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.05); }
      .pill .dot { width: 10px; height: 10px; border-radius: 99px; }
      .pill .flower { color: ${a}; font-size: 16px; }
      .panel { width: 360px; max-height: min(70vh, 560px); display: flex; flex-direction: column; background: #fff; color: #1c1c1e;
        border-radius: 18px; box-shadow: 0 16px 48px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.05); overflow: hidden; }
      .head { display: flex; align-items: center; gap: 8px; padding: 14px 16px 10px; border-bottom: 1px solid #f0f0f0; }
      .head h2 { margin: 0; font-size: 16px; flex: 1; }
      .head h2 span { color: ${a}; }
      .icon { border: none; background: #f4f4f5; width: 28px; height: 28px; border-radius: 99px; cursor: pointer; font-size: 14px; color: #555; }
      .icon:hover { background: #ebebee; }
      .list { overflow-y: auto; padding: 6px 8px 8px; }
      .group { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #8e8e93; padding: 10px 8px 4px; }
      .item { display: flex; gap: 10px; padding: 9px 8px; border-radius: 12px; cursor: pointer; text-decoration: none; color: inherit; position: relative; }
      .item:hover { background: #f6f6f7; }
      .bar { width: 4px; border-radius: 4px; flex: none; }
      .body { flex: 1; min-width: 0; }
      .row1 { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
      .code { font-size: 11px; font-weight: 800; padding: 1px 7px; border-radius: 99px; color: #fff; white-space: nowrap; }
      .cd { font-size: 12px; font-weight: 800; margin-left: auto; white-space: nowrap; }
      .title { font-size: 13.5px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .meta { font-size: 12px; color: #8e8e93; margin-top: 3px; display: flex; gap: 6px; align-items: center; }
      .ok { color: #30A46C; font-weight: 700; }
      .no { color: #E5484D; font-weight: 700; }
      .item.done .title { color: #8e8e93; text-decoration: line-through; }
      .tick { position: absolute; right: 8px; bottom: 8px; border: 1px solid #e5e5ea; background: #fff; border-radius: 99px; font-size: 11px;
        padding: 2px 8px; cursor: pointer; color: #555; display: none; }
      .item:hover .tick { display: inline-block; }
      .foot { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 12px 12px; border-top: 1px solid #f0f0f0; }
      .btn { border: none; cursor: pointer; border-radius: 10px; padding: 8px 11px; font-size: 12.5px; font-weight: 700; background: #f4f4f5; color: #1c1c1e; }
      .btn.main { background: ${a}; color: #fff; }
      .btn:hover { filter: brightness(.97); }
      .empty, .err { padding: 26px 16px; text-align: center; color: #8e8e93; font-size: 13.5px; line-height: 1.6; }
      .err { color: #E5484D; }
      .small { font-size: 11px; color: #aeaeb2; padding: 0 16px 10px; }
      label.toggle { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #555; margin-right: auto; cursor: pointer; }
    `;
  }

  function groupOf(it, now) {
    const u = urgency(it, now);
    if (u === 'overdue') return 'Overdue';
    const d = new Date(it.due), today = new Date(now);
    const days = Math.round((new Date(d.toDateString()) - new Date(today.toDateString())) / DAY);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return 'This week';
    return 'Later';
  }

  function render() {
    if (!settings.widget) { if (host) host.remove(); host = null; return; }
    mountWidget();
    const now = Date.now();
    const list = visible();
    const pending = list.filter((it) => !isDone(it) && new Date(it.due).getTime() - now < 7 * DAY);
    const worst = pending.length ? urgency(pending[0], now) : 'done';
    const label = pending.length ? `${pending.length} due this week` : 'All caught up';

    let html = `<style>${css()}</style><div class="wrap">`;
    if (open) {
      html += `<div class="panel">
        <div class="head"><h2><span>✿</span> Deadlines</h2>
          <button class="icon" data-act="refresh" title="Refresh">${loading ? '…' : '↻'}</button>
          <button class="icon" data-act="close" title="Close">✕</button></div>`;
      if (lastError) html += `<div class="err">${esc(lastError)}</div>`;
      else if (!items.length && loading) html += `<div class="empty">Loading your deadlines…</div>`;
      else if (!list.length) html += `<div class="empty">Nothing due in the next ${settings.days} days ✿</div>`;
      else {
        html += '<div class="list">';
        let current = '';
        for (const it of list) {
          const g = groupOf(it, now);
          if (g !== current) { html += `<div class="group">${g}</div>`; current = g; }
          const u = urgency(it, now);
          const status = it.submitted === true ? '<span class="ok">✓ Submitted</span>'
            : done[it.id] ? '<span class="ok">✓ Done</span>'
            : it.submitted === false ? '<span class="no">Not submitted</span>' : '';
          html += `<a class="item ${isDone(it) ? 'done' : ''}" href="${esc(it.url)}" data-id="${esc(it.id)}">
            <span class="bar" style="background:${COLORS[u]}"></span>
            <span class="body">
              <span class="row1"><span class="code" style="background:${esc(it.color)}">${esc(it.code)}</span>
                <span class="cd" style="color:${COLORS[u]}">${countdown(it.due, now)}</span></span>
              <span class="title">${esc(it.title)}</span>
              <span class="meta">${when(it.due)}${status ? ' · ' + status : ''}</span>
            </span>
            ${it.submitted === true ? '' : `<button class="tick" data-act="tick" data-id="${esc(it.id)}">${done[it.id] ? 'Undo' : 'Mark done'}</button>`}
          </a>`;
        }
        html += '</div>';
      }
      html += `<div class="foot">
          <label class="toggle"><input type="checkbox" data-act="hide" ${settings.hideSubmitted ? 'checked' : ''}> Hide finished</label>
          <button class="btn" data-act="ics" title="Add to Apple / Google Calendar">📅 Calendar</button>
          <button class="btn main" data-act="edgetodo" title="Send to EdgeTodo">→ EdgeTodo</button>
        </div>
        <div class="small">${note ? `<b style="color:#30A46C">${esc(note)}</b>` : 'Bloom for Blackboard · not affiliated with Blackboard'}</div>
      </div>`;
    }
    html += `<button class="pill" data-act="toggle"><span class="flower">✿</span>${esc(label)}
      ${pending.length ? `<span class="dot" style="background:${COLORS[worst]}"></span>` : ''}</button></div>`;
    root.innerHTML = html;
  }

  async function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act !== 'hide') e.preventDefault();
    if (act === 'toggle') { open = !open; render(); if (open && !loading) refresh(); }
    if (act === 'close') { open = false; render(); }
    if (act === 'refresh') refresh();
    if (act === 'tick') {
      e.stopPropagation();
      const id = t.dataset.id;
      if (done[id]) delete done[id]; else done[id] = Date.now();
      await store.set({ done }); render();
    }
    if (act === 'hide') { settings.hideSubmitted = t.checked; await store.set({ settings }); render(); }
    if (act === 'ics') {
      download('blackboard-deadlines.ics', toICS(items.filter((i) => !isDone(i))), 'text/calendar');
      flashNote('Saved — open the downloaded file to add it to your calendar.');
    }
    if (act === 'edgetodo') {
      download('edgetodo-import.json', toEdgeTodo(items.filter((i) => !isDone(i))), 'application/json');
      flashNote('Saved to Downloads — EdgeTodo picks it up if Settings → Import is on, or use its menu → Import Tasks…');
    }
  }

  let noteTimer;
  function flashNote(text) {
    note = text; render();
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note = ''; render(); }, 7000);
  }

  /* ---------------- export ---------------- */
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function icsDate(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n'); }

  function toICS(list) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bloom for Blackboard//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Blackboard deadlines'];
    const stamp = icsDate(new Date().toISOString());
    for (const it of list) {
      lines.push('BEGIN:VEVENT', `UID:${it.id}@bloom-for-blackboard`, `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(it.due)}`, `DTEND:${icsDate(it.due)}`,
        `SUMMARY:${icsText(`[${it.code}] ${it.title}`)}`, `DESCRIPTION:${icsText(it.course)}`, `URL:${it.url}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(it.title)}`, 'TRIGGER:-P1D', 'END:VALARM',
        'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /** EdgeTodo (github.com/tllct122/edge-todo-for-mac) picks this file up from Downloads. */
  function toEdgeTodo(list) {
    const pad = (n) => String(n).padStart(2, '0');
    const local = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    return JSON.stringify({
      todos: list.map((it) => ({ id: `bb:${it.id}`, title: it.title, category: it.code.toLowerCase(), due: local(it.due), status: 'todo' })),
    }, null, 2);
  }

  /* ---------------- messages from the toolbar popup ---------------- */
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === 'bloom:refresh') { refresh().then((list) => reply({ ok: !lastError, items: list, error: lastError })); return true; }
    if (msg && msg.type === 'bloom:open') { open = true; render(); refresh(); reply({ ok: true }); }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) { settings = { ...DEFAULTS, ...changes.settings.newValue }; applyTheme(); render(); }
    if (changes.done) { done = changes.done.newValue || {}; render(); }
  });

  let themeTimer;
  function watchForStyles() {
    const obs = new MutationObserver((muts) => {
      const relevant = muts.some((m) => [...m.addedNodes].some((n) =>
        n.nodeType === 1 && (n.tagName === 'STYLE' || n.tagName === 'LINK' || (n.querySelector && n.querySelector('.MuiDrawer-paper')))));
      if (!relevant) return;
      clearTimeout(themeTimer);
      themeTimer = setTimeout(() => { if (settings.theme) applyTheme(); }, 400);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------------- start ---------------- */
  (async () => {
    const saved = await store.get(['settings', 'cache', 'done']);
    settings = { ...DEFAULTS, ...(saved.settings || {}) };
    done = saved.done || {};
    if (saved.cache && saved.cache.origin === ORIGIN) items = saved.cache.items || [];
    applyTheme();
    watchForStyles();
    render();
    // Blackboard keeps you on one page while you click around; refresh now and every 15 minutes.
    if (!location.pathname.startsWith('/learn/api')) {
      refresh();
      setInterval(() => { if (!document.hidden) refresh(); }, 15 * 60 * 1000);
      setInterval(render, 60 * 1000);   // keep countdowns current
    }
  })();
})();
