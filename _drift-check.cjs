// Drift check CSS ↔ template (audit tipografi 2026-11-05):
// 1) kelas yang DIHAPUS tidak boleh masih dipakai di js/html
// 2) kelas k* yang dipakai template harus ada di style.css
// 3) semua var(--fs-*) yang dipakai harus terdefinisi di :root
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html|astro)$/.test(e.name)) files.push(p);
  }
})('kaki5');

const css = fs.readFileSync('kaki5/css/style.css', 'utf8');
const src = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
let bad = 0;

const dead = ['cart-info', 'cart-qty-price', 'cart-meta', 'cart-top', 'takeaway-badge',
  'dinein-badge', 'ojol-badge', 'ojol-tag', 'cart-toppings', 'topping-remove'];
for (const c of dead) {
  const re = new RegExp('["\'\\s]' + c.replace(/-/g, '\\-') + '["\'\\s]');
  if (re.test(src)) { console.log('MASIH DIPAKAI:', c); bad++; }
}

const used = [...src.matchAll(/class="([^"]+)"/g)]
  .flatMap((m) => m[1].split(/\s+/))
  .filter((c) => c && /^(kfs|kfw|ktext|karrow|kver|knote|kreport|klegend|ksummary|klic|kamount|kpay|kpwa|kpinstall|ktrx|kcap|kmono|kfield|btn-xs)/.test(c));
const missing = [...new Set(used)].filter(
  (c) => !new RegExp('\\.' + c.replace(/-/g, '\\-') + '[\\s,{:]').test(css));
if (missing.length) { console.log('KELAS TIDAK ADA DI CSS:', missing.join(', ')); bad++; }

const tokens = [...new Set([...css.matchAll(/var\(--fs-([0-9]+)\)/g)].map((m) => m[1]))];
const undef = tokens.filter((t) => !new RegExp('--fs-' + t + ':').test(css));
if (undef.length) { console.log('TOKEN TAK TERDEFINISI:', undef.join(',')); bad++; }

console.log('kelas k* dipakai template:', new Set(used).size, '| token terpakai:', tokens.length);
console.log(bad === 0 ? 'DRIFT CHECK: OK' : 'DRIFT CHECK: ' + bad + ' masalah');
process.exit(bad === 0 ? 0 : 1);
