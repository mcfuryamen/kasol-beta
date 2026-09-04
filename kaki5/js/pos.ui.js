// ==================== POS UI (ESM) ====================
// DOM operations only. No DB access. No state mutations.

import { escapeHtml, formatRp, showToast } from './helpers.js';
import { cart, posCat, orderType, setOrderType, setCart, setResumedHeldId } from './app-state.js';
import { generatePresetNominal, parseToppings, toppingHarga, hargaEfektif, normalizeToppingQtys, getOjolPrice, getOjolRows, menuHasOjol, lineTotal as lineTotalLogic } from './pos.logic.js';
import { openModal, closeModal } from './modal.js';
import { showConfirm } from './confirm.js';
import { clearCartStorage, saveCart } from './pos.sync.js';

let _toppingTargetMenuId = null; // menuId yang topping-nya sedang dipilih (di cart)
let _menuSelectorMenu = null;   // menu yang sedang dibuka di menu selector (utk harga ojol picker)

// ── Selector topping + jumlah SEBELUM masuk keranjang ───────────────────────
// Topping qty independen per-topping: setiap opsi topping punya stepper qty sendiri
// (default 1, hidden sampai checkbox dicentang). Mis. telur dadar qty=1 + ayam goreng qty=2.
let _menuSelectorOnConfirm = null;
let _menuSelectorOrderType = 'dine-in';
let _menuSelectorQty = 1;

export function openMenuSelector(menu, onConfirm) {
  _menuSelectorOnConfirm = onConfirm;
  _menuSelectorOrderType = orderType;
  _menuSelectorQty = 1;

  const toppings = parseToppings(menu.toppingList);
  const hasOjol = menuHasOjol(menu);
  const body = document.getElementById('menuSelectorBody');
  if (!body) return;

  // Catatan + tab pilih app ojol BAGIAN DARI modal ini (dipindah dari halaman
  // Jualan, 2026-08-31; tipe pesanan tetap di halaman). Simpan menu utk harga
  // ojol spesifik-menu pada tab app.
  _menuSelectorMenu = menu;

  body.innerHTML = `
    <div class="kmb12">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div class="kfw600 ktext2">${escapeHtml(menu.nama)}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="ms-harga" id="menuSelectorHarga">${formatRp(hargaUnitBase())}</div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="menu-selector-qty" data-delta="-1" aria-label="Kurangi jumlah">−</button>
          <input type="number" id="menuSelectorQty" class="ms-qty-input" min="1" max="99" value="1" inputmode="numeric" aria-label="Jumlah">
          <button type="button" class="btn btn-sm btn-ghost" data-action="menu-selector-qty" data-delta="1" aria-label="Tambah jumlah">＋</button>
        </div>
      </div>
      ${toppings.length > 0 ? `
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0">
      <div class="kfw600 ktext2 kmt8 kmb8">Pilih Topping</div>
      <div id="menuSelectorToppings" class="kgrid-1col-gap8">
        ${toppings.map(t => renderToppingOptionRow(t, 'ms')).join('')}
      </div>
      ` : ''}
    </div>
  `;

  openModal('menuSelectorModal');
  // Catatan modal kini milik MENU TERPILIH (per item) → selalu mulai kosong,
  // jangan bawa catatan menu sebelumnya (komentar browser #8, 2026-08-31).
  const itemNoteEl = document.getElementById('orderNoteInput');
  if (itemNoteEl) itemNoteEl.value = '';
  // Kondisi awal blok catatan/tab app (placeholder & tab sesuai tipe aktif di halaman)
  renderOrderNoteBox();
  // renderOjolTabs di atas dapat menyinkronkan ojolPlatform ke app milik menu
  // ini → segarkan harga setelah DOM topping tersedia.
  updateMenuSelectorHarga();
}

// ── Harga satuan di baris judul modal (komentar browser #1, v146) ────────────
// Dulu harga ojol menempel di dalam tiap tab app; kini dipindah ke baris
// nama menu/produk, di kiri tombol minus. Basisnya mengikuti tipe pesanan:
// Ojol → harga app ojol terpilih (getOjolPrice), selain itu → hargaJual.
// Ditambah harga topping yang sedang dicentang (harga per-satuan, bukan total).
function hargaUnitBase() {
  const menu = _menuSelectorMenu;
  if (!menu) return 0;
  const tipe = _menuSelectorOrderType || orderType;
  return tipe === 'ojol' ? getOjolPrice(menu, ojolPlatform) : (menu.hargaJual || 0);
}

function hargaUnitSelector() {
  // NB: template innerHTML membaca hargaUnitBase() saja — saat innerHTML
  // dibangun, DOM topping masih milik menu sebelumnya. Topping dihitung lewat
  // updateMenuSelectorHarga() setelah modal ter-render.
  const top = [...document.querySelectorAll('#menuSelectorToppings input[type="checkbox"]:checked')]
    .reduce((s, cb) => s + (Number(cb.dataset.harga) || 0), 0);
  return hargaUnitBase() + top;
}

function updateMenuSelectorHarga() {
  const el = document.getElementById('menuSelectorHarga');
  if (el) el.textContent = formatRp(hargaUnitSelector());
}

// Render 1 baris opsi topping — checkbox + nama + harga + stepper qty (hidden sampai checked).
// scope: 'ms' (menu selector) atau 'cart' (cart modal).
function renderToppingOptionRow(t, scope) {
  return `
    <label class="topping-option-row" data-nama="${escapeHtml(t.nama)}" data-harga="${t.harga}">
      <input type="checkbox" data-action="topping-toggle" data-scope="${scope}" data-nama="${escapeHtml(t.nama)}" data-harga="${t.harga}">
      <span class="topping-name">${escapeHtml(t.nama)}</span>
      <span class="topping-harga">${formatRp(t.harga)}</span>
      <span class="topping-stepper" data-scope="${scope}" data-nama="${escapeHtml(t.nama)}" style="display:none">
        <button type="button" class="btn btn-sm btn-ghost" data-action="topping-qty" data-scope="${scope}" data-nama="${escapeHtml(t.nama)}" data-delta="-1" aria-label="Kurangi ${escapeHtml(t.nama)}">−</button>
        <input type="number" class="ms-qty-input topping-qty-input" data-scope="${scope}" data-nama="${escapeHtml(t.nama)}" min="1" max="99" value="1" inputmode="numeric" aria-label="Jumlah ${escapeHtml(t.nama)}" style="width:42px">
        <button type="button" class="btn btn-sm btn-ghost" data-action="topping-qty" data-scope="${scope}" data-nama="${escapeHtml(t.nama)}" data-delta="1" aria-label="Tambah ${escapeHtml(t.nama)}">＋</button>
      </span>
    </label>
  `;
}

