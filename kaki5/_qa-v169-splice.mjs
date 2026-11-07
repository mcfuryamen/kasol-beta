import fs from 'fs';
const P = 'js/license.sync.js';
const src = fs.readFileSync(P, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const block = fs.readFileSync('_qa-v169-reanchor-block.txt', 'utf8')
  .replace(/\r\n/g, '\n').replace(/\n/g, nl);

const tag = src.indexOf('* RE-ANCHOR unit_id');
if (tag < 0) throw new Error('anchor mulai tidak ditemukan');
const start = src.lastIndexOf('/**', tag);
if (start < 0) throw new Error('pembuka komentar tidak ditemukan');

const endTail = "return { ok: false, reason: 'write', error: migErr.message };";
const et = src.indexOf(endTail, start);
if (et < 0) throw new Error('anchor akhir tidak ditemukan');
const close = src.indexOf('}', src.indexOf('\n', et));
if (close < 0) throw new Error('penutup fungsi tidak ditemukan');

const before = src.slice(0, start);
const after = src.slice(close + 1);
const out = before + block.replace(/\n+$/, '') + after;
fs.writeFileSync(P, out, 'utf8');

const L = out.split(/\r?\n/);
console.log('OK splice. baris total:', L.length);
const find = (s) => { const i = L.findIndex(x => x.includes(s)); return i < 0 ? 'HILANG' : (i + 1); };
console.log('doc RE-ANCHOR  :', find('* RE-ANCHOR unit_id'));
console.log('reanchorUnitId :', find('export async function reanchorUnitId'));
console.log('getReanchorBlock:', find('export async function getReanchorBlock'));
console.log('clearReanchorBl:', find('export async function clearReanchorBlock'));
console.log('syncLicenseStat:', find('export async function syncLicenseStatus'));
console.log('sisa 409 lama  :', find('profil asing'));
