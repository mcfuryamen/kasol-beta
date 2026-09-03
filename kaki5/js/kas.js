// ==================== KAS (ESM) ====================
// Buka/tutup kas (shift laci) + catat kas manual + tutup buku tahunan.
// Diadopsi dari Kasir Solo Rosok (v161), ditulis ulang mengikuti aturan kaki5:
//   • tanpa inline onclick (CSP) — dipanggil lewat data-action di app.js
//   • aritmetika di kas.logic.js (fungsi murni), DB + DOM di sini
//   • "kas sistem" dihitung dari data yang sudah ada (penjualan tunai,
//     pengeluaran, pemasukan, kas manual) — kaki5 tidak punya buku besar kas
//     terpisah, jadi tidak ada baris kas yang ditulis ulang tiap transaksi.
import { DB } from './db.js';
import { showToast, formatRp, todayStr, formatDate, formatTime, escapeHtml } from './helpers.js';
import { openShift, setOpenShift, currentPage } from './app-state.js';
import { openModal, closeModal } from './modal.js';
import { showConfirm } from './confirm.js';
import {
  hitungKasSistem, hitungSelisih, durasiStr, pisahkanCatatan, dalamRentang, rekapTahun
} from './kas.logic.js';

// Tipe tab pada modal "Catat Kas" ('masuk' | 'keluar') — state modul, bukan app-state
let kasTipe = 'masuk';

// ── Status shift ────────────────────────────────────────────────────────────

// Ambil shift yang sedang terbuka. Bila ada lebih dari satu (mis. karena
// aplikasi dibuka di dua perangkat/tab), yang TERAKHIR dibuka yang dipakai —
// rosok memakai .first() sehingga shift lama menggantung selamanya.
export async function refreshShiftCache() {
  try {
    const buka = await DB.kasShift.where('status').equals('buka').sortBy('waktuBuka');
    if (buka.length > 1) {
      console.warn('[KAS] Ada ' + buka.length + ' shift berstatus buka — memakai yang terbaru (id ' + buka[buka.length - 1].id + ')');
    }
    setOpenShift(buka.length ? buka[buka.length - 1] : null);
  } catch (e) {
    console.error('[KAS] refreshShiftCache gagal:', e?.message || e);
    setOpenShift(null);
  }
  return openShift;
}

// Gerbang POS: selalu baca segar (satu query ber-index), jangan percaya cache.
export async function getOpenShift() {
  return refreshShiftCache();
}

export function isKasOpen() {
  return !!openShift;
}

// Kumpulkan semua data yang menentukan isi laci selama satu shift.
async function dataShift(shift, sampaiMs = Date.now()) {
  const dari = Number(shift?.waktuBuka) || 0;
  const [salesAll, expAll, kasAll] = await Promise.all([
    DB.penjualan.where('waktu').between(dari, sampaiMs).toArray(),
    DB.pengeluaran.where('waktu').between(dari, sampaiMs).toArray(),
    DB.kas.toArray()
  ]);
  const sales = salesAll.filter(s => s.status !== 'held');
  const { expenses, incomes } = pisahkanCatatan(expAll);
  const kasRows = dalamRentang(kasAll, dari, sampaiMs);
  return { sales, expenses, incomes, kasRows };
}

// Perhitungan lengkap satu shift (dipakai kartu Beranda + modal Tutup Kas).
export async function hitungShift(shift, sampaiMs = Date.now()) {
  const data = await dataShift(shift, sampaiMs);
  const hasil = hitungKasSistem({ modalAwal: shift?.modalAwal, ...data });
  return { ...hasil, jumlahTransaksi: data.sales.length, lamaMs: sampaiMs - (Number(shift?.waktuBuka) || sampaiMs) };
}

// Segarkan semua tampilan yang menampilkan angka kas: kartu Beranda selalu,
// Laporan hanya bila sedang dibuka (sama seperti pola pengeluaran.js).
async function refreshKasViews() {
  try { await renderKasCard(); } catch (e) { console.warn('[KAS] render kartu:', e?.message || e); }
  if (currentPage === 'laporan') {
    try {
      const m = await import('./laporan.js');
      await m.loadReport();
    } catch (_) { /* laporan akan dimuat ulang saat dibuka */ }
  }
}

