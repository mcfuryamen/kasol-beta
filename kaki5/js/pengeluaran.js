// ==================== PENGELUARAN (ESM) ====================
// Expense capture. The expense LIST is rendered inside the Laporan page
// (laporan.js), so this module only handles the capture form + persistence.
import { DB } from './db.js';
import { showToast } from './helpers.js';
import { expDate } from './app-state.js';
import { loadReport } from './laporan.js';
import { openModal, closeModal } from './modal.js';
import { nextNomor } from './nomor.js';

export async function openExpenseForm(prefill = {}) {
  switchTxnTab('expense');
  document.getElementById('editExpenseId').value = '';
  document.getElementById('expKeterangan').value = prefill.keterangan || '';
  document.getElementById('expKategori').value = prefill.kategori || 'Bahan Baku';
  document.getElementById('expJumlah').value = prefill.jumlah || '';
  await openModal('expenseModal');
}

export function closeExpenseModal() {
  closeModal('expenseModal');
}

// ── Tab transaksi: Pengeluaran | Pemasukan dalam satu modal ─────────────────
// Pemasukan disimpan ke tabel yang sama dengan jenis:'pemasukan' agar tidak
// perlu store baru; laporan memfilter berdasarkan field ini.

export function switchTxnTab(mode) {
  const expBody = document.getElementById('txnExpenseBody');
  const incBody = document.getElementById('txnIncomeBody');
  const title = document.getElementById('expenseModalTitle');
  document.querySelectorAll('#expenseModal .txn-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.txntab === mode);
  });
  if (expBody) expBody.style.display = mode === 'expense' ? 'block' : 'none';
  if (incBody) incBody.style.display = mode === 'income' ? 'block' : 'none';
  if (title) title.textContent = mode === 'income' ? '💰 Catat Pemasukan' : '🧾 Catat Pengeluaran';
}

export async function openIncomeForm() {
  switchTxnTab('income');
  document.getElementById('incKeterangan').value = '';
  document.getElementById('incJumlah').value = '';
  await openModal('expenseModal');
}

export async function saveTxn() {
  // Route sesuai tab aktif di modal catat transaksi
  const incomeActive = document.getElementById('txnIncomeBody')?.style.display === 'block';
  return incomeActive ? saveIncome() : saveExpense();
}

export async function saveIncome() {
  const kategori = document.getElementById('incKategori')?.value || 'Pemasukan Lain';
  const keterangan = document.getElementById('incKeterangan').value.trim();
  const jumlah = parseInt(document.getElementById('incJumlah').value) || 0;
  if (!keterangan) { showToast('Keterangan harus diisi!', 'error'); return; }
  if (jumlah <= 0) { showToast('Jumlah harus diisi!', 'error'); return; }
  await DB.transaction('rw', DB.pengeluaran, async () => {
    const nomor = await nextNomor('pemasukan', expDate);
    return DB.pengeluaran.add({
      tanggal: expDate,
      keterangan,
      kategori,
      jumlah,
      suplayer: '',
      jenis: 'pemasukan',
      nomor,
      waktu: Date.now()
    });
  });
  closeExpenseModal();
  await loadReport();
  showToast('✅ Pemasukan dicatat!');
}

export async function saveExpense() {
  const keterangan = document.getElementById('expKeterangan').value.trim();
  const kategori = document.getElementById('expKategori').value;
  const jumlah = parseInt(document.getElementById('expJumlah').value) || 0;

  if (!keterangan) { showToast('Keterangan harus diisi!', 'error'); return; }
  if (jumlah <= 0) { showToast('Jumlah harus diisi!', 'error'); return; }

  await DB.transaction('rw', DB.pengeluaran, async () => {
    const nomor = await nextNomor('pengeluaran', expDate);
    return DB.pengeluaran.add({
      tanggal: expDate,
      keterangan,
      kategori,
      jumlah,
      suplayer: kategori === 'Setoran Konsinyasi'
        ? keterangan.match(/^Setoran (.+?) ·/)?.[1] || ''
        : '',
      nomor,
      waktu: Date.now()
    });
  });

  closeExpenseModal();
  await loadReport(); // refresh the integrated expense view on the Laporan page
  showToast('✅ Pengeluaran dicatat!');
}
