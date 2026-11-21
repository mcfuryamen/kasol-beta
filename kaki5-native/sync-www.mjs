// Sinkronisasi web app kaki5 -> bundle offline Capacitor (www/).
// Jalankan ulang skrip ini setiap kali kaki5/ rilis versi baru, lalu build APK:
//   node sync-www.mjs && npx cap sync android
//
// Yang TIDAK ikut dibundel (tidak berlaku di dalam APK):
//   _qa-*, *.md, docs/, api/ (serverless Vercel), test-*.js, server.cjs,
//   vercel.json, package.json
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const SRC = join(root, '..', 'kaki5');
const DST = join(root, 'www');

const EXCLUDE_FILES = new Set([
  'AGENTS.md', 'CHANGELOG.md', 'DESIGN.md', 'README.md',
  'package.json', 'package-lock.json', 'server.cjs', 'vercel.json'
]);

function excluded(rel) {
  const base = rel.split(/[\\/]/).pop();
  if (rel.startsWith('_qa-') || base.startsWith('_qa-')) return true;
  if (EXCLUDE_FILES.has(base)) return true;
  if (/^test-.*\.m?js$/.test(base)) return true;
  const top = rel.split(/[\\/]/)[0];
  if (top === 'docs' || top === 'api' || top === '.git' || top === 'node_modules') return true;
  return false;
}

rmSync(DST, { recursive: true, force: true });
mkdirSync(DST, { recursive: true });

cpSync(SRC, DST, {
  recursive: true,
  filter: (src) => {
    const rel = src.slice(SRC.length + 1);
    if (!rel) return true;
    if (excluded(rel)) return false;
    try { if (statSync(src).isDirectory()) return true; } catch { return false; }
    return true;
  }
});

// Patch index.html: injeksi native-bridge.js (shim Web Bluetooth + guard PWA)
// sebelum modul app.js — printer.js baru jalan saat user tap, tapi shim harus
// sudah terpasang sejak load.
const idxPath = join(DST, 'index.html');
let idx = readFileSync(idxPath, 'utf8');
if (!idx.includes('js/native-bridge.js')) {
  const anchor = idx.match(/<script type="module" src="js\/app\.js[^"]*"><\/script>/);
  if (!anchor) throw new Error('anchor <script app.js> tidak ditemukan di index.html');
  idx = idx.replace(anchor[0], '<script src="js/native-bridge.js"></script>\n  ' + anchor[0]);
  writeFileSync(idxPath, idx);
}

// native-bridge.js dijamin ada di www/js/
if (!existsSync(join(DST, 'js', 'native-bridge.js'))) {
  cpSync(join(root, 'native-bridge.js'), join(DST, 'js', 'native-bridge.js'));
}

console.log('[sync-www] OK — kaki5 -> www (dengan native-bridge.js)');
