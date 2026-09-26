/**
 * Agent Runner Ekosistem Kasol — agent/callAI.js
 * =============================================================================
 * Pintu tunggal ke otak AI lokal (Omniroute). Runner & agent lain memanggil
 * callAI() ini; provider/model dikelola di Omniroute, bukan di sini.
 *
 * Quirk Omniroute (diprobek langsung, 2026-09-18):
 *  - Endpoint di ROOT tanpa prefix /v1 → `/models`, `/chat/completions`.
 *    (`/v1/*` menerima koneksi tapi tak pernah balas → timeout.)
 *  - `/chat/completions` SELALU streaming SSE walau `stream:false` —
 *    di-parse manual jadi satu teks utuh di sini.
 *  - TRAP: `localhost` timeout (bind ganda IPv4+IPv6) — WAJIB 127.0.0.1.
 */

const OMNI_BASE = (process.env.OMNI_BASE || 'http://127.0.0.1:20128').replace(/\/$/, '');
const OMNI_KEY = process.env.OMNI_KEY || 'omniroute'; // Omniroute tak validasi, header tetap dikirim

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
 * Panggil model via Omniroute (OpenAI-compatible, respons SSE diparse manual).
 * @param {object} opts
 * @param {string} opts.model   id model Omniroute, mis. 'auto/best-fast'
 * @param {Array<{role:string,content:string}>} opts.messages
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.timeoutMs] default 120s
 * @returns {Promise<{text:string, model:string, usage:object}>}
 */
export async function callAI({ model, messages, temperature = 0.7, maxTokens = 1024, timeoutMs = 120_000 }) {
  const res = await fetch(`${OMNI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OMNI_KEY}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`omniroute_${res.status}: ${detail.slice(0, 300)}`);
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
  if (!text.trim()) throw new Error('omniroute_empty_response');

  // Nama model asli diambil dari chunk pertama bila ada
  const firstChunk = raw.split('\n').find((l) => l.startsWith('data: {'));
  let realModel = model;
  try { realModel = JSON.parse(firstChunk.slice(5))?.model || model; } catch { /* keep */ }

  return { text, model: realModel, usage: {} };
}

/** Cek otak hidup — dipakai runner sebelum claim tugas */
export async function omniHealthy() {
  try {
    // Omniroute idle bisa warm-up ~25-30s sebelum balas — timeout 20s dulu
    // bikin runner menolak otak yang sebenarnya hidup (false negative).
    const res = await fetch(`${OMNI_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${OMNI_KEY}` },
      signal: AbortSignal.timeout(45_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
