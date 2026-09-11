/* =========================================================================
   KASIR SOLO - ROSOK
   riwayat.js — Transaction history
   Filter tipe & periode riwayat DIHAPUS: daftar mengikuti filter laporan
   (reportRange dari laporan.js — Harian/Mingguan/Bulanan/Custom + jangkar).
   ========================================================================= */
import { db } from './db.js';
import { showConfirm } from './confirm.js';
import { riwayatPage, RIWAYAT_PER_PAGE, lastNotaData, setRiwayatPage, setLastNotaData } from './app-state.js';
import { fmtRupiah, fmtDate, escapeHtml, openOverlay, closeSheet, toast, showLoading, hideLoading } from './utils.js';
import { renderNota } from './pos.js';
import { reportRange, renderLaporan } from './laporan.js';

let _refreshAll = null;
export function setRiwayatRefs(refs){ _refreshAll = refs.refreshAll; }

const ROW_TPL = (t) => `
    <div class="row-item" onclick="window._ksr_viewTransaksiDetail(${t.id})">
      <div class="row-icon ${t.tipe}">${t.tipe==='beli' ? '🛒' : '📦'}</div>
      <div class="row-body">
        <div class="row-title">${t.tipe==='beli' ? 'Beli Rosok' : 'Jual Rosok'}${t.kontakNama ? ' · '+escapeHtml(t.kontakNama) : ''}${(t.sisa||0)>0 ? ' <span class="badge red">Tempo</span>' : ''}${(t.metodeBayar||'tunai')==='transfer' ? ' <span class="badge blue">Transfer</span>' : ''}</div>
        <div class="row-sub">${fmtDate(t.tanggal)}</div>
      </div>
      <div class="row-amt ${t.tipe==='beli' ? 'red' : 'green'}">${t.tipe==='beli'?'-':'+'}${fmtRupiah(t.total)}</div>
    </div>
  `;

export async function renderRiwayat(){
  setRiwayatPage(0);
  const card = document.getElementById('riwayatList');
  if(card) card.innerHTML = '';
  await appendRiwayatPage();
}

// Paging riwayat: APPEND (bukan replace) — tombol "Muat Lebih Banyak" menambah
// halaman berikutnya tanpa membuang daftar yang sudah tampil.
async function appendRiwayatPage(){
  // Saring dulu di memori (dataset kecil) baru slice — paging konsisten
  // dengan filter periode (dulu: offset Dexie dulu baru disaring = item hilang).
  const { start, end } = reportRange();
  const allTrans = (await db.transaksi.orderBy('tanggal').reverse().toArray())
    .filter(t => {
      if(t.void) return false;
      if(start || end){
        const dt = new Date(t.tanggal);
        if(start && dt < start) return false;
        if(end && dt > end) return false;
      }
      return true;
    });
  const offset = riwayatPage * RIWAYAT_PER_PAGE;
  const list = allTrans.slice(offset, offset + RIWAYAT_PER_PAGE);
  const hasMore = allTrans.length > offset + RIWAYAT_PER_PAGE;

  const card = document.getElementById('riwayatList');
  if(!card) return;
  // Empty state hanya bila benar-benar tidak ada transaksi sama sekali.
  if(riwayatPage === 0 && list.length === 0){
    card.innerHTML = '<div class="empty-state"><div class="ic">🧾</div><div class="t1">Belum ada transaksi</div><div class="t2">Tidak ada transaksi pada periode ini. Geser periode di filter atas.</div></div>';
    return;
  }
  // Buang tombol "Muat Lebih Banyak" lama sebelum menambah halaman + tombol baru.
  const oldBtn = card.querySelector('.riwayat-loadmore');
  if(oldBtn) oldBtn.remove();
  card.insertAdjacentHTML('beforeend', list.map(ROW_TPL).join(''));
  if(hasMore){
    card.insertAdjacentHTML('beforeend', '<div class="riwayat-loadmore text-center p16"><button class="btn btn-soft btn-sm" onclick="window._ksr_loadRiwayatPage()">Muat Lebih Banyak</button></div>');
    setRiwayatPage(riwayatPage + 1);
  }
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
  // Bukti transfer (pola kaki5): tampilkan foto + catatan bila ada.
  if(t.buktiBayar){
    const proofNote = t.catatanBayar ? `<div class="nota-sub" style="margin-top:6px">📝 ${escapeHtml(t.catatanBayar)}</div>` : '';
    document.getElementById('notaBody').insertAdjacentHTML('beforeend',
      `<div class="divider"></div>
       <div class="nota-sub">🏦 Bukti Transfer</div>
       <img src="${t.buktiBayar}" alt="Bukti transfer" style="max-width:100%;border-radius:10px;margin-top:6px;border:1px solid var(--line)" onclick="window.open('${t.buktiBayar}','_blank')">
       ${proofNote}`);
  }
  let extraBtns = '';
  if((t.sisa||0) > 0) extraBtns += `<button class="btn btn-primary mt12" onclick="window._ksr_closeNota(); window._ksr_openLunasi(${t.id})">💰 Lunasi Sekarang</button>`;
  extraBtns += `<button class="btn btn-warning mt12" onclick="window._ksr_voidTransaksi(${t.id})">❌ Batal (Void)</button>`;
  extraBtns += `<button class="btn btn-danger mt12" onclick="window._ksr_deleteTransaksi(${t.id})">🗑️ Hapus</button>`;
  document.getElementById('notaBody').insertAdjacentHTML('beforeend', extraBtns);
  openOverlay('sheetNota');
}

export function closeNotaSheet(){ closeSheet('sheetNota'); }

export async function deleteTransaksi(id){
  if(!(await showConfirm({ icon:'🗑️', text:'Hapus transaksi ini? Stok dan kas akan disesuaikan kembali.', okLabel:'Ya, Hapus' }))) return;
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
    renderLaporan();
    window.dispatchEvent(new CustomEvent('ksr-data-changed'));
    toast('Transaksi dihapus');
  } catch(e){
    console.error('Delete error:', e);
    toast('Gagal menghapus transaksi');
  }
}

export async function voidTransaksi(id){
  if(!(await showConfirm({ icon:'✖️', text:'Yakin membatalkan transaksi ini? Stok dan kas akan disesuaikan kembali.', okLabel:'Batalkan Transaksi' }))) return;
  try {
    await db.transaction('rw', db.transaksi, db.transaksiItem, db.kategori, db.kas, async () => {
      showLoading('Membatalkan transaksi...');
      const t = await db.transaksi.get(id);
      if(!t) { throw new Error('Transaksi tidak ditemukan'); }
      // Guard double-void: void kedua kali akan membalikkan stok dua kali.
      if(t.void){ throw new Error('Transaksi sudah dibatalkan sebelumnya'); }
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
    renderLaporan();
    window.dispatchEvent(new CustomEvent('ksr-data-changed'));
    toast('Transaksi berhasil dibatalkan');
  } catch(e){
    console.error('Void error:', e);
    toast('Gagal membatalkan transaksi');
  } finally {
    hideLoading();
  }
}

window._ksr_renderRiwayat = renderRiwayat;
window._ksr_loadRiwayatPage = appendRiwayatPage;
window._ksr_viewTransaksiDetail = viewTransaksiDetail;
window._ksr_deleteTransaksi = deleteTransaksi;
window._ksr_voidTransaksi = voidTransaksi;
window._ksr_loadMore = appendRiwayatPage;
window._ksr_closeNota = closeNotaSheet;
