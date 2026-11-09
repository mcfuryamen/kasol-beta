// QA: daftar NAMA variabel env + panjang nilai, TANPA mencetak nilai.
import { readFileSync, existsSync } from 'node:fs';

const files = ['.env', '.env.local', 'admin/.env.local', 'rosok/.env.local', 'retail/.env.local'];
for (const f of files) {
  if (!existsSync(f)) { console.log(`--- ${f}: TIDAK ADA`); continue; }
  const lines = readFileSync(f, 'utf8').split('\n');
  console.log(`--- ${f}`);
  for (const l of lines) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    const v = raw.trim().replace(/^["']|["']$/g, '');
    let kind = 'lain';
    if (/eyJ/.test(v) && v.length > 60) kind = 'JWT-like';
    else if (/^https?:\/\//.test(v)) kind = 'URL';
    console.log(`    ${k}  [len=${v.length}, ${kind}]`);
  }
}
