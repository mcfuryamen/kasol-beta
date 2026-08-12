/**
 * Admin Marketing KASIRSOLO — Clients Module (CRM)
 * Menampilkan & mengelola profil klien yang tersinkron dari app klien (kaki5 dll)
 * ke tabel Supabase `clients`. Kartu klien bisa langsung GENERATE lisensi
 * (tanpa pindah ke menu Lisensi) + kirim serial ke WhatsApp merchant.
 * Analitik: total outlet, aktif 30 hari, per app, sebaran wilayah.
 *
 * Akses: semua data lewat supabaseFetch() → Vercel Serverless /api/rest
 * (service_role key hanya server-side, tidak pernah di browser).
 */

import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime, formatDate, normalizePhone, debounce } from './utils.js';
import { STATE, setState } from './app-state.js';
import { supabaseFetch, licenseApi } from './api.js';
import { updateSidebarBadges } from './navigation.js';
import { formatExpiry } from './license-core.js';

// app_type → produk (HANYA metadata: prefix/ikon/label).
// SECURITY (Fix C1): HMAC salt TIDAK lagi di client — generate/verify lisensi
// dipindah ke Vercel Serverless /api/license yang memegang salt server-side.
export const APP_META = {
  kaki5:  { prefix: 'KK5', icon: '🛵', label: 'Kaki Lima' },
  rosok:  { prefix: 'KSR', icon: '♻️', label: 'Rosok' },
  gerobak:{ prefix: 'GBK', icon: '🛒', label: 'Gerobak' },
  retail: { prefix: 'RTL', icon: '🏪', label: 'Retail' }
};
const metaFor = (at) => APP_META[at] || { prefix: '', icon: '📦', label: (at || 'Lain') };

let clients = [];
let current = null; // klien yang terbuka di sheet
let currentMeta = null;

const DAYS = 30 * 24 * 60 * 60 * 1000;
const isActive = (c) => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < DAYS;

/** Init module — pipeline tunggal dari tabel `clients` */
export async function initClients() {
  document.getElementById('clientsSearch')?.addEventListener('input', renderAll);
  document.getElementById('clientsAppFilter')?.addEventListener('change', renderAll);
  document.getElementById('backFromClient')?.addEventListener('click', () => window.backFromClient());

  // Toggle view List / Kanban
  document.querySelectorAll('.client-view-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchClientView(btn.dataset.view));
  });

  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'klien') { loadClients(); }
  });
  await loadClients();
}

