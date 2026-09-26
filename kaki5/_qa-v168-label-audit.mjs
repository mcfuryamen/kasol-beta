// Harness QA: pastikan semua label berbahasa yang dikutip tutorial
// benar-benar ada di index.html / js/*.js (anti-klaim-bohong).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const files = ['index.html', ...readdirSync(join(here, 'js')).filter((f) => /\.(js|json)$/.test(f))];
let corpus = '';
for (const f of files) {
  try { corpus += readFileSync(f === 'index.html' ? join(here, f) : join(here, 'js', f), 'utf8') + '\n'; }
  catch { /* skip */ }
}
// Normalisasi: corpus & label disamakan untuk entity + spasi.
const norm = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');
const C = norm(corpus);

const src = readFileSync(join(here, 'js', 'bantuan.js'), 'utf8');
const stripped = src
  .replace(/^\s*import\s[^\n]*\n/gm, '')
  .replace(/^export\s+function/gm, 'function');
const mod = new Function('escapeHtml', stripped + '\nreturn TUTORIALS;')((s) => String(s));

const seen = new Set();
const missing = [];
mod.forEach((t, i) => {
  const text = norm(t.content);
  // label berkutip: "..."
  for (const m of text.matchAll(/"([^"\n]{3,70})"/g)) seen.add(i + '\u0000' + m[1]);
  // label tebal tanpa kutip: <b>...</b>
  for (const m of text.matchAll(/<b>([^<]{3,60})<\/b>/g)) {
    const v = m[1].replace(/["“”]/g, '').trim();
    if (v) seen.add(i + '\u0000' + v);
  }
});

const isDynamic = (s) => /[…]|<n>|<nama>|\bN\b|XXXX|\bRp \.$|—|\.\.\./i.test(s);

let checked = 0, passed = 0;
for (const key of [...seen].sort()) {
  const [iStr, label] = key.split('\u0000');
  let v = label.trim().replace(/^·\s*|\s*·$/g, '').trim();
  if (!v || v.length < 3) continue;
  // buang prefiks emoji/simbol di ujung untuk pencocokan longgar
  const bare = v.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '').trim();
  const probes = isDynamic(v)
    ? v.split(/…|\.\.\./).map((p) => p.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '').trim()).filter((p) => p.length >= 4)
    : [v, bare].filter((p) => p.length >= 3);
  if (probes.length === 0) continue;
  checked++;
  const hit = probes.every((p) => C.includes(norm(p)));
  if (hit) passed++;
  else missing.push(`tut${iStr}: "${v}"  (probe gagal: ${probes.filter((p) => !C.includes(norm(p))).join(' | ')})`);
}
console.log(`LABEL checked=${checked} passed=${passed} missing=${missing.length}`);
missing.forEach((m) => console.log('  MISSING ' + m));
