/* =========================================================================
   KASIR SOLO - ROSOK
   app.js — Entry point. Matched function names to HTML onclick handlers.
   ========================================================================= */
import { db } from './db.js';
import { SETTINGS, loadSettingsIntoState, seedKategoriIfEmpty, seedPlatformMessagesIfEmpty, loadKategori } from './app-state.js';
import { fmtRupiah, fmtKg, fmtDate, todayStr, showLoading, hideLoading, escapeHtml, formatInputRupiah, unformatRupiah, toast, getSetting, setSetting, openOverlay, closeSheet } from './utils.js';
import { refreshAll } from './dashboard.js';
import { refreshShiftCache, openBukaKasSheet, bukaKas, openTutupKasSheet, hitungSelisihTutupKas, tutupKas, openKasForm, setKasTipe, saveKasManual, fiturKasAktif } from './kas.js';
import { openShiftCache } from './app-state.js';
import { renderStok, openKategoriForm, saveKategori, deleteKategoriConfirm } from './kategori.js';
import { renderRiwayat, viewTransaksiDetail, deleteTransaksi, voidTransaksi, closeNotaSheet } from './riwayat.js';
import { setLaporanPeriode, renderLaporan, openLunasi, saveLunasi } from './laporan.js';
import { checkLicenseGate, updateTrialChip, renderLicenseInfoCard, activateLicense, contactViaWA, contactViaEmail, openLicenseSheet, setLicenseRefs } from './license.js';
import { renderWizardBar, renderKatGrid, openTimbang, buildKeypad, keypadPress, stepBerat, updateTimbangDisplay, confirmTimbang, renderCartChips, renderCartStep2, cartTotal, removeCartItem, setMetodeBayar, calcKembalian, saveTransaksi, renderNota, shareNotaWA, goToStep, switchTransTab } from './pos.js';
import { showScreen, openTransaksi, navigateScreen } from './nav.js';
import { markReady, getRoute } from './router.js';
import { setupRegionPicker } from './region.js';
import { loadPayOptions, initPwaInstall } from './settings-x.js';
import { showConfirm } from './confirm.js';
import { connectBTPrinter, disconnectBTPrinter, testPrint, restorePrinterStatus } from './printer.js';
import './onboard.js'; // efek samping: expose window.showEmojiPicker untuk form Jenis Rosok

// ── Alamat: satu kotak ringkas, modal bertingkat saat diklik (pola emsifa) ─
// _regionState = pilihan tersimpan; modal bekerja pada salinan (temp) —
// Batal tidak mengubah kotak, "Gunakan Alamat Ini" menulis hasil ke kotak.
function alamatLengkap(s){
  const parts = [s.alamatDetail, s.desa, s.kecamatan, s.kabkota, s.provinsi].filter(Boolean).join(', ');
  return parts || '';
}

function savedRegionState(){
  return {
    provinsi_id: SETTINGS.bizProvinsiId || '', provinsi: SETTINGS.bizProvinsi || '',
    kabkota_id: SETTINGS.bizKabkotaId || '', kabkota: SETTINGS.bizKabkota || '',
    kecamatan_id: SETTINGS.bizKecamatanId || '', kecamatan: SETTINGS.bizKecamatan || '',
    desa_id: SETTINGS.bizDesaId || '', desa: SETTINGS.bizDesa || '',
    alamatDetail: SETTINGS.alamatDetail || ''
  };
}

// Ada tidaknya nilai wilayah di sebuah state — dipakai sebagai jaring
// pengaman agar adopsi cloud yang datang belakangan tidak tertimpa tulis
// ulang dari _regionState yang masih kosong (audit P1 2026-09-04).
function hasRegionValues(s){
  return !!(s && (s.provinsi_id || s.kabkota_id || s.kecamatan_id || s.desa_id || s.alamatDetail));
}

