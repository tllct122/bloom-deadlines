// Bloom — shared theme defaults and presets (used by the page script and the settings page).

/* exported BLOOM_THEME_DEFAULTS, BLOOM_PRESETS, BLOOM_FONTS, bloomFontStack, bloomFontFaces, bloomTheme, bloomRGBA, bloomIsLight */

var BLOOM_THEME_DEFAULTS = {
  enabled: true,
  preset: 'sakura',
  sidebar: '#E98FB0',   // side menu / top bar
  accent: '#FF6FAE',    // buttons, links, highlights (replaces your school's color)
  page: '#FFF4F7',      // page background
  card: '#FFFFFF',      // course cards and panels
  text: '#5A3D5C',      // headings and titles ('' = leave as is)
  font: 'nunito',
  customFont: '',       // name of a font installed on your computer
  fontData: '',         // or an uploaded font file (data URL)
  fontName: '',         // file name of the uploaded font
  size: 100,            // text size, %
  radius: 16,           // card corner roundness, px
  image: '',            // background picture (data URL)
  imageStrength: 0.35,  // how much of the picture shows through, 0–1
  dark: false,
  css: '',              // your own CSS, added last
};

var BLOOM_PRESETS = {
  sakura:   { name: 'Sakura',      sidebar: '#E98FB0', accent: '#FF6FAE', page: '#FFF4F7', card: '#FFFFFF', text: '#5A3D5C', font: 'nunito',    radius: 16 },
  matcha:   { name: 'Matcha',      sidebar: '#7FA77A', accent: '#4E8A57', page: '#F3F7EE', card: '#FFFFFF', text: '#2F3B2C', font: 'quicksand', radius: 14 },
  showa:    { name: 'Showa Retro', sidebar: '#D9483B', accent: '#2F8F83', page: '#F6EEDC', card: '#FFF9EE', text: '#3B2A20', font: 'fredoka',   radius: 12 },
  lavender: { name: 'Lavender',    sidebar: '#9D85EB', accent: '#7B61D9', page: '#F6F3FF', card: '#FFFFFF', text: '#3F3A6B', font: 'nunito',    radius: 18 },
  ocean:    { name: 'Ocean',       sidebar: '#3F7CC4', accent: '#2E86DE', page: '#EEF5FC', card: '#FFFFFF', text: '#1D2B3A', font: 'quicksand', radius: 12 },
  peach:    { name: 'Peach',       sidebar: '#F4A988', accent: '#E07A5F', page: '#FFF6F0', card: '#FFFFFF', text: '#5C3D2E', font: 'fredoka',   radius: 18 },
  minimal:  { name: 'Minimal',     sidebar: '#1C1C1E', accent: '#1C1C1E', page: '#F5F5F4', card: '#FFFFFF', text: '#1C1C1E', font: 'default',   radius: 8 },
  night:    { name: 'Night',       sidebar: '#2B2A33', accent: '#7B61D9', page: '#F5F5F4', card: '#FFFFFF', text: '',        font: 'nunito',    radius: 12, dark: true },
};

var BLOOM_FONTS = {
  default:   { label: 'Keep the school font' },
  nunito:    { label: 'Nunito — soft & rounded', file: 'fonts/nunito.woff2', family: 'Bloom Nunito' },
  fredoka:   { label: 'Fredoka — chunky & cute', file: 'fonts/fredoka.woff2', family: 'Bloom Fredoka' },
  quicksand: { label: 'Quicksand — light & airy', file: 'fonts/quicksand.woff2', family: 'Bloom Quicksand' },
  maru:      { label: 'Maru Gothic — Japanese rounded (Mac)', stack: '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold"' },
  serif:     { label: 'Serif', stack: '"Iowan Old Style", Georgia, "Songti TC", "Noto Serif"' },
  mono:      { label: 'Monospaced', stack: 'ui-monospace, "SF Mono", Menlo, Consolas' },
  custom:    { label: 'A font installed on my computer…' },
  upload:    { label: 'Upload a font file (.ttf .otf .woff2)…' },
};

/** CSS font-family value for a theme ('' = don't change). Chinese falls back to the system font. */
function bloomFontStack(t) {
  const cjk = '"PingFang TC", "PingFang SC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  const f = BLOOM_FONTS[t.font];
  if (!f || t.font === 'default') return '';
  if (t.font === 'custom') return t.customFont ? `"${t.customFont.replace(/["\\;{}<>]/g, '')}", ${cjk}` : '';
  if (t.font === 'upload') return t.fontData ? `"Bloom Uploaded", ${cjk}` : '';
  if (f.family) return `"${f.family}", ${cjk}`;
  return `${f.stack}, ${cjk}`;
}

/** @font-face rules for the bundled fonts (and an uploaded one). */
function bloomFontFaces(getURL, t) {
  const out = Object.values(BLOOM_FONTS).filter((f) => f.file).map((f) =>
    `@font-face { font-family: "${f.family}"; src: url("${getURL(f.file)}") format("woff2"); font-weight: 300 800; font-display: swap; }`);
  if (t && t.font === 'upload' && /^data:[\w/+.-]+;base64,[\w+/=]+$/.test(t.fontData || ''))
    out.push(`@font-face { font-family: "Bloom Uploaded"; src: url("${t.fontData}"); font-display: swap; }`);
  return out.join('\n');
}

/** Read the saved theme, upgrading settings saved by version 1. */
function bloomTheme(saved) {
  if (saved && saved.theme) return { ...BLOOM_THEME_DEFAULTS, ...saved.theme };
  const old = (saved && saved.settings) || {};
  if (!old.accent) return { ...BLOOM_THEME_DEFAULTS };
  const font = { rounded: 'nunito', clean: 'default', serif: 'serif', mono: 'mono' }[old.font] || 'default';
  return { ...BLOOM_THEME_DEFAULTS, preset: 'custom', enabled: old.theme !== false,
    accent: old.accent, sidebar: old.accent, page: '', card: '', text: '', font, dark: !!old.dark, radius: 0 };
}

/** '#RRGGBB' + alpha → 'rgba(...)' */
function bloomRGBA(hex, a) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  if (!m) return `rgba(255,255,255,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

/** Is this color light (so text on it should be dark)? */
function bloomIsLight(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62;
}
