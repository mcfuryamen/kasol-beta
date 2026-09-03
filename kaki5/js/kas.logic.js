// ==================== KAS LOGIC (ESM) ====================
// Fungsi MURNI untuk aritmetika laci kas — tanpa DOM, tanpa DB (lapisan yang
// sama dengan pos.logic.js / helpers.pure.js). Semua angka masuk sebagai
// argumen supaya bisa diuji dan dipakai ulang oleh kas.js, laporan.js, dan
// beranda.js tanpa saling mengimpor.
//
// Adopsi fitur buka/tutup kas + tutup buku dari Kasir Solo Rosok (v161),
// disesuaikan dengan skema kaki5: kaki5 TIDAK punya buku besar kas terpisah
// dari penjualan, jadi "kas sistem" dihitung ulang dari data yang sudah ada.

const TIPE_PEMASUKAN = 'pemasukan';

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

// Hanya uang TUNAI yang masuk laci. QRIS/Transfer mendarat di rekening, jadi
// tidak boleh dihitung sebagai kas fisik saat tutup kas.
export function isCashSale(sale) {
  return (sale?.metodeBayar || 'tunai') === 'tunai';
}

// Pisahkan satu tabel `pengeluaran` menjadi pengeluaran vs pemasukan.
// (v160: baris jenis:'pemasukan' BUKAN pengeluaran.)
export function pisahkanCatatan(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    expenses: list.filter(r => r?.jenis !== TIPE_PEMASUKAN),
    incomes: list.filter(r => r?.jenis === TIPE_PEMASUKAN)
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

/**
// Hitung perkiraan uang yang SEHARUSNYA ada di laci.
//
//   kas sistem = modal awal laci
//              + penjualan tunai (dalam rentang shift)
//              − pengeluaran
//              + pemasukan (bonus/cashback/modal tambahan)
//              + kas masuk manual   (nambah uang kembalian, dsb)
//              − kas keluar manual  (ambil uang buat setor bank, dsb)
//
// `nonTunai` ikut dikembalikan supaya UI bisa jujur menampilkan uang yang
// masuk rekening, bukan ke laci.
 */
export function hitungKasSistem({
  modalAwal = 0, sales = [], expenses = [], incomes = [], kasRows = []
} = {}) {
  const cashSales = sales.filter(isCashSale);
  const tunai = sum(cashSales, 'totalHarga');
  const nonTunai = sum(sales.filter(s => !isCashSale(s)), 'totalHarga');
  const keluar = sum(expenses);
  const masuk = sum(incomes);
  const kasMasuk = sum((kasRows || []).filter(k => k?.tipe === 'masuk'));
  const kasKeluar = sum((kasRows || []).filter(k => k?.tipe === 'keluar'));
  const sistem = (Number(modalAwal) || 0) + tunai - keluar + masuk + kasMasuk - kasKeluar;
  return { modalAwal: Number(modalAwal) || 0, tunai, nonTunai, keluar, masuk, kasMasuk, kasKeluar, sistem };
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
// Definisi `laba` disamakan dengan Beranda & Laporan (v160):
//   laba = omzet − modal barang − pengeluaran + pemasukan
// (di rosok, laba tahunan = jual − beli saja sehingga beda angka dengan
//  kartu laporan di aplikasi yang sama — itu tidak ikut diadopsi.)
//
// `kasAkhir` = arus kas kumulatif sampai 31 Desember tahun itu, TANPA modal
// awal laci (modal awal hanya menghitung ulang uang yang sudah ada di laci,
// jadi memasukkannya akan membuat saldo membengkak tiap ganti shift).
 */
export function rekapTahun({ sales = [], expenses = [], incomes = [], kasRows = [], tahun }) {
  const y = String(tahun);
  const padaTahun = rows => (rows || []).filter(r => String(r?.tanggal || '').slice(0, 4) === y);
  const sTahun = padaTahun(sales).filter(s => s?.status !== 'held');
  const eTahun = padaTahun(expenses);
  const iTahun = padaTahun(incomes);
  const kTahun = padaTahun(kasRows);

  const omzet = sum(sTahun, 'totalHarga');
  const totalModal = sum(sTahun, 'totalModal');
  const totalExpense = sum(eTahun);
  const totalIncome = sum(iTahun);

  const sampaiAkhir = rows => (rows || []).filter(r => String(r?.tanggal || '') <= y + '-12-31');
  const arusKas =
    sum(sampaiAkhir(sales.filter(s => s?.status !== 'held' && isCashSale(s))), 'totalHarga') -
    sum(sampaiAkhir(expenses)) +
    sum(sampaiAkhir(incomes)) +
    sum(sampaiAkhir(kasRows).filter(k => k?.tipe === 'masuk')) -
    sum(sampaiAkhir(kasRows).filter(k => k?.tipe === 'keluar'));

  return {
    tahun: Number(tahun),
    jumlahTransaksi: sTahun.length,
    omzet,
    totalModal,
    totalExpense,
    totalIncome,
    laba: omzet - totalModal - totalExpense + totalIncome,
    kasAkhir: arusKas
  };
}
