#!/usr/bin/env node
/**
 * Guard: LARANG query string (?v=...) pada import modul ES di control/js.
 *
 * Kenapa:
 *   Import './clients.js' dan './clients.js?v=20260915a' menunjuk DUA URL
 *   berbeda → browser memuat DUA instance modul. State modul (array `clients`,
 *   cache, counter) di instance kedua TIDAK pernah terisi, dan fungsi yang
 *   diimpor dari situ membaca state kosong.
 *
 *   Kasus nyata (2026-10-20): dashboard.js mengimpor clients.js?v=20260915a
 *   sementara app.js mengimpor clients.js?v=20261001c → analitik Dashboard
 *   selalu "Belum ada data klien" padahal ada 23 klien.
 *
 * Cache busting TIDAK perlu query: vercel.json sudah set
 *   /js/(.*)  →  Cache-Control: no-store
-- dan service worker memakai strategi network-first.
 *
 * Exit code 1 = ada pelanggaran.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JS_DIR = path.join(__dirname, '..', 'js');

const files = fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js'));
const violations = [];
const specRe = /(?:^|\s)(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

for (const f of files) {
  const full = path.join(JS_DIR, f);
  const src = fs.readFileSync(full, 'utf-8');
  src.split(/\r?\n/).forEach((line, i) => {
    const code = line.replace(/^\s*(\/\/|\*).*$/, '');
    if (!code.trim()) return;
    let m;
    specRe.lastIndex = 0;
    while ((m = specRe.exec(code)) !== null) {
      const spec = m[1] || m[2];
      if (!spec) continue;
      if (spec.includes('?')) {
        violations.push({ file: `js/${f}`, line: i + 1, spec, why: 'query string pada import modul → instance modul terpisah' });
      }
    }
  });
}

if (violations.length) {
  console.error('❌ Import modul dengan query string (/v=) terdeteksi:\n');
  for (const v of violations) {
    console.error(`   js/${path.basename(v.file)}:${v.line}  ${v.spec}`);
  }
  console.error('\n   Cache busting cukup dari vercel.json (Cache-Control: no-store) + service worker (network-first).');
  console.error('   Hapus query-nya. Lihat guard ini: control/scripts/check-module-imports.mjs\n');
  process.exit(1);
}

console.log(`✅ Tidak ada query string pada import modul (${files.length} file diperiksa).`);
