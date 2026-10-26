// _qa-v170-wire.mjs — bukti statis wiring diskon:
//  (1) setiap nama yang diimpor app.js dari pos.ui.js benar-benar diekspor pos.ui.js
//  (2) setiap nama yang di-re-export facade pos.js dari pos.ui.js juga benar-benar ada
//      (jebakan v166: nama hilang → app.js melewati window[key] DIAM-DIAM → tombol mati)
//  (3) setiap data-action literal yang dipancarkan kode terkait diskon punya case di app.js
import { readFileSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8');
const ui = src('js/pos.ui.js');
const pos = src('js/pos.js');
const app = src('js/app.js');

let fail = 0;
const bad = (label, items) => {
  if (items.length) { fail++; console.log(`✗ ${label}: ${items.join(', ')}`); }
  else console.log(`✓ ${label}`);
};

// ── (0) kumpulkan semua ekspor pos.ui.js ──
const uiExports = new Set();
for (const m of ui.matchAll(/^export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/gm)) uiExports.add(m[1]);
for (const m of ui.matchAll(/^export\s+(?:let|const|var)\s+([A-Za-z0-9_$]+)/gm)) uiExports.add(m[1]);
for (const m of ui.matchAll(/^export\s*\{([^}]+)\}/gm)) {
  m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
    const name = s.split(/\s+as\s+/)[0].trim();
    if (name) uiExports.add(name);
  });
}
console.log(`[wire] pos.ui.js ekspor terdeteksi: ${uiExports.size}`);

// ── (1) impor langsung app.js dari pos.ui.js ──
const impFromUi = [...app.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/pos\.ui\.js'/g)].map(m => m[1]);
const imported = impFromUi.join(',').split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
bad(`app.js impor dari pos.ui.js (${imported.length} nama) — semua ada`, imported.filter(n => !uiExports.has(n)));

// ── (2) re-export facade pos.js dari pos.ui.js ──
// Catatan: blok export{...} boleh berisi komentar — buang dulu, kalau tidak
// teks komentar ikut terbaca sebagai nama ekspor.
const stripComments = s => s.replace(/\/\/[^\n]*/g, '');
const facadeFromUi = [...pos.matchAll(/export\s*\{([^}]+)\}\s*from\s*'\.\/pos\.ui\.js'/g)].map(m => stripComments(m[1]));
const reexported = facadeFromUi.join(',').split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
bad(`facade pos.js me-re-export dari pos.ui.js (${reexported.length} nama) — semua ada`, reexported.filter(n => !uiExports.has(n)));

// ── (3) action diskon yang dipancarkan vs case di app.js ──
const cases = new Set([...app.matchAll(/case\s+'([a-z0-9-]+)'/g)].map(m => m[1]));
const DISKON_ACTIONS = ['diskon-tipe', 'diskon-input', 'edit-cart-item'];
const emitted = new Set([...ui.matchAll(/data-action="([a-z0-9-]+)"/g)].map(m => m[1]));
bad('action diskon dipancarkan literal di pos.ui.js', DISKON_ACTIONS.filter(a => !emitted.has(a)));
bad('action diskon punya case di app.js', DISKON_ACTIONS.filter(a => !cases.has(a)));

// ── (4) tidak boleh ada id racikan dinamis untuk editor diskon ──
bad('tidak ada getElementById ber-id racikan untuk diskon',
  [...ui.matchAll(/getElementById\(\s*[`'"][^'"`]*\$\{[^`'"]*DiskonInput/g)].map(m => m[0]));

// ── (5) kontainer statis yang dibutuhkan ada di index.html ──
const html = src('index.html');
const NEED_IDS = ['cartDiskonGlobal', 'cartTotalWrap', 'cartTotalLama', 'cartDiskonLabel', 'cartTotal'];
bad('kontainer diskon ada di index.html', NEED_IDS.filter(id => !new RegExp(`id="${id}"`).test(html)));

// ── (6) kelas CSS diskon benar-benar terdefinisi ──
const css = src('css/style.css');
const cssNeed = ['diskon-editor', 'diskon-tipe', 'diskon-tipe-btn', 'diskon-input', 'diskon-hint',
  'diskon-rinci', 'diskon-rinci-row', 'kdiskon', 'cart-diskon-global', 'cart-diskon-head',
  'cart-diskon-chip', 'cart-edit-hint', 'cart-price-lama', 'cart-total-lama', 'cart-bar-diskon'];
bad('kelas CSS diskon terdefinisi', cssNeed.filter(c => !new RegExp(`\\.${c}\\b`).test(css)));

// kelas yang dipakai template diskon tapi tidak ada di CSS (typo catcher).
// Nilai class="..." boleh mengandung ${...} — potong di interpolasi pertama
// supaya ekspresi JS tidak ikut terbaca sebagai nama kelas.
const usedInTpl = new Set();
for (const m of ui.matchAll(/class="([^"]*\bdiskon[^"]*)"/gi)) {
  m[1].split('${')[0].split(/\s+/).forEach(c => { if (/^[a-z][a-z0-9-]*$/i.test(c)) usedInTpl.add(c); });
}
bad('semua kelas diskon di template ada di CSS', [...usedInTpl].filter(c => !new RegExp(`\\.${c}\\b`).test(css)).sort());

console.log(`\n[qa-v170-wire] ${fail ? 'GAGAL (' + fail + ')' : 'SEMUA LULUS'}`);
process.exit(fail ? 1 : 0);
