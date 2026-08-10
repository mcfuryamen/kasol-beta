/**
 * Admin Marketing KASIRSOLO — Clients Module (CRM)
 * Menampilkan & mengelola profil klien yang tersinkron dari app klien (kaki5 dll)
 * ke tabel Supabase `clients`. Kartu klien bisa langsung GENERATE lisensi
 * (tanpa pindah ke menu Lisensi) + kirim serial ke WhatsApp merchant.
 * Analitik: total outlet, aktif 30 hari, per app, sebaran wilayah.
 *
 * Akses: semua data lewat supabaseFetch() → Vercel Serverless /api/rest
 * (service_role key hanya server-side, tidak pernah di browser).
 */

import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime, formatDate, normalizePhone, debounce } from './utils.js';
import { STATE, setState } from './app-state.js';
import * as LicenseCore from './license-core.js';
import { supabaseFetch } from './api.js';
import { updateSidebarBadges } from './navigation.js';

// app_type → produk (prefix & salt yang BENAR; serial ini yang diterima app klien)
export const APP_META = {
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

  // Tab Klien (Outlet / Leads)
  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchKlienTab(btn.dataset.tab));
    // Aksesibilitas: navigasi tab keyboard (Arrow/Home/End)
    btn.addEventListener('keydown', (e) => {
      const tabs = Array.from(document.querySelectorAll('.tab-btn[data-tab]'));
      const i = tabs.indexOf(btn);
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        next.focus();
        next.click();
      }
    });
  });

  // Leads — digabung ke dalam modul Klien (satu layar)
  setUpLeads();

  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'klien') { loadClients(); loadLeads(); }
  });
  await loadClients();
  loadLeads();
}

/** Toggle tab Outlet / Leads / Pembelian di layar Klien */
function switchKlienTab(tab) {
  const showOutlet = tab === 'outlet';
  const showPembelian = tab === 'pembelian';
  const on = document.getElementById('tabOutlet');
  const pb = document.getElementById('tabPembelian');
  const ln = document.getElementById('tabLeads');
  const bOn = document.getElementById('tabBtnOutlet');
  const bPb = document.getElementById('tabBtnPembelian');
  const bLn = document.getElementById('tabBtnLeads');
  if (on) on.hidden = !showOutlet;
  if (pb) pb.hidden = !showPembelian;
  if (ln) ln.hidden = tab !== 'leads';
  if (bOn) { bOn.classList.toggle('active', showOutlet); bOn.setAttribute('aria-selected', String(showOutlet)); }
  if (bPb) { bPb.classList.toggle('active', showPembelian); bPb.setAttribute('aria-selected', String(showPembelian)); }
  if (bLn) { bLn.classList.toggle('active', tab === 'leads'); bLn.setAttribute('aria-selected', String(tab === 'leads')); }
  // muat ulang leads tiap kali tab dibuka biar selalu segar
  if (tab === 'pembelian') loadPembelianList();
  if (!showOutlet) loadLeads();
}
window.switchKlienTab = switchKlienTab;

/** @type {Array} pembelian — shared state, di-declare di sini supaya ga conflict dgn pembelian.js */
let pembelian = [];

/** Load pembelian list dari Supabase */
async function loadPembelianList() {
  try {
    const res = await supabaseFetch('/rest/v1/pembelian?order=created_at.desc&limit=100');
    pembelian = res.ok ? (res.data || []) : [];
    renderPembelianList();
  } catch (e) {
    pembelian = [];
    console.error('load pembelian', e);
  }
}

/** Render list pembelian */
function renderPembelianList() {
  const host = document.getElementById('pembelianList');
  const empty = document.getElementById('pembelianEmpty');
  if (!host) return;
  
  const filter = document.getElementById('pembelianStatusFilter')?.value || '';
  const filtered = pembelian.filter(p => {
    if (!filter) return true;
    return p.status === filter;
  });
  
  if (empty) empty.hidden = filtered.length > 0;
  
  if (filtered.length === 0) {
    host.innerHTML = '';
    return;
  }
  
  host.innerHTML = filtered.map((p, i) => pembelianCardHtml(p)).join('');
  
  // Bind events
  host.querySelectorAll('.btn-verify').forEach(btn => {
    btn.addEventListener('click', () => verifyPembelian(btn.dataset.id));
  });
  host.querySelectorAll('.btn-activate').forEach(btn => {
    btn.addEventListener('click', () => activatePembelian(btn.dataset.id));
  });
  host.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', () => rejectPembelian(btn.dataset.id));
  });
  host.querySelectorAll('.btn-view-bukti').forEach(btn => {
    btn.addEventListener('click', () => viewBukti(btn.dataset.url));
  });
}