/** View mode saat ini: 'analitik' | 'kelola' */
let clientView = 'analitik';
function switchClientView(view) {
  clientView = view;
  document.querySelectorAll('.client-view-btn[data-view]').forEach((btn) => {
    const on = btn.dataset.view === view;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
  const anEl = document.getElementById('analyticsView');
  const kanEl = document.getElementById('kanbanView');
  if (anEl) anEl.hidden = view !== 'analitik';
  if (kanEl) kanEl.hidden = view !== 'kelola';
  if (view === 'kelola') renderKanban();
  else renderAnalytics();
}
window.switchClientView = switchClientView;

/** Pipeline stages — satu tabel `clients` */
const PIPELINE_STAGES = [
  { key: 'baru', label: '🆕 Baru', tone: 'blue' },
  { key: 'dihubungi', label: '📞 Dihubungi', tone: 'orange' },
  { key: 'tertarik', label: '💡 Tertarik', tone: 'amber' },
  { key: 'menunggu_verifikasi', label: '⏳ Verifikasi', tone: 'teal' },
  { key: 'aktif', label: '✅ Aktif', tone: 'green' },
  { key: 'batal', label: '❌ Batal', tone: 'red' },
];

function stageMeta(status) {
  return PIPELINE_STAGES.find((s) => s.key === status) || { key: status, label: status || 'Tanpa status', tone: 'gray' };
}

function statusBadge(status) {
  const m = stageMeta(status);
  return `<span class="badge ${m.tone}">${m.label}</span>`;
}

/** Aksen kartu mengikuti konteks status */
function statusAccent(status) {
  return 'kb-acc-' + stageMeta(status).tone;
}

/** Baris konteks status pada kartu */
function statusCtxHtml(c, esc) {
  const sm = stageMeta(c.status);
  const on = isActive(c);
  switch (c.status) {
    case 'baru': return `<span class="kb-card-ctx">🆕 Lead baru — belum dihubungi</span>`;
    case 'dihubungi': return `<span class="kb-card-ctx">📞 Sudah dihubungi</span>`;
    case 'tertarik': return `<span class="kb-card-ctx">💡 Tertarik — siap ditawarkan</span>`;
    case 'menunggu_verifikasi':
      return c.bukti_url
        ? `<span class="kb-bukti" data-bukti="${esc(c.bukti_url)}">🧾 Lihat Bukti</span>`
        : `<span class="kb-card-ctx">⏳ Menunggu verifikasi</span>`;
    case 'aktif':
      return `<span class="kb-card-ctx ${on ? 'on' : 'off'}">${on ? '🟢 Online' : '⚪ Offline'}${c.serial ? ' · 🔑 ' + esc(String(c.serial).slice(0, 10)) + '…' : ''}</span>`;
    case 'batal': return `<span class="kb-card-ctx">❌ Batal — lisensi nonaktif</span>`;
    default: return `<span class="kb-card-ctx">${esc(sm.label)}</span>`;
  }
}

/** Tombol utama kartu, berubah sesuai konteks status */
function statusCta(c, esc) {
  const id = esc(c.id);
  switch (c.status) {
    case 'baru': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">📞 Hubungi</button>`;
    case 'dihubungi': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">💡 Tawarkan</button>`;
    case 'tertarik': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">⏳ Minta Verifikasi</button>`;
    case 'menunggu_verifikasi': return `<button type="button" class="btn btn-primary btn-sm" onclick="openClientById('${id}')">🔍 Verifikasi</button>`;
    case 'aktif': return `<button type="button" class="btn btn-primary btn-sm" onclick="openClientById('${id}')">⚙️ Kelola</button>`;
    case 'batal': return `<button type="button" class="btn btn-outline btn-sm" onclick="openClientById('${id}')">↩️ Pulihkan</button>`;
    default: return `<button type="button" class="btn btn-outline btn-sm" onclick="openClientById('${id}')">Buka</button>`;
  }
}

/** Update status pipeline klien (dipakai kanban drag & dropdown) */
async function updateClientStatus(id, status) {
  const prev = clients.find((c) => c.id === id);
  if (!prev) return;
  clients = clients.map((c) => c.id === id ? { ...c, status } : c);

  if (clientView === 'kelola') renderKanban(); else renderAnalytics();
  updateSidebarBadges({ clients: clients.length });

  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { status },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('Failed to update status');
    showToast(`Status → ${stageMeta(status).label.slice(2)}`, 1800, 'success');
  } catch (e) {
    clients = clients.map((c) => c.id === id ? prev : c);
    if (clientView === 'kelola') renderKanban(); else renderAnalytics();
    console.error(e);
    showToast('Gagal update status', 2000, 'error');
  }
}

/** Render all (stats + view aktif) */
function renderAll() {
  if (clientView === 'kelola') renderKanban();
  else renderAnalytics();
}

/** Render kanban — board kolom-per-stage dengan drag & drop */
function renderKanban() {
  const host = document.getElementById('kanbanBoard');
  if (!host) return;
  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const qNorm = (c) => [c.nama_warung, c.nama_pemilik, c.device_code, c.no_whatsapp, c.email, c.kabkota, c.provinsi, c.unit_id, c.serial]
    .some((v) => (v || '').toLowerCase().includes(q));
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    return q ? qNorm(c) : true;
  });

  if (!clients.length) {
    host.innerHTML = `<div class="empty-state">Belum ada klien. Data otomatis muncul di sini saat aplikasi klien pertama kali terhubung.</div>`;
    return;
  }

  // Header baris statistik ringkas (diatas board)
  const total = rows.length;
  const subtotalAll = rows.reduce((a, c) => a + (Number(c.harga) || 0), 0);
  const headStats = `
    <div class="kb-headstats">
      <span class="kb-headstat">🃏 <b>${total}</b> kartu</span>
      ${subtotalAll ? `<span class="kb-headstat">💰 <b>Rp ${subtotalAll.toLocaleString('id-ID')}</b> value</span>` : ''}
      ${rows.filter((c) => isActive(c)).length ? `<span class="kb-headstat">🟢 <b>${rows.filter((c) => isActive(c)).length}</b> aktif</span>` : ''}
    </div>`;

  // Board: 1 kolom per stage pipeline
  const columns = PIPELINE_STAGES.map((st, sIdx) => {
    const list = rows.filter((c) => c.status === st.key);
    const sub = list.reduce((a, c) => a + (Number(c.harga) || 0), 0);
    const cards = list.length
      ? list.map((c) => kanbanCardHtml(c)).join('')
      : `<div class="kb-drop-hint">Kosong — seret kartu ke sini</div>`;
    return `
      <div class="kb-col ${st.key === 'batal' ? 'kb-col-batal' : ''}" data-stage="${st.key}">
        <div class="kb-col-head">
          <span class="kb-col-label">${st.label}</span>
          <span class="badge ${st.tone}">${list.length}</span>
        </div>
        <div class="kb-col-sub">${sub ? 'Rp ' + sub.toLocaleString('id-ID') : '—'}</div>
        <div class="kb-col-list" data-stage="${st.key}">${cards}</div>
      </div>`;
  }).join('');

  host.innerHTML = headStats + `<div class="kb-board">${columns}</div>`;

  // Klik kartu / bukti / menu aksi
  host.querySelectorAll('.kb-bukti').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); const u = el.dataset.bukti; if (u) window.open(u, '_blank'); });
  });
  host.querySelectorAll('.kanban-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.kb-card-menu-pop')) return;
      const id = card.dataset.clientId;
      if (id) openClientById(id);
    });
  });
  host.querySelectorAll('.kb-menu-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleKbMenu(btn); });
  });

  // Inisialisasi drag & drop + tutup menu saat klik luar
  enableKanbanDnd(host);
  host.querySelectorAll('.kb-card-menu').forEach((m) => {
    // menu action delegation (Buka Detail / Pindah)
  });
  // one-time: tutup semua popup menu saat klik di luar board
  if (!window.__kbMenuCloseBound) {
    window.__kbMenuCloseBound = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.kb-card-menu-pop.open').forEach((p) => p.classList.remove('open'));
    });
  }
}

