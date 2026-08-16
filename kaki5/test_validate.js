// Unit test for validateBackup + sanitizeSettingsRows (extracted pure functions)
const fs = require('fs');
const src = fs.readFileSync('js/backup.js', 'utf8');
// evaluate the pure function definitions in a sandbox (harus mandiri tanpa konteks modul)
const fnSrc = src.match(/function validateBackup[\s\S]*?\nexport async function/)[0].replace(/\nexport async function$/, '');
const validateBackup = new Function(fnSrc + '\nreturn validateBackup;')();
const sanSrc = src.match(/function sanitizeSettingsRows[\s\S]*?\n}/)[0];
const sanitizeSettingsRows = new Function(sanSrc + '\nreturn sanitizeSettingsRows;')();

// Fixture valid lengkap (semua field yang divalidasi terisi benar)
const validRow = { id: 1, nama: 'Nasi Goreng', kategori: 'Makanan', hargaJual: 15000, hargaModal: 8000 };
const validPenjualan = { id: 1, tanggal: '2026-08-17', totalHarga: 30000, totalModal: 16000, items: [{ nama: 'Nasi Goreng', qty: 2, hargaJual: 15000 }] };
const validPengeluaran = { id: 1, tanggal: '2026-08-17', keterangan: 'Beli gas', kategori: 'Gas & BBM', jumlah: 20000 };
const valid = {
  version: 1,
  menu: [validRow],
  penjualan: [validPenjualan],
  pengeluaran: [validPengeluaran],
  pengaturan: [{ key: 'x' }],
  settings: [{ key: 'namaWarung', value: 'W' }],
  platformMessages: [{ id: 1 }]
};
const clone = o => JSON.parse(JSON.stringify(o));

const cases = [
  ['valid lengkap', valid, null],
  ['null', null, 'File tidak valid: bukan objek cadangan!'],
  ['string', 'hello', 'File tidak valid: bukan objek cadangan!'],
  ['array top', [], 'File tidak valid: bukan objek cadangan!'],
  ['no version', { menu: [] }, 'File tidak valid: versi tidak dikenal!'],
  ['version string', { version: '1', menu: [] }, 'File tidak valid: versi tidak dikenal!'],
  ['version 0', { version: 0, menu: [] }, 'File tidak valid: versi tidak dikenal!'],
  ['no menu', { version: 1 }, 'File tidak valid: data menu hilang/rusak!'],
  ['menu string', { version: 1, menu: 'x' }, 'File tidak valid: data menu hilang/rusak!'],
  ['penjualan null ok (defaults)', { version: 1, menu: [] }, null],
  ['penjualan string bad', { version: 1, menu: [], penjualan: 'x' }, 'File tidak valid: isi data rusak!'],
  ['penjualan nonobj', { version: 1, menu: [], penjualan: [5] }, 'File tidak valid: isi data rusak!'],
  ['pengaturan string bad', { version: 1, menu: [], pengaturan: 'x' }, 'File tidak valid: isi data rusak!'],
  // ── Lapis 2: field-level (T6) ──
  ['menu tanpa nama', (() => { const d = clone(valid); d.menu[0].nama = ' '; return d; })(), 'File ditolak: ada menu tanpa nama / nama rusak.'],
  ['menu harga jual string', (() => { const d = clone(valid); d.menu[0].hargaJual = '15rb'; return d; })(), 'File ditolak: harga jual menu "Nasi Goreng" tidak valid.'],
  ['menu harga jual negatif', (() => { const d = clone(valid); d.menu[0].hargaJual = -1; return d; })(), 'File ditolak: harga jual menu "Nasi Goreng" tidak valid.'],
  ['menu id string', (() => { const d = clone(valid); d.menu[0].id = 'x'; return d; })(), 'File ditolak: ada menu dengan id tidak valid.'],
  ['penjualan tanggal rusak', (() => { const d = clone(valid); d.penjualan[0].tanggal = '17/08/2026'; return d; })(), 'File ditolak: ada transaksi dengan tanggal rusak.'],
  ['penjualan total string', (() => { const d = clone(valid); d.penjualan[0].totalHarga = '30k'; return d; })(), 'File ditolak: ada transaksi dengan total rusak.'],
  ['penjualan items non-array', (() => { const d = clone(valid); d.penjualan[0].items = 'nasi'; return d; })(), 'File ditolak: ada transaksi dengan daftar item rusak.'],
  ['pengeluaran jumlah negatif', (() => { const d = clone(valid); d.pengeluaran[0].jumlah = -500; return d; })(), 'File ditolak: ada pengeluaran dengan jumlah uang rusak.'],
  ['settings key kosong', (() => { const d = clone(valid); d.settings[0].key = ''; return d; })(), 'File ditolak: ada pengaturan dengan key rusak.'],
  ['menu id ganda', (() => { const d = clone(valid); d.menu.push({ ...validRow }); return d; })(), 'File ditolak: ada menu dengan id ganda (1).'],
  ['penjualan id ganda', (() => { const d = clone(valid); d.penjualan.push({ ...validPenjualan }); return d; })(), 'File ditolak: ada transaksi dengan id ganda (1).'],
  ['menu id 0', (() => { const d = clone(valid); d.menu[0].id = 0; return d; })(), 'File ditolak: ada menu dengan id tidak valid.'],
  ['menu tanpa id (auto) ok', (() => { const d = clone(valid); delete d.menu[0].id; return d; })(), null],
];

let pass = 0;
cases.forEach(([name, input, expected]) => {
  const got = validateBackup(input);
  const ok = got === expected;
  if (ok) pass++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : (' | expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(got))));
});

// ── sanitizeSettingsRows (T7): lisensi & identitas tidak boleh ikut cadangan ──
const sanCases = [
  ['buang license', [{ key: 'license', value: { status: 'active' } }, { key: 'namaWarung', value: 'W' }], ['namaWarung']],
  ['buang onboarded+sync+deviceIdentity', [{ key: 'onboarded', value: true }, { key: 'sync', value: { status: 'synced' } }, { key: 'deviceIdentity', value: {} }, { key: 'unitId', value: 'K5-X' }, { key: 'installId', value: 'A1' }, { key: 'provinsi', value: 'Jawa Tengah' }], ['provinsi']],
  ['non-array -> []', 'bukan array', []],
  ['array kosong -> []', [], []],
];
sanCases.forEach(([name, input, expectedKeys]) => {
  const got = sanitizeSettingsRows(input).map(r => r.key);
  const ok = JSON.stringify(got) === JSON.stringify(expectedKeys);
  if (ok) pass++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | sanitize: ' + name + (ok ? '' : (' | expected ' + JSON.stringify(expectedKeys) + ' got ' + JSON.stringify(got))));
});

const total = cases.length + sanCases.length;
console.log('\n' + pass + '/' + total + ' passed');
process.exit(pass === total ? 0 : 1);
