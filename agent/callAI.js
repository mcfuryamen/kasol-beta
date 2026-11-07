/**
 * Agent Runner Ekosistem Kasol — agent/callAI.js
 * =============================================================================
 * Pintu tunggal ke otak AI. MULTI-PROVIDER (2026-10-01): provider tidak lagi
 * hardcoded Omniroute — daftar koneksi (OpenAI-compatible) dibaca dari
 * Supabase `settings` key `ai_providers` (diedit lewat Control → Agent AI →
 * 🔌 Koneksi Provider), dengan fallback bawaan Omniroute lokal.
 *
 * Format model di config/agent/task: `<providerId>::<modelId>`, mis.
 *   omniroute::kiro/claude-haiku-4.5   atau   openrouter::anthropic/claude-3.5-haiku
 * String TANPA `::` (config lama) → dianggap milik provider `omniroute`
 * (kompatibel penuh dengan data yang sudah ada).
 *
 * Quirk Omniroute (diprobek langsung, 2026-09-18):
 *  - Endpoint di ROOT tanpa prefix /v1 → `/models`, `/chat/completions`.
 *    (`/v1/*` menerima koneksi tapi tak pernah balas → timeout.)
 *  - `/chat/completions` SELALU streaming SSE walau `stream:false` —
 *    di-parse manual jadi satu teks utuh di sini (parser juga menerima JSON
 *    biasa, jadi provider standar OpenAI-compat ikut jalan).
 *  - TRAP: `localhost` timeout (bind ganda IPv4+IPv6) — WAJIB 127.0.0.1.
 */

import { readFileSync } from 'node:fs';

// ── env loader ringan (runner sudah memuat .env.local; agents lain belum) ──
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env.local opsional */ }

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

// Provider legacy — dipakai bila registry cloud kosong/tak terbaca, supaya
// runner tidak pernah mati total hanya karena settings belum diisi.
const OMNI_BASE = (process.env.OMNI_BASE || 'http://127.0.0.1:20128').replace(/\/$/, '');
const OMNI_KEY = process.env.OMNI_KEY || 'omniroute'; // Omniroute tak validasi, header tetap dikirim
const OMNI_FALLBACK_MODEL = process.env.OMNI_FALLBACK_MODEL || 'no-think/kr/claude-haiku-4.5';
const LEGACY_PROVIDER = {
  id: 'omniroute',
  nama: 'Omniroute (lokal)',
  baseUrl: OMNI_BASE,
  apiKey: OMNI_KEY,
  models: ['auto/best-fast', 'kiro/claude-haiku-4.5'],
  fallbackModel: OMNI_FALLBACK_MODEL,
  aktif: true,
};

/** Registry cache — serverless warm reuse / runner loop, TTL 60 dtk */
let _provCache = { at: 0, list: null };
const PROV_TTL = 60_000;

