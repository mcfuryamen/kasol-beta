#!/usr/bin/env node
/**
 * check/dump/fix mojibake HTML di root aplikasi TPA.
 *
 * Gejala: file UTF-8 pernah dibaca sebagai cp1252/latin-1 lalu disimpan ulang
 * sebagai UTF-8 → emoji jadi "ðŸ””" dan muncul C1 control (U+0080–U+009F) yang
 * membuat parse5 (vite build) gagal: control-character-in-input-stream.
 *
 * Mode:
 *   node scripts/check-html-encoding.mjs check   # laporan per file (default)
 *   node scripts/check-html-encoding.mjs dump    # codepoint non-ASCII + konteks baris
 *   node scripts/check-html-encoding.mjs fix     # balikkan transformasi (aman per-run)
 *
 * Fix bersifat run-based: setiap rangkaian char kandidat mojibake (latin-1 range
 * + C1 control + char khas cp1252 seperti “ ” ‘ ’ • – — ™ €) dikembalikan ke
 * byte aslinya, lalu didekode ulang sebagai UTF-8 ketat. Run yang tidak
 * terdekode valid DIBIARKAN APA ADANYA — teks asli yang memang mengandung —, ©,
 •, dll. tidak pernah berubah. File hanya ditulis bila benar-benar berubah.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mode = (process.argv[2] || 'check').toLowerCase();

// Peta balik cp1252: char Unicode yang dihasilkan Windows-1252 dari byte 0x80–0x9F.
const CP1252_REV = new Map();
for (const [byte, cp] of [
  [0x80, 0x20ac], [0x82, 0x201a], [0x83, 0x0192], [0x84, 0x201e], [0x85, 0x2026],
  [0x86, 0x2020], [0x87, 0x2021], [0x88, 0x02c6], [0x89, 0x2030], [0x8a, 0x0160],
  [0x8b, 0x2039], [0x8c, 0x0152], [0x8e, 0x017d], [0x91, 0x2018], [0x92, 0x2019],
  [0x93, 0x201c], [0x94, 0x201d], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014],
  [0x98, 0x02dc], [0x99, 0x2122], [0x9a, 0x0161], [0x9b, 0x203a], [0x9c, 0x0153],
  [0x9e, 0x017e], [0x9f, 0x0178],
]) CP1252_REV.set(cp, byte);

function isCandidate(cp) {
  if (cp >= 0x80 && cp <= 0xff) return true; // latin-1 range + C1 control
  return CP1252_REV.has(cp);                 // char khas cp1252
}

const utf8Strict = new TextDecoder('utf-8', { fatal: true });

function unmojibakeRun(str) {
  const bytes = Buffer.alloc(str.length);
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    bytes[i] = cp > 0xff ? CP1252_REV.get(cp) : cp & 0xff;
  }
  let decoded;
  try {
    decoded = utf8Strict.decode(bytes);
  } catch {
    return null; // bukan UTF-8 valid → bukan mojibake, biarkan teks asli
  }
  for (const ch of decoded) {
    const cp = ch.codePointAt(0);
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) continue;
    if (cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f)) return null;
  }
  return decoded;
}

/** @returns {{ out: string, count: number } | null} null = tidak ada perubahan */
function unmojibake(text) {
  let out = '';
  let run = '';
  let count = 0;
  const flush = () => {
    if (!run) return;
    const fixed = unmojibakeRun(run);
    if (fixed !== null && fixed !== run) {
      out += fixed;
      count++;
    } else {
      out += run;
    }
    run = '';
  };
  for (const ch of text) { // iterasi per code point (surrogate pair aman)
    const cp = ch.codePointAt(0);
    if (cp < 0x80 || !isCandidate(cp)) {
      flush();
      out += ch;
    } else {
      run += ch;
    }
  }
  flush();
  return count > 0 ? { out, count } : null;
}

function listHtml(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === 'dist' || name.name.startsWith('_backup') || name.name.startsWith('.')) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (['supabase', 'scripts', 'tests', 'vendor', 'assets', 'js', 'pages', 'services', 'db', 'api'].includes(name.name)) continue;
      out.push(...listHtml(p));
    } else if (/\.(html|htm)$/i.test(name.name)) {
      out.push(p);
    }
  }
  return out;
}

function analyze(text) {
  let control = 0, latin1 = 0, high = 0;
  const samples = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) continue;
    if (cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f)) {
      control++;
      if (samples.length < 8) samples.push({ cp, hex: cp.toString(16) });
    } else if (cp >= 0xa0 && cp <= 0xff) {
      latin1++; // 0xA0–0xFF (0x20–0x7E = ASCII biasa, tidak dihitung)
    } else if (cp > 0xff) {
      high++;
    }
  }
  return { control, latin1, high, samples };
}

const files = listHtml(root);

if (mode === 'dump') {
  for (const file of files) {
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, 'utf8');
    const freq = new Map();
    const firstCtx = new Map();
    const lines = text.split(/\r?\n/);
    for (let li = 0; li < lines.length; li++) {
      for (const ch of lines[li]) {
        const cp = ch.codePointAt(0);
        if (cp <= 0x7e) continue;
        if (!freq.has(cp)) {
          freq.set(cp, 0);
          firstCtx.set(cp, `L${li + 1}: ${lines[li].slice(0, 90).replace(/\t/g, ' ')}`);
        }
        freq.set(cp, freq.get(cp) + 1);
      }
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    console.log(`\n=== ${rel} (${top.length} distinct) ===`);
    for (const [cp, n] of top) {
      const ch = String.fromCodePoint(cp);
      const disp = cp >= 0x80 && cp <= 0x9f ? '<CTRL>' : ch;
      console.log(`U+${cp.toString(16).padStart(4, '0')} [${disp}] x${n}  ${firstCtx.get(cp)}`);
    }
  }
  process.exit(0);
}

let fixable = 0;
let fixedCount = 0;
for (const file of files) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  const a = analyze(text);
  const bad = a.control > 0;
  if (!bad && a.latin1 === 0 && a.high === 0) continue; // murni ASCII
  let action;
  if (mode === 'fix') {
    const res = unmojibake(text);
    if (res) {
      fs.writeFileSync(file, res.out, 'utf8');
      fixedCount++;
      const a2 = analyze(res.out);
      action = `FIXED ${res.count} span (control ${a.control}→${a2.control}, latin1 ${a.latin1}→${a2.latin1}, high ${a.high}→${a2.high})`;
    } else if (bad) {
      fixable++;
      action = 'BAD tapi tidak fixable otomatis — perlu manual';
    } else {
      action = 'tidak ada span mojibake (emoji/asli) — tidak diubah';
    }
  } else {
    const res = unmojibake(text);
    if (res) {
      fixable++;
      action = `FIXABLE: ${res.count} span mojibake`;
    } else if (bad) {
      fixable++;
      action = 'BAD (control chars), tidak fixable otomatis';
    } else {
      action = 'bersih (emoji/asli)';
    }
  }
  console.log(`${rel}: control=${a.control} latin1=${a.latin1} high=${a.high} → ${action}`);
  if (a.samples.length) console.log(`   contoh cp: ${a.samples.map((s) => '0x' + s.hex).join(' ')}`);
}

if (mode === 'fix') {
  console.log(`\nSelesai: ${fixedCount} file diperbaiki, ${fixable} file perlu penanganan manual.`);
} else {
  console.log(`\n${fixable} file bermasalah. Jalankan "node scripts/check-html-encoding.mjs fix" untuk perbaikan otomatis.`);
}
