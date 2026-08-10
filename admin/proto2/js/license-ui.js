/**
 * Admin Console — License UI Module
 * Product registry, generate, verify, referral, backup. SaaS restyle.
 */

import { STATE, subscribe, loadLicenseProducts, saveLicenseProducts } from './app-state.js';
import { storage } from './storage.js';
import * as LicenseCore from './license-core.js';
import { formatRupiah, escapeHtml, generateId } from './utils.js';
import { showToast } from './toast.js';

let productRegistry, genProduct, genUnitId, genOwnerName, genPhone, genDays, genMaxDevices, genRefCode,
    generateSerialBtn, serialOutput, copySerialBtn, downloadSerialBtn,
    verifySerial, verifyDeviceCode, verifyBtn, verifyResult, myRefCode, refSuccessCount, refCoins, copyRefCodeBtn;

const PRODUCT_REGISTRY = {
  KSR: { name:'Kasir Rosok (rosok)', salt:'KASIRSOLO-ROSOK-HMAC-V2', price:250000 },
  KK5: { name:'Kasir Kaki5 (kaki5)', salt:'KASIRSOLO-KAKI5-HMAC-V2', price:200000 },
  GBK: { name:'Gerobak (gerobak)', salt:'KASIRSOLO-GEROBAK-HMAC-V2', price:300000 },
  RTL: { name:'Kasir Retail (retail)', salt:'KASIRSOLO-RETAIL-HMAC-V2', price:350000 }
};

export function initLicense() {
  cacheElements(); bindEvents(); renderProductRegistry();
  subscribe('licenseProducts', renderProductRegistry);
  loadLicenseProducts(storage).then(renderProductRegistry);
  loadReferralData();
}

function cacheElements() {
  productRegistry = document.getElementById('productRegistry');
  genProduct = document.getElementById('genProduct'); genUnitId = document.getElementById('genUnitId');
  genOwnerName = document.getElementById('genOwnerName'); genPhone = document.getElementById('genPhone');
  genDays = document.getElementById('genDays'); genMaxDevices = document.getElementById('genMaxDevices');
  genRefCode = document.getElementById('genRefCode');
  generateSerialBtn = document.getElementById('generateSerialBtn');
  serialOutput = document.getElementById('serialOutput');
  copySerialBtn = document.getElementById('copySerialBtn'); downloadSerialBtn = document.getElementById('downloadSerialBtn');
  verifySerial = document.getElementById('verifySerial'); verifyDeviceCode = document.getElementById('verifyDeviceCode');
  verifyBtn = document.getElementById('verifyBtn'); verifyResult = document.getElementById('verifyResult');
  myRefCode = document.getElementById('myRefCode'); refSuccessCount = document.getElementById('refSuccessCount');
  refCoins = document.getElementById('refCoins'); copyRefCodeBtn = document.getElementById('copyRefCodeBtn');
}

function bindEvents() {
  generateSerialBtn?.addEventListener('click', handleGenerate);
  copySerialBtn?.addEventListener('click', copySerial);
  downloadSerialBtn?.addEventListener('click', downloadSerial);
  verifyBtn?.addEventListener('click', handleVerify);
  copyRefCodeBtn?.addEventListener('click', copyRefCode);
  genUnitId?.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,20); });
  verifySerial?.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,''); });
  verifyDeviceCode?.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8); });
}

