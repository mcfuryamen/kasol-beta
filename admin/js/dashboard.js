/**
 * Admin Marketing KASIRSOLO — Dashboard Module
 * Overview stats, charts (Rosok-style stat grid)
 */

import { STATE, subscribe } from './app-state.js';
import { formatNumber, formatRupiah } from './utils.js';
import { showToast } from './toast.js';

let refreshBtn = null;

/**
 * Initialize dashboard
 */
export function initDashboard() {
  refreshBtn = document.getElementById('refreshBtn');
  refreshBtn?.addEventListener('click', refreshData);

  // Subscribe to state changes
  subscribe('leads', renderOverview);
  subscribe('stats', renderOverview);
  subscribe('catalog', renderOverview);
  subscribe('isLoading', (loading) => {
    if (refreshBtn) {
      refreshBtn.disabled = loading;
      refreshBtn.textContent = loading ? '⏳ Memuat...' : '🔄 Muat Ulang Data';
    }
  });

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

/**
 * Render overview stats and charts
 */
export function renderOverview() {
  const totalLeads = STATE.leads?.length || 0;
  const newLeads = STATE.leads?.filter(l => l.status === 'baru').length || 0;
  const contactedLeads = STATE.leads?.filter(l => l.status === 'dihubungi').length || 0;
  const interestedLeads = STATE.leads?.filter(l => l.status === 'tertarik').length || 0;
  const dealLeads = STATE.leads?.filter(l => l.status === 'deal').length || 0;
  const totalApps = STATE.catalog?.length || 0;
  const activeApps = STATE.catalog?.filter(c => c.active).length || 0;

  // Render KPI stat cards grid (Gerobak summary-card gradients)
  const container = document.getElementById('statCards');
  if (!container) return;

  // 6 KPI cards mengikuti pola kartu KPI gerobak (summary-card gradient)
  const conversionPct = totalLeads > 0 ? ((dealLeads / totalLeads) * 100) : 0;
  const potentialRevenue = STATE.stats?.potentialRevenue || 0;

  container.innerHTML = `
    <div class="summary-card brand">
      <div class="kpi-head"><span class="icon">👥</span><span class="label">Total Leads</span></div>
      <span class="value">${formatNumber(totalLeads)}</span>
    </div>
    <div class="summary-card green">
      <div class="kpi-head"><span class="icon">🤝</span><span class="label">Deal</span></div>
      <span class="value">${formatNumber(dealLeads)}</span>
    </div>
    <div class="summary-card teal">
      <div class="kpi-head"><span class="icon">📦</span><span class="label">Aplikasi Aktif</span></div>
      <span class="value">${formatNumber(activeApps)}<small style="font-size:13px;opacity:.8"> / ${formatNumber(totalApps)}</small></span>
    </div>
    <div class="summary-card purple">
      <div class="kpi-head"><span class="icon">💰</span><span class="label">Potensial Revenue</span></div>
      <span class="value" style="font-size:18px">${formatRupiah(potentialRevenue)}</span>
    </div>
    <div class="summary-card blue">
      <div class="kpi-head"><span class="icon">🆕</span><span class="label">Lead Baru</span></div>
      <span class="value">${formatNumber(newLeads)}</span>
    </div>
    <div class="summary-card red">
      <div class="kpi-head"><span class="icon">📈</span><span class="label">Konversi</span></div>
      <span class="value">${conversionPct.toFixed(1)}%</span>
    </div>
  `;

  // Leads by App chart
  renderLeadsByApp();

  // Leads by Status chart
  renderLeadsByStatus();

  // Recent activity
  renderRecentActivity();
}

/**
 * Render leads by app bar chart
 */
function renderLeadsByApp() {
  const container = document.getElementById('leadsByApp');
  if (!container) return;

  const byApp = {};
  STATE.leads?.forEach(l => {
    byApp[l.app] = (byApp[l.app] || 0) + 1;
  });

  const appEntries = Object.entries(byApp).sort((a, b) => b[1] - a[1]);
  const maxApp = Math.max(1, ...appEntries.map(e => e[1]));

  if (appEntries.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:20px;">Belum ada data leads.</p>';
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
 * Render leads by status bar chart
 */
function renderLeadsByStatus() {
  const container = document.getElementById('leadsByStatus');
  if (!container) return;

  const byStatus = {};
  STATE.leads?.forEach(l => {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  });

  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusEntries.map(e => e[1]));

  if (statusEntries.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:20px;">Belum ada data leads.</p>';
    return;
  }

  const statusLabels = {
    'baru': '🆕 Baru',
    'dihubungi': '📞 Dihubungi',
    'tertarik': '💡 Tertarik',
    'deal': '🤝 Deal',
    'batal': '❌ Batal'
  };

  container.innerHTML = statusEntries.map(([st, count]) => `
    <div class="bar-row">
      <span class="status-pill">${statusLabels[st] || st}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / maxStatus * 100).toFixed(0)}%"></div></div>
      <span class="bar-num">${count}</span>
    </div>
  `).join('');
}

/**
 * Render recent activity
 */
function renderRecentActivity() {
  const container = document.getElementById('recentActivityCard');
  if (!container) return;

  const recentLeads = (STATE.leads || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (recentLeads.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:24px;">
        <div class="ic">📋</div>
        <div class="t1">Belum ada aktivitas</div>
        <div class="t2">Aktivitas terbaru akan muncul di sini</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="compact-list">
      ${recentLeads.map(lead => `
        <div class="row-item" onclick="openLeadDetail('${escapeHtml(lead.id)}')">
          <div class="row-icon">${getStatusIcon(lead.status)}</div>
          <div class="row-body">
            <div class="row-title">${escapeHtml(lead.name)}</div>
            <div class="row-sub">${escapeHtml(lead.app || '—')} • ${formatDate(lead.createdAt)}</div>
          </div>
          <span class="badge ${getStatusBadgeClass(lead.status)}">${getStatusLabel(lead.status)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Get status icon emoji
 */
function getStatusIcon(status) {
  const icons = {
    'baru': '🆕',
    'dihubungi': '📞',
    'tertarik': '💡',
    'deal': '🤝',
    'batal': '❌'
  };
  return icons[status] || '📋';
}

/**
 * Get status badge class
 */
function getStatusBadgeClass(status) {
  const classes = {
    'baru': 'blue',
    'dihubungi': 'orange',
    'tertarik': 'green',
    'deal': 'green',
    'batal': 'red'
  };
  return classes[status] || 'blue';
}

/**
 * Get status label
 */
function getStatusLabel(status) {
  const labels = {
    'baru': 'Baru',
    'dihubungi': 'Dihubungi',
    'tertarik': 'Tertarik',
    'deal': 'Deal',
    'batal': 'Batal'
  };
  return labels[status] || status;
}

/**
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate string
 */
function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str || '';
  return str.slice(0, maxLength - 1) + '…';
}