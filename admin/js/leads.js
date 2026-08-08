/**
 * Admin Marketing KASIRSOLO — Leads Module (Supabase)
 * Leads table, search, filter, status update, delete, export CSV
 * Data disimpan di Supabase tabel `leads` — service_role key (BYPASS RLS)
 */

import { STATE, subscribe, setState } from './app-state.js';
import { formatDate, escapeHtml } from './utils.js';
import { showToast } from './toast.js';

let leadSearch = null;
let leadStatusFilter = null;
let leadsTbody = null;
let leadsEmpty = null;
let exportCsvBtn = null;

// Supabase config — read from window at call time
const getSupabaseConfig = () => ({
  url: window.SUPABASE_URL || 'https://hhywrvedlwljawgxzpkq.supabase.co',
  key: window.SUPABASE_SERVICE_KEY || ''
});

/** Initialize leads module */
export async function initLeads() {
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

  // Initial load from Supabase
  await loadLeads();
}

/** Debounce helper */
function debounce(fn, ms) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/** Load all leads from Supabase */
async function loadLeads() {
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/leads?order=created_at.desc`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    STATE.leads = r.ok ? await r.json() : [];
  } catch (e) {
    STATE.leads = [];
    console.error('load leads', e);
    showToast('Gagal memuat leads dari Supabase', 2000, 'error');
  }
  renderLeads();
}

/** Render leads table */
export function renderLeads() {
  if (!leadsTbody || !leadSearch || !leadStatusFilter) return;

  const search = leadSearch.value.toLowerCase().trim();
  const statusFilter = leadStatusFilter.value;

  const filtered = (STATE.leads || []).filter(l => {
    const matchSearch = !search ||
      (l.name || '').toLowerCase().includes(search) ||
      (l.wa || '').toLowerCase().includes(search) ||
      (l.address || '').toLowerCase().includes(search) ||
      (l.app_type || '').toLowerCase().includes(search) ||
      (l.email || '').toLowerCase().includes(search);
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Update empty state
  if (leadsEmpty) {
    leadsEmpty.hidden = filtered.length ? true : false;
  }

  // Render rows
  leadsTbody.innerHTML = filtered.map(lead => `
    <tr>
      <td class="lead-contact">
        <b class="lead-name">${escapeHtml(lead.name || '-')}</b>
        <span class="lead-addr">${escapeHtml(lead.address || '-')}</span>
        ${lead.email ? `<span class="lead-email">${escapeHtml(lead.email)}</span>` : ''}
        <a class="wa-link" href="https://wa.me/${escapeHtml((lead.wa || '').replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">
          ${escapeHtml(lead.wa || '-')}
        </a>
      </td>
      <td class="lead-app">${escapeHtml(lead.app_type || '-')}</td>
      <td class="lead-source">${escapeHtml(lead.source || '-')}</td>
      <td>
        <select class="status-select" data-id="${escapeHtml(lead.id)}">
          ${['baru', 'dihubungi', 'tertarik', 'deal', 'batal'].map(s =>
            `<option value="${s}" ${s === lead.status ? 'selected' : ''}>${getStatusLabel(s)}</option>`
          ).join('')}
        </select>
      </td>
      <td class="lead-date">${formatDate(lead.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-danger" data-del="${escapeHtml(lead.id)}">Hapus</button>
      </td>
    </tr>
  `).join('');

  // Bind events
  bindRowEvents();
}

/** Bind events for status selects and delete buttons */
function bindRowEvents() {
  if (!leadsTbody) return;

  // Status change
  leadsTbody.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const lead = (STATE.leads || []).find(l => l.id === sel.dataset.id);
      if (lead) {
        lead.status = sel.value;
        const success = await updateLeadStatus(lead.id, sel.value);
        if (success) {
          showToast('Status lead diperbarui', 2000, 'success');
        } else {
          showToast('Gagal menyimpan ke Supabase', 2000, 'error');
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
      const success = await deleteLead(id);
      if (success) {
        STATE.leads = (STATE.leads || []).filter(l => l.id !== id);
        renderLeads();
        showToast('Lead dihapus', 2000, 'success');
      } else {
        showToast('Gagal menghapus dari Supabase', 2000, 'error');
      }
    });
  });
}

/** Update lead status in Supabase */
async function updateLeadStatus(id, status) {
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() })
    });
    return r.ok;
  } catch (e) {
    console.error('update lead status', e);
    return false;
  }
}

/** Delete lead from Supabase */
async function deleteLead(id) {
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    return r.ok || r.status === 204;
  } catch (e) {
    console.error('delete lead', e);
    return false;
  }
}

/** Export leads to CSV */
function exportCSV() {
  if (!STATE.leads?.length) {
    showToast('Belum ada leads untuk diekspor', 2000, 'warning');
    return;
  }

  const header = ['Nama', 'Alamat', 'WhatsApp', 'Email', 'Aplikasi', 'Sumber', 'Status', 'Tanggal Daftar'];
  const rows = STATE.leads.map(l => [
    l.name || '',
    l.address || '',
    l.wa || '',
    l.email || '',
    l.app_type || '',
    l.source || '',
    l.status || '',
    l.created_at || ''
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

/** Get status label for display */
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

/** Open lead detail sheet (dipanggil dari recent activity di dashboard) */
export function openLeadDetail(id) {
  const overlay = document.getElementById('sheetLeadDetail');
  const body = document.getElementById('leadDetailBody');
  if (!overlay || !body) return;

  const lead = (STATE.leads || []).find(l => String(l.id) === String(id));

  if (!lead) {
    body.innerHTML = '<p class="empty-state" hidden>Lead tidak ditemukan.</p>';
  } else {
    body.innerHTML = `
      <div class="field"><label class="field-label">Nama / Bisnis</label><input class="input-mono" readonly value="${escapeHtml(lead.name || '')}"></div>
      <div class="field"><label class="field-label">Alamat</label><input class="input-mono" readonly value="${escapeHtml(lead.address || '-')}"></div>
      <div class="field"><label class="field-label">WhatsApp</label><input class="input-mono" readonly value="${escapeHtml(lead.wa || '-')}"></div>
      <div class="field"><label class="field-label">Email</label><input class="input-mono" readonly value="${escapeHtml(lead.email || '-')}"></div>
      <div class="field"><label class="field-label">Aplikasi</label><input class="input-mono" readonly value="${escapeHtml(lead.app_type || '-')}"></div>
      <div class="field"><label class="field-label">Sumber</label><input class="input-mono" readonly value="${escapeHtml(lead.source || '-')}"></div>
      <div class="field"><label class="field-label">Status</label><input class="input-mono" readonly value="${escapeHtml(getStatusLabel(lead.status) || lead.status)}"></div>
      <div class="field"><label class="field-label">Tanggal Daftar</label><input class="input-mono" readonly value="${escapeHtml(formatDate(lead.created_at || '-'))}"></div>
      ${lead.notes ? `<div class="field field-span-2"><label class="field-label">Catatan</label><input class="input-mono" readonly value="${escapeHtml(lead.notes)}"></div>` : ''}
    `;
  }
  overlay.classList.add('open');
}

// Global aliases untuk inline onclick di index.html
window.exportLeadsCSV = exportCSV;
window.openLeadDetail = openLeadDetail;