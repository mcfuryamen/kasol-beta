// _qa-v170-diskon.mjs — uji murni fungsi diskon pos.logic.js (read-only, tidak menyentuh DB/user data)
import {
  normalisasiDiskon, diskonRp, lineDiskonRp, lineNetRp,
  computeCartTotals, computeSaleTotals, lineTotal, calculateTotal,
  DISKON_TIPE
} from './js/pos.logic.js';

let fail = 0, pass = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; } else { fail++; console.log(`✗ ${label}\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); }
};
const truthy = (label, v) => { if (v) pass++; else { fail++; console.log(`✗ ${label}`); } };

// ── normalisasiDiskon ───────────────────────────────────────────────────────
eq('null in → null', normalisasiDiskon(null), null);
eq('string in → null', normalisasiDiskon('10'), null);
eq('tipe asing → null', normalisasiDiskon({ tipe: 'diskon', nilai: 10 }), null);
eq('nilai 0 → null', normalisasiDiskon({ tipe: 'persen', nilai: 0 }), null);
eq('nilai negatif → null', normalisasiDiskon({ tipe: 'rp', nilai: -500 }), null);
eq('NaN → null', normalisasiDiskon({ tipe: 'persen', nilai: 'abc' }), null);
eq('persen >100 di-cap 100', normalisasiDiskon({ tipe: 'persen', nilai: 250 }), { tipe: 'persen', nilai: 100 });
eq('rp di-floor', normalisasiDiskon({ tipe: 'rp', nilai: 2500.9 }), { tipe: 'rp', nilai: 2500 });
eq('string angka diterima', normalisasiDiskon({ tipe: 'persen', nilai: '10' }), { tipe: 'persen', nilai: 10 });

// ── diskonRp ────────────────────────────────────────────────────────────────
eq('10% dari 20000', diskonRp({ tipe: 'persen', nilai: 10 }, 20000), 2000);
eq('persen dibulatkan', diskonRp({ tipe: 'persen', nilai: 15 }, 33000), 4950);
eq('rp melebihi basis dipotong jadi basis', diskonRp({ tipe: 'rp', nilai: 99000 }, 20000), 20000);
eq('basis 0 → 0', diskonRp({ tipe: 'persen', nilai: 50 }, 0), 0);
eq('diskon null → 0', diskonRp(null, 20000), 0);
eq('basis string aman', diskonRp({ tipe: 'rp', nilai: 1000 }, 'x'), 0);

// ── item helper (sale-record flat) ──────────────────────────────────────────
const flat = (extra = {}) => ({
  nama: 'Teh', hargaJual: 5000, hargaOjol: 6000, hargaModal: 2000,
  qty: 2, selectedToppings: [{ nama: 'Sagu', harga: 2000 }], toppingQtys: { Sagu: 1 },
  orderType: 'dine-in', ...extra
});
// gross = 5000*2 + 2000 = 12000
eq('lineTotal tetap GROSS', lineTotal(flat()), 12000);
eq('lineDiskonRp 10%', lineDiskonRp(flat({ diskonItem: { tipe: 'persen', nilai: 10 } })), 1200);
eq('lineNetRp 10%', lineNetRp(flat({ diskonItem: { tipe: 'persen', nilai: 10 } })), 10800);
eq('tanpa diskon net == gross', lineNetRp(flat()), 12000);
eq('diskon rp melebihi baris tidak negatif', lineNetRp(flat({ diskonItem: { tipe: 'rp', nilai: 99999 } })), 0);
// calculateTotal (jalur lama) WAJIB tetap gross walau ada diskon — ini jaminan
// supaya pemakai lama (beranda, tutup buku, laporan lama) tidak berubah makna.
const cartGross = { 1: { menu: { id: 1, nama: 'Teh', hargaJual: 5000, hargaModal: 2000 }, qty: 2, selectedToppings: [{ nama: 'Sagu', harga: 2000 }], toppingQtys: { Sagu: 1 }, diskonItem: { tipe: 'rp', nilai: 99999 } } };
eq('calculateTotal tetap GROSS', calculateTotal(cartGross, '', 'dine-in'), 12000);

// ── computeCartTotals: kasus contoh tutorial ────────────────────────────────
// 2 es teh @5000 + topping sagu 2000 (qty 1) → baris 12000, diskon item 10% = 1200
// sisa 10800, diskon transaksi 5% = 540 → total 10260
const cart1 = { 1: { menu: { id: 1, nama: 'Teh', hargaJual: 5000, hargaModal: 2000 }, qty: 2, selectedToppings: [{ nama: 'Sagu', harga: 2000 }], toppingQtys: { Sagu: 1 }, diskonItem: { tipe: 'persen', nilai: 10 } } };
const t1 = computeCartTotals(cart1, '', 'dine-in', { tipe: 'persen', nilai: 5 });
eq('t1.subtotal', t1.subtotal, 12000);
eq('t1.diskonItem', t1.diskonItem, 1200);
eq('t1.sisaSetelahItem', t1.sisaSetelahItem, 10800);
eq('t1.diskonGlobal (5% dari SISA)', t1.diskonGlobal, 540);
eq('t1.diskonTotal', t1.diskonTotal, 1740);
eq('t1.total', t1.total, 10260);
eq('t1.jumlahItem', t1.jumlahItem, 2);

// tanpa diskon global → sama seperti tanpa fitur
const t2 = computeCartTotals(cart1, '', 'dine-in', null);
eq('t2.total tanpa global', t2.total, 10800);
eq('t2.diskonTotal', t2.diskonTotal, 1200);

// cart kosong + diskon global basi → total 0, potongan 0
const t3 = computeCartTotals({}, '', 'dine-in', { tipe: 'rp', nilai: 5000 });
eq('t3 kosong total', t3.total, 0);
eq('t3 kosong diskonGlobal', t3.diskonGlobal, 0);
eq('t3 kosong diskonTotal', t3.diskonTotal, 0);

// qty 0 tersaring
const t4 = computeCartTotals({ 1: { ...cart1[1], qty: 0 } }, '', 'dine-in', null);
eq('t4 qty0 tersaring', t4.subtotal, 0);

// ojol: basis diskon = harga ojol
const cartOjol = { 1: { menu: { id: 1, nama: 'Teh', hargaJual: 5000, ojolPrices: '[{"nama":"GoFood","harga":7000}]' }, qty: 1, selectedToppings: [], toppingQtys: {}, diskonItem: { tipe: 'persen', nilai: 10 } } };
const t5 = computeCartTotals(cartOjol, 'GoFood', 'ojol', null);
eq('t5 subtotal ojol', t5.subtotal, 7000);
eq('t5 diskon dari harga ojol', t5.diskonItem, 700);

// ── computeSaleTotals dari record tersimpan ─────────────────────────────────
const sale = {
  orderType: 'dine-in', ojolPlatform: '',
  items: [
    { nama: 'Teh', hargaJual: 5000, hargaOjol: 0, qty: 2, selectedToppings: [{ nama: 'Sagu', harga: 2000 }], toppingQtys: { Sagu: 1 }, diskonItem: { tipe: 'persen', nilai: 10 } },
    { nama: 'Nasi', hargaJual: 10000, hargaOjol: 0, qty: 1, selectedToppings: [], toppingQtys: {} }
  ],
  diskonGlobal: { tipe: 'rp', nilai: 1000 }
};
const st = computeSaleTotals(sale);
eq('st.subtotal', st.subtotal, 22000);
eq('st.diskonItem', st.diskonItem, 1200);
eq('st.sisa', st.sisaSetelahItem, 20800);
eq('st.diskonGlobal rp', st.diskonGlobal, 1000);
eq('st.diskonTotal', st.diskonTotal, 2200);
eq('st.total', st.total, 19800);

// record lama (tanpa field diskon apa pun) → 0 semua, total == gross
const lama = { orderType: null, items: [{ nama: 'X', hargaJual: 8000, qty: 1, selectedToppings: [], toppingQtys: {} }], totalHarga: 8000 };
const sl = computeSaleTotals(lama);
eq('lama diskonTotal 0', sl.diskonTotal, 0);
eq('lama total == gross', sl.total, 8000);
// record lama dengan item.orderType='ojol' tapi tanpa orderType record
const lama2 = { items: [{ nama: 'Y', hargaJual: 5000, hargaOjol: 6500, qty: 1, orderType: 'ojol', selectedToppings: [], toppingQtys: {} }] };
eq('lama ojol flag per item', computeSaleTotals(lama2).subtotal, 6500);
// items bukan array
eq('sale tanpa items', computeSaleTotals({ diskonGlobal: { tipe: 'rp', nilai: 5000 } }).total, 0);
// diskonGlobal rusak di DB lama → dianggap tidak ada
eq('sale diskonGlobal string rusak', computeSaleTotals({ items: lama.items, diskonGlobal: '10%' }).diskonTotal, 0);

// ── addToCartLogic: kontrak diskonItem ──────────────────────────────────────
const { addToCartLogic } = await import('./js/pos.logic.js');
const menu = { id: 7, nama: 'Teh', hargaJual: 5000, hargaModal: 2000 };
const c0 = addToCartLogic({}, 7, menu, [], 'dine-in', 1, null, '', { tipe: 'persen', nilai: 10 });
eq('baru: diskon tersimpan', c0[7].diskonItem, { tipe: 'persen', nilai: 10 });
const c1 = addToCartLogic(c0, 7, menu, [], 'dine-in', 1, null, '');
eq('tambah qty tanpa arg: diskon DIPERTAHANKAN', c1[7].diskonItem, { tipe: 'persen', nilai: 10 });
eq('tambah qty: qty naik', c1[7].qty, 2);
const c2 = addToCartLogic(c0, 7, menu, [], 'dine-in', 1, null, '', null);
eq('arg null: diskon DIHAPUS', c2[7].diskonItem, null);
const c3 = addToCartLogic(c0, 7, menu, [], 'dine-in', 1, null, '', { tipe: 'persen', nilai: 25 });
eq('arg baru: diskon DIGANTI', c3[7].diskonItem, { tipe: 'persen', nilai: 25 });
const c4 = addToCartLogic({}, 7, menu, [], 'dine-in', 1);
eq('baru tanpa arg: diskon null', c4[7].diskonItem, null);
const c5 = addToCartLogic({}, 7, menu, [], 'dine-in', 1, null, '', { tipe: 'persen', nilai: '15' });
eq('input DOM string dinormalkan', c5[7].diskonItem, { tipe: 'persen', nilai: 15 });

truthy('DISKON_TIPE stabil', DISKON_TIPE.PERSEN === 'persen' && DISKON_TIPE.RP === 'rp');
console.log(`\n[qa-v170-diskon] PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
