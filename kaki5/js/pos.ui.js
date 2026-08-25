// ==================== POS UI (ESM) ====================
// DOM operations only. No DB access. No state mutations.

import { escapeHtml, formatRp } from './helpers.js';
import { cart, posCat, orderType, setOrderType } from './app-state.js';
import { generatePresetNominal } from './pos.logic.js';
import { parseToppings, toppingHarga, hargaEfektif } from './pos.logic.js';
import { openModal, closeModal } from './modal.js';
import { setCart } from './app-state.js';

let _toppingTargetMenuId = null; // menuId yang topping-nya sedang dipilih

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

export function toggleOrderType(tipe) {
  setOrderType(tipe);
  openCartModal(); // refresh cart + totals
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
  const cats = ['Semua', ...new Set(menus.map(m => m.kategori))];
  box.innerHTML = cats.map(c =>
    `<div class="cat-tab ${c===posCat?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c==='Semua'?'📋 Semua':c==='Makanan'?'🍚 Makanan':c==='Minuman'?'🥤 Minuman':c==='Snack'?'🍢 Snack':'📦 '+c)}</div>`
  ).join('');
  ensurePosCatDelegation(box);
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
    const hasToppings = m.toppingList && JSON.parse(m.toppingList || '[]').length > 0;
    const displayHarga = (orderType === 'ojol' && m.hargaOjol > 0) ? m.hargaOjol : m.hargaJual;
    return `<div class="menu-item ${qty>0?'selected':''} ${hasToppings?'has-toppings':''}" data-action="add-to-cart" data-menu-id="${m.id}">
      ${qty > 0 ? `<div class="item-qty">${qty}</div>` : ''}
      <span class="item-emoji">${escapeHtml(catEmoji[m.kategori]||'🍽️')}</span>
      <div class="item-name">${escapeHtml(m.nama)}${hasToppings ? '<span class="topping-dot">＋</span>' : ''}</div>
      <div class="item-price">${formatRp(displayHarga)}${m.hargaOjol > 0 ? '<span class="ojol-tag">Ojol</span>' : ''}</div>
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

  // Tipe order buttons
  const otContainer = document.getElementById('orderTypeButtons');
  if (otContainer) {
    otContainer.innerHTML = ['dine-in','takeaway','ojol'].map(t => `
      <button class="btn btn-sm ${orderType===t ? 'btn-primary':'btn-ghost'}"
              data-action="switch-order-type" data-tipe="${t}"
              onclick="window._ksr_toggleOrderType && window._ksr_toggleOrderType('${t}')">
        ${t==='dine-in'?'🍽️ Dine-in':t==='takeaway'?'🥡 Take-away':'🛵 Ojol'}
      </button>
    `).join('');
  }

  box.innerHTML = items.map(c => {
    const toppings = parseToppings(c.menu.toppingList);
    const hasToppings = toppings.length > 0;
    const pricePerItem = hargaPerItem(c);
    const totalLine = pricePerItem * c.qty;
    const selected = c.selectedToppings || [];
    const toppingTotal = selected.reduce((s, t) => s + t.harga, 0);
    return `<div class="cart-item" data-menu-id="${c.menu.id}">
      <div class="cart-name-row">
        <div class="cart-name">${escapeHtml(c.menu.nama)}</div>
        ${c.orderType === 'ojol' && c.menu.hargaOjol > 0
          ? `<span class="ojol-badge">🛵 Ojol</span>`
          : ''}
      </div>
      ${hasToppings ? `
        <div class="cart-toppings">
          ${selected.length === 0
            ? `<button class="btn btn-xs btn-ghost" data-action="select-topping" data-menu-id="${c.menu.id}" onclick="window.selectTopping && window.selectTopping('${c.menu.id}')">＋ Pilih Topping</button>`
            : selected.map(t => `
                <span class="topping-tag">
                  ${escapeHtml(t.nama)} ${formatRp(t.harga)}
                  <button class="topping-remove" data-action="remove-topping" data-nama="${escapeHtml(t.nama)}" data-menu-id="${c.menu.id}">×</button>
                </span>
              `).join('') + (selected.length < toppings.length
                ? ` <button class="btn btn-xs btn-ghost" data-action="select-topping" data-menu-id="${c.menu.id}" onclick="window.selectTopping && window.selectTopping('${c.menu.id}')">＋ lagi</button>`
                : '')
          }
        </div>
      ` : ''}
      <div class="qty-control">
        <button class="qty-btn" data-action="change-qty" data-menu-id="${c.menu.id}" data-delta="-1">−</button>
        <div class="qty-val">${c.qty}</div>
        <button class="qty-btn" data-action="change-qty" data-menu-id="${c.menu.id}" data-delta="1">+</button>
      </div>
      <div class="cart-price">
        ${toppingTotal > 0 ? `<div class="kfs11 kgray">${formatRp(pricePerItem - toppingTotal)} + topping ${formatRp(toppingTotal)}</div>` : ''}
        <div>${formatRp(totalLine)}</div>
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