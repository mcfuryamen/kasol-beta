/**
 * Admin Marketing KASIRSOLO — Settings Module
 * Settings form for landing page config
 */

import { STATE, subscribe, setState } from './app-state.js';
import { storage } from './storage.js';
import { escapeHtml } from './utils.js';
import { showToast } from './toast.js';

let settingsForm = null;

/**
 * Initialize settings module
 */
export function initSettings() {
  settingsForm = document.getElementById('settingsForm');
  if (!settingsForm) return;

  settingsForm.addEventListener('submit', handleSubmit);

  // Subscribe to settings changes
  subscribe('settings', renderSettingsForm);

  // Initial render
  renderSettingsForm();
}

/**
 * Render settings form with current state
 */
export function renderSettingsForm() {
  const s = STATE.settings || {};

  const fields = {
    setWa: s.waNumber || '',
    setEmail: s.email || '',
    setAddrLegal: s.addrLegal || '',
    setMapsLegal: s.mapsLegal || '',
    setAddrOps: s.addrOps || '',
    setMapsOps: s.mapsOps || '',
    setStatClients: s.statClients ?? 0,
    setStatUptime: s.statUptime ?? 99.9
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

/**
 * Handle form submit
 */
async function handleSubmit(e) {
  e.preventDefault();
  if (!settingsForm) return;

  const newSettings = {
    waNumber: (document.getElementById('setWa')?.value || '').trim(),
    email: (document.getElementById('setEmail')?.value || '').trim(),
    addrLegal: (document.getElementById('setAddrLegal')?.value || '').trim(),
    mapsLegal: (document.getElementById('setMapsLegal')?.value || '').trim(),
    addrOps: (document.getElementById('setAddrOps')?.value || '').trim(),
    mapsOps: (document.getElementById('setMapsOps')?.value || '').trim(),
    statClients: parseInt(document.getElementById('setStatClients')?.value) || 0,
    statUptime: parseFloat(document.getElementById('setStatUptime')?.value) || 0
  };

  // Basic validation
  if (!newSettings.waNumber) {
    showToast('Nomor WhatsApp wajib diisi', 2000, 'warning');
    return;
  }
  if (!newSettings.email) {
    showToast('Email wajib diisi', 2000, 'warning');
    return;
  }

  const success = await storage.set('settings', newSettings);
  if (success) {
    setState('settings', newSettings);
    showToast('Pengaturan disimpan', 2000, 'success');
  } else {
    showToast('Gagal menyimpan pengaturan', 2000, 'error');
    renderSettingsForm(); // Revert
  }
}