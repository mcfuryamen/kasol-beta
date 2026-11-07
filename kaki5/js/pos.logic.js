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

// ── Harga Ojol per-app helpers ───────────────────────────────────────────────
// Data baru: menu.ojolPrices = JSON array [{nama, harga}] (multi-app, ala topping).
// Data lama: menu.hargaOjol (satu angka) → dibaca sebagai baris "Lainnya" (migrasi implisit).
export function parseOjolPrices(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(t => typeof t.nama === 'string' && t.nama.trim() !== '')
      .map(t => ({ nama: t.nama.trim(), harga: Math.max(0, parseInt(t.harga, 10) || 0) }));
  } catch { return []; }
}

// Menu punya konfigurasi Harga Ojol? (data baru ojolPrices ATAU data lama hargaOjol)
export function menuHasOjol(menu) {
  if (!menu) return false;
  return getOjolRows(menu).length > 0;
}

// Daftar baris harga ojol ter-normalisasi. Menu lama (hargaOjol > 0, tanpa
// ojolPrices) otomatis terbaca sebagai [{ nama: 'Lainnya', harga: hargaOjol }].
export function getOjolRows(menu) {
  const rows = parseOjolPrices(menu?.ojolPrices);
  if (rows.length > 0) return rows;
  if ((menu?.hargaOjol || 0) > 0) return [{ nama: 'Lainnya', harga: menu.hargaOjol }];
  return [];
}

// Harga ojol untuk satu app terpilih (order-follow).
// Urutan: baris nama sama (case-insensitive) → baris pertama → hargaJual.
// Menu tanpa konfigurasi ojol sama sekali → hargaJual (perilaku lama).
export function getOjolPrice(menu, platform = '') {
  const rows = getOjolRows(menu);
  if (rows.length === 0) return (menu?.hargaJual || 0);
  const p = (platform || '').trim().toLowerCase();
  const match = p ? rows.find(r => r.nama.trim().toLowerCase() === p) : null;
  return match ? match.harga : rows[0].harga;
}

// Normalisasi toppingQtys dari item (cart atau sale record) → Object {nama: qty}.
// Backward-compat:
//   - item.toppingQtys (Object) → return as-is.
//   - item.toppingQty (Number) → semua topping dapat qty itu.
//   - tidak ada → qty=1 untuk semua selectedToppings.
export function normalizeToppingQtys(item) {
  if (item.toppingQtys && typeof item.toppingQtys === 'object') {
    return { ...item.toppingQtys };
  }
  const legacy = Math.max(1, parseInt(item.toppingQty, 10) || 1);
  const out = {};
  (item.selectedToppings || []).forEach(t => { out[t.nama] = legacy; });
  return out;
}

// Hitung Σ (harga topping × qty topping) untuk 1 item.
// qty per-topping independen: mis. nasi 2 + telur dadar 1, ayam goreng 2
// → (3000*1) + (5000*2) = 13.000. Topping tidak dipilih qty=0 → kontribusi 0.
export function toppingHarga(item) {
  const toppings = item.selectedToppings || [];
  const qtys = normalizeToppingQtys(item);
  return toppings.reduce((s, t) => {
    const q = Math.max(0, parseInt(qtys[t.nama], 10) || 0);
    return s + ((t.harga || 0) * q);
  }, 0);
}

// Harga efektif per-qty (TANPA toppingQty — sudah terhitung di toppingHarga).
// Dipakai untuk label harga satuan per item.
export function hargaEfektif(item, orderType, ojolPlatform = '') {
  const isOjol = orderType === 'ojol';
  const baseHarga = isOjol ? getOjolPrice(item.menu, ojolPlatform) : item.menu.hargaJual;
  // Per-qty topping harga: Σ harga topping (ignore qty) — untuk display per-unit.
  // NB: total baris dihitung oleh calculateTotal / lineTotal, bukan di sini.
  const toppings = item.selectedToppings || [];
  const topPerQty = toppings.reduce((s, t) => s + (t.harga || 0), 0);
  return baseHarga + topPerQty;
}

