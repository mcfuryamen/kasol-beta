/**
 * Admin Console — Leads Module (Supabase)
 * SaaS data-table: search, filter, status, delete, CSV export.
 */

import { STATE, subscribe, setState } from './app-state.js';
import { formatDate, escapeHtml } from './utils.js';
import { showToast } from './toast.js';

let leadSearch, leadStatusFilter, leadsTbody, leadsEmpty, exportCsvBtn;

const getSupabaseConfig = () => ({
  url: window.SUPABASE_URL || 'https://hhywrvedlwljawgxzpkq.supabase.co',
  key: window.SUPABASE_SERVICE_KEY || ''
});

export async function initLeads() {
  leadSearch = document.getElementById('leadsSearch');
  leadStatusFilter = document.getElementById('leadsStatusFilter');
  leadsTbody = document.getElementById('leadsTbody');
  leadsEmpty = document.getElementById('leadsEmpty');
  exportCsvBtn = document.getElementById('exportCsvBtn');
  if (!leadsTbody) return;

  leadSearch?.addEventListener('input', debounce(renderLeads, 150));
  leadStatusFilter?.addEventListener('change', renderLeads);
  exportCsvBtn?.addEventListener('click', exportCSV);

  await loadLeads();
}

function debounce(fn, ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

async function loadLeads() {
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/leads?order=created_at.desc`, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    STATE.leads = r.ok ? await r.json() : [];
  } catch (e) { STATE.leads = []; showToast('Gagal memuat leads', 2000, 'error'); }
  renderLeads();
}

export function renderLeads() {
  if (!leadsTbody || !leadSearch || !leadStatusFilter) return;
  const search = leadSearch.value.toLowerCase().trim();
  const statusFilter = leadStatusFilter.value;

  const filtered = (STATE.leads || []).filter(l => {
    const matchSearch = !search ||
      (l.name||'').toLowerCase().includes(search) ||
      (l.wa||'').toLowerCase().includes(search) ||
      (l.address||'').toLowerCase().includes(search) ||
      (l.app_type||'').toLowerCase().includes(search) ||
      (l.email||'').toLowerCase().includes(search);
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (leadsEmpty) leadsEmpty.hidden = filtered.length > 0;

  leadsTbody.innerHTML = filtered.map(lead => `
    <tr>
      <td>
        <div class="cell-main">${escapeHtml(lead.name || '-')}</div>
        <div class="cell-sub">${escapeHtml(lead.address || '-')}</div>
        ${lead.email ? `<div class="cell-sub">${escapeHtml(lead.email)}</div>` : ''}
        <a class="wa-link" href="https://wa.me/${escapeHtml((lead.wa||'').replace(/[^0-9]/g,''))}" target="_blank" rel="noopener">${escapeHtml(lead.wa || '-')}</a>
      </td>
      <td><span class="tag-pill">${escapeHtml(lead.app_type || '-')}</span></td>
      <td class="muted">${escapeHtml(lead.source || '-')}</td>
      <td>
        <select class="status-select ${getStatusTone(lead.status)}" data-id="${escapeHtml(lead.id)}">
          ${['baru','dihubungi','tertarik','deal','batal'].map(s=>`<option value="${s}" ${s===lead.status?'selected':''}>${getStatusLabel(s)}</option>`).join('')}
        </select>
      </td>
      <td class="muted">${formatDate(lead.created_at)}</td>
      <td><button class="btn btn-danger btn-ghost btn-sm" data-del="${escapeHtml(lead.id)}">Hapus</button></td>
    </tr>
  `).join('');
  bindRowEvents();
}

function bindRowEvents() {
  if (!leadsTbody) return;
  leadsTbody.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const lead = (STATE.leads||[]).find(l => l.id === sel.dataset.id);
      if (lead) {
        lead.status = sel.value;
        const ok = await updateLeadStatus(lead.id, sel.value);
        showToast(ok ? 'Status diperbarui' : 'Gagal menyimpan', 2000, ok ? 'success' : 'error');
        if (!ok) renderLeads();
      }
    });
  });
  leadsTbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus lead ini?')) return;
      const ok = await deleteLead(btn.dataset.del);
      if (ok) { STATE.leads = (STATE.leads||[]).filter(l => l.id !== btn.dataset.del); renderLeads(); showToast('Lead dihapus', 2000, 'success'); }
      else showToast('Gagal menghapus', 2000, 'error');
    });
  });
}

async function updateLeadStatus(id, status) {
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
      method:'PATCH', headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},
      body: JSON.stringify({ status, updated_at: new Date().toISOString() })
    });
    return r.ok;
  } catch { return false; }
}

async function deleteLead(id) {
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, { method:'DELETE', headers:{apikey:key,Authorization:'Bearer '+key} });
    return r.ok || r.status === 204;
  } catch { return false; }
}

function exportCSV() {
  if (!STATE.leads?.length) { showToast('Belum ada leads', 2000, 'warning'); return; }
  const header = ['Nama','Alamat','WhatsApp','Email','Aplikasi','Sumber','Status','Tanggal'];
  const rows = STATE.leads.map(l => [l.name,l.address,l.wa,l.email,l.app_type,l.source,l.status,l.created_at]);
  const csv = [header,...rows].map(r => r.map(v=>`"${String(v||'').replace(/\"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV diunduh', 2000, 'success');
}

function getStatusLabel(s){return {baru:'Baru',dihubungi:'Dihubungi',tertarik:'Tertarik',deal:'Deal',batal:'Batal'}[s]||s;}
function getStatusTone(s){return {baru:'blue',dihubungi:'amber',tertarik:'green',deal:'green',batal:'red'}[s]||'blue';}

export function openLeadDetail(id) {
  const overlay = document.getElementById('sheetLeadDetail');
  const body = document.getElementById('leadDetailBody');
  if (!overlay || !body) return;
  const lead = (STATE.leads||[]).find(l => String(l.id) === String(id));
  body.innerHTML = lead ? `
    <div class="sheet-head"><h3>Detail Lead</h3><button class="sheet-x" onclick="closeSheet('sheetLeadDetail')">✕</button></div>
    ${[
      ['Nama / Bisnis', lead.name], ['Alamat', lead.address], ['WhatsApp', lead.wa],
      ['Email', lead.email], ['Aplikasi', lead.app_type], ['Sumber', lead.source],
      ['Status', getStatusLabel(lead.status)], ['Tanggal', formatDate(lead.created_at)]
    ].map(([k,v]) => `<div class="field"><label class="field-label">${k}</label><input class="input-mono" readonly value="${escapeHtml(v||'-')}"></div>`).join('')}
  ` : '<p class="muted">Lead tidak ditemukan.</p>';
  overlay.classList.add('open');
}

window.exportLeadsCSV = exportCSV;
window.openLeadDetail = openLeadDetail;
