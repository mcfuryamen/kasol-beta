/**
 * Inti logika OAuth Meta — Facebook Login for Business + Threads API
 * =============================================================================
 * Dipisah dari route supaya perilaku dev == produksi (pola yang sama kayak
 * api/_social-fb-core.js — "mirror yang ditulis dua kali selalu bergeser").
 *
 * Dipakai oleh dua pintu:
 *   • api/social-oauth.js  (Vercel serverless)
 *   • server.js             (mirror dev)
 *
 * ALUR (Facebook / IG):
 *   1. Browser → POST /api/social-oauth { action:'start', platform:'facebook' }
 *      → server bikin `state` acak, simpan di settings (TTL 10 menit),
 *        balas URL dialog OAuth.
 *   2. Browser → dialog OAuth Meta (user login + centang Page & IG).
 *   3. Meta → GET /api/social-oauth?code=...&state=...
 *      → server cek `state` ( sekali pakai), tukar code → user token panjang
 *        (60 hari) → /me/accounts → Page token (tanpa kedaluwarsa) + IG id.
 *      → disimpan di settings.social_fb (server-side, tak pernah ke browser).
 *
 * ALUR (Threads) — API-nya terpisah (graph.threads.net), OAuth-nya sendiri:
 *   sama persis, platform:'threads' → settings.social_threads.
 *
 * CATATAN PENTING SOAL APP ID:
 *   OAuth WAJIB punya client_id (App ID Meta). Yang butuh App SECRET cuma
 *   tukar code→token. Control Center TIDAK butuh FB_APP_ID/SECRET untuk
 *   posting manual (cukup page_id + page_token) — env var ini cuma buat
 *   jalur OAuth ini.
 *
 * Token yang disimpan di `settings` TIDAK PERNAH dikembalikan ke browser.
 * Endpoint `status` cuma balas info non-rahasia (nama Page, username IG, dsb).
 */
import { randomBytes } from 'node:crypto';

const GRAPH = 'https://graph.facebook.com/v23.0';
const THREADS_API = 'https://graph.threads.net';

// Izin yang dibutuhkan Control:
//  - posting ke Page            → pages_manage_posts
//  - baca engagement            → pages_read_engagement
//  - moderasi / balas komentar → pages_manage_engagement + pages_read_user_content
//  - IG Business (ter-link Page)→ instagram_basic + instagram_content_publish
const FB_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_engagement',
  'pages_read_user_content',
  'instagram_basic',
  'instagram_content_publish',
];

// Threads API: scopes-nya terpisah total dari Facebook Login.
const THREADS_SCOPES = ['threads_basic', 'threads_content_publish', 'threads_manage_replies'];

const STATE_KEY = 'oauth_states';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 menit — code OAuth juga cuma hidup ±1 menit
const MAX_STATES = 5;

