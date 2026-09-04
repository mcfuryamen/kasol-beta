/* =========================================================================
   KASIR SOLO - ROSOK
   nav.js — Screen navigation with exact function names for onclick
   ========================================================================= */
import { activeTransTipe, cart, currentWizardStep, bayarMetode, openShiftCache, setCart, setActiveTransTipe, setCurrentWizardStep, setBayarMetode } from './app-state.js';
import { toast } from './utils.js';
import { refreshShiftCache, openBukaKasSheet, fiturKasAktif } from './kas.js';
import { renderWizardBar, switchTransTab } from './pos.js';
import { renderStok } from './kategori.js';
import { renderRiwayat } from './riwayat.js';
import { renderLaporan, closePicker } from './laporan.js';
import { refreshAll } from './dashboard.js';

// Screen → route mapping
const SCREEN_TO_ROUTE = {
  'dashboard': '/', 'transaksi': '/transaksi', 'stok': '/stok',
  'riwayat': '/riwayat', 'laporan': '/laporan', 'pengaturan': '/pengaturan'
};

// ── Show screen by name ────────────────────────────────────────────────────
export function showScreen(name){
  // Riwayat menyatu dengan halaman laporan (satu halaman mengalir) —
  // deep link /riwayat lama tetap dibuka ke halaman yang sama.
  if(name === 'riwayat') name = 'laporan';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.querySelectorAll('.nav-item[data-screen]').forEach(n=>{
    n.classList.toggle('active', n.dataset.screen === name);
  });
  if(name==='stok') renderStok();
  if(name==='laporan'){
    closePicker(); // akordeon date-nav & picker default tertutup tiap masuk halaman
    renderLaporan();
    renderRiwayat();
  }
  if(name==='dashboard') refreshAll();
  if(name === 'transaksi'){
    document.body.classList.add('transaksi-active');
    renderWizardBar();
  } else {
    document.body.classList.remove('transaksi-active');
    const wb = document.getElementById('wizardBar');
    if(wb) wb.classList.remove('show');
  }
  if(name === 'stok'){
    document.body.classList.add('stok-active');
    const sb = document.getElementById('stokBar');
    if(sb) sb.classList.add('show');
  } else {
    document.body.classList.remove('stok-active');
    const sb = document.getElementById('stokBar');
    if(sb) sb.classList.remove('show');
  }
  if(name === 'laporan'){
    document.body.classList.add('laporan-active');
    const kb = document.getElementById('kasBar');
    if(kb) kb.classList.add('show');
  } else {
    document.body.classList.remove('laporan-active');
    const kb = document.getElementById('kasBar');
    if(kb) kb.classList.remove('show');
  }
  window.scrollTo(0,0);
  // Ajakan lengkapi profil (pola kaki5): modal wajib di semua halaman kecuali Pengaturan.
  try { if(window._ksr_checkProfileNotification) window._ksr_checkProfileNotification(name); } catch(_){}
  // Pengaturan dibuka → tarik profil cloud dulu sebelum form tampil (pola kaki5).
  if(name === 'pengaturan'){
    try { if(window._ksr_onSettingsOpen) window._ksr_onSettingsOpen(); } catch(_){}
  }
}

// ── Open transaksi (with route push) ──────────────────────────────────────
export async function openTransaksi(tipe){
  // Gerbang "buka kas dulu" hanya berlaku bila fitur kas/shift aktif
  // (Pengaturan → ⚙️ Fitur Aplikasi; port kaki5 v166).
  if(await fiturKasAktif()){
    await refreshShiftCache();
    if(!openShiftCache){
      toast('Buka kas dulu sebelum mulai transaksi');
      // remember intent: after buka kas completes, return to transaksi of requested type
      window._ksr_shouldOpenTransaksiAfterBuka = tipe;
      openBukaKasSheet();
      return;
    }
  }
  setCart([]); setActiveTransTipe(tipe); setCurrentWizardStep(1); setBayarMetode('tunai');
  switchTransTab(tipe);
  showScreen('transaksi');
}

// ── Global exports — EXACT function names matching onclick handlers ────────
window.showScreen = showScreen;
window.openTransaksi = openTransaksi;
export const navigateScreen = showScreen; // Alias for old HTML references
window.navigateScreen = navigateScreen;

// ── Sinkronkan --navheight dari tinggi bottomnav aktual ────────────────────
// Dipakai oleh .wizard-bar / .stok-bar / .kas-bar (bottom: calc(var(--navheight) + ...)).
function syncNavHeight(){
  const nav = document.querySelector('.bottomnav');
  if(nav) document.documentElement.style.setProperty('--navheight', nav.offsetHeight + 'px');
}
window.addEventListener('resize', syncNavHeight);
syncNavHeight();
