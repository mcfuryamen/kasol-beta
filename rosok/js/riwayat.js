/* =========================================================================
   KASIR SOLO - ROSOK
   riwayat.js — Transaction history
   ========================================================================= */
import { db } from './db.js';
import { riwayatFilter, riwayatPeriode, riwayatDateFrom, riwayatDateTo, riwayatPage, RIWAYAT_PER_PAGE, lastNotaData, setRiwayatFilter as setRiwayatFilterState, setRiwayatPeriode as setRiwayatPeriodeState, setRiwayatDateFrom, setRiwayatDateTo, setRiwayatPage, setLastNotaData } from './app-state.js';
import { fmtRupiah, fmtDate, escapeHtml, openOverlay, closeSheet, toast, showLoading, hideLoading } from './utils.js';
import { renderNota } from './pos.js';

let _refreshAll = null;
export function setRiwayatRefs(refs){ _refreshAll = refs.refreshAll; }

export function setRiwayatFilter(f){
  setRiwayatFilterState(f);
  document.querySelectorAll('#screen-riwayat .tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('#screen-riwayat [data-f]').forEach(b=>b.classList.toggle('active', b.dataset.f===f));
  renderRiwayat();
}

// ── Filter periode ─────────────────────────────────────────────────────────
// Hitung batas [start, end] Date berdasarkan preset periode riwayat.
function riwayatPeriodRange(){
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch(riwayatPeriode){
    case 'today': return { start: startOfDay, end: now };
    case '7d':    return { start: new Date(now.getTime() - 6*24*3600*1000), end: now };
    case '30d':   return { start: new Date(now.getTime() - 29*24*3600*1000), end: now };
    case 'custom': {
      const from = riwayatDateFrom ? new Date(riwayatDateFrom + 'T00:00:00') : null;
      const toRaw = riwayatDateTo ? new Date(riwayatDateTo + 'T23:59:59.999') : null;
      return { start: from, end: toRaw };
    }
    default: return { start: null, end: null };
  }
}

function formatPeriodeLbl(){
  const { start, end } = riwayatPeriodRange();
  const d = dt => dt ? dt.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) : '';
  switch(riwayatPeriode){
    case 'today': return 'Periode: Hari Ini';
    case '7d':    return 'Periode: 7 hari terakhir';
    case '30d':   return 'Periode: 30 hari terakhir';
    case 'custom':
      if(riwayatDateFrom && riwayatDateTo) return `Periode: ${d(start)} – ${d(end)}`;
      if(riwayatDateFrom) return `Periode: dari ${d(start)}`;
      if(riwayatDateTo) return `Periode: sampai ${d(end)}`;
      return 'Periode: Pilih tanggal di bawah';
    default: return '';
  }
}

export function setRiwayatPeriode(p){
  setRiwayatPeriodeState(p);
  const custom = p === 'custom';
  const rangeEl = document.getElementById('riwayatCustomRange');
  if(rangeEl) rangeEl.classList.toggle('hidden', !custom);
  const lbl = document.getElementById('riwayatPeriodeLbl');
  if(lbl) lbl.textContent = formatPeriodeLbl();
  document.querySelectorAll('#screen-riwayat [data-p]').forEach(b=>b.classList.toggle('active', b.dataset.p===p));
  renderRiwayat();
}

export function applyRiwayatCustom(){
  const from = document.getElementById('riwayatFrom').value;
  const to = document.getElementById('riwayatTo').value;
  setRiwayatDateFrom(from);
  setRiwayatDateTo(to);
  if(riwayatPeriode !== 'custom') setRiwayatPeriodeState('custom');
  document.querySelectorAll('#screen-riwayat [data-p]').forEach(b=>b.classList.toggle('active', b.dataset.p==='custom'));
  const lbl = document.getElementById('riwayatPeriodeLbl');
  if(lbl) lbl.textContent = formatPeriodeLbl();
  renderRiwayat();
}

