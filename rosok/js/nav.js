/* =========================================================================
   KASIR SOLO - ROSOK
   nav.js — Screen navigation with exact function names for onclick
   ========================================================================= */
import { activeTransTipe, cart, currentWizardStep, bayarMetode, openShiftCache, setCart, setActiveTransTipe, setCurrentWizardStep, setBayarMetode } from './app-state.js';
import { toast } from './utils.js';
import { refreshShiftCache } from './kas.js';
import { renderWizardBar, switchTransTab } from './pos.js';
import { renderStok } from './kategori.js';
import { renderRiwayat } from './riwayat.js';
import { renderLaporan } from './laporan.js';
import { refreshAll } from './dashboard.js';
import { openBukaKasSheet } from './kas.js';

// Screen → route mapping
const SCREEN_TO_ROUTE = {
  'dashboard': '/', 'transaksi': '/transaksi', 'stok': '/stok',
  'riwayat': '/riwayat', 'laporan': '/laporan', 'pengaturan': '/pengaturan'
};

// ── Show screen by name ────────────────────────────────────────────────────
export function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.querySelectorAll('.nav-item[data-screen]').forEach(n=>{
    n.classList.toggle('active', n.dataset.screen === name);
  });
  if(name==='stok') renderStok();
  if(name==='riwayat') renderRiwayat();
  if(name==='laporan') renderLaporan();
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
}

// ── Open transaksi (with route push) ──────────────────────────────────────
export async function openTransaksi(tipe){
  await refreshShiftCache();
  if(!openShiftCache){
    toast('Buka kas dulu sebelum mulai transaksi');
    // remember intent: after buka kas completes, return to transaksi of requested type
    window._ksr_shouldOpenTransaksiAfterBuka = tipe;
    openBukaKasSheet();
    return;
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
