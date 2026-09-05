/* =========================================================================
   KASIR SOLO - ROSOK
   laporan.js — Reports
   ========================================================================= */
import { db } from './db.js';
import { laporanPeriode, laporanAnchor, laporanDateFrom, laporanDateTo, setLaporanPeriode as setLaporanPeriodeState, setLaporanDateFrom, setLaporanDateTo, setLaporanAnchor } from './app-state.js';
import { fmtRupiah, fmtKg, fmtDate, escapeHtml, openOverlay, closeSheet, toast, unformatRupiah } from './utils.js';
import { fiturKasAktif } from './kas.js';
import { showConfirm } from './confirm.js';

let _lunasiId = null;
let _lunasiSaving = false;

// Helper: format tanggal ke 'YYYY-MM-DD' pakai waktu lokal (bukan UTC).
// toISOString() bisa offset -7 jam di Indonesia, sehingga tanggalnya mundur 1 hari.
function toLocalISO(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// Jangkar default = hari ini (sekali, saat modul siap).
if(!laporanAnchor) setLaporanAnchor(toLocalISO(new Date()));

// ── Navigasi periode ala kaki5: tab segmen + date-nav akordeon ────────────
// Baris date-nav (‹ label ›) = badan akordeon: default TERTUTUP, membuka
// saat tab filter diklik (klik tab yang sama lagi = menutup). Klik label
// tanggal saat terbuka men-toggle panel picker.
export function setLaporanPeriode(p){
  const sameTab = laporanPeriode === p; // baca SEBELUM setter mengganti nilai
  setLaporanPeriodeState(p);
  // Akordeon: klik tab lain -> buka; klik tab yang sudah aktif -> tutup.
  _navOpen = sameTab ? !_navOpen : true;
  _pickerOpen = false;
  document.querySelectorAll('#screenLaporanFilter .report-tab').forEach(b=>b.classList.toggle('active', b.dataset.p===p));
  renderDateNav();
  renderLaporan(); renderRiwayat();
}

// Geser jangkar ‹ / › : harian ±1 hari, mingguan ±7 hari, bulanan ±1 kalender.
export function shiftLaporanPeriod(delta){
  if(laporanPeriode !== 'harian' && laporanPeriode !== 'mingguan' && laporanPeriode !== 'bulanan') return;
  const [y, m, d] = laporanAnchor.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  if(laporanPeriode === 'harian') dt.setDate(dt.getDate() + delta);
  else if(laporanPeriode === 'mingguan') dt.setDate(dt.getDate() + delta*7);
  else {
    const day = dt.getDate();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + delta);
    const last = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate();
    dt.setDate(Math.min(day, last));
  }
  setLaporanAnchor(toLocalISO(dt));
  renderDateNav();
  renderLaporan(); renderRiwayat();
}

// Senin sebagai awal minggu.
function weekStart(ds){
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return toLocalISO(dt);
}

