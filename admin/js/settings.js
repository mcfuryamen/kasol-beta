/**
 * Admin Marketing KASIRSOLO — Settings Module
 * Settings form for landing page config & business info
 */

import { STATE, subscribe, setState } from './app-state.js';
import { storage } from './storage.js';
import { showToast } from './toast.js';
import { supabaseFetch, supabaseStorageUpload } from './api.js';

function escapeAttribute(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const MAX_QRIS_SIZE = 5 * 1024 * 1024;
const QRIS_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const MOCK_PAYMENT_SETTINGS = {
  qrisUrl: '',
  bank: '',
  accountNumber: '',
  accountName: ''
};

function getPaymentSettings(settings = STATE.settings || {}) {
  return {
    ...MOCK_PAYMENT_SETTINGS,
    ...(settings.payment || {})
  };
}

/**
 * Initialize settings module
 */
export function initSettings() {
  // Subscribe to settings changes
  subscribe('settings', renderSettingsForm);
  subscribe('catalog', renderSettingsForm); // for app count in info
  
  // Initial render
  renderSettingsForm();
  syncPaymentSettingsFromSupabase();

  // Bind save buttons
  const saveBizBtn = document.querySelector('button[onclick="saveBizSettings()"]');
  if (saveBizBtn) saveBizBtn.addEventListener('click', saveBizSettings);

  const saveLandingBtn = document.querySelector('button[onclick="saveLandingSettings()"]');
  if (saveLandingBtn) saveLandingBtn.addEventListener('click', saveLandingSettings);

  const savePaymentBtn = document.querySelector('button[onclick="savePaymentSettings()"]');
  if (savePaymentBtn) savePaymentBtn.addEventListener('click', savePaymentSettings);

  const qrisUpload = document.getElementById('setQrisUpload');
  if (qrisUpload) qrisUpload.addEventListener('change', handleQrisUpload);
}

/**
 * Render settings form with current state
 */
export function renderSettingsForm() {
  const s = STATE.settings || {};

  // Biz info fields
  const bizFields = {
    setBizName: s.bizName || '',
    setBizTag: s.bizTag || '',
    setBizAddr: s.bizAddr || '',
    setBizPhone: s.bizPhone || '',
    setBizEmail: s.bizEmail || '',
    setBizWa: s.bizWa || '',
    setBizIg: s.bizIg || ''
  };

  Object.entries(bizFields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  // Landing page fields
  const landingFields = {
    setHeroTitle: s.heroTitle || '',
    setHeroDesc: s.heroDesc || '',
    setHeroCta: s.heroCta || ''
  };

  const payment = getPaymentSettings(s);
  const paymentFields = {
    setQrisUrl: payment.qrisUrl,
    setBankName: payment.bank,
    setAccountNumber: payment.accountNumber,
    setAccountName: payment.accountName
  };

  Object.entries(paymentFields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  const qrisPreview = document.getElementById('qrisUploadPreview');
  if (qrisPreview) {
    qrisPreview.innerHTML = payment.qrisUrl
      ? `<img src="${escapeAttribute(payment.qrisUrl)}" alt="Preview QRIS merchant" loading="lazy"><span>QRIS tersimpan</span>`
      : '';
    qrisPreview.hidden = !payment.qrisUrl;
  }

  // Link aplikasi klien
  const appLinks = (STATE.settings?.appLinks) || {};
  ['kaki5', 'gerobak', 'rosok', 'retail', 'fnb'].forEach((t) => {
    const el = document.getElementById('appLink_' + t);
    if (el) el.value = appLinks[t] || '';
  });
  const appLinksStatus = document.getElementById('appLinksStatus');
  if (appLinksStatus) {
    const configured = Object.values(appLinks).some(Boolean);
    appLinksStatus.textContent = configured ? 'Siap dipakai' : 'Belum diatur';
    appLinksStatus.classList.toggle('is-ready', !!configured);
  }

  const paymentStatus = document.getElementById('paymentSettingsStatus');
  if (paymentStatus) {
    const configured = payment.qrisUrl || payment.bank || payment.accountNumber || payment.accountName;
    paymentStatus.textContent = configured ? 'Siap dipakai' : 'Mode demo';
    paymentStatus.classList.toggle('is-ready', !!configured);
  }

  Object.entries(landingFields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

/**
 * Save business info settings
 */
window.saveBizSettings = async function() {
  const newSettings = {
    ...(STATE.settings || {}),
    bizName: (document.getElementById('setBizName')?.value || '').trim(),
    bizTag: (document.getElementById('setBizTag')?.value || '').trim(),
    bizAddr: (document.getElementById('setBizAddr')?.value || '').trim(),
    bizPhone: (document.getElementById('setBizPhone')?.value || '').trim(),
    bizEmail: (document.getElementById('setBizEmail')?.value || '').trim(),
    bizWa: (document.getElementById('setBizWa')?.value || '').trim(),
    bizIg: (document.getElementById('setBizIg')?.value || '').trim()
  };

  // Basic validation
  if (!newSettings.bizName) {
    showToast('Nama usaha wajib diisi', 2000, 'warning');
    return;
  }
  if (!newSettings.bizWa) {
    showToast('Nomor WhatsApp wajib diisi', 2000, 'warning');
  }
  if (!newSettings.bizEmail) {
    showToast('Email wajib diisi', 2000, 'warning');
  }

  const success = await storage.set('settings', newSettings);
  if (success) {
    setState('settings', newSettings);
    showToast('Info usaha disimpan', 2000, 'success');
  } else {
    showToast('Gagal menyimpan info usaha', 2000, 'error');
    renderSettingsForm(); // Revert
  }
};

/**
 * Save landing page config
 */
async function syncPaymentSettingsFromSupabase() {
  try {
    const res = await supabaseFetch('/rest/v1/settings?key=in.(qris_url,bank_info,app_links)&select=key,value');
    if (!res.ok || !Array.isArray(res.data) || !res.data.length) return;
    const fromCloud = { ...getPaymentSettings() };
    const appLinks = { ...(STATE.settings?.appLinks || {}) };
    res.data.forEach((row) => {
      const value = typeof row.value === 'string' ? (() => { try { return JSON.parse(row.value); } catch { return {}; } })() : (row.value || {});
      if (row.key === 'qris_url') fromCloud.qrisUrl = value.url || '';
      if (row.key === 'bank_info') {
        fromCloud.bank = value.bank || '';
        fromCloud.accountNumber = value.account_number || '';
        fromCloud.accountName = value.account_name || '';
      }
      if (row.key === 'app_links' && typeof value === 'object') Object.assign(appLinks, value);
    });
    const merged = { ...(STATE.settings || {}), payment: fromCloud, appLinks };
    await storage.set('settings', merged);
    setState('settings', merged);
  } catch (error) {
    console.warn('Payment settings sync skipped:', error);
  }
}

async function handleQrisUpload(event) {
  const file = event.target.files?.[0];
  const preview = document.getElementById('qrisUploadPreview');
  if (!file) return;
  if (!QRIS_TYPES.has(file.type)) {
    showToast('Format QRIS harus PNG, JPG, atau WebP', 2500, 'warning');
    event.target.value = '';
    return;
  }
  if (file.size > MAX_QRIS_SIZE) {
    showToast('Ukuran gambar QRIS maksimal 5 MB', 2500, 'warning');
    event.target.value = '';
    return;
  }

  const localUrl = URL.createObjectURL(file);
  if (preview) {
    preview.innerHTML = `<img src="${escapeAttribute(localUrl)}" alt="Preview QRIS yang dipilih"><span>Meng-upload QRIS…</span>`;
    preview.hidden = false;
  }

  const upload = await supabaseStorageUpload('qris', file);
  if (!upload.ok || !upload.data?.publicUrl) {
    showToast(upload.data?.error || 'Upload QRIS gagal. Coba lagi.', 3000, 'error');
    return;
  }
  const urlInput = document.getElementById('setQrisUrl');
  if (urlInput) urlInput.value = upload.data.publicUrl;
  if (preview) preview.innerHTML = `<img src="${escapeAttribute(upload.data.publicUrl)}" alt="Preview QRIS merchant"><span>QRIS berhasil di-upload</span>`;
  showToast('QRIS berhasil di-upload. Klik Simpan untuk menerapkan.', 3000, 'success');
}

window.savePaymentSettings = async function() {
  const payment = {
    qrisUrl: (document.getElementById('setQrisUrl')?.value || '').trim(),
    bank: (document.getElementById('setBankName')?.value || '').trim(),
    accountNumber: (document.getElementById('setAccountNumber')?.value || '').trim(),
    accountName: (document.getElementById('setAccountName')?.value || '').trim()
  };

  if (payment.qrisUrl && !/^https?:\/\//i.test(payment.qrisUrl)) {
    showToast('URL QRIS harus diawali http:// atau https://', 2500, 'warning');
    return;
  }
  const hasBankDetails = payment.bank || payment.accountNumber || payment.accountName;
  if (hasBankDetails && (!payment.bank || !payment.accountNumber || !payment.accountName)) {
    showToast('Lengkapi semua detail rekening atau kosongkan semuanya', 2500, 'warning');
    return;
  }

  const cloudRows = [
    { key: 'qris_url', value: { url: payment.qrisUrl } },
    { key: 'bank_info', value: { bank: payment.bank, account_number: payment.accountNumber, account_name: payment.accountName } }
  ];
  const cloudRes = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
    method: 'POST',
    data: cloudRows,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
  if (!cloudRes.ok) {
    showToast('Gagal menyimpan pembayaran ke Supabase', 2500, 'error');
    return;
  }

  const newSettings = { ...(STATE.settings || {}), payment };
  const success = await storage.set('settings', newSettings);
  if (success) {
    setState('settings', newSettings);
    showToast('Pengaturan pembayaran Kaki5 disimpan', 2000, 'success');
  } else {
    showToast('Gagal menyimpan pengaturan pembayaran', 2000, 'error');
    renderSettingsForm();
  }
};

window.saveAppLinks = async function() {
  const APP_TYPES = ['kaki5', 'gerobak', 'rosok', 'retail', 'fnb'];
  const appLinks = {};
  for (const t of APP_TYPES) {
    const v = (document.getElementById('appLink_' + t)?.value || '').trim();
    if (v && !/^https?:\/\//i.test(v)) {
      showToast('URL ' + t + ' harus diawali http:// atau https://', 2500, 'warning');
      return;
    }
    appLinks[t] = v;
  }

  const cloudRes = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
    method: 'POST',
    data: [{ key: 'app_links', value: appLinks }],
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
  if (!cloudRes.ok) {
    showToast('Gagal menyimpan link aplikasi ke Supabase', 2500, 'error');
    return;
  }

  const newSettings = { ...(STATE.settings || {}), appLinks };
  const success = await storage.set('settings', newSettings);
  if (success) {
    setState('settings', newSettings);
    showToast('Link aplikasi klien disimpan', 2000, 'success');
  } else {
    showToast('Gagal menyimpan link aplikasi', 2000, 'error');
    renderSettingsForm();
  }
};

window.saveLandingSettings = async function() {
  const newSettings = {
    ...(STATE.settings || {}),
    heroTitle: (document.getElementById('setHeroTitle')?.value || '').trim(),
    heroDesc: (document.getElementById('setHeroDesc')?.value || '').trim(),
    heroCta: (document.getElementById('setHeroCta')?.value || '').trim()
  };

  const success = await storage.set('settings', newSettings);
  if (success) {
    setState('settings', newSettings);
    showToast('Landing page config disimpan', 2000, 'success');
  } else {
    showToast('Gagal menyimpan landing config', 2000, 'error');
    renderSettingsForm(); // Revert
  }
};

/**
 * Export admin backup
 */
window.exportAdminBackup = async function() {
  try {
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      settings: STATE.settings || {},
      catalog: STATE.catalog || [],
      leads: STATE.leads || [],
      products: STATE.products || [],
      license: STATE.license || {}
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kasir-admin-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup berhasil diekspor', 2000, 'success');
  } catch (e) {
    console.error('Export backup error:', e);
    showToast('Gagal ekspor backup', 2000, 'error');
  }
};

/**
 * Import admin backup
 */
window.importAdminBackup = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate structure
    if (!data.version) throw new Error('Format backup tidak valid');

    // Restore each section
    if (data.settings) {
      await storage.set('settings', data.settings);
      setState('settings', data.settings);
    }
    if (data.catalog) {
      await storage.set('catalog', data.catalog);
      setState('catalog', data.catalog);
    }
    if (data.leads) {
      await storage.set('leads', data.leads);
      setState('leads', data.leads);
    }
    if (data.products) {
      await storage.set('products', data.products);
      setState('products', data.products);
    }
    if (data.license) {
      await storage.set('license', data.license);
      setState('license', data.license);
    }

    showToast('Backup berhasil diimpor', 2000, 'success');
    // Refresh current screen
    const currentScreen = document.querySelector('.main > .screen.active');
    if (currentScreen && currentScreen.id === 'screen-settings') {
      renderSettingsForm();
    }
  } catch (e) {
    console.error('Import backup error:', e);
    showToast('Gagal impor backup: ' + e.message, 3000, 'error');
  } finally {
    event.target.value = ''; // Reset file input
  }
};

/**
 * Confirm reset all admin data
 */
window.confirmResetAdminData = function() {
  if (confirm('⚠️ PERINGATAN: Akan menghapus SEMUA data admin (leads, katalog, settings, produk lisensi). Tindakan ini TIDAK DAPAT DIBATALKAN.\n\nLanjutkan?')) {
    resetAdminData();
  }
};

async function resetAdminData() {
  try {
    await storage.clearAll();
    // Reset state
    setState('settings', {});
    setState('catalog', []);
    setState('leads', []);
    setState('products', []);
    setState('license', {});
    showToast('Semua data admin dihapus', 2000, 'success');
    renderSettingsForm();
  } catch (e) {
    console.error('Reset error:', e);
    showToast('Gagal menghapus data', 2000, 'error');
  }
}

/**
 * Selesaikan onboarding pertama kali (tombol "Mulai Pakai Admin")
 */
window.finishAdminOnboarding = async function() {
  const bizName = document.getElementById('onbBizName')?.value.trim();
  const ownerName = document.getElementById('onbOwnerName')?.value.trim();
  const phone = document.getElementById('onbPhone')?.value.trim();

  if (!bizName) {
    showToast('Nama usaha wajib diisi', 2000, 'warning');
    document.getElementById('onbBizName')?.focus();
    return;
  }

  const newSettings = {
    ...(STATE.settings || {}),
    bizName,
    ownerName: ownerName || 'Admin',
    phone: phone || ''
  };

  const ok = await storage.set('settings', newSettings);
  if (ok) setState('settings', newSettings);

  const overlay = document.getElementById('sheetOnboarding');
  if (overlay) overlay.classList.remove('open');

  showToast(ok ? 'Pengaturan awal tersimpan! 🎉' : 'Gagal menyimpan pengaturan', 2000, ok ? 'success' : 'error');
  window.dispatchEvent(new CustomEvent('app:ready'));
};