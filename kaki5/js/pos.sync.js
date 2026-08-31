// ==================== POS SYNC (ESM) ====================
// Database save operations. No DOM access.

import { DB } from './db.js';
import { cart, setCart, setLastSaleId } from './app-state.js';
import { todayStr } from './helpers.js';

const CART_KEY = 'kaki5-cart';

export function saveCart() {
  try {
    const slim = {};
    Object.entries(cart).forEach(([id, c]) => {
      // Dahulu hanya {menu, qty} → topping & catatan per-item hilang diam-diam
      // saat refresh / PWA reload. Ikut disimpan sekarang (catatan menu terpilih
      // adalah fitur baru 2026-08-31, komentar browser #8).
      slim[id] = {
        menu: c.menu,
        qty: c.qty,
        selectedToppings: c.selectedToppings || [],
        toppingQtys: c.toppingQtys || {},
        catatanItem: c.catatanItem || ''
      };
    });
    localStorage.setItem(CART_KEY, JSON.stringify(slim));
  } catch (e) {
    console.warn('[Cart] failed to persist', e.message);
  }
}

export async function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return;
    const restored = {};
    for (const [id, c] of Object.entries(parsed)) {
      if (c && c.menu && typeof c.qty === 'number' && c.qty > 0) {
        const fresh = await DB.menu.get(Number(id));
        if (fresh) {
          // Snapshot menu diambil ulang dari DB (harga/stok terkini), tapi topping,
          // qty topping, dan catatan per-item ikut dipulihkan.
          restored[Number(id)] = {
            menu: fresh,
            qty: c.qty,
            selectedToppings: Array.isArray(c.selectedToppings) ? c.selectedToppings : [],
            toppingQtys: (c.toppingQtys && typeof c.toppingQtys === 'object') ? c.toppingQtys : {},
            catatanItem: typeof c.catatanItem === 'string' ? c.catatanItem : ''
          };
        }
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

export async function simpanPenjualanSync(sale) {
  const saleId = await DB.penjualan.add(sale);
  // Kuota transaksi (2026-08-29): tiap penjualan selesai naikkan penghitung.
  // Titik tunggu penulisan penjualan — semua jalur checkout lewat sini.
  try { const { incrementTxCount } = await import('./license.js'); await incrementTxCount(); } catch (_) { /* kuota gagal dicatat jangan gagalkan penjualan */ }
  return saleId;
}
