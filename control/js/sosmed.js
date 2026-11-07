/**
 * Control Center — Sosmed Module (antrian posting Facebook, Fase 1)
 * =============================================================================
 * Fitur auto posting: AI buat caption (runner, agent 'posting_sosmed') →
 * review/edit di sini → post ke Facebook Page via Graph API resmi
 * (api/social-fb.js, kredensial Page disimpan server-side di settings.social_fb).
 *
 * Akses data: supabaseFetch() → /api/rest (tabel social_posts, RLS admin-only).
 * Eksekusi posting: controlApi('/api/social-fb', {action}) — bukan browser.
 * =============================================================================
 */

import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';
import { supabaseFetch, controlApi } from './api.js';
import { icon } from './icons.js';

let posts = [];
let chip = '';            // '' = semua
let inited = false;
let editId = null;        // null = buat baru
let cfg = null;           // { page_id, page_token, page_name } — token tidak ditampilkan
let oauthStatus = null;   // status koneksi OAuth (FB/IG/Threads) — tanpa token
let pollTimer = null;
let polling = false;

const STATUS_LABEL = {
  draft: 'Draft',
  planned: 'Rencana',
  approved: 'Dijadwalkan',
  terjadwal: 'Menunggu Meta',
  posted: 'Terposting',
  failed: 'Gagal',
};
const STATUS_TONE = { draft: 'gray', planned: 'teal', approved: 'amber', terjadwal: 'blue', posted: 'green', failed: 'red' };
const CHIPS = [
  { key: '', label: 'Semua' },
  { key: 'draft', label: 'Draft' },
  { key: 'planned', label: 'Rencana' },
  { key: 'approved', label: 'Dijadwalkan' },
  { key: 'terjadwal', label: 'Menunggu Meta' },
  { key: 'posted', label: 'Terposting' },
  { key: 'failed', label: 'Gagal' },
];

const el = (id) => document.getElementById(id);

// ══════════════════════════════════════════════════════════════════════════════
// OAuth Meta — Facebook Login for Business (Page + Instagram Business) & Threads
// ══════════════════════════════════════════════════════════════════════════════
// Token hasil OAuth disimpan SERVER-SIDE (tabel settings) dan tidak pernah
// dikembalikan ke browser. Endpoint 'status' cuma balas info non-rahasia.
//
// Popup: control membuka dialog OAuth di window baru. Callback page mengirim
// postMessage ke window induk, lalu menutup diri. Kalau window.opener mati
// (popup diblokir / opened dengan noopener), ada fallback polling status —
// jadi dua-duanya aman.

async function loadOauthStatus() {
  try {
    const r = await controlApi('/api/social-oauth', { action: 'status' });
    oauthStatus = r?.ok ? r.data : null;
  } catch {
    oauthStatus = null;
  }
  return oauthStatus;
}