// Toggle stepper qty visibility saat checkbox berubah.
// scope: 'ms' (menu selector) atau 'cart' (cart modal).
export function syncToppingStepperVisibility(scope, nama) {
  const cb = document.querySelector(
    `input[type="checkbox"][data-action="topping-toggle"][data-scope="${scope}"][data-nama="${CSS.escape(nama)}"]`
  );
  const row = document.querySelector(
    `.topping-stepper[data-scope="${scope}"][data-nama="${CSS.escape(nama)}"]`
  );
  if (!cb || !row) return;
  row.style.display = cb.checked ? 'inline-flex' : 'none';
  // Sync qty input minimal ke 1 kalau baru di-check
  if (cb.checked) {
    const inp = row.querySelector('.topping-qty-input');
    if (inp && (parseInt(inp.value, 10) || 0) < 1) inp.value = 1;
  }
  // Centang/lepas centang topping mengubah harga satuan di baris judul modal.
  if (scope === 'ms') updateMenuSelectorHarga();
}

// Ubah jumlah di menu selector (batas 1–99).
// Base dibaca dari nilai input DOM dulu, agar ketikan manual user tidak
// tertimpa saat tombol − / ＋ diklik.
export function changeMenuSelectorQty(delta) {
  const el = document.getElementById('menuSelectorQty');
  const domVal = parseInt(el?.value, 10);
  const base = Number.isNaN(domVal) ? _menuSelectorQty : domVal;
  _menuSelectorQty = Math.min(99, Math.max(1, base + (parseInt(delta, 10) || 0)));
  if (el) el.value = _menuSelectorQty;
}

// Ubah qty per-topping (independen per opsi, mis. telur dadar qty=1, ayam goreng qty=2).
export function changeToppingQty(scope, nama, delta) {
  const row = document.querySelector(
    `.topping-stepper[data-scope="${scope}"][data-nama="${CSS.escape(nama)}"]`
  );
  if (!row) return;
  const inp = row.querySelector('.topping-qty-input');
  if (!inp) return;
  const domVal = parseInt(inp.value, 10);
  const base = Number.isNaN(domVal) ? 1 : domVal;
  const next = Math.min(99, Math.max(1, base + (parseInt(delta, 10) || 0)));
  inp.value = next;
}

export function confirmMenuSelector() {
  // Baca jumlah menu dari input manual
  const qtyEl = document.getElementById('menuSelectorQty');
  const typed = parseInt(qtyEl?.value, 10);
  if (!Number.isNaN(typed)) _menuSelectorQty = Math.min(99, Math.max(1, typed));

  // Kumpulkan topping dipilih + qty masing-masing
  const cbs = document.querySelectorAll('#menuSelectorToppings input[type="checkbox"]');
  const selected = [];
  const qtys = [];
  cbs.forEach(cb => {
    if (cb.checked) {
      const nama = cb.dataset.nama || '';
      const harga = parseInt(cb.dataset.harga) || 0;
      if (!nama) return;
      selected.push({ nama, harga });
      // Baca qty dari stepper inline
      const stepper = document.querySelector(
        `.topping-stepper[data-scope="ms"][data-nama="${CSS.escape(nama)}"] .topping-qty-input`
      );
      const q = Math.max(1, parseInt(stepper?.value, 10) || 1);
      qtys.push({ nama, qty: q });
    }
  });
  // Tipe pesanan tidak ada di modal (tetap di halaman Jualan) — pakai tipe global.
  const tipe = _menuSelectorOrderType || orderType || 'dine-in';
  // Catatan MENU TERPILIH (per item) — bukan catatan global transaksi, yang
  // sekarang hidup di header keranjang #globalNoteInput (komentar browser #8).
  const itemNote = (document.getElementById('orderNoteInput')?.value || '').trim().slice(0, 120);
  if (_menuSelectorOnConfirm) {
    _menuSelectorOnConfirm({ selectedToppings: selected, orderType: tipe, qty: _menuSelectorQty, selectedToppingQtys: qtys, itemNote });
  }
  _menuSelectorOnConfirm = null;
  closeModal('menuSelectorModal');
}

export function closeMenuSelector() {
  _menuSelectorOnConfirm = null;
  closeModal('menuSelectorModal');
}

