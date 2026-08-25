// ==================== TRX DETAIL (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime, showToast } from './helpers.js';
import { selectedTrxId, setSelectedTrxId, currentPage } from './app-state.js';
import { showConfirm } from './confirm.js';
import { loadBeranda } from './beranda.js';
import { loadReport } from './laporan.js';
import { openModal, closeModal } from './modal.js';

export async function showTrxDetail(id) {
  setSelectedTrxId(id);
  const s = await DB.penjualan.get(id);
  if (!s) return;

  let html = `<div class="kcenter kmb16">
    <div class="kfs13 ktext3">${formatDate(s.tanggal)} · ${formatTime(s.waktu)}</div>
  </div>`;

  // Catatan pesanan (meja/pemesan/ojol)
  if (s.orderNote) {
    html += `<div style="margin:-6px 0 12px;padding:10px 12px;background:var(--orange-bg);border-radius:12px;font-size:13px"><b>📝 Catatan:</b> ${escapeHtml(s.orderNote)}</div>`;
  }

  if (s.items) {
    html += '<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:14px">';
    html += '<tr style="background:#f5f5f5"><th class="kp10 kleft">Menu</th><th class="kp10 kcenter">Jml</th><th class="kp10 kright">Harga</th></tr>';
    s.items.forEach(i => {
      html += `<tr style="border-top:1px solid var(--border)"><td class="kp10 kfw600">${escapeHtml(i.nama)}</td><td class="kp10 kcenter">${i.qty}</td><td style="padding:10px;text-align:right;font-weight:700">${formatRp(i.qty*i.hargaJual)}</td></tr>`;
    });
    html += '</table></div>';
  }

  html += `<div style="margin-top:12px;padding:12px;background:#f9f9f9;border-radius:12px">
    <div class="kflex-between kmb8"><span>Total</span><strong>${formatRp(s.totalHarga)}</strong></div>
    <div class="kflex-between kmb8"><span>Bayar</span><strong>${formatRp(s.bayar)}</strong></div>
    <div class="kflex-between"><span>Kembalian</span><strong>${formatRp(s.kembalian)}</strong></div>
    <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
    <div class="kflex-between"><span>Modal Bahan</span><span class="kreq">${formatRp(s.totalModal)}</span></div>
    <div class="kflex-between"><span>Untung Kotor</span><span style="color:var(--green);font-weight:700">${formatRp(s.totalHarga - s.totalModal)}</span></div>
  </div>`;

  document.getElementById('trxDetailContent').innerHTML = html;
  await openModal('trxDetailModal');
}

export function closeTrxDetail() {
  closeModal('trxDetailModal');
}

export function hapusPenjualan() {
  const id = selectedTrxId;
  if (!id) return;
  showConfirm('🗑️', 'Yakin mau hapus transaksi ini?', 'Ya, Hapus', async () => {
    await DB.penjualan.delete(id);
    closeTrxDetail();
    showToast('Transaksi dihapus');
    if (currentPage === 'beranda') await loadBeranda();
    else if (currentPage === 'laporan') await loadReport();
  });
}