/** Panel HTML status + tombol OAuth (3 platform). */
function renderOauthPanel() {
  const host = el('socialOauthPanel');
  if (!host) return;
  const s = oauthStatus;

  if (!s) {
    host.innerHTML = '<p class="muted">Memuat status koneksi…</p>';
    return;
  }
  const cfgd = s.configured || {};
  const fb = s.facebook || {};
  const ig = fb.instagram || {};
  const th = s.threads || {};

  // Env server belum lengkap → kasih tahu persis apa yang kurang.
  const kurang = [];
  if (!cfgd.app_id) kurang.push('FB_APP_ID');
  if (!cfgd.app_secret) kurang.push('FB_APP_SECRET');
  if (!cfgd.public_url) kurang.push('CONTROL_PUBLIC_URL');

  const badge = (ok, txt) => ok
    ? `<span class="badge green">${escapeHtml(txt)}</span>`
    : `<span class="badge gray">${escapeHtml(txt)}</span>`;

  host.innerHTML = `
    ${kurang.length ? `
      <div class="oauth-note oauth-note-warn" style="margin-bottom:12px">
        <b>OAuth belum aktif di server.</b> Env yang kurang: <code>${kurang.map(escapeHtml).join('</code>, <code>')}</code>.
        <br><span class="muted">Set di server (Vercel env / <code>control/.env.local</code>), lalu restart.
        Sampe itu, jalur manual token di bawah tetap jalan.</span>
        ${cfgd.callback_url ? `<br><span class="muted">Daftarkan ini sebagai <b>Valid OAuth Redirect URI</b> di app Meta:</span><br><code>${escapeHtml(cfgd.callback_url)}</code>` : ''}
      </div>` : `
      <div class="oauth-note" style="margin-bottom:12px">
        <span class="muted">Redirect URI yang harus didaftarkan di app Meta (Settings → Basic → Valid OAuth Redirect URIs):</span><br>
        <code>${escapeHtml(cfgd.callback_url || '(CONTROL_PUBLIC_URL belum di-set)')}</code>
      </div>`}

    <div class="oauth-rows">
      <div class="oauth-row">
        <div class="oauth-ico">📘</div>
        <div class="oauth-txt">
          <b>Facebook Page</b>
          ${fb.connected
            ? `<div class="muted">${escapeHtml(fb.page_name || fb.page_id || '')}${fb.fan_count != null ? ` · ${fb.fan_count} pengikut` : ''} · via ${escapeHtml(fb.via || '?')}</div>`
            : '<div class="muted">Belum terhubung</div>'}
        </div>
        <div class="oauth-act">
          ${fb.connected ? badge(true, 'Terhubung') : badge(false, 'Belum')}
          ${fb.connected
            ? `<button class="btn btn-outline btn-sm" data-oauth-dis="facebook">✂️ Putuskan</button>`
            : `<button class="btn btn-primary btn-sm" data-oauth-start="facebook" ${kurang.length ? 'disabled title="Env server belum lengkap"' : ''}>🔗 Hubungkan</button>`}
        </div>
      </div>

      <div class="oauth-row">
        <div class="oauth-ico">📸</div>
        <div class="oauth-txt">
          <b>Instagram Business</b>
          ${ig.connected
            ? `<div class="muted">@${escapeHtml(ig.username || '')} · ter-link ke Page</div>`
            : '<div class="muted">Belum terhubung (IG harus ter-link ke Page, lalu OAuth ulang)</div>'}
        </div>
        <div class="oauth-act">
          ${ig.connected ? badge(true, 'Terhubung') : badge(false, 'Belum')}
          ${fb.connected && !ig.connected
            ? `<button class="btn btn-outline btn-sm" data-oauth-start="facebook" ${kurang.length ? 'disabled' : ''}>🔗 Hubungkan IG</button>`
            : ''}
        </div>
      </div>

      <div class="oauth-row">
        <div class="oauth-ico">🧵</div>
        <div class="oauth-txt">
          <b>Threads</b>
          ${th.connected
            ? `<div class="muted">@${escapeHtml(th.username || th.threads_user_id || '')}${th.expires_at ? ` · token s.d. ${new Date(th.expires_at).toLocaleDateString('id-ID')}` : ''}</div>`
            : '<div class="muted">Belum terhubung (API Threads terpisah dari Facebook Login)</div>'}
        </div>
        <div class="oauth-act">
          ${th.connected ? badge(true, 'Terhubung') : badge(false, 'Belum')}
          ${th.connected
            ? `<button class="btn btn-outline btn-sm" data-oauth-dis="threads">✂️ Putuskan</button>`
            : `<button class="btn btn-primary btn-sm" data-oauth-start="threads" ${kurang.length ? 'disabled title="Env server belum lengkap"' : ''}>🔗 Hubungkan</button>`}
        </div>
      </div>
    </div>`;

  host.querySelectorAll('[data-oauth-start]').forEach((b) => {
    b.addEventListener('click', () => startOauth(b.dataset.oauthStart));
  });
  host.querySelectorAll('[data-oauth-dis]').forEach((b) => {
    b.addEventListener('click', () => disconnectOauth(b.dataset.oauthDis));
  });
}

/** Mulai alur OAuth: minta URL → buka popup → tunggu hasilnya. */
async function startOauth(platform) {
  const r = await controlApi('/api/social-oauth', { action: 'start', platform });
  if (!r?.ok || !r.data?.url) {
    return showToast(r?.data?.message || 'Gagal memulai OAuth', 4000, 'error');
  }
  const popup = window.open(r.data.url, 'kasirsolo_oauth', 'width=640,height=760,noopener=no');
  if (!popup) {
    return showToast('Popup diblokir browser — izinkan popup untuk situs ini, lalu ulangi', 4500, 'warning');
  }
  showToast('Jendela OAuth terbuka — centang Page (dan IG kalau mau)', 4000, 'info');
  await waitForOauth(platform, popup);
}

/**
 * Tunggu hasil OAuth.
 * (1) postMessage dari callback page (jalur normal)
 * (2) polling status — cadangan kalau window.opener tidak nyambung
 */
async function waitForOauth(platform, popup) {
  const cek = async () => {
    const s = await loadOauthStatus();
    if (platform === 'threads' ? s?.threads?.connected : s?.facebook?.connected) return true;
    return false;
  };

  for (let i = 0; i < 40; i++) { // 40 × 1.5 dtk = 60 detik
    await new Promise((r) => setTimeout(r, 1500));
    try { if (popup && popup.closed) break; } catch { /* abaikan */ }
    if (await cek()) {
      renderOauthPanel();
      await loadConfig();
      await loadPosts();
      showToast(platform === 'threads' ? '✓ Threads terhubung' : '✓ Facebook + Instagram terhubung', 3000, 'success');
      return;
    }
  }
  // popup ditutup tanpa hasil → cek terakhir
  if (await cek()) {
    renderOauthPanel();
    await loadConfig();
    showToast('✓ Koneksi tersimpan', 3000, 'success');
    return;
  }
  renderOauthPanel();
  showToast('OAuth belum selesai — cek status koneksi', 3500, 'warning');
}

