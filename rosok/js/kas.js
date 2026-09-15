/* =========================================================================
   KASIR SOLO - ROSOK
   kas.js — Kas & shift management
   ========================================================================= */
import { db } from './db.js';
import { openShiftCache, kasFormTipe, setOpenShiftCache, setKasFormTipe } from './app-state.js';
import { fmtRupiah, fmtDate, unformatRupiah, toast, openOverlay, closeSheet, getSetting, todayStr, escapeHtml } from './utils.js';
import { showConfirm } from './confirm.js';

// ── Saklar fitur kas/shift (Pengaturan → ⚙️ Fitur Aplikasi; port kaki5 v166/v167) ─
// 'fiturKas' = '0': gerbang POS di nav.js dilolos, tombol Buka/Tutup Kas
// disembunyikan, blok "Riwayat Buka/Tutup Kas" di Laporan tidak dirender, dan
// aksi buka/tutup kas ditolak dengan toast. Data shift lama TIDAK dihapus —
// saklar hanya menyembunyikan alurnya. Default '1' = perilaku lama.
// Pelajaran v167 kaki5: baca SEGAR tiap panggilan — IndexedDB dipakai bersama
// antar tab, cache modul bisa basi dan meloloskan gerbang POS. Gagal baca ≠
// mematikan gerbang: anggap AKTIF — lebih aman memaksa buka kas daripada kehilangan modal awal).
export async function fiturKasAktif() {
  try {
    return (await getSetting('fiturKas', '1')) !== '0';
  } catch (e) {
    console.warn('[KAS] baca fiturKas gagal, anggap AKTIF:', e?.message || e);
    return true; // gagal baca ≠ mematikan gerbang — lebih aman memaksa buka kas
  }
}

export async function refreshShiftCache(){
  setOpenShiftCache(await db.kasShift.where('status').equals('buka').first() || null);
  return openShiftCache;
}

// Hanya catatan TUNAI yang menggeser uang laci (adopsi kaki5 v164): catatan
// ber-metode transfer/QRIS tetap masuk laporan pengeluaran, tapi uangnya dari
// rekening, bukan laci. Baris lama tanpa field metodeBayar = tunai (konvensi
// legacy) supaya angka Tutup Kas tidak tiba-tiba berubah.
function menggeserLaci(k){
  return !k.metodeBayar || k.metodeBayar === 'tunai';
}

export async function hitungKasSistemSejak(waktuMulai, sampai){
  sampai = sampai || new Date();
  const kasSejakShift = await db.kas
    .where('tanggal')
    .aboveOrEqual(new Date(waktuMulai).toISOString())
    .toArray();
  return kasSejakShift
    .filter(k => menggeserLaci(k) && new Date(k.tanggal) <= sampai)
    .reduce((s,k)=> s + (k.tipe==='masuk' ? k.jumlah : -k.jumlah), 0);
}

// Rincian shift harian: total kas masuk, keluar, saldo sistem, dan jumlah transaksi
// yang terjadi sejak kas dibuka. Dipakai di sheet Tutup Kas agar kasir bisa
// membandingkan aktivitas hari itu sebelum menghitung uang fisik.
export async function hitungRingkasanShift(waktuMulai, sampai){
  sampai = sampai || new Date();
  const batasBawah = new Date(waktuMulai).toISOString();
  const kasSejakShift = (await db.kas
    .where('tanggal')
    .aboveOrEqual(batasBawah)
    .toArray())
    .filter(k => menggeserLaci(k) && new Date(k.tanggal) <= sampai);
  let masuk = 0, keluar = 0;
  for(const k of kasSejakShift){
    if(k.tipe === 'masuk') masuk += (k.jumlah || 0);
    else keluar += (k.jumlah || 0);
  }
  // Jumlah transaksi (beli/jual) yang tercatat selama shift
  const jumlahTransaksi = (await db.transaksi.toArray())
    .filter(t => !t.void && t.tanggal >= batasBawah && new Date(t.tanggal) <= sampai)
    .length;
  return { masuk, keluar, saldoSistem: masuk - keluar, jumlahTransaksi };
}

