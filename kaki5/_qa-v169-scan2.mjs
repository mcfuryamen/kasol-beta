import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ts = require('../node_modules/typescript/lib/typescript.js');

const jsDir = 'js';
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js') && f !== 'supabase.min.js');
let bugs = 0;

for (const f of files) {
  const path = jsDir + '/' + f;
  const text = fs.readFileSync(path, 'utf8');
  const src = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);

  const rawRanges = [];   // bagian mentah template literal (bukan isi ${})
  function walk(node) {
    if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead?.(node)) {
      // handled below via kind check
    }
    if (node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
      rawRanges.push([node.getStart(src) + 1, node.getEnd() - 1]); // buang backtick
    } else if (node.kind === ts.SyntaxKind.TemplateExpression) {
      let cur = node.getStart(src) + 1;
      const head = node.head;
      rawRanges.push([cur, head.getEnd() - 1]);
      cur = head.getEnd() + 1; // lewati "${"
      for (const span of node.templateSpans) {
        // span.expression = kode JS sungguhan → komentar di dalamnya SAH
        cur = span.expression.getEnd();
        const lit = span.literal;
        rawRanges.push([cur + 1, lit.getEnd() - (lit.getFullText().endsWith('`') ? 1 : 1)]);
        cur = lit.getEnd() + 1;
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(src);

  // posisi -> baris
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (pos) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStarts[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };
  const inRaw = (pos) => rawRanges.some(([a, b]) => pos >= a && pos < b);

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const t = L.trimStart();
    if (!(t.startsWith('//') || t.startsWith('/*'))) continue;
    const pos = lineStarts[i] + (L.length - t.length);
    if (inRaw(pos)) {
      console.log(`BOCOR ${path}:${i + 1}  ${t.slice(0, 80)}`);
      bugs++;
    }
  }
}
console.log(`\nTotal komentar bocor ke dalam template literal: ${bugs}`);