/** Toggle popup menu aksi kartu */
function toggleKbMenu(btn) {
  const card = btn.closest('.kanban-card');
  if (!card) return;
  const all = card.querySelectorAll('.kb-card-menu-pop');
  all.forEach((p) => p.classList.toggle('open'));
  // posisikan pop
  const pop = card.querySelector('.kb-card-menu-pop');
  if (pop && pop.classList.contains('open')) {
    const r = pop.getBoundingClientRect();
    if (r.right > window.innerWidth) pop.style.right = '0'; else pop.style.right = '';
  }
}
window.toggleKbMenu = toggleKbMenu;

/** Drag & drop kartu antar kolom stage */
function enableKanbanDnd(host) {
  let dragCard = null;
  host.querySelectorAll('.kanban-card[draggable]').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      dragCard = card;
      card.classList.add('dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      if (dragCard) dragCard.classList.remove('dragging');
      dragCard = null;
      host.querySelectorAll('.kb-col.drop-target').forEach((col) => col.classList.remove('drop-target'));
    });
  });
  host.querySelectorAll('.kb-col-list').forEach((list) => {
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const col = list.closest('.kb-col');
      if (col) col.classList.add('drop-target');
    });
    list.addEventListener('dragleave', (e) => {
      if (!list.contains(e.relatedTarget)) {
        const col = list.closest('.kb-col');
        if (col) col.classList.remove('drop-target');
      }
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const col = list.closest('.kb-col');
      if (col) col.classList.remove('drop-target');
      if (!dragCard) return;
      const id = dragCard.dataset.clientId;
      const stage = col.dataset.stage;
      if (id && stage) moveStage(id, stage);
    });
  });
}

