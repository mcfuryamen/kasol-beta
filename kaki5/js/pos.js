// ==================== POS / JUALAN (ESM) ====================
// Thin coordinator module. Delegates to pos.logic.js, pos.ui.js, pos.sync.js.
// All original exports remain available for backward compatibility.

import { DB, getSetting } from './db.js';
import { showToast } from './helpers.js';
// Gerbang kas (v161) — kas.js tidak mengimpor pos.js, jadi aman statis.
import { getOpenShift, openBukaKasModal, fiturKasAktif } from './kas.js';
import { cart, setCart, setPosCat, posCat, setLastSaleId, orderType, setOrderType, getResumedHeldId, setResumedHeldId } from './app-state.js';
import {
  addToCartLogic, changeQtyLogic, hitungKembalianLogic, calculateTotal,
  generatePresetNominal, parseToppings, menuHasOjol, getOjolRows, getOjolPrice
} from './pos.logic.js';
import {
  renderPOSCatTabsUI, renderPOSMenuUI, renderCartBar,
  openCartModal, closeCartModal, hitungKembalianUI, refreshCartModalTotals,
  formatBayarInputUI, selectAllBayarInput, setNominalBayarUI,
  showAfterSaleActions, selectTopping, applySelectedTopping, toggleOrderType,
  renderOrderNoteBox, getOjolPlatform, pickOjolPlatform,
  getPaymentMethod, setPaymentMethod, applyPayMethodUI, setPayOptions, paymentMethodLabel, GLOBAL_NOTE_KEY,
  getPayProof, getPayNote, removePayProof,
  updateHeldFab, renderHeldListModal, lineTotal
} from './pos.ui.js';
import { saveCart, loadCart, clearCartStorage, simpanPenjualanSync, holdCartSync, updateHeldSync, listHeldSync, getHeldSync, deleteHeldSync, payHeldSync, countHeldSync } from './pos.sync.js';
import { getLicenseStatus } from './license.js';

export {
  addToCartLogic, changeQtyLogic, hitungKembalianLogic, calculateTotal,
  generatePresetNominal
} from './pos.logic.js';
export {
  renderPOSCatTabsUI, renderPOSMenuUI, renderCartBar,
  openCartModal, closeCartModal, hitungKembalianUI, refreshCartModalTotals,
  formatBayarInputUI, selectAllBayarInput, setNominalBayarUI,
  showAfterSaleActions, selectTopping, applySelectedTopping, toggleOrderType, pickOjolPlatform,
  setPaymentMethod, getPaymentMethod, paymentMethodLabel,
  capturePayProof, handlePayProofFile, removePayProof,
  clearCart,
  updateHeldFab, renderHeldListModal
} from './pos.ui.js';
export {
  saveCart, loadCart, clearCartStorage, simpanPenjualanSync,
  holdCartSync, updateHeldSync, listHeldSync, getHeldSync, deleteHeldSync, payHeldSync, countHeldSync
} from './pos.sync.js';
// holdOrder/resumeHeldOrder/deleteHeldOrder/openHeldListModal/refreshHeldFab:
// orkestrasi DB+state yang didefinisikan di file ini (blok "FITUR TAHAN" di
// bawah) — sudah otomatis di-export via `export async function` di deklarasi.

// ==================== FITUR "TAHAN" (v148, 2026-09-01) ====================
// Orkestrasi DB + state. Lihat pos.sync.js untuk layer DB & pos.ui.js untuk DOM
// murni (render FAB badge + modal daftar). Workflow: tahan→resume→bayar.

// Hitung total harga sesuai tipe order aktif (sama dengan checkout normal).
function _calcCartTotals() {
  const items = Object.values(cart).filter(c => c.qty > 0);
  const totalHarga = items.reduce((s, c) => s + lineTotal(c), 0);
  const totalModal = items.reduce((s, c) => s + (c.qty * (c.menu.hargaModal || 0)), 0);
  return { items, totalHarga, totalModal };
}

