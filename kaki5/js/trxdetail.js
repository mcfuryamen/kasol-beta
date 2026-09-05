// ==================== TRX DETAIL (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime, showToast } from './helpers.js';
import { selectedTrxId, setSelectedTrxId, currentPage } from './app-state.js';
import { showConfirm } from './confirm.js';
import { loadBeranda } from './beranda.js';
import { loadReport } from './laporan.js';
import { openModal, closeModal } from './modal.js';
import { lineTotal, normalizeToppingQtys } from './pos.logic.js';
import { peringatanTahunTertutup } from './kas.js';

export async function showTrxDetail(id) {
  setSelectedTrxId(id);
  const s = await DB.penjualan.get(id);
  if (!s) return;

  let html = `<div class="kcenter kmb16">
    ${s.nomor ? `<div class="kfw800 kfs14" style="letter-spacing:.3px">${escapeHtml(String(s.nomor))}</div>` : ''}
    <div class="kfs13 ktext3">${formatDate(s.tanggal)} · ${formatTime(s.waktu)}</div>
  </div>`;

  // Catatan GLOBAL per transaksi (nama driver / no. orderan ojol / no. meja…)
  if (s.orderNote) {
    html += `<div style="margin:-6px 0 12px;padding:10px 12px;background:var(--orange-bg);border-radius:12px;font-size:13px"><b>📝 Catatan transaksi:</b> ${escapeHtml(s.orderNote)}</div>`;
  }

  if (s.items) {
    html += '<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:14px">';
    html += '<tr style="background:#f5f5f5"><th class="kp10 kleft">Menu</th><th class="kp10 kcenter">Jml</th><th class="kp10 kright">Harga</th></tr>';
    s.items.forEach(i => {
      // v158: kirim tipe pesanan record — transaksi Ojol menampilkan harga ojol
      // tersimpan (sama seperti nota/printer), bukan harga jual.
      const itemTotal = lineTotal(i, s.orderType || null);
      html += `<tr style="border-top:1px solid var(--border)"><td class="kp10 kfw600">${escapeHtml(i.nama)}`;
      // Topping list (dengan qty per-topping — sinkron dengan nota/cart via normalizeToppingQtys)
      if (Array.isArray(i.selectedToppings) && i.selectedToppings.length > 0) {
        const qtys = normalizeToppingQtys(i);
        const toppingLines = i.selectedToppings.map(t => {
          const tq = Math.max(1, parseInt(qtys[t.nama], 10) || 1);
          return `<div style="font-size:11px;color:var(--text2);font-weight:500;padding-left:10px;margin-top:2px">+ ${escapeHtml(t.nama)} ×${tq} <span style="color:var(--text3)">${formatRp(t.harga)}</span></div>`;
        }).join('');
        html += toppingLines;
      }
      // Catatan per menu terpilih (komentar browser #8) — hanya bila ada
      if (i.catatanItem) {
        html += `<div style="font-size:11px;color:var(--text2);font-weight:500;padding-left:10px;margin-top:2px">📝 ${escapeHtml(i.catatanItem)}</div>`;
      }
      html += `</td><td class="kp10 kcenter">${i.qty}</td><td style="padding:10px;text-align:right;font-weight:700">${formatRp(itemTotal)}</td></tr>`;
    });
    html += '</table></div>';
  }

  // Metode pembayaran (fitur 2026-08-31). Transaksi lama tanpa field ini
  // otomatis terbaca sebagai Tunai — tidak ada data yang berubah makna.
  const PAY_LABELS = { tunai: '💵 Tunai', qris: '📱 QRIS', transfer: '🏦 Transfer' };
  const payLabel = PAY_LABELS[s.metodeBayar] || '💵 Tunai';
  html += `<div style="margin-top:12px;padding:12px;background:#f9f9f9;border-radius:12px">
    <div class="kflex-between kmb8"><span>Total</span><strong>${formatRp(s.totalHarga)}</strong></div>
    <div class="kflex-between kmb8"><span>Metode</span><strong>${escapeHtml(payLabel)}</strong></div>
    ${s.refBayar ? `<div class="kflex-between kmb8"><span>No. Referensi</span><strong>${escapeHtml(s.refBayar)}</strong></div>` : ''}
    ${s.catatanBayar ? `<div class="kflex-between kmb8"><span>Catatan bayar</span><strong>${escapeHtml(s.catatanBayar)}</strong></div>` : ''}
    ${s.buktiBayar ? (() => {
      // M6 (audit 2026-09-05): whitelist scheme — dataURL (kamera) atau https.
      // Restore backup bisa menulis string arbitrer; atribut src dicek di sini.
      const src = (typeof s.buktiBayar === 'string' && /^data:image\//.test(s.buktiBayar))
        ? s.buktiBayar : (typeof s.buktiBayar === 'string' && /^https:\/\//.test(s.buktiBayar))
          ? s.buktiBayar : '';
      return src ? `<div style="margin:8px 0"><div style="font-size:12px;color:var(--text2);margin-bottom:4px">📸 Bukti pembayaran</div><img src="${src}" alt="Bukti pembayaran" style="max-width:100%;max-height:280px;border-radius:12px;border:1px solid var(--border);display:block"></div>` : '';
    })() : ''}
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

export async function hapusPenjualan() {
  const id = selectedTrxId;
  if (!id) return;
  // v161: ingatkan kalau tahun transaksi sudah ditutup buku.
  const row = await DB.penjualan.get(id);
  const pesan = await peringatanTahunTertutup(row?.tanggal, 'transaksi ini');
  showConfirm('🗑️', pesan, 'Ya, Hapus', async () => {
    await DB.penjualan.delete(id);
    closeTrxDetail();
    showToast('Transaksi dihapus');
    if (currentPage === 'beranda') await loadBeranda();
    else if (currentPage === 'laporan') await loadReport();
  });
}