function updateAlamatBox(){
  const el = document.getElementById('setAlamatLengkap');
  if(el) el.value = alamatLengkap(_regionState || {});
}

let _regionState = null;
let _regionTemp = null;

function initRegionPicker(){
  _regionState = savedRegionState();
  updateAlamatBox();
}

// Buka modal: salin tersimpan → temp, pasang picker pada salinan itu.
function openAlamatSheet(){
  _regionTemp = { ...(_regionState || savedRegionState()) };
  setupRegionPicker({
    provSel: 'alamatProvinsi', kabSel: 'alamatKabkota',
    kecSel: 'alamatKecamatan', desaSel: 'alamatDesa',
    state: _regionTemp
  });
  document.getElementById('inAlamatDetail').value = _regionTemp.alamatDetail || '';
  openOverlay('sheetAlamat');
}

// Batal: buang salinan, kotak & state tersimpan tak berubah.
function cancelAlamat(){
  _regionTemp = null;
  closeSheet('sheetAlamat');
}

// Gunakan Alamat Ini: validasi 4 level lengkap → tulis temp ke state + kotak.
function saveAlamatLengkap(){
  const pick = (id) => { const el = document.getElementById(id); return el ? { id: el.value, name: el.selectedOptions[0] ? el.selectedOptions[0].textContent : '' } : { id:'', name:'' }; };
  const pv = pick('alamatProvinsi'), kb = pick('alamatKabkota'), kc = pick('alamatKecamatan'), ds = pick('alamatDesa');
  if(!pv.id || !kb.id || !kc.id || !ds.id){ toast('Lengkapi provinsi, kab/kota, kecamatan, dan desa dulu ya'); return; }
  _regionState = {
    provinsi_id: pv.id, provinsi: pv.name,
    kabkota_id: kb.id, kabkota: kb.name,
    kecamatan_id: kc.id, kecamatan: kc.name,
    desa_id: ds.id, desa: ds.name,
    alamatDetail: document.getElementById('inAlamatDetail').value.trim()
  };
  _regionTemp = null;
  updateAlamatBox();
  closeSheet('sheetAlamat');
  toast('Alamat siap disimpan — jangan lupa klik Simpan Identitas');
}

window.openAlamatSheet = openAlamatSheet;
window.cancelAlamat = cancelAlamat;
window.saveAlamatLengkap = saveAlamatLengkap;
window.updateAlamatBox = updateAlamatBox;

// ── Segar-kan UI profil setelah cloud pull. Aturan (pemilik 2026-09-04):
// cloud = sumber kebenaran mutlak untuk profil & lisensi — pull boleh MENIMPA
// lokal. Hook ini hanya menjaga UI: input yang masih kosong diisi, dan
// _regionState dibangun ulang dari SETTINGS (mencerminkan nilai cloud terbaru,
// termasuk bila cloud mengosongkan) selama sheet alamat tidak sedang terbuka.
// Editan user yang sedang diketik tidak pernah ditimpa.
window._ksr_profilePulled = () => {
  const fillIfEmpty = (id, val) => { const el = document.getElementById(id); if(el && !el.value.trim() && val) el.value = val; };
  fillIfEmpty('setBizName', SETTINGS.bizName || '');
  fillIfEmpty('setBizOwner', SETTINGS.ownerName || '');
  fillIfEmpty('setBizPhone', SETTINGS.bizPhone || '');
  if(!_regionTemp){ _regionState = savedRegionState(); updateAlamatBox(); }
};

// Buka halaman Pengaturan → tarik profil dari cloud dulu, baru render form
// (pola kaki5 loadSettings: pull → loadSettingsData). Fire-and-forget dari
// nav.js; offline = pull return cepat, tetap refresh dari lokal.
window._ksr_onSettingsOpen = async () => {
  try { const { pullCloudProfile } = await import('./license.sync.js'); await pullCloudProfile(); } catch(_) {}
  _regionState = savedRegionState();
  await loadSettingsIntoState();
};

