/**
 * Inti logika social-fb — SATU SUMBER untuk dua pintu:
 *   • api/social-fb.js     (Vercel serverless, res Express-style)
 *   • server.js (mirror dev, res http polos)
 * Dipisah supaya perilaku dev == produksi (pelajaran ai-test: mirror yang
 * ditulis dua kali selalu bergeser).
 *
 * Pemakaian:
 *   const core = makeSocialFbCore({ supabaseUrl, serviceKey });
 *   const { status, json } = await core.handle(body);
 *
 * Kredensial Page hidup di tabel `settings` key 'social_fb' — server-side only.
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

export function makeSocialFbCore({ supabaseUrl, serviceKey }) {
  const base = String(supabaseUrl || '').replace(/\/$/, '');

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

  async function readFbConfig() {
    const rows = await sb('/rest/v1/settings?key=eq.social_fb&select=value&limit=1');
    const v = rows?.[0]?.value;
    if (!v) return null;
    const cfg = typeof v === 'string' ? JSON.parse(v) : v;
    return cfg && cfg.page_id && cfg.page_token ? cfg : null;
  }

  async function patchPost(id, patch) {
    await sb(`/rest/v1/social_posts?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
  }

  async function graph(path, { method = 'GET', params = null } = {}) {
    const url = new URL(`${GRAPH}/${String(path).replace(/^\//, '')}`);
    if (method === 'GET' && params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify(params || {}) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data?.error?.message || `graph ${res.status}`).slice(0, 250));
    return data;
  }

  async function readRow(id) {
    const rows = await sb(`/rest/v1/social_posts?id=eq.${encodeURIComponent(id)}&select=*`);
    return rows?.[0] || null;
  }

  async function postRowAndUpdate(cfg, row) {
    const params = { access_token: cfg.page_token };
    let endpoint;
    if (row.media_url && !row.link) {
      endpoint = `${cfg.page_id}/photos`;
      params.url = row.media_url;
      params.caption = row.konten;
    } else {
      endpoint = `${cfg.page_id}/feed`;
      params.message = row.konten;
      if (row.link) params.link = row.link;
    }
    try {
      const out = await graph(endpoint, { method: 'POST', params });
      const remoteId = out.post_id || out.id;
      const remoteUrl = `https://facebook.com/${remoteId}`;
      await patchPost(row.id, { status: 'posted', posted_at: new Date().toISOString(), remote_id: remoteId, remote_url: remoteUrl, last_error: null });
      return { ok: true, remote_id: remoteId, remote_url: remoteUrl };
    } catch (e) {
      const msg = String(e.message || e).slice(0, 250);
      await patchPost(row.id, { status: 'failed', last_error: msg });
      return { ok: false, error: msg };
    }
  }

  return {
    async handle(body) {
      if (!supabaseUrl || !serviceKey) return { status: 500, json: { ok: false, error: 'server_not_configured' } };
      try {
        switch (body?.action) {
          case 'test': {
            const pageId = String(body.page_id || '').trim();
            const pageToken = String(body.page_token || '').trim();
            if (!pageId || !pageToken) return { status: 400, json: { ok: false, error: 'missing_credentials' } };
            try {
              const me = await graph(pageId, { params: { fields: 'id,name', access_token: pageToken } });
              return { status: 200, json: { ok: true, page: { id: me.id, name: me.name } } };
            } catch (e) {
              return { status: 200, json: { ok: false, error: String(e.message || e).slice(0, 250) } };
            }
          }
          case 'post': {
            const id = String(body.id || '');
            if (!id) return { status: 400, json: { ok: false, error: 'missing_id' } };
            const cfg = await readFbConfig();
            if (!cfg) return { status: 200, json: { ok: false, error: 'no_config', message: 'Koneksi FB belum disimpan — buat dulu di ⚙️ Koneksi.' } };
            const row = await readRow(id);
            if (!row) return { status: 404, json: { ok: false, error: 'row_not_found' } };
            if (row.status === 'posted') return { status: 200, json: { ok: false, error: 'already_posted', remote_url: row.remote_url } };
            return { status: 200, json: await postRowAndUpdate(cfg, row) };
          }
          case 'post-due': {
            const cfg = await readFbConfig();
            if (!cfg) return { status: 200, json: { ok: false, error: 'no_config' } };
            const now = new Date().toISOString();
            const due = await sb(`/rest/v1/social_posts?status=eq.approved&scheduled_at=lte.${now}&select=id&order=scheduled_at.asc&limit=5`);
            let posted = 0, failed = 0;
            for (const t of due || []) {
              const row = await readRow(t.id);
              if (!row) continue;
              const out = await postRowAndUpdate(cfg, row);
              out.ok ? posted++ : failed++;
            }
            return { status: 200, json: { ok: true, due: (due || []).length, posted, failed } };
          }
          default:
            return { status: 400, json: { ok: false, error: 'invalid_action' } };
        }
      } catch (e) {
        return { status: 500, json: { ok: false, error: String(e?.message || e).slice(0, 300) } };
      }
    },
  };
}