export function resetRiwayatPeriode(){
  setRiwayatDateFrom('');
  setRiwayatDateTo('');
  const fromEl = document.getElementById('riwayatFrom');
  const toEl = document.getElementById('riwayatTo');
  if(fromEl) fromEl.value = '';
  if(toEl) toEl.value = '';
  setRiwayatPeriode('semua');
}

export async function renderRiwayat(){
  setRiwayatPage(0);
  await loadRiwayatPage();
}

export async function loadRiwayatPage(){
  const offset = riwayatPage * RIWAYAT_PER_PAGE;
  let query = db.transaksi.orderBy('tanggal').reverse();
  if(riwayatFilter !== 'semua') query = db.transaksi.where('tipe').equals(riwayatFilter).reverse();
  const allTrans = await query.offset(offset).limit(RIWAYAT_PER_PAGE + 1).toArray();
  // Filter rentang tanggal (periode) terhadap hasil query database
  const { start, end } = riwayatPeriodRange();
  let list = allTrans.filter(t => {
    if(t.void) return false;
    if(start || end){
      const dt = new Date(t.tanggal);
      if(start && dt < start) return false;
      if(end && dt > end) return false;
    }
    return true;
  });
  const hasMore = allTrans.filter(t => !t.void).length > RIWAYAT_PER_PAGE && list.length >= RIWAYAT_PER_PAGE;
  if(hasMore) list = list.slice(0, RIWAYAT_PER_PAGE);

  const card = document.getElementById('riwayatList');
  if(!card) return;
  if(list.length === 0){
    card.innerHTML = '<div class="empty-state"><div class="ic">🧾</div><div class="t1">Belum ada transaksi</div><div class="t2">Tidak ada transaksi pada filter ini. Ubah tipe atau periode.</div></div>';
    return;
  }
  card.innerHTML = list.map(t => `
    <div class="row-item" onclick="window._ksr_viewTransaksiDetail(${t.id})">
      <div class="row-icon ${t.tipe}">${t.tipe==='beli' ? '🛒' : '📦'}</div>
      <div class="row-body">
        <div class="row-title">${t.tipe==='beli' ? 'Beli Rosok' : 'Jual Rosok'}${t.kontakNama ? ' · '+escapeHtml(t.kontakNama) : ''}${(t.sisa||0)>0 ? ' <span class="badge red">Tempo</span>' : ''}${(t.metodeBayar||'tunai')==='transfer' ? ' <span class="badge blue">Transfer</span>' : ''}</div>
        <div class="row-sub">${fmtDate(t.tanggal)}</div>
      </div>
      <div class="row-amt ${t.tipe==='beli' ? 'red' : 'green'}">${t.tipe==='beli'?'-':'+'}${fmtRupiah(t.total)}</div>
    </div>
  `).join('');
  if(hasMore) card.innerHTML += '<div class="text-center p16"><button class="btn btn-soft btn-sm" onclick="window._ksr_loadRiwayatPage()">Muat Lebih Banyak</button></div>';
}

export async function viewTransaksiDetail(id){
  const t = await db.transaksi.get(id);
  const items = await db.transaksiItem.where('transaksiId').equals(id).toArray();
  setLastNotaData({
    id: t.id, tipe: t.tipe, tanggal: t.tanggal, total: t.total, namaKontak: t.kontakNama, catatan: t.catatan,
    metodeBayar: t.metodeBayar || 'tunai', dibayarkan: (t.dibayarkan!==undefined ? t.dibayarkan : t.total), sisa: t.sisa||0,
    items: items.map(it=>({nama:it.kategoriNama, berat:it.berat, harga:it.hargaSatuan, subtotal:it.subtotal, emoji:''}))
  });
  renderNota(lastNotaData);
  let extraBtns = '';
  if((t.sisa||0) > 0) extraBtns += `<button class="btn btn-primary mt12" onclick="window._ksr_closeNota(); window._ksr_openLunasi(${t.id})">💰 Lunasi Sekarang</button>`;
  extraBtns += `<button class="btn btn-warning mt12" onclick="window._ksr_voidTransaksi(${t.id})">❌ Batal (Void)</button>`;
  extraBtns += `<button class="btn btn-danger mt12" onclick="window._ksr_deleteTransaksi(${t.id})">🗑️ Hapus</button>`;
  document.getElementById('notaBody').insertAdjacentHTML('beforeend', extraBtns);
  openOverlay('sheetNota');
}

