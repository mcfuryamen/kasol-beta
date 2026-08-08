/**
 * Admin Marketing KASIRSOLO — Clients Module (CRM)
 * Menampilkan & mengelola profil klien yang tersinkron dari app klien (kaki5 dll)
 * ke tabel Supabase `clients`. Kartu klien bisa langsung GENERATE lisensi
 * (tanpa pindah ke menu Lisensi) + kirim serial ke WhatsApp merchant.
 * Analitik: total outlet, aktif 30 hari, per app, sebaran wilayah.
 *
 * Akses: service_role key (BYPASS RLS → bisa baca/ubah semua baris).
 */

import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime, normalizePhone } from './utils.js';
import * as LicenseCore from './license-core.js';

const getSupabaseConfig = () => ({
  url: window.SUPABASE_URL || 'https://hhywrvedlwljawgxzpkq.supabase.co',
  key: window.SUPABASE_SERVICE_KEY || ''
});

// app_type → produk (prefix & salt yang BENAR; serial ini yang diterima app klien)
const APP_META = {
  kaki5:  { prefix: 'KK5', salt: 'KASIRSOLO-KAKI5-HMAC-V2', icon: '🛵', label: 'Kaki Lima' },
  rosok:  { prefix: 'KSR', salt: 'KASIRSOLO-ROSOK-HMAC-V2', icon: '♻️', label: 'Rosok' },
  gerobak:{ prefix: 'GBK', salt: 'KASIRSOLO-GEROBAK-HMAC-V2', icon: '🛒', label: 'Gerobak' },
  retail: { prefix: 'RTL', salt: 'KASIRSOLO-RETAIL-HMAC-V2', icon: '🏪', label: 'Retail' }
};
const metaFor = (at) => APP_META[at] || { prefix: '', salt: '', icon: '📦', label: (at || 'Lain') };

let clients = [];
let current = null; // klien yang terbuka di sheet
let currentMeta = null;

const DAYS = 30 * 24 * 60 * 60 * 1000;
const isActive = (c) => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < DAYS;

/** Init module */
export async function initClients() {
  document.getElementById('clientsSearch')?.addEventListener('input', renderList);
  document.getElementById('clientsAppFilter')?.addEventListener('change', renderList);
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'klien') loadClients();
  });
  await loadClients();
}