function kanbanCardHtml(c) {
  const m = metaFor(c.app_type);
  const sm = stageMeta(c.status);
  const esc = escapeHtml;
  const wil = [c.desa, c.kecamatan, c.kabkota].filter(Boolean).join(', ');
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
  const isBatal = c.status === 'batal';
  const harga = Number(c.harga) || 0;
  const serial = c.serial ? String(c.serial) : '';
  // Progress posisi di pipeline (persen dari urutan stage)
  const progressPct = idx >= 0 ? Math.round(((idx + 0.5) / PIPELINE_STAGES.length) * 100) : 0;
  const contact = c.no_whatsapp
    ? `<span>💬${esc(c.no_whatsapp)}</span>`
    : (c.email ? `<span>✉️${esc(c.email)}</span>` : '');
  return `
    <div class="kanban-card ${statusAccent(c.status)}${isBatal ? ' kb-card-batal' : ''}" data-client-id="${esc(c.id)}" draggable="true">
      <div class="kb-progress" style="width:${progressPct}%"></div>
      <div class="kb-card-top">
        <span class="client-avatar">${m.icon}</span>
        <div class="kb-card-main">
          <strong class="kb-card-name">${esc(c.nama_warung || '—')}</strong>
          <small class="kb-card-sub">${esc(m.label)}${c.device_code ? ' · ' + esc(c.device_code) : ''}</small>
        </div>
      </div>
      ${c.source ? `<span class="badge tone-gray kb-card-src">${esc(c.source)}</span>` : ''}
      <div class="kb-card-meta">
        ${c.nama_pemilik ? `<span>👤${esc(c.nama_pemilik)}</span>` : ''}
        ${contact}
        ${wil ? `<span>📍${esc(wil)}</span>` : ''}
      </div>
      ${statusCtxHtml(c, esc)}
      <div class="kb-card-deal">
        <span class="kb-card-price">${harga ? '💰 Rp ' + harga.toLocaleString('id-ID') : '💰 —'}</span>
        ${serial ? `<span class="kb-card-serial">🔑 ${esc(serial.slice(0, 10))}…</span>` : `<span class="kb-card-age">🕑 ${formatLeadAge(c.first_seen)}</span>`}
      </div>
      <div class="kb-card-foot">
        <span class="text-xs kb-card-time">🕒 ${formatRelativeTime(c.last_seen)}</span>
        <div class="kb-card-actions">
          ${statusCta(c, esc)}
          <div class="kb-card-menu">
            <button type="button" class="btn btn-ghost btn-sm kb-menu-btn" title="Aksi lain" aria-label="Menu aksi">⋯</button>
            <div class="kb-card-menu-pop">
              <button type="button" data-act="open" onclick="openClientById('${esc(c.id)}')">👁️ Buka Detail</button>
              <button type="button" data-act="prev" ${idx <= 0 ? 'disabled' : ''} onclick="moveStage('${esc(c.id)}','prev')">⬅️ Status sebelumnya</button>
              <button type="button" data-act="next" ${idx < 0 || idx >= PIPELINE_STAGES.length - 1 ? 'disabled' : ''} onclick="moveStage('${esc(c.id)}','next')">➡️ Status berikutnya</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/** Umur lead dalam teks ramah (dari first_seen / created_at) */
function formatLeadAge(firstSeen) {
  const t = firstSeen ? new Date(firstSeen).getTime() : null;
  if (!t) return '—';
  const d = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  if (d === 0) return 'baru';
  if (d < 30) return d + ' hari';
  const mo = Math.floor(d / 30);
  return mo + ' bln';
}

/** Pindah kartu ke tahap lain — dir='prev'|'next' ATAU key stage langsung */
function moveStage(id, dir) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  let target;
  if (dir === 'next') {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
    if (idx < 0 || idx >= PIPELINE_STAGES.length - 1) return;
    target = PIPELINE_STAGES[idx + 1].key;
  } else if (dir === 'prev') {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
    if (idx <= 0) return;
    target = PIPELINE_STAGES[idx - 1].key;
  } else {
    // target stage key langsung (dari drag & drop)
    if (!PIPELINE_STAGES.some((s) => s.key === dir) || dir === c.status) return;
    target = dir;
  }
  updateClientStatus(id, target);
}
window.moveStage = moveStage;

/** Buka sheet dari kanban via id */
function openClientById(id) {
  const idx = clients.findIndex((c) => c.id === id);
  if (idx >= 0) openClient(idx);
}
window.openClientById = openClientById;

/** Load all clients from Supabase */
async function loadClients() {
  try {
    const res = await supabaseFetch('/rest/v1/clients?order=last_seen.desc');
    clients = res.ok ? (res.data || []) : [];
  } catch (e) {
    clients = [];
    console.error('load clients', e);
  }
  renderAll();
  updateSidebarBadges({ clients: clients.length });
  setState('clients', clients);
}
window.refreshClients = loadClients;

/** Render dashboard analitik khusus klien (view "Analitik") */
function renderAnalytics() {
  const host = document.getElementById('analyticsBody');
  if (!host) return;

  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    if (!q) return true;
    return [c.nama_warung, c.nama_pemilik, c.device_code, c.no_whatsapp, c.kabkota, c.provinsi]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  if (!rows.length) {
    host.innerHTML = `<div class="empty-state"><div class="empty-ic">📊</div><div class="empty-t">Belum ada data klien</div><div class="empty-d">Data analitik muncul saat klien pertama kali terhubung.</div></div>`;
    return;
  }

  const total = rows.length;
  const active = rows.filter(isActive).length;
  const aktifDeal = rows.filter((c) => c.status === 'aktif').length;
  const potensi = rows.reduce((a, c) => a + (Number(c.harga) || 0), 0);

  // Per status pipeline
  const perStatus = PIPELINE_STAGES.map((st) => {
    const list = rows.filter((c) => c.status === st.key);
    return { ...st, n: list.length, rev: list.reduce((a, c) => a + (Number(c.harga) || 0), 0) };
  });
  const maxStage = Math.max(1, ...perStatus.map((s) => s.n));

  // Per aplikasi
  const perApp = Object.entries(APP_META).map(([at, m]) => ({
    ...m, key: at, n: rows.filter((c) => c.app_type === at).length
  })).filter((x) => x.n > 0);
  const appTotal = perApp.reduce((a, x) => a + x.n, 0);
  const maxApp = Math.max(1, ...perApp.map((x) => x.n));

  // Sebaran wilayah (kabkota/provinsi)
  const wil = {};
  rows.forEach((c) => {
    const w = c.kabkota || c.provinsi;
    if (w) wil[w] = (wil[w] || 0) + 1;
  });
  const topWilayah = Object.entries(wil).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxWil = Math.max(1, ...topWilayah.map(([, n]) => n));

  const barStage = perStatus.filter((s) => s.n > 0).map((s) => `
    <div class="bar-row">
      <span class="bar-label">${s.label}</span>
      <div class="bar-track"><div class="bar-fill tone-${s.tone}" style="width:${(s.n / maxStage) * 100}%"></div></div>
      <span class="bar-num">${s.n}</span>
    </div>`).join('') || `<div class="text-xs" style="color:var(--text2)">Belum ada klien di pipeline ini.</div>`;

  const barApp = perApp.map((x) => `
    <div class="bar-row">
      <span class="bar-label">${x.icon} ${escapeHtml(x.label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(x.n / maxApp) * 100}%"></div></div>
      <span class="bar-num">${x.n}</span>
    </div>`).join('');

  const barWil = topWilayah.map(([w, n]) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(w)}</span>
      <div class="bar-track"><div class="bar-fill tone-teal" style="width:${(n / maxWil) * 100}%"></div></div>
      <span class="bar-num">${n}</span>
    </div>`).join('') || `<div class="text-xs" style="color:var(--text2)">Belum ada data wilayah.</div>`;

  host.innerHTML = `
    <div class="stat-grid" style="margin-bottom:var(--s5)">
      <div class="stat-card"><div class="stat-label">👥 Total Klien</div><div class="stat-value">${total}</div></div>
      <div class="stat-card"><div class="stat-label">✅ Aktif / Deal</div><div class="stat-value green">${aktifDeal}</div></div>
      <div class="stat-card"><div class="stat-label">🟢 Aktif 30 Hari</div><div class="stat-value green">${active}</div></div>
      <div class="stat-card"><div class="stat-label">💰 Potensial Revenue</div><div class="stat-value orange">Rp ${potensi.toLocaleString('id-ID')}</div></div>
    </div>

    <div class="an-grid">
      <div class="an-box">
        <h4 class="an-title">Pipeline per Status</h4>
        ${barStage}
      </div>
      <div class="an-box">
        <h4 class="an-title">Klien per Aplikasi</h4>
        ${barApp}
        <div class="text-xs" style="color:var(--text2);margin-top:var(--s3)">Total ${appTotal} klien</div>
      </div>
      <div class="an-box">
        <h4 class="an-title">Sebaran Wilayah</h4>
        ${barWil}
      </div>
    </div>
  `;
}

