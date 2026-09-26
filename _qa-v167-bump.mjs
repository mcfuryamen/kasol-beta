// _qa-v167-bump.mjs — naikkan versi kaki5 ke 1.0.99 / v167 pada 6 slot sinkron.
// Sekali pakai, aman di-rerun (idempoten: kalau sudah v167, ia melapor tanpa menulis).
import fs from 'node:fs';

const K = 'C:/Users/Admin/Documents/kasol/kaki5/';
let gagal = 0;

function patch(file, pairs) {
  const p = K + file;
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  for (const [a, b, exp] of pairs) {
    const c = s.split(a).length - 1;
    if (c !== exp) {
      console.log('!! ' + file + ': match ' + JSON.stringify(a.slice(0, 50)) + ' = ' + c + ' (harus ' + exp + ')');
      gagal++;
      return;
    }
    s = s.split(a).join(b);
    console.log('ok ' + file + '  x' + exp + '  ' + JSON.stringify(a.slice(0, 46)));
  }
  if (s === before) { console.log('!! ' + file + ' tidak berubah'); gagal++; return; }
  fs.writeFileSync(p, s, 'utf8');
}

// 1+2  version.js: APP_VERSION + CACHE_BUST
patch('js/version.js', [
  ["export const APP_VERSION = '1.0.98';", "export const APP_VERSION = '1.0.99';", 1],
  ["export const CACHE_BUST = 'v166';", "export const CACHE_BUST = 'v167';", 1],
]);

// 3+4  version.json: version + cacheBust
patch('js/version.json', [
  ['"version": "1.0.98"', '"version": "1.0.99"', 1],
  ['"cacheBust": "v166"', '"cacheBust": "v167"', 1],
]);

// 5    version.json: notes (dipakai overlay "Versi Baru Tersedia")
const oldNotes = fs.readFileSync(K + 'js/version.json', 'utf8');
const notesStart = oldNotes.indexOf('  "notes": [');
const notesEnd = oldNotes.indexOf(']\n}', notesStart);
if (notesStart < 0 || notesEnd < 0) {
  console.log('!! version.json: blok notes tidak ditemukan'); gagal++;
} else {
  const baru = [
    '  "notes": [',
    '    "Kas sekarang benar-benar wajib dibuka dulu sebelum jualan selama fiturnya aktif. Sebelumnya ada kondisi di mana transaksi tetap lolos tanpa diminta modal awal.",',
    '    "Halaman Pengaturan kini menampilkan kondisi saklar yang SEBENARNYA, walau koneksi ke server lambat atau tidak terjangkau. Dahulu saklar bisa terlihat AKTIF padahal data tersimpan-nya MATI.",',
    '    "Menyalakan atau mematikan saklar \\"Buka / Tutup Kas\\" tidak bisa lagi batal dengan sendirinya, dan status fitur dibaca ulang pada tiap transaksi sehingga tidak tertinggal oleh jendela/tab lain."',
  ].join('\n');
  const s = oldNotes.slice(0, notesStart) + baru + oldNotes.slice(notesEnd);
  fs.writeFileSync(K + 'js/version.json', s, 'utf8');
  console.log('ok js/version.json  notes diganti (3 baris)');
}

// 6a+6b  sw.js: komentar header + CACHE_NAME
patch('sw.js', [
  ["const CACHE_NAME = 'kasir-solo-kaki5-v166';", "const CACHE_NAME = 'kasir-solo-kaki5-v167';", 1],
  ['// Cache version v166 ', '// Cache version v167 ', 1],
]);

// 6c  index.html: ?v=
patch('index.html', [
  ['src="js/app.js?v=166"', 'src="js/app.js?v=167"', 1],
]);

console.log(gagal === 0 ? '\nSEMUA SLOT TERPASANG.' : '\nADA ' + gagal + ' PATCH GAGAL.');
process.exit(gagal === 0 ? 0 : 1);
