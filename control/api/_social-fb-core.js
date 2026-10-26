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
 *
 * MODE JADWAL (2026-10-23) — dua cara tayang, keduanya sah:
 *   1. 'post' / 'post-due'  → Control yang menepuk Graph API saat jadwal jatuh
 *      tempo. Butuh PC / runner / tab Control hidup.
 *   2. 'schedule-remote'    → Meta yang menjadwalkan sendiri (published=false
 *      + scheduled_publish_time). Post masuk ke scheduler Meta → muncul di
 *      kalender Business Suite, tetap bisa diedit dari sana, dan tayang
 *      BAWAHAN kita: PC boleh mati. Ini jalur yang dipakai kalau owner pakai
 *      Meta Business Suite sebagai panel kendali.
 *
 * Status di tabel `social_posts`:
 *   draft      — masih naskah, belum di-setujui
 *   approved   — disetujui, nunggu Control yang menepuk (mode 1)
 *   terjadwal  — sudah diserahkan ke scheduler Meta (mode 2), tayang sendiri
 *   posted     — sudah tayang
 *   failed     — gagal, lihat last_error
 */

const GRAPH = 'https://graph.facebook.com/v23.0';
// Threads punya host & versi sendiri (graph.threads.net/v1.0) — bukan graph.facebook.com.
// Catatan versi: naik dari v21.0 ke v23.0 — Meta retiring versi lama (rolling 2 tahun),
// dan activate.mjs di marketing-kit sudah pakai v23.0, jadi disamakan.
const THREADS_API = 'https://graph.threads.net/v1.0';

