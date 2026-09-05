// ==================== APP ENTRY (ESM) ====================
// Kaki Lima POS System - Modular Atomic Architecture
// Entry point that wires ESM modules to window globals
// Supports lazy-loading, navigation, and feature modules
if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Starting...');
// Single entry module loaded via <script type="module" src="js/app.js">.
// ESM keeps module scope private, so this file re-exposes on `window` every
// function referenced by inline HTML handlers (onclick/oninput) or by template
// strings built in the feature modules. All app state flows through app-state.js
// setters; this module is the only place that bridges ESM exports -> window globals.

import { navigateTo, initRouter, getCurrentPage } from './navigation.js';
import { getSetting, setSetting } from './db.js';
import { validatePhone, formatPhoneDisplay, showToast } from './helpers.js';
import { renderPlatformCarousel, platGoTo } from './carousel.js';
import { debounce } from './helpers.pure.js';
import { ensureSynced, startSyncRetryLoop, pullCloudProfileIfOnline } from './sync.js';
import { openSyncDiag, copySyncDiag, closeSyncDiag } from './sync.health.js';
import { syncLicenseStatus } from './license.sync.js';
import { showConfirm, closeConfirm } from './confirm.js';
import { exportData, importData, confirmClearAll } from './backup.js';
import { setupPWA, installPWA, checkPWAInstalled, updateInstallRow } from './pwa.js';
import { connectBTPrinter, disconnectBTPrinter, printNota, printLastNota, testPrint, getSavedPrinterName } from './printer.js';
import { showTrxDetail, closeTrxDetail, hapusPenjualan } from './trxdetail.js';
import { showExpenseDetail, closeExpenseDetail, hapusExpense } from './expensedetail.js';
import { subscribeToLicenseUpdates, openPurchaseSheet, purchaseShowUpload, handleBuktiUpload, submitPurchase, pollLicenseStatus } from './purchase.js';
import { syncNow as _ksrSyncNow } from './settings.sync.js';
import { saveCart } from './pos.sync.js';
import { ensureNomorBackfill } from './nomor.js';
// v161: gerbang kas dibutuhkan sejak boot (status shift) — impor statis,
// wiring fungsi UI-nya tetap lewat _kasWireMap di bawah.
import { refreshShiftCache } from './kas.js';
import { selectTopping, applySelectedTopping, toggleOrderType, openMenuSelector, confirmMenuSelector, closeMenuSelector, changeMenuSelectorQty, changeToppingQty, syncToppingStepperVisibility } from './pos.ui.js';
import { APP_VERSION, APP_VERSION_LABEL } from './version.js';
import { startUpdateWatcher, checkForUpdate } from './update.js';
import { setReportPeriod, setReportDate, setCustomStart, setCustomEnd, setPosCat, setCurrentPage, setCart, setSelectedTrxId, setLastSaleId, setPlatCurrentSlide, setPlatAutoTimer, orderType, setOrderType } from './app-state.js';
import { openModal, closeModal, closeAllModals, isModalOpen, toggleModal, registerModalSelector, HARD_GATE_OVERLAYS } from './modal.js';

// Register custom selector for tcModal (custom inline-styled structure)
registerModalSelector('tcModal', '.modal-overlay > div[style*="border-radius:20px"]');

// Lazy-loaded modules (wired to window when page is first visited)
let _posModule = null;
let _menuModule = null;
let _laporanModule = null;
let _settingsModule = null;
// Resolve saat settings selesai di-wire (race: boot() butuh checkProfileNotification).
let _settingsReadyResolve = null;
const _settingsReady = new Promise(r => { _settingsReadyResolve = r; });
let _bantuanModule = null;
let _pengeluaranModule = null;
let _berandaModule = null;
let _kasModule = null;

// Wire page modules on first use
const _posWireMap = { __wired: false, loadPOS: 'loadPOS', renderPOSMenu: 'renderPOSMenu', renderPOSMenuDebounced: 'renderPOSMenuDebounced', addToCart: 'addToCart', changeQty: 'changeQty', setCartQty: 'setCartQty', hitungKembalian: 'hitungKembalian', simpanPenjualan: 'simpanPenjualan', openCartModal: 'openCartModal', closeCartModal: 'closeCartModal', clearCart: 'clearCart', selectPosCat: 'selectPosCat', setNominalBayar: 'setNominalBayar', formatBayarInput: 'formatBayarInput', selectAllBayarInput: 'selectAllBayarInput', pickOjolPlatform: 'pickOjolPlatform', setPaymentMethod: 'setPaymentMethod', capturePayProof: 'capturePayProof', handlePayProofFile: 'handlePayProofFile', removePayProof: 'removePayProof', holdOrder: 'holdOrder', holdOrderWithNote: 'holdOrderWithNote', openHeldListModal: 'openHeldListModal', resumeHeldOrder: 'resumeHeldOrder', deleteHeldOrder: 'deleteHeldOrder', refreshHeldFab: 'refreshHeldFab' };
const _menuWireMap = { __wired: false, renderMenuList: 'renderMenuList', renderMenuListDebounced: 'renderMenuListDebounced', openMenuForm: 'openMenuForm', closeMenuModal: 'closeMenuModal', saveMenu: 'saveMenu', toggleMenu: 'toggleMenu', confirmDeleteMenu: 'confirmDeleteMenu', addCustomSuplayer: 'addCustomSuplayer', addCustomKategori: 'addCustomKategori', pickKategori: 'pickKategori', pickSuplayer: 'pickSuplayer', syncPakaiStokToggle: 'syncPakaiStokToggle', openReturModal: 'openReturModal', closeReturModal: 'closeReturModal', confirmRetur: 'confirmRetur', openKonsinyasiRetur: 'openKonsinyasiRetur' };
const _laporanWireMap = { __wired: false, loadReport: 'loadReport', setReportPeriod: 'setReportPeriodUI', setReportPeriodUI: 'setReportPeriodUI', navReportDate: 'navReportDate', toggleExpenseCat: 'toggleExpenseCat', setCustomDate: 'setCustomDate', toggleCustomPicker: 'toggleCustomPicker', pickDate: 'pickDate', pickWeek: 'pickWeek', pickMonth: 'pickMonth', pickCustomDate: 'pickCustomDate' };
const _settingsWireMap = { __wired: false, loadSettings: 'loadSettings', openNameModal: 'openNameModal', closeNameModal: 'closeNameModal', saveNamaUsaha: 'saveNamaUsaha', openOwnerModal: 'openOwnerModal', closeOwnerModal: 'closeOwnerModal', saveOwner: 'saveOwner', openWaModal: 'openWaModal', closeWaModal: 'closeWaModal', saveWa: 'saveWa', openAlamatModal: 'openAlamatModal', closeAlamatModal: 'closeAlamatModal', saveAlamat: 'saveAlamat', checkProfileNotification: 'checkProfileNotification', savePayOptions: 'savePayOptions', saveFiturKas: 'saveFiturKas' };
const _bantuanWireMap = { __wired: false, initBantuan: 'initBantuan', toggleTutorial: 'toggleTutorial' };
const _pengeluaranWireMap = { __wired: false, openExpenseForm: 'openExpenseForm', closeExpenseModal: 'closeExpenseModal', saveExpense: 'saveExpense', openIncomeForm: 'openIncomeForm', switchTxnTab: 'switchTxnTab', saveTxn: 'saveTxn', ubahCatatan: 'ubahCatatan' };
const _berandaWireMap = { __wired: false, loadBeranda: 'loadBeranda' };
// v161 — modul kas (buka/tutup shift, tutup buku tahunan).
// v164 — 4 fungsi "catat kas manual" dihapus dari peta ini: pencatatan uang
// laci kini lewat form Laporan, Beranda hanya memanggil `catatKasDariBeranda`.
const _kasWireMap = { __wired: false, refreshShiftCache: 'refreshShiftCache', renderKasCard: 'renderKasCard', openBukaKasModal: 'openBukaKasModal', bukaKas: 'bukaKas', openTutupKasModal: 'openTutupKasModal', closeTutupKasModal: 'closeTutupKasModal', perbaruiSelisihUI: 'perbaruiSelisihUI', tutupKas: 'tutupKas', showKasShiftDetail: 'showKasShiftDetail', closeKasShiftDetail: 'closeKasShiftDetail', catatKasDariBeranda: 'catatKasDariBeranda', openTutupBukuModal: 'openTutupBukuModal', closeTutupBukuModal: 'closeTutupBukuModal', simpanTutupBuku: 'simpanTutupBuku' };
// v170: `closeBukaKasModal` sengaja TIDAK di-wire ke window lagi — modal Buka Kas
// jadi gerbang tanpa jalan keluar dari UI. Fungsi aslinya tetap diekspor kas.js
// dan dipakai internal setelah shift berhasil dibuat.

