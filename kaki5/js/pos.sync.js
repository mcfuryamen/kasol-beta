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
      slim[id] = { menu: c.menu, qty: c.qty };
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

export async function simpanPenjualanSync(sale) {
  const saleId = await DB.penjualan.add(sale);
  return saleId;
}