/** HTML card pembelian */
function pembelianCardHtml(p) {
  const statusBadge = {
    'menunggu_verifikasi': '<span class="badge orange">⏳ Menunggu</span>',
    'aktif': '<span class="badge green">✅ Aktif</span>',
    'ditolak': '<span class="badge red">❌ Ditolak</span>'
  }[p.status] || `<span class="badge">${p.status}</span>`;
  
  const buktiBtn = p.bukti_url 
    ? `<button class="btn btn-ghost btn-sm btn-view-bukti" data-url="${p.bukti_url}">👁️ Lihat Bukti</button>`
    : '<span class="hint">Belum ada bukti</span>';
  
  const actionBtns = p.status === 'menunggu_verifikasi' ? `
    <button class="btn btn-primary btn-sm btn-verify" data-id="${p.id}">✓ Verifikasi</button>
    <button class="btn btn-danger btn-sm btn-reject" data-id="${p.id}">✗ Tolak</button>
  ` : '';
  
  return `
    <div class="pembelian-card" style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <div>
          <strong>${p.unit_id || '—'}</strong>
          <span style="color:var(--text2);font-size:12px;margin-left:8px">${p.app_type || '?'} · ${new Date(p.created_at).toLocaleDateString('id-ID')}</span>
        </div>
        ${statusBadge}
      </div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px">
        <div>Harga: ${p.harga ? 'Rp ' + Number(p.harga).toLocaleString('id-ID') : '—'}</div>
        <div>Serial: <code style="font-family:monospace">${p.serial || '—'}</code></div>
      </div>
      <div style="margin-bottom:8px">${buktiBtn}</div>
      <div style="display:flex;gap:8px">${actionBtns}</div>
    </div>
  `;
}

/** Verifikasi pembelian */
async function verifyPembelian(id) {
  try {
    const res = await supabaseFetch(`/rest/v1/pembelian?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: {
        status: 'verified',
        verified_at: new Date().toISOString()
      },
      headers: { Prefer: 'return=representation' }
    });
    
    if (!res.ok) throw new Error('Failed to verify');
    
    showToast('✅ Pembelian diverifikasi!', 2000, 'success');
    await loadPembelianList();
  } catch (e) {
    console.error(e);
    showToast('Gagal memverifikasi', 2000, 'error');
  }
}

/** Aktifkan lisensi via Edge Function */
async function activatePembelian(id) {
  const p = pembelian.find(x => x.id === id);
  if (!p) return;

  showToast('⏳ Mengaktifkan lisensi...', 3000, 'info');
  
  try {
    // Call edge function via proxy (service key server-side)
    const res = await supabaseFetch('/functions/v1/activate-license', {
      method: 'POST',
      data: {
        unit_id: p.unit_id,
        app_type: p.app_type,
        device_code: p.device_code || ''
      }
    });
    
    const data = res.data;
    
    if (!res.ok || !data?.ok) throw new Error((data && data.error) || 'Activation failed');
    
    showToast(`✅ Lisensi aktif! Serial: ${data.serial}`, 3000, 'success');
    await loadPembelianList();
  } catch (e) {
    console.error(e);
    showToast('Gagal mengaktifkan: ' + e.message, 3000, 'error');
  }
}

/** Tolak pembelian */
async function rejectPembelian(id) {
  if (!confirm('Tolak pembelian ini? User akan diminta upload ulang bukti.')) return;
  
  try {
    const res = await supabaseFetch(`/rest/v1/pembelian?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: {
        status: 'ditolak',
        verified_at: new Date().toISOString()
      },
      headers: { Prefer: 'return=representation' }
    });
    
    if (!res.ok) throw new Error('Failed to reject');
    
    showToast('❌ Pembelian ditolak', 2000, 'warning');
    await loadPembelianList();
  } catch (e) {
    console.error(e);
    showToast('Gagal menolak', 2000, 'error');
  }
}

/** Preview bukti pembayaran */
function viewBukti(url) {
  if (!url) return;
  window.open(url, '_blank');
}

