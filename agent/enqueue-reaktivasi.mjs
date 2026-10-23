/**
 * Agent Enqueue Reaktivasi — agent/enqueue-reaktivasi.mjs
 * =============================================================================
 * Siap tugas marketing → agent_tasks (status 'pending'). Runner lokal
 * (agent/runner.mjs) yang claim & eksekusi via otak Omniroute — script ini
 * cuma NARUH kerja, tidak nyentuh AI.
 *
 * Tipe tugas (--tipe):
 *  - draft_wa     (default) — kontak yang belum punya draft perkenalan.
 *  - followup_wa  — kontak sudah pernah dihubungi (terkirim/bales) yang belum
 *                  punya draft follow-up; payload membawa pesan_sebelumnya
 *                  (draft approved/dipakai terakhir) + hari_lalu.
 *
 * Idempotent per tipe: kontak yang sudah punya output sejenis (draft_wa =
 * judul non-Follow-up; followup_wa = judul "Follow-up …") atau task
 * pending/running SEJENIS di-skip — run ulang tidak menduplicuti.
 *
 * PENGGUNAAN:
 *   node agent/enqueue-reaktivasi.mjs                          — draft_wa semua 'belum'
 *   node agent/enqueue-reaktivasi.mjs --limit 20 --variasi 2   — batch 20, 2 varian
 *   node agent/enqueue-reaktivasi.mjs --tipe followup_wa       — gelombang follow-up
 *   node agent/enqueue-reaktivasi.mjs --dry-run                — simulasi
 *   node agent/enqueue-reaktivasi.mjs --arahan "fokus jasa salon"
 *
 * ENV (.env.local di root repo): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── muat .env.local (pola sama dengan runner.mjs) ─────────────────────────────
try {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env.local opsional */ }

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[enqueue] FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong (.env.local)');
  process.exit(1);
}

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(1);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const TIPE = ['draft_wa', 'followup_wa'].includes(flag('tipe', 'draft_wa')) ? flag('tipe', 'draft_wa') : 'draft_wa';
const STATUS_DEFAULT = TIPE === 'followup_wa' ? 'in.(terkirim,bales)' : 'eq.belum';
const STATUS = flag('status', STATUS_DEFAULT);
const LIMIT = parseInt(flag('limit', '0'), 10); // 0 = tanpa batas di query, dedupe tetap
const VARIASI = TIPE === 'draft_wa' ? Math.min(3, Math.max(1, parseInt(flag('variasi', '1'), 10) || 1)) : 1;
const ARAHAN = flag('arahan', '');
const DRY = args.includes('--dry-run');

async function sbFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method === 'POST' ? { 'Prefer': 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`supabase_${res.status}: ${text.slice(0, 300)}`);
  return data;
}

const q = (params) => `/rest/v1/outreach_contacts?${new URLSearchParams(params)}`;

/** Payload kontak utk AI — hanya field yang aman & berguna utk personalisasi */
function payloadKontak(k) {
  return {
    nama: k.nama,
    kategori: k.kategori || 'usaha kecil',
    status: k.status,
    sent_count: k.sent_count || 0,
    ...(k.alamat ? { alamat: k.alamat } : {}),
    ...(k.catatan ? { catatan: k.catatan } : {}),
    ...(k.last_contact_at ? { last_contact_at: k.last_contact_at } : {}),
    ...(k.source ? { source: k.source } : {}),
  };
}

function hariSejak(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

async function main() {
  // 1. Kontak kandidat sesuai tipe (follow-up hanya yang sudah pernah dikirimi)
  const params = {
    select: 'id,nama,kategori,status,sent_count,alamat,catatan,last_contact_at,source',
    status: STATUS,
    order: 'sent_count.asc,updated_at.asc',
  };
  if (LIMIT > 0) params.limit = String(LIMIT);
  let kontakList = await sbFetch(q(params));
  if (TIPE === 'followup_wa') {
    kontakList = kontakList.filter((k) => (Number(k.sent_count) || 0) > 0);
  }

  // 2. Dedupe per tipe
  //    draft_wa    → skip yang sudah punya output non-Follow-up (draft perkenalan)
  //    followup_wa → skip yang sudah punya output "Follow-up …"
  const outs = await sbFetch('/rest/v1/agent_outputs?select=ref_id,judul&ref_table=eq.outreach_contacts');
  const sudahDraft = new Set();
  const sudahFoll = new Set();
  for (const o of outs) {
    if (!o.ref_id) continue;
    if (/^follow-up/i.test(o.judul || '')) sudahFoll.add(o.ref_id);
    else sudahDraft.add(o.ref_id);
  }
  const tasks = await sbFetch(`/rest/v1/agent_tasks?select=payload&agent=eq.marketing&tipe=eq.${TIPE}&status=in.(pending,running)`);
  const sudahTask = new Set(tasks.map((t) => t.payload?.kontak_id).filter(Boolean));

  const pend = kontakList.filter((k) =>
    !sudahTask.has(k.id) && (TIPE === 'followup_wa' ? !sudahFoll.has(k.id) : !sudahDraft.has(k.id)));
  console.log(`[enqueue] tipe=${TIPE} kandidat: ${kontakList.length} · sudah diproses: ${kontakList.length - pend.length} · siap enqueue: ${pend.length}${DRY ? ' (DRY-RUN)' : ''}`);

  // 3. followup_wa: map pesan sebelumnya (draft approved/dipakai terakhir per kontak)
  let pesanMap = new Map();
  if (TIPE === 'followup_wa' && pend.length) {
    const prevOuts = await sbFetch('/rest/v1/agent_outputs?select=ref_id,isi,created_at&ref_table=eq.outreach_contacts&status=in.(approved,dipakai)&jenis=eq.draft_wa&order=created_at.asc');
    for (const o of prevOuts) if (o.ref_id) pesanMap.set(o.ref_id, o.isi);
  }

  let n = 0, dup = 0;
  for (const k of pend) {
    const payload = {
      kontak_id: k.id,
      kontak: payloadKontak(k),
      ...(TIPE === 'followup_wa' ? {
        ...(pesanMap.has(k.id) ? { pesan_sebelumnya: pesanMap.get(k.id) } : {}),
        ...(hariSejak(k.last_contact_at) != null ? { hari_lalu: hariSejak(k.last_contact_at) } : {}),
      } : VARIASI > 1 ? { variasi: VARIASI } : {}),
      ...(ARAHAN ? { arahan: ARAHAN } : {}),
    };
    if (DRY) { n++; continue; }
    try {
    await sbFetch('/rest/v1/agent_tasks', {
      method: 'POST',
      body: {
        agent: 'marketing',
        tipe: TIPE,
        status: 'pending',
        priority: 5,
        max_attempts: 3,
        payload,
      },
    });
    } catch (e) {
      if (String(e.message).includes('409')) { dup++; continue; } // indeks unik: task aktif kontak ini sudah ada
      throw e;
    }
    n++;
  }
  console.log(`[enqueue] ${n} tugas '${TIPE}' ${DRY ? '(simulasi)' : 'diposang'}. JALANKAN: node agent/runner.mjs${pend.length > 8 ? ' --watch' : ''}`);
}

main().catch((e) => { console.error('[enqueue] FATAL:', e.message); process.exit(1); });