// ── Buka Kas ────────────────────────────────────────────────────────────────

export async function openBukaKasModal() {
  const input = document.getElementById('bukaKasModalAwal');
  if (input) input.value = '';
  await refreshShiftCache();
  const info = document.getElementById('bukaKasInfo');
  if (info) {
    info.innerHTML = openShift
      ? 'Kas masih tercatat <b>buka</b> sejak ' + escapeHtml(formatTime(openShift.waktuBuka)) +
        ' (' + escapeHtml(formatDate(openShift.tanggalBuka)) + '). Menutup shift lama akan dilakukan otomatis.'
      : 'Hitung uang tunai yang ada di laci sekarang, lalu masukkan sebagai modal awal sebelum mulai jualan.';
  }
  await openModal('bukaKasModal');
}

export function closeBukaKasModal() {
  closeModal('bukaKasModal');
}

export async function bukaKas() {
  await refreshShiftCache();
  if (openShift) {
    showToast('Kas masih terbuka — tutup dulu shift yang lama 🔒', 'error', 3500);
    return;
  }
  const raw = (document.getElementById('bukaKasModalAwal')?.value || '').replace(/\D/g, '');
  const modalAwal = raw ? parseInt(raw, 10) : 0;
  if (modalAwal < 0) { showToast('Modal awal tidak boleh minus', 'error'); return; }

  const now = Date.now();
  await DB.kasShift.add({
    status: 'buka',
    tanggalBuka: todayStr(),
    waktuBuka: now,
    modalAwal,
    waktuTutup: null,
    kasSistemAkhir: null,
    kasFisikAkhir: null,
    selisih: null,
    catatanTutup: ''
  });
  closeBukaKasModal();
  await refreshShiftCache();
  await refreshKasViews();
  showToast('Kas dibuka. Selamat berjualan! 🎉');
}

// ── Tutup Kas ───────────────────────────────────────────────────────────────

export async function openTutupKasModal() {
  await refreshShiftCache();
  if (!openShift) { showToast('Kas belum dibuka', 'error'); return; }
  const shift = openShift;
  const h = await hitungShift(shift);
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  set('tutupKasWaktuLbl', formatDate(shift.tanggalBuka) + ' · ' + formatTime(shift.waktuBuka));
  set('tutupKasDurasiLbl', durasiStr(h.lamaMs));
  set('tutupKasTrxLbl', h.jumlahTransaksi + ' transaksi');
  set('tutupKasModalLbl', formatRp(h.modalAwal));
  set('tutupKasTunaiLbl', '+' + formatRp(h.tunai));
  set('tutupKasNonTunaiLbl', formatRp(h.nonTunai));
  set('tutupKasExpenseLbl', '−' + formatRp(h.keluar));
  set('tutupKasIncomeLbl', '+' + formatRp(h.masuk));
  const manualNet = h.kasMasuk - h.kasKeluar;
  const manualEl = document.getElementById('tutupKasManualLbl');
  if (manualEl) {
    manualEl.textContent = (manualNet > 0 ? '+' : manualNet < 0 ? '−' : '') + formatRp(Math.abs(manualNet));
    manualEl.style.color = manualNet > 0 ? 'var(--green)' : manualNet < 0 ? 'var(--red)' : 'var(--text2)';
  }
  set('tutupKasSistemLbl', formatRp(h.sistem));

  const sel = document.getElementById('tutupKasSelisih');
  if (sel) {
    sel.dataset.sistem = String(h.sistem);
    sel.textContent = '—';
    sel.style.color = 'var(--text3)';
  }
  const fisik = document.getElementById('tutupKasFisik');
  if (fisik) fisik.value = '';
  const cat = document.getElementById('tutupKasCatatan');
  if (cat) cat.value = '';
  await openModal('tutupKasModal');
}

export function closeTutupKasModal() {
  closeModal('tutupKasModal');
}

