/**
 * Admin Marketing KASIRSOLO — License UI Module
 * License tab: product registry, generate, verify, reference code, backup/restore
 * Rosok-style: cards + settings-grid forms, sheet modals for product form
 */

import { STATE, subscribe, loadLicenseProducts, saveLicenseProducts } from './app-state.js';
import { storage } from './storage.js';
import * as LicenseCore from './license-core.js';
import { formatRupiah, escapeHtml, generateId } from './utils.js';
import { showToast } from './toast.js';
import { supabaseFetch } from './api.js';
import { APP_META } from './clients.js';

// DOM elements (new rosok-style IDs)
let productRegistry = null;
let genProduct = null;
let genUnitId = null;
let genDays = null;
let genMaxDevices = null;
let genRefCode = null;
let generateSerialBtn = null;
let serialOutput = null;
let copySerialBtn = null;
let downloadSerialBtn = null;
let verifySerial = null;
let verifyDeviceCode = null;
let verifyBtn = null;
let verifyResult = null;
let myRefCode = null;
let refSuccessCount = null;
let refCoins = null;
let copyRefCodeBtn = null;

// Product registry (from license-core defaults + custom)
// ⚠️ SALT HARUS SAMA PERSIS dengan PRODUCT_SALT di tiap app klien,
//    kalau beda, serial yang di-generate di TOLAK oleh validasi app.
// PRODUCT_REGISTRY will be populated from Supabase products table on init
// Each product must have: prefix (app_type), salt, name, price (from price_label)
let PRODUCT_REGISTRY = {};

// Fallback registry (offline / supabase fail): same salts as client apps
const FALLBACK_REGISTRY = {
  KSR: { name: 'Kasir Rosok (rosok)', salt: 'KASIRSOLO-ROSOK-HMAC-V2', price: 250000 },
  KK5: { name: 'Kasir Kaki5 (kaki5)', salt: 'KASIRSOLO-KAKI5-HMAC-V2', price: 200000 },
  GBK: { name: 'Gerobak (gerobak)', salt: 'KASIRSOLO-GEROBAK-HMAC-V2', price: 300000 },
  RTL: { name: 'Kasir Retail (retail)', salt: 'KASIRSOLO-RETAIL-HMAC-V2', price: 350000 }
};

// Map app_type -> prefix+salt (sumber kebenaran: APP_META di clients.js)
// APP_META ini yang sama dengan jalur generate serial di klien, jadi serial
// yang dihasilkan dari menu Lisensi VALID di app klien.

/**
 * Load products from Supabase to populate PRODUCT_REGISTRY.
 * Uses the /api/rest proxy (Phase A) — NOT direct anon-key fetch.
 * Prefix & salt diambil dari APP_META (konsisten dgn jalur generate serial di klien).
 */
async function loadProductsFromSupabase() {
  try {
    const res = await supabaseFetch('/rest/v1/products?order=order_index.asc');
    if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
      console.warn('loadProductsFromSupabase: kosong/gagal, pakai fallback', res.status, res.text);
      PRODUCT_REGISTRY = { ...FALLBACK_REGISTRY };
      return;
    }

    const registry = {};
    for (const p of res.data) {
      const at = String(p.app_type || '').toLowerCase();
      const meta = APP_META[at];
      // prefix dari APP_META kalau dikenal; kalau tidak, derive dari app_type/name
      const prefix = meta?.prefix || String(p.app_type || p.name || 'PRD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PRD';
      registry[prefix] = {
        name: p.name || meta?.label || prefix,
        salt: p.salt || meta?.salt || '',
        price: parseInt(String(p.price_label || '').replace(/\D/g, '') || '0', 10)
      };
    }

    if (Object.keys(registry).length === 0) {
      PRODUCT_REGISTRY = { ...FALLBACK_REGISTRY };
    } else {
      PRODUCT_REGISTRY = registry;
    }
  } catch (error) {
    console.error('loadProductsFromSupabase error:', error);
    PRODUCT_REGISTRY = { ...FALLBACK_REGISTRY };
  }
}

/**
 * Initialize license module
 */
export async function initLicense() {
  cacheElements();
  bindEvents();

  // Load products from Supabase to populate PRODUCT_REGISTRY
  await loadProductsFromSupabase();

  // Subscribe to license products (local storage changes)
  subscribe('licenseProducts', renderProductRegistry);

  // Load saved license products (fallback/local overrides)
  loadLicenseProducts(storage).then(() => {
    renderProductRegistry();
  });

  // Load referral data
  loadReferralData();
  renderProductRegistry();
}

