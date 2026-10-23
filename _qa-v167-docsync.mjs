// _qa-v167-docsync.mjs — sapu klaim "versi aktif" v166/1.0.98 -> v167/1.0.99 dan
// rujukuan baris sw.js yang bergeser +9, TANPA menyentuh sebutan historis v166.
import fs from 'node:fs';

const K = 'C:/Users/Admin/Documents/kasol/kaki5/';
let gagal = 0;

function patch(file, pairs) {
  const p = K + file;
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b, exp = 1] of pairs) {
    const c = s.split(a).length - 1;
    if (c !== exp) {
      console.log(`!! ${file}: ${JSON.stringify(a.slice(0, 54))} ketemu ${c}, harus ${exp}`);
      gagal++;
      continue;
    }
    s = s.split(a).join(b);
    console.log(`ok ${file}  x${c}`);
  }
  fs.writeFileSync(p, s, 'utf8');
}

patch('AGENTS.md', [
  ['| **`APP_VERSION`** | `1.0.98` |', '| **`APP_VERSION`** | `1.0.99` |'],
  ['| **`CACHE_BUST` / SW** | `v166` | `js/version.js:18`, `sw.js:138` |',
   '| **`CACHE_BUST` / SW** | `v167` | `js/version.js:18`, `sw.js:147` |'],
  ['(`sw.js:232`)', '(`sw.js:242`)'],
  ['(`sw.js:244`)', '(`sw.js:253`)'],
  ['(`sw.js:264`)', '(`sw.js:273`)'],
]);

patch('CHANGELOG.md', [
  ['> **Status: belum di-rilis.** Entri ini mencatat perbaikan yang sudah ada di working\n> tree; `js/version.js` masih `1.0.98` / `v166` sampai versi dinaikkan.',
   '> **Status: di-commit ke mirror beta (`kasol-beta` lokal); BELUM di-push ke GitHub.**\n> Versi sudah dinaikkan ke `1.0.99` / `v167` pada enam slot sinkron.'],
  ['`sw.js:49-128`', '`sw.js:7-142`'],
]);

patch('README.md', [
  ['`APP_VERSION 1.0.98` · `CACHE_BUST v166`', '`APP_VERSION 1.0.99` · `CACHE_BUST v167`'],
  ['kondisi kode **v166 / 1.0.98 (2026-09-04)**', 'kondisi kode **v167 / 1.0.99 (2026-09-04)**'],
]);

patch('DESIGN.md', [
  ['diselaraskan dengan kode **v166 / 1.0.98 (2026-09-04)**', 'diselaraskan dengan kode **v167 / 1.0.99 (2026-09-04)**'],
  ['**Terakhir diperbarui**: 2026-09-04 (v166 / 1.0.98)', '**Terakhir diperbarui**: 2026-09-04 (v167 / 1.0.99)'],
  ['| 2026-09-04 | v166 / 1.0.98 | Saklar fitur "Buka / Tutup Kas" di Pengaturan (di luar sistem lisensi, tapi memakai mekanisme `data-action` + wire-map yang sama — sumber bug facade). |',
   '| 2026-09-04 | v166 / 1.0.98 | Saklar fitur "Buka / Tutup Kas" di Pengaturan (di luar sistem lisensi, tapi memakai mekanisme `data-action` + wire-map yang sama — sumber bug facade). |\n' +
   '| 2026-09-04 | v167 / 1.0.99 | Gerbang saklar kas diperketat: `fiturKasAktif()` baca DB tiap transaksi, saklar disinkronkan sebelum panggilan cloud, dan `saveFiturKas()` membandingkan dengan nilai tersimpan. Tidak mengubah model lisensi/kuota. |'],
]);

patch('docs/DEVELOPER.md', [
  ['Versi acuan: **v166 / 1.0.98 (2026-09-04)**', 'Versi acuan: **v167 / 1.0.99 (2026-09-04)**'],
  ['diselaraskan dengan kode: **v166 / 1.0.98, 2026-09-04**', 'diselaraskan dengan kode: **v167 / 1.0.99, 2026-09-04**'],
]);

patch('docs/REGRESSION-CHECKLIST.md', [
  ['v166 / 1.0.98 pada 2026-09-04.**', 'v167 / 1.0.99 pada 2026-09-04.**'],
  ['| 1 | `js/version.js` → `APP_VERSION` (`:7`) | `1.0.98` |', '| 1 | `js/version.js` → `APP_VERSION` (`:7`) | `1.0.99` |'],
  ['| 2 | `js/version.js` → `CACHE_BUST` (`:18`) | `v166` |', '| 2 | `js/version.js` → `CACHE_BUST` (`:18`) | `v167` |'],
  ['| 3 | `js/version.json` → `"version"` (`:2`) | `1.0.98` |', '| 3 | `js/version.json` → `"version"` (`:2`) | `1.0.99` |'],
  ['| 4 | `js/version.json` → `"cacheBust"` (`:3`) | `v166` |', '| 4 | `js/version.json` → `"cacheBust"` (`:3`) | `v167` |'],
  ['| 5 | `sw.js` → `CACHE_NAME` (`:138`) **dan** komentar "Cache version vNNN" (`:4-6`) | `kasir-solo-kaki5-v166` |',
   '| 5 | `sw.js` → `CACHE_NAME` (`:147`) **dan** komentar "Cache version vNNN" (`:4-6`) | `kasir-solo-kaki5-v167` |'],
  ['| 6 | `index.html` → `js/app.js?v=` (`:999`) | `?v=166` |', '| 6 | `index.html` → `js/app.js?v=` (`:999`) | `?v=167` |'],
  ['`sw.js:216-218`', '`sw.js:225-227`'],
  ['*Sinkron dengan kode v166 / 1.0.98 (2026-09-04)', '*Sinkron dengan kode v167 / 1.0.99 (2026-09-04)'],
]);

console.log(gagal === 0 ? '\nSELESAI, semua patch tepat sasaran.' : '\nADA ' + gagal + ' PATCH BERMASALAH.');
process.exit(gagal === 0 ? 0 : 1);
