// Bloom — background worker.
// Runs the page script on *your* school's Blackboard or Canvas site only (the address you enter in Settings),
// and keeps the toolbar badge showing how many deadlines are close.

importScripts('presets.js');  /* global bloomTheme */

const SCRIPT_ID = 'bloom';
const FILES = ['presets.js', 'content.js'];
const DAY = 86400000;

async function ensureRegistered() {
  const { settings } = await chrome.storage.local.get('settings');
  const host = settings && settings.host;
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (!host || !(await chrome.permissions.contains({ origins: [host + '/*'] }))) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return false;
  }
  if (existing.length && existing[0].matches[0] === host + '/*') return true;
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  await chrome.scripting.registerContentScripts([
    { id: SCRIPT_ID, matches: [host + '/*'], js: FILES, runAt: 'document_idle' },
  ]);
  return true;
}

/** Start working in tabs that are already open (no reload needed). */
async function injectIntoOpenTabs(host) {
  const tabs = await chrome.tabs.query({ url: host + '/*' });
  for (const t of tabs) {
    try { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: FILES }); } catch (e) { /* tab not ready */ }
  }
}

async function updateBadge() {
  const { cache, done = {} } = await chrome.storage.local.get(['cache', 'done']);
  const now = Date.now();
  const pending = ((cache && cache.items) || []).filter((i) => !(i.submitted === true || done[i.id]));
  const urgent = pending.filter((i) => { const t = new Date(i.due) - now; return t > -2 * DAY && t < DAY; }).length;
  const soon = pending.filter((i) => { const t = new Date(i.due) - now; return t > 0 && t < 3 * DAY; }).length;
  const n = urgent || soon;
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: urgent ? '#E5484D' : '#E2A400' });
}

/* ---------- EdgeTodo sync (Mac app, github.com/tllct122/edge-todo-for-mac) ----------
   EdgeTodo listens on this Mac only (127.0.0.1). Bloom sends your deadlines there whenever they
   change, including the ones you've submitted, so EdgeTodo can tick them off too. */
const EDGETODO = 'http://127.0.0.1:47621/edgetodo';
const EDGETODO_ORIGIN = 'http://127.0.0.1/*';

function edgeTodoList(cache, done) {
  const pad = (n) => String(n).padStart(2, '0');
  const local = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const prefix = cache.platform === 'canvas' ? 'cv' : 'bb';
  const now = Date.now();
  return (cache.items || [])
    .filter((it) => new Date(it.due).getTime() > now - 7 * DAY)
    .map((it) => ({ id: `${prefix}:${it.id}`, title: it.title, category: String(it.code || 'school').toLowerCase(),
      due: local(it.due), status: it.submitted === true || done[it.id] ? 'completed' : 'todo' }));
}

async function syncEdgeTodo(force) {
  const { settings = {}, cache, done = {} } = await chrome.storage.local.get(['settings', 'cache', 'done']);
  if (!force && !settings.edgetodoSync) return { ok: false, reason: 'off' };
  if (!cache || !(cache.items || []).length) return { ok: true, added: 0, updated: 0, finished: 0 };
  if (!(await chrome.permissions.contains({ origins: [EDGETODO_ORIGIN] }))) return { ok: false, reason: 'permission' };
  let result;
  try {
    const r = await fetch(`${EDGETODO}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-EdgeTodo': '1' },
      body: JSON.stringify({ todos: edgeTodoList(cache, done) }),
    });
    result = r.ok ? { ok: true, ...(await r.json()) } : { ok: false, reason: `HTTP ${r.status}` };
  } catch (e) {
    result = { ok: false, reason: 'offline' };   // EdgeTodo isn't open
  }
  await chrome.storage.local.set({ edgetodoStatus: { ...result, at: Date.now() } });
  return result;
}

let syncTimer;
function syncSoon() { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncEdgeTodo(false), 1500); }

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === 'bloom:edgetodo-sync') {
    syncEdgeTodo(true).then(reply);
    return true;
  }
  if (msg && msg.type === 'bloom:edgetodo-ping') {
    fetch(`${EDGETODO}/ping`, { headers: { 'X-EdgeTodo': '1' } })
      .then((r) => r.json()).then((j) => reply({ ok: !!(j && j.ok) }))
      .catch(() => reply({ ok: false }));
    return true;
  }
  if (msg && msg.type === 'bloom:register') {
    ensureRegistered()
      .then(async (ok) => { if (ok) await injectIntoOpenTabs(msg.host); reply({ ok }); })
      .catch((e) => reply({ ok: false, error: String(e) }));
    return true;
  }
});

/** Version 1 kept the colors inside `settings`; move them to the new `theme`. */
async function migrate() {
  const saved = await chrome.storage.local.get(['settings', 'theme']);
  if (!saved.theme) await chrome.storage.local.set({ theme: bloomTheme(saved) });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await migrate();
  // re-register so the new file list is used after an update
  const old = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (old.length && old[0].js.join() !== FILES.join()) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  ensureRegistered();
  updateBadge();
  chrome.alarms.create('badge', { periodInMinutes: 15 });
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => { ensureRegistered(); updateBadge(); });
chrome.alarms.onAlarm.addListener(() => { updateBadge(); syncEdgeTodo(false); });
chrome.storage.onChanged.addListener((changes) => {
  if (changes.cache || changes.done) { updateBadge(); syncSoon(); }
  if (changes.settings && changes.settings.newValue && changes.settings.newValue.edgetodoSync &&
      !(changes.settings.oldValue && changes.settings.oldValue.edgetodoSync)) syncSoon();
});
chrome.permissions.onRemoved.addListener(() => ensureRegistered());
