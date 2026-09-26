/**
 * Control Center Kasir Solo — Dashboard Module
 * Papan komando: hero kampanye + funnel interaktif + fokus hari ini +
 * tile statistik + aktivitas. Semua angka dihitung dari data live
 * (clients CRM + kontak outreach + katalog), bukan field statis.
 */

import { STATE, subscribe } from './app-state.js';
import { formatNumber, formatRupiah, escapeHtml, formatDate } from './utils.js';
import { showToast } from './toast.js';
// PENTING: pakai URL ber-versi yang SAMA dengan app.js — URL berbeda = instance
// modul terpisah, array data di instance itu tidak pernah terisi.
import { stageMeta, renderAnalytics } from './clients.js?v=20260915a';
import { getOutreachContacts, OUTREACH_STAGES } from './outreach.js?v=20260915a';
import { icon, plainLabel } from './icons.js';

/**
 * Initialize dashboard
 */
export function initDashboard() {
  // Subscribe to state changes
  subscribe('clients', renderOverview);
  subscribe('stats', renderOverview);
  subscribe('catalog', renderOverview);

  // Kembali ke dashboard = segarkan bagian berbasis kontak outreach
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'dashboard') renderOverview();
  });
  // Data outreach selesai dimuat (bisa menyusul setelah render pertama)
  window.addEventListener('outreach:data', renderOverview);

  // Initial render
  renderOverview();
}

/**
 * Refresh all data
 */
async function refreshData() {
  const { refreshAll } = await import('./app-state.js');
  const { storage } = await import('./storage.js');
  const success = await refreshAll(storage);
  if (success) {
    showToast('Data diperbarui', 2000, 'success');
  } else {
    showToast('Gagal memuat data', 2000, 'error');
  }
}
window.refreshDashboard = refreshData;

/** Lompat ke Outreach dengan chip filter terpasang */
window.dbGoOutreach = function (chipKey = '') {
  window.setOutreachChip?.(chipKey);
  window.showScreen('outreach');
};

/** Render semua bagian papan komando */
export function renderOverview() {
  renderHero();
  renderFunnel();
  renderFocus();
  renderTiles();
  renderAnalytics();
  renderRecentActivity();
}

/* ================= HERO ================= */

function renderHero() {
  const host = document.getElementById('dbHero');
  if (!host) return;
  const oc = getOutreachContacts() || [];
  const count = (k) => oc.filter((c) => c.status === k).length;
  const belum = count('belum');
  const total = oc.length;
  const aktifLisensi = (STATE.clients || []).filter((c) => c.status === 'aktif').length;

  const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!total) {
    host.innerHTML = `
      <div class="db-hero-eyebrow">${escapeHtml(tgl)}</div>
      <div class="db-hero-big">Mulai kampanye klien lama</div>
      <div class="db-hero-sub">Impor CSV kontak lama, lalu proses 20–25 pesan per hari.</div>
      <button type="button" class="db-hero-cta" onclick="window.showScreen('outreach')">📥 Impor &amp; mulai</button>`;
    return;
  }

  host.innerHTML = `
    <div class="db-hero-eyebrow">${escapeHtml(tgl)} · Kampanye klien lama</div>
    <div class="db-hero-big">${formatNumber(belum)} <small>kontak belum dihubungi</small></div>
    <div class="db-hero-sub">${formatNumber(total - belum)} dari ${formatNumber(total)} sudah terproses · ritme ideal 20–25 pesan/hari</div>
    <div class="db-hero-row">
      <button type="button" class="db-hero-cta" onclick="dbGoOutreach('belum')">🚀 Mulai batch hari ini</button>
      <span class="db-hero-mini">Lisensi aktif <b>${formatNumber(aktifLisensi)}</b></span>
    </div>`;
}

/* ================= FUNNEL ================= */

function renderFunnel() {
  const host = document.getElementById('dbFunnel');
  if (!host) return;
  const oc = getOutreachContacts() || [];
  if (!oc.length) { host.innerHTML = ''; return; }

  const stages = OUTREACH_STAGES.filter((s) => s.key !== 'optout');
  const counts = stages.map((s) => ({ ...s, n: oc.filter((c) => c.status === s.key).length }));
  const total = oc.length || 1;
  const maxN = Math.max(...counts.map((c) => c.n), 1);

  const bar = counts.map((s) => `
    <i data-tone="${s.tone}" style="flex:${Math.max(s.n / maxN, 0.045)}"
       title="${escapeHtml(s.label)}: ${s.n}" role="button" tabindex="0"
       aria-label="${escapeHtml(s.label)} ${s.n}"
       onclick="dbGoOutreach('${s.key}')"></i>`).join('');

  const labels = counts.map((s) => `
    <button type="button" class="db-fn-label" onclick="dbGoOutreach('${s.key}')">
      <span class="db-fn-n">${formatNumber(s.n)}</span>
      <span class="db-fn-t">${escapeHtml(s.short)}</span>
    </button>`).join('');

  host.innerHTML = `
    <div class="db-fn-head">
      <span class="db-fn-title">Funnel Kampanye</span>
      <span class="db-fn-hint">tap tahap untuk buka</span>
    </div>
    <div class="db-fn-bar" role="group" aria-label="Funnel kampanye">${bar}</div>
    <div class="db-fn-labels">${labels}</div>`;
}