// ── Panggil dari HTML: buka selector topping di cart modal ──────────────────
export function selectTopping(menuId) {
  const item = cart[menuId];
  if (!item) return;
  // Buka cart modal dulu kalau belum terbuka
  if (!document.getElementById('cartModal').classList.contains('open')) {
    openCartModal();
  }
  // Highlight baris yang sedang diedit
  _toppingTargetMenuId = Number(menuId);
  document.querySelectorAll('.cart-item').forEach(el => {
    el.classList.toggle('topping-editing', Number(el.dataset.menuId) === Number(menuId));
  });
  const sel = document.getElementById('toppingSelector');
  if (sel) {
    sel.style.display = 'block';
    renderAvailableToppings(Number(menuId));
  }
  // Scroll ke baris yang diedit
  const row = document.querySelector(`.cart-item[data-menu-id="${menuId}"]`);
  row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function applySelectedTopping() {
  if (!_toppingTargetMenuId) return;
  const cbs = document.querySelectorAll('#toppingList input[type="checkbox"]');
  const selected = [];
  const newQtys = {};
  cbs.forEach(cb => {
    if (cb.checked) {
      const nama = cb.dataset.nama || '';
      const harga = parseInt(cb.dataset.harga) || 0;
      if (!nama) return;
      selected.push({ nama, harga });
      // Baca qty per-topping dari stepper inline
      const stepper = document.querySelector(
        `.topping-stepper[data-scope="cart"][data-nama="${CSS.escape(nama)}"] .topping-qty-input`
      );
      newQtys[nama] = Math.max(1, parseInt(stepper?.value, 10) || 1);
    }
  });
  const next = { ...cart };
  if (next[_toppingTargetMenuId]) {
    // Merge dengan toppingQtys lama: pertahankan qty untuk topping yang sudah ada & masih dipilih
    const existingQtys = next[_toppingTargetMenuId].toppingQtys || {};
    const mergedQtys = { ...existingQtys };
    // Update qty untuk topping yang dicentang
    Object.entries(newQtys).forEach(([nama, q]) => { mergedQtys[nama] = q; });
    // Hapus qty untuk topping yang di-uncheck (nama tidak ada di selected baru)
    const selectedNames = new Set(selected.map(t => t.nama));
    Object.keys(mergedQtys).forEach(nama => {
      if (!selectedNames.has(nama)) delete mergedQtys[nama];
    });
    next[_toppingTargetMenuId] = {
      ...next[_toppingTargetMenuId],
      selectedToppings: selected,
      toppingQtys: mergedQtys
    };
    setCart(next);
  }
  _toppingTargetMenuId = null;
  const sel = document.getElementById('toppingSelector');
  if (sel) sel.style.display = 'none';
  document.querySelectorAll('.cart-item').forEach(el => el.classList.remove('topping-editing'));
  openCartModal(); // re-render cart dengan harga baru
}

// ── Blok modal Pilihan Menu: tab app ojol + catatan PER MENU ───────────────
// Catatan GLOBAL per transaksi pindah ke header keranjang (#globalNoteInput)
// per permintaan pemilik 2026-08-31 (komentar browser #4), jadi input
// #orderNoteInput di sini murni catatan menu terpilih (#8).
const GLOBAL_NOTE_PLACEHOLDER = {
  'dine-in': 'Catatan transaksi: no. meja, nama pemesan…',
  'takeaway': 'Catatan transaksi: nama pemesan, jam ambil…',
  'ojol': 'Catatan transaksi: nama driver, no. orderan ojol, plat nomor…'
};

export function renderOrderNoteBox() {
  const wrap = document.getElementById('ojolTabsWrap');
  // Tab pilih app ojol hanya tampil saat tipe aktif = Ojol.
  const isOjol = orderType === 'ojol';
  if (wrap) wrap.style.display = isOjol ? 'block' : 'none';
  if (isOjol) renderOjolTabs();
  // Placeholder catatan global mengikuti tipe pesanan aktif di halaman Jualan.
  const g = document.getElementById('globalNoteInput');
  if (g) g.placeholder = GLOBAL_NOTE_PLACEHOLDER[orderType] || GLOBAL_NOTE_PLACEHOLDER['dine-in'];
}

// ── Ojol app tabs (di dalam menu selector modal) ────────────────────────────
// Konsep tab: baris tab app di ATAS catatan — semua app milik menu terbuka
// langsung terlihat, tiap tab menampilkan HARGA OJOL-nya. App terpilih
// tersimpan di record penjualan (ojolPlatform) untuk laporan per platform.
const OJOL_PLATFORM_KEY = 'kasirsolo:ojol-platform';
let ojolPlatform = '';
try { ojolPlatform = localStorage.getItem(OJOL_PLATFORM_KEY) || ''; } catch (_) {}

export function getOjolPlatform() { return ojolPlatform; }

// Tab = harga ojol milik menu terbuka (getOjolRows, termasuk migrasi
// hargaOjol lama → "Lainnya"). Menu tanpa konfigurasi ojol → preset generik
// tanpa harga (harga efektif tetap hargaJual via getOjolPrice).
const OJOL_PRESET_APPS = ['GoFood', 'GrabFood', 'ShopeeFood', 'Maxim', 'Lainnya'];
function renderOjolTabs() {
  const tabs = document.getElementById('ojolTabs');
  if (!tabs) return;
  const rows = getOjolRows(_menuSelectorMenu);
  const list = rows.length > 0 ? rows : OJOL_PRESET_APPS.map(a => ({ nama: a, harga: null }));
  const cur = (ojolPlatform || '').trim().toLowerCase();
  const activeIdx = Math.max(0, list.findIndex(r => r.nama.trim().toLowerCase() === cur));
  tabs.innerHTML = list.map((r, i) =>
    `<button class="ojol-tab${i === activeIdx ? ' active' : ''}" type="button" data-action="pick-ojol-platform" data-platform="${escapeHtml(r.nama)}">${escapeHtml(r.nama)}</button>`
  ).join('');
  // Sinkronkan platform tersimpan bila tidak cocok dengan daftar menu ini
  // (mis. pilihan dari menu lain) — tab aktif & harga selalu konsisten.
  if (rows.length > 0 && ojolPlatform !== list[activeIdx].nama) {
    ojolPlatform = list[activeIdx].nama;
    try { localStorage.setItem(OJOL_PLATFORM_KEY, ojolPlatform); } catch (_) {}
  }
  // Harga tidak lagi tampil di dalam tab (komentar browser #1) — pindah ke
  // baris judul modal, jadi tiap ganti app harga satuan ikut tersegarkan.
  updateMenuSelectorHarga();
}

export function pickOjolPlatform(p) {
  ojolPlatform = p;
  try { localStorage.setItem(OJOL_PLATFORM_KEY, p); } catch (_) {}
  renderOjolTabs(); // refresh tab aktif + harga satuan di baris judul
}

// ── Metode pembayaran: Tunai | QRIS | Transfer ──────────────────────────────
// Permintaan pemilik 2026-08-31 (disederhanakan): non-tunai = bayar pas sesuai
// total + FOTO BUKTI PEMBAYARAN dari kamera perangkat + catatan opsional.
// Tanpa setting QR/rekening — merchant biasanya sudah punya QRIS versi cetak.
// Opsi mana yang aktif diatur lewat saklar di Pengaturan; di-inject dari pos.js
// lewat setPayOptions() (sumbernya tabel `settings`). Modul ini DOM-only.
const PAY_METHOD_KEY = 'kasirsolo:pay-method';
const PAY_METHOD_LABELS = { tunai: '💵 Tunai', qris: '📱 QRIS', transfer: '🏦 Transfer' };
let payOptions = { tunai: true, qris: true, transfer: true };
let paymentMethod = 'tunai';
try {
  const saved = localStorage.getItem(PAY_METHOD_KEY);
  if (saved && PAY_METHOD_LABELS[saved]) paymentMethod = saved;
} catch (_) {}
let payProofData = ''; // bukti bayar (dataURL terkompresi) — hidup selama modal keranjang

export function getPaymentMethod() { return paymentMethod; }
export function paymentMethodLabel(m = paymentMethod) { return PAY_METHOD_LABELS[m] || PAY_METHOD_LABELS.tunai; }
export function getPayProof() { return payProofData; }
export function getPayNote() { return (document.getElementById('payNoteInput')?.value || '').trim().slice(0, 120); }

// Opsi pembayaran aktif di-inject pos.js (settings payOptTunai/payOptQris/payOptTransfer).
export function setPayOptions(opts) {
  payOptions = { tunai: true, qris: true, transfer: true, ...(opts || {}) };
  if (!Object.values(payOptions).some(Boolean)) payOptions.tunai = true; // jaring pengaman
  applyPayMethodUI();
}

export function setPaymentMethod(method) {
  if (!PAY_METHOD_LABELS[method] || !payOptions[method]) return;
  paymentMethod = method;
  try { localStorage.setItem(PAY_METHOD_KEY, method); } catch (_) {}
  applyPayMethodUI();
  // Segarkan panel bayar SEKETIKA dengan total saat ini — non-tunai mengisi
  // nominal, tunai mengisi ulang uang diterima + preset + kembalian.
  refreshCartModalTotals();
}

// Sinkronkan tombol + blok tunai/non-tunai. Bila hanya SATU opsi aktif, row
// tombol disembunyikan (visual seperti sebelum fitur QRIS/Transfer).
// Return true bila non-tunai aktif.
export function applyPayMethodUI() {
  const enabled = Object.keys(PAY_METHOD_LABELS).filter(m => payOptions[m]);
  if (!enabled.includes(paymentMethod)) paymentMethod = enabled[0] || 'tunai';
  const row = document.getElementById('payMethodRow');
  if (row) {
    row.style.display = enabled.length <= 1 ? 'none' : '';
    row.querySelectorAll('.pay-method-btn').forEach(b => {
      const m = b.dataset.method;
      b.style.display = payOptions[m] ? '' : 'none';
      b.classList.toggle('active', m === paymentMethod);
    });
  }
  const cash = document.getElementById('cashPayBlock');
  const nonCash = document.getElementById('nonCashBlock');
  const isCash = paymentMethod === 'tunai';
  if (cash) cash.style.display = isCash ? '' : 'none';
  if (nonCash) nonCash.style.display = isCash ? 'none' : '';
  return !isCash;
}

// Panel non-tunai: hanya nominal yang harus dibayar (bukti & catatan diisi kasir).
export function renderNonCashPay(total) {
  if (paymentMethod === 'tunai') return;
  const nominal = document.getElementById('payNoncashNominal');
  if (nominal) nominal.textContent = formatRp(total);
}

// ── Foto bukti pembayaran (kamera via file input capture, pola purchase.js) ──
export function capturePayProof() {
  document.getElementById('payProofFile')?.click();
}

export function removePayProof() {
  payProofData = '';
  const file = document.getElementById('payProofFile');
  if (file) file.value = '';
  const wrap = document.getElementById('payProofPreviewWrap');
  const btn = document.getElementById('payProofBtn');
  if (wrap) wrap.style.display = 'none';
  if (btn) btn.style.display = '';
}

// Foto kamera HP bisa 3–8 MB → resize kanvas + JPEG 0.72 biar IndexedDB aman.
export function handlePayProofFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 900;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      payProofData = cv.toDataURL('image/jpeg', 0.72);
      const prev = document.getElementById('payProofPreview');
      const wrap = document.getElementById('payProofPreviewWrap');
      const btn = document.getElementById('payProofBtn');
      if (prev) prev.src = payProofData;
      if (wrap) wrap.style.display = '';
      if (btn) btn.style.display = 'none';
    };
    img.onerror = () => showToast('Foto tidak bisa dibaca — coba ulang 📸', 'error', 2500);
    img.src = e.target.result;
  };
  reader.onerror = () => showToast('Gagal membaca file foto', 'error', 2500);
  reader.readAsDataURL(file);
}