/** Load all clients from Supabase */
async function loadClients() {
  try {
    const res = await supabaseFetch('/rest/v1/clients?order=last_seen.desc');
    clients = res.ok ? (res.data || []) : [];
  } catch (e) {
    clients = [];
    console.error('load clients', e);
  }
  renderStats();
  renderList();
  updateSidebarBadges({ clients: clients.length });
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
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openClient(parseInt(el.dataset.open, 10));
      }
    });
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
    <div class="sheet-title"><span>${currentMeta.icon} ${escapeHtml(current.nama_warung || 'Klien')}</span><span class="sheet-close" role="button" aria-label="Tutup" onclick="closeClientSheet()">✕</span></div>

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
      <button class="btn btn-outline" onclick="closeClientSheet()">Tutup</button>
      <button class="btn btn-primary" onclick="saveClient()">💾 Simpan</button>
      <button class="btn btn-danger" onclick="deleteClient()">🗑️ Hapus</button>
    </div>
  `;
  document.getElementById('sheetClient')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/** Tutup sheet Klien + pulihkan scroll (dipakai ✕, Tutup, backdrop, simpan/hapus) */
window.closeClientSheet = function () {
  document.getElementById('sheetClient')?.classList.remove('open');
  document.body.style.overflow = '';
};

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
  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: payload,
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error(String(res.status));
    showToast('✅ Klien disimpan', 2000, 'success');
    closeClientSheet();
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
  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      showToast('Klien dihapus', 2000, 'success');
      closeClientSheet();
      await loadClients();
    } else throw new Error(String(r.status));
  } catch (e) {
    console.error(e);
    showToast('Gagal menghapus', 2000, 'error');
  }
};

// ==================== LEADS (digabung ke dalam modul Klien) ====================
let leadsTbody = null;
let leadsSearch = null;
let leadsStatusFilter = null;
let leadsEmpty = null;

function setUpLeads() {
  leadsTbody = document.getElementById('leadsTbody');
  leadsSearch = document.getElementById('leadsSearch');
  leadsStatusFilter = document.getElementById('leadsStatusFilter');
  leadsEmpty = document.getElementById('leadsEmpty');
  leadsSearch?.addEventListener('input', debounce(renderLeadsTable, 150));
  leadsStatusFilter?.addEventListener('change', renderLeadsTable);
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportLeadsCSV);
}

/** Muat leads dari Supabase dan isi STATE.leads (dipakai dashboard juga) */
async function loadLeads() {
  try {
    const res = await supabaseFetch('/rest/v1/leads?order=created_at.desc');
    setState('leads', res.ok ? (res.data || []) : []);
  } catch (e) {
    console.error('load leads', e);
    setState('leads', []);
  }
  renderLeadsTable();
}

/** Render tabel leads (dari STATE.leads) */
function renderLeadsTable() {
  if (!leadsTbody) return;
  const search = (leadsSearch?.value || '').toLowerCase().trim();
  const statusFilter = leadsStatusFilter?.value || '';

  const filtered = (STATE.leads || []).filter((l) => {
    const ms = !search ||
      (l.name || '').toLowerCase().includes(search) ||
      (l.wa || '').toLowerCase().includes(search) ||
      (l.address || '').toLowerCase().includes(search) ||
      (l.app_type || '').toLowerCase().includes(search) ||
      (l.email || '').toLowerCase().includes(search);
    return ms && (!statusFilter || l.status === statusFilter);
  });

  if (leadsEmpty) leadsEmpty.hidden = filtered.length > 0;

  leadsTbody.innerHTML = filtered.map((lead) => `
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
          ${['baru', 'dihubungi', 'tertarik', 'deal', 'batal'].map((s) =>
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

  bindLeadRowEvents();
}

/** Bind event status select & tombol hapus di tabel leads */
function bindLeadRowEvents() {
  if (!leadsTbody) return;
  leadsTbody.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const lead = (STATE.leads || []).find((l) => String(l.id) === String(sel.dataset.id));
      if (!lead) return;
      const ok = await updateLeadStatus(lead.id, sel.value);
      if (ok) {
        lead.status = sel.value;
        showToast('Status lead diperbarui', 2000, 'success');
      } else {
        showToast('Gagal menyimpan ke Supabase', 2000, 'error');
        renderLeadsTable();
      }
    });
  });
  leadsTbody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus lead ini?')) return;
      const ok = await deleteLead(btn.dataset.del);
      if (ok) {
        setState('leads', (STATE.leads || []).filter((l) => String(l.id) !== String(btn.dataset.del)));
        renderLeadsTable();
        showToast('Lead dihapus', 2000, 'success');
      } else {
        showToast('Gagal menghapus dari Supabase', 2000, 'error');
      }
    });
  });
}

/** Update status lead di Supabase */
async function updateLeadStatus(id, status) {
  try {
    const res = await supabaseFetch(`/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { status, updated_at: new Date().toISOString() },
      headers: { Prefer: 'return=representation' }
    });
    return res.ok;
  } catch (e) {
    console.error('update lead status', e);
    return false;
  }
}

/** Hapus lead dari Supabase */
async function deleteLead(id) {
  try {
    const res = await supabaseFetch(`/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch (e) {
    console.error('delete lead', e);
    return false;
  }
}

/** Ekspor leads ke CSV */
function exportLeadsCSV() {
  if (!STATE.leads?.length) {
    showToast('Belum ada leads untuk diekspor', 2000, 'warning');
    return;
  }
  const header = ['Nama', 'Alamat', 'WhatsApp', 'Email', 'Aplikasi', 'Sumber', 'Status', 'Tanggal Daftar'];
  const rows = STATE.leads.map((l) => [l.name, l.address, l.wa, l.email, l.app_type, l.source, l.status, l.created_at]);
  const csv = [header, ...rows].map((r) =>
    r.map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
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

/** Label status leads */
function getStatusLabel(status) {
  const labels = { 'baru': '🆕 Baru', 'dihubungi': '📞 Dihubungi', 'tertarik': '💡 Tertarik', 'deal': '🤝 Deal', 'batal': '❌ Batal' };
  return labels[status] || status;
}

/** Buka detail lead (dipanggil dari recent activity dashboard) */
export function openLeadDetail(id) {
  const overlay = document.getElementById('sheetLeadDetail');
  const body = document.getElementById('leadDetailBody');
  if (!overlay || !body) return;
  const lead = (STATE.leads || []).find((l) => String(l.id) === String(id));
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
window.openLeadDetail = openLeadDetail;
window.exportLeadsCSV = exportLeadsCSV;

// Wire openClient to window for inline onclick handlers
window.openClient = openClient;