export function makeSocialOauthCore({ supabaseUrl, serviceKey, appId, appSecret, publicUrl }) {
  const base = String(supabaseUrl || '').replace(/\/$/, '');
  const app = String(appId || '').trim();
  const secret = String(appSecret || '').trim();
  const root = String(publicUrl || '').replace(/\/$/, '');
  const callbackUrl = root ? `${root}/api/social-oauth` : '';

  async function sb(path, { method = 'GET', body, prefer } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(method !== 'GET' ? { 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`supabase_${res.status}: ${text.slice(0, 200)}`);
    return data;
  }

  // ── settings helpers (server-side only) ─────────────────────────────────────
  async function readSetting(key) {
    const rows = await sb(`/rest/v1/settings?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
    const v = rows?.[0]?.value;
    if (v === undefined || v === null) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
  }
  async function writeSetting(key, value) {
    await sb('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      body: [{ key, value }],
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }
  async function deleteSetting(key) {
    await sb(`/rest/v1/settings?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' });
  }

  // ── HTTP helper (Graph + Threads) ───────────────────────────────────────────
  async function httpGet(url, params = {}) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
    }
    const res = await fetch(u);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.error_description || data?.message || `HTTP ${res.status}`);
    }
    return data;
  }

  // ── state (anti-CSRF, sekali pakai) ─────────────────────────────────────────
  async function pushState(platform) {
    const value = randomBytes(24).toString('hex');
    const raw = await readSetting(STATE_KEY);
    const list = (Array.isArray(raw) ? raw : []).filter(
      (s) => s && Date.now() - new Date(s.created_at || 0).getTime() < STATE_TTL_MS
    );
    list.push({ value, platform, created_at: new Date().toISOString() });
    await writeSetting(STATE_KEY, list.slice(-MAX_STATES));
    return value;
  }
  async function consumeState(value) {
    const raw = await readSetting(STATE_KEY);
    const list = Array.isArray(raw) ? raw : [];
    const found = list.find((s) => s?.value === value) || null;
    // Sekali pakai: hapus lagi walau gagal, biar code yang bocor tidak bisa dipakai ulang.
    await writeSetting(STATE_KEY, list.filter((s) => s?.value !== value));
    if (!found) return { ok: false, error: 'state_invalid' };
    if (Date.now() - new Date(found.created_at || 0).getTime() > STATE_TTL_MS) {
      return { ok: false, error: 'state_expired' };
    }
    return { ok: true, platform: found.platform || 'facebook' };
  }

  // ── status (aman untuk browser) ─────────────────────────────────────────────
  async function status() {
    const fb = await readSetting('social_fb');
    const th = await readSetting('social_threads');
    return {
      ok: true,
      configured: {
        app_id: !!app,
        app_secret: !!secret,
        public_url: !!root,
        callback_url: callbackUrl,
      },
      facebook: fb
        ? {
            connected: true,
            page_id: fb.page_id || null,
            page_name: fb.page_name || null,
            fan_count: fb.fan_count ?? null,
            via: fb.connected_via || 'manual',
            connected_at: fb.connected_at || null,
            instagram: fb.ig_id
              ? { connected: true, ig_id: fb.ig_id, username: fb.ig_username || null, name: fb.ig_name || null }
              : { connected: false },
          }
        : { connected: false },
      threads: th
        ? {
            connected: true,
            threads_user_id: th.threads_user_id || null,
            username: th.username || null,
            name: th.name || null,
            expires_at: th.expires_at || null,
            via: th.connected_via || 'oauth',
            connected_at: th.connected_at || null,
          }
        : { connected: false },
    };
  }

  // ── start: bikin URL dialog OAuth ───────────────────────────────────────────
  function authorizeUrl(platform, state) {
    if (platform === 'threads') {
      const u = new URL(`${THREADS_API}/oauth/authorize`);
      u.searchParams.set('client_id', app);
      u.searchParams.set('redirect_uri', callbackUrl);
      u.searchParams.set('state', state);
      u.searchParams.set('scope', THREADS_SCOPES.join(','));
      u.searchParams.set('response_type', 'code');
      return u.toString();
    }
    const u = new URL(`${GRAPH}/dialog/oauth`);
    u.searchParams.set('client_id', app);
    u.searchParams.set('redirect_uri', callbackUrl);
    u.searchParams.set('state', state);
    u.searchParams.set('scope', FB_SCOPES.join(','));
    u.searchParams.set('response_type', 'code');
    return u.toString();
  }

  async function start(platform) {
    if (!app || !secret) {
      return {
        ok: false,
        error: 'app_not_configured',
        message: 'FB_APP_ID / FB_APP_SECRET belum di-set di server (env Vercel atau control/.env.local).',
      };
    }
    if (!callbackUrl) {
      return {
        ok: false,
        error: 'public_url_not_configured',
        message: 'CONTROL_PUBLIC_URL belum di-set — Meta butuh redirect_uri yang pasti & sama persis dengan yang didaftarkan.',
      };
    }
    const state = await pushState(platform === 'threads' ? 'threads' : 'facebook');
    return { ok: true, url: authorizeUrl(platform, state), callback_url: callbackUrl };
  }

  // ── connect Facebook (+ Instagram) ─────────────────────────────────────────
  async function connectFacebook(code) {
    // 1) code → user token pendek
    const s1 = await httpGet(`${GRAPH}/oauth/access_token`, {
      client_id: app,
      client_secret: secret,
      redirect_uri: callbackUrl,
      code,
    });
    if (!s1.access_token) throw new Error(s1.error?.message || 'gagal tukar kode OAuth');

    // 2) token pendek → token panjang (60 hari). Page token yang diturunkan
    //    dari token ini TIDAK punya kedaluwarsa (dokumentasi Meta).
    const s2 = await httpGet(`${GRAPH}/oauth/access_token`, {
      grant_type: 'fb_exchange_token',
      client_id: app,
      client_secret: secret,
      fb_exchange_token: s1.access_token,
    });
    const userToken = s2.access_token;
    if (!userToken) throw new Error('gagal mendapat token pengguna yang panjang');

    // 3) daftar Page + token-nya
    const acc = await httpGet(`${GRAPH}/me/accounts`, {
      fields: 'id,name,access_token,fan_count,tasks,instagram_business_account',
      access_token: userToken,
      limit: 50,
    });
    const pages = Array.isArray(acc.data) ? acc.data : [];
    if (!pages.length) {
      throw new Error('tidak ada Page yang bisa diakses — pastikan lo admin Page-nya dan Page-nya DICENTANG di dialog izin');
    }
    const page = pages.find((p) => (p.tasks || []).includes('CREATE_CONTENT'))
      || pages.find((p) => p.access_token)
      || pages[0];
    if (!page.access_token) {
      throw new Error('token Page tidak ikut dalam respons — ulangi OAuth dan CENTANG Page-nya di dialog');
    }

    // 4) Instagram Business (harus ter-link ke Page itu)
    let ig = page.instagram_business_account || null;
    if (!ig?.id) {
      try {
        const pg = await httpGet(`${GRAPH}/${page.id}`, {
          fields: 'ig_business_account{id,username,name}',
          access_token: page.access_token,
        });
        ig = pg?.ig_business_account || null;
      } catch { /* IG tidak ter-link — bukan error fatal */ }
    }

    await writeSetting('social_fb', {
      page_id: page.id,
      page_token: page.access_token,
      page_name: page.name || null,
      fan_count: page.fan_count ?? null,
      tasks: page.tasks || [],
      ig_id: ig?.id || null,
      ig_username: ig?.username || null,
      ig_name: ig?.name || null,
      scopes: FB_SCOPES,
      connected_at: new Date().toISOString(),
      connected_via: 'oauth',
    });
    return {
      page_id: page.id,
      page_name: page.name || null,
      ig_username: ig?.username || null,
      ig_connected: !!ig?.id,
    };
  }

  // ── connect Threads ────────────────────────────────────────────────────────
  async function connectThreads(code) {
    const r = await httpGet(`${THREADS_API}/oauth/access_token`, {
      client_secret: secret,
      client_id: app,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl,
      code,
    });
    if (!r.access_token) throw new Error(r.error_message || 'gagal tukar kode OAuth Threads');

    let username = null;
    let name = null;
    try {
      const me = await httpGet(`${THREADS_API}/v1.0/me`, {
        fields: 'username,name',
        access_token: r.access_token,
      });
      username = me.username || null;
      name = me.name || null;
    } catch { /* profil tidak wajib */ }

    await writeSetting('social_threads', {
      threads_user_id: r.user_id,
      threads_token: r.access_token,
      threads_refresh_token: r.refresh_token || null,
      expires_at: r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null,
      username,
      name,
      scopes: r.scopes || THREADS_SCOPES,
      connected_at: new Date().toISOString(),
      connected_via: 'oauth',
    });
    return { threads_user_id: r.user_id, username, name };
  }

  // ── refresh token Threads (tokennya cuma 60 hari, ada refresh_token) ───────
  async function refreshThreads() {
    const th = await readSetting('social_threads');
    if (!th?.threads_refresh_token) {
      return { ok: false, error: 'no_refresh_token', message: 'Tidak ada refresh_token — sambungkan ulang Threads.' };
    }
    const r = await httpGet(`${THREADS_API}/refresh_access_token`, {
      grant_type: 'th_refresh_token',
      access_token: th.threads_token,
    });
    if (!r.access_token) throw new Error(r.error_message || 'gagal refresh token Threads');
    await writeSetting('social_threads', {
      ...th,
      threads_token: r.access_token,
      expires_at: r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null,
      refreshed_at: new Date().toISOString(),
    });
    return { ok: true, expires_at: r.expires_in || null };
  }

  // ── disconnect ─────────────────────────────────────────────────────────────
  async function disconnect(platform) {
    if (platform === 'threads') {
      await deleteSetting('social_threads');
      return { ok: true, disconnected: 'threads' };
    }
    await deleteSetting('social_fb');
    return { ok: true, disconnected: 'facebook' };
  }

  return {
    status,
    start,
    refreshThreads,
    disconnect,

    /** Dipanggil route saat Meta mengarahkan balik ke callback. */
    async handleCallback({ code, state, error, error_description, errorCode, errorReason }) {
      try {
        // `state` dicek & dibakar DULUAN (sekali pakai, berlaku di semua jalur —
        // termasuk saat user menolak izin), baru dilihat error-nya.
        if (!state) {
          return { ok: false, platform: null, error: 'missing_state', message: 'Parameter state tidak ada — ulangi dari Control.' };
        }
        const st = await consumeState(state);
        if (!st.ok) {
          return { ok: false, platform: null, error: st.error, message: 'Token keamanan tidak cocok atau kedaluwarsa — ulangi dari Control.' };
        }
        if (error) {
          return { ok: false, platform: st.platform, error: error, message: error_description || error };
        }
        if (!code) {
          return { ok: false, platform: st.platform, error: 'missing_code', message: 'Parameter code tidak lengkap.' };
        }
        if (st.platform === 'threads') {
          const r = await connectThreads(code);
          return { ok: true, platform: 'threads', ...r };
        }
        const r = await connectFacebook(code);
        return { ok: true, platform: 'facebook', ...r };
      } catch (e) {
        return { ok: false, platform: null, error: 'connect_failed', message: String(e?.message || e).slice(0, 300) };
      }
    },
  };
}

