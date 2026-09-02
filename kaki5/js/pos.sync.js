// ==================== POS SYNC (ESM) ====================
// Database save operations. No DOM access.

import { DB } from './db.js';
import { cart, setCart, setLastSaleId, getResumedHeldId, setResumedHeldId } from './app-state.js';
import { todayStr } from './helpers.js';
import { nextNomor } from './nomor.js';

const CART_KEY = 'kaki5-cart';
// v154: id pesanan ditahan yang sedang dibuka di cart — ikut dipersist supaya
// reload/PWA restart tidak mengubahnya jadi "cart manual" (bikin dobel record
// saat dibayar, karena row held-nya masih ada).
const HELD_ID_KEY = 'kaki5-cart-held-id';

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
    const rid = getResumedHeldId();
    if (rid && Object.keys(cart).length > 0) localStorage.setItem(HELD_ID_KEY, String(rid));
    else localStorage.removeItem(HELD_ID_KEY);
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
    // v154: pulihkan id held yang sedang dibuka — hanya bermakna kalau cart terisi.
    if (Object.keys(restored).length === 0) {
      setResumedHeldId(null);
      try { localStorage.removeItem(HELD_ID_KEY); } catch (_) {}
    } else {
      const rid = Number(localStorage.getItem(HELD_ID_KEY));
      setResumedHeldId(Number.isFinite(rid) && rid > 0 ? rid : null);
    }
  } catch (e) {
    console.warn('[Cart] load failed', e.message);
    setCart({});
    setResumedHeldId(null);
  }
}

export function clearCartStorage() {
  try { localStorage.removeItem(CART_KEY); } catch (e) {}
  try { localStorage.removeItem(HELD_ID_KEY); } catch (e) {}
}

export async function simpanPenjualanSync(sale) {
  // Penomoran (TRX harian) dihitung & ditulis dalam satu transaksi Dexie supaya
  // dua checkout beruntun tidak menghasilkan nomor kembar.
  const saleId = await DB.transaction('rw', DB.penjualan, async () => {
    const nomor = await nextNomor('penjualan', sale.tanggal);
    return DB.penjualan.add({ ...sale, nomor });
  });
  // Kuota transaksi (2026-08-29): tiap penjualan selesai naikkan penghitung.
  // Titik tunggu penulisan penjualan — semua jalur checkout lewat sini.
  try { const { incrementTxCount } = await import('./license.js'); await incrementTxCount(); } catch (_) { /* kuota gagal dicatat jangan gagalkan penjualan */ }
  return saleId;
}

// ==================== FITUR "TAHAN" (v148, 2026-09-01) ====================
// Skema: pakai tabel `penjualan` dengan field `status` ('held' | 'completed').
// `heldName` = label opsional (mis. "Meja 3", "Budi") supaya user bisa bedakan
// banyak pesanan yang ditahan bersamaan (jawaban user #2: multi-held).
// Field `waktu` = waktu订单 DITAHAN; saat dibayar → `paidAt` dicatat tapi `waktu`
// tetap waktu awal ditahan (jawaban user #4). createdAt identik dengan `waktu`.

// Simpan cart aktif sebagai held order baru. items, totalHarga, totalModal
// sudah dihitung dari cart — sama persis seperti record penjualan normal,
// hanya status='held' + heldName opsional.
export async function holdCartSync({ items, totalHarga, totalModal, orderType, orderNote, ojolPlatform, heldName }) {
  const tgl = todayStr();
  // Held ikut deret TRX harian (satu transaksi = satu nomor sejak ditahan;
  // saat dibayar nomor tetap sama — lihat payHeldSync).
  return DB.transaction('rw', DB.penjualan, async () => {
    const nomor = await nextNomor('penjualan', tgl);
    return DB.penjualan.add({
      tanggal: tgl,
      items,
      totalHarga,
      totalModal,
      orderType: orderType || 'dine-in',
      orderNote: orderNote || '',
      ojolPlatform: ojolPlatform || '',
      heldName: heldName || '',
      status: 'held',
      nomor,
      waktu: Date.now()
    });
  });
}

