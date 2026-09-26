import { readFileSync, writeFileSync } from 'node:fs';
const notesBaru = `  "notes": [
    "Halaman Bantuan ditulis ulang menyeluruh: 11 jadi 17 tutorial, mengikuti aplikasi versi sekarang. Ada panduan baru Buka/Tutup Kas, Tahan Pesanan, harga Ojol & topping, bayar QRIS/Transfer dengan foto bukti, pemasukan, tutup buku tahunan, dan barang titipan/konsinyasi.",
    "Petunjuk lama yang sudah tidak cocok dengan aplikasi dibuang: layar \\"Mulai Masa Percobaan\\", tombol \\"Tambah 1 Hari Gratis\\" lewat berbagi, chip \\"TRIAL\\", serta nama kategori dan tombol yang sudah berganti.",
    "Kode perangkat diturunkan dari identitas perangkat keras saja (tidak ikut browser/platform), jadi satu HP yang sama tidak lagi menghasilkan dua identitas berbeda saat pindah browser."]`;
const f = 'js/version.json';
const s = readFileSync(f, 'utf8');
const re = /^\s*"notes": \[[\s\S]*?(?=\s*})/m;
const m = s.match(re);
if (!m) { console.log('FAIL: blok notes tidak ketemu'); process.exit(1); }
const out = s.replace(re, notesBaru);
JSON.parse(out); // validasi JSON
writeFileSync(f, out, 'utf8');
console.log('ok notes diganti (' + m[0].length + ' -> ' + notesBaru.length + ' char), JSON valid');
