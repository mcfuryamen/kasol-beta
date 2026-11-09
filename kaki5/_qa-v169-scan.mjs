import fs from 'fs';

// ---- A. komentar `//` yang berada DI DALAM template literal (ikut ter-render) ----
function scanTemplateComments(file, src) {
  const lines = src.split(/\r?\n/);
  const hits = [];
  let stack = [];      // baris pembuka tiap template literal aktif
  let inT = false;
  let exprDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    let j = 0, inExpr = false;
    let lineHasCommentInsideTemplate = false;
    while (j < L.length) {
      const c = L[j];
      if (c === '\\') { j += 2; continue; }
      if (!inExpr) {
        if (c === '`') {
          if (inT) { stack.pop(); inT = stack.length > 0; }
          else { stack.push(i + 1); inT = true; }
        } else if (c === '/' && L[j + 1] === '/') {
          if (inT) lineHasCommentInsideTemplate = true;
          break;
        } else if (c === '/' && L[j + 1] === '*') {
          if (inT) lineHasCommentInsideTemplate = true;
          break;
        } else if (c === '$' && L[j + 1] === '{') { inExpr = true; exprDepth++; j += 2; continue; }
      } else {
        if (c === '{') exprDepth++;
        else if (c === '}') { exprDepth--; if (exprDepth === 0) inExpr = false; }
      }
      j++;
    }
    if (lineHasCommentInsideTemplate) hits.push({ line: i + 1, open: stack[stack.length - 1], text: L.trim().slice(0, 90) });
  }
  return hits;
}

// ---- B. atribut ganda pada satu tag HTML (class="…" class="…") ----
function scanDupAttrs(file, src) {
  const hits = [];
  const tagRe = /<([a-zA-Z][\w-]*)\b([^>]*)>/g;
  const lines = src.split(/\r?\n/);
  lines.forEach((L, idx) => {
    let m;
    const re = /<([a-zA-Z][\w-]*)\b([^>]*)>/g;
    while ((m = re.exec(L))) {
      const attrs = m[2];
      const names = [...attrs.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=/g)].map(x => x[1].toLowerCase());
      const seen = new Set(), dup = new Set();
      for (const n of names) { if (seen.has(n)) dup.add(n); seen.add(n); }
      if (dup.size) hits.push({ line: idx + 1, dup: [...dup].join(','), text: L.trim().slice(0, 100) });
    }
  });
  return hits;
}

const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js') && f !== 'supabase.min.js');
let totalA = 0, totalB = 0;
for (const f of jsFiles) {
  const src = fs.readFileSync('js/' + f, 'utf8');
  for (const h of scanTemplateComments('js/' + f, src)) { console.log(`KOMENTAR-DALAM-TEMPLATE js/${f}:${h.line} (template dibuka :${h.open}) ${h.text}`); totalA++; }
}
for (const f of ['index.html', ...fs.readdirSync('js').filter(x => x.endsWith('.html'))]) {
  if (!fs.existsSync(f)) continue;
  for (const h of scanDupAttrs(f, fs.readFileSync(f, 'utf8'))) { console.log(`ATRIBUT-DOBEL ${f}:${h.line} [${h.dup}] ${h.text}`); totalB++; }
}
console.log(`\nringkasan: komentar-dalam-template=${totalA}  atribut-dobel=${totalB}`);
