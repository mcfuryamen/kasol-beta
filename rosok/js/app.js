/* =========================================================================
   KASIR SOLO - ROSOK
   app.js — Entry point. Matched function names to HTML onclick handlers.
   ========================================================================= */
import { db } from './db.js';
import { SETTINGS, KATEGORI, loadSettingsIntoState, seedKategoriIfEmpty, seedPlatformMessagesIfEmpty, loadKategori } from './app-state.js';
import { fmtRupiah, fmtKg, fmtDate, todayStr, showLoading, hideLoading, escapeHtml, formatInputRupiah, unformatRupiah, toast, getSetting, setSetting, generateDeviceId, openOverlay, closeSheet } from './utils.js';
import { refreshAll } from './dashboard.js';
import { refreshShiftCache, openBukaKasSheet, bukaKas, openTutupKasSheet, hitungSelisihTutupKas, tutupKas, openKasForm, setKasTipe, saveKasManual } from './kas.js';
import { renderStok, openKategoriForm, saveKategori, deleteKategoriConfirm } from './kategori.js';
import { setRiwayatFilter, setRiwayatPeriode, applyRiwayatCustom, resetRiwayatPeriode, renderRiwayat, loadRiwayatPage, viewTransaksiDetail, deleteTransaksi, voidTransaksi, closeNotaSheet } from './riwayat.js';
import { setLaporanPeriode, applyLaporanCustom, resetLaporanPeriode, renderLaporan, openLunasi, saveLunasi } from './laporan.js';
import { checkLicenseGate, updateTrialChip, renderLicenseInfoCard, activateLicense, openExtendFlow, grantExtension, contactViaWA, contactViaEmail, openLicenseSheet, setLicenseRefs } from './license.js';
import { finishOnboarding } from './onboard.js';
import { renderWizardBar, renderKatGrid, openTimbang, buildKeypad, keypadPress, stepBerat, updateTimbangDisplay, confirmTimbang, renderCartChips, renderCartStep2, cartTotal, removeCartItem, setMetodeBayar, calcKembalian, saveTransaksi, renderNota, shareNotaWA, goToStep, switchTransTab } from './pos.js';
import { showScreen, openTransaksi, navigateScreen } from './nav.js';
import { markReady, getRoute } from './router.js';

// ── Wire cross-module refs ────────────────────────────────────────────────
import { setPosRefs } from './pos.js';
import { setRiwayatRefs } from './riwayat.js';
setPosRefs({ refreshAll });
setRiwayatRefs({ refreshAll });

// ── Cache DB ──────────────────────────────────────────────────────────────
window._ksr_db = db;

// ── Cache DOM ──────────────────────────────────────────────────────────────
function cacheDomElements() {
  const ids = ['timbangKgVal', 'timbangUnitLbl', 'timbangSubtotal', 'katGrid', 'riwayatCard',
    'lapBeli', 'lapJual', 'lapPengeluaran', 'lapSaldo', 'lapLabaKotor',
    'lapUtang', 'lapPiutang', 'lapLaba', 'barChart', 'topKategoriList', 'tempoList',
    'kasList', 'kasSaldoBadge', 'kasShiftHistoryList'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) window['_ksr_' + id] = el; });
}

// ── Logo ──────────────────────────────────────────────────────────────────
document.getElementById('headerLogo').src = 'assets/logo.png';
document.getElementById('lockLogo').src = 'assets/logo.png';
document.getElementById('onbLogo').src = 'assets/logo.png';

// ── Service Worker ─────────────────────────────────────────────────────────
if ("serviceWorker" in navigator && window.location.protocol !== 'file:') {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").then(function (reg) {
      reg.addEventListener("updatefound", function () {
        const nw = reg.installing;
        nw.addEventListener("statechange", function () {
          if (nw.state === "activated") {
            if (confirm('Update tersedia. Reload sekarang?')) window.location.reload();
          }
        });
      });
    }).catch(e => console.error('[SW Error]', e));
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}

// ── Settings ──────────────────────────────────────────────────────────────
async function saveBizIdentity() {
  await setSetting('bizName', document.getElementById('setBizName').value.trim());
  await setSetting('bizAddr', document.getElementById('setBizAddr').value.trim());
  await setSetting('bizBank', document.getElementById('setBizBank') ? document.getElementById('setBizBank').value.trim() : '');
  await setSetting('bizPhone', document.getElementById('setBizPhone').value.trim());
  await loadSettingsIntoState();
  toast('Identitas usaha tersimpan');
}

