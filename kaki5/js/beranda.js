// ==================== BERANDA (ESM) ====================
import { DB, getSetting } from './db.js';
import { escapeHtml, todayStr, formatRp, formatDate, formatTime, dayName, getGreeting, withPageLoading, setStatValue } from './helpers.js';
import { renderPlatformCarousel, platStopAuto } from './carousel.js';
import { renderKasCard } from './kas.js';
// v164: Laba Hari Ini tidak dihitung lokal lagi — Beranda, Laporan, dan tutup
// buku memanggil SATU fungsi (hitungLaba) supaya ketiga angka itu tidak bisa
// beda lagi seperti bug pemasukan v160.
import { hitungLaba, pisahkanCatatan } from './kas.logic.js';
import { registerCleanup } from './templates.js';

export const loadBeranda = withPageLoading('recentTrx', async function () {
  // P3b (audit 2026-09-05): hentikan auto-slide timer saat keluar dari Beranda.
  registerCleanup('beranda', platStopAuto);
  document.getElementById('greetText').textContent = getGreeting();
  document.getElementById('todayDate').textContent = dayName(todayStr()) + ', ' + formatDate(todayStr());

  let nama = await getSetting('namaUsaha', null);
  if (nama == null) nama = await getSetting('namaWarung', 'Warung Saya');
  if (nama == null || nama === '') nama = 'Warung Saya';
  const namaEl = document.getElementById('namaUsaha');
  if (namaEl) namaEl.textContent = nama;

  const tgl = todayStr();
  // Tiga query independen dijalankan barengan (bukan ngantri) — total waktu =
  // query terlama, bukan jumlahnya.
  const [penjualan, expRows, all] = await Promise.all([
    // v156: row status 'held' (pesanan ditahan) BUKAN penjualan — jangan ikut
    // omzet/transaksi/porsi di ringkasan hari ini maupun daftar transaksi terakhir.
    DB.penjualan.where('tanggal').equals(tgl).toArray().then(rows => rows.filter(s => s.status !== 'held')),
    DB.pengeluaran.where('tanggal').equals(tgl).toArray(),
    DB.penjualan.orderBy('id').reverse().filter(s => s.status !== 'held').limit(5).toArray()
  ]);

  // v160 (audit pemasukan): satu tabel dipakai dua jenis catatan. Baris
  // jenis:'pemasukan' BUKAN pengeluaran — dulu ikut dijumlahkan sebagai expense
  // sehingga mencatat pemasukan justru MEMOTONG "Laba Hari Ini" di Beranda,
  // padahal Laporan menambahkannya. Sekarang dua halaman membaca hal yang sama.
  // v164: kategori non-usaha (Modal Tambahan / Setor Bank / Prive) dikecualikan
  // dari Laba oleh hitungLaba() — uangnya tetap menggeser laci, hanya bukan
  // hasil usaha. Rinciannya tetap muncul di Laporan.
  const { expenses: pengeluaran, incomes: pemasukan } = pisahkanCatatan(expRows);

  const omzet = penjualan.reduce((s, p) => s + (p.totalHarga || 0), 0);
  const totalModal = penjualan.reduce((s, p) => s + (p.totalModal || 0), 0);
  const L = hitungLaba({ omzet, totalModal, expenses: pengeluaran, incomes: pemasukan });
  const expense = L.expenseLaba;
  const totalInc = L.incomeLaba;
  const profit = L.laba;
  const qty = penjualan.reduce((s, p) => s + (p.items ? p.items.reduce((q, it) => q + (it.qty || 0), 0) : 0), 0);

  // v178: pemasukan usaha (non-menu) ikut dihitung omzet — hint "+ pemasukan lain" dihapus
  const omzetTampil = omzet + totalInc;
  setStatValue(document.getElementById('todayOmzet'), formatRp(omzetTampil));
  setStatValue(document.getElementById('todayExpense'), formatRp(expense));
  setStatValue(document.getElementById('todayProfit'), formatRp(profit));
  document.getElementById('todayTrxCount').textContent = penjualan.length;
  document.getElementById('todayQtyCount').textContent = qty;
  const avgEl = document.getElementById('todayAvgTrx');
  if (avgEl) setStatValue(avgEl, formatRp(penjualan.length ? Math.round(omzetTampil / penjualan.length) : 0));
  // v178: hint "+ pemasukan lain" dihapus — pemasukan usaha kini masuk angka Omzet.

  // v161: kartu status kas (buka/tutup shift) — query sendiri, kegagalan
  // render tidak boleh menghentikan Beranda.
  try { await renderKasCard(); } catch (e) { console.warn('[BERANDA] kartu kas:', e?.message || e); }

  // Render platform carousel (PALING AWAL, selalu jalan walau belum ada transaksi)
  await renderPlatformCarousel();

  // Recent transactions (recent 5) — `all` sudah diambil di Promise.all di atas
  const recentEl = document.getElementById('recentTrx');
  if (!all.length) {
    recentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">Belum ada transaksi hari ini.<br>Yuk mulai jualan!</div></div>';
    return;
  }
  recentEl.innerHTML = all.map(s => {
    const d = new Date(s.waktu);
    // Format tanggal transaksi (s.waktu) jadi YYYY-MM-DD agar dayName sesuai hari transaksi
    const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const dayN = dayName(dStr);
    return `<div class="trx-item" data-action="show-trx-detail" data-trx-id="${s.id}">
      <div class="kflex-1">
        <div class="kfw700">${escapeHtml(dayN)} · ${formatTime(s.waktu)}</div>
        <div style="font-size:12px;color:var(--text2)">${s.items ? s.items.length : 0} item</div>
      </div>
      <div class="kfw800 kgreen">${formatRp(s.totalHarga)}</div>
    </div>`;
  }).join('');
});