export function toggleOrderType(tipe) {
  setOrderType(tipe);
  // v158 (laporan bug pemilik): tipe pesanan itu properti TRANSAKSI, bukan
  // properti item. Item yang sudah masuk keranjang ikut bermigrasi ke tipe baru
  // supaya tidak ada lagi harga ojol nyangkut di pesanan Dine-in (dan sebaliknya).
  if (Object.keys(cart).length > 0) {
    const migrated = {};
    Object.entries(cart).forEach(([k, v]) => { migrated[k] = { ...v, orderType: tipe }; });
    setCart(migrated);
    saveCart();
  }
  // Pesanan Ojol dibayar lewat aplikasi/QRIS, jadi metode bayar otomatis ikut
  // terpilih QRIS (permintaan 2026-09-01). setPaymentMethod sudah menjaga:
  // bila opsi QRIS dimatikan di Pengaturan, metode tidak dipaksa berubah.
  // Saat pindah tipe, metode bayar ikut di-set default (v151 komentar browser):
  // ojol → QRIS (dibayar lewat aplikasi), dine-in & take-away → Tunai.
  // setPaymentMethod sudah menjaga: opsi yang dimatikan di Pengaturan tidak
  // dipaksa berubah.
  if (tipe === 'ojol') setPaymentMethod('qris');
  else setPaymentMethod('tunai');
  // Feedback visual: tombol tipe terpilih = primary, lainnya ghost
  const box = document.getElementById('orderTypeButtons');
  if (box) {
    box.querySelectorAll('button[data-tipe]').forEach(b => {
      const active = b.dataset.tipe === tipe;
      b.classList.toggle('btn-primary', active);
      b.classList.toggle('btn-ghost', !active);
    });
  }
  // Tampilkan kotak catatan dengan placeholder sesuai tipe terpilih
  renderOrderNoteBox();
  // Re-render grid agar harga sesuai tipe (mis. hargaOjol saat pilih Ojol)
  import('./pos.js').then(({ renderPOSMenu }) => renderPOSMenu()).catch(() => {});
  // Total di cart bar & modal ikut tipe BARU — dulu cuma grid yang disegarkan,
  // jadi cart bar masih menampilkan harga tipe sebelumnya sampai cart berubah.
  renderCartBar();
  refreshCartModalTotals();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function hargaPerItem(item) {
  return hargaEfektif(item, orderType, ojolPlatform);
}

// Total satu baris cart: harga dasar × qty + Σ (topping_i × qty_topping_i).
// Qty topping independen per-topping (tiap opsi punya stepper sendiri).
// Mis. nasi 2 + telur dadar 1, ayam goreng 2 → (5000*2) + (3000*1) + (5000*2) = 23.000.
export function lineTotal(item) {
  // Delegasi ke logic: harga ojol ikut app terpilih (order-follow).
  return lineTotalLogic(item, orderType, ojolPlatform);
}

function hargaDineIn(item) {
  return hargaEfektif(item, 'dine-in');
}

function hargaOjol(item) {
  return getOjolPrice(item.menu, ojolPlatform);
}

function renderAvailableToppings(menuId) {
  const item = cart[menuId];
  if (!item) return;
  const toppings = parseToppings(item.menu.toppingList);
  const selectedNames = new Set((item.selectedToppings || []).map(t => t.nama));
  const qtys = item.toppingQtys || {};
  document.getElementById('toppingList').innerHTML = toppings.length === 0
    ? '<div class="kfs12 kgray">Menu ini belum ada topping.</div>'
    : toppings.map(t => {
        const checked = selectedNames.has(t.nama);
        const q = Math.max(1, parseInt(qtys[t.nama], 10) || 1);
        return `
        <label class="topping-option-row" data-nama="${escapeHtml(t.nama)}" data-harga="${t.harga}">
          <input type="checkbox" data-action="topping-toggle" data-scope="cart" data-nama="${escapeHtml(t.nama)}" data-harga="${t.harga}" ${checked?'checked':''}>
          <span class="topping-name">${escapeHtml(t.nama)}</span>
          <span class="topping-harga">${formatRp(t.harga)}</span>
          <span class="topping-stepper" data-scope="cart" data-nama="${escapeHtml(t.nama)}" style="display:${checked?'inline-flex':'none'}">
            <button type="button" class="btn btn-sm btn-ghost" data-action="topping-qty" data-scope="cart" data-nama="${escapeHtml(t.nama)}" data-delta="-1" aria-label="Kurangi ${escapeHtml(t.nama)}">−</button>
            <input type="number" class="ms-qty-input topping-qty-input" data-scope="cart" data-nama="${escapeHtml(t.nama)}" min="1" max="99" value="${q}" inputmode="numeric" aria-label="Jumlah ${escapeHtml(t.nama)}" style="width:42px">
            <button type="button" class="btn btn-sm btn-ghost" data-action="topping-qty" data-scope="cart" data-nama="${escapeHtml(t.nama)}" data-delta="1" aria-label="Tambah ${escapeHtml(t.nama)}">＋</button>
          </span>
        </label>
      `;
      }).join('');
}

// ── Category tabs ────────────────────────────────────────────────────────────
export function renderPOSCatTabsUI(menus) {
  const box = document.getElementById('posCatTabs');
  // #posCatTabs dihapus dari layout — kategori hanya ada di accordion
  if (!box) {
    renderPOSCatAccordion(menus);
    return;
  }
  const cats = ['Semua', ...new Set(menus.map(m => m.kategori))];
  box.innerHTML = cats.map(c =>
    `<div class="cat-tab ${c===posCat?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c==='Semua'?'📋 Semua':c==='Makanan'?'🍚 Makanan':c==='Minuman'?'🥤 Minuman':c==='Snack'?'🍢 Snack':'📦 '+c)}</div>`
  ).join('');
  ensurePosCatDelegation(box);
  // Juga render isi accordion agar selalu sinkron
  renderPOSCatAccordion(menus);
}

export function renderPOSCatAccordion(menus) {
  const box = document.getElementById('posCatAccordionInner');
  if (!box) return;
  const cats = ['Semua', ...new Set(menus.map(m => m.kategori))];
  box.innerHTML = cats.map(c =>
    `<button class="btn btn-sm ${posCat===c?'btn-primary':'btn-ghost'}"
            data-cat="${escapeHtml(c)}">${escapeHtml(c==='Semua'?'📋 Semua':c==='Makanan'?'🍚 Makanan':c==='Minuman'?'🥤 Minuman':c==='Snack'?'🍢 Snack':'📦 '+c)}</button>`
  ).join('');
  // Klik kategori di accordion → pilih kategori (accordion TETAP TERBUKA,
  // ditutup manual via tombol Kategori)
  box.onclick = async (e) => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    try {
      const { selectPosCat } = await import('./pos.js');
      selectPosCat(btn.dataset.cat || 'Semua');
    } catch (err) {
      console.error('[POS] accordion cat click:', err?.message || err);
    }
  };
}

