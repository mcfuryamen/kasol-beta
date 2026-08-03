/* =========================================================================
   KASIR SOLO - ROSOK
   laporan.js — Reports
   ========================================================================= */
import { db } from './db.js';
import { laporanPeriode, laporanDateFrom, laporanDateTo, setLaporanPeriode as setLaporanPeriodeState, setLaporanDateFrom, setLaporanDateTo } from './app-state.js';
import { fmtRupiah, fmtKg, fmtDate, escapeHtml, openOverlay, closeSheet, toast, unformatRupiah } from './utils.js';

let _lunasiId = null;

// Helper: format tanggal ke 'YYYY-MM-DD' pakai waktu lokal (bukan UTC).
// toISOString() bisa offset -7 jam di Indonesia, sehingga tanggalnya mundur 1 hari.
function toLocalISO(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export function setLaporanPeriode(p){
  setLaporanPeriodeState(p);
  const custom = p === 'custom';
  const rangeEl = document.getElementById('laporanCustomRange');
  if(rangeEl) rangeEl.classList.toggle('hidden', !custom);
  const lbl = document.getElementById('laporanPeriodeLbl');
  if(lbl) lbl.textContent = formatLaporanPeriodeLbl();
  document.querySelectorAll('#screenLaporanFilter .tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.p===p));
  renderLaporan();
}

export function applyLaporanCustom(){
  const from = document.getElementById('laporanFrom').value;
  const to = document.getElementById('laporanTo').value;
  setLaporanDateFrom(from);
  setLaporanDateTo(to);
  if(laporanPeriode !== 'custom') setLaporanPeriodeState('custom');
  document.querySelectorAll('#screenLaporanFilter .tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.p==='custom'));
  const lbl = document.getElementById('laporanPeriodeLbl');
  if(lbl) lbl.textContent = formatLaporanPeriodeLbl();
  renderLaporan();
}

export function resetLaporanPeriode(){
  setLaporanDateFrom('');
  setLaporanDateTo('');
  const fromEl = document.getElementById('laporanFrom');
  const toEl = document.getElementById('laporanTo');
  if(fromEl) fromEl.value = '';
  if(toEl) toEl.value = '';
  setLaporanPeriode('semua');
}

function formatLaporanPeriodeLbl(){
  const d = dt => dt ? dt.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) : '';
  switch(laporanPeriode){
    case 'semua': return 'Semua periode';
    case 'today': return 'Periode: Hari Ini';
    case 'week':  return 'Periode: 7 hari terakhir';
    case 'month': return 'Periode: 30 hari terakhir';
    case 'custom':{
      if(laporanDateFrom && laporanDateTo) return `Periode: ${d(new Date(laporanDateFrom+'T00:00:00'))} – ${d(new Date(laporanDateTo+'T00:00:00'))}`;
      if(laporanDateFrom) return `Periode: dari ${d(new Date(laporanDateFrom+'T00:00:00'))}`;
      if(laporanDateTo) return `Periode: sampai ${d(new Date(laporanDateTo+'T00:00:00'))}`;
      return 'Periode: Pilih tanggal di bawah';
    }
    default: return '';
  }
}

function reportRange(){
  if(laporanPeriode === 'semua') return { start: null, end: null };
  if(laporanPeriode === 'custom'){
    const start = laporanDateFrom ? new Date(laporanDateFrom + 'T00:00:00') : null;
    const end = laporanDateTo ? new Date(laporanDateTo + 'T23:59:59.999') : null;
    return { start, end };
  }
  return { start: periodeStartDate(), end: null };
}

export function periodeStartDate(){
  const d = new Date();
  d.setHours(0,0,0,0);
  if(laporanPeriode === 'today') return d;
  if(laporanPeriode === 'week') d.setDate(d.getDate() - 6);
  else if(laporanPeriode === 'month') d.setMonth(d.getMonth() - 1);
  else d.setDate(d.getDate() - 6); // fallback = 7 hari
  return d;
}

// Bucket grafik adaptif: hari ini = per jam; lainnya = per hari (utc).
function chartBuckets(){
  const now = new Date();
  if(laporanPeriode === 'today'){
    const buckets = [];
    for(let h=0; h<24; h++) buckets.push({ key:'h'+String(h).padStart(2,'0'), label:String(h).padStart(2,'0'), beli:0, jual:0 });
    return buckets;
  }
  if(laporanPeriode === 'semua'){
    const buckets = [];
    for(let i=11; i>=0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      const label = d.toLocaleDateString('id-ID',{month:'short'});
      buckets.push({ key: ym, label, beli:0, jual:0 });
    }
    return buckets;
  }
  if(laporanPeriode === 'custom'){
    // Rentang tanggal custom → bucket per hari (abil hingga 45 hari terakhir rentang)
    const start = laporanDateFrom ? new Date(laporanDateFrom + 'T00:00:00') : null;
    const end = laporanDateTo ? new Date(laporanDateTo + 'T23:59:59.999') : now;
    const dayMs = 24*3600*1000;
    const totalDays = start ? Math.min(45, Math.max(1, Math.round((end - start)/dayMs) + 1)) : 31;
    const buckets = [];
    for(let i=totalDays-1; i>=0; i--){
      const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const iso = toLocalISO(d);
      buckets.push({ key: iso, label: String(d.getDate()), beli:0, jual:0 });
    }
    return buckets;
  }
  const days = laporanPeriode==='month' ? 30 : 7;
  const buckets = [];
  for(let i=days-1; i>=0; i--){
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const iso = toLocalISO(d);
    const dt = new Date(d);
    const label = laporanPeriode === 'week'
      ? dt.toLocaleDateString('id-ID',{weekday:'short'})
      : String(dt.getDate());
    buckets.push({ key: iso, label, beli:0, jual:0 });
  }
  return buckets;
}

function chartTitle(){
  if(laporanPeriode === 'semua') return 'Omzet 12 Bulan Terakhir (per Bulan)';
  if(laporanPeriode === 'custom') return 'Omzet Periode Kustom (per Hari)';
  return laporanPeriode==='today' ? 'Omzet Hari Ini (per Jam)'
    : laporanPeriode==='week' ? 'Omzet 7 Hari Terakhir'
    : 'Omzet 30 Hari Terakhir';
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
  const t = await db.transaksi.get(_lunasiId);
  if(!t) return;
  let jumlah = unformatRupiah(document.getElementById('lunasiJumlahInput').value) || 0;
  if(jumlah <= 0){ toast('Isi jumlah dulu'); return; }
  if(jumlah > t.sisa) jumlah = t.sisa;
  const newDibayarkan = (t.dibayarkan||0) + jumlah;
  const newSisa = Math.max(0, Math.round(t.total - newDibayarkan));
  await db.transaksi.update(t.id, {dibayarkan: newDibayarkan, sisa: newSisa});
  await db.kas.add({ tanggal: new Date().toISOString(), tipe: t.tipe==='beli'?'keluar':'masuk', jumlah, keterangan: (t.tipe==='beli'?'Pelunasan utang':'Pelunasan piutang') + (t.kontakNama?' - '+t.kontakNama:''), refTransaksiId: t.id });
  closeSheet('sheetLunasi');
  toast(newSisa<=0 ? 'Tempo lunas! 🎉' : 'Pelunasan sebagian tercatat');
  renderLaporan();
  window.dispatchEvent(new CustomEvent('ksr-data-changed'));
}

export async function renderLaporan(){
  const range = reportRange();
  const inRange = (iso) => {
    const tgl = new Date(iso);
    return tgl >= range.start && (!range.end || tgl <= range.end);
  };

  const allTrans = await db.transaksi.toArray();
  const transMap = {};
  for(const t of allTrans) transMap[t.id] = t;

  const stats = { beliPeriode:0, jualPeriode:0, utang:0, piutang:0, pengeluaran:0 };
  const buckets = chartBuckets();
  const bucketMap = {};
  buckets.forEach(b => bucketMap[b.key] = b);

  for(const t of allTrans){
    if(t.void) continue;
    const isBeli = t.tipe==='beli';
    const isIn = inRange(t.tanggal);
    if(isIn){
      if(isBeli) stats.beliPeriode += t.total||0; else stats.jualPeriode += t.total||0;
      if((t.sisa||0) > 0){ if(isBeli) stats.utang += t.sisa; else stats.piutang += t.sisa; }
    }
    const localDateStr = toLocalISO(new Date(t.tanggal));
    const dk = laporanPeriode==='today' ? 'h' + new Date(t.tanggal).getHours().toString().padStart(2,'0')
      : laporanPeriode==='semua' ? t.tanggal.slice(0,7) // tahun-bulan tetap dari ISO string
      : localDateStr;
    const b = bucketMap[dk];
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
  setEl('lapSaldo', fmtRupiah(saldo));
  setEl('lapLabaKotor', fmtRupiah(stats.jualPeriode - stats.beliPeriode));
  setEl('lapLaba', fmtRupiah(stats.jualPeriode - stats.beliPeriode - stats.pengeluaran));
  setEl('kasSaldoBadge', fmtRupiah(saldo));
  setEl('lapKasHarian', fmtRupiah(stats.cashNet));

  const barChart = document.getElementById('barChart');
  if(barChart){
    const titleEl = document.getElementById('lapChartTitle');
    if(titleEl) titleEl.textContent = chartTitle();
    let maxVal = 1;
    buckets.forEach(b => { maxVal = Math.max(maxVal, b.beli, b.jual); });
    const long = buckets.length > 14;
    const hintEl = document.getElementById('chartSwipeHint');
    if(hintEl) hintEl.style.display = long ? 'block' : 'none';
    barChart.className = 'barchart' + (long ? ' scrollable' : '');
    barChart.innerHTML = buckets.map(b => `
      <div class="bwrap" title="${b.label}">
        <div style="display:flex; gap:2px; align-items:flex-end; height:90px; width:100%;">
          <div class="bar" style="height:${Math.max(3,(b.beli/maxVal)*90)}px;"></div>
          <div class="bar jual" style="height:${Math.max(3,(b.jual/maxVal)*90)}px;"></div>
        </div>
        <div class="blbl">${b.label}</div>
      </div>
    `).join('');
  }

  const items = await db.transaksiItem.toArray();
  const byKat = {};
  for(const it of items){
    const tr = transMap[it.transaksiId];
    if(tr && !tr.void && inRange(tr.tanggal)) byKat[it.kategoriNama] = (byKat[it.kategoriNama]||0) + it.berat;
  }
  const topList = document.getElementById('topKategoriList');
  if(topList) topList.innerHTML = Object.entries(byKat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([nama, berat]) => `
    <div class="flex-between row-divider">
      <span>${escapeHtml(nama)}</span><b>${fmtKg(berat)}</b>
    </div>
  `).join('');

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
  const akhir = tahun + '-12-31T23:59:59.999Z';
  const allTrans = (await db.transaksi.toArray()).filter(t => !t.void && t.tanggal.slice(0,4) === String(tahun));
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
  if(!confirm('Yakin menutup buku tahun ' + tahun + '? Rekap tahunan akan dikunci permanen.')) return;
  const s = await tutupBukuSummary(tahun);
  await db.tutupBuku.add({ tahun, tanggalTutup: new Date().toISOString(), totalBeli: s.beli, totalJual: s.jual, laba: s.laba, saldoKas: s.saldoKas, jumlahTrans: s.jumlahTrans });
  closeSheet('sheetTutupBuku');
  await renderTutupBuku();
  window.dispatchEvent(new CustomEvent('ksr-data-changed'));
  toast('Buku tahun ' + tahun + ' ditutup 📕');
}

window._ksr_setLaporanPeriode = setLaporanPeriode;
window._ksr_applyLaporanCustom = applyLaporanCustom;
window._ksr_resetLaporanPeriode = resetLaporanPeriode;
window._ksr_renderLaporan = renderLaporan;
window._ksr_openLunasi = openLunasi;
window._ksr_saveLunasi = saveLunasi;
window._ksr_openTutupBuku = openTutupBuku;
window._ksr_tutupBuku = tutupBuku;
