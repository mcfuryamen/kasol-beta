/**
 * Client helper — admin/js/api.js
 * =============================================================================
 * Pengganti akses langsung ke Supabase REST / Edge Function dari browser.
 * Semua request dialihkan ke Vercel Serverless Proxy `/api/rest` yang memegang
 * SERVICE_ROLE_KEY server-side. Browser TIDAK pernah memegang service key.
 *
 * Hasil: { ok, status, data, text }
 *   - data : JSON parsed (null kalau respons kosong / bukan JSON)
 *   - text : body mentah kalau bukan JSON
 */
export async function supabaseFetch(path, { method = 'GET', data, headers = {} } = {}) {
  const gate = window.SUPABASE_ADMIN_KEY || '';
  const r = await fetch('/api/rest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': gate
    },
    body: JSON.stringify({ method, path, data, headers })
  });

  const contentType = r.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    let json = null;
    try { json = await r.json(); } catch { /* kosong */ }
    return { ok: r.ok, status: r.status, data: json, text: null };
  }
  const text = await r.text();
  return { ok: r.ok, status: r.status, data: null, text };
}

/**
 * Generate / verify lisensi lewat Vercel Serverless /api/license.
 * Salt produk tinggal di server — client cuma kirim aksi + input polos.
 * Hasil: { ok, status, data }
 */
export async function licenseApi(action, payload) {
  const gate = window.SUPABASE_ADMIN_KEY || '';
  const r = await fetch('/api/license', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': gate
    },
    body: JSON.stringify({ action, ...payload })
  });
  let json = null;
  try { json = await r.json(); } catch { /* body bukan JSON */ }
  return { ok: r.ok, status: r.status, data: json };
}