// Daftar semua held orders, urut waktu paling lama dulu (FIFO). Exclude yang
// sudah completed. Return: array of {id, waktu, totalHarga, items, heldName, ...}.
export async function listHeldSync() {
  const rows = await DB.penjualan.where('status').equals('held').toArray();
  // Urut waktu ASC: yang paling lama ditahan duluan (paling urgent).
  return rows.sort((a, b) => (a.waktu || 0) - (b.waktu || 0));
}

// Ambil satu held order by id. Return null kalau sudah bukan held (race: user
// lain menghapus saat modal terbuka).
export async function getHeldSync(id) {
  const row = await DB.penjualan.get(Number(id));
  if (!row || row.status !== 'held') return null;
  return row;
}

// Hapus held order permanen (user pilih "Hapus" di modal daftar). Tidak bisa
// undo — sama seperti hapus transaksi dari laporan.
export async function deleteHeldSync(id) {
  return DB.penjualan.delete(Number(id));
}

// Update held → completed saat user bayar. Field `paidAt` = waktu bayar.
// `waktu` (waktu dibuat/ditahan) TETAP — jawaban user #4: pertahankan createdAt.
// `status` jadi 'completed' agar laporan & query selesai tidak ikut hitung.
// Sisipkan field bayar/kembalian/metode/bukti/catatan bayar seperti record baru.
// v154: saat pesanan ditahan DIBUKA lalu dibayar, isi cart bisa sudah diedit
// (qty berubah, item tambah/buang) — payload items/total/orderType/orderNote/
// ojolPlatform ikut di-update kalau dikirim, supaya record final = cart terkini.
export async function payHeldSync(id, { items, totalHarga, totalModal, orderType, orderNote, ojolPlatform, bayar, kembalian, metodeBayar, buktiBayar, catatanBayar }) {
  const numId = Number(id);
  const row = await DB.penjualan.get(numId);
  if (!row) throw new Error('Held order tidak ditemukan');
  if (row.status !== 'held') throw new Error('Order ini bukan held');
  const patch = {
    status: 'completed',
    bayar,
    kembalian,
    metodeBayar: metodeBayar || 'tunai',
    buktiBayar: buktiBayar || '',
    catatanBayar: catatanBayar || '',
    paidAt: Date.now()
  };
  if (items) {
    patch.items = items;
    patch.totalHarga = totalHarga;
    patch.totalModal = totalModal;
    patch.orderType = orderType || 'dine-in';
    patch.orderNote = orderNote || '';
    patch.ojolPlatform = ojolPlatform || '';
  }
  await DB.penjualan.update(numId, patch);
  // Kuota transaksi ikut naik (sama seperti simpanPenjualanSync).
  try { const { incrementTxCount } = await import('./license.js'); await incrementTxCount(); } catch (_) {}
  return numId;
}

// v154: "Tahan" ulang pesanan yang SEDANG dibuka → perbarui row held yang sama
// (nomor TRX & waktu tahan asli tetap) alih-alih membuat duplikat. Return
// false kalau row sudah hilang/bukan held lagi → pemanggil fallback ke
// holdCartSync (buat baru).
export async function updateHeldSync(id, { items, totalHarga, totalModal, orderType, orderNote, ojolPlatform, heldName }) {
  const numId = Number(id);
  const row = await DB.penjualan.get(numId);
  if (!row || row.status !== 'held') return false;
  await DB.penjualan.update(numId, {
    items,
    totalHarga,
    totalModal,
    orderType: orderType || 'dine-in',
    orderNote: orderNote || '',
    ojolPlatform: ojolPlatform || '',
    heldName: (heldName || '').trim().slice(0, 60) || row.heldName || ''
  });
  return true;
}

// Count held aktif — untuk badge FAB. Cepat karena pakai index `status`.
export async function countHeldSync() {
  return DB.penjualan.where('status').equals('held').count();
}
