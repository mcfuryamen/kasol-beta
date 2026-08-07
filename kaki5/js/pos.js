// ==================== POS / JUALAN (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, todayStr, showToast } from './helpers.js';
import { cart, setCart, setPosCat, posCat, setLastSaleId } from './app-state.js';

const CART_KEY = 'kaki5-cart';

export async function loadPOS() {
  await loadCart();
  await renderPOSCatTabs();
  renderPOSMenu();
  updateCartBar();
}

// ---- Cart persistence (localStorage) ----
function saveCart() {
  try {
    const slim = {};
    Object.entries(cart).forEach(([id, c]) => {
      slim[id] = { menu: c.menu, qty: c.qty };
    });
    localStorage.setItem(CART_KEY, JSON.stringify(slim));
  } catch (e) {
    // storage full / unavailable — cart still works in-session
    console.warn('[Cart] failed to persist', e.message);
  }
}

async function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return;
    const restored = {};
    for (const [id, c] of Object.entries(parsed)) {
      if (c && c.menu && typeof c.qty === 'number' && c.qty > 0) {
        // re-hydrate the full menu from DB so id/nama/harga are current & valid
        const fresh = await DB.menu.get(Number(id));
        if (fresh) restored[Number(id)] = { menu: fresh, qty: c.qty };
      }
    }
    setCart(restored);
  } catch (e) {
    console.warn('[Cart] load failed', e.message);
    setCart({});
  }
}

export function clearCartStorage() {
  try { localStorage.removeItem(CART_KEY); } catch (e) {}
}

async function renderPOSCatTabs() {
  const menus = await DB.menu.where('aktif').equals(1).toArray();
  const cats = ['Semua', ...new Set(menus.map(m => m.kategori))];
  const box = document.getElementById('posCatTabs');
  box.innerHTML = cats.map(c => `<div class="cat-tab ${c===posCat?'active':''}" onclick="selectPosCat('${c.replace(/'/g,"\\'")}')">${escapeHtml(c==='Semua'?'📋 Semua':c==='Makanan'?'🍚 Makanan':c==='Minuman'?'🥤 Minuman':c==='Snack'?'🍢 Snack':'📦 '+c)}</div>`).join('');
}

// Window-wired: sets active category and re-renders tabs + menu list
export function selectPosCat(cat) {
  setPosCat(cat);
  renderPOSCatTabs();
  renderPOSMenu();
}

export async function renderPOSMenu() {
  const search = (document.getElementById('searchMenu').value || '').toLowerCase();
  let menus = await DB.menu.where('aktif').equals(1).toArray();
  if (posCat !== 'Semua') menus = menus.filter(m => m.kategori === posCat);
  if (search) menus = menus.filter(m => m.nama.toLowerCase().includes(search));

  const grid = document.getElementById('posMenuGrid');
  if (menus.length === 0) {
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

export async function addToCart(menuId) {
  const next = { ...cart };
  if (!next[menuId]) {
    const m = await DB.menu.get(menuId);
    if (!m) return;
    next[menuId] = { menu: m, qty: 0 };
  }
  next[menuId] = { menu: next[menuId].menu, qty: next[menuId].qty + 1 };
  setCart(next);
  saveCart();
  renderPOSMenu();
  updateCartBar();
}

function updateCartBar() {
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
  
  document.getElementById('kembalianBox').style.display = 'none';
  document.getElementById('cartModal').classList.add('show');
  
  // Trigger hitung kembalian untuk tampilkan info (uang pas)
  hitungKembalian();
}

// Generate 4 preset nominal di atas total harga — standar mata uang Indonesia
function generatePresetNominal(totalPrice) {
  if (totalPrice <= 0) return [];
  
  // Denominasi standar Indonesia: 1k, 2k, 5k, 10k, 20k, 50k, 100k, 200k, 500k, 1jt
  const denominasi = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
  const presets = [];
  
  // Cari 4 preset yang > totalPrice, tidak dobel
  for (const denom of denominasi) {
    if (presets.length >= 4) break;
    
    // Cari kelipatan denom yang > totalPrice (paling kecil)
    const multiplier = Math.ceil((totalPrice + 1) / denom);
    const preset = multiplier * denom;
    
    // Jangan dobel
    if (!presets.includes(preset)) {
      presets.push(preset);
    }
  }
  
  return presets;
}

export function closeCartModal() {
  document.getElementById('cartModal').classList.remove('show');
}

export function changeQty(menuId, delta) {
  const next = { ...cart };
  if (!next[menuId]) return;
  const c = next[menuId];
  const newQty = (c.qty || 0) + delta;
  if (newQty <= 0) delete next[menuId];
  else next[menuId] = { menu: c.menu, qty: newQty };
  setCart(next);
  saveCart();
  updateCartBar();
  // re-render cart modal
  const items = Object.values(next).filter(c => c.qty > 0);
  if (items.length === 0) { closeCartModal(); renderPOSMenu(); return; }
  openCartModal();
  renderPOSMenu();
}

export function hitungKembalian() {
  const items = Object.values(cart).filter(c => c.qty > 0);
  const total = items.reduce((a,c) => a + c.qty * c.menu.hargaJual, 0);
  
  // Parse bayar input (handle format dengan pemisah ribuan)
  let bayarValue = document.getElementById('bayarInput').value.replace(/\D/g, '');
  const bayar = bayarValue ? parseInt(bayarValue) : 0;
  
  const box = document.getElementById('kembalianBox');
  if (bayar >= total && bayar > 0) {
    box.style.display = 'block';
    document.getElementById('kembalianVal').textContent = formatRp(bayar - total);
  } else {
    box.style.display = 'none';
  }
}

// Window-wired: format bayar input dengan pemisah ribuan & hitung kembalian
export function formatBayarInput() {
  const input = document.getElementById('bayarInput');
  let value = input.value.replace(/\D/g, ''); // hapus semua non-digit
  
  if (value === '') {
    input.value = '';
    hitungKembalian();
    return;
  }
  
  // Format dengan pemisah ribuan
  const formatted = parseInt(value).toLocaleString('id-ID');
  input.value = formatted;
  hitungKembalian();
}

// Window-wired: select all text saat input di-focus
export function selectAllBayarInput() {
  const input = document.getElementById('bayarInput');
  input.select();
}

// Window-wired: set nominal dari preset button dan hitung kembalian
export function setNominalBayar(nominal) {
  const input = document.getElementById('bayarInput');
  const formatted = nominal.toLocaleString('id-ID');
  input.value = formatted;
  hitungKembalian();
}

export async function simpanPenjualan() {
  const items = Object.values(cart).filter(c => c.qty > 0);
  if (items.length === 0) { showToast('Keranjang kosong!', 'error'); return; }

  const totalHarga = items.reduce((a,c) => a + c.qty * c.menu.hargaJual, 0);
  const totalModal = items.reduce((a,c) => a + c.qty * c.menu.hargaModal, 0);
  
  // Parse bayar input (handle format dengan pemisah ribuan)
  let bayarValue = document.getElementById('bayarInput').value.replace(/\D/g, '');
  const bayar = bayarValue ? parseInt(bayarValue) : totalHarga;

  if (bayar < totalHarga) {
    showToast('Uang kurang!', 'error');
    return;
  }

  const saleId = await DB.penjualan.add({
    tanggal: todayStr(),
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
  updateCartBar();
  renderPOSMenu();
  showToast('✅ Penjualan tersimpan!');

  // Show print option
  const afterActions = document.getElementById('afterSaleActions');
  if (afterActions) {
    afterActions.style.display = 'block';
    setTimeout(() => { afterActions.style.display = 'none'; }, 15000);
  }
}