/* ================= FOKUS HARI INI ================= */

function renderFocus() {
  const host = document.getElementById('dbFocus');
  if (!host) return;
  const oc = getOutreachContacts() || [];
  const clients = STATE.clients || [];
  const count = (k) => oc.filter((c) => c.status === k).length;

  const items = [];
  const bales = count('bales');
  if (bales > 0) items.push({ ic: '💬', txt: `<b>${bales} kontak membalas</b> — perlu dibalas hari ini`, go: () => dbGoOutreach('bales') });
  const minat = count('minat');
  if (minat > 0) items.push({ ic: '🔥', txt: `<b>${minat} tertarik</b> — kirim harga &amp; tawaran`, go: () => dbGoOutreach('minat') });
  const baruCrm = clients.filter((c) => c.status === 'baru').length;
  if (baruCrm > 0) items.push({ ic: '🆕', txt: `<b>${baruCrm} lead baru dari aplikasi</b> — hubungi`, go: () => window.showScreen('klien') });
  const verif = clients.filter((c) => c.status === 'menunggu_verifikasi').length;
  if (verif > 0) items.push({ ic: '⏳', txt: `<b>${verif} pembayaran menunggu verifikasi</b>`, go: () => window.showScreen('klien') });
  const belum = count('belum');
  if (belum > 0 && items.length === 0) items.push({ ic: '🚀', txt: `Batch berikutnya: <b>${Math.min(belum, 25)} pesan</b> dari ${belum} kontak`, go: () => dbGoOutreach('belum') });
  if (!items.length) items.push({ ic: '✅', txt: 'Semua tuntas — kontak lama sudah terproses', go: () => dbGoOutreach('') });

  host.innerHTML = items.map((it, i) => `
    <div class="oc-row db-focus-row" role="button" tabindex="0" data-i="${i}">
      <div class="oc-ava">${it.ic}</div>
      <div class="oc-main"><div class="oc-name">${it.txt}</div></div>
      <div class="oc-side"><span class="oc-chev" aria-hidden="true">›</span></div>
    </div>`).join('');

  host.querySelectorAll('.db-focus-row').forEach((row) => {
    row.addEventListener('click', () => items[Number(row.dataset.i)]?.go());
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); items[Number(row.dataset.i)]?.go(); }
    });
  });
}

/* ================= TILES ================= */

function renderTiles() {
  const host = document.getElementById('dbTiles');
  if (!host) return;
  const clients = STATE.clients || [];
  const totalClients = clients.length;
  const aktif = clients.filter((c) => c.status === 'aktif').length;
  const aktif30 = clients.filter((c) => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < 30 * 24 * 60 * 60 * 1000).length;
  const potentialRevenue = clients.reduce(
    (sum, c) => sum + (Number((STATE.catalog || []).find((p) => p.appType === c.app_type)?.price) || 0), 0
  );
  const conv = totalClients ? ((aktif / totalClients) * 100).toFixed(1) : '0.0';

  const tile = (label, val, cls = '') => `
    <div class="db-tile">
      <span class="db-tile-l">${escapeHtml(label)}</span>
      <span class="db-tile-v ${cls}">${val}</span>
    </div>`;

  host.innerHTML = [
    tile('Lisensi Aktif', formatNumber(aktif), aktif > 0 ? 'green' : ''),
    tile('Aktif 30 Hari', formatNumber(aktif30), aktif30 > 0 ? 'green' : ''),
    tile('Potensial Revenue', formatRupiah(potentialRevenue), 'orange'),
    tile('Konversi', `${conv}%`),
  ].join('');
}

/* ================= AKTIVITAS ================= */

function renderRecentActivity() {
  const container = document.getElementById('recentActivityCard');
  if (!container) return;

  const recent = (STATE.clients || [])
    .slice()
    .sort((a, b) => new Date(b.last_seen || b.created_at) - new Date(a.last_seen || a.created_at))
    .slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('clipboard', 34)}</div>
        <div class="empty-title">Belum ada aktivitas</div>
        <div class="empty-desc">Aktivitas terbaru akan muncul di sini</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="compact-list">
      ${recent.map(c => `
        <div class="row-item" onclick="openClientAccordion('${escapeHtml(c.id)}')" data-open-client="${escapeHtml(c.id)}" role="button" tabindex="0">
          <span class="status-dot tone-${stageMeta(c.status).tone}" aria-hidden="true"></span>
          <div class="row-body">
            <div class="row-title">${escapeHtml(c.nama_usaha || c.nama_warung || '—')}</div>
            <div class="row-sub">${escapeHtml(c.app_type || '—')} • ${formatDate(c.last_seen || c.created_at)}</div>
          </div>
          <span class="badge ${stageMeta(c.status).tone}">${statusLabel(c.status)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Label status tanpa emoji (helper plainLabel — data stage tetap utuh)
 */
function statusLabel(status) {
  return plainLabel(stageMeta(status).label) || status;
}
