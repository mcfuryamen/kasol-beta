// ==================== POS LOGIC (ESM) ====================
// Pure functions: cart operations, calculations, validation.
// No DOM access. No DB access.

export function addToCartLogic(cart, menuId, menu) {
  const existing = cart[menuId];
  if (existing) {
    return { ...cart, [menuId]: { ...existing, qty: existing.qty + 1 } };
  }
  return { ...cart, [menuId]: { menu, qty: 1 } };
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
  return Object.values(cart).reduce((sum, item) => sum + (item.menu.hargaJual * item.qty), 0);
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
