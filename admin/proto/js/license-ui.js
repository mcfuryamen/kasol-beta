/**
 * Admin Marketing KASIRSOLO — License UI
 * License generation, verification, and management UI
 */

import { getState, setState, subscribe } from './app-state.js';
import { getAll, put, getByKey, addToSyncQueue } from './storage.js';
import { generateLicenseKeyV2, validateLicenseKeyV2, parseSerial, getProductMeta } from './license-core.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';

const DAYS_OPTIONS = [
  { value: 30, label: '1 Bulan' },
  { value: 90, label: '3 Bulan' },
  { value: 180, label: '6 Bulan' },
  { value: 365, label: '1 Tahun', selected: true },
  { value: 730, label: '2 Tahun' },
  { value: 99, label: 'Seumur Hidup' }
];

export async function initLicense() {
  await renderProductRegistry();
  renderGenerateForm();
  renderVerifyForm();
  renderReferralSection();
  renderBackupSection();
  loadLicenseStatus();
}

async function loadLicenseStatus() {
  // Check admin's own license from localStorage
  const license = localStorage.getItem('admin_license');
  if (license) {
    try {
      const parsed = JSON.parse(license);
      const chip = document.getElementById('licenseChip');
      const chipText = document.getElementById('licenseChipText');
      if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
        chip.classList.remove('warn');
        chip.classList.add('success');
        chipText.textContent = 'Aktif';
      } else {
        chip.classList.add('warn');
        chip.classList.remove('success');
        chipText.textContent = 'Expired';
      }
    } catch (e) {
      console.warn('Failed to parse license:', e);
    }
  }
}

// ============ PRODUCT REGISTRY ============
async function renderProductRegistry() {
  const host = document.getElementById('productRegistry');
  const products = await getAll('products');

  host.innerHTML = products.map(p => `
    <div class="app-row" style="padding:12px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border);">
      <div><strong>${p.icon} ${escapeHtml(p.name)}</strong><br><small class="text-ink-muted">${p.prefix} · ${p.id.toUpperCase()}-HMAC-V2 · ${p.active ? 'Aktif' : 'Nonaktif'}</small></div>
      <div style="text-align:right;"><span class="badge ${p.active ? 'badge-aktif' : 'badge-expired'}">${p.active ? 'Aktif' : 'Nonaktif'}</span></div>
      <div style="text-align:right;"><button class="btn btn-sm" onclick="editProduct('${p.id}')">Edit</button></div>
    </div>
  `).join('');
}

