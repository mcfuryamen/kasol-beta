/**
 * Agent Runner Ekosistem Kasol — agent/runner.mjs
 * =============================================================================
 * Jembatan lokal: antrean Supabase (agent_tasks) ←→ otak AI Omniroute (lokal).
 *
 * Siklus (dijalankan Task Scheduler / manual):
 *   1. Reaper: task 'running' yang nyangkut > 15 menit → reset 'pending'
 *      (bila masih ada jatah attempts) atau langsung 'error'.
 *   2. Pastikan Omniroute hidup (omniHealthy).
 *   3. Claim tugas pending (atomic: PATCH dengan guard status='pending').
 *   4. Eksekusi sesuai agent+tipe → tulis draft ke agent_outputs (status
 *      'draft') — IDEMPOten: (task_id, judul) yang sudah ada tidak ditulis
 *      ulang, jadi retry tidak menghasilkan draft dobel.
 *   5. Tandai done/error. Error ber-prefix '[NON-RETRYABLE]' langsung 'error'
 *      tanpa menunggu attempts habis; selain itu retry sampai max_attempts.
 *
 * Akses DB: langsung REST Supabase pakai SERVICE_ROLE (runner berjalan di PC
 * terpercaya — key tidak pernah menyentuh browser/Vercel).
 * Log: semua console lewat logBaris() → juga ter-append ke agent/runner.log
 * (format 'ISO\tLEVEL\tmsg'; rotasi ke runner.log.1 bila lewat 1MB).
 *
 * PENGGUNAAN:
 *   node agent/runner.mjs           — sekali jalan (proses semua tugas pending)
 *   node agent/runner.mjs --watch   — polling terus (interval 60s)
 *
 * ENV (.env.local di root repo): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, appendFileSync, statSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { callAI, omniHealthy } from './callAI.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── muat .env.local (pola sama dengan control/server.js) ──────────────────────
try {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env.local opsional */ }

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RUNNER_ID = `pc-${process.env.COMPUTERNAME || 'lokal'}`;
const POLL_MS = 60_000;
const STALE_MS = 15 * 60 * 1000; // 'running' tanpa kabar 15 menit = dianggap nyangkut
const LOG_PATH = join(ROOT, 'agent', 'runner.log');
const LOG_MAX = 1024 * 1024; // 1MB → rotasi ke runner.log.1

// ── Log: console seperti sebelumnya + jejak 'ISO\tLEVEL\tmsg' ke file ─────────
function logBaris(level, msg) {
  if (level === 'ERROR') console.error(msg);
  else console.log(msg);
  try {
    try { if (statSync(LOG_PATH).size > LOG_MAX) renameSync(LOG_PATH, `${LOG_PATH}.1`); }
    catch { /* file log belum ada — append di bawah yang membuat */ }
    appendFileSync(LOG_PATH, `${new Date().toISOString()}\t${level}\t${msg}\n`);
  } catch { /* log file gagal — jangan sampai bikin runner mati */ }
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  logBaris('ERROR', '[runner] FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong (.env.local)');
  process.exit(1);
}

// ── Supabase REST helper ──────────────────────────────────────────────────────
async function sbFetch(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'Prefer': prefer || 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`supabase_${res.status}: ${text.slice(0, 300)}`);
  return data;
}

// Claim tanpa RPC: SELECT pending → UPDATE dengan guard status='pending' →
// kalau representation kosong berarti tugas sudah diambil runner lain.
async function claimTaskGuarded() {
  const pend = await sbFetch(
    '/rest/v1/agent_tasks?select=id,agent,tipe,payload,attempts,max_attempts&status=eq.pending&order=priority.asc,created_at.asc&limit=1',
  );
  const t = pend?.[0];
  if (!t) return null;
  const got = await sbFetch(
    `/rest/v1/agent_tasks?id=eq.${t.id}&status=eq.pending`,
    { method: 'PATCH', body: { status: 'running', runner_id: RUNNER_ID, claimed_at: new Date().toISOString(), attempts: t.attempts + 1 } },
  );
  return Array.isArray(got) && got.length ? got[0] : null;
}

async function setDone(id, result) {
  await sbFetch(`/rest/v1/agent_tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: { status: 'done', result, finished_at: new Date().toISOString() },
  });
}

async function setError(id, msg) {
  const rows = await sbFetch(`/rest/v1/agent_tasks?select=attempts,max_attempts&id=eq.${id}`);
  const t = rows?.[0];
  const exhausted = t && t.attempts >= t.max_attempts;
  await sbFetch(`/rest/v1/agent_tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: {
      status: exhausted ? 'error' : 'pending',
      last_error: msg.slice(0, 500),
      ...(exhausted ? { finished_at: new Date().toISOString() } : {}),
    },
  });
}

