// ==================== BERANDA (ESM) ====================
import { DB, getSetting } from './db.js';
import { escapeHtml, todayStr, formatRp, formatDate, formatTime, dayName, getGreeting, withPageLoading } from './helpers.js';
import { renderPlatformCarousel } from './carousel.js';

export const loadBeranda = withPageLoading('recentTrx', async function () {
  document.getElementById('greetText').textContent = getGreeting();
  document.getElementById('todayDate').textContent = dayName(todayStr()) + ', ' + formatDate(todayStr());

  const nama = await getSetting('namaWarung', 'Warung Saya');
  const namaEl = document.getElementById('namaWarung');
  if (namaEl) namaEl.textContent = nama;

  const tgl = todayStr();
  // Tiga query independen dijalankan barengan (bukan ngantri) — total waktu =
  // query terlama, bukan jumlahnya.
  const [penjualan, pengeluaran, all] = await Promise.all([
    DB.penjualan.where('tanggal').equals(tgl).toArray(),
    DB.pengeluaran.where('tanggal').equals(tgl).toArray(),
    DB.penjualan.orderBy('id').reverse().limit(5).toArray()
  ]);

  const omzet = penjualan.reduce((s, p) => s + (p.totalHarga || 0), 0);
  const expense = pengeluaran.reduce((s, p) => s + (p.jumlah || 0), 0);
  const totalModal = penjualan.reduce((s, p) => s + (p.totalModal || 0), 0);
  const profit = omzet - totalModal - expense;
  const qty = penjualan.reduce((s, p) => s + (p.items ? p.items.reduce((q, it) => q + (it.qty || 0), 0) : 0), 0);

  document.getElementById('todayOmzet').textContent = formatRp(omzet);
  document.getElementById('todayExpense').textContent = formatRp(expense);
  document.getElementById('todayProfit').textContent = formatRp(profit);
  document.getElementById('todayTrxCount').textContent = penjualan.length;
  document.getElementById('todayQtyCount').textContent = qty;
  const avgEl = document.getElementById('todayAvgTrx');
  if (avgEl) avgEl.textContent = formatRp(penjualan.length ? Math.round(omzet / penjualan.length) : 0);

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
    return `<div class="trx-item" onclick="showTrxDetail(${s.id})">
      <div style="flex:1">
        <div style="font-weight:700">${escapeHtml(dayN)} · ${formatTime(s.waktu)}</div>
        <div style="font-size:12px;color:var(--text2)">${s.items ? s.items.length : 0} item</div>
      </div>
      <div style="font-weight:800;color:var(--green)">${formatRp(s.totalHarga)}</div>
    </div>`;
  }).join('');
});