/** Open client detail (HALAMAN PENUH, bukan modal) */
export function openClient(i) {
  current = clients[i];
  if (!current) return;
  currentMeta = metaFor(current.app_type);
  const host = document.getElementById('clientDetailBody');
  if (!host) return;
  const board = document.getElementById('kanbanBoard');
  const head = document.getElementById('kanbanViewHead');
  host.hidden = false;
  if (board) board.hidden = true;
  if (head) head.hidden = true;
  const wilayah = [current.desa, current.kecamatan, current.kabkota, current.provinsi].filter(Boolean).join(', ');
  host.innerHTML = `
    <div class="panel-head cd-head">
      <div class="cd-title">
        <span class="client-avatar">${currentMeta.icon}</span>
        <div>
          <h3 class="panel-t">${escapeHtml(current.nama_warung || 'Klien')}</h3>
          <span class="panel-sub">${escapeHtml(currentMeta.label)}${current.device_code ? ' · ' + escapeHtml(current.device_code) : ''}</span>
        </div>
      </div>
      ${statusBadge(current.status)}
    </div>
    <div class="panel-body">

      <div class="section-label">📋 Data Klien</div>
      <div class="field-grid">
        <div class="field"><label class="field-label">Unit ID</label><input type="text" id="clUnitId" value="${escapeHtml(current.unit_id || '')}" readonly class="input-readonly"></div>
        <div class="field"><label class="field-label">Aplikasi</label><input type="text" value="${escapeHtml(currentMeta.label)}" readonly class="input-readonly"></div>
        <div class="field"><label class="field-label">Device Code</label><input type="text" id="clDevice" value="${escapeHtml(current.device_code || '')}" class="input-mono"></div>
        <div class="field"><label class="field-label">Nama Usaha</label><input type="text" id="clNama" value="${escapeHtml(current.nama_warung || '')}"></div>
        <div class="field"><label class="field-label">Nama Pemilik</label><input type="text" id="clOwner" value="${escapeHtml(current.nama_pemilik || '')}"></div>
        <div class="field"><label class="field-label">No. WhatsApp</label><input type="tel" id="clWa" value="${escapeHtml(current.no_whatsapp || '')}"></div>
        <div class="field field-span-2"><label class="field-label">Wilayah</label><input type="text" value="${escapeHtml(wilayah || '—')}" readonly class="input-readonly"></div>
        <div class="field field-span-2"><label class="field-label">Alamat Detail</label><input type="text" id="clAlamat" value="${escapeHtml(current.alamat_detail || '')}"></div>
      </div>

      <div class="section-label mt16">⚡ Generate Lisensi</div>
      <div class="field-grid mt8">
        <div class="field"><label class="field-label">Produk</label><input type="text" value="${escapeHtml(currentMeta.prefix || '—')} · ${escapeHtml(currentMeta.label)}" readonly class="input-readonly"></div>
        <div class="field"><label class="field-label">Masa Aktif</label>
          <select id="clDays">
            <option value="30">1 Bulan</option>
            <option value="90">3 Bulan</option>
            <option value="180">6 Bulan</option>
            <option value="365" selected>1 Tahun</option>
            <option value="730">2 Tahun</option>
            <option value="99">Seumur Hidup</option>
          </select>
        </div>
        <div class="field field-span-2"><label class="field-label">Hasil Serial</label>
          <textarea id="clSerialOut" readonly rows="2" class="input-mono" placeholder="Serial muncul di sini"></textarea>
          <div class="btn-block-row mt8">
            <button class="btn btn-primary" onclick="generateClientSerial()">🔑 Generate</button>
            <button class="btn btn-outline" onclick="copyClientSerial()">📋 Copy</button>
            <button class="btn btn-outline" onclick="sendClientSerialWA()">💬 Kirim WA</button>
          </div>
        </div>
      </div>

      <div class="section-label mt16">🔎 Verifikasi Serial</div>
      <div class="field-grid mt8">
        <div class="field field-span-2"><label class="field-label">Serial Number</label>
          <input type="text" id="clVerifySerial" class="input-mono" placeholder="Serial yang akan dicek" value="${escapeHtml(current.serial || '')}">
        </div>
        <div class="field field-span-2">
          <button class="btn btn-outline" onclick="verifyClientSerial()">✅ Verifikasi</button>
          <div id="clVerifyResult" class="verify-box mt8" hidden></div>
        </div>
      </div>

      <div class="btn-block-row mt16">
        <button class="btn btn-outline" onclick="backFromClient()">← Kembali</button>
        <button class="btn btn-primary" onclick="saveClient()">💾 Simpan</button>
        <button class="btn btn-danger" onclick="deleteClient()">🗑️ Hapus</button>
      </div>
    </div>
  `;
  // Detail tampil inline di dalam panel kanban (board & head disembunyikan di atas)
}

