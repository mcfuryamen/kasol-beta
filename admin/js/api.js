/**
 * Client helper — admin/js/api.js
 * =============================================================================
 * Penggantiakses langsung ke Supabase REST / Edge Function dari browser.
 * Semua request dialihkan ke Vercel Serverless Proxy `/api/rest` yang memegang
 * SERVICE_ROLE_KEY server-side. Browser TIDAK pernah memegang service key.
 *
 * AUTH (fix #C2 — audit 2026-08-23):
 *   Sebelumnya: ADMIN_API_KEY diekspos ke browser sebagai `window.SUPABASE_ADMIN_KEY`
 *     dan dikirim via header `x-admin-key` pada setiap request — siapa pun yang
 *     membuka DevTools bisa mencuri kunci ini.
 *   Sekarang:  browser mengambil session token pendek (time-limited, 24 jam)
 *     via GET /api/token. Token di-derivasi dari ADMIN_API_KEY server-side dan
 *     kadaluarsa otomatis. Tidak ada state server (validasi murni HMAC crypto).
 *
 * Hasil: { ok, status, data, text }
 *   - data : JSON parsed (null kalau respons kosong / bukan JSON)
 *   - text : body mentah kalau bukan JSON
 * =============================================================================
 */

const TOKEN_STORAGE_KEY = 'kasirsolo:session_token';
const TOKEN_EXPIRY_KEY  = 'kasirsolo:session_expires_at';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 menit sebelum expire
const MAX_REFRESH_RETRIES = 2;

let currentToken    = null;
let currentExpiresAt = 0;
let refreshInFlight = false;

// ── Session token helpers ──────────────────────────────────────────────────────

function readStoredToken() {
  try {
    const t = (typeof window !== 'undefined')
      ? (window.localStorage?.getItem(TOKEN_STORAGE_KEY) || window.sessionStorage?.getItem(TOKEN_STORAGE_KEY))
      : null;
    if (!t) return null;
    currentToken = t;
    const exp = (typeof window !== 'undefined')
      ? (window.localStorage?.getItem(TOKEN_EXPIRY_KEY) || window.sessionStorage?.getItem(TOKEN_EXPIRY_KEY))
      : null;
    currentExpiresAt = exp ? parseInt(exp, 10) : 0;
    return t;
  } catch { return null; }
}

function writeStoredToken(token, expiresAt) {
  try {
    const ls = typeof window !== 'undefined' && window.localStorage;
    const ss = typeof window !== 'undefined' && window.sessionStorage;
    const val = String(expiresAt);
    if (ls)  ls.setItem(TOKEN_STORAGE_KEY, token);
    if (ls)  ls.setItem(TOKEN_EXPIRY_KEY,  val);
    if (ss)  ss.setItem(TOKEN_STORAGE_KEY, token);
    if (ss)  ss.setItem(TOKEN_EXPIRY_KEY,  val);
  } catch { /* quota exceeded silently */ }
}

function clearStoredToken() {
  try {
    ['localStorage', 'sessionStorage'].forEach((api) => {
      try {
        if (typeof window !== 'undefined' && window[api]) {
          window[api].removeItem(TOKEN_STORAGE_KEY);
          window[api].removeItem(TOKEN_EXPIRY_KEY);
        }
      } catch {}
    });
  } catch {}
}

/** Cek apakah token terkini masih valid (ada buffer sebelum expire). */
export function isSessionTokenValid() {
  return !!currentToken &&
         currentExpiresAt > 0 &&
         Date.now() < (currentExpiresAt - TOKEN_REFRESH_BUFFER_MS);
}

/** Kembalikan header auth — selalu refresh jika mendekati expire. */
async function authHeaders() {
  if (!isSessionTokenValid()) {
    await refreshSessionToken();
  }
  return {
    'Content-Type': 'application/json',
    'x-session-key': currentToken || ''
  };
}

// ── Token minting (dipanggil dari /api/token) ────────────────────────────────

