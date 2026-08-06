/**
 * Admin Marketing KASIRSOLO — Leads Module
 * Leads table, search, filter, status update, delete, export CSV
 */

import { STATE, subscribe, setState } from './app-state.js';
import { storage } from './storage.js';
import { formatDate, escapeHtml } from './utils.js';
import { showToast } from './toast.js';

let leadSearch = null;
let leadStatusFilter = null;
let leadsTbody = null;
let leadsEmpty = null;
let exportCsvBtn = null;

/**
 * Initialize leads module
 */
export function initLeads() {
  leadSearch = document.getElementById('leadsSearch');
  leadStatusFilter = document.getElementById('leadsStatusFilter');
  leadsTbody = document.getElementById('leadsTbody');
  leadsEmpty = document.getElementById('leadsEmpty');
  exportCsvBtn = document.getElementById('exportCsvBtn');

  if (!leadsTbody) return;

  // Event listeners
  leadSearch?.addEventListener('input', debounce(renderLeads, 150));
  leadStatusFilter?.addEventListener('change', renderLeads);
  exportCsvBtn?.addEventListener('click', exportCSV);

  // Subscribe to leads changes
  subscribe('leads', renderLeads);

  // Initial render
  renderLeads();
}

/**
 * Debounce helper
 */
function debounce(fn, ms) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Render leads table
 */
export function renderLeads() {
  if (!leadsTbody || !leadSearch || !leadStatusFilter) return;

  const search = leadSearch.value.toLowerCase().trim();
  const statusFilter = leadStatusFilter.value;

  const filtered = (STATE.leads || []).filter(l => {
    const matchSearch = !search ||
      (l.name || '').toLowerCase().includes(search) ||
      (l.wa || '').toLowerCase().includes(search) ||
      (l.address || '').toLowerCase().includes(search) ||
      (l.app || '').toLowerCase().includes(search);
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Update empty state
  if (leadsEmpty) {
    leadsEmpty.style.display = filtered.length ? 'none' : 'block';
  }

  // Render rows
  leadsTbody.innerHTML = filtered.map(lead => `
    <tr>
      <td class="lead-contact">
        <b class="lead-name">${escapeHtml(lead.name || '-')}</b>
        <span class="lead-addr">${escapeHtml(lead.address || '-')}</span>
        <a class="wa-link" href="https://wa.me/${escapeHtml((lead.wa || '').replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">
          ${escapeHtml(lead.wa || '-')}
        </a>
      </td>
      <td class="lead-app">${escapeHtml(lead.app || '-')}</td>
      <td>
        <select class="status-select" data-id="${escapeHtml(lead.id)}">
          ${['baru', 'dihubungi', 'tertarik', 'deal', 'batal'].map(s =>
            `<option ${s === lead.status ? 'selected' : ''}>${getStatusLabel(s)}</option>`
          ).join('')}
        </select>
      </td>
      <td class="lead-date">${formatDate(lead.createdAt)}</td>
      <td>
        <button class="btn btn-sm btn-danger" data-del="${escapeHtml(lead.id)}">Hapus</button>
      </td>
    </tr>
  `).join('');

  // Bind events
  bindRowEvents();
}

/**
 * Bind events for status selects and delete buttons
 */
function bindRowEvents() {
  if (!leadsTbody) return;

  // Status change
  leadsTbody.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const lead = (STATE.leads || []).find(l => l.id === sel.dataset.id);
      if (lead) {
        lead.status = sel.value;
        const success = await storage.set('leads', STATE.leads);
        if (success) {
          setState('leads', STATE.leads);
          showToast('Status lead diperbarui', 2000, 'success');
        } else {
          showToast('Gagal menyimpan', 2000, 'error');
          renderLeads(); // Revert
        }
      }
    });
  });

  // Delete
  leadsTbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus lead ini?')) return;
      const id = btn.dataset.del;
      STATE.leads = (STATE.leads || []).filter(l => l.id !== id);
      const success = await storage.set('leads', STATE.leads);
      if (success) {
        setState('leads', STATE.leads);
        showToast('Lead dihapus', 2000, 'success');
      } else {
        showToast('Gagal menghapus', 2000, 'error');
        renderLeads(); // Revert
      }
    });
  });
}

/**
 * Export leads to CSV
 */
function exportCSV() {
  if (!STATE.leads?.length) {
    showToast('Belum ada leads untuk diekspor', 2000, 'warning');
    return;
  }

  const header = ['Nama', 'Alamat', 'WhatsApp', 'Aplikasi', 'Status', 'Tanggal Daftar'];
  const rows = STATE.leads.map(l => [
    l.name || '',
    l.address || '',
    l.wa || '',
    l.app || '',
    l.status || '',
    l.createdAt || ''
  ]);

  const csv = [header, ...rows].map(r =>
    r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-kasirsolo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('CSV berhasil diunduh', 2000, 'success');
}

/**
 * Get status label for display
 */
function getStatusLabel(status) {
  const labels = {
    'baru': '🆕 Baru',
    'dihubungi': '📞 Dihubungi',
    'tertarik': '💡 Tertarik',
    'deal': '🤝 Deal',
    'batal': '❌ Batal'
  };
  return labels[status] || status;
}