// QA sintaks adm-masjid: compile semua blok <script> inline + sw.js tanpa mengeksekusi.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const files = ['adm-masjid/index.html', 'adm-masjid/sw.js'];
let gagal = 0;

for (const f of files) {
  const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
  const bloks = [];
  if (f.endsWith('.html')) {
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(src))) bloks.push(m[1]);
  } else {
    bloks.push(src);
  }
  bloks.forEach((code, i) => {
    try {
      new vm.Script(code, { filename: `${f}#script[${i}]` });
      console.log(`OK   ${f} blok ${i} (${code.length} char)`);
    } catch (e) {
      gagal++;
      console.log(`GAGAL ${f} blok ${i}: ${e.message}`);
      // tampilkan baris sekitar error bila tersedia
      const m2 = String(e.stack || '').match(/script\[\d\]:(\d+)/);
      if (m2) {
        const baris = code.split('\n');
        const n = Number(m2[1]);
        for (let j = Math.max(0, n - 3); j < Math.min(baris.length, n + 2); j++) {
          console.log(`  ${j + 1}: ${baris[j]}`);
        }
      }
    }
  });
}

// Pemeriksaan tambahan: identitas yang dipakai lintas-blok harus ada
const html = readFileSync(new URL('./adm-masjid/index.html', import.meta.url), 'utf8');
const wajib = [
  ['id="loginGate"', 'gerbang HTML'],
  ['const Akun = (function', 'modul Akun'],
  ['const Gerbang = {', 'modul Gerbang'],
  ['P.deviceId = deviceId', 'ekspor deviceId'],
  ["P.isLicensed = () => { try", 'isLicensed baru'],
  ['window.Gerbang = Gerbang', 'window.Gerbang'],
  ['window.Akun = Akun', 'window.Akun'],
  ['Gerbang.tampilkan()', 'init gerbang'],
  ['app_my_license', 'RPC lisensi'],
  ['sg-akun', 'kartu akun settings'],
];
for (const [cari, nama] of wajib) {
  if (!html.includes(cari)) { gagal++; console.log(`GAGAL pengecekan: ${nama} ("${cari}") tidak ditemukan`); }
}
// Sisa yang HARUS sudah hilang
const hilang = ['P.activate', 'P.fmtLic', 'P.doActivate', 'savedCode()', 'pfLicIn', 'Beli / Aktifkan'];
for (const s of hilang) {
  if (html.includes(s)) { gagal++; console.log(`GAGAL: "${s}" seharusnya sudah dihapus`); }
}

console.log(gagal ? `\n${gagal} masalah` : '\nSemua pemeriksaan lulus');
process.exit(gagal ? 1 : 0);