/**
 * Cache DOM elements
 */
function cacheElements() {
  productRegistry = document.getElementById('productRegistry');
  
  // Generate form
  genProduct = document.getElementById('genProduct');
  genUnitId = document.getElementById('genUnitId');
  genDays = document.getElementById('genDays');
  genMaxDevices = document.getElementById('genMaxDevices');
  genRefCode = document.getElementById('genRefCode');
  generateSerialBtn = document.getElementById('generateSerialBtn');
  serialOutput = document.getElementById('serialOutput');
  copySerialBtn = document.getElementById('copySerialBtn');
  downloadSerialBtn = document.getElementById('downloadSerialBtn');
  
  // Verify form
  verifySerial = document.getElementById('verifySerial');
  verifyDeviceCode = document.getElementById('verifyDeviceCode');
  verifyBtn = document.getElementById('verifyBtn');
  verifyResult = document.getElementById('verifyResult');
  
  // Referral
  myRefCode = document.getElementById('myRefCode');
  refSuccessCount = document.getElementById('refSuccessCount');
  refCoins = document.getElementById('refCoins');
  copyRefCodeBtn = document.getElementById('copyRefCodeBtn');
}

/**
 * Bind event listeners
 */
function bindEvents() {
  // Generate serial
  generateSerialBtn?.addEventListener('click', handleGenerate);
  
  // Copy serial
  copySerialBtn?.addEventListener('click', copySerial);
  
  // Download serial
  downloadSerialBtn?.addEventListener('click', downloadSerial);
  
  // Verify serial
  verifyBtn?.addEventListener('click', handleVerify);
  
  // Copy ref code
  copyRefCodeBtn?.addEventListener('click', copyRefCode);
  
  // Auto-format device code inputs
  genUnitId?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
  });
  verifySerial?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  });
  verifyDeviceCode?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  });
}

/**
 * Render product registry table
 */
export function renderProductRegistry() {
  if (!productRegistry) return;

  // Merge default registry with saved custom products
  const products = { ...PRODUCT_REGISTRY };
  (STATE.licenseProducts || []).forEach(p => {
    products[p.prefix] = { name: p.name, salt: p.salt, price: p.price };
  });

  productRegistry.innerHTML = Object.entries(products).map(([prefix, info]) => `
    <div class="app-row">
      <div class="app-row-main">
        <span class="app-row-icon">${getProductIcon(prefix)}</span>
        <div class="app-row-info">
          <strong class="app-row-name">${escapeHtml(info.name)}</strong>
          <small class="app-row-prefix">${escapeHtml(prefix)}</small>
        </div>
      </div>
      <input type="text" value="${escapeHtml(info.salt)}" readonly class="app-row-salt" aria-label="Salt produk ${escapeHtml(info.name)}">
      <span class="app-row-price">${formatRupiah(info.price)}</span>
      <div class="app-row-actions">
        ${!PRODUCT_REGISTRY[prefix] ? `<button class="btn btn-sm btn-danger" data-remove-prefix="${escapeHtml(prefix)}">Hapus</button>` : ''}
      </div>
    </div>
  `).join('');

  // Bind remove for custom products
  productRegistry.querySelectorAll('[data-remove-prefix]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prefix = btn.dataset.removePrefix;
      if (!confirm(`Hapus produk kustom ${prefix}?`)) return;

      STATE.licenseProducts = (STATE.licenseProducts || []).filter(p => p.prefix !== prefix);
      const success = await saveLicenseProducts(storage, STATE.licenseProducts);
      if (success) {
        showToast(`Produk ${prefix} dihapus`, 2000, 'success');
      } else {
        showToast('Gagal menghapus', 2000, 'error');
      }
    });
  });

  // Update product select options
  updateProductSelect(products);
}

/**
 * Update product select dropdown
 */
function updateProductSelect(products) {
  if (!genProduct) return;

  const currentValue = genProduct.value;
  genProduct.innerHTML = Object.entries(products).map(([prefix, info]) =>
    `<option value="${prefix}" ${prefix === currentValue ? 'selected' : ''}>${prefix} — ${info.name}</option>`
  ).join('');
}

/**
 * Get icon for product prefix
 */
