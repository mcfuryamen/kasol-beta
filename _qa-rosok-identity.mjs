// QA deterministik modul identifikasi perangkat rosok (2026-09-13).
// Menarik fungsi INTI langsung dari rosok/js/license.js (tanpa dependensi
// browser) lalu mengujinya:
//   T1  sha256PureBytes === crypto.subtle.digest (semua batas padding)
//   T2  fnv1aHistorical(bytes) === fnv1a(string) era V4 (git c11a4f2)
//   T3  getLegacyV4DeviceCodes() mencakup kode hasil algoritma V4 historis
//       (rasa SHA + rasa FNV, orientasi asli & terbalik)
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const src = readFileSync(new URL('./rosok/js/license.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// ── Ekstraksi fungsi tingkat-atas (semua ditutup '\n}' di kolom 0) ────────
function extract(name) {
  const m = src.match(new RegExp(`^(?:export )?(?:async )?function ${name}\\b[^\\n]*(\\n(?!\\n})[^\\n]*)*?\\n\\}`, 'm'));
  if (!m) throw new Error('fungsi tidak ketemu/tak tertutup: ' + name);
  return m[0];
}
function extractConst(name) {
  const m = src.match(new RegExp(`^const ${name} = new Uint32Array\\(\\[\\n[\\s\\S]*?\\n\\]\\);`, 'm'));
  if (!m) throw new Error('konstanta tidak ketemu: ' + name);
  return m[0];
}
const code = [
  'const B32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";',
  extractConst('SHA256_K'),
  extract('simpleHash'), extract('b32Encode'), extract('getDeviceCode'),
  extract('sha256PureBytes'), extract('fnv1aHistorical'), extract('getLegacyV4DeviceCodes'),
  'return { simpleHash, b32Encode, getDeviceCode, sha256PureBytes, fnv1aHistorical, getLegacyV4DeviceCodes };'
].join('\n').replace(/\bexport\s+/g, '');
if (process.env.QA_DUMP) (await import('node:fs')).writeFileSync('_qa-rosok-identity-composed.js', code);
const mod = new Function('navigator', 'screen', 'crypto', 'TextEncoder', code);

const cryptoShim = { subtle: webcrypto.subtle };
const enc = new TextEncoder();

// ── T1: sha256PureBytes vs webcrypto ──────────────────────────────────────
const { sha256PureBytes } = mod({}, {}, cryptoShim, TextEncoder);
const sizes = [0, 1, 3, 11, 12, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 1000];
const inputs = sizes.map(n => enc.encode('KSR-FP-V5|'.repeat(Math.ceil(n / 11)).slice(0, n)));
for (const b of inputs) {
  const expect = new Uint8Array(await webcrypto.subtle.digest('SHA-256', b));
  const got = sha256PureBytes(b);
  if (Buffer.from(got).toString('hex') !== Buffer.from(expect).toString('hex')) {
    console.error('T1 GAGAL len=' + b.length); process.exit(1);
  }
}
console.log('T1 PASS — sha256PureBytes identik webcrypto pada', inputs.length, 'panjang input (0..1000 byte)');

// ── T2: fnv1aHistorical vs implementasi era V4 (c11a4f2, input string) ────
function fnv1aEraV4(joined) { // salinan PERSIS dari git show c11a4f2:rosok/js/license.js
  const bytes = new TextEncoder().encode(joined);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 = (h1 ^ bytes[i]) >>> 0; h2 = (h2 * 0x01000193) >>> 0;
    h1 = (h1 * 0x01000193) >>> 0; h2 = (h2 ^ bytes[i]) >>> 0;
  }
  return new Uint8Array([
    (h1 >>> 24) & 0xff, (h1 >>> 16) & 0xff, (h1 >>> 8) & 0xff, h1 & 0xff,
    (h2 >>> 24) & 0xff, (h2 >>> 16) & 0xff, (h2 >>> 8) & 0xff, h2 & 0xff
  ]);
}
const { fnv1aHistorical, b32Encode, getDeviceCode, getLegacyV4DeviceCodes, simpleHash } =
  mod({}, {}, cryptoShim, TextEncoder);
for (const s of ['KSR-FP-V4|8|8|5|2220x1080', 'KSR-FP-V4|4|4|0|1366x768', 'KSR-FP-V4|||0|sc:na', 'KSR-FP-V4|16||10|800x1280']) {
  const a = Buffer.from(fnv1aHistorical(enc.encode(s))).toString('hex');
  const b = Buffer.from(fnv1aEraV4(s)).toString('hex');
  if (a !== b) { console.error('T2 GAGAL:', s, a, b); process.exit(1); }
}
console.log('T2 PASS — fnv1aHistorical byte-identik dengan fnv1a era V4 (c11a4f2)');

// ── T3: re-derive baru mencakup kode algoritma V4 historis ────────────────
// Peralatan uji "perangkat": core 8, RAM 8, touch 5, layar 2220x1080.
const navUji = { hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 5 };
const screenUji = { width: 2220, height: 1080 };
const modUji = mod(navUji, screenUji, cryptoShim, TextEncoder);
const devCode = fp => { // getDeviceCode persis license.js
  const h = simpleHash('DEVICE-' + fp);
  const b36 = h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  return b36.slice(0, 4) + '-' + b36.slice(4, 8);
};
async function fpV4EraSHA(screenStr) { // algoritma V4 historis, rasa SHA (secure ctx)
  const joined = 'KSR-FP-V4|' + ['8', '8', '5', screenStr].join('|');
  return b32Encode(new Uint8Array(await webcrypto.subtle.digest('SHA-256', enc.encode(joined))), 12);
}
function fpV4EraFNV(screenStr) { // algoritma V4 historis, rasa FNV (http://LAN)
  // fnv1aEraV4 versi asli menerima STRING dan meng-encode sendiri.
  return b32Encode(fnv1aEraV4('KSR-FP-V4|' + ['8', '8', '5', screenStr].join('|')), 12);
}
const got = await modUji.getLegacyV4DeviceCodes();
const ekspektasi = new Set();
for (const sp of ['2220x1080', '1080x2220']) {
  ekspektasi.add(devCode(await fpV4EraSHA(sp)));
  ekspektasi.add(devCode(fpV4EraFNV(sp)));
}
const kurang = [...ekspektasi].filter(c => !got.includes(c));
if (kurang.length) { console.error('T3 GAGAL — kandidat hilang:', kurang, 'ada:', got); process.exit(1); }
console.log('T3 PASS — getLegacyV4DeviceCodes mencakup', ekspektasi.size, 'kode historis (2 orientasi × 2 digest):', got.join(', '));
console.log('SEMUA TES LULUS ✅');
