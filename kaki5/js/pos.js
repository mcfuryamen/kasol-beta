// ==================== POS / JUALAN (ESM) ====================
// Thin coordinator module. Delegates to pos.logic.js, pos.ui.js, pos.sync.js.
// All original exports remain available for backward compatibility.

import { DB } from './db.js';
import { showToast } from './helpers.js';
import { cart, setCart, setPosCat, posCat, setLastSaleId } from './app-state.js';
import {
  addToCartLogic, changeQtyLogic, hitungKembalianLogic, calculateTotal,
  generatePresetNominal
} from './pos.logic.js';
import {
  renderPOSCatTabsUI, renderPOSMenuUI, renderCartBar,
  openCartModal, closeCartModal, hitungKembalianUI,
  formatBayarInputUI, selectAllBayarInput, setNominalBayarUI,
  showAfterSaleActions
} from './pos.ui.js';
import { saveCart, loadCart, clearCartStorage, simpanPenjualanSync } from './pos.sync.js';

export {
  addToCartLogic, changeQtyLogic, hitungKembalianLogic, calculateTotal,
  generatePresetNominal
} from './pos.logic.js';
export {
  renderPOSCatTabsUI, renderPOSMenuUI, renderCartBar,
  openCartModal, closeCartModal, hitungKembalianUI,
  formatBayarInputUI, selectAllBayarInput, setNominalBayarUI,
  showAfterSaleActions
} from './pos.ui.js';
export {
  saveCart, loadCart, clearCartStorage, simpanPenjualanSync
} from './pos.sync.js';

// Debounced search for POS menu
let _debouncedPosSearch = null;
export function getDebouncedPosSearch(fn) {
  if (!_debouncedPosSearch) {
    _debouncedPosSearch = (f) => {
      let timer = null;
      return function() {
        clearTimeout(timer);
        timer = setTimeout(() => f.apply(this, args), 300);
      };
    };
  }
  return _debouncedPosSearch(fn);
}

// Simple debounce function
function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const _debouncedRenderPOSMenu = debounce(renderPOSMenu, 300);

export async function loadPOS() {
  await loadCart();
  // Ambil menu SEKALI, lalu pakai untuk tab kategori & grid — hindari 2x query DB.
  const menus = await DB.menu.where('aktif').equals(1).toArray();
  renderPOSCatTabsUI(menus);
  const filtered = posCat !== 'Semua' ? menus.filter(m => m.kategori === posCat) : menus;
  renderPOSMenuUI(filtered);
  renderCartBar();
}

// ---- Category tabs (async: DB query + DOM) ----
export async function renderPOSCatTabs() {
  const menus = await DB.menu.where('aktif').equals(1).toArray();
  return renderPOSCatTabsUI(menus);
}

// Window-wired: sets active category and re-renders tabs + menu list
export function selectPosCat(cat) {
  setPosCat(cat);
  renderPOSCatTabs();
  renderPOSMenu();
}

// ---- Menu grid (async: DB query + DOM) ----
export async function renderPOSMenu() {
  const search = (document.getElementById('searchMenu').value || '').toLowerCase();
  let menus = await DB.menu.where('aktif').equals(1).toArray();
  if (posCat !== 'Semua') menus = menus.filter(m => m.kategori === posCat);
  if (search) menus = menus.filter(m => m.nama.toLowerCase().includes(search));
  renderPOSMenuUI(menus);
}

// Export debounced version for oninput handler
export const renderPOSMenuDebounced = _debouncedRenderPOSMenu;

// ---- Cart operations ----
export async function addToCart(menuId) {
  const m = await DB.menu.get(menuId);
  if (!m) return;
  const next = addToCartLogic(cart, menuId, m);
  setCart(next);
  saveCart();
  renderPOSMenu();
  renderCartBar();
}

export function changeQty(menuId, delta) {
  const next = changeQtyLogic(cart, menuId, delta);
  setCart(next);
  saveCart();
  renderCartBar();
  // re-render cart modal
  const items = Object.values(next).filter(c => c.qty > 0);
  if (items.length === 0) { closeCartModal(); renderPOSMenu(); return; }
  openCartModal();
  renderPOSMenu();
}

// ---- Modal (sudah di-export di atas) ----

// ---- Pembayaran ----
export function hitungKembalian() {
  const total = calculateTotal(cart);
  let bayarValue = document.getElementById('bayarInput').value.replace(/\D/g, '');
  const bayar = bayarValue ? parseInt(bayarValue) : 0;
  hitungKembalianUI(total, bayar);
}

export function formatBayarInput() {
  formatBayarInputUI();
  hitungKembalian();
}

export function setNominalBayar(nominal) {
  setNominalBayarUI(nominal);
  hitungKembalian();
}

// ---- Simpan penjualan (DB + DOM) ----
export async function simpanPenjualan() {
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) { showToast('Keranjang kosong!', 'error'); return; }

  const totalHarga = calculateTotal(cart);
  const totalModal = items.reduce((a,c) => a + c.qty * c.menu.hargaModal, 0);

  let bayarValue = document.getElementById('bayarInput').value.replace(/\D/g, '');
  const bayar = bayarValue ? parseInt(bayarValue) : totalHarga;

  if (bayar < totalHarga) {
    showToast('Uang kurang!', 'error');
    return;
  }

  const _now = new Date();
  const _tgl = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0') + '-' + String(_now.getDate()).padStart(2,'0');

  const saleId = await simpanPenjualanSync({
    tanggal: _tgl,
    items: items.map(c => ({
      menuId: c.menu.id,
      nama: c.menu.nama,
      hargaJual: c.menu.hargaJual,
      hargaModal: c.menu.hargaModal,
      qty: c.qty
    })),
    totalHarga,
    totalModal,
    bayar,
    kembalian: bayar - totalHarga,
    waktu: Date.now()
  });

  setLastSaleId(saleId);
  setCart({});
  clearCartStorage();
  closeCartModal();
  renderCartBar();
  renderPOSMenu();
  showToast('✅ Penjualan tersimpan!');
  showAfterSaleActions();
}
