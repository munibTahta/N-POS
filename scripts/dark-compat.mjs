// Membuat src/styles/dark-compat.css: "jaring pengaman" tema gelap untuk kelas warna Tailwind yang dipakai halaman lama
// tanpa varian `dark:` (bg-white, bg-gray-50, text-gray-700, border-gray-200, bg-blue-100, text-green-800, gradien, hover, dst).
//
// Prinsip:
//  - Hanya berlaku di bawah `.dark`; mode terang tidak tersentuh.
//  - Memakai :where(.dark) agar spesifisitas = kelas utilitas biasa (0,1,0) sehingga varian eksplisit `dark:...` (0,2,0)
//    pada komponen yang sudah dirancang tetap menang.
//  - Hanya fondasi terang (bg 50-300, border 100-400) dan teks gelap (600-900) yang dipetakan; isian pekat 500/600/700+
//    (tombol `bg-blue-600 text-white`) dan `text-white` sengaja TIDAK diubah.
//  - Latar berwarna menjadi tint translusen dari warna 500 di atas permukaan gelap (nyaman di mata, kontras terjaga).
// Pakai:  node scripts/dark-compat.mjs        (menulis berkasnya)      node scripts/dark-compat.mjs --check   (gagal bila basi)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import resolveConfig from 'tailwindcss/resolveConfig.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'src/styles/dark-compat.css');

const NEUTRAL = new Set(['gray', 'slate', 'zinc', 'neutral', 'stone', 'secondary']);
// permukaan gelap (zinc): page #09090b, kartu #18181b
const N_BG = { white: '#18181b', 50: '#1f1f23', 100: '#27272a', 200: '#3f3f46', 300: '#52525b' };
const N_HOVER = { white: '#27272a', 50: '#27272a', 100: '#2f2f35', 200: '#3f3f46', 300: '#52525b' };
const N_TEXT = { 400: '#a1a1aa', 500: '#a1a1aa', 600: '#d4d4d8', 700: '#e4e4e7', 800: '#f4f4f5', 900: '#fafafa' };
const N_BORDER = { 100: '#27272a', 200: '#323238', 300: '#3f3f46', 400: '#52525b' };
const C_BG_A = { 50: 0.12, 100: 0.18, 200: 0.26, 300: 0.36 };
const C_HOVER_A = { 50: 0.18, 100: 0.24, 200: 0.32, 300: 0.42 };
const C_BORDER_A = { 100: 0.25, 200: 0.32, 300: 0.42 };
const C_TEXT = { 600: 400, 700: 300, 800: 200, 900: 200 };

function loadTokens() {
  const toks = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(jsx|js|ts|tsx)$/.test(e.name)) {
        const t = fs.readFileSync(p, 'utf8');
        for (const m of t.matchAll(/(?<![\w:-])((?:hover:|focus:|disabled:|group-hover:)?(?:bg|text|border|ring|divide|from|via|to|placeholder|fill|stroke)-(?:white|black|[a-z]+-\d{2,3})(?:\/\d+)?)(?![\w-])/g)) toks.add(m[1]);
      }
    }
  };
  walk(path.join(root, 'src'));
  return [...toks].sort();
}

const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const esc = (s) => s.replace(/([:/.\[\]])/g, '\\$1');

