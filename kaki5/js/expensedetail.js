// ==================== EXPENSE DETAIL (ESM) ====================
// Modal detail pengeluaran — mirip trxdetail.js tapi untuk expense
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime } from './helpers.js';

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
        <div style="font-size:48px;margin-bottom:8px">${escapeHtml(emoji)}</div>
        <div style="font-size:28px;font-weight:800;color:var(--red);margin-bottom:4px">${formatRp(exp.jumlah)}</div>
        <div style="font-size:13px;color:var(--text2)">${escapeHtml(exp.kategori)}</div>
      </div>

      <div style="background:#f9f9f9;border-radius:10px;padding:14px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-size:20px">📝</span>
          <div style="flex:1">
            <div style="font-size:12px;color:var(--text3);margin-bottom:2px">Keterangan</div>
            <div style="font-weight:600;font-size:15px">${escapeHtml(exp.keterangan)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">📅</span>
          <div style="flex:1">
            <div style="font-size:12px;color:var(--text3);margin-bottom:2px">Tanggal & Waktu</div>
            <div style="font-weight:600;font-size:15px">${escapeHtml(formatDate(exp.tanggal))} • ${escapeHtml(formatTime(exp.waktu))}</div>
          </div>
        </div>
      </div>

      <button class="btn btn-secondary" onclick="document.getElementById('expenseDetailModal').classList.remove('show')">Tutup</button>
    `;

    document.getElementById('expenseDetailContent').innerHTML = html;
    document.getElementById('expenseDetailModal').classList.add('show');
  } catch (err) {
    console.error('[ExpenseDetail] Error:', err);
  }
}

// Export ke window untuk onclick handler
window.showExpenseDetail = showExpenseDetail;