async function muatProviders() {
  if (_provCache.list && Date.now() - _provCache.at < PROV_TTL) return _provCache.list;
  let list = null;
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.ai_providers&select=value&limit=1`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const rows = await res.json();
        const val = rows?.[0]?.value;
        if (Array.isArray(val) && val.length) list = val;
      }
    } catch { /* cloud gagal → jatuh ke legacy */ }
  }
  if (!list) list = [LEGACY_PROVIDER];
  _provCache = { at: Date.now(), list };
  return list;
}

function normalisasiProv(p) {
  if (!p || typeof p !== 'object' || !p.id) return null;
  return {
    id: String(p.id),
    nama: p.nama || p.id,
    baseUrl: String(p.baseUrl || '').replace(/\/$/, ''),
    apiKey: p.apiKey || '',
    models: Array.isArray(p.models) ? p.models.filter(Boolean).map(String) : [],
    fallbackModel: p.fallbackModel ? String(p.fallbackModel) : '',
    aktif: p.aktif !== false,
  };
}

/**
 * Resolve string model `<provId>::<model>` → { prov, model }.
 * Tanpa `::` (legacy) → milik provider omniroute; kalau omniroute sudah
 * dihapus dari registry → pakai provider aktif pertama DENGAN model
 * bawaan provider itu (fallbackModel || models[0]) — id model legacy tidak
 * dipaksa ke provider lain karena namespace-nya beda.
 * Model kosong → model bawaan provider. Provider tidak dikenal → null.
 */
export async function resolveProvider(modelStr) {
  const list = (await muatProviders()).map(normalisasiProv).filter(Boolean);
  const defaultModel = (p) => p.fallbackModel || p.models[0] || '';
  const s = String(modelStr || '');
  const sep = s.indexOf('::');
  if (sep === -1) {
    const omni = list.find((p) => p.id === 'omniroute' && p.aktif);
    if (omni) return { prov: omni, model: s || defaultModel(omni) };
    const prov = list.find((p) => p.aktif) || normalisasiProv(LEGACY_PROVIDER);
    return { prov, model: defaultModel(prov) };
  }
  const pid = s.slice(0, sep);
  const mid = s.slice(sep + 2);
  const prov = list.find((p) => p.id === pid);
  if (!prov) return null;
  return { prov, model: mid || defaultModel(prov) };
}

/** Daftar pilihan model utk UI/datalist: `provId::model` */
export async function daftarModelTersedia() {
  const list = (await muatProviders()).map(normalisasiProv).filter((p) => p && p.aktif);
  return list.flatMap((p) => (p.models.length ? p.models : ['']).map((m) => (m ? `${p.id}::${m}` : `${p.id}::`)));
}

/** Kumpulkan chunk SSE `data:` jadi satu string konten utuh */
function parseSseContent(raw) {
  let text = '';
  for (const line of raw.split('\n')) {
    const m = line.match(/^data:\s*(\{.*\})\s*$/);
    if (!m) continue;
    try {
      const j = JSON.parse(m[1]);
      text += j?.choices?.[0]?.delta?.content ?? '';
    } catch { /* chunk non-JSON (mis. `data: [DONE]`) — abaikan */ }
  }
  return text;
}

/**
 * Panggil model. Provider diambil dari string model (`prov::model`); bila
 * gagal galat sisi-provider (5xx/timeout) → failover ke provider aktif lain
 * (model cadangan provider tersebut), lalu ke fallback env Omniroute.
 * @param {object} opts
 * @param {string} opts.model   `<providerId>::<modelId>` atau string legacy
 * @param {Array<{role:string,content:string}>} opts.messages
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.timeoutMs] default 120s
 * @returns {Promise<{text:string, model:string, usage:object}>}
 */
export async function callAI({ model, messages, temperature = 0.7, maxTokens = 1024, timeoutMs = 120_000 }) {
  const resolved = await resolveProvider(model);
  if (!resolved) throw new Error(`provider_tak_dikenal: ${model}`);
  const { prov, model: mid } = resolved;
  const t0 = Date.now();

  // 1) provider utama; bila model utama kosong → fallbackModel/models[0]
  const modelUtama = mid || prov.fallbackModel || prov.models[0] || '';
  if (!modelUtama) throw new Error(`provider_tanpa_model: ${prov.id}`);
  try {
    const res = await fetchModel(prov, modelUtama, messages, temperature, maxTokens, timeoutMs);
    return await selesaikan(res, modelUtama, prov.id);
  } catch (e) {
    const retriable = /_(502|503|504)\b|timeout|fetch failed|ECONNREFUSED/i.test(String(e?.message || e));
    if (!retriable) throw e;

    // 2) provider lain yang aktif — pakai model cadangan masing-masing
    const list = (await muatProviders()).map(normalisasiProv)
      .filter((p) => p && p.aktif && p.id !== prov.id);
    for (const p2 of list) {
      const m2 = p2.fallbackModel || p2.models[0] || '';
      if (!m2) continue;
      try {
        const res2 = await fetchModel(p2, m2, messages, temperature, maxTokens, timeoutMs);
        const j = await selesaikan(res2, m2, p2.id);
        j.model = `${j.model} (failover ke ${p2.id}, ${Date.now() - t0}ms)`;
        return j;
      } catch { /* lanjut provider berikutnya */ }
    }

    // 3) fallback Omniroute legacy (env) bila provider utama bukan omniroute
    if (OMNI_FALLBACK_MODEL && prov.id !== 'omniroute') {
      try {
        const p3 = normalisasiProv(LEGACY_PROVIDER);
        const res3 = await fetchModel(p3, OMNI_FALLBACK_MODEL, messages, temperature, maxTokens, timeoutMs);
        const j = await selesaikan(res3, OMNI_FALLBACK_MODEL, 'omniroute');
        j.model = `${OMNI_FALLBACK_MODEL} (fallback env dari ${model}, ${Date.now() - t0}ms)`;
        return j;
      } catch { /* habis — lempar galat asli */ }
    }
    throw e;
  }
}

async function fetchModel(prov, model, messages, temperature, maxTokens, timeoutMs) {
  return await fetch(`${prov.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(prov.apiKey ? { 'Authorization': `Bearer ${prov.apiKey}` } : {}),
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function selesaikan(res, model, provId) {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${provId}_${res.status}: ${detail.slice(0, 300)}`);
  }

  const ctype = res.headers.get('content-type') || '';
  const raw = await res.text();
  let text = '';
  if (ctype.includes('text/event-stream')) {
    text = parseSseContent(raw);
  } else {
    // Non-stream fallback: OpenAI biasa { choices:[{message:{content}}] }
    try {
      const j = JSON.parse(raw);
      text = j?.choices?.[0]?.message?.content ?? parseSseContent(raw);
    } catch {
      text = parseSseContent(raw);
    }
  }
  if (!text.trim()) throw new Error(`${provId}_empty_response`);

  // Nama model asli diambil dari chunk pertama bila ada
  const firstChunk = raw.split('\n').find((l) => l.startsWith('data: {'));
  let realModel = model;
  try { realModel = JSON.parse(firstChunk.slice(5))?.model || model; } catch { /* keep */ }

  return { text, model: realModel, usage: {} };
}

/** Cek satu provider hidup — GET {base}/models */
export async function providerHealthy(prov) {
  try {
    const p = normalisasiProv(prov);
    // Omniroute idle bisa warm-up ~25-30s sebelum balas — timeout 20s dulu
    // bikin runner menolak otak yang sebenarnya hidup (false negative).
    const res = await fetch(`${p.baseUrl}/models`, {
      headers: p.apiKey ? { 'Authorization': `Bearer ${p.apiKey}` } : {},
      signal: AbortSignal.timeout(45_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Cek otak hidup — dipakai runner sebelum claim tugas. Hidup = ADA provider
 *  aktif yang merespons. Nama lama dipertahankan agar runner tak perlu berubah. */
export async function omniHealthy() {
  const list = (await muatProviders()).map(normalisasiProv).filter((p) => p && p.aktif);
  for (const p of list) {
    if (await providerHealthy(p)) return true;
  }
  return false;
}
