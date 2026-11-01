/* global bloomTheme */
const DAY = 86400000;
const COLORS = { overdue: '#E5484D', today: '#F76B15', soon: '#E2A400', later: '#8E8E93', done: '#30A46C' };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let settings = {}, cache = null, done = {}, theme = {};
const lmsName = () => (cache && cache.platform === 'canvas' ? 'Canvas' : cache && cache.platform === 'blackboard' ? 'Blackboard' : 'your school site');

const isDone = (it) => it.submitted === true || !!done[it.id];
function urgency(it, now) {
  const t = new Date(it.due).getTime();
  if (isDone(it)) return 'done';
  if (t < now) return 'overdue';
  if (t - now < DAY) return 'today';
  if (t - now < 3 * DAY) return 'soon';
  return 'later';
}
function countdown(iso, now) {
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
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

function render() {
  const accent = theme.accent || '#FF6FAE';
  document.documentElement.style.setProperty('--accent', accent);
  const list = $('#list');
  if (!settings.host) {
    list.innerHTML = `<div class="pempty">Connect your Blackboard or Canvas to see your deadlines here.<br><br>
      <button class="btn main" id="setup">Set up Bloom</button></div>`;
    $('#setup').onclick = () => chrome.runtime.openOptionsPage();
    $('#open').hidden = true; $('#refresh').hidden = true;
    return;
  }
  const now = Date.now();
  const items = ((cache && cache.items) || [])
    .filter((it) => { const t = new Date(it.due).getTime(); return t > now - 2 * DAY && !(t < now && isDone(it)); })
    .filter((it) => !(settings.hideSubmitted && isDone(it)));
  if (!cache) {
    list.innerHTML = `<div class="pempty">Open ${lmsName()} once so Bloom can load your deadlines.</div>`;
  } else if (!items.length) {
    list.innerHTML = `<div class="pempty">Nothing due soon — all caught up ✿</div>`;
  } else {
    list.innerHTML = items.slice(0, 12).map((it) => {
      const u = urgency(it, now);
      const status = it.submitted === true ? '<span class="ok">✓ Submitted</span>' : done[it.id] ? '<span class="ok">✓ Done</span>'
        : it.submitted === false ? '<span class="no">Not submitted</span>' : '';
      return `<a class="pitem ${isDone(it) ? 'done' : ''}" href="${esc(it.url)}" target="_blank">
        <span class="bar" style="background:${COLORS[u]}"></span>
        <span class="pbody">
          <span class="prow"><span class="code" style="background:${esc(it.color)}">${esc(it.code)}</span>
            <span class="cd" style="color:${COLORS[u]}">${countdown(it.due, now)}</span></span>
          <span class="ptitle">${esc(it.title)}</span>
          <span class="pmeta">${when(it.due)}${status ? ' · ' + status : ''}</span>
        </span></a>`;
    }).join('');
  }
  $('#updated').textContent = cache ? `Updated ${ago(cache.updated)}` : '';
  $('#open').textContent = `Open ${cache && cache.platform ? lmsName() : 'site'}`;
}

async function load() {
  const s = await chrome.storage.local.get(['settings', 'theme', 'cache', 'done']);
  settings = s.settings || {}; theme = bloomTheme(s); cache = s.cache || null; done = s.done || {};
  render();
}

$('#settings').onclick = () => chrome.runtime.openOptionsPage();
$('#open').onclick = () => chrome.tabs.create({ url: settings.host + (cache && cache.platform === 'blackboard' ? '/ultra/course' : '/') });
$('#refresh').onclick = async () => {
  $('#refresh').textContent = '…';
  const tabs = settings.host ? await chrome.tabs.query({ url: settings.host + '/*' }) : [];
  let ok = false;
  for (const t of tabs) {
    try { const r = await chrome.tabs.sendMessage(t.id, { type: 'bloom:refresh' }); if (r && r.ok) { ok = true; break; } } catch (e) { /* not loaded */ }
  }
  $('#refresh').textContent = '↻';
  if (ok) await load();
  else $('#updated').textContent = `Open ${lmsName()} to refresh`;
};

chrome.storage.onChanged.addListener(load);
load();