// Pre-wire critical modules immediately (beranda, pos) for snappy first load
import('./pos.js').then(m => {
  _posModule = m;
  for (const [key, modKey] of Object.entries(_posWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _posWireMap.__wired = true;
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Wired pos module');
}).catch(e => console.error('[APP] Failed to wire pos:', e));

import('./beranda.js').then(m => {
  _berandaModule = m;
  for (const [key, modKey] of Object.entries(_berandaWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _berandaWireMap.__wired = true;
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Wired beranda module');
}).catch(e => console.error('[APP] Failed to wire beranda:', e));

// Lazy-wire kas module (v161) — dipakai Beranda, gerbang POS, dan Laporan.
import('./kas.js').then(m => {
  _kasModule = m;
  for (const [key, modKey] of Object.entries(_kasWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _kasWireMap.__wired = true;
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Wired kas module');
}).catch(e => console.error('[APP] Failed to wire kas:', e));

// Lazy-wire menu module (less frequently accessed)
import('./menu.js').then(m => {
  _menuModule = m;
  for (const [key, modKey] of Object.entries(_menuWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _menuWireMap.__wired = true;
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Wired menu module');
}).catch(e => console.error('[APP] Failed to wire menu:', e));

// Lazy-wire laporan module (large module, only load when needed)
import('./laporan.js').then(m => {
  _laporanModule = m;
  for (const [key, modKey] of Object.entries(_laporanWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _laporanWireMap.__wired = true;
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Wired laporan module');
}).catch(e => console.error('[APP] Failed to wire laporan:', e));

// Lazy-wire settings module (large module with region picker)
import('./settings.js').then(m => {
  _settingsModule = m;
  for (const [key, modKey] of Object.entries(_settingsWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _settingsWireMap.__wired = true;
  if (_settingsReadyResolve) { _settingsReadyResolve(); _settingsReadyResolve = null; }
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Wired settings module');
}).catch(e => console.error('[APP] Failed to wire settings:', e));

// Lazy-wire bantuan module
import('./bantuan.js').then(m => {
  _bantuanModule = m;
  for (const [key, modKey] of Object.entries(_bantuanWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _bantuanWireMap.__wired = true;
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Wired bantuan module');
}).catch(e => console.error('[APP] Failed to wire bantuan:', e));

// Lazy-wire pengeluaran module
import('./pengeluaran.js').then(m => {
  _pengeluaranModule = m;
  for (const [key, modKey] of Object.entries(_pengeluaranWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _pengeluaranWireMap.__wired = true;
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Wired pengeluaran module');
}).catch(e => console.error('[APP] Failed to wire pengeluaran:', e));

// ==================== WIRE WINDOW GLOBALS (for HTML onclick) ====================
// These are available immediately since they're imported at the top of this module.
window.showPage           = navigateTo;
window._ksr_navigateTo    = navigateTo;
window._ksr_syncNow       = _ksrSyncNow;
window.closeConfirm       = closeConfirm;
window.showConfirm        = showConfirm;
window.exportData         = exportData;
window.importData         = importData;
window.confirmClearAll    = confirmClearAll;
window.openSyncDiag       = openSyncDiag;
window.copySyncDiag       = copySyncDiag;
window.closeSyncDiag      = closeSyncDiag;
window.connectBTPrinter   = connectBTPrinter;
window.disconnectBTPrinter= disconnectBTPrinter;
window.getSavedPrinterName= getSavedPrinterName;
window.printNota          = printNota;
window.printLastNota      = printLastNota;
window.testPrint          = testPrint;
window.showTrxDetail      = showTrxDetail;
window.closeTrxDetail     = closeTrxDetail;
window.hapusPenjualan     = hapusPenjualan;
window.showExpenseDetail  = showExpenseDetail;
window.hapusExpense       = hapusExpense;
window.installPWA         = installPWA;
window.selectTopping      = selectTopping;
window.applySelectedTopping = applySelectedTopping;
window.openMenuSelector   = openMenuSelector;
window.confirmMenuSelector = confirmMenuSelector;
window.closeMenuSelector  = closeMenuSelector;
window.toggleOrderType = toggleOrderType;
window._ksr_toggleOrderType = (tipe) => { if (window.toggleOrderType) window.toggleOrderType(tipe); };
window.renderPlatformCarousel = renderPlatformCarousel;
window._ksr_platGoTo = (slideIdx) => {
  platGoTo(slideIdx);
};
window.setReportPeriod    = (p) => {
  setReportPeriod(p); // state setter dari app-state
  // Jika laporan module sudah di-wire, jalankan versi UI (render + toggle active).
  // Sebelum module laporan load, wire map (_laporanWireMap) akan menimpa
  // window.setReportPeriod → setReportPeriodUI. Ini jaga race klik-tab dini.
  if (window.setReportPeriodUI) window.setReportPeriodUI(p);
};
window.setReportDate      = setReportDate;
window.setCustomStart     = setCustomStart;
window.setCustomEnd       = setCustomEnd;
window.setPosCat          = setPosCat;
window.setCurrentPage     = setCurrentPage;
window.setCart            = setCart;
window.setSelectedTrxId   = setSelectedTrxId;
window.setLastSaleId      = setLastSaleId;
window.setPlatCurrentSlide= setPlatCurrentSlide;
window.setPlatAutoTimer   = setPlatAutoTimer;

// Modal management (a11y: focus trap)
window._ksr_openModal    = openModal;
window._ksr_closeModal   = closeModal;
window._ksr_closeAllModals = closeAllModals;
window._ksr_isModalOpen  = isModalOpen;
window._ksr_toggleModal  = toggleModal;

// ==================== LICENSE GATE ====================
// Expose license actions to the gate UI (index.html)
import { setLicenseRefs, updateTrialChip, renderLicenseInfoCard, checkLicenseGate, openLicenseSheet, isLicensed, getLicenseStatus, startTrial, activateSerial, activateLicense, contactViaWA, checkCloudStatusAndUnlock, toggleManualKey, fetchLicenseStatusFromCloud, isDeviceKnownOnCloud, saveLicense, getDeviceIdentity, decodeExpiryLabel, enforceRevoked } from './license.js';
import { ensureUnitId } from './license.logic.js';

// Dev detection helper
function isDev() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.startsWith('192.168.') || location.hostname.startsWith('10.') || location.hostname.endsWith('.local') || !location.hostname.includes('.');
}

setLicenseRefs({
  updateTrialChip,
  renderLicenseInfoCard,
  checkLicenseGate,
  openLicenseSheet,
  openPurchaseSheet
});
window._ksr_openLicenseSheet = openLicenseSheet;
window._ksr_activateLicense  = activateLicense; // UI: trima inputId, baca input, validasi serial
window._ksr_openPurchaseSheet = openPurchaseSheet;
window._ksr_purchaseShowUpload = purchaseShowUpload;
window._ksr_checkLicenseStatus = checkCloudStatusAndUnlock;
window._ksr_toggleManualKey  = toggleManualKey;
window._ksr_handleBuktiUpload = handleBuktiUpload;
window._ksr_submitPurchase   = submitPurchase;
window._ksr_pollLicenseStatus = pollLicenseStatus;
window._ksr_subscribeToLicenseUpdates = subscribeToLicenseUpdates;
window._ksr_enforceRevoked = enforceRevoked;
// T15 (audit 2026-08-17/M5): callback refresh UI lisensi yang dipanggil
// purchase.js (polling & realtime) — tanpa ini chip/kartu lisensi tidak
// refresh setelah aktivasi sampai interval 60 detik.
window._ksr_updateTrialChip = updateTrialChip;
window._ksr_checkLicenseGate = checkLicenseGate;
window._ksr_renderLicenseInfoCard = renderLicenseInfoCard;
window._ksr_closeSheet       = (id) => closeModal(id);
window._ksr_contactViaWA     = contactViaWA;
// --- Syarat & Ketentuan (2026-08-29: gate onboarding dihapus) ---
// TC kini modal sekali-jalan NON-BLOCKING: tampil sekali di boot awal (bisa
// ditutup), dibuka ulang dari menu Bantuan. Setuju = catat tanggal.
window._ksr_acceptTC = async () => {
  await setSetting('tcAcceptedAt', new Date().toISOString());
  closeModal('tcModal');
};
// Ditutup tanpa setuju → modal muncul lagi di boot berikutnya (tidak memaksa).
window._ksr_cancelTC = () => closeModal('tcModal');

// ---------- STATUS → UI (2026-08-29: TANPA full-screen gate) ----------
// Keputusan pemilik: kuota transaksi habis TIDAK mengunci aplikasi — app
// tetap bisa dibuka & dieksplor; yang diblok hanya transaksi (pos.js) dan
// fitur berbayar (cadangan cloud). Pesan = banner bisa-ditutup. Revoke oleh
// admin TETAP full-lock lewat lockOverlay (enforceRevoked).
function showQuotaBanner(st) {
  const b = document.getElementById('quotaBanner');
  if (!b) return;
  const txt = document.getElementById('quotaBannerText');
  if (txt) {
    const paid = st.protocol === 'licensed-expired';
    txt.innerHTML = (paid
      ? '🔑 Lisensi berbayar Anda sudah kedaluwarsa — eksplorasi tetap bebas, transaksi terkunci.'
      : '🚫 Kuota transaksi bulan ini habis — eksplorasi tetap bebas, transaksi terkunci.')
      + ' <b>ID Perangkat: ' + (st.deviceCode || '—') + '</b>';
  }
  b.classList.remove('khide');
}
function hideQuotaBanner() {
  const b = document.getElementById('quotaBanner');
  if (b) b.classList.add('khide');
}

// Periodic license re-check (60s) -- cloud-first: sync dari Supabase dulu
// (SSoT server), baru checkLicenseGate baca lokal yang sudah match cloud.
// Tanpa ini, kalau admin cabut/aktivasi dari konsol, butuh refresh manual.
setInterval(() => {
  if (!navigator.onLine) { checkLicenseGate(); return; }
  runLicenseSync().finally(() => checkLicenseGate());
}, 60000);

// License sync is event-driven: startup, reconnect, and foreground visibility.
window.addEventListener('online', () => {
  runLicenseSync().then(() => checkLicenseGate());
  ensureSynced({ silent: true }).catch(() => {}); // retry profil saat kembali online
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') runLicenseSync().then(() => checkLicenseGate());
});



// ==================== INIT ====================

// ==================== DATA ACTION HANDLER ====================
// Central handler for all data-action attributes (replaces inline onclick/oninput)

// Buka/tutup panel accordion form menu (Kategori & Suplayer).
// Saat satu dibuka, yang lain otomatis tertutup agar tidak berdempetan.
function toggleAccordion(id) {
  const target = document.getElementById(id);
  if (!target) return;
  // Kelas 'open' dipasang di parent .acc (selector CSS .acc.open .acc-panel)
  const acc = target.closest('.acc') || target;
  const willOpen = !acc.classList.contains('open');
  // Tutup panel accordion lainnya di form menu (mutual exclusion)
  ['menuKategoriAcc', 'menuSuplayerAcc'].forEach((oid) => {
    if (oid !== id) document.getElementById(oid)?.closest('.acc')?.classList.remove('open');
  });
  acc.classList.toggle('open', willOpen);
}

// Gerbang fitur berbayar (2026-08-29): hanya lisensi AKTIF yang boleh; tier
// gratis dapat toast + sheet pembelian. Dipakai cadangan cloud dulu — bisa
// dipakai ulang untuk fitur berbayar berikutnya.
async function guardLicensedThen(fn) {
  if (await isLicensed()) {
    try { await fn(); } catch (e) { console.warn('[guard] aksi gagal:', e); }
    return;
  }
  const { showToast } = await import('./helpers.js');
  showToast('🔒 Fitur ini khusus lisensi aktif — beli lisensi untuk membuka 💳', 'error', 4000);
  openPurchaseSheet();
}

function handleDataAction(action, el, event) {
  switch (action) {
    // Navigation
    case 'navigate-bantuan':
      navigateTo('bantuan');
      break;
    case 'navigate-pengaturan':
      navigateTo('pengaturan');
      break;

    // License/Sheet
    case 'open-license-sheet':
      if (window._ksr_openLicenseSheet) window._ksr_openLicenseSheet();
      break;
    case 'close-sheet-license':
      if (window._ksr_closeSheet) window._ksr_closeSheet('sheetLicense');
      break;
    case 'close-sheet-purchase':
      if (window._ksr_closeSheet) window._ksr_closeSheet('sheetPurchase');
      break;
    case 'open-tc':
      openModal('tcModal');
      break;
    case 'cancel-tc':
      if (window._ksr_cancelTC) window._ksr_cancelTC();
      break;
    case 'accept-tc':
      if (window._ksr_acceptTC) window._ksr_acceptTC();
      break;
    case 'close-quota-banner':
      hideQuotaBanner();
      break;
    case 'dismiss-profile-banner':
      closeModal('profileBanner');
      navigateTo('pengaturan');
      break;

    // POS
    case 'pos-search':
      if (window.renderPOSMenuDebounced) window.renderPOSMenuDebounced();
      break;
    case 'order-note-input': {
      // Catatan MENU TERPILIH (per item, modal Pilihan Menu) — tidak butuh draft
      // localStorage: nilainya diambil saat modal dikonfirmasi (#8, 2026-08-31).
      break;
    }
    case 'global-note-input': {
      // Catatan GLOBAL per transaksi (header keranjang) — draft disimpan agar
      // tidak hilang saat refresh/PWA reload (komentar browser #4).
      try { localStorage.setItem('kasirsolo:order-note', (el.value || '').slice(0, 120)); } catch (_) {}
      break;
    }
    case 'toggle-cat-accordion': {
      const acc = document.getElementById('posCatAccordion');
      if (acc) acc.classList.toggle('open');
      break;
    }
    case 'open-cart':
      if (window.openCartModal) window.openCartModal();
      break;
    case 'report-period-harian':
      if (window.setReportPeriod) window.setReportPeriod('harian');
      break;
    case 'report-period-mingguan':
      if (window.setReportPeriod) window.setReportPeriod('mingguan');
      break;
    case 'report-period-bulanan':
      if (window.setReportPeriod) window.setReportPeriod('bulanan');
      break;
    case 'report-period-custom':
      if (window.setReportPeriod) window.setReportPeriod('custom');
      break;
    case 'setor-konsinyasi': {
      const sp = el?.dataset?.suplayer || '';
      const utang = parseInt(el?.dataset?.utang) || 0;
      if (window.openExpenseForm) {
        window.openExpenseForm({
          keterangan: `Setoran ${sp} · ${new Date().toLocaleDateString('id-ID')}`,
          kategori: 'Setoran Konsinyasi',
          jumlah: utang > 0 ? utang : ''
        });
      }
      break;
    }
    case 'retur-konsinyasi': {
      const sp = el?.dataset?.suplayer || '';
      // Retur barang titipan = pengembalian barang ke suplayer (stok turun,
      // counter m.retur naik) — bukan pengeluaran uang. Modal retur kini
      // menampilkan select barang bila suplayer punya >1 menu titipan.
      if (window.openKonsinyasiRetur) window.openKonsinyasiRetur(sp);
      break;
    }

    // Menu
    case 'menu-search':
      if (window.renderMenuListDebounced) window.renderMenuListDebounced();
      break;
    case 'add-suplayer-custom':
      if (window.addCustomSuplayer) window.addCustomSuplayer();
      break;
    case 'add-kategori-custom':
      if (window.addCustomKategori) window.addCustomKategori();
      break;
    case 'toggle-kategori-acc':
      toggleAccordion('menuKategoriAcc');
      break;
    case 'toggle-suplayer-acc':
      toggleAccordion('menuSuplayerAcc');
      break;
    case 'pick-kategori':
      if (window.pickKategori) window.pickKategori(el?.dataset.value ?? '');
      break;
    case 'pick-suplayer':
      if (window.pickSuplayer) window.pickSuplayer(el?.dataset.value ?? '');
      break;
    case 'retur-menu':
      if (window.openReturModal) window.openReturModal(Number(el?.dataset?.menuId));
      break;
    case 'close-retur-modal':
      if (window.closeReturModal) window.closeReturModal();
      break;
    case 'confirm-retur-menu':
      if (window.confirmRetur) window.confirmRetur();
      break;
    case 'toggle-menu-acc': {
      // Kartu menu = akordeon auto close: buka satu -> tutup yang lain
      // (pola sama dengan accordion kategori/suplayer di form menu).
      const acc = el?.closest('.acc-menu');
      if (!acc) break;
      const willOpen = !acc.classList.contains('open');
      document.querySelectorAll('.acc-menu.open').forEach(a => a.classList.remove('open'));
      acc.classList.toggle('open', willOpen);
      break;
    }
    case 'retry-menu-list': {
      // Error state daftar menu (DB gagal dibaca, mis. Dexie open tertunda
      // saat update PWA) — ketuk kartu ⚠️ untuk coba lagi.
      import('./menu.js').then(m => m.renderMenuList()).catch(() => {});
      break;
    }
    case 'retry-pos': {
      import('./pos.js').then(m => m.loadPOS()).catch(() => {});
      break;
    }
    case 'open-menu-form': {
      // Tombol ✏️ edit di kartu menu membawa data-menu-id (mode edit);
      // FAB ➕ tidak membawa id (mode tambah). Tanpa ini form edit terbuka kosong.
      const rawMenuId = el?.dataset.menuId;
      const menuId = rawMenuId ? Number(rawMenuId) : NaN;
      if (window.openMenuForm) window.openMenuForm(Number.isNaN(menuId) ? undefined : menuId);
      break;
    }
    case 'toggle-menu-cat-accordion': {
      const menuAcc = document.getElementById('menuCatAccordion');
      if (menuAcc) menuAcc.classList.toggle('open');
      break;
    }

    // Settings - Profile
    case 'open-name-modal':
      if (window.openNameModal) window.openNameModal();
      break;
    case 'open-owner-modal':
      if (window.openOwnerModal) window.openOwnerModal();
      break;
    case 'open-wa-modal':
      if (window.openWaModal) window.openWaModal();
      break;
    case 'open-alamat-modal':
      if (window.openAlamatModal) window.openAlamatModal();
      break;

    // Settings - Printer
    case 'connect-printer':
      if (window.connectBTPrinter) window.connectBTPrinter();
      break;
    case 'test-print':
      if (window.testPrint) window.testPrint();
      break;
    case 'disconnect-printer':
      if (window.disconnectBTPrinter) window.disconnectBTPrinter();
      break;
    case 'install-pwa':
      if (window.installPWA) window.installPWA();
      break;

    // Settings - Data
    case 'export-data':
      if (window.exportData) window.exportData();
      break;
    case 'cloud-backup':
    case 'cloud-restore-latest':
      // Cadangan Cloud khusus lisensi AKTIF (keputusan pemilik 2026-08-29);
      // cadangan file (ekspor JSON) tetap gratis untuk semua.
      guardLicensedThen(() => import('./backup.js').then(m =>
        action === 'cloud-backup' ? m.cloudSaveBackup() : m.cloudRestoreLatest()));
      break;
    case 'trigger-import':
      document.getElementById('importFile')?.click();
      break;
    case 'import-data':
      if (window.importData && event?.target?.files?.[0]) window.importData(event);
      break;
    case 'open-sync-diag':
      if (window.openSyncDiag) window.openSyncDiag();
      break;
    case 'confirm-clear-all':
      if (window.confirmClearAll) window.confirmClearAll();
      break;

    // Cart/Payment
    case 'format-bayar':
      if (window.formatBayarInput) window.formatBayarInput();
      if (event && event.type === 'click' && window.selectAllBayarInput) window.selectAllBayarInput();
      break;
    case 'close-cart':
      if (window.closeCartModal) window.closeCartModal();
      break;
    case 'hold-cart': {
      // v155: modal catatan DIHAPUS — "Tahan" langsung menyimpan pesanan
      // ditahan memakai catatan yang sudah terisi di keranjang. Catatan
      // kosong → toast peringatan (keranjang sengaja TIDAK ditutup dulu
      // supaya user bisa langsung mengisi).
      // stopPropagation supaya klik tombol tidak ikut buka modal keranjang.
      try { event?.stopPropagation?.(); event?.preventDefault?.(); } catch (_) {}
      if (window.holdOrderWithNote) window.holdOrderWithNote().catch(e => console.error('[hold-cart]', e));
      break;
    }
    case 'open-held-list':
      if (window.openHeldListModal) window.openHeldListModal();
      break;
    case 'close-held-list':
      // Tutup modal held list via closeModal (a11y + state cleanup terpusat).
      if (window._ksr_closeModal) window._ksr_closeModal('heldListModal');
      else document.getElementById('heldListModal')?.classList.remove('show');
      break;
    case 'resume-held': {
      const id = parseInt(el?.dataset?.heldId || '0', 10);
      if (id > 0 && window.resumeHeldOrder) window.resumeHeldOrder(id);
      break;
    }
    case 'delete-held': {
      const id = parseInt(el?.dataset?.heldId || '0', 10);
      if (id > 0 && window.deleteHeldOrder) window.deleteHeldOrder(id);
      break;
    }
    case 'clear-cart': {
      // Komentar browser v147: tombol "🗑️" di header keranjang — kosongkan
      // semua item. Konfirmasi dulu via showConfirm (pola sama dengan hapus
      // menu/transaksi), dan kalau keranjang sudah kosong kasih toast info.
      // Cart dibaca dari localStorage (live snapshot) — `pos.js` re-export
      // `cart` hanya menangkap binding awal, bukan hasil `setCart()` runtime.
      if (typeof window.showConfirm !== 'function' || !window.clearCart) break;
      let liveCart = {};
      try { liveCart = JSON.parse(localStorage.getItem('kaki5-cart') || '{}') || {}; } catch (_) {}
      const itemCount = Object.values(liveCart).filter(c => c && c.qty > 0).length;
      if (itemCount === 0) {
        window.showToast?.('Keranjang sudah kosong', 'info');
        break;
      }
      window.showConfirm(
        '🗑️',
        `Kosongkan ${itemCount} item dari keranjang? Catatan & bukti bayar akan ikut dihapus.`,
        'Ya, Kosongkan',
        () => { try { window.clearCart(); } catch (e) { console.error('[clear-cart]', e); } }
      );
      break;
    }
    case 'save-sale-print':
      // v152 komentar browser: tombol "Bayar" = simpan transaksi lalu tawarkan
      // cetak nota atau tidak ('ask' ditangani di pos.simpanPenjualan).
      if (window.simpanPenjualan) window.simpanPenjualan('ask');
      break;
    case 'switch-order-type': {
      const tipe = (el.closest?.('[data-tipe]') || {}).dataset?.tipe || 'dine-in';
      toggleOrderType(tipe);
      break;
    }
    case 'select-topping': {
      const menuId = (el.closest?.('[data-menu-id]') || {}).dataset?.menuId;
      if (menuId && window.selectTopping) window.selectTopping(Number(menuId));
      break;
    }
    case 'menu-selector-qty': {
      changeMenuSelectorQty(el.dataset.delta);
      break;
    }
    case 'topping-toggle': {
      // Tampilkan/sembunyikan stepper qty inline saat checkbox berubah
      syncToppingStepperVisibility(el.dataset.scope, el.dataset.nama);
      break;
    }
    case 'topping-qty': {
      // Stepper qty per-topping (independen per opsi)
      changeToppingQty(el.dataset.scope, el.dataset.nama, el.dataset.delta);
      break;
    }
    case 'remove-topping': {
      const el2 = el.closest?.('[data-nama]');
      const nama = el2?.dataset?.nama;
      const menuId2 = el2?.closest?.('[data-menu-id]')?.dataset?.menuId;
      if (nama && menuId2 && cart[menuId2]) {
        const next = { ...cart };
        next[menuId2] = {
          ...next[menuId2],
          selectedToppings: (next[menuId2].selectedToppings || []).filter(x => x.nama !== nama)
        };
        setCart(next);
        saveCart();
        openCartModal();
      }
      break;
    }
    case 'apply-topping':
      if (window.applySelectedTopping) window.applySelectedTopping();
      break;
    case 'close-menu-selector':
      if (window.closeMenuSelector) window.closeMenuSelector();
      break;
    case 'confirm-menu-selector':
      if (window.confirmMenuSelector) window.confirmMenuSelector();
      break;
    case 'print-last-nota':
      if (window.printLastNota) window.printLastNota();
      break;

    // Menu Form
    case 'close-menu-modal':
      if (window.closeMenuModal) window.closeMenuModal();
      break;
    case 'save-menu':
      if (window.saveMenu) window.saveMenu();
      break;

    // Expense Form
    case 'close-expense-modal':
      if (window.closeExpenseModal) window.closeExpenseModal();
      break;
    case 'save-expense':
      if (window.saveExpense) window.saveExpense();
      break;

    // Income Form (pemasukan lain di Laporan — buka modal tab Pemasukan)
    case 'open-income-form':
      if (window.openIncomeForm) window.openIncomeForm();
      break;

    // Modal catat transaksi: tab Pengeluaran | Pemasukan
    case 'txn-tab':
      if (window.switchTxnTab) window.switchTxnTab(el?.dataset?.txntab || 'expense');
      break;
    case 'save-txn':
      if (window.saveTxn) window.saveTxn();
      break;

    // Ojol app tabs (modal menu selector)
    case 'pick-ojol-platform':
      if (window.pickOjolPlatform) window.pickOjolPlatform(el?.dataset?.platform || 'Lainnya');
      break;

    // Metode pembayaran: Tunai | QRIS | Transfer (komentar browser #5, 2026-08-31)
    case 'set-pay-method':
      if (window.setPaymentMethod) window.setPaymentMethod(el?.dataset?.method || 'tunai');
      break;

    // 📸 Foto bukti pembayaran non-tunai (permintaan pemilik 2026-08-31: simpel)
    case 'capture-pay-proof':
      if (window.capturePayProof) window.capturePayProof();
      break;
    case 'handle-pay-proof': // event 'change' pada input file #payProofFile
      if (window.handlePayProofFile) window.handlePayProofFile(el);
      break;
    case 'remove-pay-proof':
      if (window.removePayProof) window.removePayProof();
      break;

    // Name Modal
    case 'close-name-modal':
      if (window.closeNameModal) window.closeNameModal();
      break;
    case 'save-nama-usaha':
      if (window.saveNamaUsaha) window.saveNamaUsaha();
      break;

    // Owner Modal
    case 'close-owner-modal':
      if (window.closeOwnerModal) window.closeOwnerModal();
      break;
    case 'save-owner':
      if (window.saveOwner) window.saveOwner();
      break;

    // WA Modal
    case 'sanitize-wa-input':
      el.value = el.value.replace(/[^\d+\s-]/g, '');
      break;
    case 'close-wa-modal':
      if (window.closeWaModal) window.closeWaModal();
      break;
    case 'save-wa':
      if (window.saveWa) window.saveWa();
      break;

    // 💳 Opsi metode pembayaran (saklar Tunai/QRIS/Transfer) — halaman Pengaturan.
    // HANYA event 'change' (setelah checkbox ter-toggle). Klik pada label juga
    // diteruskan sebagai click sintetis ke input SEBELUM toggle — kalau direspons
    // juga, nilai lama ikut tersimpan & toast-nya menimpa toast guard/error (race).
    case 'save-pay-options':
      if (event?.type === 'change' && window.savePayOptions) window.savePayOptions(el);
      break;

    // ⚙️ Saklar fitur buka/tutup kas (v166) — sama seperti opsi pembayaran,
    // hanya event 'change' yang diproses (label meneruskan click sintetis).
    case 'save-fitur-kas':
      if (event?.type === 'change' && window.saveFiturKas) window.saveFiturKas(el);
      break;

    // Alamat Modal
    case 'close-alamat-modal':
      if (window.closeAlamatModal) window.closeAlamatModal();
      break;
    case 'save-alamat':
      if (window.saveAlamat) window.saveAlamat();
      break;

    // Trx Detail
    case 'close-trx-detail':
      if (window.closeTrxDetail) window.closeTrxDetail();
      break;
    case 'print-nota':
      if (window.printNota) window.printNota();
      break;
    case 'delete-sale':
      if (window.hapusPenjualan) window.hapusPenjualan();
      break;

    // Confirm Dialog
    case 'close-confirm':
      if (window.closeConfirm) window.closeConfirm();
      break;
    // confirmYes is handled separately in confirm.js

    // Sync Diag
    case 'close-sync-diag':
      if (window.closeSyncDiag) window.closeSyncDiag();
      break;
    case 'copy-sync-diag':
      if (window.copySyncDiag) window.copySyncDiag();
      break;
    // NB: 'open-sync-diag' sudah ditangani di blok Settings di atas. Case dobel
    // (v151-v161) dihapus di v162 — yang kedua mati karena switch berhenti di match pertama.
    // Purchase/Expense
    case 'open-expense-form':
      if (window.openExpenseForm) window.openExpenseForm();
      break;

    // ---- KAS / SHIFT (v161, adopsi buka-tutup kas + tutup buku dari rosok) ----
    case 'open-buka-kas':
      if (window.openBukaKasModal) window.openBukaKasModal();
      break;
    // v170: case 'close-buka-kas' DIHAPUS (komentar browser 2026-09-05) — modal
    // Buka Kas adalah gerbang, tidak ada lagi tombol "Batal". Jalan keluarnya
    // cuma `save-buka-kas` yang sukses; kas.js menutup modalnya sendiri lewat
    // closeModal() langsung, jadi tidak butuh aksi tutup dari UI.
    case 'save-buka-kas':
      if (window.bukaKas) window.bukaKas();
      break;
    case 'open-tutup-kas':
      if (window.openTutupKasModal) window.openTutupKasModal();
      break;
    case 'close-tutup-kas':
      if (window.closeTutupKasModal) window.closeTutupKasModal();
      break;
    case 'save-tutup-kas':
      if (window.tutupKas) window.tutupKas();
      break;
    case 'show-kas-shift-detail': {
      // Komentar browser #6: baris riwayat shift di Laporan dulu mati — sekarang
      // membuka modal detail (angka dihitung ulang dengan hitungShift yang sama).
      const id = Number(el?.dataset.shiftId);
      if (Number.isFinite(id) && window.showKasShiftDetail) window.showKasShiftDetail(id);
      break;
    }
    case 'close-kas-shift-detail':
      if (window.closeKasShiftDetail) window.closeKasShiftDetail();
      break;
    case 'kas-fisik-input':
      if (window.perbaruiSelisihUI) window.perbaruiSelisihUI();
      break;
    case 'kas-catat':
      // v164: tidak ada lagi modal "catat kas" sendiri. Tombol Beranda membuka
      // form Pengeluaran/Pemasukan Laporan — satu jalur pencatatan uang laci.
      if (window.catatKasDariBeranda) window.catatKasDariBeranda(el?.dataset?.kasmode || 'keluar');
      break;
    case 'open-tutup-buku':
      if (window.openTutupBukuModal) window.openTutupBukuModal(el?.dataset?.tahun);
      break;
    case 'close-tutup-buku':
      if (window.closeTutupBukuModal) window.closeTutupBukuModal();
      break;
    case 'save-tutup-buku':
      if (window.simpanTutupBuku) window.simpanTutupBuku();
      break;

    // ---- Dilengkapi (P1 2026-08-22): refactor template lama onclick="..." →
    // data-action="..." tidak diikuti handler-nya di sini, sehingga klik
    // item POS / tombol lisensi / titik carousel dsb. mati total. Id tabel
    // Dexie (++id) numerik, sedangkan dataset selalu string → konversi. ----
    case 'add-to-cart': {
      const id = Number(el?.dataset.menuId);
      if (!Number.isNaN(id) && window.addToCart) window.addToCart(id);
      break;
    }
    case 'change-qty': {
      const id = Number(el?.dataset.menuId);
      if (!Number.isNaN(id) && window.changeQty) window.changeQty(id, Number(el?.dataset.delta));
      break;
    }
    // Input qty manual di cart: event 'input' (tiap ketikan) → update ringan
    // tanpa rebuild daftar (fokus aman); event 'change' (blur/Enter) → sinkron penuh.
    case 'cart-qty-input': {
      const id = Number(el?.dataset.menuId);
      if (Number.isNaN(id)) break;
      if (window.setCartQty) window.setCartQty(id, el.value, event.type === 'change');
      break;
    }
    case 'set-nominal-bayar': {
      const nominal = Number(el?.dataset.nominal);
      if (!Number.isNaN(nominal) && window.setNominalBayar) window.setNominalBayar(nominal);
      break;
    }
    case 'show-trx-detail': {
      const id = Number(el?.dataset.trxId);
      if (!Number.isNaN(id)) showTrxDetail(id);
      break;
    }
    case 'close-expense-detail':
      closeExpenseDetail();
      break;
    // v160: hapus catatan pengeluaran/pemasukan dari modal detailnya. Id diambil
    // dari data-id baris yang diklik (bukan state global) → tidak bisa salah
    // sasaran kalau user membuka dua detail berturut-turut.
    case 'delete-expense':
      hapusExpense(el?.dataset.id);
      break;
    // v165 (poin 6): UBAH catatan dari modal detailnya. Yang dibuka adalah form
    // pencatatan biasa dalam mode edit — tidak ada jalur tulis kedua, jadi
    // aturan validasi / nomor / metode otomatis sama persis dengan catatan baru.
    case 'edit-expense':
      if (window.ubahCatatan) window.ubahCatatan(el?.dataset?.id);
      else import('./pengeluaran.js').then(m => {
        window.ubahCatatan = m.ubahCatatan;
        return m.ubahCatatan(el?.dataset?.id);
      }).catch(e => {
        console.error('[APP] gagal memuat form ubah catatan:', e);
        showToast('Form ubah belum siap dimuat — coba lagi', 'error');
      });
      break;
    case 'toggle-menu': {
      const id = Number(el?.dataset.menuId);
      if (!Number.isNaN(id) && window.toggleMenu) window.toggleMenu(id);
      break;
    }
    case 'confirm-delete-menu': {
      const id = Number(el?.dataset.menuId);
      if (!Number.isNaN(id) && window.confirmDeleteMenu) window.confirmDeleteMenu(id);
      break;
    }
    case 'toggle-tutorial':
      if (window.toggleTutorial) window.toggleTutorial(el?.dataset.tutId);
      break;
    case 'plat-goto': {
      const slide = Number(el?.dataset.slide);
      if (!Number.isNaN(slide)) platGoTo(slide);
      break;
    }
    case 'close-install-banner': {
      document.getElementById('installBanner')?.remove();
      break;
    }
    case 'close-install-guide': {
      document.getElementById('installGuideOverlay')?.remove();
      break;
    }
    // ---- Lisensi & pembelian (tombol di-render license.ui.js / purchase.js) ----
    case 'open-purchase-sheet':
    case 'buy-gate':
      openPurchaseSheet();
      break;
    case 'contact-via-wa':
      contactViaWA();
      break;
    case 'toggle-manual-key':
      toggleManualKey(el?.dataset.inputId);
      break;
    case 'activate-license': {
      const input = el?.dataset.inputId ? document.getElementById(el.dataset.inputId) : null;
      const code = input?.value?.trim();
      if (code) activateSerial(code);
      break;
    }
    case 'check-license-status':
      syncLicenseStatus();
      break;
    case 'trigger-bukti-input': {
      // Dua state tombol kirim bukti (permintaan pemilik 2026-08-26):
      // foto belum terpilih → buka file picker (tombol hijau "Lampirkan Bukti
      // Pembayaran"); foto sudah terpilih → kirim (tombol oranye "Kirim
      // Sekarang"). Dulu btn.onclick dipasang ganda di handleBuktiUpload
      // sehingga klik kedua membuka file picker DAN submit bersamaan.
      if (window._ksr_currentBuktiFile) {
        window._ksr_submitPurchase(window._ksr_purchaseUnitId, window._ksr_purchaseDeviceCode);
      } else {
        document.getElementById('buktiInput')?.click();
      }
      break;
    }
    case 'handle-bukti-upload':
      // Dipicu event 'change' pada input file #buktiInput (lihat delegasi change di init).
      handleBuktiUpload(event);
      break;

    default:
      if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) {
        console.log('[APP] Unhandled data-action:', action);
      }
  }
}


async function init() {
  // Close modals: klik di luar (backdrop) tutup modal itu; klik navbar tutup semua.
  // Pakai event delegation di document supaya berlaku juga untuk modal yang
  // dibuat/dirender dinamis setelah init (bukan hanya yang ada saat load).
  document.addEventListener('click', (e) => {
    const t = e.target;
    // HARD_GATE_OVERLAYS (lockOverlay = gate lisensi, updateOverlay = force
    // update, bukaKasModal = gerbang kas v170) TIDAK boleh ditutup lewat klik
    // backdrop maupun navbar, supaya gate-nya gak bisa dilewati.
    // Pakai closeAllModals()/closeModal() supaya focus trap ikut dibersihkan
    // (dulu cuma remove class 'show' → keydown listener trap tetap nempel).
    const closeOverlays = () => closeAllModals();
    // 1) Klik langsung pada backdrop `.modal-overlay` -> tutup modal tsb.
    //    (Konten modal adalah child, jadi klik konten tidak tertutup.)
    if (t instanceof Element && t.classList?.contains('modal-overlay') && t.classList.contains('show')) {
      if (!HARD_GATE_OVERLAYS.has(t.id)) closeModal(t.id);
      return;
    }
    // 2) Klik menu navigasi (navbar bawah) -> tutup semua modal.
    if (t instanceof Element && t.closest?.('.nav-item')) {
      closeOverlays();
    }
    // 3) Handle data-action attributes (replaces inline onclick/oninput)
    const actionEl = t.closest?.('[data-action]');
    if (actionEl) {
      const action = actionEl.dataset.action;
      handleDataAction(action, actionEl, e);
      return;
    }
  });

  // Keyboard a11y (P1 audit 2026-08-22): elemen non-native dengan data-action
  // (mis. #trialChip yang div[role=button]) tidak memicu event click untuk
  // Enter/Space — delegasikan seperti click di atas.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const actionEl = t.closest?.('[data-action]');
    if (!actionEl) return;
    // Button/link/input menangani key-nya sendiri (browser memicu click) —
    // jangan eksekusi dobel.
    if (t.closest('button, a, input, select, textarea, [contenteditable]')) return;
    e.preventDefault();
    handleDataAction(actionEl.dataset.action, actionEl, e);
  });

  // Delegasi input/change (P1 2026-08-22): data-action pada elemen input
  // (pencarian POS/menu, format bayar, upload file cadangan/bukti) tidak
  // pernah memicu event click — tanpa ini semua kotak pencarian & unggahan
  // mati setelah refactor onclick → data-action.
  const dispatchDataAction = (e) => {
    if (!(e.target instanceof Element)) return;
    const actionEl = e.target.closest?.('[data-action]');
    if (actionEl) handleDataAction(actionEl.dataset.action, actionEl, e);
  };
  document.addEventListener('input', dispatchDataAction);
  document.addEventListener('change', dispatchDataAction);

  // License sync first, but never block startup on a transient network failure.
  await runLicenseSync();
  // 2026-08-29: TANPA full-screen gate. Perangkat baru → pastikan tier gratis
  // kuota ada (continueKnownDevice), lalu app SELALU boot; kuota habis hanya
  // menampilkan banner + memblok transaksi (pos.js); revoked → lockOverlay.
  const status = await getLicenseStatus();
  if (status.status === 'none') {
    await continueKnownDevice();
  }
  await checkLicenseGate();
  await boot();
  }

  // Perangkat FISIK yang sama sudah pernah dipakai (data lokal bersih karena ganti
  // browser/re-install). Lewati onboarding: kalau lisensi aktif di cloud -> sinkron
  // local license + unlock & masuk; selain itu lanjutkan masa coba perangkat tsb.
  async function continueKnownDevice() {
      let cloud = null;
      try {
        cloud = await fetchLicenseStatusFromCloud();
        if (cloud && cloud.license_status === 'aktif') {
          await saveLicenseFromCloud(cloud);
          closeModal('lockOverlay');
          await boot();
          return;
        }
      } catch (e) {
        console.warn('continueKnownDevice cloud check failed:', e?.message || e);
      }
      // Tidak ada lisensi aktif di cloud → tier gratis kuota transaksi
      // (2026-08-29). Penghitung dijaga monotonic oleh reconcile cloud di
      // syncLicenseStatus — hapus data / ganti browser tidak menurunkannya.
      await startTrial();
      await checkLicenseGate();
      await boot();
    }

    // Sinkronkan local license (Dexie) dari status cloud supaya getLicenseStatus()
    // tidak lagi 'none' & banner tidak menampilkan "kuota habis" keliru saat
    // reload berikutnya. expCode diturunkan dari license_expires_at (cloud) untuk
    // tetap menghormati batas waktu (fallback '99' = seumur hidup bila tak ada).
    async function saveLicenseFromCloud(cloud) {
      try {
        const { deviceCode } = await getDeviceIdentity();
        const expCode = expCodeFromExpiresAt(cloud.license_expires_at || null);
        const lic = {
          status: 'active',
          startedAt: new Date().toISOString(),
          serial: cloud.license_serial || '',
          deviceCode,
          expCode,
          expiryLabel: expCode === '99' ? 'Seumur Hidup' : decodeExpiryLabel(expCode)
        };
        await saveLicense(lic);
      } catch (e) {
        console.warn('saveLicenseFromCloud failed:', e?.message || e);
      }
    }

    function expCodeFromExpiresAt(ts) {
      if (!ts) return '99';
      const end = new Date(ts);
      if (isNaN(end.getTime())) return '99';
      const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
      if (days <= 0) return '0D';
      if (days <= 365) return days + 'D';
      return String(Math.ceil(days / 30));
    }

let _licenseSyncInFlight = null;
let _pendingProfilePullRefresh = false; // C2v2: pending UI refresh after cloud pull

/**
 * Opsi 3 — lock-boot: verifikasi bahwa lisensi AKTIF lokal masih cocok dengan
 * profil baris serial di cloud. Kalau serial sudah di-reassign ke perangkat/
 * profil lain yang berbeda, langsung tampilkan lock overlay profil-mismatch
 * dan hentikan pemakaian (tidak menunggu aksi manual aktivasi).
 */
async function verifyBootLicenseAssignment() {
  if (!navigator.onLine) return;
  const { getLicense } = await import('./license.logic.js');
  const lic = await getLicense();
  if (!lic || lic.status !== 'active' || !lic.serial) return; // hanya lisensi aktif

  const { verifyAndAssignSerial } = await import('./license.sync.js');
  const { getUnitId } = await import('./license.logic.js');
  const unitId = await getUnitId();
  const v = await verifyAndAssignSerial(lic.serial, unitId);
  if (!v.ok && v.reason === 'profile-mismatch') {
    const { renderProfileMismatchOverlay } = await import('./license.ui.js');
    await renderProfileMismatchOverlay();
    return;
  }
  // reason 'serial-not-found' / 'network' / 'assigned' → biarkan state berjalan
  // (not-found juga ditangani oleh syncLicenseStatus; network = offline bebas).
}

async function runLicenseSync() {
  if (!navigator.onLine || _licenseSyncInFlight) return _licenseSyncInFlight;
  _licenseSyncInFlight = syncLicenseStatus().then(async result => {
    if (result?.revoked && window._ksr_enforceRevoked) await window._ksr_enforceRevoked();
    return result;
  }).catch(e => ({ ok: false, reason: 'network', error: e })).finally(() => { _licenseSyncInFlight = null; });
  return _licenseSyncInFlight;
}

// H1 (2026-08-19): Pulih status printer tersimpan dari localStorage
async function restorePrinterStatus() {
  try {
    const saved = getSavedPrinterName();
    const el = document.getElementById('btPrinterStatus');
    const row = document.getElementById('btPrinterConnectRow');
    if (saved && el) {
      el.textContent = '✅ ' + saved + ' (tersimpan)';
      if (row) {
        const titleEl = row.querySelector('.s-title');
        if (titleEl) titleEl.textContent = 'Sambungkan Kembali';
      }
    } else if (el) {
      el.textContent = 'Belum terhubung';
      if (row) {
        const titleEl = row.querySelector('.s-title');
        if (titleEl) titleEl.textContent = 'Hubungkan Printer';
      }
    }
  } catch (e) { console.warn('[BOOT] restorePrinterStatus gagal:', e); }
}

async function boot() {
  await ensureUnitId();

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 1: SYNC DULU SEBELUM APA-PUN (permintaan 2026-08-27)
  // Urutan: sync lisensi → pull profil cloud → inject ke IndexedDB
  // Baru setelah itu render UI. Supaya data yang ditampilkan SELALU fresh.
  // ═══════════════════════════════════════════════════════════════════════

  // 1a-awal) RE-ANCHOR unit_id V3→V4 (port rosok 2026-09-04): konvergensi
  // identitas lintas-browser SEBELUM operasi cloud apa pun (sync, pull, push,
  // subscribe realtime) supaya semuanya menunjuk baris kanonik yang sama.
  try { const { reanchorUnitId } = await import('./license.sync.js'); await reanchorUnitId(); }
  catch (e) { console.warn('[BOOT] reanchor unit_id gagal:', e?.message || e); }

  // 1a) Sync lisensi dari cloud → lokal (termasuk pull profil jika license aktif)
  try { await runLicenseSync(); } catch (e) { console.warn('[BOOT] license sync gagal:', e?.message || e); }

  // 1a-bis) Opsi 3 lock-boot: kalau lisensi AKTIF dan online, verifikasi sekali lagi
  // bahwa profil perangkat masih cocok dengan baris serial di cloud. Bila profil
  // tidak cocok (serial dipindah ke perangkat lain yg profil beda), aplikasi
  // langsung DIKUNCI — pencegahan pemakaian silang serial.
  try { await verifyBootLicenseAssignment(); } catch (e) { console.warn('[BOOT] verify assignment gagal:', e?.message || e); }

  // 1b) Pull profil dari cloud → IndexedDB (broad pull, tidak hanya saat license aktif).
  //     DI-AWAIT supaya data profil sudah ada di IndexedDB SEBELUM render UI.
  //     Device baru / install ulang / wipeIndexedDB akan otomatis dapat profil.
  let profilePulled = false;
  try {
    await pullCloudProfileIfOnline();
    profilePulled = true;
    console.log('[BOOT] Profil cloud berhasil di-pull ke lokal.');
  } catch (e) {
    console.warn('[BOOT] cloud profile pull gagal:', e?.message || e);
  }

  // 1c) Push lokal → cloud (backfill user lama, self-healing baris hilang).
  //     Setelah pull selesai, push perubahan lokal ke cloud supaya sinkron.
  //     Self-healing (T29): flag "synced" diverifikasi ke server.
  try { await ensureSynced({ silent: true }); } catch (e) { console.warn('[BOOT] sync profil:', e?.message || e); }

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 2: RENDER UI (data sudah fresh di IndexedDB)
  // ═══════════════════════════════════════════════════════════════════════

  // Penomoran transaksi: beri nomor ke transaksi lama SEKALI (guard flag),
  // sebelum render supaya daftar/nota langsung menampilkan nomor yang benar.
  try { await ensureNomorBackfill(); } catch (e) { console.warn('[BOOT] nomor backfill gagal:', e?.message || e); }

  // v161: kenakan status shift kas SEBELUM halaman pertama dirender, supaya
  // gerbang POS dan kartu Beranda tidak bekerja dengan cache kosong.
  try { await refreshShiftCache(); } catch (e) { console.warn('[BOOT] refresh shift kas:', e?.message || e); }

  try { await loadBeranda(); } catch (e) { console.error('[BOOT] loadBeranda gagal:', e); }

  // H1: pulihkan status printer tersimpan
  restorePrinterStatus();

  // Syarat & Ketentuan sekali-jalan (2026-08-29): modal non-blocking bila
  // belum pernah disetujui — bisa ditutup, dibuka ulang dari Bantuan.
  try { if (!(await getSetting('tcAcceptedAt', null))) openModal('tcModal'); } catch (_) { }
  // Tipe order TIDAK dipulihkan lagi dari localStorage (permintaan
  // 2026-09-04): halaman Jualan selalu dibuka dalam keadaan Dine-in.
  // loadPOS() yang menjaga nilainya, termasuk saat keranjang kosong.

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 3: POST-BOOT (background tasks, UI refresh, retry loop)
  // ═══════════════════════════════════════════════════════════════════════

  // Refresh settings UI jika profile pull selesai — pastikan settings
  // menampilkan data terbaru dari cloud.
  if (profilePulled) {
    if (typeof loadSettings === 'function') {
      try { await loadSettings(); } catch (e) { console.warn('[BOOT] settings refresh after pull gagal:', e); }
    } else {
      _pendingProfilePullRefresh = true;
    }
  }

  startSyncRetryLoop();
  // Penawaran pulih cloud utk browser baru (port rosok 2026-09-04) — deferred,
  // tidak pernah memblokir/ganggu boot; semua syarat dicek oleh fungsinya.
  setTimeout(() => { try { import('./backup.js').then(m => m.maybeOfferCloudRestore()).catch(() => {}); } catch (_) {} }, 5000);
  // T19 (audit 2026-08-17/M9): settings module wajib ke-wire untuk banner
  // profil, tapi boot TIDAK BOLEH menggantung selamanya kalau modul itu gagal
  // dimuat (jaringan buruk sebelum SW aktif). Race dengan timeout 8 detik.
  try {
    await Promise.race([
      _settingsReady,
      new Promise((_, rej) => setTimeout(() => rej(new Error('settings module timeout')), 8000))
    ]);
  } catch (e) {
    console.error('[BOOT] settings module tidak termuat:', e?.message || e);
    const { showToast } = await import('./helpers.js');
    showToast('Sebagian fitur gagal dimuat — tutup dan buka ulang aplikasi.', 'error', { duration: 5000 });
  }
  if (typeof checkProfileNotification === 'function') {
    await checkProfileNotification(); // banner "lengkapi profil" bila profil belum lengkap
  }
  // C2v2: bila pull cloud profil selesai setelah settings module ready,
  // lakukan refresh UI sekali lagi untuk menampilkan data terbaru.
  if (_pendingProfilePullRefresh) {
    _pendingProfilePullRefresh = false;
    try { await loadSettings(); } catch (_) { /* abaikan */ }
  }
  setupPWA();

  // PWA: update install button state di settings
  try { await updateInstallRow(); } catch (e) { console.warn('[BOOT] updateInstallRow gagal:', e); }

  // Subscribe to realtime license updates
  try {
    const unitId = await ensureUnitId();
    subscribeToLicenseUpdates(unitId);
  } catch (e) {
    if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('Realtime subscription skipped:', e?.message || e);
  }
}

// PWA (2026-08-19): Update tombol install di settings — pakai updateInstallRow
// dari pwa.js agar tidak duplikat logika

// Error boundary for nav setup: guard so a DOM/nav issue never blocks the router below.
try {
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Attaching nav handlers...');
  const navItems = document.querySelectorAll('.nav-item');
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Found', navItems.length, 'nav items');
  navItems.forEach((btn, idx) => {
    btn.addEventListener('click', (e) => {
      if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Nav clicked:', btn.dataset.page);
      const page = btn.dataset.page;
      if (page) navigateTo(page);
    });
  });
  if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[APP] Nav handlers attached');
} catch(e) { console.error('[APP] Nav setup failed:', e); }

initRouter();

// Start the app
init();

// Deteksi update jalan di SEMUA state lisensi (aktif/trial/expired/locked),
// bukan cuma di boot() yang hanya dipanggil saat lisensi aktif/trial.
startUpdateWatcher();

// Ketika SW baru mengambil alih controller (skipWaiting -> activate ->
// clients.claim), paksa cek update agar overlay muncul tanpa hard refresh.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (typeof checkForUpdate === 'function') checkForUpdate();
  });
}

// ---- Version (P1/N7): single source of truth wired to window + DOM ----
window.APP_VERSION = APP_VERSION;
window.APP_VERSION_LABEL = APP_VERSION_LABEL;
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('appVersionLabel');
  if (el) el.textContent = APP_VERSION_LABEL;
});
