// ==================== POS LOGIC (ESM) ====================
// Pure functions: cart operations, calculations, validation.
// No DOM access. No DB access.

// ── Topping helpers ──────────────────────────────────────────────────────────
// Parse JSON string dari menu.toppingList → array {nama, harga}
export function parseToppings(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(t => typeof t.nama === 'string' && t.nama.trim() !== '');
  } catch { return []; }
}

// Hitung total harga topping untuk 1 item di cart
export function toppingHarga(item) {
  const toppings = item.selectedToppings || [];
  return toppings.reduce((s, t) => s + (t.harga || 0), 0);
}

// Harga efektif per-qty: harga dasar (dine-in/takeaway) atau hargaOjol,
// ditambah total harga semua topping terpilih.
export function hargaEfektif(item, orderType) {
  const isOjol = orderType === 'ojol';
  const baseHarga = (isOjol && item.menu.hargaOjol > 0) ? item.menu.hargaOjol : item.menu.hargaJual;
  return baseHarga + toppingHarga(item);
}

// ── Cart operations ──────────────────────────────────────────────────────────
export function addToCartLogic(cart, menuId, menu, selectedToppings = [], orderType = 'dine-in') {
  const existing = cart[menuId];
  if (existing) {
    // Item sudah ada: gabungkan topping (union), jangan dobel nama
    const existingNames = new Set((existing.selectedToppings || []).map(t => t.nama));
    const newToppings = (selectedToppings || []).filter(t => !existingNames.has(t.nama));
    return {
      ...cart,
      [menuId]: {
        ...existing,
        qty: existing.qty + 1,
        selectedToppings: [...(existing.selectedToppings || []), ...newToppings],
        orderType
      }
    };
  }
  return { ...cart, [menuId]: { menu, qty: 1, selectedToppings: [...selectedToppings], orderType } };
}

export function changeQtyLogic(cart, menuId, delta) {
  const item = cart[menuId];
  if (!item) return cart;
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    const { [menuId]: _, ...rest } = cart;
    return rest;
  }
  return { ...cart, [menuId]: { ...item, qty: newQty } };
}

export function hitungKembalianLogic(total, bayar) {
  return Math.max(0, bayar - total);
}

export function calculateTotal(cart) {
  return Object.values(cart).reduce((sum, item) => {
    const hargaPerItem = hargaEfektif(item, item.orderType || 'dine-in');
    return sum + (hargaPerItem * item.qty);
  }, 0);
}

export function calculateModal(cart) {
  return Object.values(cart).reduce((sum, item) => sum + (item.menu.hargaModal * item.qty), 0);
}

export function countItems(cart) {
  return Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
}

// Generate 4 preset nominal di atas total harga — standar mata uang Indonesia
export function generatePresetNominal(totalPrice) {
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