// ── Wire cross-module refs ────────────────────────────────────────────────
import { setPosRefs } from './pos.js';
import { setRiwayatRefs } from './riwayat.js';
setPosRefs({ refreshAll });
setRiwayatRefs({ refreshAll });

// ── Cache DB ──────────────────────────────────────────────────────────────
window._ksr_db = db;

// ── Tentang aplikasi (blok footer Pengaturan, pola kaki5) ─────────────────
// APP_VERSION kini sumber tunggal di js/version.js (port kaki5) — jangan
// hardcode di sini lagi; update.js memakai CACHE_BUST-nya utk overlay rilis.
import { APP_VERSION } from './version.js';
import { startUpdateWatcher } from './update.js';
function updateAboutInfo(){
  const v = document.getElementById('appVersionLabel');
  if(v) v.textContent = APP_VERSION;
  const d = document.getElementById('aboutDeviceCode');
  if(d) d.textContent = SETTINGS.deviceCode || '—';
  // Link situs dari cloud (port app-link kaki5): products.store_url →
  // settings.app_links.rosok → fallback hardcoded. Non-blocking.
  import('./app-link.js').then(({ getAppLink }) => getAppLink().then(url => {
    const a = document.getElementById('aboutSiteLink');
    if(a){ a.href = url; a.textContent = '🌐 ' + url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, ''); }
  })).catch(() => {});
}
window._ksr_updateAboutInfo = updateAboutInfo;

// ── Cache DOM ──────────────────────────────────────────────────────────────
function cacheDomElements() {
  const ids = ['timbangKgVal', 'timbangUnitLbl', 'timbangSubtotal', 'katGrid',
    'lapBeli', 'lapJual', 'lapPengeluaran', 'lapLaba',
    'lapUtang', 'lapPiutang', 'barChart', 'topKategoriList', 'tempoList',
    'kasList', 'kasSaldoBadge', 'kasShiftHistoryList'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) window['_ksr_' + id] = el; });
}

// ── Logo ──────────────────────────────────────────────────────────────────
document.getElementById('headerLogo').src = 'assets/logo.png';

