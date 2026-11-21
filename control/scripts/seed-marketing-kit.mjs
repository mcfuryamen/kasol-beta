#!/usr/bin/env node
/**
 * seed-marketing-kit.mjs — isi bank materi di Control dari folder marketing-kit
 * =============================================================================
 * Fungsi: marketing-kit (file markdown + JSON di repo) → tabel `content_materials`
 * di Supabase, supaya Control Center punya bank materi yang bisa dijadwalkan
 * per tanggal tanpa token Meta sama sekali.
 *
 * Yang di-seed:
 *   • agent/content.json        → 42 caption (14 hari × 3 slot)
 *   • 02-script-video-14.md     → 14 brief video siap rekam
 *   • 06-template-balasan.md    → template balas komen / DM / follow-up / keberatan
 *   • 07-variasi-komentar-promo.md → 79 variasi komentar (level A–D)
 *
 * Cara pakai (dari folder kasol):
 *   node control/scripts/seed-marketing-kit.mjs            → seed
 *   node control/scripts/seed-marketing-kit.mjs --dry-run  → pratinjau, tidak nulis
 *
 * IDEMPOTEN: setiap materi punya `source_key` unik; seed ulang cuma mengisi
 * yang belum ada (tidak menimpa/menambah duplikat).
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (dari control/.env.local atau
 * kasol/.secure.env).
 * =============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KASOL = path.resolve(HERE, '..', '..');
const KIT = path.join(KASOL, 'marketing-kit');
const DRY = process.argv.includes('--dry-run');

function readEnv(p) {
  const o = {};
  if (!fs.existsSync(p)) return o;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const m = l.match(/^(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return o;
}
const ENV = {
  ...readEnv(path.join(KASOL, 'control', '.env.local')),
  ...readEnv(path.join(KASOL, '.secure.env')),
};
const SB = ENV.SUPABASE_URL || ENV.SB_URL;
const KEY = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SB_SERVICE;
if (!SB || !KEY) {
  console.error('❌ SUPABASE_URL / service key tidak ditemukan (control/.env.local atau kasol/.secure.env)');
  process.exit(1);
}

const readKit = (rel) => {
  const p = path.join(KIT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
};

/** Tebak tag caption dari isinya (biar filter di UI berguna). */
function tagCaption(text) {
  const t = text.toLowerCase();
  if (t.includes('?')) return 'interaktif';
  if (/(gak upvote|gratis|sekali bayar|coba gratis|promo)/.test(t)) return 'promo';
  if (/(dev solo|gue bikin|bikin aplikasi|tahun penuh|build)/.test(t)) return 'build-in-public';
  return 'edukasi';
}

const materials = [];
const push = (m) => { if (m.source_key && m.isi) materials.push(m); };

// ── 1. Caption dari agent/content.json ───────────────────────────────────────
{
  const raw = readKit(path.join('agent', 'content.json'));
  if (!raw) console.warn('⚠ agent/content.json tidak ditemukan');
  else {
    const data = JSON.parse(raw);
    const hariKe = {};
    for (const [i, h] of (data.hari || []).entries()) hariKe[h.script] = i + 1;
    for (const h of data.hari || []) {
      for (const [slot, p] of Object.entries(h.posts || {})) {
        push({
          source_key: `caption:${h.script}:${slot}`,
          kategori: 'caption',
          judul: `Caption ${h.script} · ${slot}`,
          isi: p.t,
          platform: 'facebook',
          script: h.script,
          slot,
          hari: hariKe[h.script] || null,
          tag: tagCaption(p.t),
        });
      }
    }
  }
}

