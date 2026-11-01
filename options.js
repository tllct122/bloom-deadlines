/* global BLOOM_THEME_DEFAULTS, BLOOM_PRESETS, BLOOM_FONTS, bloomFontStack, bloomFontFaces, bloomTheme, bloomRGBA, bloomIsLight */

const DEFAULTS = { days: 14, hideSubmitted: false, widget: true, side: 'right', host: '', platform: 'auto', edgetodoSync: false };
const COLOR_FIELDS = [
  ['sidebar', 'Side menu & top bar'],
  ['accent', 'Buttons & links'],
  ['page', 'Page background'],
  ['card', 'Cards'],
  ['text', 'Headings'],
];
const $ = (s) => document.querySelector(s);
let settings = { ...DEFAULTS };
let theme = { ...BLOOM_THEME_DEFAULTS };
const lastColor = {};   // remembers a color while it's switched off

/* ---------------- saving ---------------- */
async function saveSettings() { await chrome.storage.local.set({ settings }); }
let themeTimer;
function saveTheme(now) {
  paint();
  clearTimeout(themeTimer);
  const go = () => chrome.storage.local.set({ theme }).catch((e) => note(`Couldn't save: ${e.message}`, false));
  if (now) go(); else themeTimer = setTimeout(go, 120);
}
function edited(patch) { Object.assign(theme, patch, { preset: 'custom' }); saveTheme(); }

function status(text, ok) { const el = $('#status'); el.textContent = text; el.className = 'status ' + (ok ? 'ok' : 'warn'); }
let noteTimer;
function note(text, ok = true) {
  const el = $('#themeNote'); el.textContent = text; el.className = 'status ' + (ok ? 'ok' : 'warn');
  clearTimeout(noteTimer); noteTimer = setTimeout(() => { el.textContent = ''; }, 5000);
}

/* ---------------- building the controls ---------------- */
function buildPresets() {
  $('#presets').innerHTML = Object.entries(BLOOM_PRESETS).map(([key, p]) => `
    <button class="preset" data-preset="${key}" title="${p.name}">
      <span class="dots">${[p.sidebar, p.accent, p.page, p.card].map((c) => `<i style="background:${c}"></i>`).join('')}</span>
      <span>${p.name}</span></button>`).join('') +
    `<span class="preset custom-tag" id="customTag">✎ Custom</span>`;
  $('#presets').onclick = (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    const p = BLOOM_PRESETS[b.dataset.preset];
    const { name, ...rest } = p;
    theme = { ...theme, dark: false, text: '', ...rest, preset: b.dataset.preset, enabled: true };
    fill(); saveTheme(true);
  };
}

function buildColors() {
  $('#colors').innerHTML = COLOR_FIELDS.map(([k, label]) => `
    <div class="color-row" data-k="${k}">
      <label class="chip"><input type="color" data-color="${k}"><span class="chip-sw"></span></label>
      <span class="color-label">${label}<small class="hex"></small></span>
      <button class="off" data-off="${k}" title="Keep the school's own color">⌀</button>
    </div>`).join('');
  $('#colors').addEventListener('input', (e) => {
    const k = e.target.dataset.color; if (!k) return;
    edited({ [k]: e.target.value.toUpperCase() }); fillColors();
  });
  $('#colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-off]'); if (!b) return;
    const k = b.dataset.off;
    if (theme[k]) { lastColor[k] = theme[k]; edited({ [k]: '' }); }
    else edited({ [k]: lastColor[k] || BLOOM_THEME_DEFAULTS[k] || '#FF6FAE' });
    fillColors();
  });
}

