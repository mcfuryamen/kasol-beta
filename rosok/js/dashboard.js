/* =========================================================================
   KASIR SOLO - ROSOK
   dashboard.js — Dashboard refresh
   ========================================================================= */
import { db } from './db.js';
import { KATEGORI, loadKategori } from './app-state.js';
import { fmtRupiah, fmtKg, fmtDate, todayStr, escapeHtml } from './utils.js';
import { renderPlatformCarousel } from './carousel.js';
import { refreshShiftCache } from './kas.js';

export async function refreshAll(){
  await refreshShiftCache();
  await loadKategori(); // segarkan KATEGORI dari DB (stok berubah setelah transaksi/void/delete)
  renderPlatformCarousel();

  const allKas = await db.kas.toArray();
  const saldo = allKas.reduce((s,k)=> s + (k.tipe==='masuk'?k.jumlah:-k.jumlah), 0);
  document.getElementById('statKas').textContent = fmtRupiah(saldo);

  const totalStok = KATEGORI.reduce((s,k)=>s+(k.stokKg||0),0);
  document.getElementById('statStok').textContent = fmtKg(totalStok);

  const today = todayStr();
  const allTrans = await db.transaksi.toArray();
  const beliHariIni = allTrans.filter(t=>t.tipe==='beli'&&t.tanggal.slice(0,10)===today&&!t.void).reduce((s,t)=>s+t.total,0);
  const jualHariIni = allTrans.filter(t=>t.tipe==='jual'&&t.tanggal.slice(0,10)===today&&!t.void).reduce((s,t)=>s+t.total,0);
  document.getElementById('statBeliHariIni').textContent = fmtRupiah(beliHariIni);
  document.getElementById('statJualHariIni').textContent = fmtRupiah(jualHariIni);

  const recent = allTrans.filter(t => !t.void).sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal)).slice(0,5);
  const recCard = document.getElementById('dashRecentCard');
  if(recCard){
    recCard.innerHTML = recent.length
      ? recent.map(t => `
        <div class="row-item" onclick="window._ksr_viewTransaksiDetail(${t.id})">
          <div class="row-icon ${t.tipe}">${t.tipe==='beli'?'🛒':'📦'}</div>
          <div class="row-body">
            <div class="row-title">${t.tipe==='beli'?'Beli Rosok':'Jual Rosok'}${t.kontakNama?' · '+escapeHtml(t.kontakNama):''}${(t.metodeBayar||'tunai')==='transfer' ? ' <span class="badge blue">Transfer</span>' : ''}</div>
            <div class="row-sub">${fmtDate(t.tanggal)}</div>
          </div>
          <div class="row-amt ${t.tipe==='beli'?'red':'green'}">${t.tipe==='beli'?'-':'+'}${fmtRupiah(t.total)}</div>
        </div>
      `).join('')
      : '<div class="empty-state"><div class="ic">🧾</div><div class="t1">Belum ada transaksi</div><div class="t2">Yuk mulai transaksi pertama!</div></div>';
  }
}

window.addEventListener('ksr-data-changed', refreshAll);
window.addEventListener('ksr-kas-changed', refreshAll);
