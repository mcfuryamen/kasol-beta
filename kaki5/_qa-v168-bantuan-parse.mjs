// Harness QA: cek sintaks js/bantuan.js tanpa menjalankan import Dexie.
// Strategi: buang baris `import`, ubah `export function` -> `function`,
// lalu minta V8 mem-parse body lewat new Function (syntax-only).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'js', 'bantuan.js'), 'utf8');

const stripped = src
  .replace(/^\s*import\s[^\n]*\n/gm, '')
  .replace(/^export\s+function/gm, 'function');

let ok = true;
try {
  // eslint-disable-next-line no-new-func
  new Function('"use strict";' + stripped + '\nreturn typeof TUTORIALS;');
  console.log('PARSE: OK');
} catch (e) {
  ok = false;
  console.log('PARSE: FAIL -> ' + e.message);
}

// Ekstrak TUTORIALS lewat evaluasi (stub escapeHtml) supaya bisa diaudit isinya.
const stubbed = stripped.replace(
  /^function escapeHtml/m,
  'function __unused'
);
const factory = new Function(
  'escapeHtml',
  stubbed + '\nreturn { TUTORIALS, initBantuan, toggleTutorial };'
);
const mod = factory((s) => String(s));

const t = mod.TUTORIALS;
console.log('JUMLAH_TUTORIAL=' + t.length);
console.log('FUNGI=' + Object.keys(mod).join(','));
t.forEach((x, i) => {
  const bad = [];
  if (!x.icon || !x.title || !x.content) bad.push('field kosong');
  if (/`/.test(x.content)) bad.push('backtick nyasar');
  if (/\$\{/.test(x.content)) bad.push('placeholder nyasar');
  if (/<script|onclick|onerror|javascript:/i.test(x.content)) bad.push('CESP');
  if (/&(?!(amp|lt|gt|quot|#\d+|nbsp);)/.test(x.content)) bad.push('ampersat tak di-escape');
  console.log(
    String(i).padStart(2, '0') + ' ' + x.icon + ' ' + x.title +
    ' [' + x.content.length + 'b]' + (bad.length ? '  !! ' + bad.join(' | ') : '')
  );
});
process.exit(ok ? 0 : 1);
