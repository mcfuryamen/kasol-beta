// Unit test for POS preset-nominal logic (extracted pure function)
// Mirip test_validate.js: ekstrak fungsi murni dari source agar bisa dijalankan
// di Node tanpa Dexie/IndexedDB/DOM.
const fs = require('fs');
const src = fs.readFileSync('js/pos.logic.js', 'utf8');
const fnSrc = src.match(/function generatePresetNominal[\s\S]*?\n}/)[0];
const generatePresetNominal = new Function(fnSrc + '\nreturn generatePresetNominal;')();

const cases = [
  ['total 0', 0, []],
  ['total negatif', -5000, []],
  ['total 1000', 1000, [2000, 5000, 10000, 20000]],
  ['total 25000', 25000, [26000, 30000, 40000, 50000]],
  ['total dekat 1jt', 999000, [1000000]],
];

let pass = 0;
cases.forEach(([name, input, expected]) => {
  const got = generatePresetNominal(input);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) pass++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : (' | expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(got))));
});

// Invarian: tiap preset harus > total harga, dan maksimal 4 buah (tanpa duplikat)
const inv = [0, 1000, 25000, 123456, 999000].every(t => {
  const p = generatePresetNominal(t);
  return p.length <= 4 && p.every(v => v > t) && new Set(p).size === p.length;
});
if (inv) pass++;
console.log((inv ? 'PASS' : 'FAIL') + ' | invarian: preset > total, <=4, tanpa duplikat');

console.log('\n' + pass + '/' + (cases.length + 1) + ' passed');
process.exit(pass === cases.length + 1 ? 0 : 1);
