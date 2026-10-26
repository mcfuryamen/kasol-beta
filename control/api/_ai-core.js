/**
 * control/api/_ai-core.js — pemanggil provider AI (OpenAI-compatible)
 * =============================================================================
 * Kenapa file ini ADA (dan bukan import dari root `agent/callAI.js`):
 *   Deployment Vercel untuk Control punya root = folder `control/` (lihat
 *   control/vercel.json → outputDirectory "."). File di luar `control/`
 *   TIDAK ikut ter-deploy → import '../../agent/callAI.js' akan 404 di produksi.
 *   Jadi helper ini harus self-contained.
 *
 * Sumber config: tabel `settings` key `ai_providers` (server-side, service key).
 * Bentuk tiap provider: { id, nama, aktif, apiKey, models[], baseUrl, fallbackModel }
 *
 * Catatan provider:
 *   - baseUrl bisa hosted (mis. https://openrouter.ai/api/v1) → bisa dipanggil
 *     dari serverless Vercel.
 *   - baseUrl lokal (127.0.0.1) → HANYA bisa dipanggil dari PC, bukan dari
 *     Vercel. Kode ini tetap mencoba, tapi hasilnya bakal timeout di produksi.
 *
 * Parser: sebagian provider (mis. omniroute) SELALU balas SSE walau
 * `stream:false`. Parser di bawah menerima DUA-duanya (JSON biasa & SSE).
 * =============================================================================
 */

const DEFAULT_TIMEOUT_MS = 45_000;

/** Ambil daftar provider dari settings.ai_providers. */
async function loadProviders(supabaseUrl, serviceKey) {
  const res = await fetch(`${String(supabaseUrl || '').replace(/\/$/, '')}/rest/v1/settings?key=eq.ai_providers&select=value&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`gagal baca ai_providers (HTTP ${res.status})`);
  const rows = await res.json();
  const v = rows?.[0]?.value;
  if (!v) return [];
  let list = v;
  if (typeof v === 'string') {
    try { list = JSON.parse(v); } catch { return []; }
  }
  return (Array.isArray(list) ? list : [list]).filter(Boolean);
}

/** Pilih provider: sesuai id, kalau tidak → provider aktif pertama. */
export function pickProvider(providers, providerId) {
  if (providerId) {
    const p = providers.find((x) => x.id === providerId);
    if (p) return p;
  }
  return providers.find((p) => p.aktif !== false) || providers[0] || null;
}

/** Pilih model: yang diminta, kalau tidak ada di daftar → model pertama / fallback. */
export function pickModel(provider, modelId) {
  const models = Array.isArray(provider.models) ? provider.models.filter(Boolean).map(String) : [];
  if (modelId && models.includes(modelId)) return modelId;
  if (provider.fallbackModel && models.includes(provider.fallbackModel)) return provider.fallbackModel;
  return models[0] || provider.fallbackModel || '';
}

/** Parse body chat completion: JSON biasa ATAU SSE. */
export function parseChatBody(raw) {
  const text = String(raw || '');
  if (!text.trim()) return '';
  try {
    const j = JSON.parse(text);
    const c = j?.choices?.[0]?.message?.content;
    if (typeof c === 'string') return c;
  } catch { /* bukan JSON → coba SSE */ }
  // SSE: baris "data: {json}" (+ penutup "data: [DONE]")
  return text
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter((l) => l && l !== '[DONE]')
    .map((l) => {
      try { return JSON.parse(l)?.choices?.[0]?.delta?.content || ''; } catch { return ''; }
    })
    .join('');
}

/**
 * Panggil provider AI sekali.
 * @returns { ok, text, model, provider, ms, error }
 */
export async function chatOnce({ supabaseUrl, serviceKey, providerId, modelId, system, prompt, temperature = 0.85, maxTokens = 700, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const t0 = Date.now();
  try {
    const providers = await loadProviders(supabaseUrl, serviceKey);
    if (!providers.length) {
      return { ok: false, error: 'no_provider', message: 'Belum ada provider AI terdaftar — isi di Control → Agent → ⚙️ Provider AI.' };
    }
    const provider = pickProvider(providers, providerId);
    if (!provider) return { ok: false, error: 'no_provider', message: 'Provider AI tidak ditemukan.' };
    if (!provider.baseUrl) return { ok: false, error: 'no_base_url', message: `Provider ${provider.id} belum punya baseUrl.` };
    if (!provider.apiKey) return { ok: false, error: 'no_api_key', message: `Provider ${provider.id} belum punya API key.` };

    const model = pickModel(provider, modelId);
    if (!model) return { ok: false, error: 'no_model', message: `Provider ${provider.id} belum punya model terdaftar.` };

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(`${String(provider.baseUrl).replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
        // OpenRouterütama: opsional tapi disarankan
        'HTTP-Referer': 'https://kasirsolo.com',
        'X-Title': 'Kasir Solo Control Center',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const raw = await res.text();
    if (!res.ok) {
      const detail = raw.slice(0, 250);
      return { ok: false, error: 'provider_error', status: res.status, message: detail, ms: Date.now() - t0 };
    }
    const text = parseChatBody(raw);
    if (!text.trim()) {
      return { ok: false, error: 'empty_response', message: 'Provider menjawab kosong.', ms: Date.now() - t0 };
    }
    return { ok: true, text, model, provider: provider.id, ms: Date.now() - t0 };
  } catch (e) {
    const msg = String(e?.message || e);
    return {
      ok: false,
      error: /timeout|abort/i.test(msg) ? 'timeout' : 'call_failed',
      message: /timeout|abort/i.test(msg) ? 'Provider tidak menjawab (timeout).' : msg.slice(0, 250),
      ms: Date.now() - t0,
    };
  }
}

/**
 * Ambil JSON dari balasan teks model (sering dibungkus ```json ... ``` atau
 * diberi kalimat pembuka). Ambil array pertama yang ketemu.
 */
export function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const candidates = [];
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1].trim());
  candidates.push(raw);
  const arr = raw.match(/\[[\s\S]*\]/);
  if (arr) candidates.push(arr[0]);
  for (const c of candidates) {
    try {
      const j = JSON.parse(c);
      if (Array.isArray(j)) return j;
      if (j && typeof j === 'object') return [j];
    } catch { /* bukan JSON valid, coba kandidat lain */ }
  }
  return null;
}
