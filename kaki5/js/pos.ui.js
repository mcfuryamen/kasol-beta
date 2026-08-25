// ==================== POS UI (ESM) ====================
// DOM operations only. No DB access. No state mutations.

import { escapeHtml, formatRp } from './helpers.js';
import { cart, posCat, orderType, setOrderType, setCart } from './app-state.js';
import { generatePresetNominal, parseToppings, toppingHarga, hargaEfektif } from './pos.logic.js';
import { openModal, closeModal } from './modal.js';

let _toppingTargetMenuId = null; // menuId yang topping-nya sedang dipilih (di cart)

// ── Selector topping + jumlah SEBELUM masuk keranjang ───────────────────────
let _menuSelectorOnConfirm = null;
let _menuSelectorOrderType = 'dine-in';
let _menuSelectorQty = 1;

export function openMenuSelector(menu, onConfirm) {
  _menuSelectorOnConfirm = onConfirm;
  _menuSelectorOrderType = orderType;
  _menuSelectorQty = 1;

  const toppings = parseToppings(menu.toppingList);
  const hasOjol = (menu.hargaOjol || 0) > 0;
  const body = document.getElementById('menuSelectorBody');
  if (!body) return;

  body.innerHTML = `
    <div class="kmb12">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div class="kfw600 ktext2">${escapeHtml(menu.nama)}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <button type="button" class="btn btn-sm btn-ghost" data-action="menu-selector-qty" data-delta="-1" style="width:36px;min-width:36px">−</button>
          <input type="number" id="menuSelectorQty" class="ms-qty-input" min="1" max="99" value="1" inputmode="numeric" aria-label="Jumlah">
          <button type="button" class="btn btn-sm btn-ghost" data-action="menu-selector-qty" data-delta="1" style="width:36px;min-width:36px">＋</button>
        </div>
      </div>
      ${toppings.length > 0 ? `
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0">
      <div class="kfw600 ktext2 kmb8">Pilih Topping</div>
      <div id="menuSelectorToppings">
        ${toppings.map(t => `
          <label class="topping-option">
            <input type="checkbox" data-nama="${escapeHtml(t.nama)}" data-harga="${t.harga}">
            <span>${escapeHtml(t.nama)}</span>
            <span class="kright">${formatRp(t.harga)}</span>
          </label>
        `).join('')}
      </div>
      ` : ''}
    </div>
  `;

  openModal('menuSelectorModal');
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

export function confirmMenuSelector() {
  // Baca jumlah dari input manual (fallback ke state stepper kalau kosong/tidak valid)
  const qtyEl = document.getElementById('menuSelectorQty');
  const typed = parseInt(qtyEl?.value, 10);
  if (!Number.isNaN(typed)) _menuSelectorQty = Math.min(99, Math.max(1, typed));

  const cbs = document.querySelectorAll('#menuSelectorToppings input[type="checkbox"]');
  const selected = [];
  cbs.forEach(cb => {
    if (cb.checked) {
      const nama = cb.dataset.nama || '';
      const harga = parseInt(cb.dataset.harga) || 0;
      if (nama) selected.push({ nama, harga });
    }
  });
  const activeBtn = document.querySelector('#menuSelectorOrderBtns .btn-primary');
  const tipe = activeBtn?.dataset?.tipe || _menuSelectorOrderType || 'dine-in';
  if (_menuSelectorOnConfirm) {
    _menuSelectorOnConfirm({ selectedToppings: selected, orderType: tipe, qty: _menuSelectorQty });
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
  cbs.forEach(cb => {
    if (cb.checked) {
      const nama = cb.dataset.nama || '';
      const harga = parseInt(cb.dataset.harga) || 0;
      if (nama) selected.push({ nama, harga });
    }
  });
  const next = { ...cart };
  if (next[_toppingTargetMenuId]) {
    next[_toppingTargetMenuId] = {
      ...next[_toppingTargetMenuId],
      selectedToppings: selected
    };
    setCart(next);
  }
  _toppingTargetMenuId = null;
  const sel = document.getElementById('toppingSelector');
  if (sel) sel.style.display = 'none';
  document.querySelectorAll('.cart-item').forEach(el => el.classList.remove('topping-editing'));
  openCartModal(); // re-render cart dengan harga baru
}

// ── Catatan pesanan (akordeon di bawah tombol tipe order) ──────────────────
const ORDER_NOTE_PLACEHOLDER = {
  'dine-in': '🍽️ Catatan: nomor meja, nama pemesan…',
  'takeaway': '🥡 Catatan: nama pemesan, jam ambil…',
  'ojol': '🛵 Catatan: GoFood / GrabFood / ShopeeFood…'
};

export function renderOrderNoteBox() {
  const box = document.getElementById('orderNoteBox');
  if (!box) return;
  box.style.display = 'block';
  const input = document.getElementById('orderNoteInput');
  if (input) input.placeholder = ORDER_NOTE_PLACEHOLDER[orderType] || ORDER_NOTE_PLACEHOLDER['dine-in'];
}

export function toggleOrderType(tipe) {
  setOrderType(tipe);
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
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function hargaPerItem(item) {
  return hargaEfektif(item, orderType);
}

function hargaDineIn(item) {
  return hargaEfektif(item, 'dine-in');
}

function hargaOjol(item) {
  return hargaEfektif(item, 'ojol');
}

function renderAvailableToppings(menuId) {
  const item = cart[menuId];
  if (!item) return;
  const toppings = parseToppings(item.menu.toppingList);
  const checkedNames = new Set((item.selectedToppings || []).map(t => t.nama));
  document.getElementById('toppingList').innerHTML = toppings.length === 0
    ? '<div class="kfs12 kgray">Menu ini belum ada topping.</div>'
    : toppings.map(t => `
        <label class="topping-option">
          <input type="checkbox" data-nama="${escapeHtml(t.nama)}" data-harga="${t.harga}" ${checkedNames.has(t.nama)?'checked':''}>
          <span>${escapeHtml(t.nama)}</span>
          <span class="kright">${formatRp(t.harga)}</span>
        </label>
      `).join('');
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
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🍽️</div><div class="empty-text">Belum ada menu.<br>Tambah di tab Menu dulu ya!</div></div>';
    return;
  }

  const catEmoji = {Makanan:'🍚',Minuman:'🥤',Snack:'🍢',Lainnya:'📦'};
  grid.innerHTML = menus.map(m => {
    const qty = cart[m.id] ? cart[m.id].qty : 0;
    const displayHarga = (orderType === 'ojol' && m.hargaOjol > 0) ? m.hargaOjol : m.hargaJual;
    return `<div class="menu-item ${qty>0?'selected':''}" data-action="add-to-cart" data-menu-id="${m.id}">
      ${qty > 0 ? `<div class="item-qty">${qty}</div>` : ''}
      <span class="item-emoji">${escapeHtml(catEmoji[m.kategori]||'🍽️')}</span>
      <div class="item-name">${escapeHtml(m.nama)}</div>
      <div class="item-price">${formatRp(displayHarga)}</div>
      <div class="item-badges">
        ${parseToppings(m.toppingList).length > 0 ? '<span class="item-topping">🧂</span>' : ''}
        ${m.hargaOjol > 0 ? '<span class="item-ojol">🛵</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Cart bar (bottom strip) ──────────────────────────────────────────────────
export function renderCartBar() {
  const bar = document.getElementById('cartBar');
  const items = Object.values(cart);
  const totalQty = items.reduce((a,c) => a + c.qty, 0);
  const totalPrice = items.reduce((a,c) => a + hargaPerItem(c) * c.qty, 0);

  if (totalQty > 0) {
    bar.style.display = 'block';
    document.getElementById('cartCount').textContent = totalQty + ' item';
    document.getElementById('cartTotal').textContent = formatRp(totalPrice);
  } else {
    bar.style.display = 'none';
  }
}

// ── Cart modal ───────────────────────────────────────────────────────────────
export async function openCartModal() {
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) return;

  const box = document.getElementById('cartItems');

  box.innerHTML = items.map(c => {
    const toppings = parseToppings(c.menu.toppingList);
    const hasToppings = toppings.length > 0;
    const pricePerItem = hargaPerItem(c);
    const totalLine = pricePerItem * c.qty;
    const selected = c.selectedToppings || [];
    // Tampilkan harga sesuai tipe order (bukan harga jual default)
    const displayHargaTipe = c.orderType === 'ojol' && c.menu.hargaOjol > 0
      ? formatRp(c.menu.hargaOjol)
      : formatRp(c.menu.hargaJual);
    const tipeLabel = c.orderType === 'ojol' ? '🛵 Ojol'
      : c.orderType === 'takeaway' ? '🥡 Take-away' : '🍽️ Dine-in';
    return `<div class="cart-item" data-menu-id="${c.menu.id}">
      <div class="cart-info">
        <div class="cart-name">${escapeHtml(c.menu.nama)} <span class="cart-name-price">${displayHargaTipe}</span></div>
        <div class="cart-meta">${tipeLabel}${hasToppings && selected.length > 0 ? ' · ' + selected.map(t => escapeHtml(t.nama) + ' ' + formatRp(t.harga)).join(', ') : ''}</div>
      </div>
      <div class="cart-qty-price">
        <div class="qty-control">
          <button class="qty-btn" data-action="change-qty" data-menu-id="${c.menu.id}" data-delta="-1">−</button>
          <input type="number" class="qty-val" data-action="cart-qty-input" data-menu-id="${c.menu.id}" min="1" max="999" value="${c.qty}" inputmode="numeric" aria-label="Jumlah">
          <button class="qty-btn" data-action="change-qty" data-menu-id="${c.menu.id}" data-delta="1">+</button>
        </div>
        <div class="cart-price">${formatRp(totalLine)}</div>
      </div>
    </div>`}).join('');

  // Topping selector panel (tersembunyi sampai dipanggil)
  const sel = document.getElementById('toppingSelector');
  if (sel) sel.style.display = 'none';

  document.getElementById('cartModalTotal').textContent = formatRp(calculateTotalUI(items));

  // Auto-fill nominal dengan total harga
  document.getElementById('bayarInput').value = items.length > 0
    ? calculateTotalUI(items).toLocaleString('id-ID') : '0';

  const presets = generatePresetNominal(calculateTotalUI(items));
  document.getElementById('presetBayarContainer').innerHTML = presets.map(p =>
    `<button class="btn btn-sm btn-ghost kfs12" data-action="set-nominal-bayar" data-nominal="${p}">${p.toLocaleString('id-ID')}</button>`
  ).join('');

  const totalForKembalian = calculateTotalUI(items);
  hitungKembalianUI(items.length > 0 ? totalForKembalian : 0, items.length > 0 ? totalForKembalian : 0);
  await openModal('cartModal');
}

function calculateTotalUI(items) {
  return items.reduce((sum, c) => sum + hargaPerItem(c) * c.qty, 0);
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
    priceEl.textContent = formatRp(hargaPerItem(c) * c.qty);
  });

  const total = calculateTotalUI(items);
  document.getElementById('cartModalTotal').textContent = formatRp(total);

  const bayarInput = document.getElementById('bayarInput');
  bayarInput.value = total.toLocaleString('id-ID');

  const presets = generatePresetNominal(total);
  document.getElementById('presetBayarContainer').innerHTML = presets.map(p =>
    `<button class="btn btn-sm btn-ghost kfs12" data-action="set-nominal-bayar" data-nominal="${p}">${p.toLocaleString('id-ID')}</button>`
  ).join('');

  const bayarVal = (bayarInput.value || '').replace(/\D/g, '');
  hitungKembalianUI(total, bayarVal ? parseInt(bayarVal, 10) : 0);
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