// T18 (audit 2026-08-17/M8): klik kategori via delegasi data-cat — mengganti
// pola lama onclick="selectPosCat('...')" yang meng-interpolasi string mentah
// ke atribut event (rapuh; cukup untuk merusak handler via kategori hasil
// impor cadangan buatan).
let _posCatDelegated = false;
function ensurePosCatDelegation(box) {
  if (_posCatDelegated) return;
  _posCatDelegated = true;
  box.addEventListener('click', async (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const el = t && t.closest('.cat-tab[data-cat]');
    if (!el) return;
    try {
      const { selectPosCat } = await import('./pos.js');
      selectPosCat(el.dataset.cat || 'Semua');
    } catch (err) {
      console.error('[POS] cat tab delegation:', err?.message || err);
    }
  });
}

// ── Menu grid ────────────────────────────────────────────────────────────────
export function renderPOSMenuUI(menus) {
  const grid = document.getElementById('posMenuGrid');
  if (!menus || menus.length === 0) {
    // Pesan kosong kontekstual: mode Ojol tanpa menu ber-harga Ojol → pandu
    // user ke konfigurasi Harga Ojol, bukan "Belum ada menu" yang menyesatkan.
    grid.innerHTML = orderType === 'ojol'
      ? '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🛵</div><div class="empty-text">Belum ada menu dengan Harga Ojol.<br>Atur Harga Ojol menu di tab Menu dulu ya!</div></div>'
      : '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🍽️</div><div class="empty-text">Belum ada menu.<br>Tambah di tab Menu dulu ya!</div></div>';
    return;
  }

  const catEmoji = {Makanan:'🍚',Minuman:'🥤',Snack:'🍢',Lainnya:'📦'};
  grid.innerHTML = menus.map(m => {
    const qty = cart[m.id] ? cart[m.id].qty : 0;
    const displayHarga = orderType === 'ojol' ? getOjolPrice(m, ojolPlatform) : m.hargaJual;
    const habis = !!m.pakaiStok && (m.stok || 0) <= 0;
    const titipan = (m.suplayer || 'Umum') !== 'Umum'; // 🧾 barang titipan konsinyasi
    return `<div class="menu-item ${qty>0?'selected':''} ${habis?'sold-out':''}" data-action="add-to-cart" data-menu-id="${m.id}">
      ${qty > 0 ? `<div class="item-qty">${qty}</div>` : ''}
      ${m.pakaiStok ? `<div class="item-stok${habis ? ' habis' : ''}" title="Sisa stok">${m.stok || 0}</div>` : ''}
      <span class="item-emoji">${escapeHtml(catEmoji[m.kategori]||'🍽️')}</span>
      <div class="item-name">${escapeHtml(m.nama)}</div>
      <div class="item-price">${formatRp(displayHarga)}</div>
      <div class="item-badges">
        ${titipan ? '<span class="item-titipan" title="Barang titipan">🧾</span>' : ''}
        ${parseToppings(m.toppingList).length > 0 ? '<span class="item-topping">🧂</span>' : ''}
        ${menuHasOjol(m) ? '<span class="item-ojol">🛵</span>' : ''}
        ${habis ? '<span class="item-habis">Habis</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Cart bar (bottom strip) ──────────────────────────────────────────────────
export function renderCartBar() {
  const bar = document.getElementById('cartBar');
  const items = Object.values(cart);
  const totalQty = items.reduce((a,c) => a + c.qty, 0);
  const totalPrice = items.reduce((a,c) => a + lineTotal(c), 0);

  if (totalQty > 0) {
    bar.style.display = 'flex';
    document.getElementById('cartCount').textContent = totalQty + ' item';
    document.getElementById('cartTotal').textContent = formatRp(totalPrice);
  } else {
    bar.style.display = 'none';
  }
}

// ── Cart modal ───────────────────────────────────────────────────────────────
// Kunci draft catatan GLOBAL per transaksi — agar tidak hilang saat refresh/PWA.
export const GLOBAL_NOTE_KEY = 'kasirsolo:order-note';

export async function openCartModal() {
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) return;

  // Header keranjang: label tipe pesanan DIBESARKAN + nama app ojol yang ditarik
  // dari pilihan "Pilih app" (komentar browser #3), plus kotak catatan GLOBAL per
  // transaksi untuk nama driver / no. orderan ojol / dll (#4).
  const typeLabelEl = document.getElementById('cartOrderTypeLabel');
  if (typeLabelEl) {
    const baseLabel = orderType === 'ojol' ? '🛵 Ojol'
      : orderType === 'takeaway' ? '🥡 Take-away' : '🍽️ Dine-in';
    const app = orderType === 'ojol' ? (ojolPlatform || '').trim() : '';
    typeLabelEl.innerHTML = escapeHtml(baseLabel)
      + (app ? ` <span class="cart-order-app">· ${escapeHtml(app)}</span>` : '');
  }
  const globalNoteEl = document.getElementById('globalNoteInput');
  if (globalNoteEl && !globalNoteEl.value) {
    try { globalNoteEl.value = localStorage.getItem(GLOBAL_NOTE_KEY) || ''; } catch (_) {}
  }
  renderOrderNoteBox(); // placeholder catatan global mengikuti tipe aktif

  const box = document.getElementById('cartItems');

  box.innerHTML = items.map(c => {
    const toppings = parseToppings(c.menu.toppingList);
    const hasToppings = toppings.length > 0;
    const totalLine = lineTotal(c);
    const selected = c.selectedToppings || [];
    const qtys = normalizeToppingQtys(c);
    // Tampilkan harga sesuai tipe order (bukan harga jual default).
    // Mode ojol: harga ikut app terpilih (order-follow).
    const displayHargaTipe = orderType === 'ojol'
      ? formatRp(getOjolPrice(c.menu, ojolPlatform))
      : formatRp(c.menu.hargaJual);
    // Topping tags dengan qty per-topping (di dalam baris nama menu)
    const toppingTags = hasToppings && selected.length > 0
      ? '<div class="cart-topping-tags" style="margin-left:6px">' + selected.map(t => {
          const tq = Math.max(1, parseInt(qtys[t.nama], 10) || 1);
          return `<span class="topping-tag">+ ${escapeHtml(t.nama)} <b>×${tq}</b> <span class="kgray">${formatRp(t.harga * tq)}</span></span>`;
        }).join('') + '</div>'
      : '';
    return `<div class="cart-item" data-menu-id="${c.menu.id}">
      <div class="cart-info">
        <div class="cart-name-row">
          <span class="cart-name">${escapeHtml(c.menu.nama)}` +
          (c.menu.suplayer && c.menu.suplayer !== 'Umum' ? '<span class="badge-titipan">Titipan</span>' : '') +
          (c.menu.pakaiStok ? `<span class="badge-stok${(c.menu.stok || 0) <= 0 ? ' badge-stok-habis' : ''}">📦 ${c.menu.stok}</span>` : '') +
          `</span>
          <span class="cart-name-price" title="Harga satuan">${displayHargaTipe}</span>
          ${toppingTags}
        </div>
        ${(c.catatanItem || '').trim() ? `<div class="cart-item-note">📝 ${escapeHtml((c.catatanItem || '').trim())}</div>` : ''}
      </div>
      <div class="cart-qty-price">
        <div class="qty-control">
          <button class="qty-btn" data-action="change-qty" data-menu-id="${c.menu.id}" data-delta="-1" aria-label="Kurangi jumlah">−</button>
          <input type="number" class="qty-val" data-action="cart-qty-input" data-menu-id="${c.menu.id}" min="1" max="999" value="${c.qty}" inputmode="numeric" aria-label="Jumlah">
          <button class="qty-btn" data-action="change-qty" data-menu-id="${c.menu.id}" data-delta="1" aria-label="Tambah jumlah">+</button>
        </div>
        <div class="cart-price">${formatRp(totalLine)}</div>
      </div>
    </div>`}).join('');

  // Topping selector panel (tersembunyi sampai dipanggil)
  const sel = document.getElementById('toppingSelector');
  if (sel) sel.style.display = 'none';

  const total = calculateTotalUI(items);
  document.getElementById('cartModalTotal').textContent = formatRp(total);

  // Metode pembayaran (komentar browser #5): non-tunai → sembunyikan blok tunai
  // dan isi panel QRIS/rekening; tunai → auto-fill nominal + preset + kembalian.
  if (applyPayMethodUI()) {
    renderNonCashPay(total);
  } else {
    document.getElementById('bayarInput').value = total.toLocaleString('id-ID');
    const presets = generatePresetNominal(total);
    document.getElementById('presetBayarContainer').innerHTML = presets.map(p =>
      `<button class="btn btn-sm btn-ghost kfs12" data-action="set-nominal-bayar" data-nominal="${p}">${p.toLocaleString('id-ID')}</button>`
    ).join('');
    hitungKembalianUI(total, total);
  }
  await openModal('cartModal');
}

function calculateTotalUI(items) {
  return items.reduce((sum, c) => sum + lineTotal(c), 0);
}

// Update harga per-baris, total, nominal bayar & preset TANPA rebuild daftar
// cart — dipakai saat qty diedit lewat input manual agar fokus ketikan tidak hilang.
export function refreshCartModalTotals() {
  const box = document.getElementById('cartItems');
  if (!box) return;
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) return;

  box.querySelectorAll('.cart-item').forEach(row => {
    const c = cart[Number(row.dataset.menuId)];
    const priceEl = row.querySelector('.cart-price');
    if (!c || !priceEl) return;
    priceEl.textContent = formatRp(lineTotal(c));
  });

  const total = calculateTotalUI(items);
  document.getElementById('cartModalTotal').textContent = formatRp(total);

  // Non-tunai: nominal bayar tidak dipakai — cukup perbarui panel QRIS/rekening.
  if (applyPayMethodUI()) {
    renderNonCashPay(total);
    return;
  }

  const bayarInput = document.getElementById('bayarInput');
  bayarInput.value = total.toLocaleString('id-ID');

  const presets = generatePresetNominal(total);
  document.getElementById('presetBayarContainer').innerHTML = presets.map(p =>
    `<button class="btn btn-sm btn-ghost kfs12" data-action="set-nominal-bayar" data-nominal="${p}">${p.toLocaleString('id-ID')}</button>`
  ).join('');

  const bayarVal = (bayarInput.value || '').replace(/\D/g, '');
  hitungKembalianUI(total, bayarVal ? parseInt(bayarVal, 10) : 0);
}

// Kosongkan keranjang TANPA menyimpan penjualan (komentar browser v147).
// Pola reset disamakan dengan akhir `simpanPenjualan` (pos.js:370-379): cart={},
// localStorage.cart dihapus, catatan GLOBAL & bukti bayar di-reset, render
// ulang. TIDUP menutup modal — biar kasir bisa tetap di halaman POS.
export function clearCart() {
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) {
    showToast('Keranjang sudah kosong', 'info');
    return;
  }
  setCart({});
  try { clearCartStorage(); } catch (_) {}
  // v154: kosongkan cart = tutup "sesi buka" — row held-nya TETAP ada di daftar,
  // tinggal dibuka lagi kapan pun.
  setResumedHeldId(null);
  const noteInput = document.getElementById('globalNoteInput');
  if (noteInput) noteInput.value = '';
  try { localStorage.removeItem(GLOBAL_NOTE_KEY); } catch (_) {}
  removePayProof();
  const payNoteEl = document.getElementById('payNoteInput');
  if (payNoteEl) payNoteEl.value = '';
  closeCartModal();
  renderCartBar();
  renderPOSMenu();
  showToast(`🗑️ ${items.length} item dihapus dari keranjang`);
}

export function closeCartModal() {
  _toppingTargetMenuId = null;
  const sel = document.getElementById('toppingSelector');
  if (sel) sel.style.display = 'none';
  document.querySelectorAll('.cart-item').forEach(el => el.classList.remove('topping-editing'));
  closeModal('cartModal');
}

export function hitungKembalianUI(total, bayar) {
  const box = document.getElementById('kembalianBox');
  box.style.display = 'flex';
  document.getElementById('kembalianVal').textContent =
    (bayar >= total && bayar > 0) ? formatRp(bayar - total) : 'Rp 0';
}

export function formatBayarInputUI() {
  const input = document.getElementById('bayarInput');
  let value = input.value.replace(/\D/g, '');
  if (value === '') { input.value = ''; return; }
  input.value = parseInt(value).toLocaleString('id-ID');
}

export function selectAllBayarInput() {
  const input = document.getElementById('bayarInput');
  input.select();
}

export function setNominalBayarUI(nominal) {
  const input = document.getElementById('bayarInput');
  input.value = nominal.toLocaleString('id-ID');
}

export function showAfterSaleActions() {
  const afterActions = document.getElementById('afterSaleActions');
  if (afterActions) {
    afterActions.style.display = 'block';
    setTimeout(() => { afterActions.style.display = 'none'; }, 15000);
  }
}

// ==================== FITUR "TAHAN" (v148, 2026-09-01) ====================
// Lihat pos.js (holdOrder/resumeHeldOrder/payHeldOrder/deleteHeldOrder) untuk
// orkestrasi DB+state. Modul ini DOM-only: render FAB badge + modal daftar.
// Pemisahan sesuai arsitektur: pos.ui.js = DOM, pos.js = DB + state.

// ── FAB visibility + badge counter ───────────────────────────────────────
// Dipanggil setelah hold/resume/pay/delete dari pos.js.
export async function updateHeldFab(n) {
  const fab = document.getElementById('heldFab');
  const badge = document.getElementById('heldFabBadge');
  if (!fab || !badge) return;
  if (typeof n !== 'number') return; // pemanggil harus sediakan count
  if (n > 0) {
    fab.classList.add('show');
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.style.display = 'flex';
  } else {
    fab.classList.remove('show');
    badge.style.display = 'none';
  }
}

// ── Render modal daftar held (rows = array of penjualan.status='held') ──
// UI murni: pos.js pre-fetch rows via listHeldSync, lalu panggil ini.
// v151 komentar browser #3: baris di-cache di modul supaya input pencarian
// bisa memfilter live tanpa query DB ulang; cache & input direset tiap modal dibuka.
let _heldRowsCache = [];
export function renderHeldListModal(rows) {
  _heldRowsCache = rows || [];
  const inp = document.getElementById('heldSearchInput');
  if (inp) inp.value = '';
  renderHeldRows();
  openModal('heldListModal');
}

// Pencarian held (komentar browser #3): cocokkan catatan pesanan (heldName),
// nomor transaksi, nama menu, catatan transaksi, dan tipe pesanan.
function heldMatchesQuery(r, q) {
  if (!q) return true;
  const hay = [
    r.heldName, r.nomor, r.orderNote,
    (r.items || []).map(i => i.nama).join(' '),
    r.orderType === 'ojol' ? 'ojol ' + (r.ojolPlatform || '')
      : r.orderType === 'takeaway' ? 'take-away takeaway' : 'dine-in dine'
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function renderHeldRows() {
  const box = document.getElementById('heldListBody');
  if (!box) return;
  if (_heldRowsCache.length === 0) {
    box.innerHTML = `<div class="empty-state"><div class="empty-icon">🤚</div><div class="empty-text">Belum ada pesanan yang ditahan.<br>Ketuk 🤚 Tahan di bawah keranjang untuk menyimpan pesanan yang belum dibayar.</div></div>`;
    return;
  }
  const q = String(document.getElementById('heldSearchInput')?.value || '').trim().toLowerCase();
  const rows = q ? _heldRowsCache.filter(r => heldMatchesQuery(r, q)) : _heldRowsCache;
  if (rows.length === 0) {
    box.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Tidak ada pesanan yang cocok dengan pencarian.</div></div>`;
    return;
  }
  box.innerHTML = rows.map(r => renderHeldRow(r)).join('');
}

// v151 komentar browser #3: filter live daftar held saat user mengetik.
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'heldSearchInput') renderHeldRows();
});

