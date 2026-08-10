/**
 * Admin Console — Settings Module
 * Info usaha + landing config + backup. Fields mapped to shell IDs.
 */

import { STATE, subscribe, setState } from './app-state.js';
import { storage } from './storage.js';
import { showToast } from './toast.js';

export function initSettings() {
  subscribe('settings', renderSettingsForm);
  subscribe('catalog', renderSettingsForm);
  renderSettingsForm();
  document.querySelector('button[onclick="saveBizSettings()"]')?.addEventListener('click', saveBizSettings);
  document.querySelector('button[onclick="saveLandingSettings()"]')?.addEventListener('click', saveLandingSettings);
}

export function renderSettingsForm() {
  const s = STATE.settings || {};
  const biz = { setBizName:s.bizName, setBizTag:s.bizTag, setBizAddr:s.bizAddr, setBizPhone:s.bizPhone, setBizEmail:s.bizEmail, setBizWa:s.bizWa, setBizIg:s.bizIg };
  Object.entries(biz).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v || ''; });
  const landing = { setHeroTitle:s.heroTitle, setHeroDesc:s.heroDesc, setHeroCta:s.heroCta };
  Object.entries(landing).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v || ''; });
}

window.saveBizSettings = async function() {
  const newSettings = { ...(STATE.settings||{}),
    bizName:(document.getElementById('setBizName')?.value||'').trim(),
    bizTag:(document.getElementById('setBizTag')?.value||'').trim(),
    bizAddr:(document.getElementById('setBizAddr')?.value||'').trim(),
    bizPhone:(document.getElementById('setBizPhone')?.value||'').trim(),
    bizEmail:(document.getElementById('setBizEmail')?.value||'').trim(),
    bizWa:(document.getElementById('setBizWa')?.value||'').trim(),
    bizIg:(document.getElementById('setBizIg')?.value||'').trim() };
  if (!newSettings.bizName) { showToast('Nama usaha wajib', 2000, 'warning'); return; }
  if (!newSettings.bizWa) showToast('WhatsApp wajib', 2000, 'warning');
  if (!newSettings.bizEmail) showToast('Email wajib', 2000, 'warning');
  const ok = await storage.set('settings', newSettings);
  if (ok) { setState('settings', newSettings); showToast('Info usaha disimpan', 2000, 'success'); }
  else { showToast('Gagal menyimpan', 2000, 'error'); renderSettingsForm(); }
};

window.saveLandingSettings = async function() {
  const newSettings = { ...(STATE.settings||{}),
    heroTitle:(document.getElementById('setHeroTitle')?.value||'').trim(),
    heroDesc:(document.getElementById('setHeroDesc')?.value||'').trim(),
    heroCta:(document.getElementById('setHeroCta')?.value||'').trim() };
  const ok = await storage.set('settings', newSettings);
  if (ok) { setState('settings', newSettings); showToast('Landing disimpan', 2000, 'success'); }
  else { showToast('Gagal menyimpan', 2000, 'error'); renderSettingsForm(); }
};

window.exportAdminBackup = async function() {
  try {
    const data = { version:'1.0', timestamp:new Date().toISOString(), settings:STATE.settings||{}, catalog:STATE.catalog||[], leads:STATE.leads||[], products:STATE.products||{}, license:STATE.license||{} };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download = `kasir-admin-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url); showToast('Backup diekspor', 2000, 'success');
  } catch (e) { console.error(e); showToast('Gagal ekspor', 2000, 'error'); }
};

window.importAdminBackup = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.version) throw new Error('Format tidak valid');
    if (data.settings) { await storage.set('settings', data.settings); setState('settings', data.settings); }
    if (data.catalog) { await storage.set('catalog', data.catalog); setState('catalog', data.catalog); }
    if (data.leads) { await storage.set('leads', data.leads); setState('leads', data.leads); }
    if (data.products) { await storage.set('products', data.products); setState('products', data.products); }
    if (data.license) { await storage.set('license', data.license); setState('license', data.license); }
    showToast('Backup diimpor', 2000, 'success');
    if (document.querySelector('.main > .screen.active')?.id === 'screen-settings') renderSettingsForm();
  } catch (e) { console.error(e); showToast('Gagal impor: '+e.message, 3000, 'error'); }
  finally { event.target.value = ''; }
};

window.confirmResetAdminData = function() {
  if (confirm('⚠️ Hapus SEMUA data admin? Tidak bisa dibatalkan.')) resetAdminData();
};

async function resetAdminData() {
  try {
    await storage.clearAll();
    setState('settings', {}); setState('catalog', []); setState('leads', []); setState('products', {}); setState('license', {});
    showToast('Semua data dihapus', 2000, 'success'); renderSettingsForm();
  } catch (e) { console.error(e); showToast('Gagal menghapus', 2000, 'error'); }
}

window.finishAdminOnboarding = async function() {
  const bizName = document.getElementById('onbBizName')?.value.trim();
  const ownerName = document.getElementById('onbOwnerName')?.value.trim();
  const phone = document.getElementById('onbPhone')?.value.trim();
  if (!bizName) { showToast('Nama usaha wajib', 2000, 'warning'); document.getElementById('onbBizName')?.focus(); return; }
  const newSettings = { ...(STATE.settings||{}), bizName, ownerName:ownerName||'Admin', phone:phone||'' };
  const ok = await storage.set('settings', newSettings);
  if (ok) setState('settings', newSettings);
  const overlay = document.getElementById('sheetOnboarding'); if (overlay) overlay.classList.remove('open');
  showToast(ok ? 'Pengaturan awal tersimpan 🎉' : 'Gagal menyimpan', 2000, ok ? 'success' : 'error');
  window.dispatchEvent(new CustomEvent('app:ready'));
};
