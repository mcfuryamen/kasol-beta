/**
 * Admin Marketing KASIRSOLO — Clients Module (CRM)
 * Manage client profiles synced from client apps (kaki5, rosok, etc.) to Supabase `clients` table
 * Can generate license directly from client card + send serial via WhatsApp
 * Analytics: total outlets, active 30 days, per app, geographic distribution
 */

import { getState, setState, subscribe } from './app-state.js';
import { getAll, put, getByKey, del } from './storage.js';
import { generateLicenseKeyV2, getProductMeta } from './license-core.js';
import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime, normalizePhone } from './utils.js';

const APP_META = {
  kaki5: { prefix: 'KK5', salt: 'KASIRSOLO-KAKI5-HMAC-V2', icon: '🛵', label: 'Kaki Lima' },
  rosok: { prefix: 'KSR', salt: 'KASIRSOLO-ROSOK-HMAC-V2', icon: '♻️', label: 'Rosok' },
  gerobak: { prefix: 'GBK', salt: 'KASIRSOLO-GEROBAK-HMAC-V2', icon: '🛒', label: 'Gerobak' },
  retail: { prefix: 'RTL', salt: 'KASIRSOLO-RETAIL-HMAC-V2', icon: '🏪', label: 'Retail' }
};

const DAYS = 30 * 24 * 60 * 60 * 1000;
const isActive = (c) => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < DAYS;

export async function initClients() {
  document.getElementById('clientsSearch')?.addEventListener('input', renderList);
  document.getElementById('clientsAppFilter')?.addEventListener('change', renderList);
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'klien') loadClients();
  });
  await loadClients();
}

let clients = [];

async function loadClients() {
  try {
    clients = await getAll('clients');
  } catch (e) {
    clients = [];
    console.error('load clients', e);
  }
  renderStats();
  renderList();
}

function renderStats() {
  const host = document.getElementById('clientStatCards');
  if (!host) return;
  const total = clients.length;
  const active = clients.filter(isActive).length;
  const byApp = {};
  clients.forEach((c) => {
    const m = APP_META[c.app_type] || { icon: '📦', label: c.app_type };
    byApp[m.icon + ' ' + m.label] = (byApp[m.icon + ' ' + m.label] || 0) + 1;
  });
  const appHtml = Object.entries(byApp).map(([k, v]) =>
    `<div class="stat-card"><div class="stat-label">${escapeHtml(k)}</div><div class="stat-value orange">${v}</div></div>`
  ).join('');

  host.innerHTML = `
    <div class="stat-card"><div class="stat-label">🛍️ Total Outlet</div><div class="stat-value">${total}</div></div>
    <div class="stat-card"><div class="stat-label">🟢 Aktif 30 Hari</div><div class="stat-value green">${active}</div></div>
    ${appHtml}
  `;
}

