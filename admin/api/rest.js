/**
 * Vercel Serverless Proxy — admin/api/rest.js
 * =============================================================================
 * Pintu masuk tunggal semua operasi Supabase dari Admin Dashboard.
 * SERVICE_ROLE KEY TIDAK PERNAH MASUK KE BROWSER — hanya hadir di sini (server).
 *
 * Alasan:
 *   - Sebelumnya service_role key di-inject ke client (js/env-loader.js) dan
 *     dipakai langsung tiap modul → siapa pun bisa buka DevTools, baca semua
 *     tabel (bypass RLS total). Ini critical vuln yang di-fix di Phase A.
 *   - Front-end sekarang PERSIS mengirim ke /api/rest; proxy ini menyisipkan
 *     service key server-side lalu meneruskan ke Supabase REST / Edge Function.
 *
 * Gate (sementara):
 *   - `ADMIN_API_KEY` dari env Vercel; client mengirim via header `x-admin-key`.
 *     Ini pengganti sementara sampai login admin dengan Supabase Auth diimplementasi.
 *     NOTE: nilai ini DIKETAHUI client, jadi ini bukan keamanan penuh — batas
 *     tingkat server-side + whitelist tabel. Upgrade ke JWT admin = follow-up.
 *   - Whitelist tabel & endpoint supaya scope terbatas (defense in depth).
 *
 * Environment (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY
 */

const ALLOWED_REST_TABLES = new Set(['clients', 'leads', 'pembelian', 'products']);
const ALLOWED_FUNCTIONS = new Set(['activate-license']);

export default async function handler(req, res) {
  // Hanya POST dari front-end sendiri (same-origin, tidak perlu CORS).
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Gate sementara (lihat komentar atas).
  const gate = process.env.ADMIN_API_KEY || '';
  if (gate && req.headers['x-admin-key'] !== gate) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'bad_json' });
  }

  const { method = 'GET', path = '', data, headers = {} } = body;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'missing_path' });
  }

  // === Whitelist path ===
  const targetPath = path;
  if (path.startsWith('/rest/v1/')) {
    const table = path.slice('/rest/v1/'.length).split('?')[0].split('/')[0];
    if (!ALLOWED_REST_TABLES.has(table)) {
      return res.status(403).json({ error: 'forbidden_table', table });
    }
  } else if (path.startsWith('/functions/v1/')) {
    const fn = path.slice('/functions/v1/'.length).split('?')[0].split('/')[0];
    if (!ALLOWED_FUNCTIONS.has(fn)) {
      return res.status(403).json({ error: 'forbidden_function', fn });
    }
  } else {
    return res.status(400).json({ error: 'forbidden_path' });
  }

  const baseUrl = process.env.SUPABASE_URL || '';
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  if (!baseUrl || !svc) {
    return res.status(500).json({ error: 'server_not_configured' });
  }

  const target = baseUrl.replace(/\/$/, '') + targetPath;

  try {
    const hasBody = !['GET', 'HEAD'].includes(method);
    const upstream = await fetch(target, {
      method,
      headers: {
        ...(headers || {}),
        'apikey': svc,
        'Authorization': 'Bearer ' + svc,
        ...(hasBody ? { 'Content-Type': 'application/json' } : {})
      },
      body: hasBody ? JSON.stringify(data) : undefined
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text === '' ? null : text);
  } catch (e) {
    res.status(502).json({ error: 'upstream_error', detail: String((e && e.message) || e) });
  }
}