async function exportData() {
  showLoading('Mengekspor data...');
  try {
    const data = {
      settings: await db.settings.toArray(),
      kategori: await db.kategori.toArray(),
      transaksi: await db.transaksi.toArray(),
      transaksiItem: await db.transaksiItem.toArray(),
      kas: await db.kas.toArray(),
      kasShift: await db.kasShift.toArray(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cadangan-kasir-rosok-${todayStr()}.json`;
    a.click();
    toast('Cadangan data diunduh');
  } catch (e) { console.error('Export error:', e); toast('Gagal mengekspor data'); }
  finally { hideLoading(); }
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  showLoading('Mengimpor data...');
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!confirm('Impor akan menimpa semua data. Lanjutkan?')) { hideLoading(); return; }
      await db.transaction('rw', db.settings, db.kategori, db.transaksi, db.transaksiItem, db.kas, db.kasShift, async () => {
        await db.settings.clear(); await db.kategori.clear(); await db.transaksi.clear();
        await db.transaksiItem.clear(); await db.kas.clear(); await db.kasShift.clear();
        if (data.settings) await db.settings.bulkAdd(data.settings);
        if (data.kategori) await db.kategori.bulkAdd(data.kategori);
        if (data.transaksi) await db.transaksi.bulkAdd(data.transaksi);
        if (data.transaksiItem) await db.transaksiItem.bulkAdd(data.transaksiItem);
        if (data.kas) await db.kas.bulkAdd(data.kas);
        if (data.kasShift) await db.kasShift.bulkAdd(data.kasShift);
      });
      toast('Data berhasil diimpor');
      hideLoading();
      location.reload();
    } catch (err) { console.error('Import error:', err); toast('Gagal impor: file tidak valid'); hideLoading(); }
  };
  reader.readAsText(file);
}

function confirmResetData() {
  if (!confirm('Yakin hapus SEMUA data transaksi, stok, dan kas?')) return;
  if (!confirm('Konfirmasi: semua data akan hilang permanen.')) return;
  Promise.all([db.transaksi.clear(), db.transaksiItem.clear(), db.kas.clear(), db.kasShift.clear()])
    .then(async () => { await db.kategori.toCollection().modify({ stokKg: 0 }); await loadKategori(); toast('Semua data dihapus'); refreshAll(); });
}

// ── INIT ──────────────────────────────────────────────────────────────────
import { getDeviceCode } from './license.js';

// Wire refs lisensi supaya checkLicenseGate() bisa memanggil updateTrialChip,
// renderLicenseInfoCard, dan alur extend/grant (tanpa circular import).
setLicenseRefs({ updateTrialChip, renderLicenseInfoCard, checkLicenseGate, openExtendFlow, grantExtension, openLicenseSheet });

async function initApp() {
  // initApp started
  cacheDomElements();
  try {
    let deviceId = await getSetting('deviceId', null);
    if (!deviceId) { deviceId = generateDeviceId(); await setSetting('deviceId', deviceId); }
    await setSetting('deviceCode', getDeviceCode(deviceId));
    let setupDone = await getSetting('setupDone', false);
    let trialStart = await getSetting('trialStart', null);
    if (!trialStart) { trialStart = new Date().toISOString(); await setSetting('trialStart', trialStart); }
    await loadSettingsIntoState();
    await seedKategoriIfEmpty();
    await seedPlatformMessagesIfEmpty();
    await loadKategori();
    await refreshAll();
    if (!setupDone) openOverlay('sheetOnboarding');
    else checkLicenseGate();
  } catch (error) { console.error('Init error:', error); toast('Gagal memuat aplikasi: ' + error.message); }
  // initApp completed
  markReady();

  // Toggle kas bar buttons depending on shift state
  async function updateKasBarButtons(){
    try{
      // refreshShiftCache returns the current open shift (or null)
      const shift = await refreshShiftCache();
      const btnToggle = document.getElementById('btnToggleKas');
      const btnManual = document.getElementById('btnOpenKasManual');
      if(!btnToggle || !btnManual) return;
      if(shift){
        // shift open -> show 'Tutup Kas'
        btnToggle.className = 'btn btn-primary';
        btnToggle.textContent = '🔒 Tutup Kas';
        btnToggle.onclick = () => openTutupKasSheet();
      } else {
        // no shift -> show 'Buka Kas'
        btnToggle.className = 'btn btn-outline';
        btnToggle.textContent = '🔓 Buka Kas';
        btnToggle.onclick = () => openBukaKasSheet();
      }
    }catch(e){ console.error('updateKasBarButtons error', e); }
  }
  // expose so external listeners can call it even if defined inside initApp
  window.updateKasBarButtons = updateKasBarButtons;

  // global handler for onclick in HTML
  window.handleToggleKasClick = async function(){
    try{
      await refreshShiftCache();
      const shift = openShiftCache;
      if(shift) openTutupKasSheet(); else openBukaKasSheet();
    }catch(e){ console.error('handleToggleKasClick error', e); }
  };

}

// ── Global exports — EXACT function names matching onclick handlers in HTML ─────────────────
// Navigation
window.showScreen = showScreen;
window.openTransaksi = openTransaksi;
window.navigateScreen = showScreen; // Alias for old HTML

// POS — EXACT names as in original HTML
window.goToStep = goToStep;
window.switchTransTab = switchTransTab;
window.renderWizardBar = renderWizardBar;
window.renderKatGrid = renderKatGrid;
window.openTimbang = openTimbang;
window.buildKeypad = buildKeypad;
window.keypadPress = keypadPress;
window.stepBerat = stepBerat;
window.updateTimbangDisplay = updateTimbangDisplay;
window.confirmTimbang = confirmTimbang;
window.renderCartChips = renderCartChips;
window.renderCartStep2 = renderCartStep2;
window.cartTotal = cartTotal;
window.removeCartItem = removeCartItem;
window.setMetodeBayar = setMetodeBayar;
window.calcKembalian = calcKembalian;
window.saveTransaksi = saveTransaksi;
window.renderNota = renderNota;
window.shareNotaWA = shareNotaWA;
window.setSatuan = window.setSatuan || (() => { }); // Ensure setSatuan exists
// UI: respond to state-driven satuan changes (separate DOM updates from state module)
window.addEventListener('ksr-satuan-changed', (ev) => {
  const u = ev.detail;
  document.querySelectorAll('#satuanTabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.u === u));
});
// Set initial active satuan tab (default 'kg')
document.addEventListener('DOMContentLoaded', () => {
  const defaultU = 'kg';
  document.querySelectorAll('#satuanTabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.u === defaultU));
});

// Kategori
window.renderStok = renderStok;
window.openKategoriForm = openKategoriForm;
window.saveKategori = saveKategori;
window.deleteKategoriConfirm = deleteKategoriConfirm;

// Riwayat
window.setRiwayatFilter = setRiwayatFilter;
window.setRiwayatPeriode = setRiwayatPeriode;
window.applyRiwayatCustom = applyRiwayatCustom;
window.resetRiwayatPeriode = resetRiwayatPeriode;
window.renderRiwayat = renderRiwayat;
window.loadRiwayatPage = loadRiwayatPage;
window.viewTransaksiDetail = viewTransaksiDetail;
window.deleteTransaksi = deleteTransaksi;
window.voidTransaksi = voidTransaksi;
window.closeNotaSheet = closeNotaSheet;
window._ksr_viewDetail = viewTransaksiDetail;
window._ksr_deleteTrans = deleteTransaksi;
window._ksr_voidTrans = voidTransaksi;

// Laporan
window.setLaporanPeriode = setLaporanPeriode;
window.applyLaporanCustom = applyLaporanCustom;
window.resetLaporanPeriode = resetLaporanPeriode;
window.renderLaporan = renderLaporan;
window.openLunasi = openLunasi;
window.saveLunasi = saveLunasi;
window._ksr_openLunasi = openLunasi;

// Kas
window.openBukaKasSheet = openBukaKasSheet;
window.bukaKas = bukaKas;
window.openTutupKasSheet = openTutupKasSheet;
window.hitungSelisihTutupKas = hitungSelisihTutupKas;
window.tutupKas = tutupKas;
window.openKasForm = openKasForm;
window.setKasTipe = setKasTipe;
window.saveKasManual = saveKasManual;
window._ksr_openBukaKasSheet = openBukaKasSheet;
window._ksr_tutupKas = tutupKas;

// License
window.checkLicenseGate = checkLicenseGate;
window.updateTrialChip = updateTrialChip;
window.renderLicenseInfoCard = renderLicenseInfoCard;
window.activateLicense = activateLicense;
window.openExtendFlow = openExtendFlow;
window.grantExtension = grantExtension;
window.contactViaWA = contactViaWA;
window.contactViaEmail = contactViaEmail;
window.openLicenseSheet = openLicenseSheet;
window._ksr_activateLicense = activateLicense;
window._ksr_openExtendFlow = openExtendFlow;
window._ksr_contactViaWA = contactViaWA;

// Onboarding
window.finishOnboarding = finishOnboarding;
window._ksr_finishOnboarding = finishOnboarding;

// Settings
window.saveBizIdentity = saveBizIdentity;
window.exportData = exportData;
window.importData = importData;
window.confirmResetData = confirmResetData;
window._ksr_openLicenseSheet = openLicenseSheet;

// Utility
window.formatInputRupiah = formatInputRupiah;
window.unformatRupiah = unformatRupiah;
window.closeSheet = closeSheet;
window.openOverlay = openOverlay;
window.getDeviceCode = getDeviceCode;
window._ksr_removeCartItem = removeCartItem;
window._ksr_closeNota = closeNotaSheet;
window._ksr_openKategoriForm = openKategoriForm;
window._ksr_viewTransaksiDetail = viewTransaksiDetail;

// ── Boot ──────────────────────────────────────────────────────────────────
window.addEventListener('ksr-kas-changed', () => { try{ if(typeof updateKasBarButtons === 'function') updateKasBarButtons(); }catch(e){}});
window.addEventListener('load', async () => { await initApp(); try{ if(typeof updateKasBarButtons === 'function') updateKasBarButtons(); }catch(e){} });
setInterval(() => { if (SETTINGS.setupDone) checkLicenseGate(); }, 60000);