/** Callback page kirim postMessage; ini catcher-nya. */
window.addEventListener('message', (ev) => {
  const d = ev?.data;
  if (!d || d.type !== 'meta-oauth') return;
  if (d.ok) {
    showToast(d.platform === 'threads' ? '✓ Threads terhubung' : '✓ Facebook + Instagram terhubung', 3000, 'success');
  } else {
    showToast(`OAuth gagal: ${d.message || 'tidak diketahui'}`, 5000, 'error');
  }
  loadOauthStatus().then(() => { renderOauthPanel(); loadConfig(); });
});

/** Putuskan koneksi (hapus token server-side). */
async function disconnectOauth(platform) {
  if (!confirm(platform === 'threads'
    ? 'Putuskan Threads? Token akan dihapus dari server dan post Threads berhenti jalan.'
    : 'Putuskan Facebook + Instagram? Token akan dihapus dari server dan posting otomatis berhenti.')) return;
  const r = await controlApi('/api/social-oauth', { action: 'disconnect', platform });
  if (r?.ok) {
    await loadOauthStatus();
    await loadConfig();
    renderOauthPanel();
    showToast('Koneksi diputus', 2500, 'success');
  } else {
    showToast('Gagal memutus koneksi', 3000, 'error');
  }
}

// ── init (idempoten) — dipanggil saat screen 'social' dibuka ──────────────────
function initSocial() {
  if (inited) { refreshAll(); return; }
  inited = true;
  el('btnSocialNew')?.addEventListener('click', () => openSocialEdit(null));
  el('btnSocialConfig')?.addEventListener('click', () => openSocialConfig());
  el('btnSocialBulk')?.addEventListener('click', scheduleAllToMeta);
  el('btnSocialSync')?.addEventListener('click', syncRemoteStatus);
  refreshAll();
}

async function refreshAll() {
  await Promise.all([loadConfig(), loadPosts()]);
  // Posting otomatis: approved yang jatuh tempo (maks 5 per panggilan, server-side)
  try {
    const r = await controlApi('/api/social-fb', { action: 'post-due' });
    const due = r?.data?.due || 0;
    if (r?.data?.ok && due > 0) {
      showToast(`📡 ${due} post terjadwal tereksekusi`, 3000, 'success');
      await loadPosts();
    }
  } catch { /* offline — biarkan */ }
}

// ── koneksi FB (settings.social_fb) ───────────────────────────────────────────
async function loadConfig() {
  try {
    const r = await supabaseFetch('/rest/v1/settings?key=eq.social_fb&select=value&limit=1');
    const v = r?.data?.[0]?.value || null;
    cfg = v ? (typeof v === 'string' ? JSON.parse(v) : v) : null;
    const s = el('socialCfgStatus');
    if (s) s.textContent = cfg?.page_name ? `Koneksi FB: ✓ ${cfg.page_name}` : 'Koneksi FB: belum ada — ⚙️ Koneksi';
  } catch { cfg = null; }
}

