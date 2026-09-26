// ==================== KAS LOGIC (ESM) ====================
// Fungsi MURNI untuk aritmetika laci kas & laba — tanpa DOM, tanpa DB (lapisan
// yang sama dengan pos.logic.js / helpers.pure.js). Semua angka masuk sebagai
// argumen supaya bisa diuji dan dipakai ulang oleh kas.js, laporan.js, dan
// beranda.js tanpa saling mengimpor.
//
// Adopsi fitur buka/tutup kas + tutup buku dari Kasir Solo Rosok (v161).
//
// v164 (permintaan pemilik): SATU jalur pencatatan uang.
//   • Fitur "catat kas manual" di Beranda DIHAPUS. Nambah uang kembalian atau
//     ambil uang buat setor bank dicatat lewat form Pengeluaran/Pemasukan
//     Laporan — tidak ada lagi dua modal untuk hal yang sama.
//   • Hanya catatan bermode TUNAI yang menggeser isi laci (metodeCatatan()).
//     Bayar supplier pakai transfer tidak mengurangi uang di laci, jadi tidak
//     boleh ikut mengurangi kas sistem — itu sumber selisih palsu.
//   • Kategori non-usaha (Modal Tambahan, Setor Bank / Prive) menggeser laci
//     TAPI tidak masuk Laba — lihat isNonLaba() dan hitungLaba().
//   • Dompet digital (QRIS/Transfer) tidak pernah masuk laci. Hasilnya dirinci
//     lewat rinciDompetDigital() dan ditampilkan di layar Tutup Kas.

const TIPE_PEMASUKAN = 'pemasukan';

// ── Metode pembayaran ───────────────────────────────────────────────────────
// Nilai yang sama dipakai penjualan (`metodeBayar`) dan catatan
// pengeluaran/pemasukan (`metodeBayar`), supaya satu helper berlaku untuk dua.

export const METODE_TUNAI = 'tunai';
export const METODE_LABEL = {
  tunai: '💵 Tunai laci',
  qris: '📱 QRIS',
  transfer: '🏦 Transfer',
  lain: '🔖 Lainnya'
};

// Baris lama yang tidak punya field metodeBayar = tunai (perilaku kaki5 sebelum
// v164 memang menganggap semua catatan uang laci, jadi data lama tidak berubah
// makna). Nilai yang tidak dikenal (mis. 'ewallet' dari versi lain) BUKAN tunai:
// dipetakan ke bucket 'lain' supaya tetap dihitung non-tunai — sama seperti
// isCashSale lama memperlakukannya. Kalau dipaksa 'tunai', satu baris bisa
// terhitung di laci DAN di dompet digital sekaligus.
export function metodeCatatan(row) {
  const raw = row?.metodeBayar;
  if (raw === undefined || raw === null || raw === '') return METODE_TUNAI;
  const m = String(raw).toLowerCase();
  if (m === METODE_TUNAI || m === 'qris' || m === 'transfer') return m;
  return 'lain';
}

export function isCashCatatan(row) {
  return metodeCatatan(row) === METODE_TUNAI;
}

// Hanya uang TUNAI yang masuk laci. QRIS/Transfer mendarat di rekening, jadi
// tidak boleh dihitung sebagai kas fisik saat tutup kas.
export function isCashSale(sale) {
  return metodeCatatan(sale) === METODE_TUNAI;
}

// Bucket non-tunai untuk rincian dompet digital; null bila uang lewat laci.
export function metodeNonTunai(row) {
  const m = metodeCatatan(row);
  return m === METODE_TUNAI ? null : m;
}

// ── Laba vs arus kas ────────────────────────────────────────────────────────
// Kategori di bawah ini memindahkan uang laci BUKAN karena hasil usaha:
//   'Modal Tambahan'    → pemilik isi laci dari dompet sendiri (bukan untung)
//   'Setor Bank / Prive'→ pemilik ambil uang laci (bukan rugi)
// Keduanya tetap dihitung di kas sistem, hanya tidak masuk Laba.
export const KATEGORI_NON_LABA = ['Modal Tambahan', 'Setor Bank / Prive'];

export function isNonLaba(row) {
  const ket = String(row?.kategori || '').trim();
  return KATEGORI_NON_LABA.includes(ket);
}