// ── 2. Brief video dari 02-script-video-14.md ────────────────────────────────
{
  const md = readKit('02-script-video-14.md');
  if (!md) console.warn('⚠ 02-script-video-14.md tidak ditemukan');
  else {
    // Blok: "### S1 — Demo input 3 barang (A)" lalu bullet Hook/Aksi/VO/CTA/Durasi
    const blocks = md.split(/^###\s+/m).slice(1);
    for (const b of blocks) {
      const head = b.split('\n')[0].trim();
      const m = head.match(/^(S\d+)\s*[—–-]\s*(.+?)(?:\s*\(([A-Z])\))?\s*$/);
      if (!m) continue;
      const [, script, judul, tipe] = m;
      const pick = (label) => {
        const re = new RegExp(`^-\\s*\\*\\*${label}[^*]*\\*\\*\\s*:?\\s*(.*)$`, 'im');
        const r = b.match(re);
        return r ? r[1].trim() : '';
      };
      const isi = [
        `Hook: ${pick('Hook')}`,
        `Aksi layar: ${pick('Aksi layar')}`,
        `VO/teks: ${pick('VO')}`,
        `CTA: ${pick('CTA')}`,
        `Durasi: ${pick('Durasi')}`,
      ].filter((x) => !/:\s*$/.test(x)).join('\n');
      push({
        source_key: `video:${script}`,
        kategori: 'brief_video',
        judul: `${script} — ${judul}`,
        isi,
        platform: 'tiktok',
        script,
        slot: null,
        hari: Number(String(script).replace(/\D/g, '')) || null,
        tag: tipe === 'C' ? 'story' : 'edukasi',
      });
    }
  }
}

// ── 3. Template balasan dari 06-template-balasan.md ─────────────────────────
{
  const md = readKit('06-template-balasan.md');
  if (!md) console.warn('⚠ 06-template-balasan.md tidak ditemukan');
  else {
    const parts = md.split(/^##\s+/m).slice(1);
    let i = 0;
    for (const p of parts) {
      const judul = p.split('\n')[0].trim();
      const isi = p.split('\n').slice(1).join('\n').trim();
      i += 1;
      if (!isi) continue;
      push({
        source_key: `template:${String(i).padStart(2, '0')}`,
        kategori: 'template',
        judul,
        isi,
        platform: 'wa',
        tag: 'balasan',
      });
    }
  }
}

// ── 4. Variasi komentar + promo post dari 07-variasi-komentar-promo.md ──────
{
  const md = readKit('07-variasi-komentar-promo.md');
  if (!md) console.warn('⚠ 07-variasi-komentar-promo.md tidak ditemukan');
  else {
    // Struktur file:
    //   ## A. Komentar UMPAN ...      (level A = umpan, B = soft, C = pitch, D = DM)
    //     ### A1. Pujian ... (10)      → item bernomor di bawahnya
    //     ### A2. Empati ... (6)
    //   ## B. Komentar SOFT ...        → item langsung (tanpa ###)
    //   ## E. PROMO POST ...           → ### E1..E5 (post promo, bukan komentar)
    //   ## F. Balasan komen ...        → template balas di posting sendiri
    // Nomor item GLOBAL 1..79 di seluruh file.
    const sections = md.split(/^##\s+/m).slice(1);
    for (const sec of sections) {
      const secTitle = sec.split('\n')[0].trim();
      const level = (secTitle.match(/^([A-F])\./) || [])[1];
      if (!level) continue;

      // Kelompok: pakai sub-heading ### kalau ada, kalau tidak satu grup saja.
      const groups = [];
      if (/^###\s+/m.test(sec)) {
        for (const sub of sec.split(/^###\s+/m).slice(1)) {
          groups.push({ title: sub.split('\n')[0].trim(), body: sub.split('\n').slice(1).join('\n') });
        }
      } else {
        groups.push({ title: secTitle, body: sec.split('\n').slice(1).join('\n') });
      }

      for (const g of groups) {
        // Kategori: A–D = variasi komentar/DM · E = caption promo post · F = template balasan
        const kategori = level === 'E' ? 'caption' : level === 'F' ? 'template' : 'variasi';
        const platform = level === 'D' ? 'dm' : level === 'E' ? 'facebook' : level === 'F' ? 'facebook' : 'komentar';
        const tag = level === 'E'
          ? (g.title.match(/^E\d+\.\s*(.+?)\s*\(/)?.[1] || 'promo').toLowerCase().replace(/\s+/g, '-')
          : `level-${level.toLowerCase()}`;
        const kode = (g.title.match(/^([A-Z]\d+)/) || [])[1] || level;

        for (const it of g.body.split('\n')) {
          const mm = it.match(/^\s*(\d+)\.\s+(.*\S)\s*$/);
          if (!mm) continue;
          push({
            source_key: `variasi:${level}:${kode}:${mm[1]}`,
            kategori,
            judul: `${level} · ${g.title} (${mm[1]})`,
            isi: mm[2],
            platform,
            tag,
          });
        }
      }
    }
  }
}

// ── tulis ke DB ──────────────────────────────────────────────────────────────
const byKategori = materials.reduce((a, m) => { a[m.kategori] = (a[m.kategori] || 0) + 1; return a; }, {});
console.log(`\n📦 Materi parsed: ${materials.length}`);
for (const [k, v] of Object.entries(byKategori)) console.log(`   ${k}: ${v}`);

if (DRY) {
  console.log('\n(--dry-run) Tidak ada yang ditulis ke DB.\n');
  for (const m of materials.slice(0, 5)) console.log(`   • [${m.kategori}] ${m.judul} — ${String(m.isi).slice(0, 70).replace(/\s+/g, ' ')}`);
  console.log('');
  process.exit(0);
}

const rows = materials.map((m) => ({
  source_key: m.source_key,
  kategori: m.kategori,
  judul: m.judul,
  isi: m.isi,
  platform: m.platform,
  script: m.script ?? null,
  slot: m.slot ?? null,
  hari: m.hari ?? null,
  tag: m.tag ?? null,
}));

const res = await fetch(`${SB.replace(/\/$/, '')}/rest/v1/content_materials?on_conflict=source_key`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=ignore-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  console.error(`❌ Gagal seed: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

const cek = await fetch(`${SB.replace(/\/$/, '')}/rest/v1/content_materials?select=id,kategori`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
}).then((r) => r.json());

const per = (cek || []).reduce((a, m) => { a[m.kategori] = (a[m.kategori] || 0) + 1; return a; }, {});
console.log(`\n✅ Seed selesai. Total di DB: ${(cek || []).length}`);
for (const [k, v] of Object.entries(per)) console.log(`   ${k}: ${v}`);
console.log('\n→ Buka Control Center → 📅 Kalender → tab 📚 Materi\n');