window.editProduct = async function(appType) {
  const products = await getAll('products');
  const product = products.find(p => p.id === appType);
  if (!product) return;

  const sheet = document.getElementById('productSheetBody');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>📦 Edit Produk: ${product.icon} ${product.name}</span><span class="sheet-close" role="button" aria-label="Tutup" onclick="closeSheet('sheetProduct')">✕</span></div>
    <div class="field-grid">
      <div class="field"><label class="field-label">App Type</label><input type="text" value="${product.id}" readonly class="input-readonly"></div>
      <div class="field"><label class="field-label">Nama Produk</label><input type="text" id="prodName" value="${escapeHtml(product.name)}"></div>
      <div class="field"><label class="field-label">Ikon</label><input type="text" id="prodIcon" value="${product.icon}" maxlength="4"></div>
      <div class="field"><label class="field-label">Prefix Serial</label><input type="text" id="prodPrefix" value="${product.prefix}" maxlength="5" class="input-mono uppercase"></div>
      <div class="field"><label class="field-label">Harga (Rp/bln)</label><input type="number" id="prodPrice" value="${product.price}" min="0"></div>
      <div class="field"><label class="field-label">Deskripsi</label><textarea id="prodDesc" rows="3">${escapeHtml(product.description)}</textarea></div>
      <div class="field field-span-2">
        <label class="field-label">Status</label>
        <select id="prodActive">
          <option value="true" ${product.active ? 'selected' : ''}>Aktif</option>
          <option value="false" ${!product.active ? 'selected' : ''}>Nonaktif</option>
        </select>
      </div>
    </div>
    <div class="btn-block-row mt16">
      <button class="btn btn-outline" onclick="closeSheet('sheetProduct')">Tutup</button>
      <button class="btn btn-danger" onclick="deleteProduct('${product.id}')">🗑️ Hapus Produk</button>
      <button class="btn btn-primary" onclick="saveProduct('${product.id}')">💾 Simpan</button>
    </div>
  `;
  document.getElementById('sheetProduct').classList.add('open');
};

window.saveProduct = async function(appType) {
  const products = await getAll('products');
  const product = products.find(p => p.id === appType);
  if (!product) return;

  const updated = {
    ...product,
    name: document.getElementById('prodName').value.trim(),
    icon: document.getElementById('prodIcon').value.trim() || '📦',
    prefix: document.getElementById('prodPrefix').value.trim().toUpperCase(),
    price: parseInt(document.getElementById('prodPrice').value) || 0,
    description: document.getElementById('prodDesc').value.trim(),
    active: document.getElementById('prodActive').value === 'true'
  };

  await put('products', updated);
  showToast('✅ Produk diperbarui', 2000, 'success');
  closeSheet('sheetProduct');
  renderProductRegistry();
};

window.deleteProduct = async function(appType) {
  if (!confirm(`Hapus produk ${appType}? Tindakan ini tidak bisa dibatalkan.`)) return;
  const db = await import('./storage.js').then(m => m.getDB());
  await db.delete('products', appType);
  showToast('Produk dihapus', 2000, 'success');
  closeSheet('sheetProduct');
  renderProductRegistry();
};

window.openProductForm = function() {
  const sheet = document.getElementById('productSheetBody');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>📦 Tambah Produk Baru</span><span class="sheet-close" role="button" aria-label="Tutup" onclick="closeSheet('sheetProduct')">✕</span></div>
    <div class="field-grid">
      <div class="field"><label class="field-label">App Type (id)</label><input type="text" id="newAppType" placeholder="contoh: kaki5, rosok, custom" maxlength="20"></div>
      <div class="field"><label class="field-label">Nama Produk</label><input type="text" id="newProdName" placeholder="Nama tampilan produk"></div>
      <div class="field"><label class="field-label">Ikon</label><input type="text" id="newProdIcon" placeholder="🛵" maxlength="4"></div>
      <div class="field"><label class="field-label">Prefix Serial</label><input type="text" id="newProdPrefix" placeholder="KK5" maxlength="5" class="input-mono uppercase"></div>
      <div class="field"><label class="field-label">Harga (Rp/bln)</label><input type="number" id="newProdPrice" value="0" min="0"></div>
      <div class="field"><label class="field-label">Deskripsi</label><textarea id="newProdDesc" rows="3" placeholder="Deskripsi produk untuk katalog"></textarea></div>
    </div>
    <div class="btn-block-row mt16">
      <button class="btn btn-outline" onclick="closeSheet('sheetProduct')">Tutup</button>
      <button class="btn btn-primary" onclick="createProduct()">💾 Buat Produk</button>
    </div>
  `;
  document.getElementById('sheetProduct').classList.add('open');
};

window.createProduct = async function() {
  const appType = document.getElementById('newAppType').value.trim().toLowerCase();
  if (!appType) { showToast('App Type wajib diisi', 2000, 'error'); return; }

  const products = await getAll('products');
  if (products.some(p => p.id === appType)) { showToast('App Type sudah ada', 2000, 'error'); return; }

  const newProduct = {
    id: appType,
    app_type: appType,
    name: document.getElementById('newProdName').value.trim() || appType,
    icon: document.getElementById('newProdIcon').value.trim() || '📦',
    prefix: document.getElementById('newProdPrefix').value.trim().toUpperCase() || appType.toUpperCase().slice(0,3),
    price: parseInt(document.getElementById('newProdPrice').value) || 0,
    description: document.getElementById('newProdDesc').value.trim(),
    active: true
  };

  await put('products', newProduct);
  showToast('✅ Produk dibuat', 2000, 'success');
  closeSheet('sheetProduct');
  renderProductRegistry();
};