// Waktu sebuah baris dalam ms epoch. Semua tabel kaki5 menyimpan `waktu` ms;
// fallback ke tanggal (awal hari) untuk baris tua yang field-nya hilang.
export function waktuMs(row) {
  if (typeof row?.waktu === 'number' && Number.isFinite(row.waktu)) return row.waktu;
  if (typeof row?.tanggal === 'string') {
    const t = Date.parse(row.tanggal + 'T00:00:00');
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

// Pisahkan satu tabel `pengeluaran` menjadi pengeluaran vs pemasukan.
// (v160: baris jenis:'pemasukan' BUKAN pengeluaran.) Baris kosong/rusak dibuang
// supaya pemanggil tidak perlu menjaga diri — dulu `null` lolos sebagai
// "pengeluaran" dan ikut dihitung di beberapa tempat.
export function pisahkanCatatan(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(r => r && typeof r === 'object');
  return {
    expenses: list.filter(r => r.jenis !== TIPE_PEMASUKAN),
    incomes: list.filter(r => r.jenis === TIPE_PEMASUKAN)
  };
}

// Saring baris berdasarkan rentang waktu ms [dari, sampai].
export function dalamRentang(rows, dariMs, sampaiMs) {
  const dari = Number.isFinite(dariMs) ? dariMs : 0;
  const sampai = Number.isFinite(sampaiMs) ? sampaiMs : Infinity;
  return (Array.isArray(rows) ? rows : []).filter(r => {
    const w = waktuMs(r);
    return w >= dari && w <= sampai;
  });
}

const sum = (rows, key = 'jumlah') => (rows || []).reduce((a, r) => a + (Number(r?.[key]) || 0), 0);
const onlyCash = rows => (rows || []).filter(isCashCatatan);
const onlyLaba = rows => (rows || []).filter(r => !isNonLaba(r));

/**
// Satu sumber kebenaran untuk "Laba".
//
// Dipakai Beranda, Laporan, dan tutup buku tahunan. Dulu ketiga halaman ini
// menghitung laba masing-masing dan angkanya pernah beda (bug pemasukan v160)
// — sekarang mereka memanggil fungsi yang sama, jadi tidak bisa drift lagi.
//
//   laba = omzet − modal barang − pengeluaran(non-usaha dikecualikan)
//                        + pemasukan(non-usaha dikecualikan)
//
// Metode pembayaran TIDAK mempengaruhi laba: biaya tetap biaya walau dibayar
// transfer. Yang membedakan tunai/non-tunai hanya isi laci (hitungKasSistem).
 */
export function hitungLaba({ omzet = 0, totalModal = 0, expenses = [], incomes = [] } = {}) {
  const expenseLaba = sum(onlyLaba(expenses));
  const incomeLaba = sum(onlyLaba(incomes));
  const nonLabaKeluar = sum((expenses || []).filter(isNonLaba));
  const nonLabaMasuk = sum((incomes || []).filter(isNonLaba));
  const laba = (Number(omzet) || 0) - (Number(totalModal) || 0) - expenseLaba + incomeLaba;
  return {
    omzet: Number(omzet) || 0,
    totalModal: Number(totalModal) || 0,
    expenseLaba,
    incomeLaba,
    nonLabaKeluar,
    nonLabaMasuk,
    laba
  };
}

/**
// Hitung perkiraan uang yang SEHARUSNYA ada di laci.
//
//   kas sistem = modal awal laci
//              + penjualan tunai (dalam rentang shift)
//              − pengeluaran tunai
//              + pemasukan tunai
//
// Catatan non-tunai dan penjualan QRIS/Transfer sengaja tidak ikut: uang itu
// tidak pernah menyentuh laci. Lihat rinciDompetDigital() untuk sisanya.
 */
export function hitungKasSistem({
  modalAwal = 0, sales = [], expenses = [], incomes = []
} = {}) {
  const cashSales = (sales || []).filter(isCashSale);
  const tunai = sum(cashSales, 'totalHarga');
  const nonTunai = sum((sales || []).filter(s => !isCashSale(s)), 'totalHarga');
  const keluar = sum(onlyCash(expenses));
  const masuk = sum(onlyCash(incomes));
  const sistem = (Number(modalAwal) || 0) + tunai - keluar + masuk;
  return { modalAwal: Number(modalAwal) || 0, tunai, nonTunai, keluar, masuk, sistem };
}

/**
// Rincian "dompet digital" satu periode: uang yang lewat rekening/QRIS, bukan
// laci. Menampilkan ini saat tutup kas membuat angka laci yang kecil tetap
// masuk akal — penjualannya ada, cuma tidak di sini.
//
//   masuk  = penjualan non-tunai + pemasukan non-tunai
//   keluar = pengeluaran non-tunai
//
// `rows` sudah terurut tetap (qris → transfer → lain) dan hanya berisi metode
// yang benar-benar dipakai, jadi UI tidak perlu menyaring nol.
 */
export function rinciDompetDigital({ sales = [], expenses = [], incomes = [] } = {}) {
  const ORDER = ['qris', 'transfer', 'lain'];
  const per = {};
  const ensure = m => {
    if (!per[m]) per[m] = { metode: m, label: METODE_LABEL[m] || METODE_LABEL.lain, masuk: 0, keluar: 0, trxMasuk: 0, trxKeluar: 0 };
    return per[m];
  };

  for (const s of sales || []) {
    const m = metodeNonTunai(s);
    if (!m) continue;
    const e = ensure(m);
    e.masuk += Number(s?.totalHarga) || 0;
    e.trxMasuk += 1;
  }
  for (const r of incomes || []) {
    const m = metodeNonTunai(r);
    if (!m) continue;
    const e = ensure(m);
    e.masuk += Number(r?.jumlah) || 0;
    e.trxMasuk += 1;
  }
  for (const r of expenses || []) {
    const m = metodeNonTunai(r);
    if (!m) continue;
    const e = ensure(m);
    e.keluar += Number(r?.jumlah) || 0;
    e.trxKeluar += 1;
  }

  const rows = ORDER.filter(m => per[m]).map(m => per[m]);
  const masuk = rows.reduce((a, r) => a + r.masuk, 0);
  const keluar = rows.reduce((a, r) => a + r.keluar, 0);
  return {
    rows,
    masuk,
    keluar,
    net: masuk - keluar,
    trxMasuk: rows.reduce((a, r) => a + r.trxMasuk, 0),
    trxKeluar: rows.reduce((a, r) => a + r.trxKeluar, 0)
  };
}

// Selisih = uang fisik hasil menghitung laci − perkiraan sistem.
// Positif = kelebihan (lebih besar dari catatan), negatif = kekurangan.
export function hitungSelisih(fisik, sistem) {
  const s = (Number(fisik) || 0) - (Number(sistem) || 0);
  return Number.isFinite(s) ? s : 0;
}

// "3 jam 12 menit" / "12 menit" — untuk ringkasan durasi shift.
export function durasiStr(lamaMs) {
  const menitTotal = Math.max(0, Math.floor((Number(lamaMs) || 0) / 60000));
  const j = Math.floor(menitTotal / 60);
  const m = menitTotal % 60;
  if (j >= 24) {
    const h = Math.floor(j % 24);
    return Math.floor(j / 24) + ' hari ' + h + ' jam';
  }
  return (j > 0 ? j + ' jam ' : '') + m + ' menit';
}

/**
// Rekap satu tahun kalender untuk TUTUP BUKU.
//
// Laba memakai hitungLaba() — definisi yang sama persis dengan Beranda &
// Laporan, dan kategori non-usaha (Modal Tambahan / Setor Bank / Prive) sudah
// dikecualikan di sana.
//
// `kasAkhir`  = arus kas TUNAI kumulatif sampai 31 Desember tahun itu, TANPA
//               modal awal laci (modal awal hanya menghitung ulang uang yang
//               sudah ada di laci, jadi memasukkannya akan membuat saldo
//               membengkak tiap ganti shift).
// `nonTunai`  = uang digital kumulatif periode yang sama (rekening, bukan laci).
 */
export function rekapTahun({ sales = [], expenses = [], incomes = [], tahun }) {
  const y = String(tahun);
  const padaTahun = rows => (rows || []).filter(r => String(r?.tanggal || '').slice(0, 4) === y);
  const sampaiAkhir = rows => (rows || []).filter(r => String(r?.tanggal || '') <= y + '-12-31');

  const sTahun = padaTahun(sales).filter(s => s?.status !== 'held');
  const eTahun = padaTahun(expenses);
  const iTahun = padaTahun(incomes);

  const omzet = sum(sTahun, 'totalHarga');
  const totalModal = sum(sTahun, 'totalModal');
  const laba = hitungLaba({ omzet, totalModal, expenses: eTahun, incomes: iTahun });

  const arusKas =
    sum(sampaiAkhir((sales || []).filter(s => s?.status !== 'held' && isCashSale(s))), 'totalHarga') -
    sum(sampaiAkhir(onlyCash(expenses))) +
    sum(sampaiAkhir(onlyCash(incomes)));

  const digital = rinciDompetDigital({
    sales: sampaiAkhir((sales || []).filter(s => s?.status !== 'held')),
    expenses: sampaiAkhir(expenses),
    incomes: sampaiAkhir(incomes)
  });

  return {
    tahun: Number(tahun),
    jumlahTransaksi: sTahun.length,
    omzet,
    totalModal,
    totalExpense: laba.expenseLaba,
    totalIncome: laba.incomeLaba,
    nonLabaKeluar: laba.nonLabaKeluar,
    nonLabaMasuk: laba.nonLabaMasuk,
    laba: laba.laba,
    kasAkhir: arusKas,
    nonTunai: digital.net
  };
}