function getProductIcon(prefix) {
  const icons = { KSR: '🛒', KK5: '🛵', GBK: '🛒', RTL: '🏪' };
  return icons[prefix] || '📦';
}

/**
 * Handle generate serial (new form)
 */
async function handleGenerate() {
  const prefix = genProduct?.value;
  const unitId = genUnitId?.value?.trim();
  const days = parseInt(genDays?.value) || 365;
  const maxDevices = parseInt(genMaxDevices?.value) || 1;
  const refCode = genRefCode?.value?.trim();

  if (!prefix) {
    showToast('Pilih produk', 2000, 'warning');
    return;
  }
  if (!unitId) {
    showToast('Masukkan Device Code', 2000, 'warning');
    genUnitId?.focus();
    return;
  }

  const product = PRODUCT_REGISTRY[prefix];
  if (!product) {
    showToast('Produk tidak dikenal', 2000, 'error');
    return;
  }

  // Convert days to expCode
  let expCode = '99'; // unlimited
  if (days <= 30) expCode = '01';
  else if (days <= 90) expCode = '03';
  else if (days <= 180) expCode = '06';
  else if (days <= 365) expCode = '12';
  else if (days <= 730) expCode = '24';
  else if (days <= 1095) expCode = '36';
  else if (days <= 1825) expCode = '60';
  else if (days <= 3650) expCode = '99';

  generateSerialBtn.disabled = true;
  generateSerialBtn.textContent = '⏳ Menghasilkan...';

  try {
    const serial = await LicenseCore.generateSerial(prefix, product.salt, unitId, expCode);

    if (serialOutput) {
      serialOutput.value = serial;
      serialOutput.style.display = 'block';
    }
    if (copySerialBtn) copySerialBtn.style.display = 'inline-flex';
    if (downloadSerialBtn) downloadSerialBtn.style.display = 'inline-flex';

    showToast('Nomor serial berhasil dibuat!', 2000, 'success');
  } catch (error) {
    console.error('Generate serial error:', error);
    showToast('Gagal membuat serial', 2000, 'error');
  } finally {
    generateSerialBtn.disabled = false;
    generateSerialBtn.textContent = '🔑 Generate Serial Number';
  }
}

/**
 * Copy serial to clipboard
 */
async function copySerial() {
  if (!serialOutput?.value) return;

  try {
    await navigator.clipboard.writeText(serialOutput.value);
    showToast('Serial disalin ke clipboard!', 2000, 'success');
    copySerialBtn.textContent = '✅ Tersalin';
    setTimeout(() => { copySerialBtn.textContent = '📋 Copy'; }, 2000);
  } catch {
    showToast('Gagal menyalin', 2000, 'error');
  }
}

/**
 * Download serial as .txt
 */
