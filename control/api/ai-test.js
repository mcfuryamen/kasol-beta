/**
 * Vercel Serverless — api/ai-test.js
 * =============================================================================
 * Uji koneksi provider AI (OpenAI-compatible) dari halaman Agent.
 * Browser tidak bisa memanggil provider langsung (CORS/localhost), jadi uji
 * dilakukan sisi server: GET {baseUrl}/models + opsional chat ping.
 *
 * Body: { baseUrl, apiKey, model? }
 *   - model dikirim → lakukan chat ping 1 token utk bukti model benar-benar jalan.
 * Gate: sama dengan endpoint admin lain (x-session-key / x-admin-key).
 * =============================================================================
 */

import { checkAdminGate } from './_gate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const gate = checkAdminGate(req);
  if (!gate.ok) {
    if (gate.error === 'token_expired' || gate.error === 'token_unauthorized') {
      return res.status(401).json({ error: gate.error, refresh: true });
    }
    return res.status(gate.code).json({ error: gate.error });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'bad_json' });
  }

  const baseUrl = String(body.baseUrl || '').replace(/\/$/, '');
  const apiKey = String(body.apiKey || '');
  const model = String(body.model || '');
  if (!/^https?:\/\//i.test(baseUrl)) {
    return res.status(400).json({ error: 'bad_base_url' });
  }

  const hdrs = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
  const t0 = Date.now();

  // 1) Daftar model — bukti endpoint & kredensial
  try {
    const rModels = await fetch(`${baseUrl}/models`, {
      headers: hdrs,
      signal: AbortSignal.timeout(20_000),
    });
    const ms = Date.now() - t0;
    if (!rModels.ok) {
      const detail = (await rModels.text().catch(() => '')).slice(0, 200);
      return res.status(200).json({ ok: false, step: 'models', status: rModels.status, ms, detail });
    }
    let models = [];
    try {
      const j = await rModels.json();
      models = (j?.data || j?.models || []).map((m) => m?.id || m?.name || String(m)).filter(Boolean).slice(0, 50);
    } catch { /* parse gagal — biarkan kosong */ }

    // 2) Opsional chat ping — bukti model bisa menjawab
    if (model) {
      const t1 = Date.now();
      const rChat = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Balas satu kata: OKE' }],
          max_tokens: 8,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const chatMs = Date.now() - t1;
      if (!rChat.ok) {
        const detail = (await rChat.text().catch(() => '')).slice(0, 200);
        return res.status(200).json({ ok: false, step: 'chat', status: rChat.status, ms: chatMs, detail, models });
      }
      const raw = await rChat.text();
      let reply = '';
      try { reply = JSON.parse(raw)?.choices?.[0]?.message?.content || ''; } catch { /* SSE — abaikan isi */ }
      return res.status(200).json({ ok: true, step: 'chat', ms: chatMs, models, reply: reply.slice(0, 60) });
    }

    return res.status(200).json({ ok: true, step: 'models', ms, models });
  } catch (e) {
    const msg = String(e?.message || e);
    return res.status(200).json({
      ok: false,
      step: 'models',
      ms: Date.now() - t0,
      detail: /timeout|abort/i.test(msg) ? 'timeout — provider tidak menjawab' : msg.slice(0, 200),
    });
  }
}