function openSocialConfig() {
  el('socialConfigBody').innerHTML = `
    <div class="oauth-panel" id="socialOauthPanel"></div>
    <hr class="oauth-sep">
    <h4 class="oauth-h">Jalur manual (tanpa OAuth)</h4>
    <div class="field"><label for="cfgPageId">Page ID</label>
      <input id="cfgPageId" placeholder="mis. 123456789012345" value="${escapeHtml(cfg?.page_id || '')}"></div>
    <div class="field"><label for="cfgPageToken">Page Access Token (long-lived)</label>
      <input id="cfgPageToken" type="password" placeholder="EAAG…" value="${escapeHtml(cfg?.page_token || '')}"></div>
    <div class="social-btns">
      <button class="btn btn-outline btn-sm" id="btnSocialTest">🧪 Uji Koneksi</button>
      <button class="btn btn-primary btn-sm" id="btnSocialSaveCfg">💾 Simpan Koneksi</button>
    </div>
    <div class="muted" id="socialCfgInfo">${cfg?.page_name ? 'Terkoneksi: ' + escapeHtml(cfg.page_name) : 'Belum terkoneksi.'}</div>
    <div class="social-guide">
      <details open>
        <summary><b>🅰️ Tanpa Meta App (±5 menit — tanpa bikin app, tanpa review)</b> <span class="muted">(recommended)</span></summary>
        <ol>
          <li>Buka <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener">Graph API Explorer</a> → login pakai akun FB yang jadi <b>admin Page-mu</b>.</li>
          <li>Panel kanan → <b>Permissions</b> → <b>Add a Permission</b>. Kalau cuma dropdown, ketik manual nama izinnya. Tambahkan:
            <code>pages_show_list</code> · <code>pages_read_engagement</code> · <code>pages_manage_posts</code>
            <br><span class="muted">Tambahkan juga <code>pages_read_user_content</code> kalau nanti mau auto-balas komentar.</span></li>
          <li>Tekan <b>Generate Access Token</b> → setujui semua dialog → <b>centang Page-mu</b> (ini yang paling sering terlewat).</li>
          <li>Kotak query (kiri) → ganti jadi <code>me/accounts?fields=id,name,tasks,access_token</code> → <b>Submit</b>.</li>
          <li>Di hasil JSON: <b>cek <code>tasks</code></b> — harus ada <code>CREATE_CONTENT</code>, <code>MANAGE</code>, <code>MODERATE</code>. Kalau kosong, role-mu di Page belum bener.</li>
          <li>Ambil <code>id</code> → isi <b>Page ID</b> di atas. Ambil <code>access_token</code> milik Page-mu → isi <b>Token</b> di atas → <b>Uji Koneksi</b> → <b>Simpan Koneksi</b>.</li>
        </ol>
        <span class="muted">Token dari Explorer bertahan ±1 jam — <b>cukup buat proving</b>. Supaya jadi permanen: salin token itu ke <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener">Access Token Debugger</a> → <b>Extend Access Token</b> (jadi 60 hari) → balik ke Explorer, ulangi query <code>me/accounts</code> dengan token 60-hari itu → Page token hasilnya <b>tidak pernah kedaluwarsa</b>. Refresh cuma 2×/tahun, 3 menit. <b>Meta App tidak diperlukan sama sekali</b> untuk ini.</span>
      </details>
      <details>
        <summary><b>🅱️ Nol token — pakai Meta Business Suite (cuma nempel caption)</b></summary>
        <ol>
          <li>Control tetap jadi "otak konten": bikin caption di sini, tekan <b>📋 Salin Caption</b>.</li>
          <li>Buka <a href="https://business.facebook.com/" target="_blank" rel="noopener">business.facebook.com</a> → Planner → buat post → paste caption → set tanggal jam → Schedule.</li>
        </ol>
        <span class="muted">Jadwalnya jalan di server Meta (PC boleh mati) dan kelihatan di kalender Business Suite. Nol token, nol risiko. Butuh ~2 menit/hari. Posts di grup FB <b>tidak</b> bisa dijadwalkan lewat API — Meta menutup API grup April 2024, jadi grup tetap manual.</span>
      </details>
      <details>
        <summary><b>🅲️ Meta App (permanen + auto-reply komentar)</b></summary>
        <ol>
          <li>Buat app di <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> → type <b>Business</b> → catat <b>App ID</b> &amp; <b>App Secret</b> (Settings → Basic). Mode <b>Development</b> cukup — <b>tidak perlu App Review</b> untuk Page milik sendiri, dan <b>tidak perlu Business Verification</b>.</li>
          <li>Di Explorer pilih app-mu, generate token dengan izin lengkap, extend 60 hari di Debugger, ambil Page token dari <code>me/accounts</code> → paste di atas.</li>
        </ol>
        <span class="muted">Jalur ini cuma perlu kalau lo mau <b>auto-balas komentar</b> (butuh <code>pages_read_user_content</code> + <code>pages_manage_engagement</code>). Untuk sekadar posting, jalur 🅰️ cukup.</span>
      </details>
      <details>
        <summary><b>🧪 Cek token lo (tanpa tampilin token utuh)</b></summary>
        <code>node control/scripts/fb-token-check.mjs --dari-db</code>
        <span class="muted">— bikin dari folder kasol. Ngecek: valid? kedaluwarsa kapan? izin apa aja? Page-nya terjangkau? <b>Token tidak pernah dicetak utuh</b> dan tidak pernah dikirim ke mana pun.</span>
      </details>
      <p class="muted">Token disimpan di server (tabel settings) dan tidak pernah ditampilkan ulang di UI. Dua hal yang sering bikin gagal: (1) keliru pakai token USER padahal yang benar token PAGE dari <code>me/accounts</code>; (2) akun FB yang login bukan admin Page.</p>
    </div>`;
  openSheet('sheetSocialConfig');
  // Muat status OAuth (FB/IG/Threads) lalu isi panelnya.
  renderOauthPanel();
  loadOauthStatus().then(renderOauthPanel);
  el('btnSocialTest')?.addEventListener('click', async () => {
    const page_id = el('cfgPageId').value.trim();
    const page_token = el('cfgPageToken').value.trim();
    if (!page_id || !page_token) return showToast('Isi Page ID dan token dulu', 2500, 'warning');
    el('socialCfgInfo').textContent = 'Menguji…';
    const r = await controlApi('/api/social-fb', { action: 'test', page_id, page_token });
    el('socialCfgInfo').textContent = r?.data?.ok
      ? `✓ Terhubung ke Page: ${r.data.page.name}`
      : `✗ Gagal: ${r?.data?.error || 'unknown'}`;
  });
  el('btnSocialSaveCfg')?.addEventListener('click', async () => {
    const value = { page_id: el('cfgPageId').value.trim(), page_token: el('cfgPageToken').value.trim(), page_name: cfg?.page_name || '' };
    if (!value.page_id || !value.page_token) return showToast('Isi Page ID dan token dulu', 2500, 'warning');
    const r = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      data: [{ key: 'social_fb', value }],
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    if (!r.ok) return showToast('Gagal menyimpan koneksi', 2500, 'error');
    showToast('✓ Koneksi FB tersimpan', 2500, 'success');
    await loadConfig();
    closeSheet('sheetSocialConfig');
  });
}