function buildFonts() {
  $('#t-font').innerHTML = Object.entries(BLOOM_FONTS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('');
}

/* ---------------- showing the current values ---------------- */
function fillColors() {
  for (const [k] of COLOR_FIELDS) {
    const row = document.querySelector(`.color-row[data-k="${k}"]`);
    const v = theme[k];
    row.classList.toggle('is-off', !v);
    row.querySelector('input').value = v || lastColor[k] || '#FFFFFF';
    row.querySelector('.chip-sw').style.background = v || 'repeating-linear-gradient(45deg,#eee 0 6px,#fff 6px 12px)';
    row.querySelector('.hex').textContent = v ? v : "school's own";
  }
}

function fill() {
  $('#t-enabled').checked = !!theme.enabled;
  $('#t-dark').checked = !!theme.dark;
  $('#t-font').value = theme.font in BLOOM_FONTS ? theme.font : 'default';
  $('#t-customFont').value = theme.customFont || '';
  $('#fontName').textContent = theme.fontData ? theme.fontName || 'Uploaded font' : 'No file yet';
  $('#t-size').value = theme.size; $('#t-radius').value = theme.radius; $('#t-imageStrength').value = theme.imageStrength;
  $('#t-css').value = theme.css || '';
  if (theme.css) $('.adv').open = true;
  fillColors();
  paint();
}

/** Labels, presets and the little preview. */
function paint() {
  $('#v-size').textContent = `${theme.size}%`;
  $('#v-radius').textContent = `${theme.radius}px`;
  $('#v-imageStrength').textContent = `${Math.round(theme.imageStrength * 100)}%`;
  $('#font-custom').hidden = theme.font !== 'custom';
  $('#font-upload').hidden = theme.font !== 'upload';
  $('#imageRemove').hidden = !theme.image;
  $('#strength-field').hidden = !theme.image;
  document.querySelectorAll('.preset[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === theme.preset));
  $('#customTag').classList.toggle('on', theme.preset === 'custom');
  document.querySelector('.theme-grid').classList.toggle('disabled', !theme.enabled);
  document.documentElement.style.setProperty('--accent', theme.accent || '#FF6FAE');

  // preview
  let faces = document.getElementById('pv-fonts');
  if (!faces) { faces = document.createElement('style'); faces.id = 'pv-fonts'; document.head.appendChild(faces); }
  faces.textContent = bloomFontFaces(chrome.runtime.getURL, theme);
  const pv = $('#preview');
  const sb = theme.sidebar || '#A62E42', page = theme.page || '#F8F8F8';
  pv.style.setProperty('--sb', sb);
  pv.style.setProperty('--sb-dark', `color-mix(in srgb, ${sb} 78%, #000)`);
  pv.style.setProperty('--sb-text', bloomIsLight(sb) ? '#2B2530' : '#FFFFFF');
  pv.style.setProperty('--ac', theme.accent || '#A62E42');
  pv.style.setProperty('--ac-text', bloomIsLight(theme.accent) ? '#1C1C1E' : '#FFFFFF');
  pv.style.setProperty('--pg', page);
  pv.style.setProperty('--cd', theme.card || '#FFFFFF');
  pv.style.setProperty('--tx', theme.text || '#262626');
  pv.style.setProperty('--rd', `${theme.radius}px`);
  pv.style.setProperty('--zoom', theme.size / 100);
  pv.style.setProperty('--font', bloomFontStack(theme) || '"Open Sans", -apple-system, "Segoe UI", sans-serif');
  const veil = bloomRGBA(page, 1 - theme.imageStrength);
  pv.querySelector('.pv-main').style.backgroundImage = theme.image ? `linear-gradient(${veil}, ${veil}), url("${theme.image}")` : 'none';
  pv.classList.toggle('dark', !!theme.dark);
  pv.classList.toggle('plain', !theme.enabled);
}

/* ---------------- files ---------------- */
const readAs = (file, how) => new Promise((ok, fail) => {
  const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => fail(r.error); r[how](file);
});

/** Shrink big photos so they load fast and fit in storage. */
async function shrinkImage(file) {
  const url = await readAs(file, 'readAsDataURL');
  const img = new Image();
  await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
  const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

$('#imageFile').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { edited({ image: await shrinkImage(f) }); note('Background picture set ✓'); } catch (err) { note("That picture couldn't be opened.", false); }
};
$('#imageRemove').onclick = () => edited({ image: '' });

$('#fontFile').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (f.size > 4 * 1024 * 1024) { note('That font file is too big (max 4 MB).', false); return; }
  let data = await readAs(f, 'readAsDataURL');
  const type = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }[f.name.split('.').pop().toLowerCase()];
  if (!type) { note('Please choose a .ttf, .otf, .woff or .woff2 file.', false); return; }
  data = data.replace(/^data:[^;]*;/, `data:${type};`);
  edited({ font: 'upload', fontData: data, fontName: f.name });
  fill(); note(`Using ${f.name} ✓`);
};