// Tulis output IDEMPOten: cek dulu (task_id + judul) — kalau sudah ada, skip.
// Retry task tidak boleh menghasilkan draft dobel di agent_outputs.
async function putOutput(out) {
  if (out.task_id && out.judul) {
    const ada = await sbFetch(
      `/rest/v1/agent_outputs?select=id&task_id=eq.${out.task_id}&judul=eq.${encodeURIComponent(out.judul)}&limit=1`,
    );
    if (Array.isArray(ada) && ada.length) {
      logBaris('INFO', `[runner] Output duplikat dilewati: ${out.judul} (task ${String(out.task_id).slice(0, 8)})`);
      return;
    }
  }
  await sbFetch('/rest/v1/agent_outputs', { method: 'POST', body: out });
}

// ── Reaper: selamatkan task 'running' yang nyangkut ───────────────────────────
// claimed_at lebih tua dari STALE_MS → reset 'pending' bila attempts masih di
// bawah max_attempts, selain itu langsung 'error'. PATCH diberi guard
// status='running' supaya atomic — task yang baru saja di-claim ulang runner
// lain (claimed_at segar) tidak ikut tersapu.
async function reapStale() {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const stale = await sbFetch(
    `/rest/v1/agent_tasks?select=id,attempts,max_attempts&status=eq.running&claimed_at=lt.${cutoff}`,
  );
  if (!Array.isArray(stale) || !stale.length) return;
  let reset = 0, mati = 0;
  for (const t of stale) {
    const habis = (t.attempts ?? 0) >= (t.max_attempts ?? 3);
    await sbFetch(`/rest/v1/agent_tasks?id=eq.${t.id}&status=eq.running`, {
      method: 'PATCH',
      body: habis
        ? { status: 'error', last_error: 'reaper: task nyangkut', finished_at: new Date().toISOString() }
        : { status: 'pending' },
    });
    habis ? mati++ : reset++;
  }
  logBaris('INFO', `[runner] Reaper: ${stale.length} task nyangkut → ${reset} reset pending, ${mati} → error.`);
}

// ── Handler tugas per agent ───────────────────────────────────────────────────
import { jalankanMarketing } from './agents/marketing.js';

const HANDLERS = {
  marketing: jalankanMarketing,
};

// ── Loop utama ────────────────────────────────────────────────────────────────
async function prosesSekali() {
  // Heartbeat: bukti hidup utk indikator runner di Control → Agent. Gagal
  // menulis tidak boleh mengganggu siklus.
  try {
    await sbFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: [{ key: 'runner_heartbeat', value: { at: new Date().toISOString(), runner: RUNNER_ID } }],
    });
  } catch { /* abaikan */ }

  await reapStale(); // bersihkan yang nyangkut dulu, baru antre diproses
  if (!(await omniHealthy())) {
    logBaris('INFO', '[runner] Omniroute tidak hidup — dilewati dulu.');
    return;
  }
  for (;;) {
    const task = await claimTaskGuarded();
    if (!task) break;
    logBaris('INFO', `[runner] Claim ${task.agent}/${task.tipe} (${task.id.slice(0, 8)})`);
    try {
      const handler = HANDLERS[task.agent];
      if (!handler) throw new Error(`tidak ada handler utk agent '${task.agent}'`);
      const result = await handler({ task, callAI, putOutput, sbFetch });
      await setDone(task.id, result || { ok: true });
      logBaris('INFO', `[runner] Selesai ${task.id.slice(0, 8)}`);
    } catch (e) {
      logBaris('ERROR', `[runner] Gagal ${task.id.slice(0, 8)}: ${e.message}`);
      // Error NON-RETRYABLE (kontak mati/optout, draft gagal validasi, dll)
      // tidak akan membaik dengan diulang → langsung error, jangan buang waktu.
      if (String(e.message || '').startsWith('[NON-RETRYABLE]')) {
        await sbFetch(`/rest/v1/agent_tasks?id=eq.${task.id}`, {
          method: 'PATCH',
          body: { status: 'error', last_error: e.message.slice(0, 500), finished_at: new Date().toISOString() },
        });
      } else {
        await setError(task.id, e.message);
      }
    }
  }
}

async function main() {
  const watch = process.argv.includes('--watch');
  do {
    const t0 = Date.now();
    try { await prosesSekali(); }
    catch (e) { logBaris('ERROR', `[runner] Siklus gagal: ${e.message}`); }
    if (!watch) break;
    const sisa = Math.max(0, POLL_MS - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, sisa));
  } while (watch);
}

main().catch((e) => { logBaris('ERROR', `[runner] FATAL: ${e?.stack || e}`); process.exit(1); });
