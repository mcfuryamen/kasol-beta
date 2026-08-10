/**
 * Admin Marketing KASIRSOLO — Dashboard Module
 * Renders KPI stats, charts, and recent activity
 */

import { getState, setState, subscribe } from './app-state.js';
import { getAll, count } from './storage.js';
import { escapeHtml, formatRelativeTime } from './utils.js';

export async function initDashboard() {
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'dashboard') renderDashboard();
  });
  await renderDashboard();
}

async function renderDashboard() {
  await Promise.all([
    renderStatCards(),
    renderLeadsByApp(),
    renderRecentActivity()
  ]);
}

async function renderStatCards() {
  const host = document.getElementById('statCards');
  if (!host) return;

  const [products, serials, clients, leads] = await Promise.all([
    count('products'),
    count('serials'),
    count('clients'),
    count('leads')
  ]);

  // Active clients (seen in last 30 days)
  const allClients = await getAll('clients');
  const activeClients = allClients.filter(c => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < 30 * 24 * 60 * 60 * 1000).length;

  // Active licenses (not expired)
  const allSerials = await getAll('serials');
  const activeSerials = allSerials.filter(s => s.expiresAt && Date.now() < s.expiresAt).length;

  host.innerHTML = `
    <div class="summary-card brand"><div class="kpi-head"><span class="icon">👥</span><span class="label">Total Leads</span></div><div class="value">${leads.toLocaleString('id-ID')}</div></div>
    <div class="summary-card green"><div class="kpi-head"><span class="icon">💰</span><span class="label">Total Revenue</span></div><div class="value">Rp ${estimateRevenue(allSerials).toLocaleString('id-ID')}</div></div>
    <div class="summary-card blue"><div class="kpi-head"><span class="icon">📦</span><span class="label">Katalog Aktif</span></div><div class="value">${products}</div></div>
    <div class="summary-card teal"><div class="kpi-head"><span class="icon">📇</span><span class="label">Total Klien</span></div><div class="value">${clients}</div></div>
    <div class="summary-card purple"><div class="kpi-head"><span class="icon">🔐</span><span class="label">Lisensi Aktif</span></div><div class="value">${activeSerials}</div></div>
    <div class="summary-card red"><div class="kpi-head"><span class="icon">⚠️</span><span class="label">Perlu Tindakan</span></div><div class="value">${allSerials.filter(s => s.expiresAt && Date.now() > s.expiresAt).length}</div></div>
  `;
}

function estimateRevenue(serials) {
  // Estimate based on product prices * active licenses
  const prices = { kaki5: 250000, rosok: 350000, gerobak: 300000, retail: 500000 };
  return serials.reduce((sum, s) => sum + (prices[s.product] || 0), 0);
}

async function renderLeadsByApp() {
  const host = document.getElementById('leadsByApp');
  if (!host) return;

  const leads = await getAll('leads');
  const byApp = {};
  leads.forEach(l => {
    byApp[l.app_type] = (byApp[l.app_type] || 0) + 1;
  });

  const meta = {
    kaki5: { icon: '🛵', label: 'Kaki Lima', color: 'orange' },
    rosok: { icon: '♻️', label: 'Rosok', color: 'green' },
    gerobak: { icon: '🛒', label: 'Gerobak', color: 'blue' },
    retail: { icon: '🏪', label: 'Retail', color: 'red' }
  };

  host.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
      ${Object.entries(meta).map(([key, m]) => `
        <div class="stat-card">
          <div class="stat-icon ${m.color}">${m.icon}</div>
          <div class="stat-value">${byApp[key] || 0}</div>
          <div class="stat-label">${m.label}</div>
          <div class="stat-trend ${(byApp[key] || 0) > 0 ? 'up' : ''}">${(byApp[key] || 0) > 0 ? '↑ Aktif' : '—'}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderRecentActivity() {
  const host = document.getElementById('recentActivityCard');
  if (!host) return;

  const [serials, leads, clients] = await Promise.all([
    getAll('serials'),
    getAll('leads'),
    getAll('clients')
  ]);

  // Build activity timeline
  const activities = [];

  serials.slice(0, 5).forEach(s => {
    activities.push({
      time: s.createdAt,
      type: 'license',
      title: 'Lisensi dibuat',
      detail: `${s.serial} (${s.product})`,
      status: s.status
    });
  });

  leads.slice(0, 5).forEach(l => {
    activities.push({
      time: l.created_at,
      type: 'lead',
      title: 'Lead baru',
      detail: `${l.nama} (${l.app_type})`,
      status: l.status
    });
  });

  clients.slice(0, 3).forEach(c => {
    if (c.updated_at) {
      activities.push({
        time: c.updated_at,
        type: 'client',
        title: 'Klien diupdate',
        detail: `${c.namaWarung} (${c.app_type})`,
        status: 'synced'
      });
    }
  });

  // Sort by time desc
  activities.sort((a, b) => (b.time || 0) - (a.time || 0));

  const statusBadges = {
    active: 'badge-aktif',
    expired: 'badge-expired',
    pending: 'badge-pending',
    baru: 'badge-baru',
    dihubungi: 'badge-dihubungi',
    tertarik: 'badge-tertarik',
    deal: 'badge-deal',
    batal: 'badge-batal',
    synced: 'badge-deal'
  };

  host.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Waktu</th><th>Aktivitas</th><th>Detail</th><th>Status</th></tr></thead>
        <tbody>
          ${activities.slice(0, 10).map(a => `
            <tr>
              <td>${formatRelativeTime(a.time)}</td>
              <td>${escapeHtml(a.title)}</td>
              <td>${escapeHtml(a.detail)}</td>
              <td><span class="badge ${statusBadges[a.status] || 'badge-baru'}">${escapeHtml(a.status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}