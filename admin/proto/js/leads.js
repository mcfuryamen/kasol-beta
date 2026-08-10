/**
 * Admin Marketing KASIRSOLO — Leads Module
 * Manage leads from landing page
 */

import { getState, setState, subscribe } from './app-state.js';
import { getAll, put, getByKey, del } from './storage.js';
import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime } from './utils.js';

const STATUS_BADGES = {
  baru: 'badge-baru',
  dihubungi: 'badge-dihubungi',
  tertarik: 'badge-tertarik',
  deal: 'badge-deal',
  batal: 'badge-batal'
};

const STATUS_LABELS = {
  baru: 'Baru',
  dihubungi: 'Dihubungi',
  tertarik: 'Tertarik',
  deal: 'Deal',
  batal: 'Batal'
};

export async function initLeads() {
  document.getElementById('leadsSearch')?.addEventListener('input', renderLeads);
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'leads') renderLeads();
  });
  await renderLeads();
}

async function renderLeads() {
  const body = document.getElementById('leadsBody');
  const empty = document.getElementById('leadsEmpty');
  const q = (document.getElementById('leadsSearch')?.value || '').toLowerCase();

  let leads = await getAll('leads');
  leads = leads.filter(l => {
    if (!q) return true;
    const hay = `${l.nama} ${l.telepon} ${l.alamat} ${l.app_type}`.toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  empty.hidden = leads.length > 0;
  body.innerHTML = leads.map(renderLeadRow).join('');
}

function renderLeadRow(l) {
  const meta = getAppMeta(l.app_type);
  const badgeClass = STATUS_BADGES[l.status] || 'badge-baru';
  const statusLabel = STATUS_LABELS[l.status] || l.status;
  const time = formatRelativeTime(l.created_at);

  return `
    <tr data-id="${l.id}">
      <td>
        <div class="lead-contact">
          <span class="lead-name">${escapeHtml(l.nama)}</span>
          <span class="lead-addr">${escapeHtml(l.alamat || 'Alamat tidak tersedia')}</span>
          <a href="https://wa.me/${l.telepon.replace(/\D/g,'')}" class="wa-link" target="_blank">${l.telepon}</a>
        </div>
      </td>
      <td><span class="badge ${badgeClass}">${meta.icon} ${meta.label}</span></td>
      <td><span class="badge ${badgeClass} compact">${statusLabel}</span></td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="openLeadDetail('${l.id}')" style="min-width:auto;padding:6px 10px;">Detail</button>
        <button class="btn btn-sm btn-ghost" onclick="updateLeadStatus('${l.id}')" style="min-width:auto;padding:6px 10px;">Status</button>
      </td>
    </tr>
  `;
}

function getAppMeta(appType) {
  const metas = {
    kaki5: { icon: '🛵', label: 'Kaki Lima' },
    rosok: { icon: '♻️', label: 'Rosok' },
    gerobak: { icon: '🛒', label: 'Gerobak' },
    retail: { icon: '🏪', label: 'Retail' }
  };
  return metas[appType] || { icon: '📦', label: appType };
}

window.openLeadDetail = async function(id) {
  const leads = await getAll('leads');
  const l = leads.find(x => x.id === id);
  if (!l) return;

  const meta = getAppMeta(l.app_type);
  const badgeClass = STATUS_BADGES[l.status] || 'badge-baru';
  const statusLabel = STATUS_LABELS[l.status] || l.status;

  const sheet = document.getElementById('leadDetailBody');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>👤 Detail Lead: ${escapeHtml(l.nama)}</span><span class="sheet-close" role="button" aria-label="Tutup" onclick="closeSheet('sheetLeadDetail')">✕</span></div>
    <div class="field-grid">
      <div class="field"><label class="field-label">Nama</label><input type="text" id="ldNama" value="${escapeHtml(l.nama)}"></div>
      <div class="field"><label class="field-label">Telepon</label><input type="tel" id="ldPhone" value="${escapeHtml(l.telepon)}"></div>
      <div class="field field-span-2"><label class="field-label">Alamat</label><input type="text" id="ldAlamat" value="${escapeHtml(l.alamat || '')}"></div>
      <div class="field"><label class="field-label">Aplikasi</label><input type="text" value="${meta.icon} ${meta.label}" readonly class="input-readonly"></div>
      <div class="field"><label class="field-label">Status</label>
        <select id="ldStatus">
          ${Object.entries(STATUS_LABELS).map(([v, lbl]) => `<option value="${v}" ${v === l.status ? 'selected' : ''}>${lbl}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label class="field-label">Dibuat</label><input type="text" value="${formatRelativeTime(l.created_at)}" readonly class="input-readonly"></div>
    </div>
    <div class="btn-block-row mt16">
      <button class="btn btn-outline" onclick="closeSheet('sheetLeadDetail')">Tutup</button>
      <button class="btn btn-danger" onclick="deleteLead('${l.id}')">🗑️ Hapus</button>
      <button class="btn btn-primary" onclick="saveLead('${l.id}')">💾 Simpan</button>
    </div>
  `;
  document.getElementById('sheetLeadDetail').classList.add('open');
};

window.saveLead = async function(id) {
  const leads = await getAll('leads');
  const l = leads.find(x => x.id === id);
  if (!l) return;

  const updated = {
    ...l,
    nama: document.getElementById('ldNama').value.trim(),
    telepon: document.getElementById('ldPhone').value.trim(),
    alamat: document.getElementById('ldAlamat').value.trim(),
    status: document.getElementById('ldStatus').value,
    updated_at: Date.now()
  };
  await put('leads', updated);
  showToast('✅ Lead disimpan', 2000, 'success');
  closeSheet('sheetLeadDetail');
  renderLeads();
};

window.deleteLead = async function(id) {
  if (!confirm('Hapus lead ini?')) return;
  await del('leads', id);
  showToast('Lead dihapus', 2000, 'success');
  closeSheet('sheetLeadDetail');
  renderLeads();
};

window.updateLeadStatus = async function(id) {
  const leads = await getAll('leads');
  const l = leads.find(x => x.id === id);
  if (!l) return;

  const statuses = Object.keys(STATUS_LABELS);
  const currentIdx = statuses.indexOf(l.status);
  const nextStatus = statuses[(currentIdx + 1) % statuses.length];

  l.status = nextStatus;
  l.updated_at = Date.now();
  await put('leads', l);
  showToast(`Status: ${STATUS_LABELS[nextStatus]}`, 2000, 'success');
  renderLeads();
};