export async function build() {
  const { default: userCfg } = await import(path.join(root, 'tailwind.config.js'));
  const theme = resolveConfig(userCfg).theme.colors;
  const colorOf = (fam, shade) => (theme[fam] && theme[fam][shade]) || null;
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgb(${r} ${g} ${b} / ${a})`; };

  const rules = [];
  const seen = new Set();
  const add = (sel, body) => { const k = sel + body; if (!seen.has(k)) { seen.add(k); rules.push(`:where(.dark) ${sel} { ${body} }`); } };

  for (const tok of loadTokens()) {
    const m = /^(?:(hover|focus|disabled|group-hover):)?(bg|text|border|ring|divide|from|via|to|placeholder|fill|stroke)-(white|black|([a-z]+)-(\d{2,3}))(?:\/(\d+))?$/.exec(tok);
    if (!m) continue;
    const [, variant, prop, colorWord, fam0, shadeStr, alphaPct] = m;
    const fam = fam0, shade = shadeStr ? Number(shadeStr) : null;
    const isWhite = colorWord === 'white', isBlack = colorWord === 'black';
    if (isBlack && prop !== 'text') continue;
    if (colorWord === 'white' && prop !== 'bg' && prop !== 'from' && prop !== 'to' && prop !== 'via') continue; // text-white/border-white tetap
    // bg-white/NN translusen <= 30% = lapisan sorot di atas warna lain (mis. lencana pada tombol biru): jangan dijadikan permukaan gelap
    if (isWhite && alphaPct && Number(alphaPct) < 50) continue;
    const neutral = isWhite || NEUTRAL.has(fam);
    if (!isWhite && !isBlack && !theme[fam]) continue;

    // selector dasar
    let cls = `.${esc(tok)}`;
    let sel = cls;
    if (variant === 'hover') sel = `${cls}:hover`;
    else if (variant === 'focus') sel = `${cls}:focus`;
    else if (variant === 'disabled') sel = `${cls}:disabled`;
    else if (variant === 'group-hover') sel = `.group:hover ${cls}`;
    if (prop === 'divide') sel = `${sel} > :not([hidden]) ~ :not([hidden])`;
    if (prop === 'placeholder') sel = `${sel}::placeholder`;

    // warna tujuan
    let color = null;
    const alpha = alphaPct ? Number(alphaPct) / 100 : null;
    const isHoverish = variant === 'hover' || variant === 'group-hover';
    if (prop === 'bg' || prop === 'from' || prop === 'via' || prop === 'to') {
      const key = isWhite ? 'white' : shade;
      if (neutral) { const t = isHoverish ? N_HOVER[key] : N_BG[key]; if (t) color = alpha ? rgba(t, alpha) : t; }
      else if (shade && C_BG_A[shade]) { const base = colorOf(fam, 500); if (base) color = rgba(base, alpha ? alpha * (isHoverish ? C_HOVER_A[shade] : C_BG_A[shade]) / C_BG_A[50] * 0.12 : (isHoverish ? C_HOVER_A : C_BG_A)[shade]); }
    } else if (prop === 'text' || prop === 'fill' || prop === 'stroke' || prop === 'placeholder') {
      if (isBlack) color = '#f4f4f5';
      else if (neutral) color = N_TEXT[shade];
      else if (C_TEXT[shade]) color = colorOf(fam, C_TEXT[shade]);
    } else if (prop === 'border' || prop === 'divide' || prop === 'ring') {
      if (neutral) color = N_BORDER[shade];
      else if (C_BORDER_A[shade]) { const base = colorOf(fam, 500); if (base) color = rgba(base, C_BORDER_A[shade]); }
    }
    if (!color) continue;

    if (prop === 'bg') add(sel, `--tw-bg-opacity: 1; background-color: ${color};`);
    else if (prop === 'text') add(sel, `--tw-text-opacity: 1; color: ${color};`);
    else if (prop === 'fill') add(sel, `fill: ${color};`);
    else if (prop === 'stroke') add(sel, `stroke: ${color};`);
    else if (prop === 'placeholder') add(sel, `color: ${color};`);
    else if (prop === 'border') add(sel, `--tw-border-opacity: 1; border-color: ${color};`);
    else if (prop === 'divide') add(sel, `--tw-divide-opacity: 1; border-color: ${color};`);
    else if (prop === 'ring') add(sel, `--tw-ring-color: ${color};`);
    else if (prop === 'from') add(sel, `--tw-gradient-from: ${color} var(--tw-gradient-from-position); --tw-gradient-to: rgb(0 0 0 / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);`);
    else if (prop === 'via') add(sel, `--tw-gradient-to: rgb(0 0 0 / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), ${color} var(--tw-gradient-via-position), var(--tw-gradient-to);`);
    else if (prop === 'to') add(sel, `--tw-gradient-to: ${color} var(--tw-gradient-to-position);`);
  }
  // Kolom isian bawaan di mode gelap (tanpa !important, spesifisitas rendah: kelas komponen/varian dark: tetap menang)
  rules.push(`:where(.dark) :is(input, select, textarea):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not([type='file']) { background-color: #18181b; color: #f4f4f5; border-color: #3f3f46; }`);
  rules.push(`:where(.dark) :is(input, textarea)::placeholder { color: #a1a1aa; }`);
  const header = `/* GENERATED oleh scripts/dark-compat.mjs - JANGAN diedit tangan. Jalankan: npm run theme:gen\n * Jaring pengaman tema gelap untuk kelas warna Tailwind pada halaman yang belum punya varian dark:. Hanya aktif di bawah .dark.\n * ${rules.length} aturan. Penjelasan prinsip ada di kepala scripts/dark-compat.mjs. */\n`;
  return header + rules.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const css = await build();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== css) { console.error('src/styles/dark-compat.css basi. Jalankan: npm run theme:gen'); process.exit(1); }
    console.log('dark-compat.css mutakhir.');
  } else {
    fs.writeFileSync(OUT, css);
    console.log(`ditulis ${path.relative(root, OUT)}: ${css.split('\n').length - 4} aturan`);
  }
}
