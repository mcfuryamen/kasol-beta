// QA v168: bump versi 6 slot (8 titik teks) + catatan rilis.
// Gagal keras kalau salah satu anchor tidak ketemu persis 1x.
import { readFileSync, writeFileSync } from 'node:fs';

let gagal = 0;
function sub(file, from, to, label) {
  const s = readFileSync(file, 'utf8');
  const n = s.split(from).length - 1;
  if (n !== 1) { console.log(`  FAIL ${label}: anchor ${n}x di ${file}`); gagal++; return; }
  writeFileSync(file, s.replace(from, to), 'utf8');
  console.log(`  ok   ${label}`);
}

console.log('=== bump v167 -> v168 / 1.0.99 -> 1.0.100 ===');
sub('js/version.js', "export const APP_VERSION = '1.0.99';", "export const APP_VERSION = '1.0.100';", 'version.js APP_VERSION');
sub('js/version.js', "export const CACHE_BUST = 'v167';", "export const CACHE_BUST = 'v168';", 'version.js CACHE_BUST');
sub('js/version.json', '"version": "1.0.99",', '"version": "1.0.100",', 'version.json version');
sub('js/version.json', '"cacheBust": "v167",', '"cacheBust": "v168",', 'version.json cacheBust');
sub('sw.js', "const CACHE_NAME = 'kasir-solo-kaki5-v167';", "const CACHE_NAME = 'kasir-solo-kaki5-v168';", 'sw.js CACHE_NAME');
sub('sw.js', '// Cache version v167 — ubah angka INI juga setiap swap', '// Cache version v168 — ubah angka INI juga setiap swap', 'sw.js header versi');
sub('index.html', 'src="js/app.js?v=167"', 'src="js/app.js?v=168"', 'index.html ?v=');

// notes version.json -> isi v168
const notesBaru = `  "notes": [
    "Halaman Bantuan ditulis ulang menyeluruh: 11 jadi 17 tutorial, mengikuti aplikasi versi sekarang. Ada panduan baru Buka/Tutup Kas, Tahan Pesanan, harga Ojol & topping, bayar QRIS/Transfer dengan foto bukti, pemasukan, tutup buku tahunan, dan barang titipan/konsinyasi.",
    "Petunjuk lama yang sudah tidak cocok dengan aplikasi dibuang: layar \\"Mulai Masa Percobaan\\", tombol \\"Tambah 1 Hari Gratis\\" lewat berbagi, chip \\"TRIAL\\", serta nama kategori dan tombol yang sudah berganti.",
    "Kode perangkat diturunkan dari identitas perangkat keras saja (tidak ikut browser/platform), jadi satu HP yang sama tidak lagi menghasilkan dua identitas berbeda saat pindah browser."]`;
const vj = readFileSync('js/version.json', 'utf8');
const reNotes = /^\s*"notes": \[[\s\S]*?\](?=})/m;
if (!reNotes.test(vj)) { console.log('  FAIL version.json notes: blok tidak ketemu'); gagal++; }
else {
  writeFileSync('js/version.json', vj.replace(reNotes, notesBaru), 'utf8');
  console.log('  ok   version.json notes');
}

// blok riwayat v168 di sw.js: sisip tepat sebelum blok v167
const sw = readFileSync('sw.js', 'utf8');
const anchor = '// v167: gerbang "buka kas dulu" tidak bisa lagi lolos diam-diam.';
if (sw.split(anchor).length - 1 !== 1) { console.log('  FAIL sw.js anchor v167'); gagal++; }
else {
  const blok = `// v168: modul Bantuan (js/bantuan.js) ditulis ulang mengikuti kode nyata: 17 tutorial,
//       termasuk Buka/Tutup Kas, Tahan Pesanan, harga Ojol/topping, metode bayar
//       non-tunai + foto bukti, pemasukan, tutup buku tahunan, konsinyasi/retur.
//       Klaim fitur yang sudah dicabut (onboarding gate, tambah-hari-berbagi,
//       chip "TRIAL") dibuang. Tidak ada perubahan logika aplikasi di rilis ini.
`;
  writeFileSync('sw.js', sw.replace(anchor, blok + anchor), 'utf8');
  console.log('  ok   sw.js blok riwayat v168 (+6 baris)');
}

console.log(gagal === 0 ? '=== SEMUA SLOT NAIK ===' : `=== ${gagal} ANCHOR GAGAL ===`);
process.exit(gagal ? 1 : 0);
