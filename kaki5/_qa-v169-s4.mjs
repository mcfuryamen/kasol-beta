// ==================== EXPENSE DETAIL (ESM) ====================
// Modal detail catatan pengeluaran/pemasukan — mirip trxdetail.js tapi untuk
// baris tabel `pengeluaran`.
// v160 (audit pemasukan): dulu modal ini BUTA JENIS — judul, warna, dan angka
// selalu "pengeluaran" (merah) padahal pemasukan disimpan di tabel yang sama
// dengan jenis:'pemasukan'. Sekarang jenis-sadar, plus tombol hapus: sebelum
// v160 catatan pemasukan tidak bisa dikoreksi lewat UI sama sekali.
import { DB } from './db.js';
import { escapeHtml, formatRp, formatDate, formatTime, showToast } from './helpers.js';
import { openModal, closeModal } from './modal.js';
import { showConfirm } from './confirm.js';
import { currentPage } from './app-state.js';
import { loadBeranda } from './beranda.js';
// v165: loadReport() tidak dipanggil lagi di sini — penyegaran Laporan lewat
// kas.refreshKasViews() supaya satu jalur untuk semua halaman (lihat hapusExpense).
import { peringatanTahunTertutup } from './kas.js';
// v164: catatan kini membawa metode (tunai laci / QRIS / transfer) dan kategori
// non-usaha — keduanya wajib terlihat di detail supaya user paham kenapa angka
// Laba tidak berubah.
import { metodeCatatan, isNonLaba, METODE_LABEL } from './kas.logic.js';

const CAT_EMOJI = {
  'Bahan Baku': '🥬',
  'Gas & BBM': '⛽',
  'Sewa Tempat': '🏪',
  'Peralatan': '🍳',
  'Setoran Konsinyasi': '🤝',
  'Retur Konsinyasi': '↩️',
  'Setor Bank / Prive': '🏧',
  'Lainnya': '📦'
};

// Kategori form Pemasukan (index.html #incKategori) — setnya beda dari
// pengeluaran, jadi butuh map emoji sendiri.
const INC_EMOJI = {
  'Pemasukan Lain': '💰',
  'Penjualan Non-Menu': '🛍️',
  'Bonus / Cashback': '🎁',
  'Modal Tambahan': '🏦',
  'Lainnya': '📦'
};

export async function showExpenseDetail(id) {
  try {
    const exp = await DB.pengeluaran.get(id);
    if (!exp) {
      console.error('[ExpenseDetail] Catatan tidak ditemukan:', id);
      return;
    }

    const isInc = exp.jenis === 'pemasukan';
    const emoji = (isInc ? INC_EMOJI : CAT_EMOJI)[exp.kategori] || (isInc ? '💰' : '📦');
    const accent = isInc ? 'var(--green)' : 'var(--red)';
    const accentBg = isInc ? 'var(--green-bg)' : 'var(--red-bg)';
    const metode = metodeCatatan(exp);
    const nonLaba = isNonLaba(exp);

    let html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${isInc ? '💰 Detail Pemasukan' : '💸 Detail Pengeluaran'}</div>

      <div style="background:${accentBg};border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">
        <div class="kfs48 kmb8">${escapeHtml(emoji)}</div>
        <div class="kfs28 kfw800 kmb8" style="color:${accent}">${isInc ? '+' : '-'}${formatRp(exp.jumlah)}</div>
        <div class="kfs13 ktext2">${escapeHtml(exp.kategori || (isInc ? 'Pemasukan Lain' : 'Lainnya'))}</div>
        <div style="font-size:12px;margin-top:6px;color:var(--text2)">${escapeHtml(METODE_LABEL[metode] || metode)}${nonLaba ? ' · <b style="color:var(--orange)">tidak masuk Laba</b>' : ''}</div>
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

      <!-- v165 (poin 6): salah catat tidak perlu dihapus-lalu-tulis-ulang; tombol ini membuka form pencatatan yang sama dalam mode edit, lengkap dengan pemilih tanggal. -->
      <div class="btn-row kmt16">
        <button class="btn btn-primary" data-action="edit-expense" data-id="${exp.id}">✏️ Ubah Catatan</button>
      </div>
      <div class="hint kmt8" style="margin-top:6px">Isi keterangan, jenis, jumlah, metode, dan tanggal bisa dikoreksi. Nomor catatan dipertahankan selama tanggalnya tidak diganti.</div>
      <div class="kgrid-2col-gap8" style="margin-top:10px">
        <button class="btn btn-secondary" data-action="close-expense-detail">Tutup</button>
        <button class="btn btn-red" data-action="delete-expense" data-id="${exp.id}">🗑️ Hapus</button>
      </div>
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

// Hapus catatan pengeluaran/pemasukan. Pola ikut trxdetail.js: konfirmasi dulu,
// tutup modal, lalu refresh halaman yang sedang tampil supaya angkanya langsung
// cocok (Beranda & Laporan menghitung dari tabel yang sama).
export async function hapusExpense(id) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return;
  // v161: ingatkan kalau tahun catatan ini sudah ditutup buku.
  const row = await DB.pengeluaran.get(numId);
  const pesan = await peringatanTahunTertutup(row?.tanggal, 'catatan ini');
  showConfirm('🗑️', pesan, 'Ya, Hapus', async () => {
    await DB.pengeluaran.delete(numId);
    closeExpenseDetail();
    showToast('Catatan dihapus');
    if (currentPage === 'beranda') await loadBeranda();
    // v165: kartu kas Beranda dan blok kas di Laporan membaca tabel yang sama.
    // refreshKasViews() mengurus keduanya (Laporan hanya bila sedang dibuka),
    // jadi hapusan dari halaman mana pun langsung terlihat di angka laci.
    try { const kas = await import('./kas.js'); await kas.refreshKasViews(); } catch (_) { /* bukan fatal */ }
  });
}

// Export ke window hanya untuk yang dipanggil via inline HTML onclick attribute
// di tempat yang BUKAN lewat showPage dispatch. Lihat app.js untuk wiring terpusat.
// (Audit 2026-08-09: hapus self-wire untuk showExpenseDetail — duplikat dgn app.js:72)
