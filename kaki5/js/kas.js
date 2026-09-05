// ==================== KAS (ESM) ====================
// Buka/tutup kas (shift laci) + tutup buku tahunan.
// Diadopsi dari Kasir Solo Rosok (v161), ditulis ulang mengikuti aturan kaki5:
//   • tanpa inline onclick (CSP) — dipanggil lewat data-action di app.js
//   • aritmetika di kas.logic.js (fungsi murni), DB + DOM di sini
//   • "kas sistem" dihitung dari data yang sudah ada — kaki5 tidak punya buku
//     besar kas terpisah, jadi tidak ada baris kas yang ditulis ulang tiap
//     transaksi.
//
// v164 (permintaan pemilik): TIDAK ADA lagi fitur "catat kas manual". Uang yang
// keluar/masuk laci dicatat lewat form Pengeluaran/Pemasukan Laporan — tombol
// "Catat Kas" di Beranda hanya membuka modal itu (lihat `catatKasDariBeranda`).
// Konsekuensi yang harus dijaga di file ini:
//   • DB.kas tidak dibaca lagi (baris lama sudah dipindah saat upgrade v8).
//   • Hanya catatan bermode tunai yang menggeser kas sistem (kas.logic.js).
//   • QRIS/Transfer tidak masuk laci, tapi TETAP ditampilkan sebagai rincian
//     "Dompet digital" supaya angka laci yang kecil tidak tampak hilang.
import { DB, getSetting } from './db.js';
import { showToast, formatRp, todayStr, formatDate, formatTime, escapeHtml } from './helpers.js';
import { openShift, setOpenShift, currentPage } from './app-state.js';
import { openModal, closeModal } from './modal.js';
import { showConfirm } from './confirm.js';
import {
  hitungKasSistem, hitungSelisih, durasiStr, pisahkanCatatan,
  rekapTahun, rinciDompetDigital, isNonLaba
} from './kas.logic.js';

// ── Saklar fitur (Pengaturan → "⚙️ Aktifkan Fitur") ─────────────────────────
// v166: pemilik boleh memilih TIDAK memakai buka/tutup kas sama sekali. Bila
// 'fiturKas' = '0': kartu kas di Beranda hilang, gerbang POS di pos.js dilolos,
// dan blok "Riwayat Buka/Tutup Kas" di Laporan tidak dirender.
// Default '1' = perilaku lama (fitur aktif) supaya pengguna lama tidak kaget.
// Data shift yang sudah ada TIDAK dihapus — saklar hanya menyembunyikan alurnya.
//
// Nilai di-cache sekali baca: gerbang POS dievaluasi tiap transaksi, dan
// settings hanya berubah lewat saveFiturKas() yang memanggil setFiturKasAktif().
let _fiturKas = null;

export async function fiturKasAktif() {
  // v167: baca SEGAR tiap dipanggil, JANGAN percaya cache modul.
  // Cache hanya aman kalau satu-satunya penulis ada di tab yang sama — padahal
  // IndexedDB dipakai bersama seluruh tab/jendela pada origin ini. Gejala nyata
  // yang diperbaiki: saklar di Pengaturan terlihat AKTIF sementara baris
  // `fiturKas` di DB sudah '0' dari tab lain, sehingga gerbang POS di
  // pos.js:529 dilewati dan kios bisa jualan tanpa buka kas.
  // Biayanya satu primary-key get per transaksi — tak berarti.
  try {
    _fiturKas = (await getSetting('fiturKas', '1')) !== '0';
  } catch (e) {
    console.warn('[KAS] baca fiturKas gagal, pakai keadaan terakhir:', e?.message || e);
    // Gagal baca ≠ mematikan gerbang. Kalau belum pernah baca sama sekali,
    // anggap AKTIF (lebih aman memaksa buka kas daripada kehilangan modal awal).
    if (_fiturKas === null) _fiturKas = true;
  }
  return _fiturKas;
}

