/**
 * Vercel Serverless — api/ai-variasi.js
 * =============================================================================
 * Bikin VARIASI materi konten pakai AI, dari bank materi (content_materials).
 * Hasil dikembalikan ke browser untuk dipilih user — TIDAK langsung disimpan.
 *
 * Body:
 *   {
 *     material_id?: string   → id baris content_materials (opsional)
 *     teks?: string          → teks dasar (kalau tanpa material_id)
 *     jenis: 'caption' | 'komentar' | 'brief'
 *     gaya?: string          → edukasi | promo | interaktif | build-in-public | cerita
 *     level?: string         → untuk jenis 'komentar': A | B | C | D
 *     platform?: string
 *     jumlah?: number        → 1..8 (default 3)
 *     model?: string
 *   }
 *
 * Gate: sama dengan endpoint admin lain (x-session-key / x-admin-key).
 * Inti logika: api/_ai-variasi-core.js (sumber tunggal dev & produksi).
 * =============================================================================
 */
import { checkAdminGate } from './_gate.js';
import { makeAiVariasiCore } from './_ai-variasi-core.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

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

  const core = makeAiVariasiCore({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  });

  const out = await core.handle(body || {});
  return res.status(out.status).json(out.json);
}