// Tahan: simpan cart aktif → penjualan.status='held', kosongkan cart.
// Pola sama dengan simpanPenjualan (reuse, bukan duplicate logic).
export async function holdOrder(heldName) {
  const { items, totalHarga, totalModal } = _calcCartTotals();
  if (items.length === 0) {
    showToast('Keranjang kosong — tambahkan item dulu', 'error');
    return null;
  }
  const ojolPlat = orderType === 'ojol' ? (getOjolPlatform() || 'Lainnya') : '';
  const orderNote = (document.getElementById('globalNoteInput')?.value || '').trim();

  try {
    const payload = {
      items: items.map(c => ({
        menuId: c.menu.id,
        nama: c.menu.nama,
        hargaJual: c.menu.hargaJual,
        // v158: harga ojol HANYA untuk pesanan tipe Ojol (sama seperti saleRec) —
        // dulu field ini selalu terisi walau ditahan sebagai Dine-in/Take-away.
        hargaOjol: ojolPlat ? getOjolPrice(c.menu, ojolPlat) : 0,
        hargaModal: c.menu.hargaModal,
        qty: c.qty,
        selectedToppings: c.selectedToppings || [],
        toppingQtys: c.toppingQtys || {},
        catatanItem: (c.catatanItem || '').trim()
      })),
      totalHarga,
      totalModal,
      orderType,
      orderNote,
      ojolPlatform: ojolPlat,
      heldName: (heldName || '').trim().slice(0, 60)
    };
    // v154: kalau cart ini hasil MEMBUKA pesanan ditahan (resumedHeldId terisi),
    // "Tahan" ulang = PERBARUI row yang sama — jangan bikin duplikat; nomor TRX
    // & waktu tahan asli tetap. Row hilang/bukan held → fallback buat baru.
    const resumedId = getResumedHeldId();
    let heldId = null;
    let updated = false;
    if (resumedId) {
      updated = await updateHeldSync(resumedId, payload);
      if (updated) heldId = resumedId;
    }
    if (!updated) heldId = await holdCartSync(payload);
    setResumedHeldId(null);

    // Reset state UI (pola reuse dari simpanPenjualan).
    setCart({});
    try { clearCartStorage(); } catch (_) {}
    const noteInput = document.getElementById('globalNoteInput');
    if (noteInput) noteInput.value = '';
    try { localStorage.removeItem(GLOBAL_NOTE_KEY); } catch (_) {}
    removePayProof();
    const payNoteEl = document.getElementById('payNoteInput');
    if (payNoteEl) payNoteEl.value = '';
    closeCartModal();
    renderCartBar();
    renderPOSMenu();

    // Refresh FAB + tampilkan toast.
    const count = await countHeldSync().catch(() => 1);
    await updateHeldFab(count);
    showToast(`${updated ? '🔄 Diperbarui' : '🤚 Ditahan'}${heldName ? ` "${heldName}"` : ''} — ${items.length} item · ${formatRpSimple(totalHarga)}`);
    return heldId;
  } catch (e) {
    console.error('[Hold] gagal:', e?.message || e);
    showToast('Gagal menahan pesanan: ' + (e?.message || 'error'), 'error', 3000);
    return null;
  }
}

// v155 komentar browser: modal input catatan DIHAPUS ("hapus halaman ini").
// "Tahan" memakai catatan yang SUDAH terisi di keranjang (globalNoteInput) —
// jangan bikin catatan baru. Catatan kosong → toast peringatan, tidak menahan
// apa pun (modal keranjang tetap terbuka biar user bisa langsung mengisi).
export async function holdOrderWithNote() {
  const { items } = _calcCartTotals();
  if (items.length === 0) {
    showToast('Keranjang kosong — tambahkan item dulu', 'error');
    return null;
  }
  const note = (document.getElementById('globalNoteInput')?.value || '').trim();
  if (!note) {
    showToast('📝 Isi catatan terlebih dahulu — biar pesanan ditahan gampang dibedakan', 'error', 3000);
    return null;
  }
  return holdOrder(note.slice(0, 60));
}

function formatRpSimple(n) {
  try { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); } catch (_) { return 'Rp ' + (n || 0); }
}