// Dipanggil settings.ui.js SETELAH nilai tersimpan, supaya tampilan langsung
// berubah tanpa reload.
export function setFiturKasAktif(v) {
  _fiturKas = !!v;
}

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
// v164: DB.kas tidak dibaca lagi — catat-mencatat uang laci kini lewat tabel
// `pengeluaran` (pengeluaran/pemasukan), yang memang sudah ikut dihitung.
async function dataShift(shift, sampaiMs = Date.now()) {
  const dari = Number(shift?.waktuBuka) || 0;
  // M3 (audit 2026-09-05): held order yang dibayar hari ini punya waktu=saat
  // ditahan (lebih lama), tapi paidAt=saat bayar. Pakai paidAt ?? waktu untuk atribusi
  // kas per shift — held yang dibayar setelah shift dibuka ikut masuk shift tsb.
  // Legacy record tanpa paidAt fallback ke waktu (backward-compatible).
  const [salesAll, expAll] = await Promise.all([
    DB.penjualan.where('waktu').between(dari, sampaiMs).toArray(),
    DB.pengeluaran.where('waktu').between(dari, sampaiMs).toArray()
  ]);
  const sales = (salesAll || []).filter(s => {
    if (s?.status === 'held') return false;
    const paidAt = s?.paidAt || s?.waktu;
    return paidAt >= dari && paidAt <= sampaiMs;
  });
  const { expenses, incomes } = pisahkanCatatan(expAll);
  return { sales, expenses, incomes };
}

// Perhitungan lengkap satu shift (dipakai kartu Beranda + modal Tutup Kas).
export async function hitungShift(shift, sampaiMs = Date.now()) {
  const data = await dataShift(shift, sampaiMs);
  const hasil = hitungKasSistem({ modalAwal: shift?.modalAwal, ...data });
  return {
    ...hasil,
    dompet: rinciDompetDigital(data),
    jumlahNonLaba: [...data.expenses, ...data.incomes].filter(isNonLaba).length,
    jumlahTransaksi: data.sales.length,
    lamaMs: sampaiMs - (Number(shift?.waktuBuka) || sampaiMs)
  };
}

