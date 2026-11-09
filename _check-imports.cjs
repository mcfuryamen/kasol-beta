// Cek sementara (pre-rilis): semua referensi .js dari index.html & js/*.js
// harus (a) ada di disk dan (b) sudah tracked git — anti kasus referral.js.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = 'C:/Users/Admin/Documents/kasol/kaki5';
const refs = new Set();

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const reTag = /(?:src|href)=["']([^"']*\.js)["']/g;
let m;
while ((m = reTag.exec(html)) !== null) refs.add(m[1].split('?')[0]);

const jsDir = path.join(root, 'js');
const reImport = /from\s+['"](\.[^'"]+\.js)['"]/g;
const reDyn = /import\(\s*['"](\.[^'"]+\.js)['"]\s*\)/g;
for (const f of fs.readdirSync(jsDir).filter((x) => x.endsWith('.js'))) {
  const t = fs.readFileSync(path.join(jsDir, f), 'utf8');
  while ((m = reImport.exec(t)) !== null) refs.add(path.posix.normalize('js/' + f.replace(/[^/]+$/, '') + m[1]).replace(/\\/g, '/'));
  while ((m = reDyn.exec(t)) !== null) refs.add(path.posix.normalize('js/' + f.replace(/[^/]+$/, '') + m[1]).replace(/\\/g, '/'));
}

const tracked = new Set(
  execSync('git ls-files -- kaki5/', { cwd: 'C:/Users/Admin/Documents/kasol' }).toString().trim().split('\n')
);

const notOnDisk = [];
const untracked = [];
for (const r of refs) {
  const rel = r.replace(/^\//, '');
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { notOnDisk.push(rel); continue; }
  if (!tracked.has('kaki5/' + rel)) untracked.push(rel);
}

console.log('referensi .js unik:', refs.size);
console.log('TIDAK ADA DI DISK:', notOnDisk.length ? notOnDisk.join(' | ') : '-');
console.log('BELUM TRACKED GIT:', untracked.length ? untracked.join(' | ') : '-');
