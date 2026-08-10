/**
 * Admin Console — Dashboard Module
 * SaaS-style KPI cards + bar charts. State-driven render.
 */

import { STATE, subscribe } from './app-state.js';
import { formatNumber, formatRupiah, escapeHtml } from './utils.js';
import { showToast } from './toast.js';

let refreshBtn = null;

export function initDashboard() {
  refreshBtn = document.getElementById('refreshBtn');
  refreshBtn?.addEventListener('click', refreshData);

  subscribe('leads', renderOverview);
  subscribe('stats', renderOverview);
  subscribe('catalog', renderOverview);
  subscribe('clients', renderOverview);

  renderOverview();
}

async function refreshData() {
  const { refreshAll } = await import('./app-state.js');
  const { storage } = await import('./storage.js');
  const success = await refreshAll(storage);
  showToast(success ? 'Data diperbarui' : 'Gagal memuat data', 2000, success ? 'success' : 'error');
}

export function renderOverview() {
  const totalLeads = STATE.leads?.length || 0;
  const newLeads = STATE.leads?.filter(l => l.status === 'baru').length || 0;
  const dealLeads = STATE.leads?.filter(l => l.status === 'deal').length || 0;
  const totalApps = STATE.catalog?.length || 0;
  const activeApps = STATE.catalog?.filter(c => c.visible !== false).length || 0;
  const clients = STATE.clients?.length || 0;
  const activeClients = STATE.clients?.filter(c => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < 30*864e5).length || 0;
  const conversionPct = totalLeads > 0 ? ((dealLeads / totalLeads) * 100) : 0;
  const potentialRevenue = STATE.stats?.potentialRevenue || 0;

  const container = document.getElementById('statCards');
  if (!container) return;

  const cards = [
    { tone: 'brand',  icon: '◎', label: 'Total Leads',   value: formatNumber(totalLeads) },
    { tone: 'green',  icon: '✓', label: 'Deal',          value: formatNumber(dealLeads) },
    { tone: 'teal',   icon: '◧', label: 'App Aktif',     value: `${activeApps}<span class="kpi-sub">/ ${totalApps}</span>` },
    { tone: 'violet', icon: '◍', label: 'Klien',         value: `${clients}<span class="kpi-sub">${activeClients} aktif</span>` },
    { tone: 'gold',   icon: '⤴', label: 'Revenue Potensial', value: `<span class="kpi-sm">${formatRupiah(potentialRevenue)}</span>` },
    { tone: 'red',    icon: '⤢', label: 'Konversi',      value: `${conversionPct.toFixed(1)}<span class="kpi-sub">%</span>` },
  ];

  container.innerHTML = cards.map(c => `
    <div class="kpi-card kpi-${c.tone}">
      <div class="kpi-ic">${c.icon}</div>
      <div class="kpi-body">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${c.value}</div>
      </div>
    </div>
  `).join('');

  renderLeadsByApp();
  renderLeadsByStatus();
  renderRecentActivity();

  // Sidebar counts
  const sc = document.getElementById('sideCountLeads'); if (sc) sc.textContent = totalLeads;
  const cc = document.getElementById('sideCountClients'); if (cc) cc.textContent = clients;
  const ac = document.getElementById('sideCountCatalog'); if (ac) ac.textContent = totalApps;
}

function renderLeadsByApp() {
  const container = document.getElementById('leadsByApp');
  if (!container) return;
  const byApp = {};
  (STATE.leads || []).forEach(l => { byApp[l.app_type] = (byApp[l.app_type] || 0) + 1; });
  const entries = Object.entries(byApp).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { container.innerHTML = '<p class="muted">Belum ada data.</p>'; return; }
  const max = Math.max(1, ...entries.map(e => e[1]));
  container.innerHTML = entries.map(([app, count]) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(app)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count/max*100).toFixed(0)}%"></div></div>
      <span class="bar-num">${count}</span>
    </div>`).join('');
}

function renderLeadsByStatus() {
  const container = document.getElementById('leadsByStatus');
  if (!container) return;
  const byStatus = {};
  (STATE.leads || []).forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
  const labels = { baru:'Baru', dihubungi:'Dihubungi', tertarik:'Tertarik', deal:'Deal', batal:'Batal' };
  const entries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { container.innerHTML = '<p class="muted">Belum ada data.</p>'; return; }
  const max = Math.max(1, ...entries.map(e => e[1]));
  container.innerHTML = entries.map(([st, count]) => `
    <div class="bar-row">
      <span class="bar-label">${labels[st] || st}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count/max*100).toFixed(0)}%"></div></div>
      <span class="bar-num">${count}</span>
    </div>`).join('');
}

function renderRecentActivity() {
  const container = document.getElementById('recentActivityCard');
  if (!container) return;
  const recent = (STATE.leads || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  if (!recent.length) { container.innerHTML = '<p class="muted">Belum ada aktivitas.</p>'; return; }
  container.innerHTML = `<div class="feed">${recent.map(l => `
    <div class="feed-item" onclick="openLeadDetail('${escapeHtml(l.id)}')">
      <span class="feed-ic ${getStatusTone(l.status)}">${getStatusIcon(l.status)}</span>
      <div class="feed-body">
        <div class="feed-title">${escapeHtml(l.name)}</div>
        <div class="feed-sub">${escapeHtml(l.app_type || '—')} · ${formatDate(l.created_at)}</div>
      </div>
      <span class="feed-badge ${getStatusTone(l.status)}">${getStatusLabel(l.status)}</span>
    </div>`).join('')}</div>`;
}

function getStatusIcon(s){return {baru:'✉',dihubungi:'☎',tertarik:'✦',deal:'✓',batal:'✕'}[s]||'•';}
function getStatusTone(s){return {baru:'blue',dihubungi:'amber',tertarik:'green',deal:'green',batal:'red'}[s]||'blue';}
function getStatusLabel(s){return {baru:'Baru',dihubungi:'Dihubungi',tertarik:'Tertarik',deal:'Deal',batal:'Batal'}[s]||s;}
function formatDate(d){if(!d)return '—';return new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}