function renderHeldRow(r) {
  const tgl = new Date(r.waktu || Date.now());
  const tglLabel = tgl.toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  const itemCount = (r.items || []).reduce((s, i) => s + (i.qty || 0), 0);
  const itemSummary = (r.items || []).slice(0, 3).map(i => escapeHtml(i.nama)).join(', ')
    + ((r.items || []).length > 3 ? ` +${r.items.length - 3}` : '');
  const typeLabel = r.orderType === 'ojol' ? '🛵 ' + (r.ojolPlatform || 'Ojol')
    : r.orderType === 'takeaway' ? '🥡 Take-away' : '🍽️ Dine-in';
  const nameBadge = r.heldName ? `<span class="held-name-badge">${escapeHtml(r.heldName)}</span>` : '';
  // v151 komentar browser #4+#5: tombol "Buka" dihapus — SELURUH kartu bisa
  // diklik untuk membuka pesanan (data-action di .held-row). Tombol hapus tetap:
  // closest('[data-action]') menemukan tombol lebih dulu sebelum kartu.
  return `
    <div class="held-row" data-action="resume-held" data-held-id="${r.id}">
      <div class="held-row-main">
        <div class="held-row-head">
          <div class="held-row-title">${nameBadge}<span class="held-row-type">${typeLabel}</span></div>
        </div>
        <div class="held-row-meta">${itemCount} item · ${escapeHtml(itemSummary)}</div>
        <div class="held-row-time">⏱ ${tglLabel}${r.nomor ? ' · ' + escapeHtml(r.nomor) : ''}</div>
        ${''/* v157 #1: baris catatan dihapus, judul kartu sudah memuatnya */}
      </div>
      <div class="held-row-actions">
        <div class="held-row-total">${formatRp(r.totalHarga || 0)}</div>
        <button type="button" class="btn btn-ghost btn-sm held-row-delete" data-action="delete-held" data-held-id="${r.id}" title="Hapus pesanan ditahan" aria-label="Hapus">🗑️</button>
      </div>
    </div>
  `;
}