// ── Service Worker ─────────────────────────────────────────────────────────
if ("serviceWorker" in navigator && window.location.protocol !== 'file:') {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").then(function (reg) {
      reg.addEventListener("updatefound", function () {
        const nw = reg.installing;
        nw.addEventListener("statechange", function () {
          if (nw.state === "activated") {
            // Modal in-app, bukan confirm() native (tak andal di webview — lihat confirm.js)
            showConfirm({ icon:'🔄', text:'Update tersedia. Reload sekarang?', okLabel:'Reload Sekarang' })
              .then(ok => { if(ok) window.location.reload(); });
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
  await setSetting('ownerName', document.getElementById('setBizOwner') ? document.getElementById('setBizOwner').value.trim() : '');
  await setSetting('bizPhone', document.getElementById('setBizPhone').value.trim());
  // Wilayah (pola kaki5): id + nama tiap level disimpan ke settings, ditulis
  // ke Supabase `clients` (non-blocking) oleh license.sync.pushProfile.
  // Jaring pengaman P1: _regionState kosong (mis. adopsi cloud datang setelah
  // initRegionPicker) → bangun ulang dari SETTINGS, jangan tulis string kosong.
  const regionState = hasRegionValues(_regionState) ? _regionState : savedRegionState();
  const regionMap = {
    bizProvinsiId: regionState.provinsi_id, bizProvinsi: regionState.provinsi,
    bizKabkotaId: regionState.kabkota_id, bizKabkota: regionState.kabkota,
    bizKecamatanId: regionState.kecamatan_id, bizKecamatan: regionState.kecamatan,
    bizDesaId: regionState.desa_id, bizDesa: regionState.desa
  };
  for(const [k, v] of Object.entries(regionMap)){
    await setSetting(k, v || '');
  }
  await setSetting('alamatDetail', regionState.alamatDetail || '');
  await loadSettingsIntoState();
  toast('Identitas usaha tersimpan');
  // Sinkron profil ke cloud (best-effort; gagal jaringan = data tetap aman lokal).
  try { const { pushProfile } = await import('./license.sync.js'); pushProfile(); } catch(_) {}
  // Setelah profil lengkap, modal ajakan tidak perlu muncul lagi.
  try { checkProfileNotification('pengaturan'); } catch(_) {}
}

// ── Ajakan lengkapi profil (pola kaki5): modal wajib di semua halaman ──────
// kecuali Pengaturan. Pemicu: nama pemilik / telepon kosong, ATAU alamat
// (kab/kota atau detail) belum diisi.
function profileIncomplete(){
  const owner = SETTINGS.ownerName || '';
  const phone = SETTINGS.bizPhone || '';
  const addr  = SETTINGS.bizKabkota || SETTINGS.bizDesa || SETTINGS.alamatDetail || '';
  return !owner.trim() || !phone.trim() || !addr.trim();
}

function checkProfileNotification(currentScreen){
  const el = document.getElementById('profileBanner');
  if(!el) return;
  if(currentScreen === 'pengaturan'){ closeSheet('profileBanner'); return; }
  if(profileIncomplete()) openOverlay('profileBanner');
  else closeSheet('profileBanner');
}

function dismissProfileBanner(){
  closeSheet('profileBanner');
  showScreen('pengaturan');
}

window._ksr_checkProfileNotification = checkProfileNotification;
window._ksr_dismissProfileBanner = dismissProfileBanner;

// ── Kas bar: sinkronkan tombol Buka/Tutup Kas dengan status shift ─────────
// Didefinisikan di scope modul (bukan di dalam initApp) supaya listener
// ksr-kas-changed di bawah bisa memanggilnya (dulu selalu undefined).
async function updateKasBarButtons(){
  try{
    const btnToggle = document.getElementById('btnToggleKas');
    const btnManual = document.getElementById('btnOpenKasManual');
    if(!btnToggle || !btnManual) return;
    // Fitur kas/shift mati (Pengaturan → ⚙️ Fitur Aplikasi): tombol
    // Buka/Tutup Kas disembunyikan; "Catat Kas" tetap tersedia (pola kaki5 v166).
    if(!(await fiturKasAktif())){
      btnToggle.style.display = 'none';
      return;
    }
    btnToggle.style.display = '';
    const shift = await refreshShiftCache();
    if(shift){
      btnToggle.className = 'btn btn-primary';
      btnToggle.textContent = '🔒 Tutup Kas';
      btnToggle.onclick = () => openTutupKasSheet();
    } else {
      btnToggle.className = 'btn btn-outline';
      btnToggle.textContent = '🔓 Buka Kas';
      btnToggle.onclick = () => openBukaKasSheet();
    }
  }catch(e){ console.error('updateKasBarButtons error', e); }
}

// ── INIT ──────────────────────────────────────────────────────────────────
import { getDeviceCode, getDeviceIdentity } from './license.js';

// Wire refs lisensi supaya checkLicenseGate() bisa memanggil updateTrialChip,
// renderLicenseInfoCard, dan alur extend/grant (tanpa circular import).
setLicenseRefs({ updateTrialChip, renderLicenseInfoCard, checkLicenseGate, openLicenseSheet });

async function initApp() {
  // initApp started
  cacheDomElements();
  try {
    // Identitas PALING AWAL (port kaki5 V3/T14): deviceCode diturunkan dari
    // fingerprint perangkat keras → SAMA di semua browser pada perangkat fisik
    // yang sama (lisensi/profil/klaim cloud ikut pindah browser). deviceId lama
    // dipertahankan sebagai installId (penanda instalasi, tracking saja).
    const identity = await getDeviceIdentity();
    await setSetting('deviceCode', identity.deviceCode);
    // Konvergensi identitas lintas-browser (audit multi-browser 2026-09-04):
    // instalasi pra-fingerprint dimigrasikan ke unit_id kanonik SEBELUM apa pun
    // yang bergantung padanya (subscribe realtime, sync, path cadangan).
    try { const { reanchorUnitId } = await import('./license.sync.js'); await reanchorUnitId(); } catch(_) {}
    await loadSettingsIntoState();
    updateAboutInfo();
    initRegionPicker();
    loadPayOptions();   // toggle metode pembayaran + filter tombol di POS
    initPwaInstall();   // baris "Pasang Aplikasi" (beforeinstallprompt)
    restorePrinterStatus(); // status printer terakhir (persist kaki5)
    // Kembali online → kirim user-intent profil yang tertunda (pola flag kaki5).
    window.addEventListener('online', async () => {
      try {
        if (await getSetting('profileSyncPending', false)) {
          const { pushProfile } = await import('./license.sync.js');
          pushProfile();
        }
      } catch(_) {}
    });
    // Realtime lisensi: admin aktivasi/cabut → langsung diterapkan (pola kaki5).
    try { const { ensureUnitId } = await import('./license.js'); const { subscribeToLicenseUpdates } = await import('./purchase.js'); subscribeToLicenseUpdates(await ensureUnitId()); } catch(_) {}
    await seedKategoriIfEmpty();
    await seedPlatformMessagesIfEmpty();
    await loadKategori();
    await refreshAll();
    checkLicenseGate();
  } catch (error) { console.error('Init error:', error); toast('Gagal memuat aplikasi: ' + error.message); }
  // Browser baru di perangkat berlisensi dengan cadangan cloud → tawarkan
  // pemulihan (deferred 4 dtk, tidak pernah memblokir/ganggu boot).
  setTimeout(() => { try { import('./backup.js').then(m => m.maybeOfferCloudRestore()).catch(() => {}); } catch(_) {} }, 4000);
  markReady();
  // Penjaga konvergensi rilis (port kaki5 update.js): cek version.json saat
  // settle, kembali ke foreground, dan online → overlay paksa OKE+refresh.
  try { startUpdateWatcher(); } catch(_) {}
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
window.renderRiwayat = renderRiwayat;
window.viewTransaksiDetail = viewTransaksiDetail;
window.deleteTransaksi = deleteTransaksi;
window.voidTransaksi = voidTransaksi;
window.closeNotaSheet = closeNotaSheet;
window._ksr_viewDetail = viewTransaksiDetail;
window._ksr_deleteTrans = deleteTransaksi;
window._ksr_voidTrans = voidTransaksi;

// Laporan
window.setLaporanPeriode = setLaporanPeriode;
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
window.contactViaWA = contactViaWA;
window.contactViaEmail = contactViaEmail;
window.openLicenseSheet = openLicenseSheet;
window._ksr_activateLicense = activateLicense;
window._ksr_contactViaWA = contactViaWA;

// Settings
window.saveBizIdentity = saveBizIdentity;
window.connectBTPrinter = connectBTPrinter;
window.disconnectBTPrinter = disconnectBTPrinter;
window.testPrint = testPrint;
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
// Handler tombol kas-bar: pakai binding openShiftCache yang di-import (live)
// — dulu ReferenceError karena identifier tak pernah di-import.
window.handleToggleKasClick = async function(){
  try{
    await refreshShiftCache();
    if(openShiftCache) openTutupKasSheet(); else openBukaKasSheet();
  }catch(e){ console.error('handleToggleKasClick error', e); }
};
window.updateKasBarButtons = updateKasBarButtons;

window.addEventListener('ksr-kas-changed', () => { try{ updateKasBarButtons(); }catch(e){} });
window.addEventListener('load', async () => { await initApp(); try{ updateKasBarButtons(); }catch(e){} });
setInterval(checkLicenseGate, 60000);
