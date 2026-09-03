// ==================== PENGELUARAN (ESM) ====================
// Expense capture. The expense LIST is rendered inside the Laporan page
// (laporan.js), so this module only handles the capture form + persistence.
//
// v164: modal ini jadi SATU-SATUNYA jalan untuk mencatat uang yang keluar/masuk
// laci non-penjualan (fitur "catat kas manual" di Beranda dihapus). Karena itu
// tiap catatan membawa `metodeBayar`: hanya 'tunai' yang menggeser isi laci.
//
// v165 (poin 6): form ini sekarang punya (a) pemilih TANGGAL dan (b) jalur
// UBAH catatan. Dua hal yang sebelumnya membuat salah catat harus dihapus-
// lalu-tulis-ulang (nomor & jejak waktunya hilang).
//   - Tanggal dulu diam-diam memakai `expDate` (state navigasi Laporan) yang
//     tidak pernah di-set siapa pun = selalu hari ini. Sekarang eksplisit.
//   - `waktu` (ms) ikut tanggal, BUKAN waktu klik. Kartu kas & modal Tutup Kas
//     menyaring baris dengan `waktu` antara jam buka-shift dan sekarang
//     (lihat dataShift di kas.js) — kalau `waktu` dibiarkan now, catatan
//     "kemarin" akan ikut menggeser laci shift hari ini.
import { DB } from './db.js';
import { showToast, todayStr } from './helpers.js';
import { loadReport } from './laporan.js';
import { openModal, closeModal } from './modal.js';
import { nextNomor } from './nomor.js';
import { showConfirm } from './confirm.js';

// Nilai select #expMetode / #incMetode. Sama seperti penjualan (`metodeBayar`).
const METODE_SAH = ['tunai', 'qris', 'transfer'];
const LABEL_METODE = { tunai: 'dari laci', qris: 'via QRIS', transfer: 'via transfer' };
const RE_TGL = /^\d{4}-\d{2}-\d{2}$/;

// Satu modal, dua jenis catatan. Dipetakan sekali supaya isi-form / baca-form /
// simpan tidak perlu disalin dua kali — salinan ganda itulah yang dulu bikin tab
// Pemasukan lupa mereset state edit.
const FIELD = {
  keluar: {
    tab: 'expense', body: 'txnExpenseBody',
    ket: 'expKeterangan', kat: 'expKategori', jml: 'expJumlah', met: 'expMetode', tgl: 'expTanggal',
    kategoriDefault: 'Bahan Baku', judul: '🧾 Catat Pengeluaran', judulEdit: '✏️ Ubah Pengeluaran'
  },
  masuk: {
    tab: 'income', body: 'txnIncomeBody',
    ket: 'incKeterangan', kat: 'incKategori', jml: 'incJumlah', met: 'incMetode', tgl: 'incTanggal',
    kategoriDefault: 'Pemasukan Lain', judul: '💰 Catat Pemasukan', judulEdit: '✏️ Ubah Pemasukan'
  }
};
// Kunci untuk nomor.js (BLJ = pengeluaran, MSK = pemasukan).
const NOMOR_KUNCI = { keluar: 'pengeluaran', masuk: 'pemasukan' };

const el = (id) => document.getElementById(id);

function bacaMetode(id) {
  const v = String(el(id)?.value || 'tunai').toLowerCase();
  return METODE_SAH.includes(v) ? v : 'tunai';
}

