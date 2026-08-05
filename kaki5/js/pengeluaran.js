// ==================== PENGELUARAN (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime, todayStr, addDays, showToast } from './helpers.js';
import { expDate, setExpDate } from './app-state.js';
import { showConfirm } from './confirm.js';

export async function loadExpenses() {
  await renderExpDateNav();
  const expenses = await DB.pengeluaran.where('tanggal').equals(expDate).toArray();
  const box = document.getElementById('expenseList');
  const totalBox = document.getElementById('expenseTotal');

  if (expenses.length === 0) {
    box.innerHTML = '<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-text">Belum ada pengeluaran<br>tanggal ini.</div></div>';
    totalBox.innerHTML = '';
    return;
  }

  const catEmoji = {'Bahan Baku':'🥬','Gas & BBM':'⛽','Sewa Tempat':'🏪','Peralatan':'🍳','Lainnya':'📦'};
  box.innerHTML = '<div class="card">' + expenses.sort((a,b) => b.waktu - a.waktu).map(e => `<div class="trx-item">
    <div class="trx-icon expense">${escapeHtml(catEmoji[e.kategori]||'💸')}</div>
    <div class="trx-info">
      <div class="trx-title">${escapeHtml(e.keterangan)}</div>
      <div class="trx-sub">${escapeHtml(e.kategori)} · ${escapeHtml(formatTime(e.waktu))}</div>
    </div>
    <div class="trx-actions">
      <div class="trx-amount red">-${formatRp(e.jumlah)}</div>
      <button class="btn-icon btn-ghost" style="width:44px;height:44px;min-height:44px;font-size:14px;color:var(--red)" onclick="confirmDeleteExpense(${e.id})">🗑️</button>
    </div>
  </div>`).join('') + '</div>';

  const total = expenses.reduce((a,e) => a + e.jumlah, 0);
  totalBox.innerHTML = `<div class="card" style="background:var(--red-bg);border-color:#EF9A9A;text-align:center">
    <div style="font-size:13px;color:var(--red);font-weight:600">Total Pengeluaran ${formatDate(expDate)}</div>
    <div style="font-size:22px;font-weight:800;color:var(--red)">${formatRp(total)}</div>
  </div>`;
}

async function renderExpDateNav() {
  const box = document.getElementById('expDateNav');
  const isToday = expDate === todayStr();
  box.innerHTML = `
    <button class="date-btn" onclick="navExpenseDate(-1)">‹</button>
    <div class="date-label">${isToday ? '📅 Hari Ini' : '📅 ' + formatDate(expDate)}</div>
    <button class="date-btn" onclick="navExpenseDate(1)">›</button>
  `;
}

// Window-wired date navigation
export function navExpenseDate(delta) {
  setExpDate(addDays(expDate, delta));
  loadExpenses();
}

export function openExpenseForm() {
  document.getElementById('editExpenseId').value = '';
  document.getElementById('expKeterangan').value = '';
  document.getElementById('expKategori').value = 'Bahan Baku';
  document.getElementById('expJumlah').value = '';
  document.getElementById('expenseModal').classList.add('show');
}

export function closeExpenseModal() {
  document.getElementById('expenseModal').classList.remove('show');
}

export async function saveExpense() {
  const keterangan = document.getElementById('expKeterangan').value.trim();
  const kategori = document.getElementById('expKategori').value;
  const jumlah = parseInt(document.getElementById('expJumlah').value) || 0;

  if (!keterangan) { showToast('Keterangan harus diisi!', 'error'); return; }
  if (jumlah <= 0) { showToast('Jumlah harus diisi!', 'error'); return; }

  await DB.pengeluaran.add({
    tanggal: expDate,
    keterangan,
    kategori,
    jumlah,
    waktu: Date.now()
  });

  closeExpenseModal();
  await loadExpenses();
  showToast('✅ Pengeluaran dicatat!');
}

export function confirmDeleteExpense(id) {
  showConfirm('🗑️', 'Yakin mau hapus pengeluaran ini?', 'Ya, Hapus', async () => {
    await DB.pengeluaran.delete(id);
    await loadExpenses();
    showToast('Pengeluaran dihapus');
  });
}
