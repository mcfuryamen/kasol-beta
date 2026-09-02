// ==================== EXPENSE DETAIL (ESM) ====================
// Modal detail pengeluaran — mirip trxdetail.js tapi untuk expense
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime } from './helpers.js';
import { openModal, closeModal } from './modal.js';

export async function showExpenseDetail(id) {
  try {
    const exp = await DB.pengeluaran.get(id);
    if (!exp) {
      console.error('[ExpenseDetail] Pengeluaran tidak ditemukan:', id);
      return;
    }

    const catEmoji = {
      'Bahan Baku': '🥬',
      'Gas & BBM': '⛽',
      'Sewa Tempat': '🏪',
      'Peralatan': '🍳',
      'Lainnya': '📦'
    };

    const emoji = catEmoji[exp.kategori] || '📦';

    let html = `
      <div class="modal-handle"></div>
      <div class="modal-title">💸 Detail Pengeluaran</div>
      
      <div style="background:var(--red-bg);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">
        <div class="kfs48 kmb8">${escapeHtml(emoji)}</div>
        <div class="kfs28 kfw800 kred kmb8">${formatRp(exp.jumlah)}</div>
        <div class="kfs13 ktext2">${escapeHtml(exp.kategori)}</div>
      </div>

      <div style="background:#f9f9f9;border-radius:10px;padding:14px;margin-bottom:12px">
        ${exp.nomor ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span class="kfs20">🔢</span><div class="kflex-1"><div style="font-size:12px;color:var(--text3);margin-bottom:2px">Nomor</div><div class="kfw600 kfs15">${escapeHtml(String(exp.nomor))}</div></div></div>` : ''}
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span class="kfs20">📝</span>
          <div class="kflex-1">
            <div style="font-size:12px;color:var(--text3);margin-bottom:2px">Keterangan</div>
            <div class="kfw600 kfs15">${escapeHtml(exp.keterangan)}</div>
          </div>
        </div>
        <div class="kflex-gap10">
          <span class="kfs20">📅</span>
          <div class="kflex-1">
            <div style="font-size:12px;color:var(--text3);margin-bottom:2px">Tanggal & Waktu</div>
            <div class="kfw600 kfs15">${escapeHtml(formatDate(exp.tanggal))} • ${escapeHtml(formatTime(exp.waktu))}</div>
          </div>
        </div>
      </div>

      <button class="btn btn-secondary" data-action="close-expense-detail">Tutup</button>
    `;

    document.getElementById('expenseDetailContent').innerHTML = html;
    await openModal('expenseDetailModal');
  } catch (err) {
    console.error('[ExpenseDetail] Error:', err);
  }
}

export function closeExpenseDetail() {
  closeModal('expenseDetailModal');
}

// Export ke window hanya untuk yang dipanggil via inline HTML onclick attribute
// di tempat yang BUKAN lewat showPage dispatch. Lihat app.js untuk wiring terpusat.
// (Audit 2026-08-09: hapus self-wire untuk showExpenseDetail — duplikat dgn app.js:72)