// Buka modal daftar held (FAB tap target). pos.ui.js render murni, pos.js sediakan data.
export async function openHeldListModal() {
  try {
    const rows = await listHeldSync();
    renderHeldListModal(rows);
  } catch (e) {
    showToast('Gagal memuat daftar ditahan', 'error');
  }
}

// Hapus held order dari modal daftar.
export async function deleteHeldOrder(heldId) {
  const id = Number(heldId);
  const row = await getHeldSync(id).catch(() => null);
  const label = row?.heldName || row?.items?.[0]?.nama || `pesanan #${id}`;
  // Pakai window.showConfirm (sama dengan clearCart v147) — sudah di-wire app.js.
  if (typeof window.showConfirm !== 'function') {
    showToast('Modal konfirmasi belum siap, coba lagi', 'error');
    return;
  }
  window.showConfirm('🗑️', `Hapus pesanan ditahan "${label}"? Tindakan ini tidak bisa dibatalkan.`, 'Ya, Hapus', async () => {
    try {
      await deleteHeldSync(id);
      // v154: baris yang dihapus ternyata sedang terbuka di cart → lepas penanda
      // (cart jadi manual; saat dibayar dibuat record baru, bukan payHeldSync).
      if (getResumedHeldId() === Number(id)) setResumedHeldId(null);
      const n = await countHeldSync();
      await updateHeldFab(n);
      showToast('🗑️ Pesanan dihapus');
      // Refresh daftar.
      const rows = await listHeldSync();
      renderHeldListModal(rows);
    } catch (e) {
      showToast('Gagal menghapus: ' + (e?.message || 'error'), 'error');
    }
  });
}

