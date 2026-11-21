#!/usr/bin/env node
/**
 * _qa-rpc-arg-sweep.mjs — sapuan menyeluruh pemanggilan RPC di kode produksi.
 *
 * TUJUAN: satu-satunya penyebab PGRST202 yang nyata adalah NAMA ARGUMEN yang
 * meleset dari signature Postgres (grant tidak berpengaruh ke schema cache).
 * Skrip ini:
 *   1. Ekstrak setiap pemanggilan RPC dari source 4 app + Control + Edge Function.
 *   2. Ambil signature live dari DB (melalui audit-query.js).
 *   3. Bandingkan nama argumen kode vs signature → laporkan yang meleset.
 *
 * READ-ONLY. Tidak memanggil RPC apa pun. Kunci tidak pernah dicetak.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 1. Kumpulkan source produksi ----------
const SCAN = [
  'kaki5/js', 'kaki5/src',
  'rosok/js',
  'mitra/src',
  'control/js', 'control/api',
  'masjid/adm-masjid', 'masjid/web-masjid',
  'supabase/functions',
];
const SKIP = /supabase\.min\.js$|\.min\.js$|node_modules/;

// Key opsi fetch yang BUKAN argumen Postgres.
const RESERVED = new Set([
  'body', 'method', 'headers', 'mode', 'cache', 'credentials', 'signal',
  'redirect', 'referrer', 'referrerPolicy', 'integrity', 'keepalive', 'json',
]);

function walk(dir, out = []) {
  const abs = path.resolve(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|\.git/.test(e.name)) walk(path.relative(ROOT, p), out); }
    else if (/\.(js|mjs|ts|astro|html)$/.test(e.name) && !SKIP.test(e.name)) out.push(p);
  }
  return out;
}

const files = SCAN.flatMap((d) => walk(d));
console.log(`File produksi dipindai: ${files.length}\n`);

// ---------- 2. Ekstrak pemanggilan RPC ----------
const calls = [];

function addCall(fn, args, file, line) {
  if (!fn) return;
  const clean = [...new Set(args.filter(Boolean))];
  calls.push({ fn, args: clean, file: path.relative(ROOT, file), line });
}

/**
 * Ambil HANYA key tingkat atas dari blok argumen.
 * Key di dalam objek bersarang (mis. p_profile: { nama_usaha, ... }) BUKAN
 * argumen Postgres — kalau ikut diambil, false positive "argumen meleset".
 *
 * Cara: buang seluruh isi objek/array bersarang, sisakan teks tingkat atas,
 * lalu ambil key yang diikuti tanda titik dua.
 */
function topLevelKeys(blok) {
  let out = '';
  let depth = 0;
  for (const ch of blok) {
    if (ch === '{' || ch === '[' || ch === '(') { depth++; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; continue; }
    if (depth === 0) out += ch;
  }
  // Buang isi string agar key di dalam string tidak ikut tertangkap.
  out = out.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
  return [...out.matchAll(/([a-z_][a-z0-9_]*)\s*:/gi)].map((x) => x[1]);
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);

  // Pola A: sb.rpc('nama', { ... }) — boleh lintas baris.
  const reRpc = /\.rpc\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*,\s*\{([\s\S]*?)\}\s*\)/gi;
  let m;
  while ((m = reRpc.exec(src))) {
    const line = src.slice(0, m.index).split(/\r?\n/).length;
    addCall(m[1], topLevelKeys(m[2]), file, line);
  }

  // Pola B: fetch(... '/rest/v1/rpc/nama', { ... body: JSON.stringify({ ... }) })
  const reUrl = /rpc\/([a-z_][a-z0-9_]*)/gi;
  lines.forEach((line, i) => {
    reUrl.lastIndex = 0;
    while ((m = reUrl.exec(line))) {
      const blok = lines.slice(i, i + 14).join('\n');
      const bodyAt = blok.indexOf('body');
      if (bodyAt < 0) continue;
      const bodyPart = blok.slice(bodyAt, bodyAt + 700);
      // Ambil isi objek PERTAMA di dalam body — itu argumen RPC-nya.
      const braceAt = bodyPart.indexOf('{');
      if (braceAt < 0) { addCall(m[1], [], file, i + 1); continue; }
      const inner = bodyPart.slice(braceAt + 1);
      // Potong di kurung kurawal penutup tingkat atas.
      let depth = 1, end = inner.length;
      for (let k = 0; k < inner.length; k++) {
        const ch = inner[k];
        if (ch === '{' || ch === '[' || ch === '(') depth++;
        else if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth === 0) { end = k; break; } }
      }
      const keys = topLevelKeys(inner.slice(0, end)).filter((n) => !RESERVED.has(n));
      addCall(m[1], keys, file, i + 1);
    }
  });
}

