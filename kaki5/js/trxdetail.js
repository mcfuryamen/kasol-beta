// ==================== TRX DETAIL (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime, showToast } from './helpers.js';
import { selectedTrxId, setSelectedTrxId, currentPage } from './app-state.js';
import { showConfirm } from './confirm.js';
import { loadBeranda } from './beranda.js';
import { loadReport } from './laporan.js';

export async function showTrxDetail(id) {
  setSelectedTrxId(id);
  const s = await DB.penjualan.get(id);
  if (!s) return;

  let html = `<div style="text-align:center;margin-bottom:16px">
    <div style="font-size:13px;color:var(--text3)">${formatDate(s.tanggal)} · ${formatTime(s.waktu)}</div>
  </div>`;

  if (s.items) {
    html += '<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:14px">';
    html += '<tr style="background:#f5f5f5"><th style="padding:10px;text-align:left">Menu</th><th style="padding:10px;text-align:center">Jml</th><th style="padding:10px;text-align:right">Harga</th></tr>';
    s.items.forEach(i => {
      html += `<tr style="border-top:1px solid var(--border)"><td style="padding:10px;font-weight:600">${escapeHtml(i.nama)}</td><td style="padding:10px;text-align:center">${i.qty}</td><td style="padding:10px;text-align:right;font-weight:700">${formatRp(i.qty*i.hargaJual)}</td></tr>`;
    });
    html += '</table></div>';
  }

  html += `<div style="margin-top:12px;padding:12px;background:#f9f9f9;border-radius:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Total</span><strong>${formatRp(s.totalHarga)}</strong></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Bayar</span><strong>${formatRp(s.bayar)}</strong></div>
    <div style="display:flex;justify-content:space-between"><span>Kembalian</span><strong>${formatRp(s.kembalian)}</strong></div>
    <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
    <div style="display:flex;justify-content:space-between"><span>Modal Bahan</span><span style="color:var(--red);font-weight:700">${formatRp(s.totalModal)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Untung Kotor</span><span style="color:var(--green);font-weight:700">${formatRp(s.totalHarga - s.totalModal)}</span></div>
  </div>`;

  document.getElementById('trxDetailContent').innerHTML = html;
  document.getElementById('trxDetailModal').classList.add('show');
}

export function closeTrxDetail() {
  document.getElementById('trxDetailModal').classList.remove('show');
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