// ── daftar post ───────────────────────────────────────────────────────────────
async function loadPosts() {
  const r = await supabaseFetch('/rest/v1/social_posts?select=*&order=created_at.desc&limit=200');
  posts = r?.data || [];
  renderSocialChips();
  renderSocialList();
}

function renderSocialChips() {
  const host = el('socialChips');
  if (!host) return;
  const count = (k) => (k ? posts.filter((p) => p.status === k).length : posts.length);
  host.innerHTML = CHIPS.map((c) => `
    <button type="button" class="oc-chip ${chip === c.key ? 'on' : ''}" data-tone="gray"
      aria-pressed="${chip === c.key}" onclick="setSocialChip('${c.key}')">
      <i aria-hidden="true"></i>${escapeHtml(c.label)}<span class="n">${count(c.key)}</span>
    </button>`).join('');
}

window.setSocialChip = function (key) {
  if (chip === key) return;
  chip = key;
  renderSocialChips();
  renderSocialList();
};

function snippet(t, n = 110) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function renderSocialList() {
  const host = el('socialList');
  if (!host) return;
  const rows = chip ? posts.filter((p) => p.status === chip) : posts;
  if (!rows.length) {
    host.innerHTML = `<div class="oc-empty">Belum ada post. Tekan <b>＋ Buat Post</b> — AI bisa bantu buat caption-nya.</div>`;
    return;
  }
  host.innerHTML = rows.map((p) => {
    const fmtWaktu = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const when = p.status === 'posted'
      ? (p.posted_at ? `terposting ${fmtWaktu(p.posted_at)}` : 'terposting')
      : p.status === 'terjadwal'
        ? `tayang sendiri di Meta ${p.scheduled_at ? fmtWaktu(p.scheduled_at) : ''}`.trim()
        : p.status === 'approved' && p.scheduled_at
          ? `tayang ${fmtWaktu(p.scheduled_at)}`
          : `dibuat ${fmtWaktu(p.created_at)}`;
    const manual = p.status === 'posted' && !p.remote_id && !p.remote_url;
    const sub = p.last_error
      ? `${STATUS_LABEL[p.status] || p.status} · ${escapeHtml(snippet(p.last_error, 60))}`
      : `${STATUS_LABEL[p.status] || p.status}${manual ? ' (manual)' : ''} · ${when}${p.remote_url ? ` · <a href="${escapeHtml(p.remote_url)}" target="_blank" rel="noopener">lihat post ↗</a>` : ''}`;
    return `
      <div class="oc-row" data-id="${escapeHtml(p.id)}" role="button" tabindex="0" aria-label="Edit post">
        <div class="oc-ava" title="Facebook">f</div>
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(snippet(p.konten, 90))}</div>
          <div class="oc-sub">${sub}</div>
        </div>
        <div class="oc-side">
          <span class="badge ${STATUS_TONE[p.status] || 'gray'}">${STATUS_LABEL[p.status] || p.status}</span>
          <button class="oc-more" data-edit="${escapeHtml(p.id)}" aria-label="Edit">${icon('pencil', 14)}</button>
        </div>
      </div>`;
  }).join('');
  host.querySelectorAll('.oc-row').forEach((row) => {
    row.addEventListener('click', () => openSocialEdit(row.dataset.id));
  });
}

