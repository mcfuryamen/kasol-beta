// =========================================================================
// scripts/build-version.mjs
// Inject versi unik ke index.html + import module di app.js saat build Vercel.
//
// KENAPA: vercel.json meng-set /js/(.*) jadi Cache-Control immutable 1 tahun.
// Kalau URL modul tidak berubah, browser/CDN menyajikan versi lama (bug
// "perubahan sidebar / halaman konten tidak tampil di live").
//
// Solusi: ganti ?v=MODULAR di index.html dan SEMUA ?v=... di import app.js
// dengan value unik per build (timestamp). URL baru => cache break otomatis.
//
// Fail-safe: kalau file tidak ditemukan, exit 0 supaya deploy tidak gagal.
// =========================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminDir = join(__dirname, '..');
const indexHtml = join(adminDir, 'index.html');
const appJs = join(adminDir, 'js', 'app.js');

// Versi unik per build — angka timestamp detik + hash short dari env pemanggil.
const ver = String(Date.now());

let changed = 0;

function inject(file, regex, make) {
  try {
    let txt = readFileSync(file, 'utf8');
    const out = txt.replace(regex, (...args) => {
      changed++;
      return make(...args);
    });
    if (out !== txt) writeFileSync(file, out, 'utf8');
  } catch (e) {
    console.log(`[build-version] skip ${file} (${e.message})`);
  }
}

// index.html: <script type="module" src="js/app.js?v=MODULAR"></script>
inject(indexHtml, /(src="js\/app\.js\?v=)[^"]*(")/g, (m, a, b) => `${a}${ver}${b}`);

// app.js: semua import './x.js?v=...'  ->  './x.js?v=<ver>'
inject(appJs, /(\.\/[A-Za-z0-9_/.-]+\.js\?v=)[^'"]*/g, (m) => m.replace(/(\.js\?v=)[^'"]*/, `$1${ver}`));

console.log(`[build-version] versi=${ver} | refs diubah: ${changed}`);
process.exit(0);
