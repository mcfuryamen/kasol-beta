/* =========================================================================
   KASIR SOLO - ROSOK
   kas.js — Kas & shift management
   ========================================================================= */
import { db } from './db.js';
import { openShiftCache, kasFormTipe, setOpenShiftCache, setKasFormTipe } from './app-state.js';
import { fmtRupiah, unformatRupiah, toast, openOverlay, closeSheet, getSetting } from './utils.js';

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

export async function hitungKasSistemSejak(waktuMulai, sampai){
  sampai = sampai || new Date();
  const kasSejakShift = await db.kas
    .where('tanggal')
    .aboveOrEqual(new Date(waktuMulai).toISOString())
    .toArray();
  return kasSejakShift
    .filter(k => new Date(k.tanggal) <= sampai)
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
    .filter(k => new Date(k.tanggal) <= sampai);
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

export function openKasForm(){
  setKasFormTipe('masuk');
  document.getElementById('kasJumlah').value='';
  document.getElementById('kasKet').value='';
  openOverlay('sheetKas');
}

export function setKasTipe(t){
  setKasFormTipe(t);
  document.getElementById('kasTabMasuk').classList.toggle('active', t==='masuk');
  document.getElementById('kasTabKeluar').classList.toggle('active', t==='keluar');
}

export async function saveKasManual(){
  const jumlah = unformatRupiah(document.getElementById('kasJumlah').value) || 0;
  if(jumlah<=0){ toast('Isi jumlah dulu'); return; }
  await db.kas.add({
    tanggal: new Date().toISOString(),
    tipe: kasFormTipe,
    jumlah,
    keterangan: document.getElementById('kasKet').value.trim() || (kasFormTipe==='masuk'?'Kas masuk':'Kas keluar')
  });
  closeSheet('sheetKas');
  window.dispatchEvent(new CustomEvent('ksr-kas-changed'));
  toast('Kas tercatat');
}

window._ksr_openBukaKasSheet = openBukaKasSheet;
window._ksr_bukaKas = bukaKas;
window._ksr_openTutupKasSheet = openTutupKasSheet;
window._ksr_hitungSelisihTutupKas = hitungSelisihTutupKas;
window._ksr_tutupKas = tutupKas;
window._ksr_openKasForm = openKasForm;
window._ksr_setKasTipe = setKasTipe;
window._ksr_saveKasManual = saveKasManual;
