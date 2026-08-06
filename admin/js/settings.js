/**
 * Admin Marketing KASIRSOLO — Settings Module
 * Settings form for landing page config & business info
 */

import { STATE, subscribe, setState } from './app-state.js';
import { storage } from './storage.js';
import { escapeHtml } from './utils.js';
import { showToast } from './toast.js';

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