// ── editor (sheet) ────────────────────────────────────────────────────────────
async function openSocialEdit(id) {
  // Status OAuth dipakai untuk mengaktifkan pilihan platform (IG & Threads
  // hanya bisa dipilih kalau memang sudah terhubung).
  if (!oauthStatus) await loadOauthStatus();
  const o = oauthStatus || {};
  const fbOn = !!o.facebook?.connected;
  const igOn = !!o.facebook?.instagram?.connected;
  const thOn = !!o.threads?.connected;
  const opt = (v, label, on) => `<option value="${v}" ${on ? '' : 'disabled'}>${escapeHtml(label)}${on ? '' : ' — belum terhubung'}</option>`;
  editId = id || null;
  const p = editId ? posts.find((x) => x.id === editId) : null;
  el('socialEditTitle').textContent = p ? 'Edit Post' : 'Buat Post';
  el('socialEditBody').innerHTML = `
    <div class="field"><label for="socialPlatform">Platform</label>
      <select id="socialPlatform">
        ${opt('facebook', 'Facebook Page', fbOn)}
        ${opt('instagram', 'Instagram Business', igOn)}
        ${opt('threads', 'Threads', thOn)}
      </select></div>
    <div class="muted" id="socialPlatformHint"></div>
    <div class="field"><label for="socialTopik">Topik / angle (untuk 🤖 Generate)</label>
      <input id="socialTopik" placeholder="mis. fitur cetak struk baru, promo bulan ini, tips stok…"></div>
    <div class="field"><label for="socialGaya">Gaya</label>
      <select id="socialGaya">
        <option value="edukasi">Edukasi / tips</option>
        <option value="promo">Promo</option>
        <option value="umum">Umum / cerita</option>
      </select></div>
    <div id="socialVariants"></div>
    <div class="field"><label for="socialKonten">Konten</label>
      <textarea id="socialKonten" rows="6" placeholder="Tulis caption sendiri, atau isi topik lalu tekan 🤖 Generate…">${escapeHtml(p?.konten || '')}</textarea></div>
    <div class="field"><label for="socialLink">Link (opsional)</label>
      <input id="socialLink" placeholder="https://kasirsolo.com/…" value="${escapeHtml(p?.link || '')}"></div>
    <div class="field"><label for="socialMedia">URL gambar (opsional)</label>
      <input id="socialMedia" placeholder="https://…/gambar.jpg" value="${escapeHtml(p?.media_url || '')}"></div>
    <div class="field"><label for="socialJadwal">Jadwal tayang (opsional)</label>
      <input type="datetime-local" id="socialJadwal" value="${p?.scheduled_at ? toLocalInput(p.scheduled_at) : ''}"></div>
    <div class="social-btns">
      <button class="btn btn-outline btn-sm" id="btnSocialGenerate">🤖 Generate</button>
      <button class="btn btn-outline btn-sm" id="btnSocialCopy">📋 Salin Caption</button>
      <button class="btn btn-outline btn-sm" id="btnSocialSave">💾 Simpan Draft</button>
      <button class="btn btn-outline btn-sm" id="btnSocialSchedule">📅 Jadwalkan</button>
      <button class="btn btn-outline btn-sm" id="btnSocialMeta">🗓️ Jadwalkan di Meta</button>
      <button class="btn btn-outline btn-sm" id="btnSocialManual">✓ Posting Manual</button>
      <button class="btn btn-primary btn-sm" id="btnSocialPost">🚀 Post Sekarang</button>
    </div>
    <div class="muted" id="socialEditHint">${cfg?.page_id ? '🚀 posting otomatis via Graph API · ✓ Posting Manual = kamu kirim sendiri lalu tandai di sini.' : 'Koneksi FB belum ada — pakai 📋 Salin lalu posting manual dari HP, tekan ✓ Posting Manual, atau atur di ⚙️ Koneksi.'}</div>
    <div class="muted" id="socialEditHint2"><b>📅 Jadwalkan</b> = Control yang menepuk Graph API saat waktunya (PC/runner harus hidup).
      <b>🗓️ Jadwalkan di Meta</b> = diserahkan ke scheduler Meta → tayang sendiri, PC boleh mati, dan kelihatan di kalender Business Suite.</div>`;
  openSheet('sheetSocialEdit');

  // Pilih platform yang sesuai + hint per platform.
  const sel = el('socialPlatform');
  if (sel) {
    const want = p?.platform || 'facebook';
    const target = [...sel.options].find((o2) => o2.value === want && !o2.disabled)
      || [...sel.options].find((o2) => o2.value === want)
      || sel.options[0];
    if (target) sel.value = target.value;
    updatePlatformHint();
    sel.addEventListener('change', updatePlatformHint);
  }

  el('btnSocialGenerate')?.addEventListener('click', generateCaption);
  el('btnSocialCopy')?.addEventListener('click', async () => {
    const text = (el('socialKonten')?.value || '').trim();
    if (!text) return showToast('Konten masih kosong', 2500, 'warning');
    const ok = await copyText(text);
    showToast(ok ? '📋 Caption disalin — tempel di Facebook' : 'Gagal menyalin — salin manual dari kotak', ok ? 2500 : 3500, ok ? 'success' : 'warning');
  });
  el('btnSocialManual')?.addEventListener('click', async () => {
    const id = await saveSocialPost('posted', { manual: true });
    if (id) {
      closeSheet('sheetSocialEdit');
      await loadPosts();
    }
  });
  el('btnSocialSave')?.addEventListener('click', () => saveSocialPost('draft'));
  el('btnSocialSchedule')?.addEventListener('click', () => saveSocialPost('approved'));
  el('btnSocialPost')?.addEventListener('click', postSocialNow);
  el('btnSocialMeta')?.addEventListener('click', scheduleOnMetaNow);
}

// ── Jadwalkan di Meta (mode Business Suite) ─────────────────────────────────
/**
 * Serahkan satu post ke scheduler Meta: published=false + scheduled_publish_time.
 * Efeknya: post TAYANG SENDIRI di waktu yang dipilih (PC boleh mati), dan
 * kelihatan di kalender Business Suite. Status jadi 'terjadwal' — bukan
 * 'approved' — supaya scheduler Control tidak ikut menepuk dan jadi dobel.
 */