// ── Cart operations ──────────────────────────────────────────────────────────
// selectedToppingQtys: Array<{nama, qty}> atau null/undefined.
//   - Dipakai untuk set qty awal per-topping (qty>=1) saat ini dipanggil.
//   - Item existing: qty menu digabung (+addQty); selectedToppings & toppingQtys
//     di-REPLACE dengan nilai dari argumen (bukan union).
//     Topping yang tidak ada di argumen dihapus dari toppingQtys.
// itemNote (2026-08-31, komentar browser #8): catatan milik SATU menu terpilih —
// beda dengan catatan GLOBAL per transaksi yang hidup di header keranjang.
// Item existing (menu sama ditambah lagi): catatan LAMA dipertahankan kalau
// argumen kosong, supaya menambah qty tidak menghapus catatan yang sudah ada.
export function addToCartLogic(cart, menuId, menu, selectedToppings = [], orderType = 'dine-in', qty = 1, selectedToppingQtys = null, itemNote = '') {
  // Blokir item titipan yang stoknya habis
  if (menu.pakaiStok && (menu.stok || 0) <= 0) return cart;
  const addQty = Math.max(1, parseInt(qty, 10) || 1);
  const existing = cart[menuId];
  // Blokir oversell: qty di keranjang (existing + tambahan) tidak boleh melebihi stok
  const pendingQty = (existing ? existing.qty : 0) + addQty;
  if (menu.pakaiStok && pendingQty > (menu.stok || 0)) return cart;

  // Bangun map qty topping akhir dari argumen.
  const finalQtys = {};
  if (Array.isArray(selectedToppingQtys)) {
    selectedToppingQtys.forEach(t => {
      const q = Math.max(1, parseInt(t.qty, 10) || 1);
      finalQtys[t.nama] = q;
    });
  }
  (selectedToppings || []).forEach(t => {
    if (!(t.nama in finalQtys)) finalQtys[t.nama] = 1;
  });

  if (existing) {
    const note = String(itemNote || '').trim();
    return {
      ...cart,
      [menuId]: {
        ...existing,
        qty: existing.qty + addQty,
        selectedToppings: [...selectedToppings],
        toppingQtys: finalQtys,
        orderType,
        catatanItem: note || (existing.catatanItem || '')
      }
    };
  }
  return {
    ...cart,
    [menuId]: {
      menu,
      qty: addQty,
      selectedToppings: [...selectedToppings],
      toppingQtys: finalQtys,
      orderType,
      catatanItem: String(itemNote || '').trim()
    }
  };
}

export function changeQtyLogic(cart, menuId, delta) {
  const item = cart[menuId];
  if (!item) return cart;
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    const { [menuId]: _, ...rest } = cart;
    return rest;
  }
  // Blokir kalau pakaiStok dan qty melebihi stok
  if (item.menu.pakaiStok && newQty > (item.menu.stok || 0)) return cart;
  return { ...cart, [menuId]: { ...item, qty: newQty } };
}

export function hitungKembalianLogic(total, bayar) {
  return Math.max(0, bayar - total);
}

// orderType (v158): tipe pesanan AKTIF = sumber kebenaran untuk SELURUH keranjang.
// Dulu tiap item membawa orderType-nya sendiri, jadi item yang masuk saat mode
// Ojol tetap dihitung dengan harga ojol setelah kasir pindah ke Dine-in, dan
// sebaliknya. Param null/undefined → fallback ke flag per-item (data lama).
export function calculateTotal(cart, ojolPlatform = '', orderType = null) {
  return Object.values(cart).reduce((sum, item) => {
    const isOjol = orderType == null ? item.orderType === 'ojol' : orderType === 'ojol';
    const baseHarga = isOjol ? getOjolPrice(item.menu, ojolPlatform) : item.menu.hargaJual;
    // Σ (harga topping × qty topping) — qty per-topping independen
    const topSum = toppingHarga(item);
    return sum + (baseHarga * item.qty) + topSum;
  }, 0);
}

export function calculateModal(cart) {
  return Object.values(cart).reduce((sum, item) => sum + (item.menu.hargaModal * item.qty), 0);
}

export function countItems(cart) {
  return Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
}

// Total satu baris item. Bekerja untuk cart item (dengan item.menu.*) maupun
// sale record (item.hargaJual/hargaOjol flat). Dipakai oleh trx detail & nota.
export function lineTotal(item, orderType = null, ojolPlatform = '') {
  // v158: orderType EKSPLISIT menang atas flag per-item. Cart selalu mengirim
  // tipe aktif di halaman Jualan → Dine-in/Take-away tidak lagi kebagian harga
  // ojol cuma karena item-nya dulu masuk saat mode Ojol. Tanpa param (sale
  // record flat) → ikuti flag record/item seperti sebelumnya.
  const ojolActive = orderType == null ? item.orderType === 'ojol' : orderType === 'ojol';
  const hargaJual = item.hargaJual ?? item.menu?.hargaJual ?? 0;
  // Cart item (menu lengkap): harga ikut app terpilih (order-follow).
  // Sale record flat (tanpa menu): hargaOjol tersimpan = harga efektif saat transaksi.
  const baseHarga = ojolActive
    ? (item.menu ? getOjolPrice(item.menu, ojolPlatform) : (item.hargaOjol || hargaJual))
    : hargaJual;
  const qty = Math.max(1, parseInt(item.qty, 10) || 1);
  return (baseHarga * qty) + toppingHarga(item);
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