// ── state edit ───────────────────────────────────────────────────────────────
// Baris `pengeluaran` yang sedang diubah, atau 0 untuk catatan baru.
export function setEditId(id) {
  const e = el('editExpenseId');
  if (e) e.value = id ? String(id) : '';
}
export function getEditId() {
  const n = Number(el('editExpenseId')?.value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function labelForm(jenis, sedangEdit) {
  const f = FIELD[jenis];
  const t = el('expenseModalTitle');
  if (t) t.textContent = sedangEdit ? f.judulEdit : f.judul;
  const b = el('saveTxnBtn');
  if (b) b.textContent = sedangEdit ? '💾 Simpan Perubahan' : '💾 Simpan';
}

// Kategori lama/custom bisa tidak ada di <option> statis. Kalau nilainya
// dilempar begitu saja, select jadi kosong dan simpan berikutnya MENIMPA
// kategori user dengan default — jadi opsinya dibuatkan dulu.
function pilihOpsi(selectEl, value) {
  if (!selectEl) return;
  const v = String(value ?? '');
  if (!v) return;
  if (!Array.from(selectEl.options).some(o => o.value === v)) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  }
  selectEl.value = v;
}

// Tanggal input selalu YYYY-MM-DD; kosong/rusak → hari ini.
function bacaTanggal(id) {
  const v = String(el(id)?.value || '').trim();
  return RE_TGL.test(v) ? v : todayStr();
}

// `waktu` untuk tanggal tertentu: hari ini = sekarang; tanggal lain = jam 12:00
// hari itu. Tengah hari dipilih supaya pasti jatuh di dalam jam operasional
// (kios buka sekitar 10:30, tutup malam) — kalau ikut jam klik, catatan mundur
// yang dibuat pagi hari bisa jatuh SEBELUM jam buka shift hari itu dan hilang
// dari rekap shift tersebut. Laporan tidak terpengaruh: dia menyaring `tanggal`.
export function waktuUntukTanggal(tanggalStr) {
  if (tanggalStr === todayStr()) return Date.now();
  const parts = String(tanggalStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return Date.now();
  const ms = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

// Setoran konsinyasi memakai keterangan berformat "Setoran <suplayer> · ..."
function suplayerUntuk(kategori, keterangan) {
  if (kategori !== 'Setoran Konsinyasi') return '';
  return String(keterangan || '').match(/^Setoran (.+?) ·/)?.[1] || '';
}

// Tahun yang sudah ditutup buku? Data lama SENGAJA tidak dikunci (mengunci
// berarti salah catat tidak bisa dikoreksi), tapi user wajib diperingatkan.
// Lewat dynamic import: kas.js mengimpor modul ini saat tombol Beranda dipakai,
// siklus impor statis bikin salah satunya undefined saat boot.
async function tahunSudahDitutup(tanggalStr) {
  try {
    const kas = await import('./kas.js');
    const set = await kas.tahunTertutup();
    return set.has(Number(String(tanggalStr).slice(0, 4)));
  } catch (_) {
    return false;
  }
}

// ── Buka / isi form ──────────────────────────────────────────────────────────

// Pindah tab di dalam modal. PENTING (v165): pindah tab = pindah objek, jadi
// state edit WAJIB dilepas di sini. Tanpa ini, user yang sedang mengubah
// catatan Pengeluaran lalu tap tab "Pemasukan" akan menimpa baris pengeluaran
// tadi dengan field pemasukan.
export function switchTxnTab(mode) {
  const jenis = mode === 'income' ? 'masuk' : 'keluar';
  const f = FIELD[jenis];
  document.querySelectorAll('#expenseModal .txn-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.txntab === mode);
  });
  const expBody = el('txnExpenseBody');
  const incBody = el('txnIncomeBody');
  if (expBody) expBody.style.display = jenis === 'keluar' ? 'block' : 'none';
  if (incBody) incBody.style.display = jenis === 'masuk' ? 'block' : 'none';
  setEditId('');
  labelForm(jenis, false);
  return jenis;
}

function isiForm(jenis, prefill = {}) {
  const f = FIELD[jenis];
  const editId = Number(prefill.id) > 0 ? Number(prefill.id) : 0;
  setEditId(editId);
  const ket = el(f.ket); if (ket) ket.value = prefill.keterangan || '';
  pilihOpsi(el(f.kat), prefill.kategori || f.kategoriDefault);
  const jml = el(f.jml); if (jml) jml.value = prefill.jumlah || '';
  const met = el(f.met); if (met) met.value = METODE_SAH.includes(prefill.metodeBayar) ? prefill.metodeBayar : 'tunai';
  const tgl = el(f.tgl);
  if (tgl) {
    tgl.max = todayStr();                       // cegah tanggal masa depan di picker
    tgl.value = RE_TGL.test(String(prefill.tanggal || '')) ? prefill.tanggal : todayStr();
  }
  labelForm(jenis, !!editId);
}

export async function openExpenseForm(prefill = {}) {
  switchTxnTab('expense');
  isiForm('keluar', prefill);
  await openModal('expenseModal');
}

export async function openIncomeForm(prefill = {}) {
  switchTxnTab('income');
  isiForm('masuk', prefill);
  await openModal('expenseModal');
}

// Buka modal ini dari Beranda untuk "nambah/ambil uang laci" (v164).
// mode: 'keluar' → tab Pengeluaran, 'masuk' → tab Pemasukan.
export async function bukaCatatanKas(mode = 'keluar') {
  if (mode === 'masuk') await openIncomeForm();
  else await openExpenseForm({ kategori: 'Setor Bank / Prive' });
}

// Titik masuk UBAH catatan (v165): dipanggil dari modal detail (expensedetail.js)
// lewat data-action="edit-expense". Baris dibaca lagi dari DB — bukan dari
// HTML — jadi angka yang diedit dijamin yang tersimpan.
export async function ubahCatatan(id) {
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) { showToast('Catatan tidak dikenali', 'error'); return; }
  let row = null;
  try { row = await DB.pengeluaran.get(numId); } catch (e) { row = null; }
  if (!row) { showToast('Catatan sudah tidak ada', 'error'); return; }
  try {
    const d = await import('./expensedetail.js');
    d.closeExpenseDetail();
  } catch (_) { /* detail memang bisa dibuka dari tempat lain */ }
  const jenis = row.jenis === 'pemasukan' ? 'masuk' : 'keluar';
  if (jenis === 'masuk') await openIncomeForm({ ...row, id: numId });
  else await openExpenseForm({ ...row, id: numId });
}

export function closeExpenseModal() {
  setEditId('');
  closeModal('expenseModal');
}

// ── Simpan (baru / ubah) ─────────────────────────────────────────────────────

// Kartu kas di Beranda menghitung dari tabel yang sama — setelah simpan, angka
// "Kas sistem" wajib ikut berubah walau user sedang tidak di halaman Laporan.
async function refreshSetelahSimpan() {
  try { await loadReport(); } catch (e) { console.warn('[PENGELUARAN] refresh laporan:', e?.message || e); }
  try {
    const kas = await import('./kas.js');
    await kas.refreshKasViews();
  } catch (e) { console.warn('[PENGELUARAN] refresh kas:', e?.message || e); }
}

export async function saveTxn() {
  // Route sesuai tab aktif di modal catat transaksi
  const incomeActive = el('txnIncomeBody')?.style.display === 'block';
  return incomeActive ? simpanCatatan('masuk') : simpanCatatan('keluar');
}

// Baca + validasi form, lalu tulis. `saveExpense`/`saveIncome` lama diplekas ke
// sini supaya jalur baru dan jalur ubah tidak bisa berbeda aturan.
export async function simpanCatatan(jenis) {
  const f = FIELD[jenis];
  const keterangan = String(el(f.ket)?.value || '').trim();
  const kategori = String(el(f.kat)?.value || f.kategoriDefault);
  const jumlah = parseInt(el(f.jml)?.value, 10) || 0;
  const metodeBayar = bacaMetode(f.met);
  const tanggal = bacaTanggal(f.tgl);
  const editId = getEditId();

  if (!keterangan) { showToast('Keterangan harus diisi!', 'error'); return; }
  if (jumlah <= 0) { showToast('Jumlah harus diisi!', 'error'); return; }
  if (!RE_TGL.test(tanggal)) { showToast('Tanggal belum benar (format YYYY-MM-DD)', 'error'); return; }
  if (tanggal > todayStr()) { showToast('Tanggal tidak boleh di masa depan', 'error'); return; }

  const data = { jenis, editId, keterangan, kategori, jumlah, metodeBayar, tanggal };

  if (await tahunSudahDitutup(tanggal)) {
    const apa = editId ? 'Mengubah catatan di tahun itu' : 'Mencatat di tahun itu';
    showConfirm('📕',
      'Tahun ' + tanggal.slice(0, 4) + ' SUDAH ditutup buku. ' + apa +
      ' akan membuat rekap tahunan tidak cocok lagi. Lanjut simpan?',
      'Ya, Lanjut', () => { tulisCatatan(data); },
      'Batal');
    return;
  }
  await tulisCatatan(data);
}

async function tulisCatatan(d) {
  const kunci = NOMOR_KUNCI[d.jenis];
  let lama = null;
  if (d.editId) {
    lama = await DB.pengeluaran.get(d.editId);
    if (!lama) { showToast('Catatan sudah terhapus, tidak jadi diubah', 'error'); setEditId(''); return; }
    // Jangan biarkan jenis berubah lewat tab: baris pemasukan disimpan lewat
    // form pemasukan saja.
    const jenisLama = lama.jenis === 'pemasukan' ? 'masuk' : 'keluar';
    if (jenisLama !== d.jenis) { showToast('Catatan ini bukan ' + (d.jenis === 'masuk' ? 'pemasukan' : 'pengeluaran'), 'error'); return; }
  }

  // Nomor & waktu terikat tanggal. Tanggal sama → pertahankan nomor & waktu
  // aslinya (urutan harian & keanggotaan shift tidak berubah). Tanggal beda →
  // hitung nomor baru untuk hari itu dan pindahkan waktunya.
  const gantiTanggal = !lama || lama.tanggal !== d.tanggal;
  const waktu = gantiTanggal ? waktuUntukTanggal(d.tanggal) : lama.waktu;

  await DB.transaction('rw', DB.pengeluaran, async () => {
    if (d.editId) {
      const nomor = gantiTanggal ? await nextNomor(kunci, d.tanggal) : lama.nomor;
      await DB.pengeluaran.update(d.editId, {
        tanggal: d.tanggal,
        keterangan: d.keterangan,
        kategori: d.kategori,
        jumlah: d.jumlah,
        suplayer: suplayerUntuk(d.kategori, d.keterangan),
        metodeBayar: d.metodeBayar,
        nomor,
        waktu
      });
    } else {
      const nomor = await nextNomor(kunci, d.tanggal);
      // Konvensi tabel: pengeluaran TIDAK punya field `jenis`; hanya pemasukan
      // yang ditulis 'pemasukan' (lihat pisahkanCatatan di kas.logic.js).
      await DB.pengeluaran.add({
        tanggal: d.tanggal,
        keterangan: d.keterangan,
        kategori: d.kategori,
        jumlah: d.jumlah,
        suplayer: suplayerUntuk(d.kategori, d.keterangan),
        ...(d.jenis === 'masuk' ? { jenis: 'pemasukan' } : {}),
        metodeBayar: d.metodeBayar,
        nomor,
        waktu
      });
    }
  });

  setEditId('');
  closeExpenseModal();
  await refreshSetelahSimpan();
  const kata = d.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran';
  showToast((d.editId ? '✅ ' + kata + ' diperbarui' : '✅ ' + kata + ' dicatat') + ' ' + LABEL_METODE[d.metodeBayar] + '!');
}

// ── Kompatibilitas nama lama ─────────────────────────────────────────────────
// `saveExpense` masih dipanggil lewat case 'save-expense' di app.js (tombol
// lama), `saveIncome` dipakai alur lain yang mengimpor modul ini langsung.
// Keduanya cuma meneruskan ke satu jalur simpan.
export async function saveExpense() { return simpanCatatan('keluar'); }
export async function saveIncome() { return simpanCatatan('masuk'); }