// Dipanggil tiap user mengetik jumlah uang fisik.
export function perbaruiSelisihUI() {
  const sel = document.getElementById('tutupKasSelisih');
  const fisikEl = document.getElementById('tutupKasFisik');
  if (!sel || !fisikEl) return;
  const sistem = parseFloat(sel.dataset.sistem) || 0;
  const raw = (fisikEl.value || '').replace(/\D/g, '');
  if (raw === '') {
    sel.textContent = '—';
    sel.style.color = 'var(--text3)';
    return;
  }
  const d = hitungSelisih(parseInt(raw, 10), sistem);
  sel.textContent = (d > 0 ? '+' : '') + formatRp(d);
  sel.style.color = d === 0 ? 'var(--green)' : 'var(--red)';
}

export async function tutupKas() {
  await refreshShiftCache();
  if (!openShift) { showToast('Kas belum dibuka', 'error'); return; }
  const shift = openShift;
  const fisikEl = document.getElementById('tutupKasFisik');
  const raw = (fisikEl?.value || '').trim().replace(/\D/g, '');
  // Input sudah berupa angka bersih; guard kosong/NaN tetap dipertahankan
  // (di rosok bug nyata: parseFloat("1.500.000") dibaca 1.5).
  if (raw === '') { showToast('Masukkan jumlah uang tunai fisik dulu', 'error', 3500); return; }
  const fisik = parseInt(raw, 10);
  if (!Number.isFinite(fisik)) { showToast('Jumlah uang fisik tidak valid', 'error'); return; }

  const h = await hitungShift(shift);
  const selisih = hitungSelisih(fisik, h.sistem);
  await DB.kasShift.update(shift.id, {
    status: 'tutup',
    waktuTutup: Date.now(),
    kasSistemAkhir: h.sistem,
    kasFisikAkhir: fisik,
    selisih,
    catatanTutup: (document.getElementById('tutupKasCatatan')?.value || '').trim()
  });
  closeTutupKasModal();
  await refreshShiftCache();
  await refreshKasViews();
  if (selisih === 0) showToast('Kas ditutup. Pas, tidak ada selisih! 👍');
  else showToast('Kas ditutup. Selisih ' + (selisih > 0 ? 'lebih ' : 'kurang ') + formatRp(Math.abs(selisih)), selisih > 0 ? 'success' : 'error', 4000);
}

// ── Catat Kas manual (bukan penjualan/pengeluaran) ──────────────────────────

export function setKasTab(mode) {
  kasTipe = mode === 'keluar' ? 'keluar' : 'masuk';
  document.querySelectorAll('#kasManualModal .txn-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.kastab === kasTipe);
  });
  const title = document.getElementById('kasManualModalTitle');
  if (title) title.textContent = kasTipe === 'keluar' ? '➖ Ambil Kas' : '➕ Tambah Kas';
  const ket = document.getElementById('kasKeterangan');
  if (ket) ket.placeholder = kasTipe === 'keluar'
    ? 'Contoh: Ambil uang buat setor bank'
    : 'Contoh: Nambah uang kembalian';
}

export async function openKasManualModal(mode = 'masuk') {
  await refreshShiftCache();
  setKasTab(mode);
  const j = document.getElementById('kasJumlah');
  if (j) j.value = '';
  const k = document.getElementById('kasKeterangan');
  if (k) k.value = '';
  const hint = document.getElementById('kasShiftHint');
  if (hint) {
    hint.textContent = openShift
      ? 'Dicatat pada shift yang sedang berjalan (sejak ' + formatTime(openShift.waktuBuka) + ').'
      : 'Belum ada shift buka — catatan ini tetap tersimpan dan ikut dihitung saat shift berikutnya memakai rentang waktunya.';
  }
  await openModal('kasManualModal');
}

export function closeKasManualModal() {
  closeModal('kasManualModal');
}

export async function saveKasManual() {
  const raw = (document.getElementById('kasJumlah')?.value || '').replace(/\D/g, '');
  const jumlah = raw ? parseInt(raw, 10) : 0;
  if (jumlah <= 0) { showToast('Isi jumlah uang dulu', 'error'); return; }
  const keterangan = (document.getElementById('kasKeterangan')?.value || '').trim()
    || (kasTipe === 'keluar' ? 'Ambil kas' : 'Tambah kas');
  await DB.kas.add({
    tanggal: todayStr(),
    waktu: Date.now(),
    tipe: kasTipe,
    jumlah,
    keterangan,
    shiftId: openShift ? openShift.id : null
  });
  closeKasManualModal();
  await refreshKasViews();
  showToast('✅ ' + (kasTipe === 'keluar' ? 'Kas keluar dicatat' : 'Kas masuk dicatat'));
}