// ── Detail shift kas (port kaki5 showKasShiftDetail, 2026-09-14) ───────────
// Baris "Riwayat Buka/Tutup Kas" di Laporan dulu mati — kini bisa dibuka:
// angka resmi = yang tersimpan saat tutup kas; rincian dihitung ulang dari
// data lewat hitungRingkasanShift yang sama. Kalau keduanya beda, berarti ada
// data diubah SETELAH tutup kas — tampilkan keduanya, jangan ditutupi.
function durasiStr(ms){
  const menit = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  const jam = Math.floor(menit / 60);
  return (jam > 0 ? jam + ' jam ' : '') + (menit % 60) + ' menit';
}
function shiftDetailRow(label, value, warna = ''){
  return `<div class="shift-detail-row"><span>${escapeHtml(label)}</span>` +
    `<b${warna ? ` style="color:${warna}"` : ''}>${escapeHtml(String(value))}</b></div>`;
}
export async function showKasShiftDetail(id){
  const shift = await db.kasShift.get(Number(id));
  if(!shift){ toast('Data shift tidak ditemukan'); return; }
  const masihBuka = shift.status === 'buka';
  const tutupMs = masihBuka ? Date.now() : Number(new Date(shift.waktuTutup || Date.now()).getTime());
  const r = await hitungRingkasanShift(shift.waktuBuka, new Date(tutupMs));
  const sistemResmi = masihBuka ? r.saldoSistem : (shift.kasSistemAkhir ?? r.saldoSistem);
  const fisikResmi = masihBuka ? null : (shift.kasFisikAkhir ?? null);
  const selisih = masihBuka ? null : (shift.selisih ?? ((Number(fisikResmi) || 0) - sistemResmi));
  let html = `<div style="text-align:center;margin-bottom:12px">
    <div style="font-weight:800;font-size:14px">${masihBuka ? '🔓 Shift masih berjalan' : '🔒 Shift ditutup'}</div>
    <div style="font-size:13px;color:var(--ink-soft)">${escapeHtml(fmtDate(shift.waktuBuka))}</div>
  </div>`;
  html += shiftDetailRow('Mulai jualan', fmtDate(shift.waktuBuka));
  html += shiftDetailRow('Ditutup', masihBuka ? '— belum ditutup —' : fmtDate(shift.waktuTutup));
  html += shiftDetailRow('Durasi', durasiStr(tutupMs - new Date(shift.waktuBuka).getTime()));
  html += shiftDetailRow('Modal awal', fmtRupiah(shift.modalAwal || 0));
  html += shiftDetailRow(`Kas masuk selama shift (${r.jumlahTransaksi} transaksi)`, '+' + fmtRupiah(r.masuk), 'var(--green)');
  html += shiftDetailRow('Kas keluar selama shift', '−' + fmtRupiah(r.keluar), 'var(--red)');
  html += shiftDetailRow(masihBuka ? 'Kas sistem saat ini' : 'Kas sistem akhir', fmtRupiah(sistemResmi));
  if(!masihBuka){
    html += shiftDetailRow('Kas fisik dihitung', fisikResmi == null ? '— tidak diisi —' : fmtRupiah(fisikResmi));
    html += shiftDetailRow('Selisih', (selisih > 0 ? '+' : '') + fmtRupiah(selisih),
      selisih === 0 ? 'var(--green)' : 'var(--red)');
    if(Number(shift.kasSistemAkhir) !== Number(r.saldoSistem)){
      html += shiftDetailRow('Hitung ulang dari data', fmtRupiah(r.saldoSistem), 'var(--brand)');
    }
  }
  if(shift.catatanTutup){
    html += `<div style="margin-top:12px;padding:10px 12px;background:#FFF3E3;border-radius:12px;font-size:13px">` +
      `<b>📝 Catatan saat tutup:</b> ${escapeHtml(shift.catatanTutup)}</div>`;
  }
  if(masihBuka){
    html += `<div class="hint" style="margin:12px 0 0">Angka masih berjalan — tutup kas untuk menguncinya.</div>`;
  }
  const box = document.getElementById('kasShiftDetailBody');
  if(box) box.innerHTML = html;
  openOverlay('sheetShiftDetail');
}
export function closeKasShiftDetail(){ closeSheet('sheetShiftDetail'); }

