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

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
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
chrome.alarms.onAlarm.addListener(updateBadge);
chrome.storage.onChanged.addListener((changes) => { if (changes.cache || changes.done) updateBadge(); });
chrome.permissions.onRemoved.addListener(() => ensureRegistered());
