const DEFAULTS = {
  days: 14, hideSubmitted: false, accent: '#FF6FAE', font: 'default', dark: false,
  theme: true, widget: true, side: 'right', host: '',
};
const ACCENTS = ['#FF6FAE', '#B58CFF', '#7AA7FF', '#2E9E7A', '#F2A541', '#E8553E', '#A62E42', '#1C1C1E'];
const $ = (s) => document.querySelector(s);
let settings = { ...DEFAULTS };

async function load() {
  const saved = await chrome.storage.local.get('settings');
  settings = { ...DEFAULTS, ...(saved.settings || {}) };
  $('#host').value = settings.host;
  for (const k of ['widget', 'hideSubmitted', 'theme', 'dark']) $('#' + k).checked = !!settings[k];
  for (const k of ['side', 'days', 'font']) $('#' + k).value = String(settings[k]);
  renderSwatches();
  if (settings.host) {
    const ok = await chrome.permissions.contains({ origins: [settings.host + '/*'] });
    status(ok ? `Connected to ${settings.host} ✓` : 'Click Connect to allow Bloom on this site.', ok);
  }
}

function renderSwatches() {
  const isCustom = !ACCENTS.includes(settings.accent.toUpperCase());
  $('#swatches').innerHTML = ACCENTS.map((c) =>
    `<button class="sw ${settings.accent.toUpperCase() === c ? 'on' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('') +
    `<label class="sw custom ${isCustom ? 'on' : ''}" title="Pick any color" style="background:${isCustom ? settings.accent : 'conic-gradient(#FF6FAE,#F2A541,#2E9E7A,#7AA7FF,#B58CFF,#FF6FAE)'}">
      <input type="color" id="customColor" value="${settings.accent}"></label>`;
  $('#customColor').oninput = (e) => { settings.accent = e.target.value; save(); renderSwatches(); };
}

async function save() { await chrome.storage.local.set({ settings }); }

function status(text, ok) {
  const el = $('#status');
  el.textContent = text;
  el.className = 'status ' + (ok ? 'ok' : 'warn');
}

$('#swatches').addEventListener('click', (e) => {
  const b = e.target.closest('[data-c]'); if (!b) return;
  settings.accent = b.dataset.c; save(); renderSwatches();
});
for (const k of ['widget', 'hideSubmitted', 'theme', 'dark']) $('#' + k).onchange = (e) => { settings[k] = e.target.checked; save(); };
$('#side').onchange = (e) => { settings.side = e.target.value; save(); };
$('#days').onchange = (e) => { settings.days = +e.target.value; save(); };
$('#font').onchange = (e) => { settings.font = e.target.value; save(); };

$('#connect').onclick = async () => {
  let origin;
  try {
    let v = $('#host').value.trim();
    if (!/^https?:\/\//.test(v)) v = 'https://' + v;
    origin = new URL(v).origin;
    if (!origin.startsWith('https://')) throw new Error('https only');
  } catch (e) {
    status('That doesn\'t look like a web address. Try something like https://learn.yourschool.edu', false);
    return;
  }
  // Must run straight from the click so Chrome shows its permission prompt.
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (!granted) { status('Bloom needs permission for that site to read your deadlines.', false); return; }
  settings.host = origin;
  $('#host').value = origin;
  await save();
  const res = await chrome.runtime.sendMessage({ type: 'bloom:register', host: origin });
  status(res && res.ok ? `Connected to ${origin} ✓ — open Blackboard and look for the ✿ button.` : 'Something went wrong. Try again.', !!(res && res.ok));
};

load();