export async function openBukaKasSheet(){
  if(!(await fiturKasAktif())){ toast('Fitur buka/tutup kas sedang dimatikan di Pengaturan ⚙️'); return; }
  document.getElementById('bukaKasModal').value = '';
  openOverlay('sheetBukaKas');
}

export async function bukaKas(){
  if(!(await fiturKasAktif())){ toast('Fitur buka/tutup kas sedang dimatikan di Pengaturan ⚙️'); return; }
  const modal = unformatRupiah(document.getElementById('bukaKasModal').value) || 0;
  if(modal < 0){ toast('Modal awal tidak boleh minus'); return; }
  const now = new Date().toISOString();
  const shiftId = await db.transaction('rw', db.kasShift, db.kas, async () => {
    const id = await db.kasShift.add({
      status: 'buka', waktuBuka: now, waktuTutup: null,
      modalAwal: modal, kasSistemAkhir: null, kasFisikAkhir: null, selisih: null, catatanTutup: ''
    });
    await db.kas.add({tanggal: now, tipe: 'masuk', jumlah: modal, keterangan: 'Modal Awal - Buka Kas', refKasShiftId: id});
    return id;
  });
  closeSheet('sheetBukaKas');
  await refreshShiftCache();
  window.dispatchEvent(new CustomEvent('ksr-kas-changed'));
  toast('Kas dibuka. Selamat berjualan! 🎉');
  // If user wanted to open transaksi after buka kas, handle it
  try{
    if(window._ksr_shouldOpenTransaksiAfterBuka){
      const tipe = window._ksr_shouldOpenTransaksiAfterBuka;
      window._ksr_shouldOpenTransaksiAfterBuka = null;
      // navigate to transaksi of requested type
      if(typeof window.openTransaksi === 'function'){
        // slight delay to allow UI to settle
        setTimeout(()=> window.openTransaksi(tipe), 200);
      }
    }
  }catch(e){ console.error('post-buka navigation error', e); }
}

export async function openTutupKasSheet(){
  if(!(await fiturKasAktif())){ toast('Fitur buka/tutup kas sedang dimatikan di Pengaturan ⚙️'); return; }
  const shift = openShiftCache;
  if(!shift){ toast('Kas belum dibuka'); return; }
  const kasSistemSebenarnya = await hitungKasSistemSejak(shift.waktuBuka);
  document.getElementById('tutupModalLbl').textContent = fmtRupiah(shift.modalAwal);
  document.getElementById('tutupSistemLbl').textContent = fmtRupiah(kasSistemSebenarnya);
  document.getElementById('tutupFisikInput').value = '';
  document.getElementById('tutupCatatan').value = '';
  document.getElementById('tutupSelisihVal').textContent = fmtRupiah(0 - kasSistemSebenarnya);
  document.getElementById('tutupSelisihVal').dataset.sistem = kasSistemSebenarnya;

  // Ringkasan aktivitas harian sejak kas dibuka (kas masuk/keluar, transaksi, durasi shift)
  const r = await hitungRingkasanShift(shift.waktuBuka);
  const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setTxt('tutupKasMasukLbl', fmtRupiah(r.masuk));
  setTxt('tutupKasKeluarLbl', fmtRupiah(r.keluar));
  setTxt('tutupJumlahTransLbl', r.jumlahTransaksi + ' transaksi');
  const bukaDate = new Date(shift.waktuBuka);
  setTxt('tutupWaktuBukaLbl', bukaDate.toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}));
  const durasiMenit = Math.max(0, Math.round((Date.now() - bukaDate.getTime()) / 60000));
  const jam = Math.floor(durasiMenit / 60);
  const menit = durasiMenit % 60;
  setTxt('tutupDurasiLbl', (jam > 0 ? jam + ' jam ' : '') + menit + ' menit');

  openOverlay('sheetTutupKas');
}