$('#export').onclick = () => {
  const { enabled, ...rest } = theme;
  const blob = new Blob([JSON.stringify({ bloomTheme: 1, ...rest }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `bloom-theme-${theme.preset || 'custom'}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('#importFile').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await readAs(f, 'readAsText'));
    if (!data || typeof data !== 'object' || !('accent' in data || 'sidebar' in data)) throw new Error('not a theme');
    const clean = {};
    for (const k of Object.keys(BLOOM_THEME_DEFAULTS)) if (k in data && typeof data[k] === typeof BLOOM_THEME_DEFAULTS[k]) clean[k] = data[k];
    theme = { ...BLOOM_THEME_DEFAULTS, ...clean, enabled: true };
    fill(); saveTheme(true); note(`Imported ${f.name} ✓`);
  } catch (err) { note("That file isn't a Bloom theme.", false); }
};

$('#reset').onclick = () => { theme = { ...BLOOM_THEME_DEFAULTS }; fill(); saveTheme(true); note('Back to the default theme.'); };

/* ---------------- simple inputs ---------------- */
$('#t-enabled').onchange = (e) => { theme.enabled = e.target.checked; saveTheme(true); };
$('#t-dark').onchange = (e) => edited({ dark: e.target.checked });
$('#t-font').onchange = (e) => { edited({ font: e.target.value }); };
$('#t-customFont').oninput = (e) => edited({ customFont: e.target.value.trim() });
$('#t-size').oninput = (e) => edited({ size: +e.target.value });
$('#t-radius').oninput = (e) => edited({ radius: +e.target.value });
$('#t-imageStrength').oninput = (e) => edited({ imageStrength: +e.target.value });
$('#t-css').oninput = (e) => edited({ css: e.target.value });

for (const k of ['widget', 'hideSubmitted']) $('#' + k).onchange = (e) => { settings[k] = e.target.checked; saveSettings(); };
$('#side').onchange = (e) => { settings.side = e.target.value; saveSettings(); };
$('#days').onchange = (e) => { settings.days = +e.target.value; saveSettings(); };
$('#platform').onchange = (e) => { settings.platform = e.target.value; saveSettings(); };

/* ---------------- EdgeTodo ---------------- */
function edgeStatus(text, ok) { const el = $('#edgetodoStatus'); el.textContent = text; el.className = 'status ' + (ok ? 'ok' : 'warn'); }

async function checkEdgeTodo() {
  if (!settings.edgetodoSync) { edgeStatus('', true); return; }
  const r = await chrome.runtime.sendMessage({ type: 'bloom:edgetodo-ping' }).catch(() => null);
  if (!r || !r.ok) { edgeStatus("EdgeTodo isn't open right now — Bloom will send your deadlines when it is.", false); return; }
  const s = await chrome.runtime.sendMessage({ type: 'bloom:edgetodo-sync' }).catch(() => null);
  edgeStatus(s && s.ok ? `Connected to EdgeTodo ✓${s.added ? ` — ${s.added} deadline${s.added === 1 ? '' : 's'} added` : ''}` : 'Connected to EdgeTodo ✓', true);
}

$('#edgetodoSync').onchange = async (e) => {
  if (e.target.checked) {
    // Must run straight from the click so Chrome shows its permission prompt.
    const granted = await chrome.permissions.request({ origins: ['http://127.0.0.1/*'] });
    if (!granted) { e.target.checked = false; edgeStatus('Bloom needs that permission to reach EdgeTodo on your Mac.', false); return; }
  }
  settings.edgetodoSync = e.target.checked;
  await saveSettings();
  checkEdgeTodo();
};

$('#connect').onclick = async () => {
  let origin;
  try {
    let v = $('#host').value.trim();
    if (!/^https?:\/\//.test(v)) v = 'https://' + v;
    origin = new URL(v).origin;
    if (!origin.startsWith('https://')) throw new Error('https only');
  } catch (e) {
    status("That doesn't look like a web address. Try something like https://learn.yourschool.edu", false);
    return;
  }
  // Must run straight from the click so Chrome shows its permission prompt.
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (!granted) { status('Bloom needs permission for that site to read your deadlines.', false); return; }
  settings.host = origin;
  $('#host').value = origin;
  await saveSettings();
  const res = await chrome.runtime.sendMessage({ type: 'bloom:register', host: origin });
  status(res && res.ok ? `Connected to ${origin} ✓ — open it and look for the ✿ button.` : 'Something went wrong. Try again.', !!(res && res.ok));
};

/* ---------------- start ---------------- */
async function load() {
  const saved = await chrome.storage.local.get(['settings', 'theme']);
  settings = { ...DEFAULTS, ...(saved.settings || {}) };
  theme = bloomTheme(saved);
  $('#host').value = settings.host;
  for (const k of ['widget', 'hideSubmitted', 'edgetodoSync']) $('#' + k).checked = !!settings[k];
  for (const k of ['side', 'days', 'platform']) $('#' + k).value = String(settings[k]);
  buildPresets(); buildColors(); buildFonts();
  fill();
  checkEdgeTodo();
  if (settings.host) {
    const ok = await chrome.permissions.contains({ origins: [settings.host + '/*'] });
    status(ok ? `Connected to ${settings.host} ✓` : 'Click Connect to allow Bloom on this site.', ok);
  }
}
load();