/**
 * Halaman HTML untuk callback — dipakai baik di popup maupun tab biasa.
 * Dia memberi tahu window induk lewat postMessage lalu menutup diri.
 * (postMessage dipakai juga kalau window.opener=null — pemanggil di Control
 *  punya fallback polling status, jadi dua-duanya aman.)
 */
export function oauthCallbackHtml(result) {
  const payload = {
    type: 'meta-oauth',
    ok: !!result.ok,
    platform: result.platform || null,
    message: result.message || result.error || '',
  };
  const json = JSON.stringify(payload);
  const judul = result.ok
    ? `Berhasil connects ${result.platform === 'threads' ? 'Threads' : 'Facebook + Instagram'}`
    : 'Gagal connects';
  const sub = result.ok
    ? 'Koneksi tersimpan. Jendela ini akan menutup sendiri.'
    : (result.message || 'Terjadi kesalahan. Cek detail di Control Center.');
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${judul}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f7f9;color:#1f2430}
  .card{background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:28px 30px;max-width:420px;text-align:center;box-shadow:0 8px 28px rgba(16,24,40,.08)}
  .ico{font-size:40px;line-height:1;margin-bottom:12px}
  h1{font-size:17px;margin:0 0 8px}
  p{margin:0;font-size:13px;color:#5b6472;line-height:1.6}
  .err{color:#b42318}
  code{background:#f2f4f7;border-radius:4px;padding:1px 5px;font-size:12px;word-break:break-all}
</style></head>
<body>
  <div class="card">
    <div class="ico">${result.ok ? '✅' : '⚠️'}</div>
    <h1>${judul}</h1>
    <p class="${result.ok ? '' : 'err'}">${escapeHtml(sub)}</p>
    <p style="margin-top:14px"><a href="/" style="font-size:12px">← Buka Control Center</a></p>
  </div>
  <script>
    (function(){
      var msg = ${json};
      try { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*'); } catch (e) {}
      try { localStorage.setItem('kasirsolo:oauth_result', JSON.stringify({ ...msg, ts: Date.now() })); } catch (e) {}
      setTimeout(function(){ try { window.close(); } catch (e) {} }, 1500);
    })();
  </script>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