export function hitungSelisihTutupKas(){
  const el = document.getElementById('tutupSelisihVal');
  const sistem = parseFloat(el.dataset.sistem) || 0;
  const fisik = unformatRupiah(document.getElementById('tutupFisikInput').value) || 0;
  const selisih = fisik - sistem;
  el.textContent = (selisih === 0 ? '' : (selisih > 0 ? '+' : '')) + fmtRupiah(selisih);
  el.style.color = selisih === 0 ? 'var(--green)' : 'var(--red)';
}

export async function tutupKas(){
  if(!(await fiturKasAktif())){ toast('Fitur buka/tutup kas sedang dimatikan di Pengaturan ⚙️'); return; }
  const shift = openShiftCache;
  if(!shift){ toast('Kas belum dibuka'); return; }
  const sistem = parseFloat(document.getElementById('tutupSelisihVal').dataset.sistem) || 0;
  // FIX: input fisik sudah diformat rupiah ("1.500.000"), parseFloat langsung salah baca (→1.5).
  // Pakai unformatRupiah agar pemisah ribuan dibuang dulu.
  const fisikRaw = document.getElementById('tutupFisikInput').value.trim();
  if(fisikRaw === ''){ toast('Masukkan jumlah uang tunai fisik dulu'); return; }
  const fisik = unformatRupiah(fisikRaw);
  if(isNaN(fisik)){ toast('Masukkan jumlah uang tunai fisik dulu'); return; }
  const selisih = fisik - sistem;
  db.kasShift.update(shift.id, {
    status: 'tutup', waktuTutup: new Date().toISOString(),
    kasSistemAkhir: sistem, kasFisikAkhir: fisik, selisih: selisih,
    catatanTutup: document.getElementById('tutupCatatan').value.trim()
  }).then(() => {
    closeSheet('sheetTutupKas');
    refreshShiftCache();
    window.dispatchEvent(new CustomEvent('ksr-kas-changed'));
    if(selisih === 0) toast('Kas ditutup. Pas, tidak ada selisih! 👍');
    else toast(`Kas ditutup. Selisih ${selisih>0?'lebih':'kurang'} ${fmtRupiah(Math.abs(selisih))}`);
  }).catch(e => console.error('Tutup Kas error:', e));
}

// ── Catat Kas Manual (adopsi kaki5 pengeluaran.js v164/v165, 2026-09-13) ──
// Satu sheet dua tab (Pengeluaran | Pemasukan) dengan kategori, tanggal
// mundur, metode sumber uang (tunai laci / transfer), dan jalur UBAH catatan.
// Data tetap SATU tabel db.kas: baris manual ditandai `manual: true` supaya
// catatan sistem (Modal Awal, Pelunasan) tidak ikut bisa diubah/hapus.

// Kategori disesuaikan realitas bisnis pengepul + fitur rosok (2026-09-14):
// pembelian & penjualan rosok TIDAK ada di sini (otomatis lewat transaksi),
// pelunasan utang/piutang juga otomatis lewat tombol Lunasi — yang manual
// hanya uang keluar/masuk non-transaksi.
const KATEGORI_KAS = {
  keluar: [
    ['Pelunasan Utang', '🤝 Pelunasan Utang Tempo'],
    ['BBM / Bensin', '⛽ BBM / Bensin'],
    ['Ongkos Angkut', '💪 Ongkos Angkut / Jemput'],
    ['Karung & Plastik', '🛍️ Karung & Plastik'],
    ['Gaji / Upah', '👷 Gaji / Upah Karyawan'],
    ['Makan & Minum', '🍜 Makan & Minum'],
    ['Peralatan', '🔧 Peralatan & Perbaikan'],
    ['Sewa Tempat', '🏪 Sewa Tempat'],
    ['Listrik & Air', '💡 Listrik & Air'],
    ['Setor Bank / Prive', '🏧 Setor Bank / Ambil Uang'],
    ['Lainnya', '📦 Lainnya']
  ],
  masuk: [
    ['Pelunasan Piutang', '🤝 Pelunasan Piutang Tempo'],
    ['Pemasukan Lain', '💰 Pemasukan Lain'],
    ['Modal Tambahan / Prive', '🏧 Modal Tambahan / Prive'],
    ['Retur & Refund', '↩️ Retur / Refund Suplayer'],
    ['Penjualan Aset', '🏷️ Penjualan Aset / Peralatan'],
    ['Lainnya', '📦 Lainnya']
  ]
};
const KATEGORI_DEFAULT = { keluar: 'BBM / Bensin', masuk: 'Pemasukan Lain' };
const RE_TGL = /^\d{4}-\d{2}-\d{2}$/;
// Konteks pelunasan tempo (adopsi flow kaki5): saat form Catat Kas dibuka
// lewat tombol Lunasi, id transaksi tempo disimpan di sini — simpan berikutnya
// bukan catatan manual biasa, melainkan pelunasan atomik (kas + sisa transaksi).
let _lunasiId = null;