// ── Kartu status kas di Beranda ─────────────────────────────────────────────

export async function renderKasCard() {
  const box = document.getElementById('kasCard');
  if (!box) return;
  await refreshShiftCache();
  if (!openShift) {
    box.innerHTML = `
<div class="card-title">🔒 Kas Belum Dibuka</div>
<div class="hint" style="margin-top:0;margin-bottom:12px">Mulai hari dengan menghitung uang di laci. Transaksi baru bisa disimpan setelah kas dibuka.</div>
<div class="btn-row">
<button class="btn btn-primary" type="button" data-action="open-buka-kas">🔓 Buka Kas</button>
</div>`;
    return;
  }
  const h = await hitungShift(openShift);
  const shiftLama = openShift.tanggalBuka !== todayStr();
  box.innerHTML = `
<div class="card-title">🔓 Kas Buka <span class="badge ${shiftLama ? 'red' : 'green'}">${shiftLama ? 'sejak ' + escapeHtml(formatDate(openShift.tanggalBuka)) : 'hari ini'}</span></div>
<div class="kas-grid">
<div class="kas-cell"><div class="kas-cell-label">Mulai</div><div class="kas-cell-value">${escapeHtml(formatTime(openShift.waktuBuka))} · ${escapeHtml(durasiStr(h.lamaMs))}</div></div>
<div class="kas-cell"><div class="kas-cell-label">Modal Awal</div><div class="kas-cell-value">${formatRp(h.modalAwal)}</div></div>
<div class="kas-cell"><div class="kas-cell-label">Transaksi</div><div class="kas-cell-value">${h.jumlahTransaksi}</div></div>
<div class="kas-cell"><div class="kas-cell-label">Kas Sistem</div><div class="kas-cell-value strong">${formatRp(h.sistem)}</div></div>
</div>
<div class="hint">Kas sistem = modal awal + penjualan tunai − pengeluaran + pemasukan ± catat kas. QRIS/Transfer (${formatRp(h.nonTunai)}) masuk rekening, bukan laci.</div>
<div class="btn-row" style="margin-top:12px">
<button class="btn btn-secondary" type="button" data-action="open-kas-manual">➕ Catat Kas</button>
<button class="btn btn-primary" type="button" data-action="open-tutup-kas">🔒 Tutup Kas</button>
</div>`;
}

// ── Blok laporan: riwayat shift + tutup buku tahunan ────────────────────────