export function renderProductRegistry() {
  if (!productRegistry) return;
  const products = { ...PRODUCT_REGISTRY };
  (STATE.licenseProducts||[]).forEach(p => { products[p.prefix] = { name:p.name, salt:p.salt, price:p.price }; });

  productRegistry.innerHTML = Object.entries(products).map(([prefix, info]) => `
    <div class="product-row">
      <span class="pr-ic">${getProductIcon(prefix)}</span>
      <div class="pr-info">
        <div class="pr-name">${escapeHtml(info.name)}</div>
        <div class="pr-prefix">${escapeHtml(prefix)}</div>
      </div>
      <input class="pr-salt input-mono" value="${escapeHtml(info.salt)}" readonly aria-label="Salt ${escapeHtml(info.name)}">
      <span class="pr-price">${formatRupiah(info.price)}</span>
      ${!PRODUCT_REGISTRY[prefix] ? `<button class="btn btn-ghost btn-sm" data-remove-prefix="${escapeHtml(prefix)}">Hapus</button>` : ''}
    </div>`).join('');

  productRegistry.querySelectorAll('[data-remove-prefix]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prefix = btn.dataset.removePrefix;
      if (!confirm(`Hapus produk ${prefix}?`)) return;
      STATE.licenseProducts = (STATE.licenseProducts||[]).filter(p => p.prefix !== prefix);
      const ok = await saveLicenseProducts(storage, STATE.licenseProducts);
      showToast(ok ? `Produk ${prefix} dihapus` : 'Gagal menghapus', 2000, ok ? 'success' : 'error');
    });
  });

  if (genProduct) {
    const cur = genProduct.value;
    genProduct.innerHTML = Object.entries(products).map(([prefix,info]) => `<option value="${prefix}" ${prefix===cur?'selected':''}>${prefix} — ${info.name}</option>`).join('');
  }
}

function getProductIcon(p){return {KSR:'🛒',KK5:'🛵',GBK:'🛒',RTL:'🏪'}[p]||'📦';}

async function handleGenerate() {
  const prefix = genProduct?.value;
  const unitId = genUnitId?.value?.trim();
  const ownerName = genOwnerName?.value?.trim();
  const phone = genPhone?.value?.trim();
  const days = parseInt(genDays?.value)||365;
  const maxDevices = parseInt(genMaxDevices?.value)||1;
  const refCode = genRefCode?.value?.trim();
  if (!prefix) { showToast('Pilih produk', 2000, 'warning'); return; }
  if (!unitId) { showToast('Masukkan Device Code', 2000, 'warning'); genUnitId?.focus(); return; }
  if (!ownerName) { showToast('Nama pemilik wajib', 2000, 'warning'); genOwnerName?.focus(); return; }
  if (!phone) { showToast('WhatsApp wajib', 2000, 'warning'); genPhone?.focus(); return; }
  const product = PRODUCT_REGISTRY[prefix];
  if (!product) { showToast('Produk tidak dikenal', 2000, 'error'); return; }
  let expCode = '99';
  if (days<=30) expCode='01'; else if (days<=90) expCode='03'; else if (days<=180) expCode='06';
  else if (days<=365) expCode='12'; else if (days<=730) expCode='24'; else if (days<=1095) expCode='36';
  else if (days<=1825) expCode='60'; else if (days<=3650) expCode='99';
  generateSerialBtn.disabled = true; generateSerialBtn.textContent = '⏳…';
  try {
    const serial = await LicenseCore.generateSerial(prefix, product.salt, unitId, expCode);
    if (serialOutput) { serialOutput.value = serial; serialOutput.style.display = 'block'; }
    if (copySerialBtn) copySerialBtn.style.display = 'inline-flex';
    if (downloadSerialBtn) downloadSerialBtn.style.display = 'inline-flex';
    showToast('Serial dibuat!', 2000, 'success');
  } catch (e) { console.error(e); showToast('Gagal membuat serial', 2000, 'error'); }
  finally { generateSerialBtn.disabled = false; generateSerialBtn.textContent = '🔑 Generate'; }
}

async function copySerial() {
  if (!serialOutput?.value) return;
  try { await navigator.clipboard.writeText(serialOutput.value); showToast('Serial disalin', 2000, 'success'); copySerialBtn.textContent='✅'; setTimeout(()=>copySerialBtn.textContent='📋 Copy',2000); }
  catch { showToast('Gagal menyalin', 2000, 'error'); }
}