async function scheduleOnMetaNow() {
  if (!cfg?.page_id) { showToast('Koneksi FB belum ada — buka ⚙️ Koneksi', 3000, 'warning'); return; }
  const d = collectEditor();
  if (!d.konten) { showToast('Konten masih kosong', 2500, 'warning'); return; }
  if (!d.scheduled_at) { showToast('Isi "Jadwal tayang" dulu — Meta minimal 15 menit ke depan', 3200, 'warning'); return; }
  const id = await saveSocialPost('draft');
  if (!id) return;
  el('socialEditHint').textContent = '🗓️ Menyerahkan jadwal ke Meta…';
  const r = await controlApi('/api/social-fb', { action: 'schedule-remote', id, scheduled_at: d.scheduled_at });
  if (r?.data?.ok) {
    showToast('🗓️ Dijadwalkan di Meta — akan tayang sendiri', 3200, 'success');
    closeSheet('sheetSocialEdit');
    await loadPosts();
  } else {
    el('socialEditHint').textContent = `✗ ${r?.data?.error || 'gagal menjadwalkan ke Meta'}`;
    showToast('Gagal menjadwalkan ke Meta — lihat pesan di sheet', 3500, 'error');
    await loadPosts();
  }
}

/**
 * Batch: serahkan SEMUA post berstatus 'approved' yang punya waktu tayang ke
 * scheduler Meta sekaligus. Ini jalur "isi 14 hari ke Business Suite 1x".
 */
async function scheduleAllToMeta() {
  if (!cfg?.page_id) { showToast('Koneksi FB belum ada — buka ⚙️ Koneksi', 3000, 'warning'); return; }
  const rows = posts.filter((p) => p.status === 'approved' && p.scheduled_at);
  if (!rows.length) {
    showToast('Belum ada post "Dijadwalkan" yang punya waktu tayang', 3200, 'warning');
    return;
  }
  const fmt = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const preview = rows.slice(0, 10).map((p) => `   · ${fmt(p.scheduled_at)} — ${snippet(p.konten, 55)}`).join('\n');
  const more = rows.length > 10 ? `\n   … +${rows.length - 10} post lagi` : '';
  if (!confirm(
    `Serahkan ${rows.length} post ke scheduler Meta?\n\n${preview}${more}\n\n` +
    `Semua akan tayang sendiri di waktunya (PC boleh mati) dan muncul di kalender Business Suite.`
  )) return;
  showToast(`🗓️ Menyerahkan ${rows.length} post ke Meta…`, 2500, 'info');
  const r = await controlApi('/api/social-fb', { action: 'schedule-remote-batch', ids: rows.map((p) => p.id) });
  const d = r?.data;
  if (d?.ok) {
    showToast(`✓ ${d.ok} post terjadwal di Meta`, 3200, 'success');
  } else {
    const gagal = (d?.results || []).filter((x) => !x.ok).slice(0, 3).map((x) => `${x.id.slice(0, 8)}: ${x.error}`).join(' | ');
    showToast(`⚠ ${d?.ok ?? 0} berhasil, ${d?.gagal ?? '?'} gagal${gagal ? ' — ' + gagal : ''}`, 6000, 'error');
  }
  await loadPosts();
}

/**
 * Sinkronkan status: post yang sudah diserahkan ke Meta dicek satu per satu ke
 * feed Page; yang sudah tayang ditandai 'Terposting'.
 */
async function syncRemoteStatus() {
  if (!cfg?.page_id) { showToast('Koneksi FB belum ada — buka ⚙️ Koneksi', 3000, 'warning'); return; }
  showToast('🔄 Mengecek status di Meta…', 2000, 'info');
  const r = await controlApi('/api/social-fb', { action: 'sync-remote' });
  const d = r?.data;
  if (d?.ok) {
    showToast(`🔄 ${d.live} dari ${d.checked} post sudah tayang`, 3000, 'success');
    await loadPosts();
  } else {
    showToast(`Gagal sinkronkan: ${d?.error || 'unknown'}`, 3500, 'error');
  }
}

