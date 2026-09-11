/**
 * Control Center Kasir Solo — Dashboard Module
 * Overview stats, charts (Rosok-style stat grid)
 */

import { STATE, subscribe } from './app-state.js';
import { formatNumber, formatRupiah, escapeHtml, formatDate } from './utils.js';
import { showToast } from './toast.js';
// PENTING: pakai URL ber-versi yang SAMA dengan app.js — URL berbeda = instance
// modul terpisah, array `clients` di instance ini tidak pernah terisi.
import { stageMeta, renderAnalytics } from './clients.js?v=20260911c';
import { icon, plainLabel } from './icons.js';

/**
 * Initialize dashboard
 */
export function initDashboard() {
  // Subscribe to state changes
  subscribe('clients', renderOverview);
  subscribe('stats', renderOverview);
  subscribe('catalog', renderOverview);

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

/**
 * Render overview stats and charts
 */
export function renderOverview() {
  const clients = STATE.clients || [];
  const totalClients = clients.length;
  const baru = clients.filter(c => c.status === 'baru').length;
  const dihubungi = clients.filter(c => c.status === 'dihubungi').length;
  const tertarik = clients.filter(c => c.status === 'tertarik').length;
  const verifikasi = clients.filter(c => c.status === 'menunggu_verifikasi').length;
  const aktif = clients.filter(c => c.status === 'aktif').length;
  // Aktif 30 hari (dari modul Analitik yang digabung ke Dashboard)
  const aktif30 = clients.filter(c => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < 30 * 24 * 60 * 60 * 1000).length;
  const totalApps = STATE.catalog?.length || 0;
  // "visible" adalah field keaktifan katalog (dari Supabase). Default katalog tanpa
  // field visible dianggap aktif (visible !== false).
  const activeApps = STATE.catalog?.filter(c => c.visible !== false).length || 0;

  // Render KPI strip (compact — pengganti kartu gradien, audit ui-ux 2026-09-10)
  const container = document.getElementById('statCards');
  if (!container) return;

  const conversionPct = totalClients > 0 ? ((aktif / totalClients) * 100) : 0;
  // Hitung langsung dari data klien + harga katalog (sama dengan halaman Klien),
  // supaya tidak bergantung field STATE.stats yang tidak pernah diisi.
  const potentialRevenue = clients.reduce(
    (sum, c) => sum + (Number((STATE.catalog || []).find((p) => p.appType === c.app_type)?.price) || 0),
    0
  );

  const kpi = (ic, label, val, cls = '') => `
    <div class="kpi-cell">
      <span class="k-label">${icon(ic, 13)} ${escapeHtml(label)}</span>
      <span class="k-val ${cls}">${val}</span>
    </div>`;

  container.innerHTML = [
    kpi('users',    'Total Pipeline',       formatNumber(totalClients)),
    kpi('check-circle', 'Aktif / Deal',     formatNumber(aktif), aktif > 0 ? 'green' : ''),
    kpi('clock',    'Aktif 30 Hari',        formatNumber(aktif30), aktif30 > 0 ? 'green' : ''),
    kpi('package',  'Aplikasi Aktif',       `${formatNumber(activeApps)}<small> / ${formatNumber(totalApps)}</small>`),
    kpi('coins',    'Potensial Revenue',    formatRupiah(potentialRevenue), potentialRevenue > 0 ? 'orange' : ''),
    kpi('trending-up', 'Baru / Dihubungi',  formatNumber(baru + dihubungi)),
    kpi('percent',  'Konversi',             `${conversionPct.toFixed(1)}%`),
  ].join('');

  // Modul Analitik (chart pipeline/status/aplikasi/wilayah) — digabung ke Dashboard
  renderAnalytics();

  // Recent activity
  renderRecentActivity();
}

/**
 * Render recent activity (klien terakhir ter-update)
 */
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