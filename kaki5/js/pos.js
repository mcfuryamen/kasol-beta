// ==================== POS / JUALAN (ESM) ====================
// Thin coordinator module. Delegates to pos.logic.js, pos.ui.js, pos.sync.js.
// All original exports remain available for backward compatibility.

import { DB } from './db.js';
import { showToast } from './helpers.js';
import { cart, setCart, setPosCat, posCat, setLastSaleId, orderType, setOrderType } from './app-state.js';
import {
  addToCartLogic, changeQtyLogic, hitungKembalianLogic, calculateTotal,
  generatePresetNominal, parseToppings
} from './pos.logic.js';
import {
  renderPOSCatTabsUI, renderPOSMenuUI, renderCartBar,
  openCartModal, closeCartModal, hitungKembalianUI, refreshCartModalTotals,
  formatBayarInputUI, selectAllBayarInput, setNominalBayarUI,
  showAfterSaleActions, selectTopping, applySelectedTopping, toggleOrderType,
  renderOrderNoteBox, getOjolPlatform
} from './pos.ui.js';
import { saveCart, loadCart, clearCartStorage, simpanPenjualanSync } from './pos.sync.js';
import { getLicenseStatus } from './license.js';

export {
  addToCartLogic, changeQtyLogic, hitungKembalianLogic, calculateTotal,
  generatePresetNominal
} from './pos.logic.js';
export {
  renderPOSCatTabsUI, renderPOSMenuUI, renderCartBar,
  openCartModal, closeCartModal, hitungKembalianUI, refreshCartModalTotals,
  formatBayarInputUI, selectAllBayarInput, setNominalBayarUI,
  showAfterSaleActions, selectTopping, applySelectedTopping, toggleOrderType
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

// ── Filter tipe Ojol ──
// Saat tipe Ojol aktif, tampilkan HANYA menu yang punya Harga Ojol terpasang
// (permintaan pemilik 2026-08-29) — menu tanpa konfigurasi ojol tidak bisa
// dijual via ojol, jadi disembunyikan dari grid & tab/accordion kategori.
function filterOjol(menus) {
  return orderType === 'ojol' ? menus.filter(m => (m.hargaOjol || 0) > 0) : menus;
}

// ── Ambil menu aktif (tahan boolean) ──
// Index 'aktif' TIDAK memuat record dengan nilai boolean (IndexedDB tidak
// meng-index boolean) — record `aktif: true` (mis. dari restore backup lama)
// hilang diam-diam dari `where('aktif').equals(1)`. Table scan + filter JS
// menerima 1 dan true; volume menu ratusan — murah.
async function getActiveMenus() {
  return DB.menu.filter(m => m.aktif === 1 || m.aktif === true).toArray();
}

// Error state bersama: DB gagal dibaca (mis. Dexie open tertunda saat update)
// → tampilkan pesan + tombol coba lagi, jangan biarkan grid kosong diam.
function renderPOSError(action) {
  const grid = document.getElementById('posMenuGrid');
  if (grid) grid.innerHTML = `<div class="empty-state" data-action="${action}" role="button" tabindex="0" style="grid-column:1/-1;cursor:pointer"><div class="empty-icon">⚠️</div><div class="empty-text">Gagal memuat menu.<br>Ketuk di sini untuk coba lagi.</div></div>`;
}

export async function loadPOS() {
  await loadCart();
  // Ambil menu SEKALI, lalu pakai untuk tab kategori & grid — hindari 2x query DB.
  let menus;
  try {
    menus = filterOjol(await getActiveMenus());
  } catch (e) {
    console.error('[POS] Gagal memuat menu:', e?.message || e);
    renderPOSError('retry-pos');
    renderCartBar();
    return;
  }
  renderPOSCatTabsUI(menus);
  const filtered = posCat !== 'Semua' ? menus.filter(m => m.kategori === posCat) : menus;
  renderPOSMenuUI(filtered);
  renderCartBar();
  // Kotak catatan pesanan: tampil + placeholder sesuai tipe order aktif,
  // lalu pulihkan draft catatan dari sesi sebelumnya (kalau ada).
  renderOrderNoteBox();
  try {
    const draft = localStorage.getItem('kasirsolo:order-note');
    const input = document.getElementById('orderNoteInput');
    if (draft && input && !input.value) input.value = draft;
  } catch (_) {}
}

// ---- Category tabs (async: DB query + DOM) ----
export async function renderPOSCatTabs() {
  const menus = filterOjol(await getActiveMenus());
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
  const searchEl = document.getElementById('searchMenu');
  const search = ((searchEl && searchEl.value) || '').toLowerCase();
  let menus;
  try {
    menus = filterOjol(await getActiveMenus());
  } catch (e) {
    console.error('[POS] Gagal memuat menu:', e?.message || e);
    renderPOSError('retry-pos');
    return;
  }
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
  const toppings = parseToppings(m.toppingList);
  const hasOjol = (m.hargaOjol || 0) > 0;
  // Jika ada topping atau hargaOjol → buka selector dulu, baru masuk keranjang
  if (toppings.length > 0 || hasOjol) {
    openMenuSelector(m, ({ selectedToppings = [], orderType: tipe = orderType, qty = 1, selectedToppingQtys = null }) => {
      const next = addToCartLogic(cart, menuId, m, selectedToppings, tipe, qty, selectedToppingQtys);
      setCart(next);
      setOrderType(tipe); // simpan tipe order yang dipilih
      saveCart();
      renderPOSMenu();
      renderCartBar();
      // Tetap di halaman jualan — user bisa lanjut tambah menu lain.
      // Feedback cukup lewat cartBar (jumlah item + total) + badge qty di kartu menu.
    });
    return;
  }
  // Menu tanpa topping + tanpa hargaOjol → langsung masuk keranjang
  const next = addToCartLogic(cart, menuId, m, [], orderType);
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

// Set qty langsung dari input manual (batas 1–999).
// rerender=false → update ringan (state + cartBar + badge grid + total modal)
// TANPA rebuild daftar cart, agar fokus ketikan di input qty tidak hilang.
export function setCartQty(menuId, qty, rerender = true) {
  const cur = cart[menuId];
  if (!cur) return;
  let target = parseInt(qty, 10);
  if (Number.isNaN(target)) target = cur.qty; // kotak kosong saat mengetik → pertahankan nilai lama
  target = Math.min(999, Math.max(1, target));
  if (target !== cur.qty) {
    const next = changeQtyLogic(cart, menuId, target - cur.qty);
    setCart(next);
    saveCart();
    renderCartBar();
    renderPOSMenu(); // badge qty kartu menu (grid di belakang modal — tidak ganggu fokus)
  }
  if (rerender) openCartModal(); // sinkron penuh saat blur/change
  else refreshCartModalTotals(); // ringan saat event input (tiap ketikan)
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
export async function simpanPenjualan(cetakJuga = false) {
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) { showToast('Keranjang kosong!', 'error'); return; }

  // Kuota transaksi (2026-08-29): saat kuota bulan ini habis, transaksi diblok
  // tapi aplikasi tetap bisa dieksplor — arahkan ke sheet pembelian.
  const licSt = await getLicenseStatus();
  if (licSt.status === 'expired') {
    showToast('Kuota transaksi bulan ini habis — aktifkan lisensi untuk lanjut jualan 💳', 'error', 4000);
    import('./purchase.js').then(m => m.openPurchaseSheet()).catch(() => {});
    return;
  }

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

  // Catatan pesanan (meja/pemesan/ojol) — ikut tersimpan ke record penjualan
  const orderNote = (document.getElementById('orderNoteInput')?.value || '').trim();
  // Platform ojol (preset GoFood/GrabFood/ShopeeFood/Maxim/Lainnya) untuk laporan
  const ojolPlatform = orderType === 'ojol' ? (getOjolPlatform() || 'Lainnya') : '';

  const saleId = await simpanPenjualanSync({
    tanggal: _tgl,
    orderType,
    orderNote,
    ojolPlatform,
    items: items.map(c => ({
      menuId: c.menu.id,
      nama: c.menu.nama,
      hargaJual: c.menu.hargaJual,
      hargaOjol: c.menu.hargaOjol || 0,
      hargaModal: c.menu.hargaModal,
      qty: c.qty,
      selectedToppings: c.selectedToppings || [],
      toppingQtys: c.toppingQtys || {}
    })),
    totalHarga,
    totalModal,
    bayar,
    kembalian: bayar - totalHarga,
    waktu: Date.now()
  });

  // Kurangi stok untuk item titipan yang pakaiStok. Re-read stok dari DB
  // untuk hindari decrement dari snapshot cart yang mungkin sudah stale
  // (mis. ada retur / edit stok saat item masih di cart).
  for (const c of items) {
    if (c.menu.pakaiStok) {
      const fresh = await DB.menu.get(c.menu.id);
      if (!fresh || !fresh.pakaiStok) continue;
      const currentStok = fresh.stok || 0;
      const newStok = Math.max(0, currentStok - c.qty);
      await DB.menu.update(c.menu.id, { stok: newStok });
    }
  }

  // Simpan tipe order terakhir di localStorage untuk sesi berikutnya
  try { localStorage.setItem('kasirsolo:order-type', orderType); } catch (_) {}

  setLastSaleId(saleId);
  setCart({});
  clearCartStorage();
  // Reset catatan pesanan untuk transaksi berikutnya
  const noteInput = document.getElementById('orderNoteInput');
  if (noteInput) noteInput.value = '';
  try { localStorage.removeItem('kasirsolo:order-note'); } catch (_) {}
  closeCartModal();
  renderCartBar();
  renderPOSMenu();
  showToast('✅ Penjualan tersimpan!');
  showAfterSaleActions();
  // "Simpan & Cetak": langsung cetak nota via printer Bluetooth setelah tersimpan
  if (cetakJuga) {
    try {
      const { printLastNota } = await import('./printer.js');
      await printLastNota();
    } catch (e) {
      console.error('[POS] cetak setelah simpan:', e?.message || e);
      showToast('Nota tersimpan, tapi cetak gagal: ' + (e?.message || 'error'), 'error');
    }
  }
}