// Meta: published=false + scheduled_publish_time hanya diterima dalam rentang
// ~10 menit sampai 75 hari ke depan. Kita pakai 15 menit supaya ada margin.
const SCHEDULE_MIN_MS = 15 * 60 * 1000;
const SCHEDULE_MAX_MS = 75 * 24 * 60 * 60 * 1000;
const SCHEDULE_MIN_MENIT = Math.round(SCHEDULE_MIN_MS / 60000);

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

  async function readThreadsConfig() {
    const rows = await sb('/rest/v1/settings?key=eq.social_threads&select=value&limit=1');
    const v = rows?.[0]?.value;
    if (!v) return null;
    const cfg = typeof v === 'string' ? JSON.parse(v) : v;
    return cfg && cfg.threads_user_id && cfg.threads_token ? cfg : null;
  }

  /**
   * Config gabungan buat publisher: Page/IG (Facebook) + Threads.
   * Satu baris bisa di-post ke salah satu dari tiga platform, jadi config-nya
   * digabung di sini (nama field-nya tidak bentrok).
   */
  async function readPublishConfig() {
    const fb = await readFbConfig();
    const th = await readThreadsConfig();
    if (!fb && !th) return null;
    return { ...(fb || {}), ...(th || {}) };
  }

  async function patchPost(id, patch) {
    await sb(`/rest/v1/social_posts?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
  }

  async function graph(path, { method = 'GET', params = null, base = GRAPH } = {}) {
    const url = new URL(`${base}/${String(path).replace(/^\//, '')}`);
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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function readRow(id) {
    const rows = await sb(`/rest/v1/social_posts?id=eq.${encodeURIComponent(id)}&select=*`);
    return rows?.[0] || null;
  }

  async function readRows(ids) {
    const list = (ids || []).filter(Boolean).slice(0, 60);
    if (!list.length) return [];
    const q = list.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
    const rows = await sb(`/rest/v1/social_posts?id=in.(${q})&select=*`);
    return Array.isArray(rows) ? rows : [];
  }

  // ── Publisher per platform ─────────────────────────────────────────────────
  /** Facebook Page: teks ke /feed, foto ke /photos. */
  async function publishFacebook(cfg, row) {
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
    const out = await graph(endpoint, { method: 'POST', params });
    const remoteId = out.post_id || out.id;
    return { ok: true, remote_id: remoteId, remote_url: `https://facebook.com/${remoteId}` };
  }

  /**
   * Instagram Business (harus ter-link ke Page):
   *   1) bikin media container (WAJIB image_url — API IG tidak bisa post teks doang)
   *   2) tunggu container status FINISHED
   *   3) media_publish
   */
  async function publishInstagram(cfg, row) {
    if (!cfg.ig_id) {
      throw new Error('Instagram Business belum terhubung — hubungkan IG ke Page lalu ulangi OAuth');
    }
    if (!row.media_url) {
      throw new Error('Instagram butuh gambar — isi "Link media" (URL gambar yang bisa diakses publik)');
    }
    const token = cfg.page_token;
    const container = await graph(`${cfg.ig_id}/media`, {
      method: 'POST',
      params: { image_url: row.media_url, caption: row.konten, access_token: token },
    });
    if (!container.id) throw new Error('Instagram tidak mengembalikan media container');
    for (let i = 0; i < 10; i++) {
      const st = await graph(`${container.id}?fields=status_code,status`, { method: 'GET', params: { access_token: token } });
      if (st.status_code === 'FINISHED') break;
      if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') {
        throw new Error(`Instagram menolak media: ${st.status || st.status_code}`);
      }
      await sleep(3000);
    }
    const pub = await graph(`${cfg.ig_id}/media_publish`, {
      method: 'POST',
      params: { creation_id: container.id, access_token: token },
    });
    return { ok: true, remote_id: pub.id, remote_url: `https://www.instagram.com/p/${pub.id}/` };
  }

  /**
   * Threads: 2 langkah (bikin media container, lalu publish).
   * Threads API = host sendiri (graph.threads.net/v1.0) + token sendiri.
   */
  async function publishThreads(cfg, row) {
    if (!cfg.threads_user_id || !cfg.threads_token) {
      throw new Error('Threads belum terhubung — sambungkan dulu lewat ⚙️ Koneksi');
    }
    const token = cfg.threads_token;
    const container = await graph(`${cfg.threads_user_id}/threads`, {
      method: 'POST',
      base: THREADS_API,
      params: { media_type: 'TEXT', text: row.konten, access_token: token },
    });
    if (!container.id) throw new Error('Threads tidak mengembalikan media container');
    const pub = await graph(`${container.id}/publish`, {
      method: 'POST',
      base: THREADS_API,
      params: { access_token: token },
    });
    const uname = cfg.threads_username || 'me';
    return { ok: true, remote_id: pub.id, remote_url: `https://www.threads.net/@${uname}/post/${pub.id}` };
  }

  /**
   * Publikasikan satu baris social_posts sesuai platform-nya, lalu patch status
   * row. Semua error ditangkap → status 'failed' + last_error (bukan exception
   * yang lolos ke pemanggil).
   */
  async function postRowAndUpdate(cfg, row) {
    try {
      let out;
      const platform = (row.platform || 'facebook').toLowerCase();
      if (platform === 'threads') out = await publishThreads(cfg, row);
      else if (platform === 'instagram') out = await publishInstagram(cfg, row);
      else out = await publishFacebook(cfg, row);
      await patchPost(row.id, { status: 'posted', posted_at: new Date().toISOString(), remote_id: out.remote_id, remote_url: out.remote_url, last_error: null });
      return { ok: true, remote_id: out.remote_id, remote_url: out.remote_url };
    } catch (e) {
      const msg = String(e.message || e).slice(0, 250);
      await patchPost(row.id, { status: 'failed', last_error: msg });
      return { ok: false, error: msg };
    }
  }

  // ── MODE 2: serahkan jadwal ke Meta (Business Suite) ───────────────────────
  /**
   * Jadwalkan satu baris social_posts di scheduler Meta.
   * - published=false + scheduled_publish_time → Meta yang menayangkan.
   * - Kalau baris sudah 'terjadwal', waktu-nya DIUBAH (PATCH ke post yang ada),
   *   bukan dibuat dobel.
   */
  async function scheduleOnMeta(cfg, row, whenIso) {
    if (row.status === 'posted') return { ok: false, error: 'post sudah tayang — tidak bisa dijadwalkan ulang' };
    const platform = (row.platform || 'facebook').toLowerCase();
    if (platform !== 'facebook') {
      return { ok: false, error: `Jadwal otomatis lewat Meta baru berlaku untuk Facebook. Untuk ${platform}, pakai jadwal manual di aplikasinya atau Business Suite.` };
    }
    if (!row.konten || !String(row.konten).trim()) return { ok: false, error: 'konten kosong' };

    const when = whenIso ? new Date(whenIso) : (row.scheduled_at ? new Date(row.scheduled_at) : null);
    if (!when || isNaN(when.getTime())) {
      return { ok: false, error: 'waktu tayang kosong — isi jadwal dulu' };
    }
    const delta = when.getTime() - Date.now();
    if (delta < SCHEDULE_MIN_MS) {
      return { ok: false, error: `waktu tayang terlalu dekat — minimal ${SCHEDULE_MIN_MENIT} menit ke depan` };
    }
    if (delta > SCHEDULE_MAX_MS) {
      return { ok: false, error: 'waktu tayang lebih dari 75 hari — itu limit Meta' };
    }
    const unix = Math.floor(when.getTime() / 1000);

    try {
      // Sudah ada di scheduler Meta → geser waktunya (jangan bikin dobel).
      if (row.status === 'terjadwal' && row.remote_id) {
        await graph(row.remote_id, {
          method: 'POST',
          params: { published: 'true', scheduled_publish_time: unix, access_token: cfg.page_token },
        });
        await patchPost(row.id, { status: 'terjadwal', scheduled_at: when.toISOString(), last_error: null });
        return { ok: true, remote_id: row.remote_id, remote_url: row.remote_url, scheduled_at: when.toISOString(), moved: true };
      }

      const params = { access_token: cfg.page_token, published: 'false', scheduled_publish_time: unix };
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
      const out = await graph(endpoint, { method: 'POST', params });
      const remoteId = out.post_id || out.id;
      if (!remoteId) throw new Error('Meta tidak mengembalikan id post');
      const remoteUrl = `https://facebook.com/${remoteId}`;
      await patchPost(row.id, {
        status: 'terjadwal',
        scheduled_at: when.toISOString(),
        remote_id: remoteId,
        remote_url: remoteUrl,
        last_error: null,
      });
      return { ok: true, remote_id: remoteId, remote_url: remoteUrl, scheduled_at: when.toISOString() };
    } catch (e) {
      const msg = String(e.message || e).slice(0, 250);
      // Jangan turunkan status ke 'failed' kalau ini post yang SUDAH terjadwal —
      // status 'terjadwal' itu benar, yang gagal cuma penggeseran waktunya.
      if (row.status !== 'terjadwal') {
        await patchPost(row.id, { status: 'failed', last_error: msg });
      } else {
        await patchPost(row.id, { last_error: msg });
      }
      return { ok: false, error: msg };
    }
  }

  /**
   * Cek post yang sudah diserahkan ke scheduler Meta: mana yang sudah tayang.
   * Sinyal: post yang SUDAH tayang muncul di feed Page; yang masih terjadwal
   * belum muncul. Jadi kita bandingkan remote_id dengan isi feed.
   */
  async function syncRemote(cfg) {
    const rows = await sb("/rest/v1/social_posts?status=eq.terjadwal&select=id,remote_id,remote_url,scheduled_at&order=scheduled_at.asc&limit=100");
    const list = Array.isArray(rows) ? rows.filter((r) => r.remote_id) : [];
    if (!list.length) return { ok: true, checked: 0, live: 0, results: [] };

    const feed = await graph(`${cfg.page_id}/feed`, {
      method: 'GET',
      params: { fields: 'id,permalink_url', access_token: cfg.page_token, limit: 100 },
    });
    const live = new Map((feed.data || []).map((p) => [String(p.id), p.permalink_url]));

    const results = [];
    let liveCount = 0;
    for (const r of list) {
      const permalink = live.get(String(r.remote_id));
      if (permalink) {
        await patchPost(r.id, {
          status: 'posted',
          posted_at: new Date().toISOString(),
          remote_url: permalink || r.remote_url,
          last_error: null,
        });
        liveCount++;
        results.push({ id: r.id, ok: true, status: 'posted' });
      } else {
        results.push({ id: r.id, ok: true, status: 'terjadwal' });
      }
    }
    return { ok: true, checked: list.length, live: liveCount, results };
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
            const row = await readRow(id);
            if (!row) return { status: 404, json: { ok: false, error: 'row_not_found' } };
            const platform = (row.platform || 'facebook').toLowerCase();
            const cfg = await readPublishConfig();
            if (!cfg) return { status: 200, json: { ok: false, error: 'no_config', message: 'Belum ada koneksi — sambungkan di ⚙️ Koneksi.' } };
            if (platform === 'threads' && !cfg.threads_user_id) {
              return { status: 200, json: { ok: false, error: 'no_threads_config', message: 'Threads belum terhubung — sambungkan dulu di ⚙️ Koneksi.' } };
            }
            if (platform !== 'threads' && !cfg.page_id) {
              return { status: 200, json: { ok: false, error: 'no_config', message: 'Koneksi FB belum disimpan — buat dulu di ⚙️ Koneksi.' } };
            }
            if (row.status === 'posted') return { status: 200, json: { ok: false, error: 'already_posted', remote_url: row.remote_url } };
            if (row.status === 'terjadwal') {
              return { status: 200, json: { ok: false, error: 'sudah_dijadwalkan_di_meta', remote_url: row.remote_url, scheduled_at: row.scheduled_at } };
            }
            return { status: 200, json: await postRowAndUpdate(cfg, row) };
          }
          case 'post-due': {
            const cfg = await readPublishConfig();
            if (!cfg) return { status: 200, json: { ok: false, error: 'no_config' } };
            const now = new Date().toISOString();
            // remote_id=is.null → jangan sentuh post yang sudah diserahkan ke
            // scheduler Meta (status 'terjadwal'), biar tidak dobel tayang.
            const due = await sb(`/rest/v1/social_posts?status=eq.approved&remote_id=is.null&scheduled_at=lte.${now}&select=id&order=scheduled_at.asc&limit=5`);
            let posted = 0, failed = 0;
            for (const t of due || []) {
              const row = await readRow(t.id);
              if (!row) continue;
              const out = await postRowAndUpdate(cfg, row);
              out.ok ? posted++ : failed++;
            }
            return { status: 200, json: { ok: true, due: (due || []).length, posted, failed } };
          }
          case 'schedule-remote': {
            const id = String(body.id || '');
            if (!id) return { status: 400, json: { ok: false, error: 'missing_id' } };
            const cfg = await readFbConfig();
            if (!cfg) return { status: 200, json: { ok: false, error: 'no_config', message: 'Koneksi FB belum disimpan — buat dulu di ⚙️ Koneksi.' } };
            const row = await readRow(id);
            if (!row) return { status: 404, json: { ok: false, error: 'row_not_found' } };
            const out = await scheduleOnMeta(cfg, row, body.scheduled_at);
            return { status: 200, json: { ...out, id } };
          }
          case 'schedule-remote-batch': {
            const ids = Array.isArray(body.ids) ? body.ids : [];
            if (!ids.length) return { status: 400, json: { ok: false, error: 'missing_ids' } };
            const cfg = await readFbConfig();
            if (!cfg) return { status: 200, json: { ok: false, error: 'no_config', message: 'Koneksi FB belum disimpan — buat dulu di ⚙️ Koneksi.' } };
            const rows = await readRows(ids);
            const results = [];
            let ok = 0, gagal = 0;
            for (const row of rows) {
              const out = await scheduleOnMeta(cfg, row, body.scheduled_at);
              out.ok ? ok++ : gagal++;
              results.push({ id: row.id, ...out });
            }
            const takAda = ids.length - rows.length;
            return { status: 200, json: { ok: gagal === 0, total: ids.length, ok, gagal, tak_ditemukan: takAda, results } };
          }
          case 'sync-remote': {
            const cfg = await readFbConfig();
            if (!cfg) return { status: 200, json: { ok: false, error: 'no_config' } };
            return { status: 200, json: await syncRemote(cfg) };
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