// ============ GENERATE SERIAL ============
function renderGenerateForm() {
  const host = document.getElementById('genForm');
  const actionsHost = document.getElementById('genActions');

  // Get products for select
  getAll('products').then(products => {
    const activeProducts = products.filter(p => p.active);
    const options = activeProducts.map(p => `<option value="${p.id}">${p.icon} ${p.name} (${p.prefix})</option>`).join('');

    host.innerHTML = `
      <div class="field"><label class="field-label" for="genProduct">Produk</label><select id="genProduct">${options}</select></div>
      <div class="field"><label class="field-label" for="genUnitId">Device Code (dari app klien)</label><input type="text" id="genUnitId" placeholder="Contoh: KSR-ABCD-1234 / K5-1A2B-3C4D" maxlength="20"><small class="hint-xs">Salin Kode Perangkat yang ditampilkan di halaman Lisensi app klien. Serial terikat device ini.</small></div>
      <div class="field"><label class="field-label" for="genOwnerName">Nama Pemilik</label><input type="text" id="genOwnerName" placeholder="Nama pemilik usaha"></div>
      <div class="field"><label class="field-label" for="genPhone">No. WhatsApp</label><input type="tel" id="genPhone" placeholder="08xxxxxxxxxx"></div>
      <div class="field"><label class="field-label" for="genDays">Masa Aktif (hari)</label><select id="genDays">${DAYS_OPTIONS.map(o => `<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
      <div class="field"><label class="field-label" for="genMaxDevices">Max Device</label><input type="number" id="genMaxDevices" value="1" min="1" max="10"></div>
      <div class="field"><label class="field-label" for="genRefCode">Referral Code (opsional)</label><input type="text" id="genRefCode" placeholder="Kode referral dari merchant lain (untuk bonus koin)"></div>
    `;

    actionsHost.innerHTML = `
      <button class="btn btn-outline" onclick="clearGenForm()">Bersihkan</button>
      <button class="btn btn-primary" onclick="generateSerial()">🔑 Generate Serial</button>
    `;
  });
}

window.clearGenForm = function() {
  document.getElementById('genUnitId').value = '';
  document.getElementById('genOwnerName').value = '';
  document.getElementById('genPhone').value = '';
  document.getElementById('genMaxDevices').value = '1';
  document.getElementById('genRefCode').value = '';
  document.getElementById('genSerialOut').setAttribute('hidden', '');
};

window.generateSerial = async function() {
  const product = document.getElementById('genProduct').value;
  const deviceCode = document.getElementById('genUnitId').value.trim().toUpperCase();
  const ownerName = document.getElementById('genOwnerName').value.trim();
  const phone = document.getElementById('genPhone').value.trim();
  const days = parseInt(document.getElementById('genDays').value);
  const maxDevices = parseInt(document.getElementById('genMaxDevices').value);
  const refCode = document.getElementById('genRefCode').value.trim().toUpperCase();

  if (!deviceCode) { showToast('Device Code wajib diisi', 2000, 'error'); return; }
  if (!ownerName) { showToast('Nama Pemilik wajib diisi', 2000, 'error'); return; }
  if (!phone) { showToast('No. WhatsApp wajib diisi', 2000, 'error'); return; }

  try {
    const serial = await generateLicenseKeyV2({ product, deviceCode, ownerName, phone, days, maxDevices, refCode });

    // Save to serials store
    const serialRecord = {
      serial,
      product,
      deviceCode,
      ownerName,
      phone,
      days,
      maxDevices,
      refCode,
      createdAt: Date.now(),
      expiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
      status: 'active',
      verified: false
    };
    await put('serials', serialRecord);
    await addToSyncQueue('serial_create', serialRecord);

    const out = document.getElementById('genSerialOut');
    out.removeAttribute('hidden');
    out.className = 'verify-result success';
    out.innerHTML = `
      <div class="verify-badge success">✅ Serial Number Generated</div>
      <div class="verify-detail"><strong>Serial:</strong></div>
      <div style="font-family:var(--font-mono);font-size:16px;font-weight:800;letter-spacing:1px;background:var(--orange-50);padding:12px;border-radius:var(--radius-sm);margin:8px 0;word-break:break-all;">${serial}</div>
      <div class="verify-row"><span class="verify-label">Produk</span><span class="verify-value">${getProductMeta(product).label}</span></div>
      <div class="verify-row"><span class="verify-label">Device Code</span><span class="verify-value">${deviceCode}</span></div>
      <div class="verify-row"><span class="verify-label">Masa Aktif</span><span class="verify-value">${days} hari</span></div>
      <div class="verify-row"><span class="verify-label">Max Device</span><span class="verify-value">${maxDevices}</span></div>
      ${refCode ? `<div class="verify-row"><span class="verify-label">Referral</span><span class="verify-value">${refCode}</span></div>` : ''}
    `;

    showToast('✅ Serial generated & saved', 2000, 'success');
  } catch (e) {
    console.error(e);
    showToast('Gagal generate serial', 2000, 'error');
  }
};

window.copyClientSerial = async function() {
  const out = document.getElementById('genSerialOut');
  const serial = out.querySelector('.verify-detail + div');
  if (serial) {
    await navigator.clipboard.writeText(serial.textContent.trim());
    showToast('📋 Serial copied!', 2000, 'success');
  }
};

// ============ VERIFY SERIAL ============
function renderVerifyForm() {
  const host = document.getElementById('verifyForm');
  const actionsHost = document.getElementById('verifyActions');

  host.innerHTML = `
    <div class="field"><label class="field-label" for="verifySerial">Serial Number</label><input type="text" id="verifySerial" placeholder="Masukkan serial number (contoh: KK5-ABCD123-365-XYZ123)" class="input-mono uppercase"></div>
    <div class="field"><label class="field-label" for="verifyProduct">Produk</label><select id="verifyProduct"><option value="">Auto-detect dari prefix</option></select></div>
  `;

  // Populate product select
  getAll('products').then(products => {
    const select = document.getElementById('verifyProduct');
    products.filter(p => p.active).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.icon} ${p.name} (${p.prefix})`;
      select.appendChild(opt);
    });
  });

  actionsHost.innerHTML = `
    <button class="btn btn-outline" onclick="clearVerifyForm()">Bersihkan</button>
    <button class="btn btn-primary" onclick="verifySerial()">✅ Verifikasi</button>
  `;
}

