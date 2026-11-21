// QA v168: audit rujukan `file:baris` di semua dokumen kaki5.
// Aturan: baris harus <= jumlah baris file nyata; nama file harus ketemu.
import { readFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';

const DOCS = ['README.md', 'DESIGN.md', 'CHANGELOG.md', 'AGENTS.md',
  'docs/DEVELOPER.md', 'docs/REGRESSION-CHECKLIST.md', '../CONTEXT.md'];

const jsFiles = new Set(readdirSync('js'));
const rootFiles = new Set(readdirSync('.').filter((f) => /\.(html|js|json|css|cjs)$/.test(f)));

const lineCountCache = new Map();
function linesOf(p) {
  if (lineCountCache.has(p)) return lineCountCache.get(p);
  let n = -1;
  if (existsSync(p)) n = readFileSync(p, 'utf8').split('\n').length;
  lineCountCache.set(p, n);
  return n;
}

let total = 0, outOfRange = [], unresolved = [];
for (const doc of DOCS) {
  if (!existsSync(doc)) { console.log('SKIP (tidak ada): ' + doc); continue; }
  const s = readFileSync(doc, 'utf8');
  // pola: namafile.ext:123  |  namafile.ext:12-34  |  `namafile.js:45`  |  nama.js:40-48
  for (const m of s.matchAll(/([A-Za-z0-9_.\/-]+\.(?:js|json|html|css|cjs|md))[:\s]*(?:line\s*)?(\d{1,5})(?:\s*[-–]\s*(\d{1,5}))?/g)) {
    const [, file, aStr, bStr] = m;
    const a = Number(aStr), b = Number(bStr || aStr);
    if (!Number.isFinite(a) || a === 0) continue;
    total++;
    let real = file;
    if (!existsSync(real)) {
      const base = file.split('/').pop();
      if (jsFiles.has(base)) real = 'js/' + base;
      else if (rootFiles.has(base)) real = base;
      else if (existsSync('docs/' + base)) real = 'docs/' + base;
      else { unresolved.push(`${doc}: ${file}:${a}`); continue; }
    }
    const n = linesOf(real);
    if (n < 0) { unresolved.push(`${doc}: ${file}:${a} (file tak terbaca)`); continue; }
    if (b > n || a > n) outOfRange.push(`${doc}: ${file}:${a}${bStr ? '-' + b : ''} > ${real} punya ${n} baris`);
  }
}
console.log(`rujukan file:baris terparse = ${total}`);
console.log(`di luar rentang = ${outOfRange.length}`);
outOfRange.slice(0, 25).forEach((x) => console.log('  RANGE ' + x));
console.log(`tak terselesaikan = ${unresolved.length}`);
unresolved.slice(0, 25).forEach((x) => console.log('  UNRES ' + x));
