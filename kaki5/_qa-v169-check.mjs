// Syntax-check semua file yang disunting batch UI v169 (parser TypeScript, mode ESM).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('../node_modules/typescript/lib/typescript.js');
const fs = require('node:fs');

const FILES = [
  'js/kas.js', 'js/app.js', 'js/pos.js', 'js/pos.ui.js', 'js/laporan.js',
  'js/license.ui.js', 'js/license.sync.js', 'js/license.js', 'js/sync.health.js',
  'js/expensedetail.js', 'js/bantuan.js'
];
let bad = 0;
for (const f of FILES) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const diags = sf.parseDiagnostics || [];
  if (diags.length) {
    bad++;
    console.log('SYNTAX ' + f);
    for (const d of diags.slice(0, 5)) {
      const p = sf.getLineAndCharacterOfPosition(d.start);
      console.log('   :' + (p.line + 1) + ' ' + ts.flattenDiagnosticMessageText(d.messageText, ' '));
    }
  } else {
    console.log('OK     ' + f);
  }
}
// index.html: pastikan id modal baru ada dan tunggal
const html = fs.readFileSync('index.html', 'utf8');
for (const id of ['kasShiftDetailModal', 'kasShiftDetailContent', 'kasShiftDetailTitle']) {
  const n = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
  console.log((n === 1 ? 'OK     ' : 'BAD    ') + 'index.html id="' + id + '" x' + n);
  if (n !== 1) bad++;
}
// Guard: bantuan.js hanya boleh menyebut label yang benar-benar ada di UI (bantuan.js:3-5)
const tut = fs.readFileSync('js/bantuan.js', 'utf8');
for (const stale of ['"💬 Tanya Admin"', 'badge <b>📦 jumlah</b>', 'kartu <b>"🔒 Kas Belum Dibuka"</b> → tekan']) {
  const hit = tut.includes(stale);
  console.log((hit ? 'BAD    ' : 'OK     ') + 'bantuan.js: label usang tidak ditemukan -> ' + stale);
  if (hit) bad++;
}
process.exit(bad ? 1 : 0);
