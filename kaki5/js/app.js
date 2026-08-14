// ==================== APP ENTRY (ESM) ====================
// Kaki Lima POS System - Modular Atomic Architecture
// Entry point that wires ESM modules to window globals
// Supports lazy-loading, navigation, and feature modules
console.log('[APP] Starting...');
// Single entry module loaded via <script type="module" src="js/app.js">.
// ESM keeps module scope private, so this file re-exposes on `window` every
// function referenced by inline HTML handlers (onclick/oninput) or by template
// strings built in the feature modules. All app state flows through app-state.js
// setters; this module is the only place that bridges ESM exports -> window globals.

import { navigateTo, initRouter, getCurrentPage } from './navigation.js';
import { getSetting, setSetting } from './db.js';
import { validatePhone, formatPhoneDisplay } from './helpers.js';
import { renderPlatformCarousel, platGoTo } from './carousel.js';
import { debounce } from './helpers.pure.js';
import { ensureSynced } from './sync.js';
import { showConfirm, closeConfirm } from './confirm.js';
import { exportData, importData, confirmClearAll } from './backup.js';
import { checkOnboarding } from './onboarding.js';
import { setupPWA, installPWA } from './pwa.js';
import { connectBTPrinter, disconnectBTPrinter, printNota, printLastNota, testPrint } from './printer.js';
import { showTrxDetail, closeTrxDetail, hapusPenjualan } from './trxdetail.js';
import { showExpenseDetail } from './expensedetail.js';
import { subscribeToLicenseUpdates, openPurchaseSheet, purchaseShowUpload, handleBuktiUpload, submitPurchase, pollLicenseStatus } from './purchase.js';
import { syncNow as _ksrSyncNow } from './settings.sync.js';
import { APP_VERSION, APP_VERSION_LABEL } from './version.js';
import { setReportPeriod, setReportDate, setCustomStart, setCustomEnd, setPosCat, setCurrentPage, setCart, setSelectedTrxId, setLastSaleId, setPlatCurrentSlide, setPlatAutoTimer } from './app-state.js';

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

// Wire page modules on first use
const _posWireMap = { __wired: false, loadPOS: 'loadPOS', renderPOSMenu: 'renderPOSMenu', renderPOSMenuDebounced: 'renderPOSMenuDebounced', addToCart: 'addToCart', changeQty: 'changeQty', hitungKembalian: 'hitungKembalian', simpanPenjualan: 'simpanPenjualan', openCartModal: 'openCartModal', closeCartModal: 'closeCartModal', selectPosCat: 'selectPosCat', setNominalBayar: 'setNominalBayar', formatBayarInput: 'formatBayarInput', selectAllBayarInput: 'selectAllBayarInput' };
const _menuWireMap = { __wired: false, renderMenuList: 'renderMenuList', renderMenuListDebounced: 'renderMenuListDebounced', openMenuForm: 'openMenuForm', closeMenuModal: 'closeMenuModal', saveMenu: 'saveMenu', toggleMenu: 'toggleMenu', confirmDeleteMenu: 'confirmDeleteMenu' };
const _laporanWireMap = { __wired: false, loadReport: 'loadReport', setReportPeriod: 'setReportPeriodUI', setReportPeriodUI: 'setReportPeriodUI', navReportDate: 'navReportDate', toggleExpenseCat: 'toggleExpenseCat', setCustomDate: 'setCustomDate', toggleCustomPicker: 'toggleCustomPicker', pickDate: 'pickDate', pickWeek: 'pickWeek', pickMonth: 'pickMonth', pickCustomDate: 'pickCustomDate' };
const _settingsWireMap = { __wired: false, loadSettings: 'loadSettings', openNameModal: 'openNameModal', closeNameModal: 'closeNameModal', saveNamaWarung: 'saveNamaWarung', openOwnerModal: 'openOwnerModal', closeOwnerModal: 'closeOwnerModal', saveOwner: 'saveOwner', openWaModal: 'openWaModal', closeWaModal: 'closeWaModal', saveWa: 'saveWa', openAlamatModal: 'openAlamatModal', closeAlamatModal: 'closeAlamatModal', saveAlamat: 'saveAlamat', checkProfileNotification: 'checkProfileNotification' };
const _bantuanWireMap = { __wired: false, initBantuan: 'initBantuan', toggleTutorial: 'toggleTutorial' };
const _pengeluaranWireMap = { __wired: false, openExpenseForm: 'openExpenseForm', closeExpenseModal: 'closeExpenseModal', saveExpense: 'saveExpense' };
const _berandaWireMap = { __wired: false, loadBeranda: 'loadBeranda' };