/** Kembali dari detail klien ke daftar/kanban */
window.backFromClient = function () {
  const board = document.getElementById('kanbanBoard');
  const head = document.getElementById('kanbanViewHead');
  const host = document.getElementById('clientDetailBody');
  if (host) host.hidden = true;
  if (head) head.hidden = false;
  if (board) {
    board.hidden = false;
    renderKanban();
  }
  document.body.style.overflow = '';
};

/** Alias lama — tetap dipakai saveClient/deleteClient */
window.closeClientSheet = window.backFromClient;

/** Generate serial untuk klien yang terbuka */
window.generateClientSerial = async function () {
  if (!current || !currentMeta?.prefix) {
    showToast('Produk klien ini belum dikenal / belum ada prefix', 2000, 'warning');
    return;
  }
  const rawDevice = document.getElementById('clDevice')?.value || current.device_code || '';
  if (!rawDevice) { showToast('Device Code kosong', 2000, 'warning'); return; }
  const days = parseInt(document.getElementById('clDays')?.value || '365', 10);
  let expCode = '99';
  if (days <= 30) expCode = '01';
  else if (days <= 90) expCode = '03';
  else if (days <= 180) expCode = '06';
  else if (days <= 365) expCode = '12';
  else if (days <= 730) expCode = '24';
  else if (days <= 1095) expCode = '36';
  else if (days <= 1825) expCode = '60';
  const res = await licenseApi('generate', {
    prefix: currentMeta.prefix,
    deviceCode: rawDevice,
    expCode
  });
  if (!res.ok) {
    const msg = res.data?.error || `Gagal generate (${res.status})`;
    showToast('Gagal membuat serial: ' + msg, 3000, 'error');
    return;
  }
  const serial = res.data.serial;
  const out = document.getElementById('clSerialOut');
  if (out) { out.value = serial; out.style.display = 'block'; }
  showToast('✅ Serial berhasil dibuat!', 2000, 'success');
};

