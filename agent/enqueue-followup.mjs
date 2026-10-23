/**
 * Agent Enqueue Follow-up Harian — agent/enqueue-followup.mjs
 * =============================================================================
 * Seeder follow-up OTOMATIS (dipanggil Task Scheduler tiap hari, mis. 08:00):
 * antrekan tugas 'followup_wa' untuk kontak yang sudah pernah dihubungi tapi
 * sudah LAMA tidak disentuh. Cuma NARUH kerja ke agent_tasks (status 'pending')
 * — eksekusi AI tetap di runner lokal (agent/runner.mjs) via Omniroute.
 *
 * Kandidat (outreach_contacts):
 *   status IN ('terkirim','bales')        — otomatis TANPA 'mati'/'optout'
 *   AND sent_count > 0                    — benar-benar pernah dikirimi pesan
 *   AND last_contact_at <= now - N hari   (--hari, default 3)
 * Urutan: last_contact_at.asc (yang paling lama tak dihubungi didahulukan).
 *
 * Idempotent — dedupe (pola sama dengan enqueue-reaktivasi.mjs):
 *   - skip kontak yang sudah punya agent_outputs judul berawalan 'Follow-up'
 *     (ref_id = kontak id). Dicek di SEMUA jenis output, bukan cuma draft_wa,
 *     supaya tidak ada celah duplikat lewat jenis lain.
 *   - skip kontak yang masih punya task followup_wa pending/running
 *     (payload->kontak_id). Run ulang tidak menduplicuti.
 *
 * Payload tugas (identik dengan jalur followup_wa di enqueue-reaktivasi.mjs):
 *   { kontak_id, kontak:{nama,kategori,status,sent_count,alamat?,catatan?,
 *     last_contact_at?,source?}, pesan_sebelumnya?, hari_lalu?, arahan? }
 *
 * PENGGUNAAN:
 *   node agent/enqueue-followup.mjs                 — follow-up utk kontak >= 3 hari
 *   node agent/enqueue-followup.mjs --hari 5        — ambang 5 hari sejak kontak terakhir
 *   node agent/enqueue-followup.mjs --limit 20      — batasi jumlah kandidat di query
 *   node agent/enqueue-followup.mjs --dry-run       — simulasi, tidak POST apa pun
 *   node agent/enqueue-followup.mjs --arahan "..."  — instruksi tambahan utk AI
 *
 * ENV (.env.local di root repo): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── muat .env.local (pola sama dengan runner.mjs / enqueue-reaktivasi.mjs) ────
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
  console.error('[enqueue-followup] FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong (.env.local)');
  process.exit(1);
}

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(1);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const HARI = Math.max(0, parseInt(flag('hari', '3'), 10) || 0); // ambang hari sejak last_contact_at
const LIMIT = parseInt(flag('limit', '0'), 10); // 0 = tanpa batas di query, dedupe tetap jalan
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
  // 0. Konfigurasi cloud (Control → Agent): saklar aktif + ambang hari.
  //    --hari CLI tetap menang; saklar Nonaktif menghentikan seeder terjadwal.
  let konfig = {};
  try {
    const rows = await sbFetch('/rest/v1/settings?key=eq.agent_config&select=value&limit=1');
    konfig = (Array.isArray(rows) && rows[0]?.value) || {};
  } catch { /* konfigurasi tak tersedia → perilaku baku */ }
  if (konfig.followupAuto === false) {
    console.log('[enqueue-followup] followupAuto=Nonaktif di Control → Agent — seeder dihentikan.');
    return;
  }
  const HARI_EFEKTIF = process.argv.includes('--hari') ? HARI : Math.max(0, parseInt(konfig.followupHari, 10) || HARI);

  // 1. Kontak kandidat: sudah pernah dihubungi + sudah diam >= hari ambang.
  //    Filter status IN ('terkirim','bales') membuat 'mati'/'optout' otomatis
  //    tidak pernah masuk; last_contact_at <= batas otomatis menyingkirkan
  //    kontak yang barusan dihubungi (dan yang NULL — tak bisa dihitung harinya).
  const batas = new Date(Date.now() - HARI_EFEKTIF * 86_400_000).toISOString();
  const params = {
    select: 'id,nama,kategori,status,sent_count,alamat,catatan,last_contact_at,source',
    status: 'in.(terkirim,bales)',
    sent_count: 'gt.0',
    last_contact_at: `lte.${batas}`,
    order: 'last_contact_at.asc', // paling lama didahulukan
  };
  if (LIMIT > 0) params.limit = String(LIMIT);
  const kontakList = await sbFetch(q(params));

  // 2. Dedupe
  //    - output judul "Follow-up …" (ref_id = kontak id) → kontak sudah punya draft follow-up
  //    - task followup_wa pending/running utk kontak yang sama → jangan dobel antre
  const outs = await sbFetch('/rest/v1/agent_outputs?select=ref_id,judul&ref_table=eq.outreach_contacts');
  const sudahFoll = new Set();
  for (const o of outs) {
    if (o.ref_id && /^follow-up/i.test(o.judul || '')) sudahFoll.add(o.ref_id);
  }
  const tasks = await sbFetch(
    '/rest/v1/agent_tasks?select=payload&agent=eq.marketing&tipe=eq.followup_wa&status=in.(pending,running)',
  );
  const sudahTask = new Set(tasks.map((t) => t.payload?.kontak_id).filter(Boolean));

  const pend = kontakList.filter((k) => !sudahTask.has(k.id) && !sudahFoll.has(k.id));
  console.log(
    `[enqueue-followup] hari>=${HARI_EFEKTIF} kandidat: ${kontakList.length} · sudah diproses: ${kontakList.length - pend.length} · siap enqueue: ${pend.length}${DRY ? ' (DRY-RUN)' : ''}`,
  );

  // 3. Map pesan sebelumnya: draft approved/dipakai TERAKHIR per kontak
  //    (order asc lalu set ulang → yang terakhir menang, sama dgn reaktivasi)
  let pesanMap = new Map();
  if (pend.length) {
    const prevOuts = await sbFetch(
      '/rest/v1/agent_outputs?select=ref_id,isi,created_at&ref_table=eq.outreach_contacts&status=in.(approved,dipakai)&jenis=eq.draft_wa&order=created_at.asc',
    );
    for (const o of prevOuts) if (o.ref_id) pesanMap.set(o.ref_id, o.isi);
  }

  // 4. Posang tugas
  let n = 0, dup = 0;
  for (const k of pend) {
    const payload = {
      kontak_id: k.id,
      kontak: payloadKontak(k),
      ...(pesanMap.has(k.id) ? { pesan_sebelumnya: pesanMap.get(k.id) } : {}),
      ...(hariSejak(k.last_contact_at) != null ? { hari_lalu: hariSejak(k.last_contact_at) } : {}),
      ...(ARAHAN ? { arahan: ARAHAN } : {}),
    };
    if (DRY) { n++; continue; }
    try {
    await sbFetch('/rest/v1/agent_tasks', {
      method: 'POST',
      body: {
        agent: 'marketing',
        tipe: 'followup_wa',
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
  console.log(`[enqueue-followup] ${n} tugas 'followup_wa' ${DRY ? '(simulasi)' : 'diposang'}. JALANKAN: node agent/runner.mjs${pend.length > 8 ? ' --watch' : ''}`);
}

main().catch((e) => { console.error('[enqueue-followup] FATAL:', e.message); process.exit(1); });