// Dipanggil laporan.js (lewat dynamic import) supaya tidak ada siklus impor.
export async function kasReportBlocksHtml() {
  const [shifts, buku] = await Promise.all([
    DB.kasShift.orderBy('waktuBuka').reverse().limit(10).toArray(),
    DB.tutupBuku.orderBy('tahun').reverse().toArray()
  ]);
  const tahunIni = new Date().getFullYear();
  const tutupTahunIni = buku.find(b => Number(b.tahun) === tahunIni);
  const openShiftRow = shifts.find(s => s.status === 'buka');

  let html = `<div class="card"><div class="card-title">🕐 Riwayat Buka/Tutup Kas</div>`;
  if (!shifts.length) {
    html += `<div class="hint" style="margin-top:0">Belum ada shift kas. Buka kas dari Beranda untuk mulai.</div>`;
  } else {
    for (const s of shifts) {
      const buka = s.status === 'buka';
      const selisihTxt = buka || s.selisih === null || s.selisih === undefined
        ? ''
        : ` · Selisih <b style="color:${s.selisih === 0 ? 'var(--green)' : 'var(--red)'}">${s.selisih > 0 ? '+' : s.selisih < 0 ? '−' : ''}${formatRp(Math.abs(s.selisih))}</b>`;
      html += `<div class="trx-item">
<div class="trx-info kflex-1">
<div class="trx-title kfs13">${buka ? '🔓' : '🔒'} ${escapeHtml(formatDate(s.tanggalBuka))} ${escapeHtml(formatTime(s.waktuBuka))}</div>
<div class="trx-sub kfs11">Modal ${formatRp(s.modalAwal || 0)}${buka ? '' : ' · Sistem ' + formatRp(s.kasSistemAkhir || 0) + ' · Fisik ' + formatRp(s.kasFisikAkhir || 0)}${selisihTxt}</div>
${s.catatanTutup ? `<div class="trx-sub kfs11" style="font-style:italic">"${escapeHtml(s.catatanTutup)}"</div>` : ''}
</div>
<div>${buka ? '<span class="badge green">Berjalan</span>' : '<span class="badge">Tutup</span>'}</div>
</div>`;
    }
  }
  if (openShiftRow) {
    html += `<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" type="button" data-action="open-tutup-kas">🔒 Tutup Kas Sekarang</button></div>`;
  } else {
    html += `<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" type="button" data-action="open-buka-kas">🔓 Buka Kas</button></div>`;
  }
  html += '</div>';

  html += `<div class="card"><div class="card-title">📕 Tutup Buku Tahunan <span class="badge ${tutupTahunIni ? 'green' : 'orange'}">${tutupTahunIni ? 'Tahun ' + tahunIni + ' ditutup' : 'Tahun ' + tahunIni + ' belum'}</span></div>
<div class="hint" style="margin-top:0">Kunci rekap laba satu tahun kalender. Data lama tidak dihapus — hanya jadi patokan akhir pembukuan.</div>`;
  if (!buku.length) {
    html += `<div class="hint" style="margin-top:8px">Belum ada buku yang ditutup.</div>`;
  } else {
    for (const b of buku.slice(0, 5)) {
      html += `<div class="trx-item">
<div class="trx-info kflex-1">
<div class="trx-title kfs13">Tahun ${escapeHtml(String(b.tahun))}</div>
<div class="trx-sub kfs11">Ditutup ${escapeHtml(formatDate(b.tanggalTutup))} · ${b.jumlahTransaksi} transaksi · Omzet ${formatRp(b.omzet || 0)}</div>
</div>
<div class="trx-amount ${(b.laba || 0) >= 0 ? 'green' : 'red'} kfs13">${formatRp(b.laba || 0)}</div>
</div>`;
    }
  }
  html += `<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" type="button" data-action="open-tutup-buku">📕 ${tutupTahunIni ? 'Lihat' : 'Tutup'} Buku Tahun ${tahunIni}</button></div></div>`;
  return html;
}

// ── Tutup buku tahunan ──────────────────────────────────────────────────────

export async function openTutupBukuModal(tahunParam) {
  const tahun = Number(tahunParam) || new Date().getFullYear();
  const [sales, expRows, kasRows] = await Promise.all([
    DB.penjualan.toArray(),
    DB.pengeluaran.toArray(),
    DB.kas.toArray()
  ]);
  const { expenses, incomes } = pisahkanCatatan(expRows);
  const r = rekapTahun({ sales, expenses, incomes, kasRows, tahun });
  const sudah = await DB.tutupBuku.where('tahun').equals(tahun).first();

  const body = document.getElementById('tutupBukuBody');
  if (body) {
    body.innerHTML = `
<div class="kas-grid">
<div class="kas-cell"><div class="kas-cell-label">Transaksi</div><div class="kas-cell-value">${r.jumlahTransaksi}</div></div>
<div class="kas-cell"><div class="kas-cell-label">Omzet</div><div class="kas-cell-value">${formatRp(r.omzet)}</div></div>
<div class="kas-cell"><div class="kas-cell-label">Modal Barang</div><div class="kas-cell-value">${formatRp(r.totalModal)}</div></div>
<div class="kas-cell"><div class="kas-cell-label">Pengeluaran</div><div class="kas-cell-value">${formatRp(r.totalExpense)}</div></div>
<div class="kas-cell"><div class="kas-cell-label">Pemasukan</div><div class="kas-cell-value">${formatRp(r.totalIncome)}</div></div>
<div class="kas-cell"><div class="kas-cell-label">Laba Bersih</div><div class="kas-cell-value strong">${formatRp(r.laba)}</div></div>
</div>
<div class="hint">Perkiraan arus kas sampai 31 ${escapeHtml(formatDate(tahun + '-12-31')).split(' ').slice(-2).join(' ')}: <b>${formatRp(r.kasAkhir)}</b> (di luar modal awal laci). Laba memakai rumus yang sama dengan Beranda &amp; Laporan.</div>
${sudah
    ? `<div class="hint" style="margin-top:12px">📕 Tahun ${tahun} <b>sudah ditutup</b> pada ${escapeHtml(formatDate(sudah.tanggalTutup))}. Rekap tidak diubah ulang.</div>`
    : `<div class="form-group" style="margin-top:14px">
<label class="form-label">Tahun yang ditutup</label>
<input type="number" class="form-input" id="tutupBukuTahunInput" value="${tahun}" min="2000" max="2100" inputmode="numeric">
</div>
<div class="btn-row">
<button class="btn btn-secondary" type="button" data-action="close-tutup-buku">Batal</button>
<button class="btn btn-primary" type="button" data-action="save-tutup-buku">📕 Tutup Buku</button>
</div>`}`;
  }
  await openModal('tutupBukuModal');
}