/** Copy serial */
window.copyClientSerial = async function () {
  const v = document.getElementById('clSerialOut')?.value;
  if (!v) { showToast('Generate dulu', 2000, 'warning'); return; }
  try {
    await navigator.clipboard.writeText(v);
    showToast('Serial disalin', 2000, 'success');
  } catch { showToast('Gagal menyalin', 2000, 'error'); }
};

/** Verifikasi serial klien yang terbuka (server-side HMAC via /api/license) */
window.verifyClientSerial = async function () {
  if (!current || !currentMeta?.prefix) {
    showToast('Produk klien ini belum dikenal / belum ada prefix', 2000, 'warning');
    return;
  }
  const serial = document.getElementById('clVerifySerial')?.value?.trim();
  if (!serial) { showToast('Masukkan serial yang ingin diverifikasi', 2000, 'warning'); return; }
  const deviceCode = document.getElementById('clDevice')?.value?.trim() || current.device_code || '';
  if (!deviceCode) { showToast('Device Code kosong', 2000, 'warning'); return; }

  const res = await licenseApi('verify', {
    prefix: currentMeta.prefix,
    serial,
    deviceCode
  });
  const box = document.getElementById('clVerifyResult');
  if (!res.ok || !res.data) {
    const msg = res.data?.error || `Gagal verifikasi (${res.status})`;
    if (box) {
      box.innerHTML = `<div class="verify-badge error">❌ ERROR</div><div class="verify-detail">${escapeHtml(msg)}</div>`;
      box.className = 'verify-box mt8 error';
      box.hidden = false;
    }
    showToast('Error saat verifikasi: ' + msg, 3000, 'error');
    return;
  }
  const result = res.data;
  const productName = currentMeta.label;
  if (result.valid && !result.expired) {
    if (box) {
      box.innerHTML = `
        <div class="verify-badge success">✅ VALID</div>
        <div class="verify-detail">
          Produk: ${escapeHtml(productName)}<br>
          Device Code: ${escapeHtml(result.deviceCode)}<br>
          Masa Berlaku: ${escapeHtml(result.expiryText || formatExpiry(result.expCode))}<br>
          <small>Status: Aktif</small>
        </div>`;
      box.className = 'verify-box mt8 success';
      box.hidden = false;
    }
    showToast('Serial valid', 2000, 'success');
  } else if (result.valid && result.expired) {
    if (box) {
      box.innerHTML = `
        <div class="verify-badge warning">⚠️ KADALUARSA</div>
        <div class="verify-detail">
          Produk: ${escapeHtml(productName)}<br>
          Device Code: ${escapeHtml(result.deviceCode)}<br>
          Kadaluarsa: ${escapeHtml(result.expiryText || formatExpiry(result.expCode))}<br>
          <small>Serial valid tapi masa berlaku habis</small>
        </div>`;
      box.className = 'verify-box mt8 warning';
      box.hidden = false;
    }
    showToast('Serial kadaluarsa', 2500, 'warning');
  } else {
    if (box) {
      box.innerHTML = `
        <div class="verify-badge error">❌ TIDAK VALID</div>
        <div class="verify-detail">
          Serial tidak cocok dengan Device Code atau salt produk.<br>
          Periksa kembali input Anda.
        </div>`;
      box.className = 'verify-box mt8 error';
      box.hidden = false;
    }
    showToast('Serial tidak valid', 2000, 'error');
  }
};

