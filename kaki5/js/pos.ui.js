// ==================== POS UI (ESM) ====================
// DOM operations only. No DB access. No state mutations.

import { escapeHtml, formatRp } from './helpers.js';
import { cart, posCat } from './app-state.js';
import { generatePresetNominal } from './pos.logic.js';

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

export function renderPOSMenuUI(menus) {
  const grid = document.getElementById('posMenuGrid');
  if (!menus || menus.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🍽️</div><div class="empty-text">Belum ada menu.<br>Tambah di tab Menu dulu ya!</div></div>';
    return;
  }

  const catEmoji = {Makanan:'🍚',Minuman:'🥤',Snack:'🍢',Lainnya:'📦'};
  grid.innerHTML = menus.map(m => {
    const qty = cart[m.id] ? cart[m.id].qty : 0;
    return `<div class="menu-item ${qty>0?'selected':''}" onclick="addToCart(${m.id})">
      ${qty > 0 ? `<div class="item-qty">${qty}</div>` : ''}
      <span class="item-emoji">${escapeHtml(catEmoji[m.kategori]||'🍽️')}</span>
      <div class="item-name">${escapeHtml(m.nama)}</div>
      <div class="item-price">${formatRp(m.hargaJual)}</div>
    </div>`;
  }).join('');
}

export function renderCartBar() {
  const bar = document.getElementById('cartBar');
  const items = Object.values(cart);
  const totalQty = items.reduce((a,c) => a + c.qty, 0);
  const totalPrice = items.reduce((a,c) => a + c.qty * c.menu.hargaJual, 0);

  if (totalQty > 0) {
    bar.style.display = 'block';
    document.getElementById('cartCount').textContent = totalQty + ' item';
    document.getElementById('cartTotal').textContent = formatRp(totalPrice);
  } else {
    bar.style.display = 'none';
  }
}

export function openCartModal() {
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) return;

  const totalPrice = items.reduce((a,c) => a + c.qty * c.menu.hargaJual, 0);
  const box = document.getElementById('cartItems');
  box.innerHTML = items.map(c => `<div class="cart-item">
    <div class="cart-name">${escapeHtml(c.menu.nama)}</div>
    <div class="qty-control">
      <button class="qty-btn" onclick="changeQty(${c.menu.id},-1)">−</button>
      <div class="qty-val">${c.qty}</div>
      <button class="qty-btn" onclick="changeQty(${c.menu.id},1)">+</button>
    </div>
    <div class="cart-price">${formatRp(c.qty * c.menu.hargaJual)}</div>
  </div>`).join('');

  document.getElementById('cartModalTotal').textContent = formatRp(totalPrice);

  // Auto-fill nominal dengan total harga (uang pas) — format dengan pemisah ribuan
  document.getElementById('bayarInput').value = totalPrice.toLocaleString('id-ID');

  // Generate preset nominal (max 4) — nilai mata uang standar Indonesia di atas total harga
  const presets = generatePresetNominal(totalPrice);
  const presetContainer = document.getElementById('presetBayarContainer');
  presetContainer.innerHTML = presets.map(p =>
    `<button class="btn btn-sm btn-ghost" style="font-size:12px" onclick="setNominalBayar(${p})">${p.toLocaleString('id-ID')}</button>`
  ).join('');

  // Kotak kembalian SELALU tampil (permintaan pemilik 2026-08-17): saat modal
  // dibuka uang diterima sudah terisi = total (uang pas) → kembalian Rp 0.
  hitungKembalianUI(totalPrice, totalPrice);
  document.getElementById('cartModal').classList.add('show');
}

export function closeCartModal() {
  document.getElementById('cartModal').classList.remove('show');
}

export function hitungKembalianUI(total, bayar) {
  const box = document.getElementById('kembalianBox');
  // Kotak tidak pernah disembunyikan — belum cukup/berubah uang → tampil Rp 0.
  box.style.display = 'flex';
  document.getElementById('kembalianVal').textContent =
    (bayar >= total && bayar > 0) ? formatRp(bayar - total) : 'Rp 0';
}

export function formatBayarInputUI() {
  const input = document.getElementById('bayarInput');
  let value = input.value.replace(/\D/g, '');

  if (value === '') {
    input.value = '';
    return;
  }

  const formatted = parseInt(value).toLocaleString('id-ID');
  input.value = formatted;
}

export function selectAllBayarInput() {
  const input = document.getElementById('bayarInput');
  input.select();
}

export function setNominalBayarUI(nominal) {
  const input = document.getElementById('bayarInput');
  const formatted = nominal.toLocaleString('id-ID');
  input.value = formatted;
}

export function showAfterSaleActions() {
  const afterActions = document.getElementById('afterSaleActions');
  if (afterActions) {
    afterActions.style.display = 'block';
    setTimeout(() => { afterActions.style.display = 'none'; }, 15000);
  }
}