export function closeNotaSheet(){ closeSheet('sheetNota'); }

export async function deleteTransaksi(id){
  if(!confirm('Hapus transaksi ini? Stok dan kas akan disesuaikan kembali.')) return;
  try {
    await db.transaction('rw', db.transaksi, db.transaksiItem, db.kategori, db.kas, async () => {
      const t = await db.transaksi.get(id);
      if(!t) { throw new Error('Transaksi tidak ditemukan'); }
      if(t.void){ toast('Transaksi sudah dibatalkan (void), stok tidak perlu dibalik ulang'); return; }
      const items = await db.transaksiItem.where('transaksiId').equals(id).toArray();
      for(const it of items){
        const kat = await db.kategori.get(it.kategoriId);
        if(kat){
          const newStok = t.tipe==='beli' ? (kat.stokKg||0) - it.berat : (kat.stokKg||0) + it.berat;
          await db.kategori.update(it.kategoriId, {stokKg: Math.max(0, Math.round(newStok*1000)/1000)});
        }
      }
      await db.transaksiItem.where('transaksiId').equals(id).delete();
      await db.transaksi.delete(id);
      await db.kas.where('refTransaksiId').equals(id).delete();
    });
    closeSheet('sheetNota');
    renderRiwayat();
    window.dispatchEvent(new CustomEvent('ksr-data-changed'));
    toast('Transaksi dihapus');
  } catch(e){
    console.error('Delete error:', e);
    toast('Gagal menghapus transaksi');
  }
}

export async function voidTransaksi(id){
  if(!confirm('Yakin membatalkan transaksi ini?')) return;
  if(!confirm('Konfirmasi: Transaksi akan dibatalkan (void).')) return;
  try {
    await db.transaction('rw', db.transaksi, db.transaksiItem, db.kategori, db.kas, async () => {
      showLoading('Membatalkan transaksi...');
      const t = await db.transaksi.get(id);
      if(!t) { throw new Error('Transaksi tidak ditemukan'); }
      const items = await db.transaksiItem.where('transaksiId').equals(id).toArray();
      for(const it of items){
        const kat = await db.kategori.get(it.kategoriId);
        if(kat){
          const newStok = t.tipe==='beli' ? (kat.stokKg||0) - it.berat : (kat.stokKg||0) + it.berat;
          await db.kategori.update(it.kategoriId, {stokKg: Math.max(0, Math.round(newStok*1000)/1000)}); 
        }
      }
      await db.kas.where('refTransaksiId').equals(id).delete();
      await db.transaksi.update(id, { catatan: (t.catatan||'') + ' [VOID]', void: true });
    });
    closeSheet('sheetNota');
    renderRiwayat();
    window.dispatchEvent(new CustomEvent('ksr-data-changed'));
    toast('Transaksi berhasil dibatalkan');
  } catch(e){
    console.error('Void error:', e);
    toast('Gagal membatalkan transaksi');
  } finally {
    hideLoading();
  }
}

window._ksr_setRiwayatFilter = setRiwayatFilter;
window._ksr_setRiwayatPeriode = setRiwayatPeriode;
window._ksr_applyRiwayatCustom = applyRiwayatCustom;
window._ksr_resetRiwayatPeriode = resetRiwayatPeriode;
window._ksr_renderRiwayat = renderRiwayat;
window._ksr_loadRiwayatPage = loadRiwayatPage;
window._ksr_viewTransaksiDetail = viewTransaksiDetail;
window._ksr_deleteTransaksi = deleteTransaksi;
window._ksr_voidTransaksi = voidTransaksi;
window._ksr_loadMore = loadRiwayatPage;
window._ksr_closeNota = closeNotaSheet;