// Pre-wire critical modules immediately (beranda, pos) for snappy first load
import('./pos.js').then(m => {
  _posModule = m;
  for (const [key, modKey] of Object.entries(_posWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _posWireMap.__wired = true;
  console.log('[APP] Wired pos module');
}).catch(e => console.error('[APP] Failed to wire pos:', e));

import('./beranda.js').then(m => {
  _berandaModule = m;
  for (const [key, modKey] of Object.entries(_berandaWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _berandaWireMap.__wired = true;
  console.log('[APP] Wired beranda module');
}).catch(e => console.error('[APP] Failed to wire beranda:', e));

// Lazy-wire menu module (less frequently accessed)
import('./menu.js').then(m => {
  _menuModule = m;
  for (const [key, modKey] of Object.entries(_menuWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _menuWireMap.__wired = true;
  console.log('[APP] Wired menu module');
}).catch(e => console.error('[APP] Failed to wire menu:', e));

// Lazy-wire laporan module (large module, only load when needed)
import('./laporan.js').then(m => {
  _laporanModule = m;
  for (const [key, modKey] of Object.entries(_laporanWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _laporanWireMap.__wired = true;
  console.log('[APP] Wired laporan module');
}).catch(e => console.error('[APP] Failed to wire laporan:', e));

// Lazy-wire settings module (large module with region picker)
import('./settings.js').then(m => {
  _settingsModule = m;
  for (const [key, modKey] of Object.entries(_settingsWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _settingsWireMap.__wired = true;
  if (_settingsReadyResolve) { _settingsReadyResolve(); _settingsReadyResolve = null; }
  console.log('[APP] Wired settings module');
}).catch(e => console.error('[APP] Failed to wire settings:', e));

// Lazy-wire bantuan module
import('./bantuan.js').then(m => {
  _bantuanModule = m;
  for (const [key, modKey] of Object.entries(_bantuanWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _bantuanWireMap.__wired = true;
  console.log('[APP] Wired bantuan module');
}).catch(e => console.error('[APP] Failed to wire bantuan:', e));

// Lazy-wire pengeluaran module
import('./pengeluaran.js').then(m => {
  _pengeluaranModule = m;
  for (const [key, modKey] of Object.entries(_pengeluaranWireMap)) {
    if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
  }
  _pengeluaranWireMap.__wired = true;
  console.log('[APP] Wired pengeluaran module');
}).catch(e => console.error('[APP] Failed to wire pengeluaran:', e));

// ==================== WIRE WINDOW GLOBALS (for HTML onclick) ====================
// These are available immediately since they're imported at the top of this module.
window.showPage           = navigateTo;
window._ksr_navigateTo    = navigateTo;
window._ksr_syncNow       = _ksrSyncNow;
window.closeConfirm       = closeConfirm;
window.exportData         = exportData;
window.importData         = importData;
window.confirmClearAll    = confirmClearAll;
window.checkOnboarding    = checkOnboarding;
window.connectBTPrinter   = connectBTPrinter;
window.disconnectBTPrinter= disconnectBTPrinter;
window.printNota          = printNota;
window.printLastNota      = printLastNota;
window.testPrint          = testPrint;
window.showTrxDetail      = showTrxDetail;
window.closeTrxDetail     = closeTrxDetail;
window.hapusPenjualan     = hapusPenjualan;
window.showExpenseDetail  = showExpenseDetail;
window.installPWA         = installPWA;
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

// ==================== LICENSE GATE ====================
// Expose license actions to the gate UI (index.html)
import { setLicenseRefs, updateTrialChip, renderLicenseInfoCard, checkLicenseGate, openExtendFlow, grantExtension, openLicenseSheet, getLicenseStatus, startTrial, activateSerial, activateLicense, contactViaWA, checkCloudStatusAndUnlock, toggleManualKey, fetchLicenseStatusFromCloud, isDeviceKnownOnCloud, saveLicense, getDeviceIdentity, decodeExpiryLabel } from './license.js';
import { ensureUnitId, isOnboarded, markOnboarded } from './license.logic.js';

setLicenseRefs({
  updateTrialChip,
  renderLicenseInfoCard,
  checkLicenseGate,
  openExtendFlow,
  grantExtension,
  openLicenseSheet,
  openPurchaseSheet
});
window._ksr_openLicenseSheet = openLicenseSheet;
window._ksr_openExtendFlow   = openExtendFlow;
window._ksr_activateLicense  = activateLicense; // UI: trima inputId, baca input, validasi serial
window._ksr_openPurchaseSheet = openPurchaseSheet;
window._ksr_purchaseShowUpload = purchaseShowUpload;
window._ksr_checkLicenseStatus = checkCloudStatusAndUnlock;
window._ksr_toggleManualKey  = toggleManualKey;
window._ksr_handleBuktiUpload = handleBuktiUpload;
window._ksr_submitPurchase   = submitPurchase;
window._ksr_pollLicenseStatus = pollLicenseStatus;
window._ksr_subscribeToLicenseUpdates = subscribeToLicenseUpdates;
window._ksr_closeSheet       = (id) => document.getElementById(id)?.classList.remove('show');
window._ksr_contactViaWA     = contactViaWA;
// --- Syarat & Ketentuan 2-STEP onboarding (user gaptek friendly) ---
// STEP 1 -> STEP 2: validasi nama usaha, simpan, tampilkan modal S&K (trial BELUM mulai)
window._ksr_proceedToTC = async () => {
  const msg = document.getElementById('onboardMsg');
  if (msg) msg.style.display = 'none';
  const wa = document.getElementById('onboardWa')?.value.trim() || '';
  const existing = await getSetting('noWhatsapp', '');
  if (!wa && !existing) {
    if (msg) { msg.textContent = 'Mohon isi Nomor WhatsApp terlebih dahulu.'; msg.style.display = 'block'; }
    return;
  }
  // Validate with strict Indonesian WhatsApp format
  const res = validatePhone(wa);
  if (!res.valid) {
    if (msg) { msg.textContent = res.message; msg.style.display = 'block'; }
    return;
  }
  if (wa) {
    await setSetting('noWhatsapp', res.normalized);
    const nw = document.getElementById('settingWa');
    if (nw) nw.textContent = formatPhoneDisplay(res.normalized);
  }
  document.getElementById('tcModal')?.classList.add('show'); // STEP 2
};
// STEP 2 BATAL: tutup modal -> balik ke STEP 1 (gate tetap, nama sudah keisi)
window._ksr_cancelTC = () => document.getElementById('tcModal')?.classList.remove('show');
// STEP 2 SETUJU: mulai masa coba + masuk aplikasi
window._ksr_acceptTC = async () => {
  document.getElementById('tcModal')?.classList.remove('show');
  const msg = document.getElementById('onboardMsg');
  if (msg) msg.style.display = 'none';
  await startTrial();
    await markOnboarded(); // onboarding selesai sekali -> jangan tampil lagi di perangkat ini
    await resolveLicenseGate();
    await boot();
  };
window._ksr_onboardInput = () => {
  const msg = document.getElementById('onboardMsg');
  if (msg) msg.style.display = 'none';
};

// ---------- SMART GATE (onboarding <-> lisensi) ----------
async function resolveLicenseGate() {
  const status = await getLicenseStatus();
  const gate = document.getElementById('licenseGate');
  if (status.status === 'active' || status.status === 'trial') {
    if (gate) gate.style.display = 'none';
  } else {
      await renderGate(status);
    if (gate) gate.style.display = 'flex';
  }
  await checkLicenseGate();
}

async function renderGate(status) {
  const ob = document.getElementById('gateOnboarding');
  const lc = document.getElementById('gateLicenseBlock');
  if (!ob || !lc) return;
  // Onboarding hanya sekali per perangkat. Device yang sudah dikenal (pernah
  // trial/aktif atau sudah pernah selesai onboarding) langsung ke gate lisensi.
  const onboarded = status.status !== 'none' || await isOnboarded();
  if (status.status === 'none' && !onboarded) {
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
      ? '<p style="font-size:13px;color:var(--text2);margin:8px 0 14px;line-height:1.5">Lisensi berbayar Anda sudah kedaluwarsa.<br>Beli lisensi baru dan admin akan mengaktifkannya otomatis setelah pembayaran diverifikasi.</p>'
      : '<p style="font-size:13px;color:var(--text2);margin:8px 0 14px;line-height:1.5">Masa coba 7 hari Anda sudah berakhir.<br>Beli lisensi resmi — aktivasi otomatis oleh admin setelah pembayaran diverifikasi.</p>';
  const extendLink = extUsed < 20
    ? `<a href="javascript:void(0)" onclick="window._ksr_extendGate()" style="display:block;margin-top:14px;font-size:13px;color:var(--primary);font-weight:700;text-decoration:underline">Nikmati perpanjangan masa coba (+1 hari, gratis)</a><div style="font-size:12px;color:var(--text3);margin-top:4px">Perpanjangan dipakai ${extUsed}/20x</div>`
      : `<div style="font-size:12px;color:var(--red);margin-top:10px">Jatah perpanjangan gratis sudah habis (20x). Silakan beli lisensi resmi.</div>`;
  return `
    <img src="assets/icon.png" style="width:80px;height:80px;margin-bottom:8px;border-radius:50%" alt="Logo">
    <div style="font-size:22px;font-weight:800;margin-bottom:4px">Kasir Solo</div><div style="font-size:14px;color:var(--text2);margin-bottom:16px">Kaki Lima Edition</div>
    <div style="font-size:17px;font-weight:800;color:var(--red)">Masa Coba Gratis Habis</div>
    ${intro}
      <div class="license-actions" style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
        <button class="btn-buy-wa" style="width:100%" onclick="window._ksr_buyGate()">💳 Beli Lisensi (QRIS)</button>
    </div>
      <div id="gateLicMsg" style="display:none;color:var(--red);font-size:13px;margin-top:8px"></div>
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
        <a href="javascript:void(0)" onclick="window._ksr_toggleManualGate()" style="font-size:12px;color:var(--text3);font-weight:700;text-decoration:underline">Sudah punya kode? Aktivasi manual</a>
        <div id="gateManualWrap" style="display:none;margin-top:8px;text-align:left">
          <div class="field"><input type="text" id="gateSerial" class="form-input uppercase" placeholder="KK5-XXXX-XXXX-XX-XXXXXX"></div>
          <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="window._ksr_activateGate()">🔑 Aktifkan Kode</button>
        </div>
      </div>
      ${extendLink}
      <div style="font-size:12px;color:var(--text3);margin-top:14px">Ada masalah? Hubungi <a href="https://wa.me/628816566935" style="color:var(--green);text-decoration:none">WhatsApp</a></div>
    `;
  }

window._ksr_buyGate = () => openPurchaseSheet(); // buka sheet QRIS (flow otomatis)
window._ksr_toggleManualGate = () => {
  const wrap = document.getElementById('gateManualWrap');
  if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
};
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
      await renderGate(st); // refresh (usage / habis)
  }
};

// Periodic license re-check (60s) -- updates trial chip/cards, shows lock on expiry
setInterval(() => { checkLicenseGate(); }, 60000);

// Sync body.gate-active dengan visibility #licenseGate
// supaya navbar/header disembunyikan saat onboarding/gate full-screen aktif
function syncGateBodyClass() {
  const gate = document.getElementById('licenseGate');
  const visible = !!(gate && gate.style.display && gate.style.display !== 'none');
  document.body.classList.toggle('gate-active', visible);
}
const _gateEl = document.getElementById('licenseGate');
if (_gateEl) {
  new MutationObserver(syncGateBodyClass).observe(_gateEl, { attributes: true, attributeFilter: ['style'] });
  syncGateBodyClass();
}

// ==================== INIT ====================
async function init() {
  // Close modals: klik di luar (backdrop) tutup modal itu; klik navbar tutup semua.
  // Pakai event delegation di document supaya berlaku juga untuk modal yang
  // dibuat/dirender dinamis setelah init (bukan hanya yang ada saat load).
  document.addEventListener('click', (e) => {
    const t = e.target;
    // 1) Klik langsung pada backdrop `.modal-overlay` -> tutup modal tsb.
    //    (Konten modal adalah child, jadi klik konten tidak tertutup.)
    // lockOverlay = hard lock gate (trial habis / lisensi invalid), TIDAK boleh
    // ditutup lewat klik backdrop atau navbar supaya gate-nya gak bisa dilewati.
    const closeOverlays = () =>
      document.querySelectorAll('.modal-overlay.show').forEach((o) => {
        if (o.id !== 'lockOverlay') o.classList.remove('show');
      });
    // 1) Klik langsung pada backdrop `.modal-overlay` -> tutup modal tsb.
    //    (Konten modal adalah child, jadi klik konten tidak tertutup.)
    if (t instanceof Element && t.classList?.contains('modal-overlay') && t.classList.contains('show')) {
      if (t.id !== 'lockOverlay') t.classList.remove('show');
      return;
    }
    // 2) Klik menu navigasi (navbar bawah) -> tutup semua modal.
    if (t instanceof Element && t.closest?.('.nav-item')) {
      closeOverlays();
    }
  });

  // License gate first (blocks app until trial starts or a valid serial is entered)
  const status = await getLicenseStatus();
  const gate = document.getElementById('licenseGate');
  if (status.status === 'active' || status.status === 'trial') {
    if (gate) gate.style.display = 'none';
    await boot();
  } else {
      // SMART GATE: device baru -> onboarding; device dikenal -> langsung lanjut;
      // trial habis / lisensi kedaluwarsa -> input lisensi.
      if (status.status === 'none') {
        const onboardedLocal = await isOnboarded();
        if (!onboardedLocal) {
          // Belum dikenal lokal -> tanya cloud (perangkat fisik). Basis unit_id
          // deterministik dari fingerprint, jadi sama walau ganti browser.
          const known = await isDeviceKnownOnCloud();
          if (known === true) {
            await markOnboarded(); // skip onboarding utk perangkat fisik ini
            await continueKnownDevice();
            await checkLicenseGate();
            return;
          }
          // known === false (device baru) atau null (offline) -> onboarding.
        }
      }
      await renderGate(status);
      if (gate) gate.style.display = 'flex';
      if (status.status === 'none') {
        const existing = await getSetting('noWhatsapp', '');
        const waEl = document.getElementById('onboardWa');
        if (waEl && existing) waEl.value = existing;
      }
    }
    await checkLicenseGate();
  }

  // Perangkat FISIK yang sama sudah pernah dipakai (data lokal bersih karena ganti
    // browser/re-install). Lewati onboarding: kalau lisensi aktif di cloud -> sinkron
    // local license + unlock & masuk; selain itu lanjutkan masa coba perangkat tsb.
  async function continueKnownDevice() {
    const gate = document.getElementById('licenseGate');
    try {
      const cloud = await fetchLicenseStatusFromCloud();
      if (cloud && cloud.license_status === 'aktif') {
          await saveLicenseFromCloud(cloud);
          if (gate) gate.style.display = 'none';
          document.getElementById('lockOverlay')?.classList.remove('show');
          await boot();
          return;
        }
      } catch (e) {
        console.warn('continueKnownDevice cloud check failed:', e?.message || e);
      }
      // Tidak ada lisensi aktif di cloud -> lanjutkan masa coba perangkat.
      await startTrial();
      await resolveLicenseGate();
      await boot();
    }

    // Sinkronkan local license (Dexie) dari status cloud supaya getLicenseStatus()
    // tidak lagi 'none' & renderGate tidak menampilkan "Masa coba habis" keliru saat
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

async function boot() {
  await ensureUnitId();
  await loadBeranda();
  await checkOnboarding();
  // Backfill otomatis: user yang sudah pakai (data cuma lokal) di-push sekali
  ensureSynced({ silent: true }); // non-blocking, retry saat online berikutnya
  await _settingsReady; // tunggu settings module ke-wire sebelum pakai checkProfileNotification
  await checkProfileNotification(); // banner "lengkapi profil" bila profil belum lengkap
  setupPWA();
  
  // Subscribe to realtime license updates
  try {
    const { unit_id } = await ensureUnitId();
    subscribeToLicenseUpdates(unit_id);
  } catch (e) {
    console.log('Realtime subscription skipped:', e?.message || e);
  }
}

// Error boundary for nav setup: guard so a DOM/nav issue never blocks the router below.
try {
  console.log('[APP] Attaching nav handlers...');
  const navItems = document.querySelectorAll('.nav-item');
  console.log('[APP] Found', navItems.length, 'nav items');
  navItems.forEach((btn, idx) => {
    btn.addEventListener('click', (e) => {
      console.log('[APP] Nav clicked:', btn.dataset.page);
      const page = btn.dataset.page;
      if (page) navigateTo(page);
    });
  });
  console.log('[APP] Nav handlers attached');
} catch(e) { console.error('[APP] Nav setup failed:', e); }

initRouter();

// Start the app
init();

// ---- Version (P1/N7): single source of truth wired to window + DOM ----
window.APP_VERSION = APP_VERSION;
window.APP_VERSION_LABEL = APP_VERSION_LABEL;
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('appVersionLabel');
  if (el) el.textContent = APP_VERSION_LABEL;
});
