#!/usr/bin/env node
/**
 * check-rest-parity.mjs — pastikan whitelist tabel REST dev & produksi sama
 * =============================================================================
 *KENAPA INI ADA
 *   Tabel yang boleh diakses lewat /api/rest punya DUA daftar:
 *     • api/rest.js  → ALLOWED_REST_TABLES (dipakai di Vercel / produksi)
 *     • server.js    → allowedTables       (dipakai dev lokal)
 *   Keduanya terpisah di file berbeda → gampang lupa update salah satu.
 *   Gejalanya: dev lokal 200, produksi 403 forbidden_table (atau sebaliknya).
 *   Modul Kalender (content_materials) pernah kena persis ini.
 *
 * YANG DICARI
 *   1. Tabel yang ada di salah satu daftar tapi nggak di yang lain.
 *   2. Tabel yang DIIZINKAN di dev tapi TIDAK di produksi (atau sebaliknya).
 *   3. Tabel yang hilang total dari keduanya tapi dipakai modul di repo.
 *
 * Exit code: 0 = parity aman · 1 = ada selisih.
 * =============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROL = path.resolve(HERE, '..');

/** Pull nama tabel dari blok literal array/Set di dalam file. */
function pullTables(file, varName) {
  const src = fs.readFileSync(path.join(CONTROL, file), 'utf8');
  const re = new RegExp(`${varName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`);
  const m = src.match(re);
  if (!m) throw new Error(`Tidak bisa nemu ${varName} di ${file}`);
  // Buang komentar baris dulu, baru ambil SEMUA nama dalam kutip tunggal
  // (satu baris bisa berisi banyak nama: 'a', 'b', 'c',)
  const body = m[1].replace(/\/\/[^\n]*/g, '');
  const out = new Set();
  for (const t of body.matchAll(/'([a-z0-9_]+)'/gi)) out.add(t[1]);
  return out;
}

/** Tabel yang dipanggil modul front-end lewat /rest/v1/<tabel> */
function pullUsedTables() {
  const used = new Set();
  const jsDir = path.join(CONTROL, 'js');
  for (const f of fs.readdirSync(jsDir)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
    for (const m of src.matchAll(/\/rest\/v1\/([a-z0-9_]+)/gi)) used.add(m[1]);
  }
  // 'rpc' bukan tabel — dicek lewat ALLOWED_RPCS, bukan whitelist tabel.
  return new Set([...used].filter((t) => t !== 'rpc'));
}

const prod = pullTables('api/rest.js', 'ALLOWED_REST_TABLES');
const dev = pullTables('server.js', 'allowedTables');
const used = pullUsedTables();

const onlyProd = [...prod].filter((t) => !dev.has(t));
const onlyDev = [...dev].filter((t) => !prod.has(t));
const missing = [...used].filter((t) => !prod.has(t));

console.log('🔍 Cek parity whitelist /api/rest (dev vs produksi)\n');
console.log(`   api/rest.js  : ${prod.size} tabel`);
console.log(`   server.js    : ${dev.size} tabel`);
console.log(`   dipakai modul: ${used.size} tabel\n`);

let bad = 0;
if (onlyProd.length) {
  console.log(`   ❌ Hanya di api/rest.js (produksi): ${onlyProd.join(', ')}`);
  bad += onlyProd.length;
}
if (onlyDev.length) {
  console.log(`   ❌ Hanya di server.js (dev): ${onlyDev.join(', ')}`);
  bad += onlyDev.length;
}
if (missing.length) {
  console.log(`   ❌ Dipakai modul tapi TIDAK ada di whitelist produksi: ${missing.join(', ')}`);
  bad += missing.length;
}
if (!bad) {
  console.log('   ✅ Parity aman — kedua daftar identik & semua tabel yang dipakai modul sudah diizinkan.\n');
  process.exit(0);
}
console.log('\n   → Tambahkan tabel yang hilang ke KEDUA file (api/rest.js + server.js), lalu restart dev server.\n');
process.exit(1);
