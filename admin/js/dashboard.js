/**
 * Admin Marketing KASIRSOLO — Dashboard Module
 * Overview stats, charts (Rosok-style stat grid)
 */

import { STATE, subscribe } from './app-state.js';
import { formatNumber, formatRupiah, escapeHtml, formatDate, truncate } from './utils.js';
import { showToast } from './toast.js';
import { stageMeta } from './clients.js';

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
  const totalApps = STATE.catalog?.length || 0;
  // "visible" adalah field keaktifan katalog (dari Supabase). Default katalog tanpa
  // field visible dianggap aktif (visible !== false).
  const activeApps = STATE.catalog?.filter(c => c.visible !== false).length || 0;

  // Render KPI stat cards grid (Gerobak summary-card gradients)
  const container = document.getElementById('statCards');
  if (!container) return;

  const conversionPct = totalClients > 0 ? ((aktif / totalClients) * 100) : 0;
  // Hitung langsung dari data klien + harga katalog (sama dengan halaman Klien),
  // supaya tidak bergantung field STATE.stats yang tidak pernah diisi.
  const potentialRevenue = clients.reduce(
    (sum, c) => sum + (Number((STATE.catalog || []).find((p) => p.appType === c.app_type)?.price) || 0),
    0
  );

  container.innerHTML = `
    <div class="summary-card brand">
      <div class="kpi-head"><span class="icon">👥</span><span class="label">Total Pipeline</span></div>
      <span class="value">${formatNumber(totalClients)}</span>
    </div>
    <div class="summary-card green">
      <div class="kpi-head"><span class="icon">✅</span><span class="label">Aktif / Deal</span></div>
      <span class="value">${formatNumber(aktif)}</span>
    </div>
    <div class="summary-card teal">
      <div class="kpi-head"><span class="icon">📦</span><span class="label">Aplikasi Aktif</span></div>
      <span class="value">${formatNumber(activeApps)}<small class="text-xs" style="opacity:.8"> / ${formatNumber(totalApps)}</small></span>
    </div>
    <div class="summary-card purple">
      <div class="kpi-head"><span class="icon">💰</span><span class="label">Potensial Revenue</span></div>
      <span class="value" style="font-size:18px">${formatRupiah(potentialRevenue)}</span>
    </div>
    <div class="summary-card blue">
      <div class="kpi-head"><span class="icon">🆕</span><span class="label">Baru / Dihubungi</span></div>
      <span class="value">${formatNumber(baru + dihubungi)}</span>
    </div>
    <div class="summary-card red">
      <div class="kpi-head"><span class="icon">📈</span><span class="label">Konversi</span></div>
      <span class="value">${conversionPct.toFixed(1)}%</span>
    </div>
  `;

  // Pipeline by App chart
  renderClientsByApp();

  // Pipeline by Status chart
  renderClientsByStatus();

  // Recent activity
  renderRecentActivity();
}

/**
 * Render clients by app bar chart
 */
function renderClientsByApp() {
  const container = document.getElementById('leadsByApp');
  if (!container) return;

  const byApp = {};
  (STATE.clients || []).forEach(c => {
    const key = c.app_type || 'lain';
    byApp[key] = (byApp[key] || 0) + 1;
  });

  const appEntries = Object.entries(byApp).sort((a, b) => b[1] - a[1]);
  const maxApp = Math.max(1, ...appEntries.map(e => e[1]));

  if (appEntries.length === 0) {
    container.innerHTML = '<p class="empty-state" hidden>Belum ada data pipeline.</p>';
    return;
  }

  container.innerHTML = appEntries.map(([app, count]) => `
    <div class="bar-row">
      <span title="${escapeHtml(app)}">${truncate(app, 22)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / maxApp * 100).toFixed(0)}%"></div></div>
      <span class="bar-num">${count}</span>
    </div>
  `).join('');
}

/**
 * Render clients by status bar chart
 */
function renderClientsByStatus() {
  const container = document.getElementById('leadsByStatus');
  if (!container) return;

  const byStatus = {};
  (STATE.clients || []).forEach(c => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  });

  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusEntries.map(e => e[1]));

  if (statusEntries.length === 0) {
    container.innerHTML = '<p class="empty-state" hidden>Belum ada data pipeline.</p>';
    return;
  }

  container.innerHTML = statusEntries.map(([st, count]) => `
    <div class="bar-row">
      <span class="status-pill">${stageMeta(st).label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / maxStatus * 100).toFixed(0)}%"></div></div>
      <span class="bar-num">${count}</span>
    </div>
  `).join('');
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
      <div class="empty-state" hidden>
        <div class="empty-icon">📋</div>
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
          <div class="row-icon">${statusIcon(c.status)}</div>
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
 * Ikon emoji status (diambil dari label PIPELINE_STAGES di clients.js)
 */
function statusIcon(status) {
  return stageMeta(status).label.split(' ')[0] || '📋';
}

/**
 * Label status tanpa emoji (diambil dari PIPELINE_STAGES di clients.js)
 */
function statusLabel(status) {
  const parts = stageMeta(status).label.split(' ');
  parts.shift();
  return parts.join(' ') || status;
}