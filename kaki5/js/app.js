// ==================== APP ENTRY (ESM) ====================
// Single entry module loaded via <script type="module" src="js/app.js">.
// ESM keeps module scope private, so this file re-exposes on `window` every
// function referenced by inline HTML handlers (onclick/oninput) or by template
// strings built in the feature modules. All app state flows through app-state.js
// setters; this module is the only place that bridges ESM exports → window globals.

import { showPage } from './navigation.js';
import { loadBeranda } from './beranda.js';
import { renderPlatformCarousel, platGoTo } from './carousel.js';
import {
  loadPOS, renderPOSMenu, addToCart, changeQty, hitungKembalian,
  simpanPenjualan, openCartModal, closeCartModal, selectPosCat, setNominalBayar,
  formatBayarInput, selectAllBayarInput
} from './pos.js';
import {
  renderMenuList, openMenuForm, closeMenuModal, saveMenu, toggleMenu, confirmDeleteMenu
} from './menu.js';
import {
  loadExpenses, navExpenseDate, openExpenseForm, closeExpenseModal,
  saveExpense, confirmDeleteExpense
} from './pengeluaran.js';
import { loadReport, setReportPeriodUI, navReportDate } from './laporan.js';
import { showTrxDetail, closeTrxDetail, hapusPenjualan } from './trxdetail.js';
import { showExpenseDetail } from './expensedetail.js';
import { loadSettings, openNameModal, closeNameModal, saveNamaWarung, openOwnerModal, closeOwnerModal, saveOwner, openWaModal, closeWaModal, saveWa, openAlamatModal, closeAlamatModal, saveAlamat } from './settings.js';
import { showConfirm, closeConfirm } from './confirm.js';
import { exportData, importData, confirmClearAll } from './backup.js';
import { checkOnboarding, finishOnboarding } from './onboarding.js';
import {
  connectBTPrinter, disconnectBTPrinter, printNota, printLastNota, testPrint
} from './printer.js';
import { setupPWA, installPWA } from './pwa.js';
import {
  getLicenseStatus, startTrial, activateSerial, ensureUnitId,
  setLicenseRefs, checkLicenseGate, updateTrialChip, renderLicenseInfoCard,
  openLicenseSheet, openExtendFlow, grantExtension, activateLicense,
  tryShare
} from './license.js';

// ==================== WIRE WINDOW GLOBALS (for HTML onclick) ====================
window.showPage           = showPage;
window.renderPOSMenu      = renderPOSMenu;
window.addToCart          = addToCart;
window.selectPosCat       = selectPosCat;
window.changeQty          = changeQty;
window.hitungKembalian    = hitungKembalian;
window.simpanPenjualan    = simpanPenjualan;
window.openCartModal      = openCartModal;
window.setNominalBayar    = setNominalBayar;
window.formatBayarInput   = formatBayarInput;
window.selectAllBayarInput = selectAllBayarInput;
window.closeCartModal     = closeCartModal;
window.renderMenuList     = renderMenuList;
window.openMenuForm       = openMenuForm;
window.closeMenuModal     = closeMenuModal;
window.saveMenu           = saveMenu;
window.toggleMenu         = toggleMenu;
window.confirmDeleteMenu  = confirmDeleteMenu;
window.loadExpenses       = loadExpenses;
window.navExpenseDate     = navExpenseDate;
window.openExpenseForm    = openExpenseForm;
window.closeExpenseModal  = closeExpenseModal;
window.saveExpense        = saveExpense;
window.confirmDeleteExpense = confirmDeleteExpense;
window.loadReport         = loadReport;
window.setReportPeriod    = setReportPeriodUI;
window.navReportDate      = navReportDate;
window.showTrxDetail      = showTrxDetail;
window.closeTrxDetail     = closeTrxDetail;
window.hapusPenjualan     = hapusPenjualan;
window.showExpenseDetail  = showExpenseDetail;
window.loadSettings       = loadSettings;
window.openNameModal      = openNameModal;
window.closeNameModal     = closeNameModal;
window.saveNamaWarung     = saveNamaWarung;
window.openOwnerModal     = openOwnerModal;
window.closeOwnerModal    = closeOwnerModal;
window.saveOwner          = saveOwner;
window.openWaModal        = openWaModal;
window.closeWaModal       = closeWaModal;
window.saveWa             = saveWa;
window.openAlamatModal    = openAlamatModal;
window.closeAlamatModal   = closeAlamatModal;
window.saveAlamat         = saveAlamat;
window.showConfirm        = showConfirm;
window.closeConfirm       = closeConfirm;
window.exportData         = exportData;
window.importData         = importData;
window.confirmClearAll    = confirmClearAll;
window.finishOnboarding   = finishOnboarding;
window.connectBTPrinter   = connectBTPrinter;
window.disconnectBTPrinter= disconnectBTPrinter;
window.printNota          = printNota;
window.printLastNota      = printLastNota;
window.testPrint          = testPrint;
window.installPWA         = installPWA;
window.renderPlatformCarousel = renderPlatformCarousel;
window._ksr_platGoTo = (slideIdx) => {
  platGoTo(slideIdx);
};

// ==================== LICENSE GATE ====================
// Expose license actions to the gate UI (index.html)
// Register license UI refs (injected from license.js to avoid circular imports)
setLicenseRefs({
  updateTrialChip,
  renderLicenseInfoCard,
  checkLicenseGate,
  openExtendFlow,
  grantExtension,
  openLicenseSheet
});
window._ksr_openLicenseSheet = openLicenseSheet;
window._ksr_openExtendFlow   = openExtendFlow;
window._ksr_activateLicense  = activateLicense;
window._ksr_closeSheet       = (id) => document.getElementById(id)?.classList.remove('show');
window.licenseStartTrial  = async () => { await startTrial(); await resolveLicenseGate(); await boot(); };
window.licenseActivate    = async () => {
  const val = document.getElementById('licSerialInput').value;
  const res = await activateSerial(val);
  if (res.valid) {
    await resolveLicenseGate();
    await boot();
  } else {
    const msg = document.getElementById('licGateMsg');
    if (msg) { msg.textContent = res.message; msg.style.display = 'block'; }
  }
};

async function resolveLicenseGate() {
  const status = await getLicenseStatus();
  const gate = document.getElementById('licenseGate');
  if (gate) gate.style.display = (status.status === 'active' || status.status === 'trial')
    ? 'none' : 'flex';
  await checkLicenseGate();
}

// Periodic license re-check (60s) — updates trial chip/cards, shows lock on expiry
setInterval(() => { checkLicenseGate(); }, 60000);

// ==================== INIT ====================
async function init() {
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });

  // License gate first (blocks app until trial starts or a valid serial is entered)
  const status = await getLicenseStatus();
  const gate = document.getElementById('licenseGate');
  if (status.status === 'active' || status.status === 'trial') {
    if (gate) gate.style.display = 'none';
    await boot();
  } else {
    if (gate) gate.style.display = 'flex';
    // gate UI stays visible until resolved
  }
  await checkLicenseGate();
}

async function boot() {
  await ensureUnitId();
  await loadBeranda();
  await checkOnboarding();
  setupPWA();
}

document.addEventListener('DOMContentLoaded', init);
