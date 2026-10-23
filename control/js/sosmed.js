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
let pollTimer = null;
let polling = false;

const STATUS_LABEL = { draft: 'Draft', approved: 'Dijadwalkan', posted: 'Terposting', failed: 'Gagal' };
const STATUS_TONE = { draft: 'gray', approved: 'amber', posted: 'green', failed: 'red' };
const CHIPS = [
  { key: '', label: 'Semua' },
  { key: 'draft', label: 'Draft' },
  { key: 'approved', label: 'Dijadwalkan' },
  { key: 'posted', label: 'Terposting' },
  { key: 'failed', label: 'Gagal' },
];

const el = (id) => document.getElementById(id);

// ── init (idempoten) — dipanggil saat screen 'social' dibuka ──────────────────
function initSocial() {
  if (inited) { refreshAll(); return; }
  inited = true;
  el('btnSocialNew')?.addEventListener('click', () => openSocialEdit(null));
  el('btnSocialConfig')?.addEventListener('click', () => openSocialConfig());
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
      <b>Jalur cepat — uji coba 5 menit (token ±1 jam):</b>
      <ol>
        <li>Buka <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener">Graph API Explorer</a> — pastikan login dgn akun FB yang jadi <b>admin Page-mu</b>.</li>
        <li>Di panel kanan, <b>Permissions</b> → Add: <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code>.</li>
        <li>Tekan <b>Generate Access Token</b> → setujui semua dialog → centang Page-mu.</li>
        <li>Di kotak query (kiri, bertuliskan GET …) ganti jadi <code>me/accounts</code> → tekan <b>Submit</b>.</li>
        <li>Di hasil JSON: ambil <code>id</code> → isi <b>Page ID</b> di atas, ambil <code>access_token</code> milik Page-mu → isi <b>Token</b> di atas → <b>Uji Koneksi</b>.</li>
      </ol>
      <b>Jalur permanen — token tak pernah kedaluwarsa (±10 menit, lakukan setelah uji coba sukses):</b>
      <ol>
        <li>Buat <b>Meta App</b>: <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> → Create App → tipe <b>Business</b> → salin <b>App ID</b> &amp; <b>App Secret</b> (Settings → Basic).</li>
        <li>Di Graph API Explorer: pilih app-mu di dropdown <b>App</b> (jangan "Graph API Explorer") → ulangi langkah 2–5 jalur cepat di atas → salin token Page-nya.</li>
        <li>Buka <a href="https://developers.facebook.com/tools/accesstoken/debugger/" target="_blank" rel="noopener">Access Token Debugger</a> → tempel token itu → tekan <b>Extend Access Token</b> → salin token 60-hari hasilnya.</li>
        <li>Langkah terakhir: jalankan <code>GET /me/accounts</code> lagi di Graph API Explorer <b>pakai token 60-hari itu</b> → token Page yang muncul sekarang <b>tak pernah kedaluwarsa</b> → tempel di atas → Uji → Simpan.</li>
      </ol>
      <span class="muted">Token disimpan di server (tabel settings) dan tidak pernah ditampilkan ulang di UI. Dua hal yang sering bikin gagal: (1) keliru pakai token USER padahal yang benar token PAGE dari /me/accounts; (2) akun FB yang login bukan admin Page. Kalau posting mulai gagal "invalid token", ulangi jalur permanen.</span>
    </div>`;
  openSheet('sheetSocialConfig');
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
    const when = p.status === 'posted'
      ? (p.posted_at ? `terposting ${new Date(p.posted_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'terposting')
      : p.status === 'approved' && p.scheduled_at
        ? `tayang ${new Date(p.scheduled_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : `dibuat ${new Date(p.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short' })}`;
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
function openSocialEdit(id) {
  editId = id || null;
  const p = editId ? posts.find((x) => x.id === editId) : null;
  el('socialEditTitle').textContent = p ? 'Edit Post' : 'Buat Post';
  el('socialEditBody').innerHTML = `
    <div class="field"><label for="socialPlatform">Platform</label>
      <select id="socialPlatform">
        <option value="facebook">Facebook Page</option>
        <option value="instagram" disabled>Instagram — Fase 2</option>
      </select></div>
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
      <button class="btn btn-outline btn-sm" id="btnSocialManual">✓ Posting Manual</button>
      <button class="btn btn-primary btn-sm" id="btnSocialPost">🚀 Post Sekarang</button>
    </div>
    <div class="muted" id="socialEditHint">${cfg?.page_id ? '🚀 posting otomatis via Graph API · ✓ Posting Manual = kamu kirim sendiri lalu tandai di sini.' : 'Koneksi FB belum ada — pakai 📋 Salin lalu posting manual dari HP, tekan ✓ Posting Manual, atau atur di ⚙️ Koneksi.'}</div>`;
  openSheet('sheetSocialEdit');

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
