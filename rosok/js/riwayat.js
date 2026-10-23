/* =========================================================================
   KASIR SOLO - ROSOK
   riwayat.js — Transaction history
   Filter tipe & periode riwayat DIHAPUS: daftar mengikuti filter laporan
   (reportRange dari laporan.js — Harian/Mingguan/Bulanan/Custom + jangkar).
   Grouping per HARI akordeon ala kaki5 (port 2026-09-14): header tanggal
   oranye + total neto hari itu + N trx, hari terbaru auto terbuka, sisanya
   tertutup. Paging = 10 HARI per halaman ("Muat Lebih Banyak").
   Render idempotent: render ganda (nav hook + renderLaporan) TIDAK boleh
   menduplikasi baris — setiap render membawa nomor sequence; append yang
   basi (render lebih baru sudah mulai) dibuang. Bug race 2026-09-14:
   sekali buka Laporan riwayat tampil 25 row (bukan 20) & tombol paging
   hilang karena dua render saling menumpuk.
   ========================================================================= */
import { db } from './db.js';
import { showConfirm } from './confirm.js';
import { riwayatPage, lastNotaData, setRiwayatPage, setLastNotaData } from './app-state.js';
import { fmtRupiah, fmtDate, escapeHtml, openOverlay, closeSheet, toast, showLoading, hideLoading } from './utils.js';
import { renderNota } from './pos.js';
import { reportRange, renderLaporan } from './laporan.js';

const RIWAYAT_DAYS_PER_PAGE = 10;

let _refreshAll = null;
export function setRiwayatRefs(refs){ _refreshAll = refs.refreshAll; }

let _renderSeq = 0;

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