window.clearVerifyForm = function() {
  document.getElementById('verifySerial').value = '';
  document.getElementById('verifyProduct').value = '';
  document.getElementById('verifyResult').setAttribute('hidden', '');
};

window.verifySerial = async function() {
  const serial = document.getElementById('verifySerial').value.trim().toUpperCase();
  const selectedProduct = document.getElementById('verifyProduct').value;

  if (!serial) { showToast('Serial wajib diisi', 2000, 'error'); return; }

  // Auto-detect product from prefix
  let product = selectedProduct;
  if (!product) {
    const parsed = parseSerial(serial);
    product = parsed?.product;
  }

  if (!product) {
    showToast('Tidak bisa mendeteksi produk dari serial', 2000, 'error');
    return;
  }

  const result = await validateLicenseKeyV2(serial, product);
  const out = document.getElementById('verifyResult');
  out.removeAttribute('hidden');

  if (result.valid) {
    out.className = 'verify-result success';
    out.innerHTML = `
      <div class="verify-badge success">✅ Serial VALID</div>
      <div class="verify-detail">Lisensi aktif dan tanda tangan cocok.</div>
      <div class="verify-row"><span class="verify-label">Produk</span><span class="verify-value">${getProductMeta(product).label}</span></div>
      <div class="verify-row"><span class="verify-label">Device Code</span><span class="verify-value">${result.deviceCode}</span></div>
      <div class="verify-row"><span class="verify-label">Masa Aktif</span><span class="verify-value">${result.expDays} hari</span></div>
      <div class="verify-row"><span class="verify-label">Expired</span><span class="verify-value">${new Date(result.expiresAt).toLocaleDateString('id-ID')}</span></div>
    `;
  } else {
    out.className = 'verify-result error';
    out.innerHTML = `
      <div class="verify-badge error">❌ Serial INVALID</div>
      <div class="verify-detail">${result.reason}</div>
      ${result.expired ? '<div class="verify-row"><span class="verify-label">Status</span><span class="verify-value">EXPIRED</span></div>' : ''}
    `;
  }
};

// ============ REFERRAL SECTION ============
function renderReferralSection() {
  const host = document.getElementById('referralContent');
  host.innerHTML = `
    <div class="section-label mb0">Sistem Referral & Koin</div>
    <div class="hint mt8">Merchant dapat mengundang merchant lain. Referrer dapat koin jika referee mulai bertransaksi (min 5 transaksi). Koin bisa dicairkan via admin.</div>
    <div class="card mt12">
      <div class="section-label mb0">Statistik Referral</div>
      <div class="stat-grid mt12" id="referralStats"></div>
    </div>
    <div class="card mt12">
      <div class="section-label mb0">Daftar Kode Referral</div>
      <div class="table-wrap mt12">
        <table class="table">
          <thead><tr><th>Kode</th><th>Pemilik (Unit ID)</th><th>App</th><th>Referral Count</th><th>Koin Terkumpul</th><th>Status</th></tr></thead>
          <tbody id="referralTable"></tbody>
        </table>
      </div>
    </div>
    <div class="card mt12">
      <div class="section-label mb0">Klaim Koin (Admin Only)</div>
      <div class="hint mt8">Verifikasi & cairkan koin merchant yang sudah mencapai syarat</div>
      <div class="settings-grid mt12">
        <div class="field"><label class="field-label" for="claimUnitId">Unit ID Merchant</label><input type="text" id="claimUnitId" placeholder="Contoh: K5-ABCD-1234"></div>
        <div class="field"><label class="field-label" for="claimAmount">Jumlah Koin</label><input type="number" id="claimAmount" value="0" min="1"></div>
        <div class="field"><label class="field-label" for="claimNote">Catatan</label><input type="text" id="claimNote" placeholder="Catatan pencairan"></div>
      </div>
      <div class="btn-block-row mt16">
        <button class="btn btn-primary" onclick="processClaim()">💰 Proses Klaim</button>
      </div>
    </div>
  `;
  loadReferralData();
}

