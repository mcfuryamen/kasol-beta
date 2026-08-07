// ==================== PENGELUARAN (ESM) ====================
// Expense capture. The expense LIST is rendered inside the Laporan page
// (laporan.js), so this module only handles the capture form + persistence.
import { DB } from './db.js';
import { showToast } from './helpers.js';
import { expDate } from './app-state.js';
import { loadReport } from './laporan.js';

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
  await loadReport(); // refresh the integrated expense view on the Laporan page
  showToast('✅ Pengeluaran dicatat!');
}
