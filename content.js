// Bloom — runs on your school's Blackboard Learn (Ultra) or Canvas site.
// Shows your upcoming deadlines in a small floating panel, and restyles the site to your taste.
// Everything is read from your own signed-in session and kept in your browser. Nothing is sent anywhere else.

/* global BLOOM_THEME_DEFAULTS, bloomFontStack, bloomFontFaces, bloomTheme, bloomRGBA, bloomIsLight */

(() => {
  if (window.__bloomLoaded) return;
  window.__bloomLoaded = true;

  const ORIGIN = location.origin;
  const DEFAULTS = { days: 14, hideSubmitted: false, widget: true, side: 'right', platform: 'auto', edgetodoSync: false };
  const DAY = 86400000;

  /* ---------------- storage ---------------- */
  const store = {
    get: (keys) => chrome.storage.local.get(keys),
    set: (obj) => chrome.storage.local.set(obj),
  };
  let settings = { ...DEFAULTS };
  let theme = { ...BLOOM_THEME_DEFAULTS };
  let platform = null;    // 'blackboard' | 'canvas'
  let items = [];
  let done = {};          // manually ticked items
  let loading = false;
  let lastError = '';
  let note = '';          // short message under the panel buttons

  /* ---------------- shared helpers ---------------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isDone = (it) => it.submitted === true || !!done[it.id];
  const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  async function getJSON(url) {
    const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = (await r.text()).replace(/^while\(1\);/, '');   // Canvas adds this guard
    const link = r.headers.get('Link') || '';
    const next = (link.match(/<([^>]+)>;\s*rel="next"/) || [])[1] || '';
    return { data: JSON.parse(text), next: next && new URL(next, ORIGIN).origin === ORIGIN ? next : '' };
  }

  async function pool(list, n, fn) {
    const queue = [...list];
    await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    }));
  }

  /** "2026_1_SEHS2306_A01: 2026-1 SEHS2306 INTRO TO …" → code "SEHS2306", name "Intro To …" */
  function parseCourse(full = '') {
    let code = (full.match(/\b([A-Z]{2,6}\s?\d{3,5}[A-Z]?)\b/) || [])[1] || '';
    let name = full.includes(':') ? full.split(':').slice(1).join(':').trim() : full;
    name = name.replace(/^\d{4}-\d\s+/, '').replace(code, '').replace(/\(.*?\)\s*$/, '').trim();
    if (name === name.toUpperCase()) name = titleCase(name);
    if (!code && full.includes(':')) {
      // course ID like "2026_1_ACI-UD" or "2026_1-UNIT_LC-EEP-AEEW" → "ACI-UD" / "LC-EEP-AEEW"
      const id = full.split(':')[0].replace(/^\d{4}_\d+[-_]?/, '');
      code = id.split('_').filter(Boolean).pop() || '';
    }
    return { code: (code || name.split(' ').slice(0, 2).join(' ')).slice(0, 14), name };
  }

  /* ================= platforms ================= */
  const SUBMITTED = ['NeedsGrading', 'Completed', 'Submitted', 'InProgressGraded'];

  const PLATFORMS = {
    /* ---------- Blackboard Learn Ultra ---------- */
    blackboard: {
      name: 'Blackboard',
      home: '/ultra/course',
      idPrefix: 'bb',
      looksLike: () => !!document.querySelector('.MuiDrawer-paper, #site-wrap, .base-navigation') || /^\/(ultra|webapps)\b/.test(location.pathname),
      probe: () => getJSON(ORIGIN + '/learn/api/public/v1/users/me').then((r) => !!(r.data && r.data.userName)),

      async fetch(days) {
        const now = Date.now();
        const since = new Date(now - 3 * DAY).toISOString();
        const until = new Date(now + days * DAY).toISOString();
        let path = `/learn/api/public/v1/calendars/items?since=${since}&until=${until}`;
        const raw = [];
        for (let page = 0; path && page < 8; page++) {
          const { data } = await getJSON(ORIGIN + path);
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
            const { data } = await getJSON(`${ORIGIN}/learn/api/public/v2/courses/${it.courseId}/gradebook/columns/${it.id}/attempts?fields=id,status`);
            it.submitted = (data.results || []).some((x) => SUBMITTED.includes(x.status));
          } catch (e) { it.submitted = null; }
        });
        return list;
      },

      /** The school's colors, measured with Bloom's styles switched off. */
      measure() {
        const paper = document.querySelector('.MuiDrawer-paper');
        if (!paper) return null;
        const bg = (el) => getComputedStyle(el).backgroundColor;
        const primary = bg(paper);
        if (!primary || primary === 'rgba(0, 0, 0, 0)') return null;
        // the highlighted menu item uses a darker shade of the school color
        let active = '';
        const picks = [...paper.querySelectorAll('[aria-current], .active, .Mui-selected'), ...paper.querySelectorAll('a, li, button')];
        for (const el of picks) {
          const c = bg(el);
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== primary && !/255, 255, 255/.test(c)) { active = c; break; }
        }
        return { primary, active };
      },

      sel: {
        sidebar: ['.MuiDrawer-paper', '.themed-logo-background-primary-fill', '.color-selection-live-mode .themed-background-primary-fill-only'],
        sidebarText: '.MuiDrawer-paper :is(a, span, p, div, h1, h2, h3, li, button, svg)',
        page: ['body', '#site-wrap', '.off-canvas-wrap', '#main-content', 'aside'],
        card: ['.element-card', '.course-element-card', '.MuiCard-root'],
        text: '#main-content :is(h1, h2, h3, h4), h1#main-heading, .page-title, .element-card :is(h2, h3, h4, .course-title)',
        main: '#main-content',
      },
    },

    /* ---------- Canvas LMS ---------- */
    canvas: {
      name: 'Canvas',
      home: '/',
      idPrefix: 'cv',
      looksLike: () => !!document.querySelector('#application.ic-app, .ic-app, #header.ic-app-header, .ic-app-header'),
      probe: () => getJSON(ORIGIN + '/api/v1/users/self').then((r) => !!(r.data && r.data.id && 'short_name' in r.data)),

      async fetch(days) {
        const now = Date.now();
        const start = new Date(now - 3 * DAY).toISOString();
        const end = new Date(now + days * DAY).toISOString();
        // course codes and your course colors (best effort)
        const courses = {};
        try {
          let url = `${ORIGIN}/api/v1/courses?enrollment_state=active&per_page=100`;
          for (let p = 0; url && p < 4; p++) {
            const r = await getJSON(url);
            for (const c of r.data || []) courses[c.id] = { code: c.course_code || '', name: c.name || '' };
            url = r.next;
          }
        } catch (e) { /* not essential */ }
        let colors = {};
        try { colors = (await getJSON(`${ORIGIN}/api/v1/users/self/colors`)).data.custom_colors || {}; } catch (e) { /* not essential */ }

        const raw = [];
        let url = `${ORIGIN}/api/v1/planner/items?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&per_page=100`;
        for (let p = 0; url && p < 8; p++) {
          const r = await getJSON(url);
          raw.push(...(r.data || []));
          url = r.next;
        }
        const KINDS = ['assignment', 'quiz', 'discussion_topic', 'sub_assignment', 'planner_note', 'assessment_request'];
        const seen = new Set();
        return raw
          .filter((i) => KINDS.includes(i.plannable_type))
          .map((i) => {
            const pl = i.plannable || {};
            const due = pl.due_at || pl.todo_date || i.plannable_date;
            const id = `${i.plannable_type}:${i.plannable_id}`;
            const course = courses[i.course_id] || {};
            const parsed = parseCourse(course.name || i.context_name || '');
            const sub = i.submissions;
            let submitted = null;
            if (sub && typeof sub === 'object') submitted = !!(sub.submitted || sub.excused || sub.graded);
            if (i.planner_override && i.planner_override.marked_complete) submitted = true;
            return {
              id, courseId: i.course_id, code: (course.code || parsed.code || 'To do').slice(0, 14),
              course: course.name || i.context_name || '', title: pl.title || pl.name || 'Untitled',
              due, color: colors[`course_${i.course_id}`] || '#6B7780', submitted,
              url: i.html_url ? new URL(i.html_url, ORIGIN).href : ORIGIN,
            };
          })
          .filter((i) => i.due && !seen.has(i.id) && seen.add(i.id));
      },

      measure() {
        const v = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const primary = v('--ic-brand-primary');
        const nav = v('--ic-brand-global-nav-bgd');
        const header = document.querySelector('.ic-app-header, #header');
        return { primary: toRGB(primary), active: '', nav: toRGB(nav || (header ? getComputedStyle(header).backgroundColor : '')) };
      },

      sel: {
        sidebar: ['#header.ic-app-header', '.ic-app-header', '.ic-app-header__logomark-container'],
        page: ['body', '#application', '#wrapper', '.ic-Layout-wrapper', '.ic-Layout-contentMain', '#content-wrapper', '#right-side-wrapper', '#main'],
        card: ['.ic-DashboardCard', '.context_module', '.ig-list .ig-row', '.PlannerApp [class*="Day-styles__root"]'],
        text: '.ic-Dashboard-header__title, #content :is(h1, h2, h3), .ic-DashboardCard__header-title, .page-title',
        main: '#content',
      },

      /** Canvas paints its brand with CSS variables, which makes it easy to recolor. */
      vars(t, navText) {
        const out = [];
        if (t.sidebar) out.push(
          `--ic-brand-global-nav-bgd: ${t.sidebar}`, `--ic-brand-global-nav-logo-bgd: ${t.sidebar}`,
          `--ic-brand-global-nav-ic-icon-svg-fill: ${navText}`, `--ic-brand-global-nav-menu-item__text-color: ${navText}`,
          `--ic-brand-global-nav-avatar-border: ${navText}`);
        if (t.accent) out.push(
          `--ic-brand-primary: ${t.accent}`, `--ic-brand-primary-darkened-5: ${t.accent}`, `--ic-brand-primary-darkened-10: ${t.accent}`,
          `--ic-brand-primary-darkened-15: ${t.accent}`, `--ic-brand-primary-lightened-5: ${t.accent}`,
          `--ic-brand-button--primary-bgd: ${t.accent}`, `--ic-brand-button--primary-bgd-darkened-5: ${t.accent}`,
          `--ic-brand-button--primary-bgd-darkened-15: ${t.accent}`, `--ic-link-color: ${t.accent}`,
          `--ic-link-color-darkened-10: ${t.accent}`, `--ic-link-color-lighter: ${t.accent}`,
          `--ic-brand-global-nav-ic-icon-svg-fill--active: ${t.accent}`, `--ic-brand-global-nav-menu-item__text-color--active: ${t.accent}`);
        return out.length ? `:root:not(#bloom-x) { ${out.map((x) => x + ' !important').join('; ')}; }` : '';
      },
    },
  };

  async function detectPlatform() {
    if (settings.platform === 'blackboard' || settings.platform === 'canvas') return settings.platform;
    if (PLATFORMS.canvas.looksLike()) return 'canvas';
    if (PLATFORMS.blackboard.looksLike()) return 'blackboard';
    for (const key of ['canvas', 'blackboard']) {
      try { if (await PLATFORMS[key].probe()) return key; } catch (e) { /* not this one */ }
    }
    return null;
  }

  /* ---------------- deadlines ---------------- */
  async function refresh() {
    if (loading || !platform) return items;
    loading = true; lastError = ''; render();
    try {
      items = await PLATFORMS[platform].fetch(settings.days);
      items.sort((a, b) => new Date(a.due) - new Date(b.due));
      await store.set({ cache: { updated: Date.now(), origin: ORIGIN, platform, items } });
    } catch (e) {
      lastError = /401|403/.test(e.message) ? `Please sign in to ${PLATFORMS[platform].name}.` : 'Could not load deadlines.';
    }
    loading = false; render();
    return items;
  }

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

  /* ================= theme ================= */
  let school = null;         // { primary, active, nav } measured from the page
  const COLOR_PROPS = ['background-color', 'background', 'color', 'border-color', 'border-left-color',
    'border-bottom-color', 'border-top-color', 'border-right-color', 'fill', 'stroke', 'outline-color', 'box-shadow'];

  function toRGB(c) {
    if (!c) return '';
    const probe = document.createElement('i');
    probe.style.color = c;
    if (!probe.style.color) return '';
    document.documentElement.appendChild(probe);
    const out = getComputedStyle(probe).color;
    probe.remove();
    return out;
  }

  /** Raise a selector's priority above the site's without changing what it matches. */
  function boost(sel) {
    const i = sel.indexOf('::');
    return i >= 0 ? sel.slice(0, i) + ':not(#bloom-x)' + sel.slice(i) : sel + ':not(#bloom-x)';
  }
  const boostAll = (list) => (Array.isArray(list) ? list : [list]).map(boost).join(', ');

  /** Sites paint their brand color in many rules (some with !important).
   *  Find every rule using one of the measured colors and override it with yours. */
  function recolorRules(map) {
    const pairs = map.filter((m) => m.from && m.to).map((m) => ({ from: m.from.replace(/\s/g, ''), to: m.to }));
    if (!pairs.length) return '';
    const out = [];
    const walk = (list) => {
      for (const r of list) {
        if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
        if (!r.selectorText || !r.style) continue;
        const decl = [];
        for (const p of COLOR_PROPS) {
          const v = (r.style.getPropertyValue(p) || '').replace(/\s/g, '');
          if (!v) continue;
          const hit = pairs.find((x) => v.includes(x.from));
          if (!hit) continue;
          if (p === 'box-shadow') continue;  // leave shadows alone, just don't break them
          decl.push(`${p === 'background' ? 'background-color' : p}: ${hit.to} !important;`);
        }
        if (decl.length) out.push(`${r.selectorText.split(',').map((x) => boost(x.trim())).join(', ')} { ${decl.join(' ')} }`);
      }
    };
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode && sheet.ownerNode.id === 'bloom-theme') continue;
      try { walk(sheet.cssRules); } catch (e) { /* stylesheet from another site — skip */ }
    }
    return out.join('\n');
  }

  function themeElement() {
    let el = document.getElementById('bloom-theme');
    if (!el) { el = document.createElement('style'); el.id = 'bloom-theme'; (document.head || document.documentElement).appendChild(el); }
    return el;
  }

  function measure() {
    const P = PLATFORMS[platform];
    if (!P) return;
    const el = themeElement();
    const saved = el.textContent;
    el.textContent = '';
    const dark = document.documentElement.classList.contains('bloom-dark');
    document.documentElement.classList.remove('bloom-dark');
    const m = P.measure();
    el.textContent = saved;
    if (dark) document.documentElement.classList.add('bloom-dark');
    if (m && m.primary) school = m;
  }

  /** Font only on text, never on icon fonts. */
  const TEXT_EL = 'body :is(h1, h2, h3, h4, h5, h6, p, a, span, li, td, th, label, button, input, textarea, select, div, strong, em, small, b)';

  function buildCSS(t) {
    const P = PLATFORMS[platform];
    if (!P) return '';
    const S = P.sel;
    const css = [bloomFontFaces(chrome.runtime.getURL, t)];
    const navText = bloomIsLight(t.sidebar) ? '#2B2530' : '#FFFFFF';
    const darker = t.sidebar ? `color-mix(in srgb, ${t.sidebar} 78%, #000)` : '';

    // 1. brand color everywhere → your accent; the darker menu shade → a darker sidebar
    if (school) {
      css.push(recolorRules([
        { from: school.active, to: darker },
        { from: school.nav, to: t.sidebar },
        { from: school.primary, to: t.accent },
      ]));
    }
    if (P.vars) css.push(P.vars(t, navText));

    // 2. the big surfaces
    if (t.sidebar) {
      css.push(`${boostAll(S.sidebar)} { background-color: ${t.sidebar} !important; background-image: none !important; }`);
      if (S.sidebarText && bloomIsLight(t.sidebar)) css.push(`${boost(S.sidebarText)} { color: ${navText} !important; }`);
    }
    if (t.page || t.image) {
      const base = t.page || '#FFFFFF';
      css.push(`${boostAll(S.page)} { background-color: ${base} !important; }`);
      if (t.image && /^data:image\/[\w+.-]+;base64,[\w+/=]+$/.test(t.image)) {
        const veil = bloomRGBA(base, Math.max(0, Math.min(1, 1 - t.imageStrength)));
        css.push(`body:not(#bloom-x) { background-image: linear-gradient(${veil}, ${veil}), url("${t.image}") !important;
          background-size: cover !important; background-position: center !important; background-attachment: fixed !important; }`);
        css.push(`${boostAll(S.page.filter((s) => s !== 'body'))} { background-color: transparent !important; }`);
      }
    }
    if (t.card) css.push(`${boostAll(S.card)} { background-color: ${t.card} !important; }`);
    if (+t.radius > 0) css.push(`${boostAll(S.card)} { border-radius: ${+t.radius}px !important; overflow: hidden; }`);
    if (t.text) css.push(`${boost(S.text)} { color: ${t.text} !important; }`);

    // 3. type
    const font = bloomFontStack(t);
    if (font) css.push(`${TEXT_EL}:not([class*="icon"]):not([class*="Icon"]):not(#bloom-x) { font-family: ${font} !important; }`);
    if (+t.size && +t.size !== 100) css.push(`${boost(S.main)} { zoom: ${+t.size / 100}; }`);

    // 4. dark mode (flip the page, keep pictures natural)
    css.push(`html.bloom-dark { filter: invert(.92) hue-rotate(180deg); background: #111 !important; }
      html.bloom-dark img, html.bloom-dark video, html.bloom-dark iframe, html.bloom-dark canvas,
      html.bloom-dark picture, html.bloom-dark svg image, html.bloom-dark [style*="background-image"],
      html.bloom-dark .MuiAvatar-root, html.bloom-dark #bloom-root { filter: invert(1) hue-rotate(180deg); }`);

    // 5. your own CSS, last
    if (t.css) css.push(String(t.css).replace(/<\/style/gi, ''));
    return css.filter(Boolean).join('\n');
  }

  function applyTheme() {
    const el = themeElement();
    if (!theme.enabled || !platform) { el.textContent = ''; document.documentElement.classList.remove('bloom-dark'); return; }
    if (!school) measure();
    el.textContent = buildCSS(theme);
    document.documentElement.classList.toggle('bloom-dark', !!theme.dark);
  }

  /* ---------------- floating widget (Shadow DOM keeps it separate from the site's styles) ---------------- */
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
    const a = theme.accent || '#FF6FAE';
    const f = (theme.enabled && bloomFontStack(theme)) || '-apple-system, "Segoe UI", "Open Sans", sans-serif';
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
      .btn.main { background: ${a}; color: ${bloomIsLight(a) ? '#1c1c1e' : '#fff'}; }
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
    if (!settings.widget || !platform) { if (host) host.remove(); host = null; return; }
    mountWidget();
    const now = Date.now();
    const list = visible();
    const pending = list.filter((it) => !isDone(it) && new Date(it.due).getTime() - now < 7 * DAY);
    const worst = pending.length ? urgency(pending[0], now) : 'done';
    const label = pending.length ? `${pending.length} due this week` : 'All caught up';
    const lms = PLATFORMS[platform].name;

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
          <button class="btn main" data-act="edgetodo" title="Send to EdgeTodo">${settings.edgetodoSync ? '↻ EdgeTodo' : '→ EdgeTodo'}</button>
        </div>
        <div class="small">${note ? `<b style="color:#30A46C">${esc(note)}</b>` : `Bloom · not affiliated with ${lms}`}</div>
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
    if (act === 'hide') {
      settings.hideSubmitted = t.checked;
      const saved = (await store.get('settings')).settings || {};
      await store.set({ settings: { ...saved, hideSubmitted: t.checked } }); render();
    }
    if (act === 'ics') {
      download('deadlines.ics', toICS(items.filter((i) => !isDone(i))), 'text/calendar');
      flashNote('Saved — open the downloaded file to add it to your calendar.');
    }
    if (act === 'edgetodo') {
      if (settings.edgetodoSync) {
        const r = await chrome.runtime.sendMessage({ type: 'bloom:edgetodo-sync' }).catch(() => null);
        if (r && r.ok) { flashNote(`Synced with EdgeTodo ✓${r.added ? ` — ${r.added} new` : ''}`); return; }
      }
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
    const lms = PLATFORMS[platform].name;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bloom//Deadlines//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${lms} deadlines`];
    const stamp = icsDate(new Date().toISOString());
    for (const it of list) {
      lines.push('BEGIN:VEVENT', `UID:${PLATFORMS[platform].idPrefix}-${String(it.id).replace(/[^\w.-]/g, '-')}@bloom`, `DTSTAMP:${stamp}`,
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
    const prefix = PLATFORMS[platform].idPrefix;
    return JSON.stringify({
      todos: list.map((it) => ({ id: `${prefix}:${it.id}`, title: it.title, category: it.code.toLowerCase(), due: local(it.due), status: 'todo' })),
    }, null, 2);
  }

  /* ---------------- messages from the toolbar popup ---------------- */
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === 'bloom:refresh') { refresh().then((list) => reply({ ok: !lastError && !!platform, items: list, error: lastError })); return true; }
    if (msg && msg.type === 'bloom:open') { open = true; render(); refresh(); reply({ ok: true }); }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      const before = settings.platform;
      settings = { ...DEFAULTS, ...changes.settings.newValue };
      if (settings.platform !== before) start();
      else render();
    }
    if (changes.theme) { theme = { ...BLOOM_THEME_DEFAULTS, ...changes.theme.newValue }; applyTheme(); render(); }
    if (changes.done) { done = changes.done.newValue || {}; render(); }
  });

  let themeTimer;
  function watchForStyles() {
    const obs = new MutationObserver((muts) => {
      const relevant = muts.some((m) => [...m.addedNodes].some((n) =>
        n.nodeType === 1 && n.id !== 'bloom-root' && (n.tagName === 'STYLE' || n.tagName === 'LINK' ||
          (n.querySelector && n.querySelector('.MuiDrawer-paper, .ic-app-header, .element-card, .ic-DashboardCard')))));
      if (!relevant) return;
      clearTimeout(themeTimer);
      themeTimer = setTimeout(() => { if (theme.enabled) { if (!school) measure(); applyTheme(); } }, 400);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------------- start ---------------- */
  let timersOn = false;
  async function start() {
    platform = await detectPlatform();
    school = null;
    applyTheme();
    render();
    if (!platform || /^\/(learn\/)?api\//.test(location.pathname)) return;
    refresh();
    if (!timersOn) {
      timersOn = true;
      // The site keeps you on one page while you click around; refresh every 15 minutes.
      setInterval(() => { if (!document.hidden) refresh(); }, 15 * 60 * 1000);
      setInterval(render, 60 * 1000);   // keep countdowns current
    }
  }

  (async () => {
    const saved = await store.get(['settings', 'theme', 'cache', 'done']);
    settings = { ...DEFAULTS, ...(saved.settings || {}) };
    theme = bloomTheme(saved);
    done = saved.done || {};
    if (saved.cache && saved.cache.origin === ORIGIN) items = saved.cache.items || [];
    watchForStyles();
    await start();
  })();
})();