// ── Grouping per hari (port kaki5 laporan.js) ─────────────────────────────
const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MON_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function dayKeyOf(iso){
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function dayLabel(key){
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return DAY_NAMES[dt.getDay()] + ', ' + d + ' ' + MON_NAMES[m-1] + ' ' + y;
}
// list sudah urut tanggal desc → grup ikut terurut terbaru dulu.
function groupByDay(list){
  const map = new Map();
  for (const t of list) {
    const key = dayKeyOf(t.tanggal);
    if (!map.has(key)) map.set(key, { key, items: [], sum: 0 });
    const g = map.get(key);
    g.items.push(t);
    g.sum += (t.tipe === 'beli' ? -1 : 1) * (Number(t.total) || 0);
  }
  return [...map.values()];
}
const DAY_TPL = (g, isOpen) => `
    <div class="riwayat-day">
      <div class="riwayat-day-header" role="button" aria-expanded="${isOpen}" onclick="window._ksr_toggleRiwayatDay('${g.key}')">
        <div class="rd-title">📅 ${dayLabel(g.key)}</div>
        <div class="rd-meta"><span class="${g.sum >= 0 ? 'green' : 'red'}">${g.sum >= 0 ? '+' : '-'}${fmtRupiah(Math.abs(g.sum))}</span><span class="rd-count">${g.items.length} trx</span><span class="rd-arrow ${isOpen ? 'open' : ''}">›</span></div>
      </div>
      <div class="riwayat-day-panel" id="riwDay-${g.key}" style="display:${isOpen ? 'block' : 'none'}">
        ${g.items.map(ROW_TPL).join('')}
      </div>
    </div>
  `;

export async function renderRiwayat(){
  const seq = ++_renderSeq;
  setRiwayatPage(0);
  const card = document.getElementById('riwayatList');
  if(card) card.innerHTML = '';
  await appendRiwayatPage(seq);
}

// Paging riwayat: APPEND per HARI — tombol "Muat Lebih Banyak" menambah
// 10 hari berikutnya tanpa membuang daftar yang sudah tampil. Render yang
// basi (render lebih baru sudah dimulai — seq tidak cocok) dibuang.
async function appendRiwayatPage(seq){
  if (seq !== undefined && seq !== _renderSeq) return;
  // Saring dulu di memori (dataset kecil) baru group — paging konsisten
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
  if (seq !== undefined && seq !== _renderSeq) return; // render baru mulai selagi menunggu DB
  const groups = groupByDay(allTrans);
  const offset = riwayatPage * RIWAYAT_DAYS_PER_PAGE;
  const slice = groups.slice(offset, offset + RIWAYAT_DAYS_PER_PAGE);
  const hasMore = groups.length > offset + RIWAYAT_DAYS_PER_PAGE;

  const card = document.getElementById('riwayatList');
  if(!card) return;
  // Empty state hanya bila benar-benar tidak ada transaksi sama sekali.
  if(offset === 0 && slice.length === 0){
    card.innerHTML = '<div class="empty-state"><div class="ic">🧾</div><div class="t1">Belum ada transaksi</div><div class="t2">Tidak ada transaksi pada periode ini. Geser periode di filter atas.</div></div>';
    return;
  }
  // Buang tombol "Muat Lebih Banyak" lama sebelum menambah halaman + tombol baru.
  const oldBtn = card.querySelector('.riwayat-loadmore');
  if(oldBtn) oldBtn.remove();
  // Hari terbaru auto terbuka (semangat kaki5: tanggal aktif informatif).
  const openKey = slice[0]?.key;
  card.insertAdjacentHTML('beforeend', slice.map(g => DAY_TPL(g, g.key === openKey)).join(''));
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
  // Bukti transfer (pola kaki5 + M6): whitelist scheme — hanya dataURL (kamera)
  // atau https. Restore backup bisa menulis string arbitrer; tanpa whitelist,
  // src & window.open jadi vektor injeksi atribut.
  const proofSrc = (typeof t.buktiBayar === 'string' && (/^data:image\//.test(t.buktiBayar) || /^https:\/\//.test(t.buktiBayar))) ? t.buktiBayar : '';
  if (proofSrc) {
    const proofNote = t.catatanBayar ? `<div class="nota-sub" style="margin-top:6px">📝 ${escapeHtml(t.catatanBayar)}</div>` : '';
    document.getElementById('notaBody').insertAdjacentHTML('beforeend',
      `<div class="nota-proof">
       <div class="divider"></div>
       <div class="nota-sub">🏦 Bukti Transfer</div>
       <img src="${proofSrc}" alt="Bukti transfer" style="max-width:100%;border-radius:10px;margin-top:6px;border:1px solid var(--line)" onclick="window.open('${proofSrc}','_blank')">
       ${proofNote}</div>`);
  }
  let extraBtns = '';
  if((t.sisa||0) > 0) extraBtns += `<button class="btn btn-primary mt12" onclick="window._ksr_closeNota(); window._ksr_openLunasi(${t.id})">💰 Lunasi Sekarang</button>`;
  extraBtns += `<button class="btn btn-warning mt12" onclick="window._ksr_voidTransaksi(${t.id})">❌ Batal (Void)</button>`;
  extraBtns += `<button class="btn btn-danger mt12" onclick="window._ksr_deleteTransaksi(${t.id})">🗑️ Hapus</button>`;
  document.getElementById('notaBody').insertAdjacentHTML('beforeend', extraBtns);
  openOverlay('sheetNota');
}

export function closeNotaSheet(){ closeSheet('sheetNota'); }

// Peringatan tahun tutup buku (port kaki5 peringatanTahunTertutup): bukan
// blok — pesan confirm diganti memberi tahu bahwa rekap tahun terkunci bisa
// tidak cocok lagi bila transaksinya dibatalkan/dihapus.
async function pesanTahunTertutup(tanggalISO, label, pesanDefault){
  try {
    const d = new Date(tanggalISO);
    if (isNaN(d)) return pesanDefault;
    const tahun = d.getFullYear();
    const row = await db.tutupBuku.where('tahun').equals(tahun).first();
    if (!row) return pesanDefault;
    return '⚠️ Tahun ' + tahun + ' SUDAH dikunci dengan Tutup Buku. Membatalkan/menghapus ' + label +
      ' akan membuat rekap tahunan tidak cocok lagi. Yakin?';
  } catch (_) { return pesanDefault; }
}

export async function deleteTransaksi(id){
  const t0 = await db.transaksi.get(id);
  if(!t0){ toast('Transaksi tidak ditemukan'); return; }
  const pesan = await pesanTahunTertutup(t0.tanggal, 'transaksi ini', 'Hapus transaksi ini? Stok dan kas akan disesuaikan kembali.');
  if(!(await showConfirm({ icon:'🗑️', text: pesan, okLabel:'Ya, Hapus' }))) return;
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
  const t0 = await db.transaksi.get(id);
  if(!t0){ toast('Transaksi tidak ditemukan'); return; }
  const pesan = await pesanTahunTertutup(t0.tanggal, 'transaksi ini', 'Yakin membatalkan transaksi ini? Stok dan kas akan disesuaikan kembali.');
  if(!(await showConfirm({ icon:'✖️', text: pesan, okLabel:'Batalkan Transaksi' }))) return;
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
window._ksr_loadRiwayatPage = () => appendRiwayatPage(_renderSeq);
window._ksr_viewTransaksiDetail = viewTransaksiDetail;
window._ksr_deleteTransaksi = deleteTransaksi;
window._ksr_voidTransaksi = voidTransaksi;
window._ksr_loadMore = appendRiwayatPage;
window._ksr_closeNota = closeNotaSheet;
// Toggle akordeon hari (port kaki5 toggleTrxDay)
window._ksr_toggleRiwayatDay = (key) => {
  const panel = document.getElementById('riwDay-' + key);
  if(!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  const arrow = panel.previousElementSibling?.querySelector('.rd-arrow');
  if(arrow) arrow.classList.toggle('open', !open);
};
