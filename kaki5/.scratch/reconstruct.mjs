import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const PROD = 'C:/Users/Admin/Documents/kasol/kaki5';

function rep1(content, from, to, label) {
  const n = content.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] ekspektasi 1 kemunculan, dapat ${n}`);
  return content.replace(from, to);
}
const must = (c, sub, label) => { if (!c.includes(sub)) throw new Error(`[${label}] substring hilang: ${sub}`); return c; };

mkdirSync('/tmp/k5-states/p0/js', { recursive: true });
mkdirSync('/tmp/k5-states/p1/js', { recursive: true });

// ============ index.html ============
let idx = readFileSync(`${PROD}/index.html`, 'utf8');

// --- P2 → P1 ---
idx = rep1(idx,
`<title>Kasir Solo - Kaki Lima</title>
<!-- Konsolidasi P2 2026-08-22: css/style.css = satu-satunya stylesheet (superset
     lengkap; 13 file css/ modular dilebur ke sini). Jangan tambahkan link css lain. -->
<link rel="stylesheet" href="css/style.css">`,
`<title>Kasir Solo - Kaki Lima</title>
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/components-stat.css">
<link rel="stylesheet" href="css/components-modal.css">
<link rel="stylesheet" href="css/components-banner.css">
<link rel="stylesheet" href="css/components-tabs.css">
<link rel="stylesheet" href="css/components-license.css">
<link rel="stylesheet" href="css/components-carousel.css">
<link rel="stylesheet" href="css/components-menu.css">
<link rel="stylesheet" href="css/components-cart.css">
<link rel="stylesheet" href="css/components-trx.css">
<link rel="stylesheet" href="css/components-report.css">
<link rel="stylesheet" href="css/components-settings.css">
<link rel="stylesheet" href="css/style.css">`, 'idx csslinks');
idx = rep1(idx, 'app.js?v=72', 'app.js?v=71', 'idx v71');
const idxP1 = idx;

// --- P1 → P0 ---
idx = rep1(idx, '<meta name="theme-color" content="#D6501C">', '<meta name="theme-color" content="#E65100">', 'p0 theme');
idx = rep1(idx, 'role="button" tabindex="0" title="Status Lisensi"', 'role="button" title="Status Lisensi"', 'p0 trialchip');
idx = rep1(idx,
`<!-- Keranjang floating — styling di components-cart.css (#cartBar), JS toggle display -->
<div id="cartBar" data-action="open-cart">`,
`<!-- Keranjang floating -->
<div id="cartBar" style="display:none;position:fixed;bottom:calc(var(--nav-h) + 8px);left:8px;right:8px;max-width:90%;margin:0 auto;background:var(--green);color:#fff;border-radius:16px;padding:14px 20px;z-index:50;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.3);display:none" data-action="open-cart">`, 'p0 cartbar');
idx = rep1(idx,
`<!-- ONBOARDING / LICENSE GATE OVERLAY (single step: nama usaha + S&K → mulai percobaan)
     Positioning di components-modal.css (#licenseGate); JS toggle display flex/none. -->
<div id="licenseGate" role="dialog" aria-modal="true" aria-labelledby="licenseGateTitle">`,
`<!-- ONBOARDING / LICENSE GATE OVERLAY (single step: nama usaha + S&K → mulai percobaan) -->
<div id="licenseGate" style="display:none;position:fixed;inset:0;background:var(--bg);z-index:500;align-items:center;justify-content:center;padding:24px;overflow-y:auto" role="dialog" aria-modal="true" aria-labelledby="licenseGateTitle">`, 'p0 licensegate');
idx = rep1(idx, 'id="toast" role="status"', 'id="toast" role="alert"', 'p0 toast');
idx = rep1(idx, 'app.js?v=71', 'app.js?v=70', 'idx v70');
const idxP0 = idx;

must(idxP0, "style-src 'self' 'unsafe-inline'", 'p0 csp');
must(idxP0, 'js/dev-unregister-sw.js', 'p0 devscript');
must(idxP1, 'tabindex="0"', 'p1 tabindex');
must(idxP1, 'content="#D6501C"', 'p1 theme');
must(idxP1, '<div id="cartBar" data-action="open-cart">', 'p1 cartbar');

// ============ sw.js ============
let sw = readFileSync(`${PROD}/sw.js`, 'utf8');
sw = rep1(sw,
`// Cache version v72 — ubah angka ini setiap swap service worker file.
// v72: konsolidasi P2 — css/style.css jadi satu-satunya stylesheet (13 file
// css/ modular dilebur; rule uniknya sudah dipindah ke style.css).

const CACHE_NAME = 'kasir-solo-kaki5-v72';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './dexie.min.js',
  './css/style.css',`,
`// Cache version v71 — ubah angka ini setiap swap service worker file.
// v71: P1 hardening — overlay styling ke CSS, --paper, theme_color, Escape+scroll-lock.

const CACHE_NAME = 'kasir-solo-kaki5-v71';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './dexie.min.js',
  './css/base.css',
  './css/components.css',
  './css/components-stat.css',
  './css/components-modal.css',
  './css/components-banner.css',
  './css/components-tabs.css',
  './css/components-license.css',
  './css/components-carousel.css',
  './css/components-menu.css',
  './css/components-cart.css',
  './css/components-trx.css',
  './css/components-report.css',
  './css/components-settings.css',
  './css/style.css',`, 'sw p1');
const swP1 = sw;
sw = rep1(sw,
`// Cache version v71 — ubah angka ini setiap swap service worker file.
// v71: P1 hardening — overlay styling ke CSS, --paper, theme_color, Escape+scroll-lock.

const CACHE_NAME = 'kasir-solo-kaki5-v71';`,
`// Cache version v70 — ubah angka ini setiap swap service worker file.
// v70: hotfix CSP — layout pulih (style.css dimuat blocking, inline style diizinkan).

const CACHE_NAME = 'kasir-solo-kaki5-v70';`, 'sw p0');
const swP0 = sw;
must(swP0, "kasir-solo-kaki5-v70'", 'swp0 name');

// ============ version.js ============
const vj = readFileSync(`${PROD}/js/version.js`, 'utf8');
const vjP1 = rep1(rep1(vj, "'1.0.17'", "'1.0.16'", 'vj p1 ver'), "'v72'", "'v71'", 'vj p1 bust');
const vjP0 = rep1(rep1(vj, "'1.0.17'", "'1.0.15'", 'vj p0 ver'), "'v72'", "'v70'", 'vj p0 bust');

// ============ version.json ============
const vjsonP0 = `{
  "version": "1.0.15",
  "cacheBust": "v70",
  "notes": [
    "\ud83d\ude91 Perbaikan kritikal: tampilan aplikasi pulih di Chrome modern (kartu statistik berwarna lagi, layout beranda & modal rapi)",
    "\ud83d\udda5\ufe0f Mode tablet/desktop aktif kembali — style.css yang tadinya tak pernah termuat kini dimuat normal",
    "\ud83d\udd10 Perbaikan kebijakan keamanan (CSP) yang tanpa sengaja memblokir gaya tampilan"
  ]
}
`;
const vjsonP1 = `{
  "version": "1.0.16",
  "cacheBust": "v71",
  "notes": [
    "\ud83d\udee1\ufe0f Penguatan tampilan: posisi overlay (gerbang lisensi, bar keranjang, pembaruan) kini dikelola file CSS — lebih tahan perubahan kebijakan browser",
    "\ud83c\udfa8 Warna address-bar & splash screen kini serasi dengan warna header aplikasi",
    "\u2328\ufe0f Modal bisa ditutup dengan tombol Esc, dan halaman di belakangnya tidak ikut tergulir saat modal terbuka",
    "\u267f Status lisensi di header kini bisa diakses dengan keyboard (Tab + Enter)"
  ]
}
`;

// ============ style.css @P1 ============
let css = readFileSync(`${PROD}/css/style.css`, 'utf8');
css = rep1(css,
`
/* Focus-visible catch-all (paritas base.css, konsolidasi P2 2026-08-22) */
button:focus-visible,a:focus-visible,.date-btn:focus-visible,.modal-title:focus-visible,.closeOverlay:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
`, '\n', 'css fv');
css = rep1(css,
`
/* Phone: banner profil kompak (dulu @380 di sini vs @414 di base.css —
   disatukan ke 414 = perilaku render yang selama ini efektif, konsolidasi P2) */
@media (max-width:414px){.prof-banner-card{padding:28px 16px 18px}.prof-emoji{font-size:48px}.prof-banner-title{font-size:18px}.prof-banner-sub{font-size:12.5px}}`,
`
@media (max-width:380px){.prof-banner-card{padding:28px 16px 18px}.prof-emoji{font-size:48px}.prof-banner-title{font-size:18px}.prof-banner-sub{font-size:12.5px}}`, 'css profbanner');
{
  const start = css.indexOf('\n/* ===== Kontekstual date picker');
  const marker = '.date-nav .month-opt:active{opacity:.7}\n';
  const end = css.indexOf(marker);
  if (start < 0 || end < 0 || end < start) throw new Error('css datepicker blok tidak ketemu');
  css = css.slice(0, start) + '\n' + css.slice(end + marker.length);
}
must(css, '.date-nav .custom-date-input:focus{border-color:var(--primary)}', 'css customdate intact');
{
  const start = css.indexOf('\n/* ===== License extras');
  const marker = '.manual-key-wrap .btn{width:100%;margin-top:8px}\n';
  const end = css.indexOf(marker);
  if (start < 0 || end < 0 || end < start) throw new Error('css license blok tidak ketemu');
  css = css.slice(0, start) + '\n' + css.slice(end + marker.length);
}
must(css, '.license-lock-card{text-align:center;padding:24px;max-width:480px;width:90%;border-radius:20px}', 'css lockcard intact');
must(css, '--paper:#FFF8F0', 'css paper (P1) tetap');
must(css, '#licenseGate{display:none;position:fixed', 'css parity (P1) tetap');
const cssP1 = css;

writeFileSync('/tmp/k5-states/p0/index.html', idxP0);
writeFileSync('/tmp/k5-states/p0/sw.js', swP0);
writeFileSync('/tmp/k5-states/p0/js/version.js', vjP0);
writeFileSync('/tmp/k5-states/p0/js/version.json', vjsonP0);
writeFileSync('/tmp/k5-states/p1/index.html', idxP1);
writeFileSync('/tmp/k5-states/p1/sw.js', swP1);
writeFileSync('/tmp/k5-states/p1/js/version.js', vjP1);
writeFileSync('/tmp/k5-states/p1/js/version.json', vjsonP1);
writeFileSync('/tmp/k5-states/p1/style.css', cssP1);
console.log('OK: semua rekonstruksi lolos assertion.');