// ---------- 3. Signature live ----------
const sql = "select p.proname, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'";
const raw = execFileSync('node', [
  path.join(ROOT, 'supabase', 'audit-query.js'),
  '--ref=hhywrvedlwljawgxzpkq',
  `--sql=${sql}`,
], { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] });
const jsonStart = raw.indexOf('[');
const sigRows = JSON.parse(raw.slice(jsonStart));

const sigs = new Map();
for (const row of sigRows) {
  const names = row.args.trim() === '' ? []
    : row.args.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
  if (!sigs.has(row.proname)) sigs.set(row.proname, []);
  sigs.get(row.proname).push({ names, raw: row.args });
}

// ---------- 4. Bandingkan ----------
const uniq = new Map();
for (const c of calls) {
  const key = `${c.fn}|${c.args.sort().join(',')}|${c.file}`;
  if (!uniq.has(key)) uniq.set(key, c);
}

let cek = 0, hilang = 0, meleset = 0;
const rowsLuces = [];
for (const c of uniq.values()) {
  const overloads = sigs.get(c.fn);
  if (!overloads) { hilang++; rowsLuces.push({ ...c, status: 'FUNGSI TIDAK ADA', live: '-' }); continue; }
  // Guard: fungsi yang mewajibkan argumen tapi hasil ekstraksi kosong berarti
  // parser gagal — jangan lolos diam-diam (cek hampa = false confidence).
  const butuhArg = overloads.some((o) => o.names.length > 0);
  if (butuhArg && c.args.length === 0) {
    meleset++;
    rowsLuces.push({
      ...c, status: 'EKSTRAKSI KOSONG (parser gagal — perlu cek manual)',
      live: overloads.map((o) => `${c.fn}(${o.names.join(',')})`).join(' | '),
    });
    continue;
  }
  const cocok = overloads.some((o) => c.args.every((a) => o.names.includes(a)));
  if (!cocok) {
    meleset++;
    rowsLuces.push({
      ...c, status: 'ARGUMEN MELESET',
      live: overloads.map((o) => `${c.fn}(${o.names.join(',')})`).join(' | '),
    });
  } else { cek++; }
}

console.log('=== RINGKASAN ===');
console.log(`Pemanggilan unik diperiksa : ${uniq.size}`);
console.log(`Argumen cocok              : ${cek}`);
console.log(`Fungsi tidak ada di live   : ${hilang}`);
console.log(`ARGUMEN MELESET             : ${meleset}`);

console.log('\n=== DAFTAR PEMANGGILAN ===');
for (const c of [...uniq.values()].sort((a, b) => a.fn.localeCompare(b.fn) || a.file.localeCompare(b.file))) {
  const o = sigs.get(c.fn);
  const tanda = o && o.some((x) => c.args.every((a) => x.names.includes(a))) ? 'OK ' : '!! ';
  console.log(`${tanda}${c.fn}(${c.args.join(', ')})  ←  ${c.file}:${c.line}`);
}

if (rowsLuces.length) {
  console.log('\n=== PERLU PERHATIAN ===');
  for (const r of rowsLuces) {
    console.log(`\n[${r.status}] ${r.fn}`);
    console.log(`  file  : ${r.file}:${r.line}`);
    console.log(`  kode  : { ${r.args.join(', ')} }`);
    console.log(`  live  : ${r.live}`);
  }
} else {
  console.log('\nSemua pemanggilan RPC di kode produksi cocok dengan signature live.');
}
