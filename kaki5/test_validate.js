// Unit test for validateBackup (extracted pure function)
const fs = require('fs');
const src = fs.readFileSync('js/backup.js', 'utf8');
// evaluate just the validateBackup function definition in a sandbox
const fnSrc = src.match(/function validateBackup[\s\S]*?\n}/)[0];
const validateBackup = new Function(fnSrc + '\nreturn validateBackup;')();

const valid = {
  version: 1,
  menu: [{id:1,nama:'A'}],
  penjualan: [{id:1}],
  pengeluaran: [{id:1}],
  pengaturan: [{key:'x'}]
};

const cases = [
  ['valid', valid, null],
  ['null', null, 'File tidak valid: bukan objek cadangan!'],
  ['string', 'hello', 'File tidak valid: bukan objek cadangan!'],
  ['array top', [], 'File tidak valid: bukan objek cadangan!'],
  ['no version', {menu:[]}, 'File tidak valid: versi tidak dikenal!'],
  ['version string', {version:'1', menu:[]}, 'File tidak valid: versi tidak dikenal!'],
  ['version 0', {version:0, menu:[]}, 'File tidak valid: versi tidak dikenal!'],
  ['no menu', {version:1}, 'File tidak valid: data menu hilang/rusak!'],
  ['menu string', {version:1, menu:'x'}, 'File tidak valid: data menu hilang/rusak!'],
  ['penjualan null ok (defaults)', {version:1, menu:[]}, null],
  ['penjualan string bad', {version:1, menu:[], penjualan:'x'}, 'File tidak valid: isi data rusak!'],
  ['penjualan nonobj', {version:1, menu:[], penjualan:[5]}, 'File tidak valid: isi data rusak!'],
  ['penjualan obj ok', {version:1, menu:[], penjualan:[{a:1}]}, null],
  ['pengaturan string bad', {version:1, menu:[], pengaturan:'x'}, 'File tidak valid: isi data rusak!'],
];

let pass = 0;
cases.forEach(([name, input, expected]) => {
  const got = validateBackup(input);
  const ok = got === expected;
  if (ok) pass++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : (' | expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(got))));
});
console.log('\n' + pass + '/' + cases.length + ' passed');
process.exit(pass === cases.length ? 0 : 1);