async function loadReferralData() {
  // This would query Supabase in production
  // For prototype, show empty state
  const statsHost = document.getElementById('referralStats');
  statsHost.innerHTML = `
    <div class="stat-card"><div class="stat-icon orange">🔗</div><div class="stat-value">0</div><div class="stat-label">Total Referral</div></div>
    <div class="stat-card"><div class="stat-icon green">👥</div><div class="stat-value">0</div><div class="stat-label">Referee Aktif</div></div>
    <div class="stat-card"><div class="stat-icon blue">💰</div><div class="stat-value">0</div><div class="stat-label">Total Koin</div></div>
    <div class="stat-card"><div class="stat-icon purple">🏦</div><div class="stat-value">0</div><div class="stat-label">Koin Dicairkan</div></div>
  `;

  document.getElementById('referralTable').innerHTML = `
    <tr><td colspan="6" style="text-align:center;color:var(--text3);padding:var(--space-6);">Belum ada data referral. Data akan terisi saat merchant mulai menggunakan kode referral.</td></tr>
  `;
}

window.processClaim = function() {
  const unitId = document.getElementById('claimUnitId').value.trim();
  const amount = parseInt(document.getElementById('claimAmount').value);
  const note = document.getElementById('claimNote').value.trim();

  if (!unitId || !amount) { showToast('Unit ID & jumlah koin wajib diisi', 2000, 'error'); return; }
  if (!confirm(`Cairkan ${amount} koin untuk ${unitId}?`)) return;

  // In production: call Supabase edge function to process claim
  showToast('✅ Klaim diproses (simulasi)', 2000, 'success');
  document.getElementById('claimUnitId').value = '';
  document.getElementById('claimAmount').value = '0';
  document.getElementById('claimNote').value = '';
};

// ============ BACKUP SECTION ============
function renderBackupSection() {
  const host = document.getElementById('backupActions');
  host.innerHTML = `
    <button class="btn-backup-action" onclick="exportLicenseData()">
      <span class="backup-icon">📤</span>
      <span>Ekspor Data Lisensi</span>
      <small>Produk, Serial, Referral (JSON)</small>
    </button>
    <button class="btn-backup-action" onclick="importLicenseData()">
      <span class="backup-icon">📥</span>
      <span>Impor Data Lisensi</span>
      <small>Dari file JSON backup</small>
    </button>
    <button class="btn-backup-action" onclick="clearLicenseData()">
      <span class="backup-icon">🗑️</span>
      <span>Hapus Semua Data</span>
      <small style="color:var(--red);">Tidak bisa dibatalkan!</small>
    </button>
  `;
}

window.exportLicenseData = async function() {
  const [products, serials, clients] = await Promise.all([
    getAll('products'),
    getAll('serials'),
    getAll('clients')
  ]);

  const data = { products, serials, clients, exportedAt: Date.now(), version: '2.0' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `admin-license-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Data diekspor', 2000, 'success');
};

window.importLicenseData = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.products) await putMany('products', data.products);
      if (data.serials) await putMany('serials', data.serials);
      if (data.clients) await putMany('clients', data.clients);
      showToast('✅ Data diimpor', 2000, 'success');
      renderProductRegistry();
      loadReferralData();
    } catch (e) {
      showToast('Gagal impor: file tidak valid', 2000, 'error');
    }
  };
  input.click();
};

window.clearLicenseData = async function() {
  if (!confirm('⚠️ PERINGATAN: Ini akan menghapus SEMUA data produk, serial, dan klien. Tindakan TIDAK BISA DIBATALKAN. Lanjutkan?')) return;
  if (!confirm('YAKIN SEKALI? Data akan hilang permanen.')) return;

  await clear('products');
  await clear('serials');
  await clear('clients');
  showToast('🗑️ Semua data lisensi dihapus', 2000, 'warning');
  renderProductRegistry();
  renderGenerateForm();
  loadReferralData();
};

async function putMany(storeName, items) {
  const { putMany: pm } = await import('./storage.js');
  return pm(storeName, items);
}

async function clear(storeName) {
  const { clear: cl } = await import('./storage.js');
  return cl(storeName);
}