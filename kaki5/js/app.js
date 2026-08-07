// ==================== APP ENTRY (ESM) ====================
// Single entry module loaded via <script type="module" src="js/app.js">.
// ESM keeps module scope private, so this file re-exposes on `window` every
// function referenced by inline HTML handlers (onclick/oninput) or by template
// strings built in the feature modules. All app state flows through app-state.js
// setters; this module is the only place that bridges ESM exports → window globals.

import { showPage } from './navigation.js';
import { getSetting, setSetting } from './db.js';
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
  openExpenseForm, closeExpenseModal, saveExpense
} from './pengeluaran.js';
import { loadReport, setReportPeriodUI, navReportDate, toggleExpenseCat, setCustomDate } from './laporan.js';
import { showTrxDetail, closeTrxDetail, hapusPenjualan } from './trxdetail.js';
import { showExpenseDetail } from './expensedetail.js';
import { loadSettings, openNameModal, closeNameModal, saveNamaWarung, openOwnerModal, closeOwnerModal, saveOwner, openWaModal, closeWaModal, saveWa, openAlamatModal, closeAlamatModal, saveAlamat, checkProfileNotification } from './settings.js';
import { ensureSynced } from './sync.js';
import { showConfirm, closeConfirm } from './confirm.js';
import { exportData, importData, confirmClearAll } from './backup.js';
import { checkOnboarding } from './onboarding.js';
import {
  connectBTPrinter, disconnectBTPrinter, printNota, printLastNota, testPrint
} from './printer.js';
import { setupPWA, installPWA } from './pwa.js';
import {
  getLicenseStatus, startTrial, ensureUnitId, activateSerial, contactViaWA, MAX_EXTENSIONS,
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
window.openExpenseForm    = openExpenseForm;
window.closeExpenseModal  = closeExpenseModal;
window.saveExpense        = saveExpense;
window.loadReport         = loadReport;
window.setReportPeriod    = setReportPeriodUI;
window.navReportDate      = navReportDate;
window.toggleExpenseCat   = toggleExpenseCat;
window.setCustomDate      = setCustomDate;
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
window.checkOnboarding     = checkOnboarding;
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
// --- Syarat & Ketentuan 2-STEP onboarding (user gaptek friendly) ---
// STEP 1 → STEP 2: validasi nama usaha, simpan, tampilkan modal S&K (trial BELUM mulai)
window._ksr_proceedToTC = async () => {
  const msg = document.getElementById('onboardMsg');
  if (msg) msg.style.display = 'none';
  const nama = document.getElementById('onboardName')?.value.trim() || '';
  const existing = await getSetting('namaWarung', '');
  if (!nama && !existing) {
    if (msg) { msg.textContent = 'Mohon isi Nama Usaha terlebih dahulu.'; msg.style.display = 'block'; }
    return;
  }
  if (nama) {
    await setSetting('namaWarung', nama);
    const nw = document.getElementById('namaWarung');
    if (nw) nw.textContent = nama;
  }
  document.getElementById('tcModal')?.classList.add('show'); // STEP 2
};
// STEP 2 BATAL: tutup modal → balik ke STEP 1 (gate tetap, nama sudah keisi)
window._ksr_cancelTC = () => document.getElementById('tcModal')?.classList.remove('show');
// STEP 2 SETUJU: mulai masa coba + masuk aplikasi
window._ksr_acceptTC = async () => {
  document.getElementById('tcModal')?.classList.remove('show');
  const msg = document.getElementById('onboardMsg');
  if (msg) msg.style.display = 'none';
  await startTrial();
  await resolveLicenseGate();
  await boot();
};
window._ksr_onboardInput = () => {
  const msg = document.getElementById('onboardMsg');
  if (msg) msg.style.display = 'none';
};

// ---------- SMART GATE (onboarding ↔ lisensi) ----------
async function resolveLicenseGate() {
  const status = await getLicenseStatus();
  const gate = document.getElementById('licenseGate');
  if (status.status === 'active' || status.status === 'trial') {
    if (gate) gate.style.display = 'none';
  } else {
    renderGate(status);
    if (gate) gate.style.display = 'flex';
  }
  await checkLicenseGate();
}

function renderGate(status) {
  const ob = document.getElementById('gateOnboarding');
  const lc = document.getElementById('gateLicenseBlock');
  if (!ob || !lc) return;
  if (status.status === 'none') {
    ob.style.display = '';
    lc.style.display = 'none';
  } else {
    ob.style.display = 'none';
    lc.style.display = '';
    lc.innerHTML = gateLicenseHtml(status);
  }
}

function gateLicenseHtml(status) {
  const extUsed = status.extensionsUsed || 0;
  const isPaidExpired = status.protocol === 'licensed-expired';
  const intro = isPaidExpired
    ? '<p style="font-size:13px;color:var(--text2);margin:8px 0 14px;line-height:1.5">Lisensi berbayar Anda sudah kedaluwarsa.<br>Masukkan kode lisensi baru untuk melanjutkan.</p>'
    : '<p style="font-size:13px;color:var(--text2);margin:8px 0 14px;line-height:1.5">Masa coba 7 hari Anda sudah berakhir.<br>Aktivasi lisensi resmi untuk terus memakai semua fitur Kasir Solo.</p>';
  const extendLink = extUsed < MAX_EXTENSIONS
    ? `<a href="javascript:void(0)" onclick="window._ksr_extendGate()" style="display:block;margin-top:14px;font-size:13px;color:var(--primary);font-weight:700;text-decoration:underline">🎁 Perpanjang masa coba (+1 hari, gratis)</a><div style="font-size:12px;color:var(--text3);margin-top:4px">Perpanjangan dipakai ${extUsed}/${MAX_EXTENSIONS}x</div>`
    : `<div style="font-size:12px;color:var(--red);margin-top:10px">Jatah perpanjangan gratis sudah habis (${MAX_EXTENSIONS}x). Silakan aktivasi lisensi resmi.</div>`;
  return `
    <img src="assets/icon.png" style="width:80px;height:80px;margin-bottom:8px;border-radius:50%" alt="Logo">
    <div style="font-size:22px;font-weight:800;margin-bottom:4px">Kasir Solo</div><div style="font-size:14px;color:var(--text2);margin-bottom:16px">Kaki Lima Edition</div>
    <div style="font-size:17px;font-weight:800;color:var(--red)">⏰ Masa Coba Gratis Habis</div>
    ${intro}
    <div class="field mt8"><label class="field-label">Kode Lisensi</label>
      <input type="text" id="gateSerial" class="form-input uppercase" placeholder="KK5-XXXX-XXXX-XX-XXXXXX">
    </div>
    <div id="gateLicMsg" style="display:none;color:var(--red);font-size:13px;margin-top:6px"></div>
    <div class="license-actions" style="display:flex;gap:10px;margin-top:14px">
      <button class="btn-buy-wa" onclick="window._ksr_buyGate()">💬 Beli</button>
      <button class="btn btn-primary" onclick="window._ksr_activateGate()">🔓 Aktifkan</button>
    </div>
    ${extendLink}
    <div style="font-size:12px;color:var(--text3);margin-top:14px">Ada masalah? Hubungi <a href="https://wa.me/628816566935" style="color:var(--green);text-decoration:none">WhatsApp</a></div>
  `;
}

window._ksr_buyGate = () => contactViaWA();
window._ksr_activateGate = async () => {
  const key = (document.getElementById('gateSerial')?.value || '').trim().toUpperCase();
  const msg = document.getElementById('gateLicMsg');
  if (!key) { if (msg){msg.textContent='Masukkan kode lisensi.';msg.style.display='block';} return; }
  const res = await activateSerial(key);
  if (res.valid) {
    const gate = document.getElementById('licenseGate');
    if (gate) gate.style.display = 'none';
    document.getElementById('lockOverlay')?.classList.remove('show');
    await boot();
  } else {
    if (msg){msg.textContent = res.message || 'Kode lisensi tidak valid.';msg.style.display='block';}
  }
};
window._ksr_extendGate = async () => {
  await openExtendFlow(); // share-to-extend: share + konfirmasi + grant
  const st = await getLicenseStatus();
  if (st.status === 'trial' || st.status === 'active') {
    const gate = document.getElementById('licenseGate');
    if (gate) gate.style.display = 'none';
    document.getElementById('lockOverlay')?.classList.remove('show');
    await boot();
  } else {
    renderGate(st); // refresh (usage / habis)
  }
};

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
    // SMART GATE: user baru → onboarding; trial habis / lisensi kedaluwarsa → input lisensi
    renderGate(status);
    if (gate) gate.style.display = 'flex';
    if (status.status === 'none') {
      const existing = await getSetting('namaWarung', '');
      const nameEl = document.getElementById('onboardName');
      if (nameEl && existing) nameEl.value = existing;
    }
  }
  await checkLicenseGate();
}

async function boot() {
  await ensureUnitId();
  await loadBeranda();
  await checkOnboarding();
  // Backfill otomatis: user yang sudah pakai (data cuma lokal) di-push sekali
  ensureSynced({ silent: true }); // non-blocking, retry saat online berikutnya
  await checkProfileNotification(); // banner "lengkapi profil" bila profil belum lengkap
  setupPWA();
}

document.addEventListener('DOMContentLoaded', init);
