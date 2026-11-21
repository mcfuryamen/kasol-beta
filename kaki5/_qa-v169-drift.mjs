import fs from 'fs';

const CHANGED = {
  'js/license.sync.js': 189,   // perubahan mulai baris ini
  'js/sync.health.js': 151,
  'js/license.js': 54,
  'js/expensedetail.js': 87,
  'js/pos.ui.js': 882,
  'index.html': 952
};
const DOCS = ['AGENTS.md', 'README.md', 'DESIGN.md', 'CHANGELOG.md', 'docs/DEVELOPER.md', 'docs/REGRESSION-CHECKLIST.md', '../CONTEXT.md', '../DEPLOYMENT.md'];

const re = /([A-Za-z0-9_.\/-]+\.(?:js|html|css|json)):(\d+)(?:-(\d+))?/g;
const linesOf = {};
function getLines(p) {
  if (!linesOf[p]) {
    const abs = p.startsWith('../') ? p : p;
    linesOf[p] = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split(/\r?\n/) : null;
  }
  return linesOf[p];
}

let n = 0;
for (const d of DOCS) {
  if (!fs.existsSync(d)) { console.log(`(dokumen absen: ${d})`); continue; }
  const dl = fs.readFileSync(d, 'utf8').split(/\r?\n/);
  dl.forEach((L, i) => {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(L))) {
      const target = m[1].replace(/^.*\/js\//, 'js/').replace(/^\.\//, 'js/');
      const key = Object.keys(CHANGED).find(k => k.endsWith(target) || target.endsWith(k.split('/').pop()));
      if (!key) continue;
      const ln = Number(m[2]);
      if (ln < CHANGED[key]) continue;              // di bawah titik perubahan → tidak bergeser
      const src = getLines(key);
      const shown = src ? (src[ln - 1] || '(di luar file)').trim().slice(0, 96) : 'FILE ABSEN';
      console.log(`${d}:${i + 1}  ->  ${key}:${ln}${m[3] ? '-' + m[3] : ''}`);
      console.log(`      | ${shown}`);
      n++;
    }
  });
}
console.log(`\nrujukan berpotensi bergeser: ${n}`);