function renderList() {
  const host = document.getElementById('clientsList');
  const empty = document.getElementById('clientsEmpty');
  if (!host) return;

  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    if (q) {
      const hay = `${c.namaWarung} ${c.namaPemilik} ${c.noWhatsapp} ${c.unit_id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0));

  empty.hidden = rows.length > 0;
  host.innerHTML = rows.map(renderClientCard).join('');
}

function renderClientCard(c) {
  const meta = APP_META[c.app_type] || { icon: '📦', label: c.app_type };
  const active = isActive(c);
  const lastSeen = c.last_seen ? formatRelativeTime(c.last_seen) : 'Belum pernah';

  return `
    <article class="client-card" onclick="openClient('${c.id}')">
      <div class="client-card-head">
        <div class="client-avatar">${meta.icon}</div>
        <div class="client-main">
          <span class="client-name">${escapeHtml(c.namaWarung || '—')}</span>
          <span class="client-sub">${meta.icon} ${meta.label} · ${escapeHtml(c.namaPemilik || '—')}</span>
          <span class="client-status ${active ? 'on' : 'off'}" aria-label="${active ? 'Aktif' : 'Nonaktif'}"></span>
        </div>
      </div>
      <div class="client-meta">
        <span>🆔 ${escapeHtml(c.unit_id || '—')}</span>
        <span>📱 ${escapeHtml(c.noWhatsapp || '—')}</span>
        ${c.provinsi_nama ? `<span>📍 ${escapeHtml(c.provinsi_nama)}${c.kabkota_nama ? ', ' + escapeHtml(c.kabkota_nama) : ''}</span>` : ''}
        <span class="client-seen">Terakhir: ${lastSeen}</span>
      </div>
    </article>
  `;
}

window.openClient = function(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;
  const meta = APP_META[c.app_type] || { icon: '📦', label: c.app_type, prefix: '', salt: '' };
  current = c;
  currentMeta = meta;

  const sheet = document.getElementById('clientSheetBody');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>📇 ${escapeHtml(c.namaWarung || 'Tanpa Nama')}</span><span class="sheet-close" role="button" aria-label="Tutup" onclick="closeSheet('sheetClient')">✕</span></div>

    <div class="field-grid">
      <div class="field"><label class="field-label">Unit ID</label><input type="text" id="clUnitId" value="${escapeHtml(c.unit_id)}" readonly class="input-readonly"></div>
      <div class="field"><label class="field-label">Aplikasi</label><input type="text" value="${meta.icon} ${meta.label}" readonly class="input-readonly"></div>
      <div class="field"><label class="field-label">Device Code</label><input type="text" id="clDevice" value="${escapeHtml(c.device_code || c.unit_id?.split('-').slice(-1)[0] || '')}" class="input-mono"></div>
      <div class="field"><label class="field-label">Nama Usaha</label><input type="text" id="clNama" value="${escapeHtml(c.namaWarung || '')}"></div>
      <div class="field"><label class="field-label">Nama Pemilik</label><input type="text" id="clOwner" value="${escapeHtml(c.namaPemilik || '')}"></div>
      <div class="field"><label class="field-label">No. WhatsApp</label><input type="tel" id="clWa" value="${escapeHtml(c.noWhatsapp || '')}"></div>
      <div class="field field-span-2"><label class="field-label">Wilayah</label><input type="text" value="${[c.provinsi_nama, c.kabkota_nama, c.kecamatan_nama, c.kelurahan_nama].filter(Boolean).join(' > ') || '—'}" readonly class="input-readonly"></div>
      <div class="field field-span-2"><label class="field-label">Alamat Detail</label><input type="text" id="clAlamat" value="${escapeHtml(c.alamat_detail || '')}"></div>
    </div>

    <div class="section-label mt16">⚡ Generate Lisensi</div>
    <div class="field-grid mt8">
      <div class="field"><label class="field-label">Produk</label><input type="text" value="${meta.icon} ${meta.label} (${meta.prefix})" readonly class="input-readonly"></div>
      <div class="field"><label class="field-label">Masa Aktif</label>
        <select id="clDays">
          <option value="30">1 Bulan</option>
          <option value="90">3 Bulan</option>
          <option value="180">6 Bulan</option>
          <option value="365" selected>1 Tahun</option>
          <option value="730">2 Tahun</option>
          <option value="99">Seumur Hidup</option>
        </select>
      </div>
      <div class="field field-span-2"><label class="field-label">Hasil Serial</label>
        <textarea id="clSerialOut" readonly rows="2" class="input-mono" placeholder="Serial muncul di sini"></textarea>
        <div class="btn-block-row mt8">
          <button class="btn btn-primary" onclick="generateClientSerial()">🔑 Generate</button>
          <button class="btn btn-outline" onclick="copyClientSerial()">📋 Copy</button>
          <button class="btn btn-outline" onclick="sendClientSerialWA()">💬 Kirim WA</button>
        </div>
      </div>
    </div>

    <div class="btn-block-row mt16">
      <button class="btn btn-outline" onclick="closeSheet('sheetClient')">Tutup</button>
      <button class="btn btn-primary" onclick="saveClient()">💾 Simpan</button>
      <button class="btn btn-danger" onclick="deleteClient()">🗑️ Hapus</button>
    </div>
  `;

  document.getElementById('sheetClient').classList.add('open');
};

let current = null;
let currentMeta = null;

window.generateClientSerial = async function() {
  if (!current || !currentMeta) return;
  const days = parseInt(document.getElementById('clDays').value);
  const deviceCode = document.getElementById('clDevice').value.trim().toUpperCase();
  const ownerName = document.getElementById('clOwner').value.trim();
  const phone = document.getElementById('clWa').value.trim();

  if (!deviceCode) { showToast('Device Code wajib diisi', 2000, 'error'); return; }
  if (!ownerName) { showToast('Nama Pemilik wajib diisi', 2000, 'error'); return; }
  if (!phone) { showToast('No. WhatsApp wajib diisi', 2000, 'error'); return; }

  try {
    const serial = await generateLicenseKeyV2({
      product: current.app_type,
      deviceCode,
      ownerName,
      phone,
      days,
      maxDevices: 1,
      refCode: ''
    });
    document.getElementById('clSerialOut').value = serial;
  } catch (e) {
    showToast('Gagal generate serial', 2000, 'error');
  }
};

window.copyClientSerial = async function() {
  const out = document.getElementById('clSerialOut');
  if (out.value) {
    await navigator.clipboard.writeText(out.value);
    showToast('📋 Serial copied!', 2000, 'success');
  }
};

window.sendClientSerialWA = async function() {
  const serial = document.getElementById('clSerialOut').value;
  const phone = document.getElementById('clWa').value.trim();
  const name = document.getElementById('clOwner').value.trim() || 'Merchant';

  if (!serial) { showToast('Generate serial dulu', 2000, 'error'); return; }
  if (!phone) { showToast('No. WhatsApp kosong', 2000, 'error'); return; }

  const waPhone = normalizePhone(phone);
  const text = encodeURIComponent(`Halo ${name}, ini serial lisensi Anda:\n${serial}\n\nSimpan dengan baik. Terima kasih!`);
  window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank');
  showToast('💬 WhatsApp dibuka', 2000, 'success');
};

window.saveClient = async function() {
  if (!current) return;
  const updated = {
    ...current,
    device_code: document.getElementById('clDevice').value.trim().toUpperCase(),
    namaWarung: document.getElementById('clNama').value.trim(),
    namaPemilik: document.getElementById('clOwner').value.trim(),
    noWhatsapp: document.getElementById('clWa').value.trim(),
    alamat_detail: document.getElementById('clAlamat').value.trim(),
    updated_at: Date.now()
  };
  await put('clients', updated);
  showToast('✅ Klien disimpan', 2000, 'success');
  closeSheet('sheetClient');
  await loadClients();
};

window.deleteClient = async function() {
  if (!current) return;
  if (!confirm('Hapus klien ini dari daftar?')) return;
  await del('clients', current.id);
  showToast('Klien dihapus', 2000, 'success');
  closeSheet('sheetClient');
  await loadClients();
};