/** Ambil session token dari server. Dipanggil otomatis oleh api.js. */
export async function refreshSessionToken(force = false) {
  // Anti stampede: coalesce multiple refresh calls menjadi satu request
  if (refreshInFlight) return refreshInFlight;
  if (!force && isSessionTokenValid()) return;

  refreshInFlight = (async () => {
    try {
      const r = await fetch('/api/token', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        // Bypass service worker agar token request selalu fresh
        cache: 'no-store'
      });

      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${r.status}`);
      }

      const data = await r.json();
      if (!data.token || !data.expiresAt) {
        throw new Error('respons token tidak valid');
      }

      currentToken     = data.token;
      currentExpiresAt = data.expiresAt;
      writeStoredToken(currentToken, currentExpiresAt);
      return;
    } catch (e) {
      console.warn('[api] refreshSessionToken gagal:', e);
      clearStoredToken();
      throw e;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// Initialize token saat module dimuat (tanpa blocking UI)
(async function initToken() {
  readStoredToken();
  if (!isSessionTokenValid()) {
    // Jangan block — refresh lazy (hanya pertama kali / setelah expiry)
    refreshSessionToken().catch(() => {});
  }
})();

// ── API functions ─────────────────────────────────────────────────────────────

export async function supabaseFetch(path, { method = 'GET', data, headers = {} } = {}) {
  const hdrs = await authHeaders();
  let retries = 0;

  while (retries < MAX_REFRESH_RETRIES) {
    const r = await fetch('/api/rest', {
      method: 'POST',
      headers: {
        ...hdrs,
        ...(Object.keys(headers).length ? headers : {})
      },
      body: JSON.stringify({ method, path, data, headers: {} })
    });

    const contentType = r.headers.get('content-type') || '';

        // Token invalid (expired/unauthorized) → refresh dan retry
    if (r.status === 401 && contentType.includes('application/json')) {
      let body;
      try { body = await r.json(); } catch { body = {}; }
          if (body?.refresh || body?.error === 'token_expired' || body?.error === 'token_unauthorized') {
        clearStoredToken();
        await refreshSessionToken(true);
            const newHeaders = await authHeaders();
            Object.assign(hdrs, newHeaders);
            retries++;
            continue;
          }
        }

    if (contentType.includes('application/json')) {
      let json = null;
      try { json = await r.json(); } catch { /* kosong */ }
      return { ok: r.ok, status: r.status, data: json, text: null };
    }
    const text = await r.text();
    return { ok: r.ok, status: r.status, data: null, text };
  }

  return { ok: false, status: 401, data: { error: 'token_refresh_exhausted' }, text: null };
}

export async function supabaseStorageSign(bucket, objectPath) {
  const hdrs = await authHeaders();
  let retries = 0;

  while (retries < MAX_REFRESH_RETRIES) {
    const r = await fetch('/api/rest', {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageSign: true, bucket, path: objectPath })
    });

    if (r.status === 401) {
      const body = await r.json().catch(() => ({}));
          if (body?.refresh || body?.error === 'token_expired' || body?.error === 'token_unauthorized') {
        clearStoredToken();
        await refreshSessionToken(true);
        const newHeaders = await authHeaders();
        Object.assign(hdrs, newHeaders);
        retries++;
        continue;
      }
    }

    let data = null;
    try { data = await r.json(); } catch { /* kosong */ }
    return { ok: r.ok, status: r.status, data };
  }

  return { ok: false, status: 401, data: { error: 'token_refresh_exhausted' } };
}

export async function supabaseStorageUpload(bucket, file) {
  const hdrs = await authHeaders();
  let retries = 0;

  while (retries < MAX_REFRESH_RETRIES) {
    const body = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const r = await fetch('/api/rest', {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storage: true,
        bucket,
        filename: `merchant-qris${file.name.slice(file.name.lastIndexOf('.'))}`,
        contentType: file.type,
        data: body
      })
    });

    if (r.status === 401) {
      const body = await r.json().catch(() => ({}));
          if (body?.refresh || body?.error === 'token_expired' || body?.error === 'token_unauthorized') {
        clearStoredToken();
        await refreshSessionToken(true);
        const newHeaders = await authHeaders();
        Object.assign(hdrs, newHeaders);
        retries++;
        continue;
      }
    }

    let data = null;
    try { data = await r.json(); } catch { /* kosong */ }
    return { ok: r.ok, status: r.status, data };
  }

  return { ok: false, status: 401, data: { error: 'token_refresh_exhausted' } };
}

/**
 * Generate / verify lisensi lewat Vercel Serverless /api/license.
 * Salt produk tinggal di server — client cuma kirim aksi + input polos.
 * Hasil: { ok, status, data }
 */
export async function licenseApi(action, payload) {
  const hdrs = await authHeaders();
  let retries = 0;

  while (retries < MAX_REFRESH_RETRIES) {
    const r = await fetch('/api/license', {
      method: 'POST',
      headers: {
        ...hdrs,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...payload })
    });

    if (r.status === 401) {
      const body = await r.json().catch(() => ({}));
          if (body?.refresh || body?.error === 'token_expired' || body?.error === 'token_unauthorized') {
        clearStoredToken();
        await refreshSessionToken(true);
        const newHeaders = await authHeaders();
        Object.assign(hdrs, newHeaders);
        retries++;
        continue;
      }
    }

    let json = null;
    try { json = await r.json(); } catch { /* body bukan JSON */ }
    return { ok: r.ok, status: r.status, data: json };
  }

  return { ok: false, status: 401, data: { error: 'token_refresh_exhausted' } };
}