// Resume held → muat ke cart. v154: row held TIDAK dihapus — tetap di daftar
// sampai dibayar (payHeldSync → nomor TRX asli) atau ditahan ulang
// (updateHeldSync). Komentar browser: "buka pesanan ditahan lainnya otomatis
// ganti daftar pesanannya, pesanan yang lama jangan dihapus".
export async function resumeHeldOrder(heldId, opts = {}) {
  const id = Number(heldId);
  // Kartu yang SAMA dan sedang dibuka → cukup tampilkan keranjang; jangan
  // reload dari DB supaya editan di cart tidak hilang diam-diam.
  if (getResumedHeldId() === id && Object.keys(cart).length > 0) {
    const _m = document.getElementById('heldListModal');
    if (_m) _m.classList.remove('show');
    await openCartModal();
    return;
  }
  const perform = async () => {
    const row = await getHeldSync(id);
    if (!row) {
      showToast('Pesanan ini sudah tidak ada', 'info');
      const rows = await listHeldSync().catch(() => []);
      renderHeldListModal(rows);
      return;
    }
    // Susun cart dari row.items. Lookup menu terkini dari DB (harga bisa
    // berubah sejak ditahan).
    // M7 (audit 2026-09-05): item yang sudah dihapus dari DB → tanya konfirmasi
    // sebelum deleteHeldSync, karena pesanan bisa jadi penting sebagai catatan.
    // M2 (audit 2026-09-05): item yang masih ada tapi qty melebihi stok
    // terkini → clamp ke stok maks + toast, supaya pesanan tetap bisa dibuka.
    const newCart = {};
    let skippedCount = 0;
    let clampedItems = [];
    for (const it of (row.items || [])) {
      const menuRow = await DB.menu.get(it.menuId);
      if (!menuRow) { skippedCount++; continue; }
      let qty = it.qty || 1;
      if (menuRow.pakaiStok && qty > (menuRow.stok || 0)) {
        clampedItems.push(menuRow.nama);
        qty = Math.max(1, menuRow.stok || 0);
      }
      newCart[it.menuId] = {
        menu: menuRow,
        qty,
        orderType: row.orderType || 'dine-in',
        selectedToppings: it.selectedToppings || [],
        toppingQtys: it.toppingQtys || {},
        catatanItem: it.catatanItem || ''
      };
    }
    if (clampedItems.length) {
      showToast(`${clampedItems[0]}${clampedItems.length > 1 ? ' +' + (clampedItems.length - 1) + ' lainnya' : ''} stok kurang — jumlah disesuaikan 🛒`, 'warn', 4000);
    }
    if (Object.keys(newCart).length === 0) {
      // M7: semua menu sudah dihapus → konfirmasi sebelum deleteHeldSync.
      const label = row.heldName || `pesanan #${id}`;
      const doDelete = async () => {
        await deleteHeldSync(id).catch(() => {});
        if (getResumedHeldId() === id) setResumedHeldId(null);
        const n = await countHeldSync();
        await updateHeldFab(n);
        const rows = await listHeldSync();
        renderHeldListModal(rows);
        showToast('Menu pesanan sudah dihapus — held order dihapus', 'info', 3000);
      };
      if (typeof window.showConfirm === 'function') {
        window.showConfirm('⚠️', `Menu di "${label}" sudah dihapus dari database — pesanan tidak bisa dibuka. Hapus held order ini?`, 'Ya, Hapus', doDelete, 'Batal');
      } else {
        showToast('Menu pesanan sudah dihapus — held order tidak bisa dibuka', 'error', 4000);
      }
      return;
    }
    setCart(newCart);
    // v154: tandai "sedang dibuka" — saveCart ikut mempersist id ini supaya
    // reload/PWA restart tidak mengubah statusnya jadi cart manual.
    setResumedHeldId(id);
    saveCart();
    // Pulihkan tipe order + platform ojol (jawaban #4: konsisten).
    if (row.orderType) setOrderType(row.orderType);
    if (row.orderType === 'ojol' && row.ojolPlatform) {
      try { pickOjolPlatform(row.ojolPlatform); } catch (_) {}
    }
    // v151 komentar browser: saat pesanan ditahan dibuka kembali, tampilkan
    // otomatis catatan yang sudah diinput — orderNote dulu, fallback ke
    // heldName (catatan wajib dari modal Tahan) biar identitasnya terlihat.
    const noteInput = document.getElementById('globalNoteInput');
    const restoredNote = row.orderNote || row.heldName || '';
    if (noteInput) noteInput.value = restoredNote;
    try { localStorage.setItem(GLOBAL_NOTE_KEY, restoredNote); } catch (_) {}
    // v154: row held TIDAK dihapus — tetap di daftar & badge sampai dibayar
    // (payHeldSync) atau ditahan ulang (updateHeldSync).
    renderCartBar();
    renderPOSMenu();
    await openCartModal();
    // Tutup modal held kalau terbuka.
    const modal = document.getElementById('heldListModal');
    if (modal) modal.classList.remove('show');
    showToast(`↩ Pesanan${row.heldName ? ` "${row.heldName}"` : ''} dibuka kembali`);
  };

  // v154: cart hasil buka pesanan ditahan → GANTI OTOMATIS tanpa konfirmasi.
  // Peringatan timpa (v151) hanya berlaku untuk cart manual yang belum disimpan.
  const curItems = Object.values(cart).filter(c => c.qty > 0);
  if (!opts.force && curItems.length > 0 && getResumedHeldId() === null) {
    if (typeof window.showConfirm === 'function') {
      // v151 komentar browser: peringatan diarahkan untuk MENYIMPAN dulu
      // pesanan yang sedang dibuka (tahan/bayar); "Buang & Ganti" jalan kedua.
      window.showConfirm('⚠️', `Keranjang masih berisi ${curItems.reduce((s, c) => s + (c.qty || 0), 0)} item yang belum disimpan. Tahan dulu pesanan ini, atau buang & ganti dengan pesanan yang dibuka?`, 'Buang & Ganti', perform);
      return;
    }
  }
  await perform();
}

// Inisialisasi FAB count saat halaman POS dibuka (dipanggil dari loadPOS).
export async function refreshHeldFab() {
  try {
    const n = await countHeldSync();
    await updateHeldFab(n);
  } catch (_) {
    await updateHeldFab(0);
  }
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
  return orderType === 'ojol' ? menus.filter(m => menuHasOjol(m)) : menus;
}

