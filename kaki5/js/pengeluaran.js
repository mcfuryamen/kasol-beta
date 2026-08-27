// ==================== PENGELUARAN (ESM) ====================
// Expense capture. The expense LIST is rendered inside the Laporan page
// (laporan.js), so this module only handles the capture form + persistence.
import { DB } from './db.js';
import { showToast } from './helpers.js';
import { expDate } from './app-state.js';
import { loadReport } from './laporan.js';
import { openModal, closeModal } from './modal.js';

export async function openExpenseForm(prefill = {}) {
  document.getElementById('editExpenseId').value = '';
  document.getElementById('expKeterangan').value = prefill.keterangan || '';
  document.getElementById('expKategori').value = prefill.kategori || 'Bahan Baku';
  document.getElementById('expJumlah').value = prefill.jumlah || '';
  await openModal('expenseModal');
}

export function closeExpenseModal() {
  closeModal('expenseModal');
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
    suplayer: kategori === 'Setoran Konsinyasi'
      ? keterangan.match(/^Setoran (.+?) ·/)?.[1] || ''
      : '',
    waktu: Date.now()
  });

  closeExpenseModal();
  await loadReport(); // refresh the integrated expense view on the Laporan page
  showToast('✅ Pengeluaran dicatat!');
}
