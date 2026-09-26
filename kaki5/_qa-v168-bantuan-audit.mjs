// Harness QA: (1) pastikan string basi mode-mati tidak muncul lagi di bantuan.js
// (2) pastikan semua kelas CSS yang dipakai tutorial benar-benar ada di style.css
import { readFileSync } from 'node:fs';

const tut = readFileSync('js/bantuan.js', 'utf8');
const css = readFileSync('css/style.css', 'utf8');

const DEAD = [
  'TRIAL', 'Tambah 1 Hari', 'Mulai Masa Percobaan', 'Setuju & Lanjut',
  'Jajanan', 'uang pas', '"Instal"', 'Daftar Transaksi', 'Bluettooth',
  'Routin-routin', 'Printer Bluetooth', 'Onboarding', 'tab <b>Makanan',
  'Simpan</b> untuk menyimpan', 'Kirim Bukti Pembayaran', 'Biasa',
  'Deskripsi', 'masa coba', 'hari lagi', 'berbagi', 'share'
];
console.log('=== STRING BASI ===');
let bad = 0;
for (const d of DEAD) {
  const n = tut.split(d).length - 1;
  if (n > 0) { bad += n; console.log(`  ADA(${n}) "${d}"`); }
}
console.log(bad === 0 ? '  bersih (0 kemunculan)' : `  TOTAL ${bad}`);

console.log('=== KELAS CSS ===');
const used = new Set();
for (const m of tut.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => c && used.add(c));
const miss = [...used].filter((c) => !new RegExp('\\.' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s,{:.\\\\]').test(css));
console.log('  dipakai: ' + [...used].sort().join(' '));
console.log(miss.length ? '  TIDAK ADA DI CSS: ' + miss.join(', ') : '  semua kelas ada di style.css');

console.log('=== KESELAMATAN ===');
console.log('  inline onclick/onerror: ' + (/on(?:click|error|load|change|input)\s*=/i.test(tut) ? 'ADA (BAHAYA)' : '0'));
console.log('  tag <script>: ' + (/<script/i.test(tut) ? 'ADA (BAHAYA)' : '0'));
console.log('  escapeHtml dipakai: ' + (/escapeHtml\(/.test(tut) ? 'ya' : 'TIDAK'));
console.log('  jumlah tutorial: ' + (tut.match(/icon:\s*'[^']*'/g) || []).length);
