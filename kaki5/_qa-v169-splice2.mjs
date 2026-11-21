import fs from 'fs';
const P = 'js/sync.health.js';
let src = fs.readFileSync(P, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const norm = (s) => s.replace(/\r\n/g, '\n').replace(/\n/g, nl);
const before = src;

// 1) komentar kepala: label UI asli = "Cek Data Online"
src = src.replace(
  '// Dipanggil dari Pengaturan \u2192 Data & Cadangan \u2192 \ud83e\ude7a Diagnosa Sinkronisasi.',
  '// Dipanggil dari Pengaturan \u2192 Data & Cadangan \u2192 "Cek Data Online".');

// 2) impor reanchor (satu modul yang sama dengan getSupabaseClient)
src = src.replace(
  "import { getSupabaseClient } from './license.sync.js';",
  "import { getSupabaseClient, reanchorUnitId } from './license.sync.js';");

// 3) sisip langkah 11 sebelum ringkasan
const anchor = '  const failed = steps.some(s => s.status === FAIL);';
if (!src.includes(anchor)) throw new Error('anchor langkah gagal ditemukan');
const block = norm(fs.readFileSync('_qa-v169-diag-step.txt', 'utf8')).replace(/\s+$/, '') + nl + nl;
src = src.replace(anchor, block + anchor);

fs.writeFileSync(P, src, 'utf8');
console.log('perubahan byte:', src.length - before.length);
const L = src.split(/\r?\n/);
const show = (s) => { const i = L.findIndex(x => x.includes(s)); console.log((i < 0 ? 'HILANG  ' : (i + 1) + '     ') + s); };
show('Cek Data Online".');
show('reanchorUnitId } from');
show('11. Konsistensi identitas perangkat');
show('const failed = steps.some');
