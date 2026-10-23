/* =========================================================================
   KASIR SOLO - ROSOK
   kategori.js — Kategori/stok management
   ========================================================================= */
import { db } from './db.js';
import { KATEGORI, loadKategori } from './app-state.js';
import { fmtRupiah, fmtKg, escapeHtml, openOverlay, closeSheet, toast, unformatRupiah } from './utils.js';

export async function renderStok(){
  await loadKategori(); // segarkan dari DB agar stok selalu terbaru
  const card = document.getElementById('stokListCard');
  if(!card) return;
  if(KATEGORI.length === 0){
    card.innerHTML = '<div class="empty-state"><div class="ic">📭</div><div class="t1">Belum ada jenis rosok</div></div>';
    return;
  }
  card.innerHTML = KATEGORI.map(k => `
    <div class="row-item" onclick="window._ksr_openKategoriForm(${k.id})">
      <div class="row-icon green-soft">${k.emoji||'♻️'}</div>
      <div class="row-body">
        <div class="row-title">${escapeHtml(k.nama)}${!k.aktif ? ' <span class="badge red">nonaktif</span>' : ''}</div>
        <div class="row-sub">Beli ${fmtRupiah(k.hargaBeli)}/kg · Jual ${fmtRupiah(k.hargaJual)}/kg</div>
      </div>
      <div class="row-amt">${fmtKg(k.stokKg||0)}</div>
    </div>
  `).join('');
}

export function openKategoriForm(id){
  document.getElementById('katFormId').value = id || '';
  if(id){
    const k = KATEGORI.find(x=>x.id===id);
    document.getElementById('katFormTitle').textContent = 'Ubah Jenis Rosok';
    document.getElementById('katFormNama').value = k.nama;
    document.getElementById('katFormEmoji').value = k.emoji || '';
    document.getElementById('katFormHargaBeli').value = fmtRupiah(k.hargaBeli);
    document.getElementById('katFormHargaJual').value = fmtRupiah(k.hargaJual);
    document.getElementById('katDeleteBtn').style.display = 'block';
    document.getElementById('katDeleteBtn').textContent = k.aktif ? 'Nonaktifkan' : 'Aktifkan Kembali';
  } else {
    document.getElementById('katFormTitle').textContent = 'Jenis Rosok Baru';
    document.getElementById('katFormNama').value = '';
    document.getElementById('katFormEmoji').value = '♻️';
    document.getElementById('katFormHargaBeli').value = '';
    document.getElementById('katFormHargaJual').value = '';
    document.getElementById('katDeleteBtn').style.display = 'none';
  }
  openOverlay('sheetKategori');
}

export async function saveKategori(){
  const id = document.getElementById('katFormId').value;
  const nama = document.getElementById('katFormNama').value.trim();
  if(!nama){ toast('Isi nama jenis rosok'); return; }
  const hargaBeli = unformatRupiah(document.getElementById('katFormHargaBeli').value) || 0;
  const hargaJual = unformatRupiah(document.getElementById('katFormHargaJual').value) || 0;
  const data = { nama, emoji: document.getElementById('katFormEmoji').value.trim()||'♻️', hargaBeli, hargaJual };
  if(hargaJual > 0 && hargaBeli > 0 && hargaJual < hargaBeli){
    toast('⚠️ Harga jual tidak boleh lebih murah dari harga beli!');
    // Do not close sheet if validation fails
    return;
  }

  if(id){
    await db.kategori.update(parseInt(id), data);
  } else {
    data.stokKg = 0; 
    data.aktif = 1; 
    const newId = await db.kategori.add(data);
    // Kategori added
  }
  // CRITICAL: Ensure DB write is complete before proceeding
  await new Promise(r => setTimeout(r, 500));
  await loadKategori();
  // loadKategori completed
  window.dispatchEvent(new CustomEvent('ksr-kategori-changed'));
  closeSheet('sheetKategori');
  renderStok();
  toast('Jenis rosok tersimpan');
}

export async function deleteKategoriConfirm(){
  const id = parseInt(document.getElementById('katFormId').value);
  const k = KATEGORI.find(x=>x.id===id);
  await db.kategori.update(id, {aktif: k.aktif?0:1});
  window.dispatchEvent(new CustomEvent('ksr-kategori-changed'));
  closeSheet('sheetKategori');
  renderStok();
  toast(k.aktif ? 'Jenis rosok dinonaktifkan' : 'Jenis rosok diaktifkan kembali');
}

window._ksr_openKategoriForm = openKategoriForm;