function anchorLabel(){
  const [y, m, d] = laporanAnchor.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  if(laporanPeriode === 'harian'){
    return laporanAnchor === toLocalISO(new Date()) ? 'Hari Ini'
      : dt.toLocaleDateString('id-ID', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
  }
  if(laporanPeriode === 'mingguan'){
    const start = new Date(y, m-1, d); start.setDate(start.getDate() - ((start.getDay()+6)%7));
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const f = x => x.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
    return `${f(start)} – ${f(end)} ${end.getFullYear()}`;
  }
  // bulanan
  return dt.toLocaleDateString('id-ID', {month:'long', year:'numeric'});
}

function renderDateNav(){
  const box = document.getElementById('reportDateNav');
  if(!box) return;
  // Akordeon: baris date-nav tidak dirender saat tertutup (default).
  if(!_navOpen){ box.innerHTML = ''; return; }
  const stepped = laporanPeriode === 'harian' || laporanPeriode === 'mingguan' || laporanPeriode === 'bulanan';
  const label = laporanPeriode === 'custom' ? customLabel() : `📅 ${anchorLabel()}`;
  const navArea = stepped
    ? `<button class="date-btn" onclick="window._ksr_shiftLaporanPeriod(-1)" aria-label="Periode sebelumnya">‹</button>
       <div class="date-label toggle-picker-btn${_pickerOpen ? ' active' : ''}" onclick="window._ksr_togglePicker()">${label}</div>
       <button class="date-btn" onclick="window._ksr_shiftLaporanPeriod(1)" aria-label="Periode berikutnya">›</button>`
    : `<div class="date-label toggle-picker-btn${_pickerOpen ? ' active' : ''}" onclick="window._ksr_togglePicker()">${label}</div>`;
  // Panel picker hanya dirender saat TERBUKA (klik manual pada label).
  // Default tertutup — ikut tertutup saat ganti periode, pindah halaman, & refresh.
  box.innerHTML = `
    <div class="date-nav">
      ${navArea}
    </div>
    ${_pickerOpen ? `<div class="custom-picker">${buildPickerBody()}</div>` : ''}`;
}

function customLabel(){
  if(laporanDateFrom && laporanDateTo) return `📅 ${fmtShort(laporanDateFrom)} – ${fmtShort(laporanDateTo)}`;
  if(laporanDateFrom) return `📅 mulai ${fmtShort(laporanDateFrom)}`;
  if(laporanDateTo) return `📅 s/d ${fmtShort(laporanDateTo)}`;
  return '📅 Pilih Rentang Tanggal';
}
function fmtShort(ds){
  const [y,m,d] = ds.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'});
}

// ── Picker bodies (pola kaki5) ────────────────────────────────────────────
let _pickerOpen = false;
let _navOpen = false; // akordeon baris date-nav: default tertutup
// Bulan yang sedang dilihat di kalender custom (default ikut tanggal terpilih).
let _viewStart = null; // 'YYYY-MM'
let _viewEnd = null;

function buildPickerBody(){
  if(laporanPeriode === 'harian') return buildDayCalendar();
  if(laporanPeriode === 'mingguan') return buildWeekOptions();
  if(laporanPeriode === 'bulanan') return buildMonthOptions();
  return buildCustomPicker();
}

function buildDayCalendar(){
  const ym = laporanAnchor.slice(0,7);
  const [y, m] = ym.split('-').map(Number);
  const sel = laporanAnchor;
  const today = toLocalISO(new Date());
  const firstDow = (new Date(y, m-1, 1).getDay() + 6) % 7; // Senin = 0
  const daysInMonth = new Date(y, m, 0).getDate();
  let cells = '';
  for(let i=0; i<firstDow; i++) cells += '<div class="cal-cell empty"></div>';
  for(let d=1; d<=daysInMonth; d++){
    const ds = `${ym}-${String(d).padStart(2,'0')}`;
    const cls = 'cal-cell' + (ds === sel ? ' sel' : '') + (ds === today ? ' today' : '');
    cells += `<div class="${cls}" onclick="window._ksr_pickDate('${ds}')">${d}</div>`;
  }
  const heads = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(h=>`<div class="cal-head">${h}</div>`).join('');
  return `<div class="cal-title">${new Date(y, m-1, 1).toLocaleDateString('id-ID',{month:'long', year:'numeric'})}</div>
    <div class="cal-grid">${heads}${cells}</div>`;
}

function buildWeekOptions(){
  const ym = laporanAnchor.slice(0,7);
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const lastDs = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`;
  let cursor = weekStart(first);
  const active = weekStart(laporanAnchor);
  const weeks = [];
  let n = 1;
  while(cursor <= lastDs && n <= 6){
    const s = new Date(cursor.slice(0,4), cursor.slice(5,7)-1, cursor.slice(8,10));
    const e = new Date(s); e.setDate(e.getDate() + 6);
    const f = x => x.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
    const a = cursor === active ? ' sel' : '';
    weeks.push(`<button class="week-opt${a}" onclick="window._ksr_pickWeek('${cursor}')"><b>Minggu ${n}</b><span>${f(s)} – ${f(e)}</span></button>`);
    const nxt = new Date(s); nxt.setDate(nxt.getDate() + 7);
    cursor = toLocalISO(nxt); n++;
  }
  return weeks.join('');
}

function buildMonthOptions(){
  const y = laporanAnchor.slice(0,4);
  const cur = laporanAnchor.slice(5,7);
  const opts = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map((mn,i)=>{
    const mm = String(i+1).padStart(2,'0');
    const a = mm === cur ? ' sel' : '';
    return `<button class="month-opt${a}" onclick="window._ksr_pickMonth('${y}-${mm}-01')"><b>${mn}</b><span>${y}</span></button>`;
  }).join('');
  return `<div class="month-grid">${opts}</div>`;
}

function buildCustomPicker(){
  if(!_viewStart) _viewStart = (laporanDateFrom || laporanAnchor).slice(0,7);
  if(!_viewEnd) _viewEnd = (laporanDateTo || laporanDateFrom || laporanAnchor).slice(0,7);
  return `
    <div class="custom-two">
      ${buildMonthCal(_viewStart, 'start', 'Dari')}
      ${buildMonthCal(_viewEnd, 'end', 'Sampai')}
    </div>`;
}

function buildMonthCal(ym, side, title){
  const [y, m] = ym.split('-').map(Number);
  const today = toLocalISO(new Date());
  const firstDow = (new Date(y, m-1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  let cells = '';
  for(let i=0; i<firstDow; i++) cells += '<div class="cal-cell empty"></div>';
  for(let d=1; d<=daysInMonth; d++){
    const ds = `${ym}-${String(d).padStart(2,'0')}`;
    const isSel = (side==='start' && ds===laporanDateFrom) || (side==='end' && ds===laporanDateTo);
    const inRange = laporanDateFrom && laporanDateTo && ds > laporanDateFrom && ds < laporanDateTo;
    const cls = 'cal-cell' + (isSel ? ' sel' : '') + (inRange ? ' inrange' : '') + (ds === today ? ' today' : '');
    cells += `<div class="${cls}" onclick="window._ksr_pickCustomDate('${side}','${ds}')">${d}</div>`;
  }
  const heads = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(h=>`<div class="cal-head">${h}</div>`).join('');
  const mname = new Date(y, m-1, 1).toLocaleDateString('id-ID',{month:'long', year:'numeric'});
  return `
    <div class="cal-half">
      <div class="cal-half-title">${title}</div>
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="window._ksr_pickNavMonth('${side}',-1)" aria-label="Bulan sebelumnya">‹</button>
        <div class="cal-title">${mname}</div>
        <button class="cal-nav-btn" onclick="window._ksr_pickNavMonth('${side}',1)" aria-label="Bulan berikutnya">›</button>
      </div>
      <div class="cal-grid">${heads}${cells}</div>
    </div>`;
}

export function reportRange(){
  // Semua range pakai waktu LOKAL (T00:00/T23:59) supaya transaksi dini hari
  // tidak terlempar ke hari lain (beda dengan lama yang campur UTC).
  if(laporanPeriode === 'custom'){
    const start = laporanDateFrom ? new Date(laporanDateFrom + 'T00:00:00') : null;
    const end = laporanDateTo ? new Date(laporanDateTo + 'T23:59:59.999') : null;
    return { start, end };
  }
  const [y, m, d] = laporanAnchor.split('-').map(Number);
  const anchor = new Date(y, m-1, d);
  if(laporanPeriode === 'harian'){
    return { start: new Date(y, m-1, d, 0,0,0,0), end: new Date(y, m-1, d, 23,59,59,999) };
  }
  if(laporanPeriode === 'mingguan'){
    // Minggu kalender (Senin–Minggu) yang memuat jangkar — konsisten dgn picker minggu.
    const [wy, wm, wd] = weekStart(laporanAnchor).split('-').map(Number);
    const end = new Date(wy, wm-1, wd + 6);
    return { start: new Date(wy, wm-1, wd, 0,0,0,0), end: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23,59,59,999) };
  }
  // bulanan: 1 s/d akhir bulan kalender jangkar
  const last = new Date(y, m, 0).getDate();
  return { start: new Date(y, m-1, 1, 0,0,0,0), end: new Date(y, m-1, last, 23,59,59,999) };
}

// Bucket grafik mengikuti periode jangkar (pola kaki5):
// harian = per jam; mingguan/bulanan/custom = per hari; semua = per bulan.
function chartBuckets(){
  const dayMs = 24*3600*1000;
  const [ay, am] = laporanAnchor.split('-').map(Number);
  if(laporanPeriode === 'harian'){
    const buckets = [];
    for(let h=0; h<24; h++) buckets.push({ key:'h'+String(h).padStart(2,'0'), label:String(h).padStart(2,'0'), beli:0, jual:0 });
    return buckets;
  }
  if(laporanPeriode === 'bulanan'){
    // kaki5 renderChart: bulan dipetakan ke MINGGU kalender (M1..M5), bukan
    // 31 kolom harian yang sempit — tiap kolom = 7 hari (potongan terakhir pendek).
    const last = new Date(ay, am, 0).getDate();
    const pre = laporanAnchor.slice(0,7);
    const buckets = [];
    for(let s=1; s<=last; s+=7){
      const e = Math.min(s+6, last);
      const isoS = pre+'-'+String(s).padStart(2,'0');
      const isoE = pre+'-'+String(e).padStart(2,'0');
      buckets.push({ key:'M'+(buckets.length+1), label:'M'+(buckets.length+1), from:isoS, to:isoE, beli:0, jual:0 });
    }
    return buckets;
  }
  if(laporanPeriode === 'custom'){
    // Rentang tanggal custom (dibatasi 45 hari). >14 hari → grouping mingguan
    // ala kaki5 (M1..Mn); pendek → tetap per hari agar detail tidak hilang.
    const now = new Date();
    const start = laporanDateFrom ? new Date(laporanDateFrom + 'T00:00:00') : null;
    const end = laporanDateTo ? new Date(laporanDateTo + 'T23:59:59.999') : now;
    const totalDays = start ? Math.min(45, Math.max(1, Math.round((end - start)/dayMs))) : 31;
    const buckets = [];
    const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if(totalDays > 14){
      const startDate = new Date(endD.getTime() - (totalDays-1)*dayMs);
      for(let s=0; s<totalDays; s+=7){
        const ws = new Date(startDate.getTime() + s*dayMs);
        const we = new Date(Math.min(ws.getTime() + 6*dayMs, endD.getTime()));
        buckets.push({ key:'M'+(buckets.length+1), label:'M'+(buckets.length+1), from:toLocalISO(ws), to:toLocalISO(we), beli:0, jual:0 });
      }
    } else {
      for(let i=totalDays-1; i>=0; i--){
        const d = new Date(endD.getTime() - i*dayMs);
        const iso = toLocalISO(d);
        buckets.push({ key: iso, label: String(d.getDate()), from:iso, to:iso, beli:0, jual:0 });
      }
    }
    return buckets;
  }
  // mingguan: minggu kalender jangkar (Senin–Minggu) — per hari, label nama hari
  const [wy, wm, wd] = weekStart(laporanAnchor).split('-').map(Number);
  const buckets = [];
  for(let i=0; i<7; i++){
    const d = new Date(wy, wm-1, wd + i);
    const iso = toLocalISO(d);
    const label = d.toLocaleDateString('id-ID',{weekday:'short'});
    buckets.push({ key: iso, label, from:iso, to:iso, beli:0, jual:0 });
  }
  return buckets;
}

function chartTitle(){
  if(laporanPeriode === 'harian') return 'Omzet Harian (per Jam)';
  if(laporanPeriode === 'mingguan') return 'Omzet 7 Hari Terakhir (per Hari)';
  if(laporanPeriode === 'custom') return 'Omzet Periode Kustom (per Hari)';
  return 'Omzet Bulan Ini (per Hari)';
}

// ── Aksi picker (pola kaki5): pilih → langsung filter & tutup panel ───────
export function pickDate(ds){ setLaporanAnchor(ds); _pickerOpen = false; renderDateNav(); renderLaporan(); renderRiwayat(); }
export function pickWeek(ds){ setLaporanAnchor(ds); _pickerOpen = false; renderDateNav(); renderLaporan(); renderRiwayat(); }
export function pickMonth(ds){ setLaporanAnchor(ds); _pickerOpen = false; renderDateNav(); renderLaporan(); renderRiwayat(); }
export function toggleCustomPicker(){ _pickerOpen = !_pickerOpen; renderDateNav(); }
// Auto-close picker (permintaan pemilik 2026-09-05): picker terbuka lalu user
// mengklik di luar kartu filter laporan (area header sticky — tab periode,
// date-nav, dan kalender berada di dalamnya) → picker tertutup sendiri.
// Klik DI DALAM kartu tidak diutak-atik; handler internal (pickDate/pickWeek/
// pickMonth) sudah menutup picker sendiri sebelum listener ini melihat flag.
document.addEventListener('click', (e) => {
  if(!_pickerOpen) return;
  const filter = document.getElementById('screenLaporanFilter');
  if(filter && !filter.contains(e.target)){ _pickerOpen = false; renderDateNav(); }
});
// Tutup akordeon + picker sekaligus (dipakai nav.js saat pindah halaman/tab).
export function closePicker(){ _pickerOpen = false; _navOpen = false; }
// Navigasi bulan pada kalender custom (kiri/kanan independen).
export function pickNavMonth(side, delta){
  const view = side === 'start' ? _viewStart : _viewEnd;
  if(!view) return;
  const [y, m] = view.split('-').map(Number);
  const dt = new Date(y, m-1 + delta, 1);
  const ym = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
  if(side === 'start') _viewStart = ym; else _viewEnd = ym;
  renderDateNav();
}
export function pickCustomDate(side, ds){
  if(side === 'start'){
    setLaporanDateFrom(ds);
    if(laporanDateTo && ds > laporanDateTo) setLaporanDateTo(ds);
    _viewStart = ds.slice(0,7);
  } else {
    setLaporanDateTo(ds);
    if(laporanDateFrom && ds < laporanDateFrom) setLaporanDateFrom(ds);
    _viewEnd = ds.slice(0,7);
  }
  if(laporanPeriode !== 'custom') setLaporanPeriodeState('custom');
  renderDateNav();
  renderLaporan(); renderRiwayat();
}

export function openLunasi(id){
  db.transaksi.get(id).then(t => {
    if(!t || (t.sisa||0) <= 0){ toast('Transaksi ini sudah lunas'); return; }
    _lunasiId = id;
    document.getElementById('lunasiTitle').textContent = t.tipe==='beli' ? 'Lunasi Utang ke Penjual' : 'Lunasi Piutang dari Pembeli';
    document.getElementById('lunasiKontakLbl').textContent = (t.kontakNama || (t.tipe==='beli'?'Penjual':'Pembeli')) + ' · ' + fmtDate(t.tanggal);
    document.getElementById('lunasiSisaBadge').textContent = 'Sisa ' + fmtRupiah(t.sisa);
    document.getElementById('lunasiInputLabel').textContent = t.tipe==='beli' ? 'Jumlah Dibayar Sekarang' : 'Jumlah Diterima Sekarang';
    document.getElementById('lunasiJumlahInput').value = fmtRupiah(t.sisa);
    openOverlay('sheetLunasi');
  });
}

export async function saveLunasi(){
  if(_lunasiSaving) return;
  const t = await db.transaksi.get(_lunasiId);
  if(!t) return;
  let jumlah = unformatRupiah(document.getElementById('lunasiJumlahInput').value) || 0;
  if(jumlah <= 0){ toast('Isi jumlah dulu'); return; }
  if(jumlah > t.sisa) jumlah = t.sisa;
  const newDibayarkan = (t.dibayarkan||0) + jumlah;
  const newSisa = Math.max(0, Math.round(t.total - newDibayarkan));
  _lunasiSaving = true;
  try {
    // Atomik: update transaksi + catat kas pelunasan dalam satu transaksi.
    await db.transaction('rw', db.transaksi, db.kas, async () => {
      await db.transaksi.update(t.id, {dibayarkan: newDibayarkan, sisa: newSisa});
      await db.kas.add({ tanggal: new Date().toISOString(), tipe: t.tipe==='beli'?'keluar':'masuk', jumlah, keterangan: (t.tipe==='beli'?'Pelunasan utang':'Pelunasan piutang') + (t.kontakNama?' - '+t.kontakNama:''), refTransaksiId: t.id });
    });
  } catch(e){
    console.error('Lunasi error:', e);
    toast('Gagal menyimpan pelunasan');
    return;
  } finally {
    _lunasiSaving = false;
  }
  closeSheet('sheetLunasi');
  toast(newSisa<=0 ? 'Tempo lunas! 🎉' : 'Pelunasan sebagian tercatat');
  renderLaporan(); renderRiwayat();
  window.dispatchEvent(new CustomEvent('ksr-data-changed'));
}

export async function renderLaporan(){
  renderDateNav();
  const range = reportRange();
  const inRange = (iso) => {
    const tgl = new Date(iso);
    return tgl >= range.start && (!range.end || tgl <= range.end);
  };

  const allTrans = await db.transaksi.toArray();
  const transMap = {};
  for(const t of allTrans) transMap[t.id] = t;

  const stats = { beliPeriode:0, jualPeriode:0, utang:0, piutang:0, pengeluaran:0, nTrans:0 };
  const buckets = chartBuckets();
  const bucketMap = {};
  buckets.forEach(b => bucketMap[b.key] = b);

  for(const t of allTrans){
    if(t.void) continue;
    const isBeli = t.tipe==='beli';
    const isIn = inRange(t.tanggal);
    if(isIn){
      stats.nTrans++;
      if(isBeli) stats.beliPeriode += t.total||0; else stats.jualPeriode += t.total||0;
      if((t.sisa||0) > 0){ if(isBeli) stats.utang += t.sisa; else stats.piutang += t.sisa; }
    }
    const localDateStr = toLocalISO(new Date(t.tanggal));
    // Harian: bucket per jam. Lainnya: bucket menampung RENTANG tanggal
    // (1 hari utk mingguan/custom-pendek; 7 hari utk M1..Mn bulanan/custom-panjang).
    let b;
    if(laporanPeriode === 'harian'){
      // Cabang harian berbasis jam tanpa batas tanggal: hanya bucket-kan bila
      // transaksi masuk rentang (isIn), agar histori lama tak ikut ke grafik.
      if(isIn) b = bucketMap['h' + new Date(t.tanggal).getHours().toString().padStart(2,'0')];
    } else {
      b = buckets.find(x => localDateStr >= x.from && localDateStr <= x.to);
    }
    if(b){ if(isBeli) b.beli += t.total||0; else b.jual += t.total||0; }
  }

  const allKas = await db.kas.toArray();
  let kasMasuk = 0, kasKeluar = 0;
  for(const k of allKas){
    if(!inRange(k.tanggal)) continue;
    if(k.tipe === 'masuk') kasMasuk += (k.jumlah || 0);
    else kasKeluar += (k.jumlah || 0);
  }
  stats.cashNet = kasMasuk - kasKeluar;

  for(const k of allKas){
    if(k.tipe==='keluar' && !k.refTransaksiId && inRange(k.tanggal)) stats.pengeluaran += k.jumlah||0;
  }
  const saldo = allKas.reduce((s,k)=> s + (k.tipe==='masuk'?k.jumlah:-k.jumlah), 0);

  const setEl = (id, val)=>{ const el = document.getElementById(id); if(el) el.textContent = val; };
  setEl('lapBeli', fmtRupiah(stats.beliPeriode));
  setEl('lapJual', fmtRupiah(stats.jualPeriode));
  setEl('lapUtang', fmtRupiah(stats.utang));
  setEl('lapPiutang', fmtRupiah(stats.piutang));
  setEl('lapPengeluaran', fmtRupiah(stats.pengeluaran));
  setEl('lapLaba', fmtRupiah(stats.jualPeriode - stats.beliPeriode - stats.pengeluaran));
  setEl('kasSaldoBadge', fmtRupiah(saldo));
  setEl('lapKasHarian', fmtRupiah(stats.cashNet));
  setEl('lapNTrans', String(stats.nTrans));

  // Margin kotor ala kaki5: bar persentase (jual-beli)/jual, warna ikut ambang.
  const marginCard = document.getElementById('lapMarginCard');
  if(marginCard){
    const marginPct = stats.jualPeriode > 0 ? Math.round(((stats.jualPeriode - stats.beliPeriode) / stats.jualPeriode) * 100) : 0;
    const col = marginPct > 30 ? 'var(--green)' : marginPct > 15 ? 'var(--brand)' : 'var(--red)';
    marginCard.innerHTML = `
      <div style="background:var(--line);border-radius:10px;height:14px;overflow:hidden">
        <div style="background:${col};height:100%;width:${Math.max(marginPct,0)}%;border-radius:10px;transition:width .5s"></div>
      </div>
      <div style="text-align:center;margin-top:6px;font-size:20px;font-weight:800;color:${col}">${marginPct}%</div>`;
  }

  const barChart = document.getElementById('barChart');
  if(barChart){
    const titleEl = document.getElementById('lapChartTitle');
    if(titleEl) titleEl.textContent = chartTitle();
    const subEl = document.getElementById('chartSub');
    const hintEl = document.getElementById('chartSwipeHint');
    // ── Render ala kaki5 renderHourlyChart (v160) — teknik presentasinya,
    // seri tetap Beli/Jual khas rosok: (1) sumbu dipangkas dari bucket aktif
    // pertama s/d terakhir + 1 longgar tiap ujung; (2) bar NOL tanpa stub 3px;
    // (3) tinggi dibulatkan (dulu 8.731914893617022px); (4) label nilai 'k'
    // di atas kolom; (5) tanpa data → pesan kosong, bukan grafik rata 24 kolom.
    let lo = -1, hi = -1;
    buckets.forEach((b, i) => { if(b.beli > 0 || b.jual > 0){ if(lo < 0) lo = i; hi = i; } });
    if(lo < 0){
      barChart.className = 'barchart';
      if(hintEl) hintEl.style.display = 'none';
      barChart.innerHTML = '<div class="chart-empty">Belum ada transaksi pada rentang ini — geser periode di filter atas.</div>';
      if(subEl) subEl.textContent = '';
    } else {
      lo = Math.max(0, lo - 1);
      hi = Math.min(buckets.length - 1, hi + 1);
      const view = buckets.slice(lo, hi + 1);
      const maxVal = view.reduce((m, b) => Math.max(m, b.beli, b.jual), 1);
      const long = view.length > 14;
      if(hintEl) hintEl.style.display = long ? 'block' : 'none';
      barChart.className = 'barchart' + (long ? ' scrollable' : '');
      barChart.innerHTML = view.map(b => {
        const beliH = b.beli > 0 ? Math.max(Math.round((b.beli / maxVal) * 120), 4) : 0;
        const jualH = b.jual > 0 ? Math.max(Math.round((b.jual / maxVal) * 120), 4) : 0;
        const valLbl = b.jual > 0 ? Math.round(b.jual / 1000) + 'k' : (b.beli > 0 ? Math.round(b.beli / 1000) + 'k' : '');
        return `<div class="bwrap" title="${b.label} · Beli ${fmtRupiah(b.beli)} · Jual ${fmtRupiah(b.jual)}">
          <div class="chart-val">${valLbl}</div>
          <div style="display:flex; gap:3px; align-items:flex-end; height:var(--chart-h,120px); width:100%;">
            <div class="bar" style="height:${beliH}px;"></div>
            <div class="bar jual" style="height:${jualH}px;"></div>
          </div>
          <div class="blbl">${b.label}</div>
        </div>`;
      }).join('');
      if(subEl){
        subEl.textContent = laporanPeriode === 'harian'
          ? `${laporanAnchor} · jam ${buckets[lo].label}–${buckets[hi].label} · ${stats.nTrans} transaksi`
          : `${view.length} kolom aktif dari ${buckets.length} · ${stats.nTrans} transaksi`;
      }
    }
  }

  const items = await db.transaksiItem.toArray();
  const byKat = {};
  for(const it of items){
    const tr = transMap[it.transaksiId];
    if(tr && !tr.void && inRange(tr.tanggal)){
      if(!byKat[it.kategoriNama]) byKat[it.kategoriNama] = { kg:0, omzet:0 };
      byKat[it.kategoriNama].kg += it.berat;
      byKat[it.kategoriNama].omzet += it.subtotal || 0;
    }
  }
  const topList = document.getElementById('topKategoriList');
  if(topList){
    const ranked = Object.entries(byKat).sort((a,b)=>b[1].kg - a[1].kg).slice(0,5);
    topList.innerHTML = ranked.length ? ranked.map(([nama, s], i) => `
      <div class="top-menu-item">
        <div class="top-rank">${i+1}</div>
        <div class="top-menu-info">
          <div class="top-menu-name">${escapeHtml(nama)}</div>
          <div class="top-menu-stat">${fmtKg(s.kg)} diperdagangkan</div>
        </div>
        <div class="top-menu-total">${fmtRupiah(s.omzet)}</div>
      </div>
    `).join('') : '<div class="hint">Belum ada data pada periode ini</div>';
  }

  const tempoList = document.getElementById('tempoList');
  if(tempoList) tempoList.innerHTML = allTrans.filter(t=>!t.void&&(t.sisa||0)>0).sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal)).map(t=>`
    <div class="row-item" onclick="window._ksr_openLunasi(${t.id})">
      <div class="row-icon ${t.tipe}">${t.tipe==='beli'?'🛒':'📦'}</div>
      <div class="row-body">
        <div class="row-title">${t.tipe==='beli' ? 'Utang ke ' : 'Piutang dari '}${escapeHtml(t.kontakNama || (t.tipe==='beli'?'Penjual':'Pembeli'))}</div>
        <div class="row-sub">${fmtDate(t.tanggal)}</div>
      </div>
      <div class="row-amt ${t.tipe==='beli'?'red':'green'}">${fmtRupiah(t.sisa)}</div>
    </div>
  `).join('') || '<div class="hint">Tidak ada utang/piutang tempo 👍</div>';

  const kasList = document.getElementById('kasList');
  if(kasList) kasList.innerHTML = allKas.sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal)).slice(0,8).map(k=>`
    <div class="row-item">
      <div class="row-icon ${k.tipe==='masuk'?'kas-masuk':'kas-keluar'}">${k.tipe==='masuk'?'⬆️':'⬇️'}</div>
      <div class="row-body"><div class="row-title">${escapeHtml(k.keterangan||'-')}</div><div class="row-sub">${fmtDate(k.tanggal)}</div></div>
      <div class="row-amt ${k.tipe==='masuk'?'green':'red'}">${k.tipe==='masuk'?'+':'-'}${fmtRupiah(k.jumlah)}</div>
    </div>
  `).join('') || '<div class="hint">Belum ada catatan kas</div>';

  const shiftList = document.getElementById('kasShiftHistoryList');
  if(shiftList) shiftList.innerHTML = (await db.kasShift.orderBy('waktuBuka').reverse().toArray()).slice(0,10).map(s=>`
    <div class="row-item">
      <div class="row-icon ${s.status==='buka'?'kas-masuk':'kas-keluar'}">${s.status==='buka'?'🔓':'🔒'}</div>
      <div class="row-body">
        <div class="row-title">${fmtDate(s.waktuBuka)}${s.status==='buka' ? ' <span class="badge green">Sedang berjalan</span>' : ''}</div>
        <div class="row-sub">Modal ${fmtRupiah(s.modalAwal)}${s.status==='tutup' ? ` · Sistem ${fmtRupiah(s.kasSistemAkhir)} · Fisik ${fmtRupiah(s.kasFisikAkhir)}` : ''}</div>
      </div>
      ${s.status==='tutup' ? `<div class="row-amt ${s.selisih===0?'green':'red'}">${s.selisih>0?'+':''}${fmtRupiah(s.selisih)}</div>` : ''}
    </div>
  `).join('') || '<div class="hint">Belum ada riwayat buka/tutup kas</div>';

  // Fitur kas/shift mati (⚙️ Fitur Aplikasi) → kartu riwayat tidak dirender
  // (pola kaki5 v166). Data shift lama tetap ada di DB, hanya tersembunyi.
  const shiftCard = document.getElementById('kasShiftCard');
  if(shiftCard) shiftCard.style.display = (await fiturKasAktif()) ? '' : 'none';

  await renderTutupBuku();
}

// ── Tutup Buku Tahunan ─────────────────────────────────────────────────────
export async function renderTutupBuku(){
  const el = document.getElementById('tutupBukuList');
  const badge = document.getElementById('tutupBukuStatusBadge');
  const tahunLbl = document.getElementById('tutupBukuTahunLbl');
  const thn = new Date().getFullYear();
  if(tahunLbl) tahunLbl.textContent = thn;
  const list = await db.tutupBuku.orderBy('tahun').reverse().toArray();
  const closed = list.find(x => x.tahun === thn);
  if(badge){
    badge.textContent = closed ? 'Sudah ditutup' : 'Belum ditutup';
    badge.className = 'badge ' + (closed ? 'green' : 'orange');
  }
  if(el){
    el.innerHTML = list.length ? list.slice(0,5).map(x => `
      <div class="row-item">
        <div class="row-icon kas-keluar">📕</div>
        <div class="row-body">
          <div class="row-title">Tutup Buku ${x.tahun}</div>
          <div class="row-sub">${fmtDate(x.tanggalTutup)} · Laba ${fmtRupiah(x.laba)}</div>
        </div>
        <div class="row-amt green">${fmtRupiah(x.saldoKas)}</div>
      </div>
    `).join('') : '<div class="hint">Belum ada tutup buku tahunan</div>';
  }
}

async function tutupBukuSummary(tahun){
  // Pakai tahun LOKAL (toLocalISO) supaya transaksi dini hari 1 Jan (00:00–06:59 WIB)
  // terhitung tahun yang benar, bukan tahun sebelumnya (tanggal ISO tersimpan UTC).
  const akhir = tahun + '-12-31T23:59:59.999';
  const allTrans = (await db.transaksi.toArray()).filter(t => !t.void && toLocalISO(new Date(t.tanggal)).slice(0,4) === String(tahun));
  const beli = allTrans.filter(t=>t.tipe==='beli').reduce((s,t)=>s+(t.total||0),0);
  const jual = allTrans.filter(t=>t.tipe==='jual').reduce((s,t)=>s+(t.total||0),0);
  const allKas = await db.kas.toArray();
  const saldo = allKas.filter(k => k.tanggal <= akhir).reduce((s,k)=> s + (k.tipe==='masuk'?k.jumlah:-k.jumlah), 0);
  return { tahun, beli, jual, laba: jual - beli, saldoKas: saldo, jumlahTrans: allTrans.length };
}

export async function openTutupBuku(){
  const body = document.getElementById('tutupBukuBody');
  if(!body) return;
  const tahun = new Date().getFullYear();
  const closed = await db.tutupBuku.where('tahun').equals(tahun).first();
  const s = await tutupBukuSummary(tahun);
  body.innerHTML = `
    <div class="card card-no-shadow">
      <div class="flex-between"><span>Transaksi ${tahun}</span><b>${s.jumlahTrans} transaksi</b></div>
      <div class="flex-between mt8"><span>Total Pembelian</span><b>${fmtRupiah(s.beli)}</b></div>
      <div class="flex-between mt8"><span>Total Penjualan</span><b>${fmtRupiah(s.jual)}</b></div>
      <div class="flex-between mt8"><span>Laba Kotor</span><b class="${s.laba>=0?'green':'red'}">${fmtRupiah(s.laba)}</b></div>
      <div class="flex-between mt8"><span>Saldo Kas Akhir Tahun</span><b>${fmtRupiah(s.saldoKas)}</b></div>
    </div>
    ${closed
      ? `<div class="hint text-center mt12">📕 Tahun ${tahun} sudah ditutup buku pada ${fmtDate(closed.tanggalTutup)}.</div>`
      : `<div class="field mt12"><label class="field-label">Tahun</label><input type="number" id="tutupBukuTahunInput" value="${tahun}" min="2000" max="2100"></div>
         <button class="btn btn-primary mt12" onclick="window._ksr_tutupBuku()">🔒 Tutup Buku ${tahun} Sekarang</button>`
    }
  `;
  openOverlay('sheetTutupBuku');
}

export async function tutupBuku(){
  const input = document.getElementById('tutupBukuTahunInput');
  const tahun = parseInt((input && input.value) || new Date().getFullYear());
  if(!tahun || tahun < 2000 || tahun > 2100){ toast('Tahun tidak valid'); return; }
  const existing = await db.tutupBuku.where('tahun').equals(tahun).first();
  if(existing){ toast('Tahun ' + tahun + ' sudah ditutup buku'); return; }
  if(!(await showConfirm({ icon:'🔒', text:'Yakin menutup buku tahun ' + tahun + '? Rekap tahunan akan dikunci permanen.', okLabel:'Tutup Buku' }))) return;
  const s = await tutupBukuSummary(tahun);
  await db.tutupBuku.add({ tahun, tanggalTutup: new Date().toISOString(), totalBeli: s.beli, totalJual: s.jual, laba: s.laba, saldoKas: s.saldoKas, jumlahTrans: s.jumlahTrans });
  closeSheet('sheetTutupBuku');
  await renderTutupBuku();
  window.dispatchEvent(new CustomEvent('ksr-data-changed'));
  toast('Buku tahun ' + tahun + ' ditutup 📕');
}

window._ksr_setLaporanPeriode = setLaporanPeriode;
window._ksr_shiftLaporanPeriod = shiftLaporanPeriod;
window._ksr_togglePicker = toggleCustomPicker;
window._ksr_pickDate = pickDate;
window._ksr_pickWeek = pickWeek;
window._ksr_pickMonth = pickMonth;
window._ksr_pickNavMonth = pickNavMonth;
window._ksr_pickCustomDate = pickCustomDate;
window._ksr_renderLaporan = renderLaporan;
window._ksr_openLunasi = openLunasi;
window._ksr_saveLunasi = saveLunasi;
window._ksr_openTutupBuku = openTutupBuku;
window._ksr_tutupBuku = tutupBuku;