// Union nama app dari Harga Ojol semua menu aktif — opsi dinamis tombol
// "Pilih app" di halaman Jualan (sinkron dengan grid Harga Ojol di form Menu).
export async function getOjolAppNames() {
  const menus = await getActiveMenus();
  const seen = new Set();
  const names = [];
  menus.forEach(m => {
    getOjolRows(m).forEach(r => {
      const key = r.nama.trim().toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); names.push(r.nama.trim()); }
    });
  });
  return names;
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
  // Komentar browser #7 (2026-09-04): setiap halaman Jualan dibuka, tipe
  // pesanan kembali ke Dine-in — SELAMA keranjang kosong. Keranjang berisi
  // tidak disentuh karena mengganti tipe akan menulis ulang tipe item yang
  // sudah ada di dalamnya (lihat migrasi cart di pos.ui.js).
  if (orderType !== 'dine-in' && Object.keys(cart).length === 0) {
    setOrderType('dine-in');
    try { localStorage.setItem('kasirsolo:order-type', 'dine-in'); } catch (_) {}
  }
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
  // Blok catatan/tab app ojol modal di-refresh (tipe aktif bisa berubah).
  renderOrderNoteBox();
  const filtered = posCat !== 'Semua' ? menus.filter(m => m.kategori === posCat) : menus;
  renderPOSMenuUI(filtered);
  renderCartBar();
  // Header keranjang: placeholder catatan global sesuai tipe order aktif,
  // lalu pulihkan draft catatan GLOBAL dari sesi sebelumnya (kalau ada).
  renderOrderNoteBox();
  try {
    const draft = localStorage.getItem(GLOBAL_NOTE_KEY);
    const input = document.getElementById('globalNoteInput');
    if (draft && input && !input.value) input.value = draft;
  } catch (_) {}
  // Opsi pembayaran aktif (saklar Tunai/QRIS/Transfer di Pengaturan). Dibaca di
  // sini lalu di-inject ke pos.ui.js — modul UI sengaja tidak boleh menyentuh DB.
  try {
    setPayOptions({
      tunai: (await getSetting('payOptTunai', '1')) !== '0',
      qris: (await getSetting('payOptQris', '1')) !== '0',
      transfer: (await getSetting('payOptTransfer', '1')) !== '0'
    });
  } catch (_) { /* DB sibuk → semua opsi default aktif */ }
  // Refresh FAB "Tahan" — tampilkan badge sesuai jumlah held aktif (v148).
  refreshHeldFab();
  // Gerbang kas dipindah ke sini (permintaan 2026-09-04): modal "Buka Kas"
  // muncul begitu tab Jualan ditekan, bukan saat "Bayar" — jadi laci sudah
  // punya modal awal sebelum item apa pun masuk keranjang. Guard di
  // simpanPenjualan SENGAJA dibiarkan sebagai jaring pengaman (shift bisa
  // saja ditutup dari perangkat lain sambil halaman ini terbuka).
  try {
    if (await fiturKasAktif() && !(await getOpenShift())) openBukaKasModal();
  } catch (e) { console.warn('[POS] gerbang kas dilewati:', e?.message || e); }
}

