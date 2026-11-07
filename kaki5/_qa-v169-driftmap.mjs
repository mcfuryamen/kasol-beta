import fs from 'fs';
import { execFileSync } from 'child_process';

const FILES = ['js/license.sync.js', 'js/sync.health.js', 'js/license.js', 'js/expensedetail.js', 'js/pos.ui.js', 'index.html'];
const DOCS = ['AGENTS.md', 'README.md', 'DESIGN.md', 'CHANGELOG.md', 'docs/DEVELOPER.md', 'docs/REGRESSION-CHECKLIST.md'];
const re = /([A-Za-z0-9_.\/-]+\.(?:js|html|css|json)):(\d+)(?:-(\d+))?/g;

const oldTxt = {}, newTxt = {};
for (const f of FILES) {
  newTxt[f] = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  let o = '';
  try { o = execFileSync('git', ['-C', '..', 'show', 'HEAD:kaki5/' + f], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { o = ''; }
  oldTxt[f] = o.split(/\r?\n/);
  console.log(`${f}: HEAD=${oldTxt[f].length} baris, kerja=${newTxt[f].length} baris, delta=${newTxt[f].length - oldTxt[f].length}`);
}

const rows = [];
for (const d of DOCS) {
  if (!fs.existsSync(d)) continue;
  fs.readFileSync(d, 'utf8').split(/\r?\n/).forEach((L, i) => {
    let m; re.lastIndex = 0;
    while ((m = re.exec(L))) {
      const t = m[1].replace(/^.*\/js\//, 'js/').replace(/^\.\//, 'js/');
      const key = FILES.find(k => k === t || k.endsWith('/' + t) || t.endsWith(k));
      if (!key) continue;
      rows.push({ doc: d, docLine: i + 1, file: key, line: Number(m[2]), end: m[3] ? Number(m[3]) : null, raw: m[0] });
    }
  });
}

function findInNew(file, text, hint) {
  const t = text.trim();
  if (!t) return { status: 'KOSONG' };
  const idx = [];
  const arr = newTxt[file];
  for (let i = 0; i < arr.length; i++) if (arr[i].trim() === t) idx.push(i + 1);
  if (idx.length === 0) return { status: 'HILANG' };
  if (idx.length === 1) return { status: 'OK', line: idx[0] };
  idx.sort((a, b) => Math.abs(a - hint) - Math.abs(b - hint));
  return { status: 'GANDA', line: idx[0], n: idx.length };
}

let need = 0;
for (const r of rows) {
  const o = oldTxt[r.file][r.line - 1];
  if (o === undefined) continue;
  const guess = r.line + (newTxt[r.file].length - oldTxt[r.file].length);
  const f = findInNew(r.file, o, guess);
  if (f.status === 'OK' && f.line === r.line) continue;   // tidak bergeser
  need++;
  console.log(`${r.doc}:${r.docLine}  ${r.file}:${r.line}${r.end ? '-' + r.end : ''}  ->  ${f.status === 'OK' || f.status === 'GANDA' ? f.line : f.status}` +
    (f.status === 'GANDA' ? ` (GANDA x${f.n})` : '') + `   | ${o.trim().slice(0, 60)}`);
}
console.log(`\nrujukan yang perlu digeser/diperiksa: ${need} dari ${rows.length}`);