// Segarkan semua tampilan yang menampilkan angka kas: kartu Beranda selalu,
// Laporan hanya bila sedang dibuka (sama seperti pola pengeluaran.js).
// Di-export supaya modul pencatatan (pengeluaran.js, hapus di expensedetail.js)
// bisa memanggil setelah mengubah tabel `pengeluaran`.
export async function refreshKasViews() {
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
  if (!(await fiturKasAktif())) { showToast('Fitur buka/tutup kas sedang dimatikan di Pengaturan ⚙️', 'error'); return; }
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

// P0 (audit 2026-09-05): guard in-flight — dobel tap "🔓 Buka Kas" dulu bisa
// membuat 2 shift (baca-then-write tanpa guard; getOpenShift hanya memakai
// shift terbaru, shift lama menggantung "Berjalan" di riwayat).
let _bukaKasInFlight = false;

export async function bukaKas() {
  if (_bukaKasInFlight) return;
  _bukaKasInFlight = true;
  try {
    await _bukaKasCore();
  } finally {
    _bukaKasInFlight = false;
  }
}

async function _bukaKasCore() {
  // Guard LANTASAN (audit v166): modal Buka Kas bisa saja sudah terbuka sebelum
  // saklar dimatikan, dan `bukaKas` ikut ter-expose ke window lewat _kasWireMap.
  // Tanpa ini, satu klik "🔓 Buka Kas" tetap menulis shift padahal fitur mati.
  if (!(await fiturKasAktif())) {
    showToast('Fitur buka/tutup kas sedang dimatikan di Pengaturan ⚙️', 'error');
    closeBukaKasModal();
    return;
  }
  await refreshShiftCache();
  if (openShift) {
    showToast('Kas masih terbuka — tutup dulu shift yang lama 🔒', 'error', 3500);
    return;
  }
  const el = document.getElementById('bukaKasModalAwal');
  // v170 (komentar browser 2026-09-05): modal ini gerbang TANPA tombol Batal, jadi
  // "Buka Kas" hanya boleh jalan kalau modal awal benar-benar diketik. Kosong ≠ 0:
  // laci nol harus diketik sadar, bukan hasil menekan tombol sambil meninggalkan
  // input kosong. Tanpa ini, "kunci dashboard" bisa dilewati dalam satu klik.
  if (!(el?.value || '').trim()) {
    showToast('Masukkan modal awal dulu — ketik 0 kalau laci memang kosong', 'error', 3500);
    if (el) el.focus();
    return;
  }
  const raw = (el.value || '').replace(/\D/g, '');
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

// Rincian "Dompet digital" di layar Tutup Kas (v164): uang yang tidak pernah
// lewat laci — penjualan QRIS/Transfer dan catatan non-tunai — dirinci per
// metode beserta jumlah transaksinya. Bloknya tetap dirender walau kosong dan
// bilang "tidak ada", supaya angka laci yang kecil tidak dikira error.
function dompetDigitalHtml(d) {
  const rows = (d && Array.isArray(d.rows)) ? d.rows : [];
  if (!rows.length) {
    return '<div class="kas-row"><span>Tidak ada transaksi non-tunai shift ini</span><b>Rp 0</b></div>';
  }
  let html = '';
  for (const r of rows) {
    const trx = [];
    if (r.trxMasuk) trx.push(r.trxMasuk + ' masuk');
    if (r.trxKeluar) trx.push(r.trxKeluar + ' keluar');
    const net = (Number(r.masuk) || 0) - (Number(r.keluar) || 0);
    html += `<div class="kas-row"><span>${escapeHtml(r.label)} · ${escapeHtml(trx.join(' · ') || '0 transaksi')}</span>` +
      `<b style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${net >= 0 ? '+' : '−'}${formatRp(Math.abs(net))}</b></div>`;
  }
  html += `<div class="kas-row total"><span>Total di rekening (bukan laci)</span><b>${formatRp(d.net)}</b></div>`;
  return html;
}

function renderDompetDigital(d) {
  const box = document.getElementById('tutupKasDompet');
  if (!box) return;
  box.innerHTML = dompetDigitalHtml(d);
}

export async function openTutupKasModal() {
  if (!(await fiturKasAktif())) { showToast('Fitur buka/tutup kas sedang dimatikan di Pengaturan ⚙️', 'error'); return; }
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
  set('tutupKasExpenseLbl', '−' + formatRp(h.keluar));
  set('tutupKasIncomeLbl', '+' + formatRp(h.masuk));
  set('tutupKasSistemLbl', formatRp(h.sistem));
  renderDompetDigital(h.dompet);

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
  // Guard lantarasan yang sama seperti bukaKas (audit v166). Shift yang tertinggal
  // saat fitur mati TIDAK hilang — ia baru bisa ditutup lagi setelah fitur
  // dinyalakan, dan angka laci lama tetap terbaca seperti adanya.
  if (!(await fiturKasAktif())) {
    showToast('Fitur buka/tutup kas sedang dimatikan di Pengaturan ⚙️', 'error');
    closeTutupKasModal();
    return;
  }
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

// ── Catat uang laci dari Beranda (v164: delegasi penuh ke form Laporan) ─────
// Satu-satunya jalur mencatat uang keluar/masuk laci non-penjualan adalah modal
// Pengeluaran/Pemasukan di Laporan. Tombol "Catat Kas" di Beranda hanya
// membukanya di tab yang benar — tidak ada lagi modal kembar dengan fungsi sama.
// mode 'keluar' → tab Pengeluaran (kategori Setor Bank / Prive terisi)
// mode 'masuk'  → tab Pemasukan (kategori Modal Tambahan tersedia)
export async function catatKasDariBeranda(mode = 'keluar') {
  try {
    const m = await import('./pengeluaran.js');
    await m.bukaCatatanKas(mode === 'masuk' ? 'masuk' : 'keluar');
  } catch (e) {
    console.error('[KAS] gagal membuka form catatan:', e);
    showToast('Form catat belum siap dimuat — coba lagi', 'error');
  }
}

// ── Kartu status kas di Beranda ─────────────────────────────────────────────

export async function renderKasCard() {
  const box = document.getElementById('kasCard');
  if (!box) return;
  // Saklar fitur mati → kartu dikosongkan & disembunyikan (bukan dihapus,
  // supaya menyalakannya lagi cukup dengan render ulang).
  if (!(await fiturKasAktif())) {
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
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
<div class="hint">Kas sistem = modal awal + penjualan tunai − pengeluaran tunai + pemasukan tunai. Dompet digital ${formatRp(h.dompet.net)} (${h.dompet.trxMasuk} transaksi masuk) ada di rekening, bukan di laci.${h.jumlahNonLaba ? ' ' + h.jumlahNonLaba + ' catatan setor bank/modal tidak memotong Laba.' : ''}</div>
<div class="btn-row" style="margin-top:12px">
<button class="btn btn-secondary" type="button" data-action="kas-catat">💸 Catat Kas</button>
<button class="btn btn-primary" type="button" data-action="open-tutup-kas">🔒 Tutup Kas</button>
</div>`;
}

// ── Blok laporan: riwayat shift + tutup buku tahunan ────────────────────────

// ── Blok laporan: riwayat shift + tutup buku tahunan ────────────────────────
// v165 (komentar UI #7): dua kartu ini dipisah jadi dua fungsi. Riwayat shift
// tetap di tempatnya (setelah rincian), sedangkan "Tutup Buku Tahunan" turun ke
// paling bawah halaman Laporan — ia aksi penutup pembukuan, bukan bagian dari
// bacaan harian.

// ── Detail riwayat kas (komentar browser #6) ────────────────────────────────
// Baris riwayat shift di Laporan dulu hanya tulisan: angka "Modal Rp 0 · Sistem
// Rp 0 · Fisik Rp 0 · Selisih Rp 0" tidak bisa dibuktikan asalnya dari mana.
// Modal ini memakai hitungShift() yang SAMA dengan layar Tutup Kas, dengan
// `sampaiMs` dikunci ke waktu tutup supaya shift lama tidak ikut menelan
// transaksi yang dicatat setelahnya.

function kasDetailRow(label, value, warna = '') {
  return `<div class="kas-row"><span>${escapeHtml(label)}</span>` +
    `<b${warna ? ` style="color:${warna}"` : ''}>${escapeHtml(String(value))}</b></div>`;
}

// formatDate() minta string 'YYYY-MM-DD', sedangkan `waktuTutup` tersimpan sebagai
// epoch ms — dipisah lewat helper ini (zona waktu lokal, sama seperti todayStr()).
// Tanpa ini modal detail melempar "str.split is not a function" dan tidak terbuka.
function tanggalDariMs(ms) {
  const d = new Date(Number(ms));
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export async function showKasShiftDetail(id) {
  const shift = await DB.kasShift.get(Number(id));
  if (!shift) { showToast('Data shift tidak ditemukan', 'error'); return; }
  const masihBuka = shift.status === 'buka';
  const sampaiMs = masihBuka ? Date.now() : (Number(shift.waktuTutup) || Date.now());
  const h = await hitungShift(shift, sampaiMs);

  // Angka resmi = yang tersimpan waktu tutup kas. Rinciannya dihitung ulang dari
  // transaksi; kalau beda dengan angka tersimpan, itu berarti ada data yang
  // diubah SETELAH tutup kas — jadi keduanya ditampilkan, tidak ditutupi.
  const sistemResmi = masihBuka ? h.sistem : (shift.kasSistemAkhir ?? h.sistem);
  const fisikResmi = masihBuka ? null : (shift.kasFisikAkhir ?? null);
  const selisih = masihBuka ? null
    : (shift.selisih ?? hitungSelisih(Number(fisikResmi) || 0, sistemResmi));

  let html = `<div class="kcenter kmb16">
    <div class="kfw800 kfs14">${masihBuka ? '🔓 Shift masih berjalan' : '🔒 Shift ditutup'}</div>
    <div class="kfs13 ktext3">${escapeHtml(formatDate(shift.tanggalBuka))} · ${escapeHtml(formatTime(shift.waktuBuka))}</div>
  </div>`;

  html += '<div>';
  html += kasDetailRow('Mulai jualan', formatDate(shift.tanggalBuka) + ' · ' + formatTime(shift.waktuBuka));
  html += kasDetailRow('Ditutup', masihBuka ? '— belum ditutup —'
    : formatDate(tanggalDariMs(shift.waktuTutup)) + ' · ' + formatTime(shift.waktuTutup));
  html += kasDetailRow('Durasi', durasiStr(h.lamaMs));
  html += kasDetailRow('Modal awal', formatRp(h.modalAwal));
  html += kasDetailRow(`Penjualan tunai (${h.jumlahTransaksi} transaksi)`, '+' + formatRp(h.tunai), 'var(--green)');
  html += kasDetailRow('Pengeluaran tunai', '−' + formatRp(h.keluar), 'var(--red)');
  html += kasDetailRow('Pemasukan tunai', '+' + formatRp(h.masuk), 'var(--green)');
  html += kasDetailRow(masihBuka ? 'Kas sistem saat ini' : 'Kas sistem akhir', formatRp(sistemResmi));
  if (!masihBuka) {
    html += kasDetailRow('Kas fisik dihitung', fisikResmi == null ? '— tidak diisi —' : formatRp(fisikResmi));
    html += kasDetailRow('Selisih', (selisih > 0 ? '+' : '') + formatRp(selisih),
      selisih === 0 ? 'var(--green)' : 'var(--red)');
    if (Number(shift.kasSistemAkhir) !== Number(h.sistem)) {
      html += kasDetailRow('Hitung ulang dari transaksi', formatRp(h.sistem), 'var(--orange)');
    }
  }
  html += '</div>';

  html += `<div class="card-title kmt16">📱 Dompet digital</div>`;
  html += `<div>${dompetDigitalHtml(h.dompet)}</div>`;

  if (shift.catatanTutup) {
    html += `<div style="margin-top:12px;padding:10px 12px;background:var(--orange-bg);border-radius:12px;font-size:13px">` +
      `<b>📝 Catatan saat tutup:</b> ${escapeHtml(shift.catatanTutup)}</div>`;
  }
  if (masihBuka) {
    html += `<div class="hint kmt16" style="margin:12px 0 0">Angka masih berjalan — tutup kas untuk menguncinya.</div>`;
  }

  const box = document.getElementById('kasShiftDetailContent');
  if (box) box.innerHTML = html;
  await openModal('kasShiftDetailModal');
}

export function closeKasShiftDetail() {
  closeModal('kasShiftDetailModal');
}

// Dipanggil laporan.js (lewat dynamic import) supaya tidak ada siklus impor.
export async function kasReportBlocksHtml() {
  // Fitur kas mati → tidak ada riwayat shift di Laporan. Kartu "Tutup Buku
  // Tahunan" TETAP tampil: itu penutup pembukuan tahunan, bukan alur laci.
  if (!(await fiturKasAktif())) return '';
  const shifts = await DB.kasShift.orderBy('waktuBuka').reverse().limit(10).toArray();
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
      html += `<div class="trx-item kas-shift-row" data-action="show-kas-shift-detail" data-shift-id="${s.id}">
<div class="trx-info kflex-1">
<div class="trx-title kfs13">${buka ? '🔓' : '🔒'} ${escapeHtml(formatDate(s.tanggalBuka))} ${escapeHtml(formatTime(s.waktuBuka))}</div>
<div class="trx-sub kfs11">Modal ${formatRp(s.modalAwal || 0)}${buka ? '' : ' · Sistem ' + formatRp(s.kasSistemAkhir || 0) + ' · Fisik ' + formatRp(s.kasFisikAkhir || 0)}${selisihTxt}</div>
${s.catatanTutup ? `<div class="trx-sub kfs11" style="font-style:italic">"${escapeHtml(s.catatanTutup)}"</div>` : ''}
</div>
<div class="kas-shift-go">${buka ? '<span class="badge green">Berjalan</span>' : '<span class="badge">Tutup</span>'}<span class="kas-shift-chev">Detail ›</span></div>
</div>`;
    }
  }
  if (openShiftRow) {
    html += `<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" type="button" data-action="open-tutup-kas">🔒 Tutup Kas Sekarang</button></div>`;
  } else {
    html += `<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" type="button" data-action="open-buka-kas">🔓 Buka Kas</button></div>`;
  }
  html += '</div>';
  return html;
}

// Kartu "Tutup Buku Tahunan" — paling bawah di halaman Laporan (v165).
export async function kasTutupBukuBlockHtml() {
  const buku = await DB.tutupBuku.orderBy('tahun').reverse().toArray();
  const tahunIni = new Date().getFullYear();
  const tutupTahunIni = buku.find(b => Number(b.tahun) === tahunIni);

  let html = `<div class="card"><div class="card-title">📕 Tutup Buku Tahunan <span class="badge ${tutupTahunIni ? 'green' : 'orange'}">${tutupTahunIni ? 'Tahun ' + tahunIni + ' ditutup' : 'Tahun ' + tahunIni + ' belum'}</span></div>
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
  const [sales, expRows] = await Promise.all([
    DB.penjualan.toArray(),
    DB.pengeluaran.toArray()
  ]);
  const { expenses, incomes } = pisahkanCatatan(expRows);
  const r = rekapTahun({ sales, expenses, incomes, tahun });
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
<div class="hint">Arus kas <b>tunai</b> kumulatif sampai 31 ${escapeHtml(formatDate(tahun + '-12-31')).split(' ').slice(-2).join(' ')}: <b>${formatRp(r.kasAkhir)}</b> (di luar modal awal laci). Dompet digital kumulatif: <b>${formatRp(r.nonTunai)}</b> di rekening.<br>Di luar Laba: setor bank/ambil uang ${formatRp(r.nonLabaKeluar)}, modal tambahan ${formatRp(r.nonLabaMasuk)} — keduanya menggeser laci tapi bukan hasil usaha. Laba memakai rumus yang sama dengan Beranda &amp; Laporan.</div>
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
  const [sales, expRows] = await Promise.all([
    DB.penjualan.toArray(),
    DB.pengeluaran.toArray()
  ]);
  const { expenses, incomes } = pisahkanCatatan(expRows);
  const r = rekapTahun({ sales, expenses, incomes, tahun });
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
      kasAkhir: r.kasAkhir,
      // v164: rekap tahunan ikut menyimpan angka non-usaha & dompet digital,
      // supaya laporan lama tetap bisa dibaca tanpa menghitung ulang.
      nonLabaKeluar: r.nonLabaKeluar,
      nonLabaMasuk: r.nonLabaMasuk,
      nonTunai: r.nonTunai
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