function downloadSerial() {
  if (!serialOutput?.value) return;
  const prefix = genProduct?.value||'LIC';
  const unitId = genUnitId?.value||'UNIT';
  const blob = new Blob([serialOutput.value], { type:'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `serial-${prefix}-${unitId}.txt`; a.click();
  URL.revokeObjectURL(url); showToast('Diunduh', 2000, 'success');
}

async function handleVerify() {
  const serial = verifySerial?.value?.trim();
  const deviceCode = verifyDeviceCode?.value?.trim();
  const prefix = genProduct?.value;
  if (!serial) { showToast('Serial wajib', 2000, 'warning'); return; }
  if (!deviceCode) { showToast('Device Code wajib', 2000, 'warning'); return; }
  const product = PRODUCT_REGISTRY[prefix];
  if (!product) { showToast('Pilih produk', 2000, 'warning'); return; }
  verifyBtn.disabled = true; verifyBtn.textContent='⏳…';
  try {
    const r = await LicenseCore.verifySerial(prefix, product.salt, serial, deviceCode);
    if (verifyResult) {
      let tone, badge, detail;
      if (r.valid && !r.expired) { tone='success'; badge='✅ VALID'; detail=`Produk: ${product.name}<br>Device: ${r.deviceCode}<br>Berlaku: ${LicenseCore.formatExpiry(r.expCode)}<br><small>Aktif</small>`; }
      else if (r.valid && r.expired) { tone='warning'; badge='⚠️ KADALUARSA'; detail=`${badge}<br>Produk: ${product.name}<br>Device: ${r.deviceCode}<br>Kadaluarsa: ${LicenseCore.formatExpiry(r.expCode)}`; }
      else { tone='error'; badge='❌ TIDAK VALID'; detail='Serial tidak cocok dengan Device Code / salt.'; }
      verifyResult.className = `verify-box verify-${tone}`;
      verifyResult.innerHTML = `<div class="verify-badge">${badge}</div><div class="verify-detail">${detail}</div>`;
      verifyResult.hidden = false;
    }
    showToast(r.valid ? 'Verifikasi selesai' : 'Serial tidak valid', 2000, r.valid ? 'success' : 'error');
  } catch (e) { console.error(e); showToast('Error verifikasi', 2000, 'error'); }
  finally { verifyBtn.disabled = false; verifyBtn.textContent='✅ Verifikasi'; }
}

function loadReferralData() {
  if (!myRefCode) return;
  const unitId = STATE.settings?.unitId || 'KSR-' + generateId().slice(0,8).toUpperCase();
  myRefCode.value = unitId; myRefCode.className = 'input-readonly center-lg';
  refSuccessCount.value = STATE.referral?.successCount || 0; refSuccessCount.className = 'input-readonly center-xl green';
  refCoins.value = STATE.referral?.coins || 0; refCoins.className = 'input-readonly center-xl orange';
}

async function copyRefCode() {
  if (!myRefCode?.value) return;
  try { await navigator.clipboard.writeText(myRefCode.value); showToast('Kode referral disalin', 2000, 'success'); }
  catch { showToast('Gagal menyalin', 2000, 'error'); }
}

export function openProductForm(prefix = null) {
  const overlay = document.getElementById('sheetProduct');
  const sheet = document.getElementById('productSheet');
  if (!overlay || !sheet) return;
  const merged = { ...PRODUCT_REGISTRY };
  (STATE.licenseProducts||[]).forEach(p => { merged[p.prefix] = p; });
  const p = prefix ? merged[prefix] : null;
  sheet.innerHTML = `
    <div class="sheet-head"><h3>${prefix?'Edit':'Tambah'} Produk</h3><button class="sheet-x" onclick="closeSheet('sheetProduct')">✕</button></div>
    <div class="field-grid-2">
      <div class="field"><label class="field-label">Kode</label><input id="prodFormCode" value="${p?prefix:''}" ${p?'readonly':''} maxlength="4"></div>
      <div class="field"><label class="field-label">Nama</label><input id="prodFormName" value="${p?escapeHtml(p.name):''}"></div>
      <div class="field field-span-2"><label class="field-label">Salt (HMAC)</label><input id="prodFormSecret" value="${p?escapeHtml(p.salt):''}"></div>
      <div class="field"><label class="field-label">Default Hari</label><input id="prodFormDefaultDays" type="number" value="365"></div>
      <div class="field"><label class="field-label">Max Device</label><input id="prodFormMaxDevices" type="number" value="1"></div>
    </div>
    <div class="row-actions mt12">
      <button class="btn btn-outline" onclick="closeSheet('sheetProduct')">Batal</button>
      <button class="btn btn-primary" onclick="saveProduct('${prefix||''}')">Simpan</button>
    </div>`;
  overlay.classList.add('open');
}

export async function saveProduct(editPrefix) {
  const prefix = document.getElementById('prodFormCode')?.value.trim().toUpperCase();
  const name = document.getElementById('prodFormName')?.value.trim();
  const salt = document.getElementById('prodFormSecret')?.value.trim();
  if (!prefix || prefix.length<2 || prefix.length>4) { showToast('Kode 2-4 huruf', 2000, 'warning'); return; }
  if (!name) { showToast('Nama wajib', 2000, 'warning'); return; }
  if (!salt) { showToast('Salt wajib', 2000, 'warning'); return; }
  if (PRODUCT_REGISTRY[prefix]) { showToast('Kode sudah terdaftar (bawaan)', 2000, 'warning'); return; }
  STATE.licenseProducts = STATE.licenseProducts || [];
  STATE.licenseProducts = STATE.licenseProducts.filter(x => x.prefix !== prefix && x.prefix !== editPrefix);
  STATE.licenseProducts.push({ prefix, name, salt, price:0 });
  const ok = await saveLicenseProducts(storage, STATE.licenseProducts);
  if (ok) { showToast('Produk disimpan', 2000, 'success'); closeSheet('sheetProduct'); renderProductRegistry(); }
  else showToast('Gagal menyimpan', 2000, 'error');
}

export function closeSheet(id) {
  const overlay = document.getElementById(id);
  if (overlay) { overlay.classList.remove('open'); document.body.style.overflow=''; }
}

export function openLicenseSheet() {
  const overlay = document.getElementById('sheetLicense');
  const body = document.getElementById('licenseSheetBody');
  if (!overlay) return;
  if (body) {
    const custom = (STATE.licenseProducts||[]).filter(p => !PRODUCT_REGISTRY[p.prefix]);
    const rows = [...Object.values(PRODUCT_REGISTRY).map(p => ({ prefix: Object.keys(PRODUCT_REGISTRY).find(k=>PRODUCT_REGISTRY[k]===p), ...p })), ...custom];
    body.innerHTML = `
      <div class="sheet-head"><h3>Status Lisensi</h3><button class="sheet-x" onclick="closeSheet('sheetLicense')">✕</button></div>
      <div class="product-list">
        ${rows.map(p => `<div class="product-row"><span class="pr-name"><b>${escapeHtml(p.prefix)}</b> · ${escapeHtml(p.name)}</span><span class="pr-price">${formatRupiah(p.price||0)}</span></div>`).join('')}
      </div>`;
  }
  overlay.classList.add('open');
}

export function exportLicenseBackup() {
  const data = { app:'admin-kasirsolo', type:'license', exportedAt:new Date().toISOString(), licenseProducts: STATE.licenseProducts||[] };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = `license-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url); showToast('Backup lisensi diunduh', 2000, 'success');
}

export async function importLicenseBackup(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const products = Array.isArray(parsed) ? parsed : parsed.licenseProducts;
    if (!Array.isArray(products)) throw new Error('Format tidak dikenali');
    const ok = await saveLicenseProducts(storage, products);
    if (ok) { renderProductRegistry(); showToast('Backup lisensi diimpor', 2000, 'success'); }
    else showToast('Gagal mengimpor', 2000, 'error');
  } catch (e) { console.error(e); showToast('File tidak valid', 3000, 'error'); }
}

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
window.importLicenseBackup = importLicenseBackup;