// ---- Category tabs (async: DB query + DOM) ----
export async function renderPOSCatTabs() {
  const menus = filterOjol(await getActiveMenus());
  renderOrderNoteBox();
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
  // Produk habis (pakaiStok & stok<=0) TIDAK bisa ditransaksikan — blok sejak
  // klik kartu (sebelum selector topping/hargaOjol terbuka) + toast peringatan.
  // Guard data tetap di addToCartLogic (defense in depth).
  if (m.pakaiStok && (m.stok || 0) <= 0) {
    showToast(`"${m.nama}" habis — stok harus diisi dulu di menu kelola 📦`, 'error', 3000);
    return;
  }
  const toppings = parseToppings(m.toppingList);
  const hasOjol = menuHasOjol(m);
  // Jika ada topping atau hargaOjol → buka selector dulu, baru masuk keranjang
  if (toppings.length > 0 || hasOjol) {
    openMenuSelector(m, ({ selectedToppings = [], orderType: tipe = orderType, qty = 1, selectedToppingQtys = null, itemNote = '' }) => {
      // itemNote = catatan MENU TERPILIH (komentar browser #8) — bukan catatan global.
      const next = addToCartLogic(cart, menuId, m, selectedToppings, tipe, qty, selectedToppingQtys, itemNote);
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
  const cur = cart[menuId];
  // v176: jalur ± di-clamp sama dengan input manual (9999) — dulu tombol + dari
  // 9999 bisa menembus jadi 10.000 karena clamp hanya ada di setCartQty.
  if (cur && delta > 0 && cur.qty >= 9999) {
    showToast('Maksimal 9.999 per menu — sisa pesanan pecah ke transaksi lain ya', 'error');
    return;
  }
  if (cur && delta > 0) delta = Math.min(delta, 9999 - cur.qty);
  const next = changeQtyLogic(cart, menuId, delta);
  if (cur && next === cart) {
    // v175: tombol ± ditolak guard stok (qty > stok pada menu pakaiStok) —
    // kasir harus tahu kenapa angkanya tidak jalan, jangan diam saja.
    showToast(`Qty melebihi stok (${cur.menu.stok || 0}) — perbarui stok menu dulu`, 'error');
  }
  setCart(next);
  saveCart();
  renderCartBar();
  // re-render cart modal
  const items = Object.values(next).filter(c => c.qty > 0);
  if (items.length === 0) { closeCartModal(); renderPOSMenu(); return; }
  openCartModal();
  renderPOSMenu();
}

// Set qty langsung dari input manual (batas 1–9999 — v174: naik dari 999
// agar transaksi grosir >1000 pcs per menu bisa diinput).
// rerender=false → update ringan (state + cartBar + badge grid + total modal)
// TANPA rebuild daftar cart, agar fokus ketikan di input qty tidak hilang.
export function setCartQty(menuId, qty, rerender = true) {
  const cur = cart[menuId];
  if (!cur) return;
  let target = parseInt(qty, 10);
  if (Number.isNaN(target)) target = cur.qty; // kotak kosong saat mengetik → pertahankan nilai lama
  target = Math.min(9999, Math.max(1, target));
  if (target !== cur.qty) {
    const next = changeQtyLogic(cart, menuId, target - cur.qty);
    if (next === cart) {
      // v175: input manual ditolak guard stok — kasir harus tahu kenapa angkanya balik.
      showToast(`Qty melebihi stok (${cur.menu.stok || 0}) — perbarui stok menu dulu`, 'error');
    } else {
      setCart(next);
      saveCart();
      renderCartBar();
      renderPOSMenu(); // badge qty kartu menu (grid di belakang modal — tidak ganggu fokus)
    }
  }
  if (rerender) openCartModal(); // sinkron penuh saat blur/change
  else refreshCartModalTotals(); // ringan saat event input (tiap ketikan)
}

// ---- Modal (sudah di-export di atas) ----

// ---- Pembayaran ----
export function hitungKembalian() {
  const total = calculateTotal(cart, getOjolPlatform(), orderType);
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

// P0 (audit 2026-09-05): guard in-flight — dobel tap tombol "Bayar" tidak boleh
// menghasilkan dua run paralel (2 record penjualan + stok terkurang 2×; jalur
// held malah membuat penjualan BARU lagi saat payHeldSync throw "bukan held").
// Tombol Bayar ikut di-disable selama proses (style .btn:disabled sudah ada di
// style.css — tanpa CSS baru). Flag ter-set SEBELUM await pertama agar run
// kedua dari dobel-tap selalu tertahan di gerbang wrapper.
let _simpanInFlight = false;
function setBayarBusy(busy) {
  try {
    document.querySelectorAll('[data-action="save-sale-print"]').forEach(b => { b.disabled = !!busy; });
  } catch (_) { /* DOM belum siap — flag guard tetap melindungi */ }
}

export async function simpanPenjualan(cetakJuga = false) {
  if (_simpanInFlight) { showToast('Transaksi sedang diproses…', 'info', 1500); return; }
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) { showToast('Keranjang kosong!', 'error'); return; }
  _simpanInFlight = true;
  setBayarBusy(true);
  try {
    await _simpanPenjualanCore(cetakJuga, items);
  } finally {
    _simpanInFlight = false;
    setBayarBusy(false);
  }
}

async function _simpanPenjualanCore(cetakJuga, items) {
  // v161 (adopsi buka/tutup kas dari rosok): uang di laci harus punya titik
  // awal yang jelas. Tanpa shift 'buka', angka saat tutup kas tidak akan pernah
  // cocok, jadi transaksi diblok SEBELUM ada yang ditulis ke DB.
  // v166: gerbang ini HANYA berlaku bila fitur buka/tutup kas diaktifkan di
  // Pengaturan. Saklar mati = kios boleh jualan tanpa buka kas sama sekali.
  try {
    if (await fiturKasAktif()) {
    if (!(await getOpenShift())) {
      showToast('Kas belum dibuka — buka kas dulu untuk mulai transaksi 💰', 'error', 4000);
      openBukaKasModal();
      return;
    }
  }

  // Fallback terakhir (2026-08-31): stok bisa berubah SETELAH item masuk
  // keranjang (isi ulang stok nol, sinkron antar perangkat, dsb). Cek ulang
  // stok terkini dari DB — blokir transaksi bila qty melebihi stok (M2 / 2026-09-05).
  for (const c of items) {
    const mid = c.menu && c.menu.id;
    if (!mid) continue;
    const fresh = await DB.menu.get(mid);
    if (fresh && fresh.pakaiStok && c.qty > (fresh.stok || 0)) {
      showToast(`"${c.menu.nama}" stok tinggal ${fresh.stok || 0} — sesuaikan jumlah dulu 🛒`, 'error', 3500);
      return;
    }
  }

  // Kuota transaksi (2026-08-29): saat kuota bulan ini habis, transaksi diblok
  // tapi aplikasi tetap bisa dieksplor — arahkan ke sheet pembelian.
  const licSt = await getLicenseStatus();
  if (licSt.status === 'expired') {
    showToast('Kuota transaksi bulan ini habis — aktifkan lisensi untuk lanjut jualan 💳', 'error', 4000);
    import('./purchase.js').then(m => m.openPurchaseSheet()).catch(() => {});
    return;
  }

  const totalHarga = calculateTotal(cart, getOjolPlatform(), orderType);
  // P3f (audit 2026-09-05): selaras dengan _calcCartTotals — hargaModal bisa
  // undefined pada data lama/import yang tidak punya field itu.
  const totalModal = items.reduce((a,c) => a + c.qty * (c.menu.hargaModal || 0), 0);

  // Metode pembayaran (komentar browser #5): QRIS/Transfer = bayar pas sesuai
  // total → tidak ada uang diterima & kembalian, validasi "Uang kurang" dilewati.
  const payMethod = getPaymentMethod();
  const isCash = payMethod === 'tunai';
  let bayar = totalHarga;
  if (isCash) {
    const bayarValue = document.getElementById('bayarInput').value.replace(/\D/g, '');
    bayar = bayarValue ? parseInt(bayarValue) : totalHarga;
    if (bayar < totalHarga) {
      showToast('Uang kurang!', 'error');
      return;
    }
  }

  const _now = new Date();
  const _tgl = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0') + '-' + String(_now.getDate()).padStart(2,'0');

  // Catatan GLOBAL per transaksi (header keranjang): nama driver, no. orderan
  // ojol, no. meja, dll (komentar browser #4).
  const orderNote = (document.getElementById('globalNoteInput')?.value || '').trim();
  // Platform ojol (preset GoFood/GrabFood/ShopeeFood/Maxim/Lainnya) untuk laporan
  const ojolPlatform = orderType === 'ojol' ? (getOjolPlatform() || 'Lainnya') : '';
  // Non-tunai (QRIS/Transfer): foto bukti pembayaran + catatan opsional
  // (permintaan pemilik 2026-08-31 — simpel, tanpa setting QR/rekening).
  const buktiBayar = isCash ? '' : getPayProof();
  const catatanBayar = isCash ? '' : getPayNote();
  if (!isCash && !buktiBayar) {
    showToast('Foto bukti pembayaran dulu ya 📸', 'error', 2500);
    return;
  }

  // v154: kalau cart ini hasil MEMBUKA pesanan ditahan → bayar row aslinya
  // (payHeldSync): nomor TRX tetap sama sejak ditahan, status → completed,
  // isi di-update sesuai cart terkini (bisa sudah diedit). Row hilang / sudah
  // bukan held lagi (race) → fallback simpan sebagai penjualan baru.
  const saleRec = {
    tanggal: _tgl,
    orderType,
    orderNote,
    ojolPlatform,
    items: items.map(c => ({
      menuId: c.menu.id,
      nama: c.menu.nama,
      hargaJual: c.menu.hargaJual,
      // Simpan harga efektif per unit (harga app terpilih saat transaksi ojol)
      // agar nota/laporan tetap benar walau harga ojol nanti diubah.
      hargaOjol: ojolPlatform ? getOjolPrice(c.menu, ojolPlatform) : 0,
      hargaModal: c.menu.hargaModal,
      qty: c.qty,
      selectedToppings: c.selectedToppings || [],
      toppingQtys: c.toppingQtys || {},
      catatanItem: (c.catatanItem || '').trim()
    })),
    totalHarga,
    totalModal
  };
  const payRec = {
    ...saleRec,
    bayar,
    kembalian: isCash ? (bayar - totalHarga) : 0,
    metodeBayar: payMethod,
    buktiBayar,
    catatanBayar,
    waktu: Date.now(),
    paidAt: Date.now() // M3 / 2026-09-05: untuk atribusi kas per shift
  };
  const resumedId = getResumedHeldId();
  let saleId = null;
  if (resumedId) {
    try {
      saleId = await payHeldSync(resumedId, payRec);
    } catch (e) {
      console.warn('[POS] payHeldSync gagal, simpan sebagai penjualan baru:', e?.message || e);
      saleId = null;
    }
  }
  if (!saleId) saleId = await simpanPenjualanSync(payRec);
  setResumedHeldId(null);

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
  // Reset catatan GLOBAL untuk transaksi berikutnya (catatan per-item ikut
  // hilang karena keranjang dikosongkan) + kosongkan no. referensi bayar
  const noteInput = document.getElementById('globalNoteInput');
  if (noteInput) noteInput.value = '';
  removePayProof();
  const payNoteEl = document.getElementById('payNoteInput');
  if (payNoteEl) payNoteEl.value = '';
  try { localStorage.removeItem(GLOBAL_NOTE_KEY); } catch (_) {}
  closeCartModal();
  renderCartBar();
  renderPOSMenu();
  // v154: kalau cart tadi hasil buka pesanan ditahan, row-nya baru saja jadi
  // completed → badge FAB held harus disegarkan (jalur manual: count tidak
  // berubah, panggilan ini tetap murah & aman).
  try { const _nh = await countHeldSync(); await updateHeldFab(_nh); } catch (_) {}
  showToast('✅ Penjualan tersimpan!');
  showAfterSaleActions();
  // v152 komentar browser: "Bayar" = simpan transaksi lalu TANYA cetak nota
  // atau tidak. "Tidak" → flow selesai (cart modal sudah ditutup, kembali ke
  // katalog). "Cetak" → lanjut flow cetak nota yang sudah ada (printLastNota).
  const doPrintNota = async () => {
    try {
      const { printLastNota } = await import('./printer.js');
      await printLastNota();
    } catch (e) {
      console.error('[POS] cetak setelah simpan:', e?.message || e);
      showToast('Nota tersimpan, tapi cetak gagal: ' + (e?.message || 'error'), 'error');
    }
  };
  if (cetakJuga === 'ask' && typeof window.showConfirm === 'function') {
    window.showConfirm('🧾', 'Transaksi tersimpan. Cetak nota sekarang?', '🖨️ Cetak', () => { doPrintNota(); }, 'Tidak');
  } else if (cetakJuga) {
    await doPrintNota();
  }
  } finally {
    // Outer try (line 570) dari _simpanPenjualanCore.
    // Flag in-flight + disable tombol sudah di-wrap luar simpanPenjualan().
  }
}