const elKas = (id) => document.getElementById(id);

// `waktu` untuk tanggal tertentu (port kaki5): hari ini = sekarang; tanggal
// lain = jam 12:00 hari itu supaya pasti jatuh di dalam jam operasional —
// catatan mundur tetap masuk rekap shift tanggal yang benar. Laporan aman:
// ia menyaring tanggal.
function waktuUntukTanggal(tanggalStr){
  if(tanggalStr === todayStr()) return new Date().toISOString();
  const [y, m, d] = String(tanggalStr || '').split('-').map(Number);
  if(!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

function bacaTanggalKas(){
  const v = String(elKas('kasTgl')?.value || '').trim();
  return RE_TGL.test(v) ? v : todayStr();
}

// Tahun yang sudah ditutup buku? Data lama sengaja tidak dikunci (salah catat
// harus bisa dikoreksi) — user hanya wajib diperingatkan (port kaki5).
async function tahunSudahDitutup(tanggalStr){
  try {
    const thn = Number(String(tanggalStr).slice(0, 4));
    return !!(await db.tutupBuku.where('tahun').equals(thn).first());
  } catch(_) { return false; }
}

// Kategori lama/custom bisa tidak ada di <option> statis. Kalau nilainya
// dilempar begitu saja, select jadi kosong dan simpan berikutnya MENIMPA
// kategori user dengan default — jadi opsinya dibuatkan dulu (kaki5 pilihOpsi).
function pilihOpsiKategori(tipe, nilai){
  const sel = elKas('kasKat');
  if(!sel) return;
  sel.innerHTML = KATEGORI_KAS[tipe].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  const v = String(nilai || KATEGORI_DEFAULT[tipe]);
  if(v && !Array.from(sel.options).some(o => o.value === v)){
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    sel.appendChild(opt);
  }
  sel.value = v;
}

function labelFormKas(tipe, sedangEdit){
  const t = elKas('kasFormTitle');
  const b = elKas('kasSaveBtn');
  const apa = tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran';
  if(t) t.textContent = sedangEdit ? ('✏️ Ubah ' + apa) : (tipe === 'masuk' ? '💰 Catat Pemasukan' : '🧾 Catat Pengeluaran');
  if(b) b.textContent = sedangEdit ? '💾 Simpan Perubahan' : '💾 Simpan';
  const del = elKas('kasHapusBtn');
  if(del) del.style.display = sedangEdit ? 'block' : 'none';
}

export function openKasForm(prefill = null){
  _lunasiId = prefill && prefill.lunasiId ? Number(prefill.lunasiId) : null;
  const tipe = prefill ? (prefill.tipe === 'masuk' ? 'masuk' : 'keluar') : 'keluar';
  setKasFormTipe(tipe);
  elKas('kasEditId').value = prefill && prefill.id ? String(prefill.id) : '';
  elKas('kasKet').value = prefill ? (prefill.keterangan || '') : '';
  pilihOpsiKategori(tipe, prefill ? prefill.kategori : undefined);
  elKas('kasJumlah').value = prefill ? fmtRupiah(Number(prefill.jumlah) || 0) : '';
  const tgl = elKas('kasTgl');
  const tglVal = prefill ? String(prefill.tanggal || '').slice(0, 10) : '';
  tgl.value = RE_TGL.test(tglVal) ? tglVal : todayStr();
  tgl.max = todayStr(); // cegah tanggal masa depan di picker
  elKas('kasMet').value = (prefill && prefill.metodeBayar === 'transfer') ? 'transfer' : 'tunai';
  elKas('kasTabMasuk').classList.toggle('active', tipe === 'masuk');
  elKas('kasTabKeluar').classList.toggle('active', tipe === 'keluar');
  labelFormKas(tipe, !!(prefill && prefill.id));
  openOverlay('sheetKas');
}

// Titik masuk UBAH dari daftar Buku Kas (hanya baris manual). Baris dibaca
// ulang dari DB — bukan dari HTML — jadi angka yang diedit dijamin yang
// tersimpan (port kaki5 ubahCatatan).
export async function editKasManual(id){
  const row = await db.kas.get(Number(id));
  if(!row){ toast('Catatan sudah tidak ada'); return; }
  if(!row.manual){ toast('Catatan sistem (modal awal/pelunasan) tidak bisa diubah'); return; }
  openKasForm({ ...row, id: row.id });
}

export function setKasTipe(t){
  const tipe = t === 'masuk' ? 'masuk' : 'keluar';
  setKasFormTipe(tipe);
  // Pindah tab = pindah objek — state edit WAJIB dilepas di sini (pelajaran
  // kaki5 v165): mengubah Pengeluaran lalu pindah tab tanpa ini akan menimpa
  // baris pengeluaran tadi dengan field Pemasukan. Konteks pelunasan ikut dilepas.
  _lunasiId = null;
  elKas('kasEditId').value = '';
  elKas('kasKet').value = '';
  elKas('kasJumlah').value = '';
  elKas('kasTgl').value = todayStr();
  elKas('kasMet').value = 'tunai';
  pilihOpsiKategori(tipe);
  elKas('kasTabMasuk').classList.toggle('active', tipe === 'masuk');
  elKas('kasTabKeluar').classList.toggle('active', tipe === 'keluar');
  labelFormKas(tipe, false);
}

export async function saveKasManual(){
  const editId = Number(elKas('kasEditId').value) || 0;
  const tipe = kasFormTipe === 'masuk' ? 'masuk' : 'keluar';
  const keterangan = String(elKas('kasKet').value || '').trim();
  const kategori = String(elKas('kasKat').value || '') || KATEGORI_DEFAULT[tipe];
  const jumlah = unformatRupiah(elKas('kasJumlah').value) || 0;
  const metodeBayar = elKas('kasMet').value === 'transfer' ? 'transfer' : 'tunai';
  const tanggal = bacaTanggalKas();
  if(!keterangan){ toast('Keterangan harus diisi'); return; }
  if(jumlah <= 0){ toast('Isi jumlah dulu'); return; }
  if(tanggal > todayStr()){ toast('Tanggal tidak boleh di masa depan'); return; }

  let lama = null;
  if(editId){
    lama = await db.kas.get(editId);
    if(!lama){ toast('Catatan sudah terhapus, tidak jadi diubah'); elKas('kasEditId').value = ''; return; }
    if(!lama.manual){ toast('Catatan sistem tidak bisa diubah'); return; }
    if((lama.tipe === 'masuk' ? 'masuk' : 'keluar') !== tipe){ toast('Catatan ini bukan ' + (tipe === 'masuk' ? 'pemasukan' : 'pengeluaran')); return; }
  }

  const simpan = async () => {
    // Tanggal sama → pertahankan waktu asli (urutan harian & keanggotaan
    // shift tidak berubah); tanggal beda → waktu baru jam 12:00 hari itu.
    const gantiTanggal = !lama || String(lama.tanggal).slice(0, 10) !== tanggal;
    const tanggalIso = gantiTanggal ? waktuUntukTanggal(tanggal) : lama.tanggal;
    // Konteks pelunasan tempo (flow kaki5): baris kas + update sisa transaksi
    // dalam SATU transaksi atomik. Jumlah dibatasi sisa — lebih dari itu = lunas.
    let lunasi = null;
    if(_lunasiId && !editId){
      const t = await db.transaksi.get(_lunasiId);
      if(!t || (t.sisa||0) <= 0){ toast('Transaksi ini sudah lunas'); _lunasiId = null; return; }
      lunasi = { id: t.id, jumlah: Math.min(jumlah, t.sisa), t };
    }
    await db.transaction('rw', db.kas, db.transaksi, async () => {
      if(editId){
        await db.kas.update(editId, { tanggal: tanggalIso, tipe, jumlah, keterangan, kategori, metodeBayar, manual: true });
      } else if(lunasi){
        await db.kas.add({ tanggal: tanggalIso, tipe, jumlah: lunasi.jumlah, keterangan, kategori, metodeBayar, refTransaksiId: lunasi.id });
        const newDibayarkan = (lunasi.t.dibayarkan || 0) + lunasi.jumlah;
        await db.transaksi.update(lunasi.id, { dibayarkan: newDibayarkan, sisa: Math.max(0, Math.round(lunasi.t.total - newDibayarkan)) });
      } else {
        await db.kas.add({ tanggal: tanggalIso, tipe, jumlah, keterangan, kategori, metodeBayar, manual: true });
      }
    });
    _lunasiId = null;
    closeSheet('sheetKas');
    window.dispatchEvent(new CustomEvent('ksr-kas-changed'));
    try { const L = await import('./laporan.js'); await L.renderLaporan(); await L.renderRiwayat(); } catch(_) {}
    if(lunasi){
      toast(lunasi.jumlah >= (lunasi.t.sisa || 0) ? 'Tempo lunas! 🎉' : 'Pelunasan sebagian tercatat');
      return;
    }
    const kata = tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran';
    toast((editId ? '✅ ' + kata + ' diperbarui' : '✅ ' + kata + ' dicatat') + (metodeBayar === 'tunai' ? ' dari laci!' : ' via transfer!'));
  };

  if(await tahunSudahDitutup(tanggal)){
    const apa = editId ? 'Mengubah catatan di tahun itu' : 'Mencatat di tahun itu';
    const lanjut = await showConfirm({ icon: '📕', text: 'Tahun ' + tanggal.slice(0, 4) + ' SUDAH ditutup buku. ' + apa + ' akan membuat rekap tahunan tidak cocok lagi. Lanjut simpan?', okLabel: 'Ya, Lanjut' });
    if(!lanjut) return;
  }
  await simpan();
}

export async function hapusKasManual(){
  const editId = Number(elKas('kasEditId').value) || 0;
  if(!editId) return;
  const row = await db.kas.get(editId);
  if(!row || !row.manual){ toast('Catatan sistem tidak bisa dihapus'); return; }
  const okHapus = await showConfirm({ icon: '🗑️', text: 'Hapus catatan "' + (row.keterangan || '-') + '" (' + fmtRupiah(row.jumlah) + ')? Tindakan ini tidak bisa dibatalkan.', okLabel: 'Ya, Hapus' });
  if(!okHapus) return;
  await db.kas.delete(editId);
  closeSheet('sheetKas');
  window.dispatchEvent(new CustomEvent('ksr-kas-changed'));
  try { const L = await import('./laporan.js'); await L.renderLaporan(); await L.renderRiwayat(); } catch(_) {}
  toast('Catatan dihapus');
}

window._ksr_openBukaKasSheet = openBukaKasSheet;
window._ksr_bukaKas = bukaKas;
window._ksr_openTutupKasSheet = openTutupKasSheet;
window._ksr_hitungSelisihTutupKas = hitungSelisihTutupKas;
window._ksr_tutupKas = tutupKas;
window._ksr_openKasForm = openKasForm;
window._ksr_setKasTipe = setKasTipe;
window._ksr_saveKasManual = saveKasManual;
window._ksr_editKasManual = editKasManual;
window._ksr_hapusKasManual = hapusKasManual;
window._ksr_showKasShiftDetail = showKasShiftDetail;
window._ksr_closeKasShiftDetail = closeKasShiftDetail;