export function closeTutupBukuModal() {
  closeModal('tutupBukuModal');
}

export async function simpanTutupBuku() {
  const input = document.getElementById('tutupBukuTahunInput');
  const tahun = parseInt(input?.value, 10);
  if (!Number.isFinite(tahun) || tahun < 2000 || tahun > 2100) {
    showToast('Tahun tidak valid (2000–2100)', 'error');
    return;
  }
  if (await DB.tutupBuku.where('tahun').equals(tahun).first()) {
    showToast('Tahun ' + tahun + ' sudah pernah ditutup buku', 'error', 3500);
    return;
  }
  const [sales, expRows, kasRows] = await Promise.all([
    DB.penjualan.toArray(),
    DB.pengeluaran.toArray(),
    DB.kas.toArray()
  ]);
  const { expenses, incomes } = pisahkanCatatan(expRows);
  const r = rekapTahun({ sales, expenses, incomes, kasRows, tahun });
  showConfirm('📕', 'Tutup buku tahun ' + tahun + '? Rekap: laba ' + formatRp(r.laba) + ' dari ' + r.jumlahTransaksi + ' transaksi. Rekap tersimpan permanen.', 'Ya, Tutup Buku', async () => {
    await DB.tutupBuku.add({
      tahun,
      tanggalTutup: todayStr(),
      waktuTutup: Date.now(),
      jumlahTransaksi: r.jumlahTransaksi,
      omzet: r.omzet,
      totalModal: r.totalModal,
      totalExpense: r.totalExpense,
      totalIncome: r.totalIncome,
      laba: r.laba,
      kasAkhir: r.kasAkhir
    });
    closeTutupBukuModal();
    showToast('📕 Buku tahun ' + tahun + ' ditutup.');
    await refreshKasViews();
  }, 'Batal');
}

// Tahun yang sudah ditutup buku → dipakai untuk peringatan saat menghapus data lama.
export async function tahunTertutup() {
  try {
    const rows = await DB.tutupBuku.toArray();
    return new Set(rows.map(r => Number(r.tahun)));
  } catch (_) {
    return new Set();
  }
}

// Text konfirmasi hapus. Tutup buku SENGAJA tidak mengunci data (sama seperti
// rosok — mengunci berarti transaksi lama tidak bisa dikoreksi sama sekali),
// tapi menghapus data tahun yang sudah direkap membuat angka rekap tidak
// cocok lagi, jadi user diperingatkan lebih dulu.
export async function peringatanTahunTertutup(tanggalStr, label) {
  const tahun = Number(String(tanggalStr || '').slice(0, 4));
  const normal = 'Yakin mau hapus ' + label + '?';
  if (!Number.isFinite(tahun) || tahun < 1000) return normal;
  if (!(await tahunTertutup()).has(tahun)) return normal;
  return '⚠️ Tahun ' + tahun + ' SUDAH ditutup buku. Menghapus ' + label +
    ' akan membuat rekap tahunan tidak cocok lagi. Yakin?';
}