function downloadSerial() {
  if (!serialOutput?.value) return;

  const prefix = genProduct?.value || 'LIC';
  const unitId = genUnitId?.value || 'UNIT';
  const blob = new Blob([serialOutput.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `serial-${prefix}-${unitId}-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('File serial diunduh', 2000, 'success');
}

/**
 * Handle verify serial
 */
async function handleVerify() {
  const serial = verifySerial?.value?.trim();
  const deviceCode = verifyDeviceCode?.value?.trim();
  const prefix = genProduct?.value; // Use same product select

  if (!serial) {
    showToast('Masukkan serial yang ingin diverifikasi', 2000, 'warning');
    return;
  }
  if (!deviceCode) {
    showToast('Masukkan Device Code / Unit ID', 2000, 'warning');
    return;
  }

  const product = PRODUCT_REGISTRY[prefix];
  if (!product) {
    showToast('Pilih produk terlebih dahulu', 2000, 'warning');
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = '⏳ Memverifikasi...';

  try {
    const result = await LicenseCore.verifySerial(prefix, product.salt, serial, deviceCode);

    if (verifyResult) {
      if (result.valid && !result.expired) {
        verifyResult.innerHTML = `
          <div class="verify-badge success">✅ VALID</div>
          <div class="verify-detail">
            Produk: ${product.name}<br>
            Device Code: ${result.deviceCode}<br>
            Masa Berlaku: ${LicenseCore.formatExpiry(result.expCode)}<br>
            <small>Status: Aktif</small>
          </div>
        `;
        verifyResult.className = 'verify-result success';
      } else if (result.valid && result.expired) {
        verifyResult.innerHTML = `
          <div class="verify-badge warning">⚠️ KADALUARSA</div>
          <div class="verify-detail">
            Produk: ${product.name}<br>
            Device Code: ${result.deviceCode}<br>
            Kadaluarsa: ${LicenseCore.formatExpiry(result.expCode)}<br>
            <small>Serial valid tapi masa berlaku habis</small>
          </div>
        `;
        verifyResult.className = 'verify-result warning';
      } else {
        verifyResult.innerHTML = `
          <div class="verify-badge error">❌ TIDAK VALID</div>
          <div class="verify-detail">
            Serial tidak cocok dengan Device Code atau salt produk.<br>
            Periksa kembali input Anda.
          </div>
        `;
        verifyResult.className = 'verify-result error';
      }
      verifyResult.hidden = false;
    }

    showToast(result.valid ? 'Verifikasi selesai' : 'Serial tidak valid', 2000, result.valid ? 'success' : 'error');
  } catch (error) {
    console.error('Verify error:', error);
    showToast('Error saat verifikasi', 2000, 'error');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = '✅ Verifikasi Lisensi';
  }
}

/**
 * Load referral data from state
 */
function loadReferralData() {
  if (!myRefCode) return;

  const unitId = STATE.settings?.unitId || 'KSR-' + generateId().slice(0, 8).toUpperCase();
  myRefCode.value = unitId;
  myRefCode.className = 'input-readonly center-lg';

  refSuccessCount.value = STATE.referral?.successCount || 0;
  refSuccessCount.className = 'input-readonly center-xl green';

  refCoins.value = STATE.referral?.coins || 0;
  refCoins.className = 'input-readonly center-xl orange';
}

/**
 * Copy referral code
 */
async function copyRefCode() {
  if (!myRefCode?.value) return;
  
  try {
    await navigator.clipboard.writeText(myRefCode.value);
    showToast('Kode referral disalin!', 2000, 'success');
  } catch {
    showToast('Gagal menyalin', 2000, 'error');
  }
}

/**
 * Open product form sheet
 * Called from HTML onclick
 */
export function openProductForm(prefix = null) {
  const overlay = document.getElementById('sheetProduct');
  const title = document.getElementById('prodFormTitle');
  const formId = document.getElementById('prodFormId');
  const formCode = document.getElementById('prodFormCode');
  const formName = document.getElementById('prodFormName');
  const formPrefix = document.getElementById('prodFormPrefix');
  const formSecret = document.getElementById('prodFormSecret');
  const formDays = document.getElementById('prodFormDefaultDays');
  const formDevices = document.getElementById('prodFormMaxDevices');
  const formActive = document.getElementById('prodFormActive');

  if (!overlay) return;

  if (prefix) {
    // Edit mode
    const product = { ...PRODUCT_REGISTRY };
    (STATE.licenseProducts || []).forEach(p => {
      product[p.prefix] = { name: p.name, salt: p.salt, price: p.price };
    });
    const p = product[prefix];
    if (!p) return;

    title.textContent = 'Edit Produk';
    formId.value = prefix;
    formCode.value = prefix;
    formCode.disabled = true;
    formName.value = p.name;
    formPrefix.value = p.salt; // salt as prefix for editing
    formSecret.value = '';
    formDays.value = 365;
    formDevices.value = 1;
    formActive.checked = true;
  } else {
    // Add mode
    title.textContent = 'Tambah Produk';
    formId.value = '';
    formCode.value = '';
    formCode.disabled = false;
    formName.value = '';
    formPrefix.value = '';
    formSecret.value = '';
    formDays.value = 365;
    formDevices.value = 1;
    formActive.checked = true;
  }

  overlay.classList.add('open');
  formCode.focus();
}

/**
 * Save product from sheet
 * Called from HTML onclick
 */
export async function saveProduct() {
  const formId = document.getElementById('prodFormId');
  const formCode = document.getElementById('prodFormCode');
  const formName = document.getElementById('prodFormName');
  const formPrefix = document.getElementById('prodFormPrefix');
  const formSecret = document.getElementById('prodFormSecret');
  const formDays = document.getElementById('prodFormDefaultDays');
  const formDevices = document.getElementById('prodFormMaxDevices');
  const formActive = document.getElementById('prodFormActive');

  const prefix = formCode.value.trim().toUpperCase();
  const name = formName.value.trim();
  const salt = formPrefix.value.trim();
  const secret = formSecret.value.trim();
  const price = parseInt(formDays.value) || 0; // using days field for price? no, separate field needed
  // Actually the form has days/devices for defaults, not price. Let's add price field or use existing.
  // For now, use price from settings or default

  if (!prefix || prefix.length < 2 || prefix.length > 4) {
    showToast('Kode produk 2-4 huruf', 2000, 'warning');
    formCode.focus();
    return;
  }
  if (!name) {
    showToast('Nama produk wajib', 2000, 'warning');
    formName.focus();
    return;
  }
  if (!salt) {
    showToast('Salt wajib diisi', 2000, 'warning');
    formPrefix.focus();
    return;
  }
  if (PRODUCT_REGISTRY[prefix]) {
    showToast('Kode produk sudah terdaftar (bawaan)', 2000, 'warning');
    return;
  }

  STATE.licenseProducts = STATE.licenseProducts || [];
  STATE.licenseProducts = STATE.licenseProducts.filter(p => p.prefix !== prefix);
  STATE.licenseProducts.push({
    prefix,
    name,
    salt,
    price: 0 // default price, can be added later
  });

  const success = await saveLicenseProducts(storage, STATE.licenseProducts);
  if (success) {
    showToast('Produk disimpan', 2000, 'success');
    closeSheet('sheetProduct');
    renderProductRegistry();
  } else {
    showToast('Gagal menyimpan', 2000, 'error');
  }
}

/**
 * Close sheet by ID
 * Called from HTML onclick
 */
export function closeSheet(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

/**
 * Buka sheet "Status Lisensi Admin" (chip LICENSE di header)
 */
export function openLicenseSheet() {
  const overlay = document.getElementById('sheetLicense');
  const body = document.getElementById('licenseSheetBody');
  if (!overlay) return;

  if (body) {
    const custom = (STATE.licenseProducts || []).filter(p => !PRODUCT_REGISTRY[p.prefix]);
    const rows = [
      ...Object.values(PRODUCT_REGISTRY).map(p => ({ prefix: Object.keys(PRODUCT_REGISTRY).find(k => PRODUCT_REGISTRY[k] === p), ...p })),
      ...custom
    ];
    body.innerHTML = `
      <div class="hint mb8">Produk lisensi yang dikelola melalui dashboard ini.</div>
      ${rows.map(p => `
        <div class="app-row" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line,#ECE1D3)">
          <div><b>${escapeHtml(p.prefix)}</b> · ${escapeHtml(p.name)}</div>
          <span class="badge green">${formatRupiah(p.price || 0)}</span>
        </div>`).join('')}
    `;
  }
  overlay.classList.add('open');
}

/**
 * Export backup lisensi (produk & serial) ke file JSON
 */
export function exportLicenseBackup() {
  const data = {
    app: 'admin-kasirsolo',
    type: 'license',
    exportedAt: new Date().toISOString(),
    licenseProducts: STATE.licenseProducts || []
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `license-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup lisensi terunduh', 2000, 'success');
}

/**
 * Import backup lisensi dari file JSON
 */
export async function importLicenseBackup(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const products = Array.isArray(parsed) ? parsed : parsed.licenseProducts;
    if (!Array.isArray(products)) throw new Error('Format tidak dikenali');
    const ok = await saveLicenseProducts(storage, products);
    if (ok) {
      renderProductRegistry();
      showToast('Backup lisensi diimpor', 2000, 'success');
    } else {
      showToast('Gagal mengimpor backup', 2000, 'error');
    }
  } catch (e) {
    console.error('Import license backup error:', e);
    showToast('File backup tidak valid', 3000, 'error');
  }
}

// Make functions globally accessible for inline onclick
window.openProductForm = openProductForm;
window.saveProduct = saveProduct;
window.closeSheet = closeSheet;
window.copyRefCode = copyRefCode;
window.generateSerial = handleGenerate;
window.copySerial = copySerial;
window.downloadSerial = downloadSerial;
window.verifySerial = handleVerify;
window.openLicenseSheet = openLicenseSheet;
window.exportLicenseBackup = exportLicenseBackup;

// Aksesibilitas: chip Status Lisensi fokusable keyboard (role=button di HTML)
document.getElementById('licenseChip')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLicenseSheet(); }
});
window.importLicenseBackup = importLicenseBackup;