/** Load all clients from Supabase */
async function loadClients() {
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/clients?order=last_seen.desc`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    clients = r.ok ? await r.json() : [];
  } catch (e) {
    clients = [];
    console.error('load clients', e);
  }
  renderStats();
  renderList();
}

/** Analitik / matrik klien */
function renderStats() {
  const host = document.getElementById('clientStatCards');
  if (!host) return;
  const total = clients.length;
  const active = clients.filter(isActive).length;
  const byApp = {};
  clients.forEach((c) => {
    const m = metaFor(c.app_type);
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

/** Render list klien (terfilter) */
function renderList() {
  const host = document.getElementById('clientsList');
  const empty = document.getElementById('clientsEmpty');
  if (!host) return;

  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    if (!q) return true;
    return [c.nama_warung, c.nama_pemilik, c.device_code, c.no_whatsapp, c.kabkota, c.provinsi]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  if (empty) empty.hidden = rows.length > 0;
  host.innerHTML = rows.map((c, i) => cardHtml(c, i)).join('');
  host.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', () => openClient(parseInt(el.dataset.open, 10)));
  });
}

function cardHtml(c, i) {
  const m = metaFor(c.app_type);
  const wilayah = [c.desa, c.kecamatan, c.kabkota, c.provinsi].filter(Boolean).join(', ');
  return `
    <div class="client-card" data-open="${i}" role="button" tabindex="0">
      <div class="client-card-head">
        <span class="client-avatar">${m.icon}</span>
        <div class="client-main">
          <strong class="client-name">${escapeHtml(c.nama_warung || '—')}</strong>
          <small class="client-sub">${escapeHtml(m.label)} · ${escapeHtml(c.device_code || '')}</small>
        </div>
        <span class="client-status ${isActive(c) ? 'on' : 'off'}">${isActive(c) ? '🟢' : '⚪'}</span>
      </div>
      <div class="client-meta">
        ${c.nama_pemilik ? `<span>👤 ${escapeHtml(c.nama_pemilik)}</span>` : ''}
        ${c.no_whatsapp ? `<span>💬 ${escapeHtml(c.no_whatsapp)}</span>` : ''}
        ${wilayah ? `<span>📍 ${escapeHtml(wilayah)}</span>` : ''}
        ${c.last_seen ? `<span class="client-seen">Terakhir: ${escapeHtml(formatRelativeTime(c.last_seen))}</span>` : ''}
      </div>
    </div>
  `;
}

/** Open client detail/license sheet */
export function openClient(i) {
  current = clients[i];
  if (!current) return;
  currentMeta = metaFor(current.app_type);
  const host = document.getElementById('clientSheetBody');
  if (!host) return;
  const wilayah = [current.desa, current.kecamatan, current.kabkota, current.provinsi].filter(Boolean).join(', ');
  host.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>${currentMeta.icon} ${escapeHtml(current.nama_warung || 'Klien')}</span><span class="sheet-close" role="button" aria-label="Tutup" onclick="closeSheet('sheetClient')">✕</span></div>

    <div class="field-grid">
      <div class="field"><label class="field-label">Unit ID</label><input type="text" id="clUnitId" value="${escapeHtml(current.unit_id || '')}" readonly class="input-readonly"></div>
      <div class="field"><label class="field-label">Aplikasi</label><input type="text" value="${escapeHtml(currentMeta.label)}" readonly class="input-readonly"></div>
      <div class="field"><label class="field-label">Device Code</label><input type="text" id="clDevice" value="${escapeHtml(current.device_code || '')}" class="input-mono"></div>
      <div class="field"><label class="field-label">Nama Usaha</label><input type="text" id="clNama" value="${escapeHtml(current.nama_warung || '')}"></div>
      <div class="field"><label class="field-label">Nama Pemilik</label><input type="text" id="clOwner" value="${escapeHtml(current.nama_pemilik || '')}"></div>
      <div class="field"><label class="field-label">No. WhatsApp</label><input type="tel" id="clWa" value="${escapeHtml(current.no_whatsapp || '')}"></div>
      <div class="field field-span-2"><label class="field-label">Wilayah</label><input type="text" value="${escapeHtml(wilayah || '—')}" readonly class="input-readonly"></div>
      <div class="field field-span-2"><label class="field-label">Alamat Detail</label><input type="text" id="clAlamat" value="${escapeHtml(current.alamat_detail || '')}"></div>
    </div>

    <div class="section-label mt16">⚡ Generate Lisensi</div>
    <div class="field-grid mt8">
      <div class="field"><label class="field-label">Produk</label><input type="text" value="${escapeHtml(currentMeta.prefix || '—')} · ${escapeHtml(currentMeta.label)}" readonly class="input-readonly"></div>
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
  document.getElementById('sheetClient')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

/** Generate serial untuk klien yang terbuka */
window.generateClientSerial = async function () {
  if (!current || !currentMeta?.prefix) {
    showToast('Produk klien ini belum dikenal / belum ada prefix', 2000, 'warning');
    return;
  }
  const rawDevice = document.getElementById('clDevice')?.value || current.device_code || '';
  if (!rawDevice) { showToast('Device Code kosong', 2000, 'warning'); return; }
  const days = parseInt(document.getElementById('clDays')?.value || '365', 10);
  let expCode = '99';
  if (days <= 30) expCode = '01';
  else if (days <= 90) expCode = '03';
  else if (days <= 180) expCode = '06';
  else if (days <= 365) expCode = '12';
  else if (days <= 730) expCode = '24';
  else if (days <= 1095) expCode = '36';
  else if (days <= 1825) expCode = '60';
  const serial = await LicenseCore.generateSerial(currentMeta.prefix, currentMeta.salt, rawDevice, expCode);
  const out = document.getElementById('clSerialOut');
  if (out) { out.value = serial; out.style.display = 'block'; }
  showToast('✅ Serial berhasil dibuat!', 2000, 'success');
};

/** Copy serial */
window.copyClientSerial = async function () {
  const v = document.getElementById('clSerialOut')?.value;
  if (!v) { showToast('Generate dulu', 2000, 'warning'); return; }
  try {
    await navigator.clipboard.writeText(v);
    showToast('Serial disalin', 2000, 'success');
  } catch { showToast('Gagal menyalin', 2000, 'error'); }
};

/** Kirim serial ke WhatsApp merchant */
window.sendClientSerialWA = function () {
  const serial = document.getElementById('clSerialOut')?.value;
  if (!serial) { showToast('Generate dulu', 2000, 'warning'); return; }
  const nama = document.getElementById('clNama')?.value || current?.nama_warung || 'Usaha Anda';
  const text = `Halo *${nama}*,\nIni kode lisensi Kasir Solo Anda:\n\n*${serial}*\n\nAktifkan di aplikasi pada menu Lisensi. Terima kasih 🙏\n— PT Mesin Kasir Solo`;
  const wa = normalizePhone(document.getElementById('clWa')?.value || current?.no_whatsapp || '');
  const target = wa || '628816566935';
  window.open('https://wa.me/' + encodeURIComponent(target) + '?text=' + encodeURIComponent(text), '_blank');
};

/** Simpan perubahan data klien */
window.saveClient = async function () {
  if (!current) return;
  const id = current.id;
  const payload = {
    device_code:  (document.getElementById('clDevice')?.value || '').toUpperCase().trim(),
    nama_warung:  document.getElementById('clNama')?.value?.trim() || '',
    nama_pemilik: document.getElementById('clOwner')?.value?.trim() || '',
    no_whatsapp:  document.getElementById('clWa')?.value?.trim() || '',
    alamat_detail: document.getElementById('clAlamat')?.value?.trim() || ''
  };
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(String(r.status));
    showToast('✅ Klien disimpan', 2000, 'success');
    closeSheet('sheetClient');
    await loadClients();
  } catch (e) {
    console.error(e);
    showToast('Gagal menyimpan', 2000, 'error');
  }
};

/** Hapus klien (hati-hati) */
window.deleteClient = async function () {
  if (!current) return;
  if (!confirm('Hapus klien ini dari daftar?')) return;
  const id = current.id;
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (r.ok || r.status === 204) {
      showToast('Klien dihapus', 2000, 'success');
      closeSheet('sheetClient');
      await loadClients();
    } else throw new Error(String(r.status));
  } catch (e) {
    console.error(e);
    showToast('Gagal menghapus', 2000, 'error');
  }
};