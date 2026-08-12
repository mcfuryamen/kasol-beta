/**
 * Admin Marketing KASIRSOLO — Settings Module
 * Settings form for landing page config & business info
 */

import { STATE, subscribe, setState } from './app-state.js';
import { storage } from './storage.js';
import { showToast } from './toast.js';
import { supabaseFetch } from './api.js';

/**
 * Initialize settings module
 */
export function initSettings() {
  // Subscribe to settings changes
  subscribe('settings', renderSettingsForm);
  subscribe('catalog', renderSettingsForm); // for app count in info
  
  // Initial render
  renderSettingsForm();

  // Bind save buttons
  const saveBizBtn = document.querySelector('button[onclick="saveBizSettings()"]');
  if (saveBizBtn) saveBizBtn.addEventListener('click', saveBizSettings);

  const saveLandingBtn = document.querySelector('button[onclick="saveLandingSettings()"]');
  if (saveLandingBtn) saveLandingBtn.addEventListener('click', saveLandingSettings);

  // Payment settings (QRIS + bank) — load dari Supabase `settings`
  loadPaymentSettings();
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

// ==================== PEMBAYARAN LISENSI (QRIS + Rekening) ====================
// Disimpan ke Supabase tabel `settings` (key qris_url & bank_info) supaya dibaca
// oleh aplikasi klien (kaki5/js/purchase.js). BUKAN localStorage.

function paymentMsg(text, type) {
  const el = document.getElementById('paymentStatusMsg');
  if (el) {
    el.textContent = text || '';
    if (type) {
      el.style.color = type === 'error' ? 'var(--danger,#dc2626)' : 'var(--success,#16a34a)';
    }
  }
}

async function fetchSettingsRows() {
  const res = await supabaseFetch('/rest/v1/settings?select=key,value');
  if (!res.ok) throw new Error('Gagal membaca settings: HTTP ' + res.status);
  return Array.isArray(res.data) ? res.data : [];
}

/** Mengisi form pembayaran dari Supabase `settings`. */
window.loadPaymentSettings = async function() {
  paymentMsg('');
  try {
    const rows = await fetchSettingsRows();
    const qris = rows.find(r => r.key === 'qris_url');
    const bank = rows.find(r => r.key === 'bank_info');

    const parseVal = (row) => {
      if (!row || row.value == null) return {};
      if (typeof row.value === 'string') {
        try { return JSON.parse(row.value); } catch { return {}; }
      }
      return row.value || {};
    };

    const qrisVal = parseVal(qris);
    const bankVal = parseVal(bank);

    const elQris = document.getElementById('payQrisUrl');
    const elBank = document.getElementById('payBankName');
    const elNumber = document.getElementById('payBankNumber');
    const elHolder = document.getElementById('payBankHolder');

    if (elQris) elQris.value = qrisVal.url || '';
    if (elBank) elBank.value = bankVal.bank || '';
    if (elNumber) elNumber.value = bankVal.account_number || '';
    if (elHolder) elHolder.value = bankVal.account_name || '';

    paymentMsg('✔ Data pembayaran dimuat dari Supabase.');
  } catch (e) {
    console.error('loadPaymentSettings:', e);
    paymentMsg('Gagal memuat: ' + e.message, 'error');
    showToast('Gagal memuat pembayaran', 2000, 'error');
  }
};

/** Menyimpan QRIS + bank ke Supabase `settings` (upsert 2 key). */
window.savePaymentSettings = async function() {
  const qrisUrl = (document.getElementById('payQrisUrl')?.value || '').trim();
  const bank = (document.getElementById('payBankName')?.value || '').trim();
  const accountNumber = (document.getElementById('payBankNumber')?.value || '').trim();
  const accountName = (document.getElementById('payBankHolder')?.value || '').trim();

  if (!qrisUrl) {
    paymentMsg('URL QRIS wajib diisi.', 'error');
    showToast('URL QRIS wajib diisi', 2000, 'warning');
    return;
  }

  paymentMsg('');
  const now = new Date().toISOString();

  try {
    // Upsert key qris_url
    const r1 = await supabaseFetch('/rest/v1/settings?key=eq.qris_url', {
      method: 'PATCH',
      data: {
        value: { url: qrisUrl },
        updated_at: now
      },
      headers: { Prefer: 'return=representation' }
    });
    if (!r1.ok) throw new Error('Gagal simpan qris_url: HTTP ' + r1.status);

    // Upsert key bank_info
    const bankVal = { bank, account_number: accountNumber, account_name: accountName };
    const r2 = await supabaseFetch('/rest/v1/settings?key=eq.bank_info', {
      method: 'PATCH',
      data: {
        value: bankVal,
        updated_at: now
      },
      headers: { Prefer: 'return=representation' }
    });
    if (!r2.ok && r2.status !== 404) throw new Error('Gagal simpan bank_info: HTTP ' + r2.status);

    // Kalau baris belum ada, insert
    if (r2.status === 404 || (r2.ok && Array.isArray(r2.data) && r2.data.length === 0)) {
      const r3 = await supabaseFetch('/rest/v1/settings', {
        method: 'POST',
        data: {
          key: 'bank_info',
          value: bankVal,
          updated_at: now
        }
      });
      if (!r3.ok) throw new Error('Gagal insert bank_info: HTTP ' + r3.status);
    }

    paymentMsg('✔ QRIS & rekening bank berhasil disimpan ke Supabase.');
    showToast('Pembayaran lisensi tersimpan! 💾', 2500, 'success');
  } catch (e) {
    console.error('savePaymentSettings:', e);
    paymentMsg('Gagal menyimpan: ' + e.message, 'error');
    showToast('Gagal menyimpan pembayaran', 2500, 'error');
  }
};