/** Kirim serial ke WhatsApp merchant */
window.sendClientSerialWA = function () {
  const serial = document.getElementById('clSerialOut')?.value;
  if (!serial) { showToast('Generate dulu', 2000, 'warning'); return; }
  const nama = document.getElementById('clNama')?.value || current?.nama_warung || 'Usaha Anda';
  const text = `Halo *${nama}*,\nIni kode lisensi Kasir Solo Anda:\n\n*${serial}*\n\nAktifkan di aplikasi pada menu Lisensi. Terima kasih 🙏\n— PT Mesin Kasir Solo`;
  const wa = normalizePhone(document.getElementById('clWa')?.value || current?.no_whatsapp || '');
  const target = wa || '628816566935';
  window.open('https://wa.me/' + encodeURIComponent(target) + '?text=' + encodeURIComponent(text), '_blank');
};

/** Simpan perubahan data klien */
window.saveClient = async function () {
  if (!current) return;
  const id = current.id;
  const payload = {
    device_code:  (document.getElementById('clDevice')?.value || '').toUpperCase().trim(),
    nama_warung:  document.getElementById('clNama')?.value?.trim() || '',
    nama_pemilik: document.getElementById('clOwner')?.value?.trim() || '',
    no_whatsapp:  document.getElementById('clWa')?.value?.trim() || '',
    alamat_detail: document.getElementById('clAlamat')?.value?.trim() || ''
  };
  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: payload,
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error(String(res.status));
    showToast('✅ Klien disimpan', 2000, 'success');
    closeClientSheet();
    await loadClients();
  } catch (e) {
    console.error(e);
    showToast('Gagal menyimpan', 2000, 'error');
  }
};

/** Hapus klien (hati-hati) */
window.deleteClient = async function () {
  if (!current) return;
  if (!confirm('Hapus klien ini dari daftar?')) return;
  const id = current.id;
  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      showToast('Klien dihapus', 2000, 'success');
      closeClientSheet();
      await loadClients();
    } else throw new Error(String(r.status));
  } catch (e) {
    console.error(e);
    showToast('Gagal menghapus', 2000, 'error');
  }
};

// Wire openClient to window for inline onclick handlers
window.openClient = openClient;