function toLocalInput(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function collectEditor() {
  return {
    platform: el('socialPlatform')?.value || 'facebook',
    konten: (el('socialKonten')?.value || '').trim(),
    link: (el('socialLink')?.value || '').trim() || null,
    media_url: (el('socialMedia')?.value || '').trim() || null,
    scheduled_at: el('socialJadwal')?.value ? new Date(el('socialJadwal').value).toISOString() : null,
  };
}

/** Hint per platform + matikan tombol "Jadwalkan di Meta" di luar Facebook. */
function updatePlatformHint() {
  const v = el('socialPlatform')?.value || 'facebook';
  const h = el('socialPlatformHint');
  const btnMeta = el('btnSocialMeta');
  if (h) {
    if (v === 'instagram') {
      h.innerHTML = '📸 Instagram API <b>wajib gambar</b> — isi "URL gambar" (harus bisa diakses publik). Post teks doang tidak didukung IG API.';
    } else if (v === 'threads') {
      h.innerHTML = '🧵 Threads menerima teks biasa. Jadwal otomatis lewat Meta <b>belum</b> berlaku untuk Threads — pakai jadwal di aplikasi Threads atau manual.';
    } else {
      h.innerHTML = '';
    }
  }
  if (btnMeta) btnMeta.disabled = v !== 'facebook';
}

async function saveSocialPost(toStatus, { manual = false } = {}) {
  const d = collectEditor();
  if (!d.konten) { showToast('Konten masih kosong', 2500, 'warning'); return null; }
  if (toStatus === 'approved' && !d.scheduled_at) { showToast('Isi jadwal tayang dulu', 2500, 'warning'); return null; }
  const payload = { ...d, status: toStatus };
  if (toStatus === 'posted' && manual) payload.posted_at = new Date().toISOString();
  let r;
  if (editId) {
    r = await supabaseFetch(`/rest/v1/social_posts?id=eq.${encodeURIComponent(editId)}`, { method: 'PATCH', data: payload });
  } else {
    r = await supabaseFetch('/rest/v1/social_posts', { method: 'POST', data: payload, headers: { Prefer: 'return=representation' } });
    if (r.ok && Array.isArray(r.data) && r.data[0]) { editId = r.data[0].id; el('socialEditTitle').textContent = 'Edit Post'; }
  }
  if (!r.ok) { showToast('Gagal menyimpan post', 2500, 'error'); return null; }
  showToast(toStatus === 'approved' ? '✓ Dijadwalkan' : toStatus === 'posted' ? '✓ Ditandai terposting' : '✓ Draft tersimpan', 2200, 'success');
  await loadPosts();
  return editId;
}

async function postSocialNow() {
  if (!cfg?.page_id) { showToast('Koneksi FB belum ada — buka ⚙️ Koneksi', 3000, 'warning'); return; }
  const id = await saveSocialPost('draft');
  if (!id) return;
  el('socialEditHint').textContent = '🚀 Posting…';
  const r = await controlApi('/api/social-fb', { action: 'post', id });
  if (r?.data?.ok) {
    showToast('🎉 Terposting ke Facebook!', 3000, 'success');
    closeSheet('sheetSocialEdit');
    await loadPosts();
  } else {
    el('socialEditHint').textContent = `✗ ${r?.data?.error || 'gagal posting'}`;
    showToast('Gagal posting — lihat pesan di sheet', 3500, 'error');
    await loadPosts();
  }
}

// ── Generate caption via agent runner ─────────────────────────────────────────
async function generateCaption() {
  const topik = (el('socialTopik')?.value || '').trim();
  if (!topik) return showToast('Isi topik/angle dulu', 2500, 'warning');
  const gaya = el('socialGaya')?.value || 'umum';
  const link = (el('socialLink')?.value || '').trim();

  const host = el('socialVariants');
  host.innerHTML = `<div class="muted">🤖 Menulis caption… (biasanya 5–60 detik; jangan tutup sheet)</div>`;

  // antre task ke runner (pola draft_klien)
  const r = await supabaseFetch('/rest/v1/agent_tasks', {
    method: 'POST',
    data: {
      agent: 'posting_sosmed',
      tipe: 'buat_caption',
      status: 'pending',
      payload: { topik, gaya, platform: 'facebook', jumlah: 2, link },
      created_at: new Date().toISOString(),
    },
    headers: { Prefer: 'return=representation' },
  });
  const taskId = r?.data?.[0]?.id;
  if (!taskId) { host.innerHTML = `<div class="muted">✗ Gagal mengantre tugas AI.</div>`; return; }

  polling = true;
  let tries = 0;
  const maxTries = 36; // 36 × 2.5s ≈ 90 dtk (rentang sehat runner 5–65 dtk)
  const tick = async () => {
    if (!polling) return;
    tries++;
    const o = await supabaseFetch(`/rest/v1/agent_outputs?task_id=eq.${encodeURIComponent(taskId)}&select=judul,isi&order=created_at.asc`);
    const outs = o?.data || [];
    if (outs.length) {
      polling = false;
      host.innerHTML = outs.map((v, i) => `
        <button type="button" class="oc-chip social-var" data-isi="${escapeHtml(v.isi)}">
          <i aria-hidden="true"></i>Pakai varian ${String.fromCharCode(65 + i)}${outs.length > 1 && i > 0 ? ` (${v.judul.split('—')[0].trim() || 'varian'})` : ''}
        </button>`).join('');
      host.querySelectorAll('.social-var').forEach((b) => b.addEventListener('click', () => {
        el('socialKonten').value = b.dataset.isi;
        showToast('Caption dimasukkan — silakan sunting', 2200, 'success');
      }));
      return;
    }
    if (tries >= maxTries) {
      polling = false;
      host.innerHTML = `<div class="muted">⏳ AI belum selesai (runner hidup? cek modul Agent). Caption bisa ditulis manual.</div>`;
      return;
    }
    pollTimer = setTimeout(tick, 2500);
  };
  tick();
}

// ── wiring screen ─────────────────────────────────────────────────────────────
window.addEventListener('screen:change', (e) => {
  if (e.detail?.screen === 'social') initSocial();
});
