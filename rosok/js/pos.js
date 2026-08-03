/* =========================================================================
   KASIR SOLO - ROSOK
   pos.js — Point of Sale. Uses window function names to match onclick handlers.
   ========================================================================= */
import { db } from './db.js';
import { KATEGORI, activeTransTipe, cart, currentWizardStep, bayarMetode, lastNotaData, currentTimbangKat, currentBerat, currentSatuan, SATUAN_FACTOR, SATUAN_LABEL, keypadBuffer, openShiftCache, isSaving, SETTINGS, setActiveTransTipe, setCart, setCurrentWizardStep, setBayarMetode, setLastNotaData, setCurrentTimbangKat, setCurrentBerat, setCurrentSatuan, setKeypadBuffer, setIsSaving } from './app-state.js';
import { fmtRupiah, fmtKg, fmtDate, escapeHtml, openOverlay, closeSheet, toast, showLoading, hideLoading, unformatRupiah } from './utils.js';
import { refreshShiftCache, openBukaKasSheet } from './kas.js';

let _refreshAll = null;
export function setPosRefs(refs){ _refreshAll = refs.refreshAll; }

export function renderWizardBar(){
  const bar = document.getElementById('wizardBar');
  const inner = document.getElementById('wizardBarInner');
  if(!bar||!inner) return;
  if(currentWizardStep === 1){
    if(cart.length === 0){ bar.classList.remove('show'); return; }
    bar.classList.add('show');
    inner.innerHTML = `<button class="btn btn-primary" onclick="goToStep(2)">Lanjut ke Pembayaran · ${fmtRupiah(cartTotal())}</button>`;
  } else {
    bar.classList.add('show');
    inner.innerHTML = `<button class="btn btn-primary" onclick="saveTransaksi()">${activeTransTipe==='beli' ? '💵 Bayar & Simpan' : '💰 Terima & Simpan'} · ${fmtRupiah(cartTotal())}</button>`;
  }
}

export function renderKatGrid(list = KATEGORI){
  const grid = document.getElementById('katGrid');
  if(!grid) return;
  grid.innerHTML = '';
  const aktif = list.filter(k => k.aktif);
  if(aktif.length === 0) return;
  aktif.forEach(k => {
    const disabled = activeTransTipe === 'jual' && (!k.stokKg || k.stokKg <= 0);
    const harga = activeTransTipe === 'beli' ? k.hargaBeli : k.hargaJual;
    const div = document.createElement('div');
    div.className = 'kat-item' + (disabled ? ' disabled' : '');
    div.innerHTML = `<div class="emoji">${escapeHtml(k.emoji||'♻️')}</div><div class="nm">${escapeHtml(k.nama)}</div><div class="hg">${fmtRupiah(harga)}/kg</div>`;
    if (!disabled) {
      const stockEl = document.createElement('div');
      stockEl.className = 'kat-stock';
      stockEl.textContent = fmtKg(k.stokKg||0);
      div.appendChild(stockEl);
    }
    div.onclick = () => !disabled && openTimbang(k);
    grid.appendChild(div);
  });
}

export function openTimbang(kat){
  setCurrentTimbangKat(kat);
  setCurrentBerat(0);
  setCurrentSatuan('kg');
  setKeypadBuffer('0');
  document.querySelectorAll('#satuanTabs .tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.u==='kg'));
  document.getElementById('timbangKatNama').textContent = kat.nama;
  const harga = activeTransTipe === 'beli' ? kat.hargaBeli : kat.hargaJual;
  document.getElementById('timbangHargaLbl').textContent = fmtRupiah(harga);
  updateTimbangDisplay();
  buildKeypad();
  openOverlay('sheetTimbang');
}

export function buildKeypad(){
  const kp = document.getElementById('keypad');
  if(!kp) return;
  const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];
  kp.innerHTML = '';
  keys.forEach(k => {
    const b = document.createElement('button');
    b.className = 'key-btn';
    b.textContent = k;
    b.onclick = () => keypadPress(k);
    kp.appendChild(b);
  });
}

export function keypadPress(k){
  // Compute new keypad buffer locally to avoid relying on exported binding timing
  let newBuffer = keypadBuffer;
  if(k === '⌫') newBuffer = newBuffer.length>1 ? newBuffer.slice(0,-1) : '0';
  else if(k === '.') { if(!newBuffer.includes('.')) newBuffer = newBuffer + '.'; }
  else newBuffer = newBuffer === '0' ? k : newBuffer + k;
  // Persist state and derived berat using the computed value
  setKeypadBuffer(newBuffer);
  setCurrentBerat(parseFloat(newBuffer) || 0);
  updateTimbangDisplay();
}

export function stepBerat(delta){
  // Compute new berat and update both state and keypad buffer deterministically
  const newBerat = Math.max(0, Math.round((currentBerat + delta)*100)/100);
  setCurrentBerat(newBerat);
  // Keep keypad buffer consistent with displayed berat — use toFixed but trim unnecessary decimals
  const buf = (Number.isInteger(newBerat) ? newBerat.toFixed(0) : newBerat.toString());
  setKeypadBuffer(buf);
  updateTimbangDisplay();
}

export function updateTimbangDisplay(){
  const elKg = document.getElementById('timbangKgVal');
  const elUnit = document.getElementById('timbangUnitLbl');
  const elSub = document.getElementById('timbangSubtotal');
  if(elKg) elKg.textContent = currentBerat.toFixed(currentSatuan==='kg' ? 1 : 2);
  if(elUnit) elUnit.textContent = SATUAN_LABEL[currentSatuan];
  const harga = activeTransTipe === 'beli' ? currentTimbangKat.hargaBeli : currentTimbangKat.hargaJual;
  if(elSub) elSub.textContent = fmtRupiah(beratDalamKg() * harga);
}

function beratDalamKg(){ return Math.round(currentBerat * SATUAN_FACTOR[currentSatuan] * 1000) / 1000; }

export function confirmTimbang(){
  const beratKgVal = beratDalamKg();
  if(beratKgVal <= 0){ toast('Masukkan berat dulu ya'); return; }
  if(activeTransTipe === 'jual' && beratKgVal > currentTimbangKat.stokKg){
    toast(`Stok ${currentTimbangKat.nama} cuma ${fmtKg(currentTimbangKat.stokKg)}`);
    return;
  }
  const harga = activeTransTipe === 'beli' ? currentTimbangKat.hargaBeli : currentTimbangKat.hargaJual;
  const existing = cart.find(c => c.kategoriId === currentTimbangKat.id);
  if(existing){
    const updated = cart.map(c => c.kategoriId === currentTimbangKat.id
      ? { ...c, berat: c.berat + beratKgVal, subtotal: (c.berat + beratKgVal) * harga }
      : c
    );
    setCart(updated);
  } else {
    setCart([...cart, { kategoriId: currentTimbangKat.id, nama: currentTimbangKat.nama, emoji: currentTimbangKat.emoji, harga, berat: beratKgVal, subtotal: beratKgVal * harga }]);
  }
  setKeypadBuffer('0');
  closeSheet('sheetTimbang');
  renderCartChips();
  renderCartStep2();
  renderWizardBar();
  toast(`${currentTimbangKat.nama} ditambahkan ke keranjang`);
}

// ── Cart ──────────────────────────────────────────────────────────────────
export function renderCartChips(){
  const row = document.getElementById('cartChipsStep1');
  if(!row) return;
  row.innerHTML = cart.length ? cart.map((c,i) => `
    <div class="cart-chip">${c.emoji||'♻️'} ${c.nama} · ${fmtKg(c.berat)}<span class="x" onclick="removeCartItem(${i})">✕</span></div>
  `).join('') : '<div class="hint">Belum ada barang dipilih</div>';
}

export function renderCartStep2(){
  const list = document.getElementById('cartListStep2');
  const empty = document.getElementById('cartEmpty');
  if(!list) return;
  
  if(cart.length === 0){
    list.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  
  if(empty) empty.style.display = 'none';
  list.innerHTML = cart.map((c,i) => `
    <div class="cart-compact-item">
      <div class="item-emoji">${c.emoji||'♻️'}</div>
      <div class="item-text">
        <div class="item-name">${c.nama}</div>
        <div class="item-detail">${fmtKg(c.berat)} × ${fmtRupiah(c.harga)}</div>
      </div>
      <div class="item-amount">${fmtRupiah(c.subtotal)}</div>
      <button class="item-remove" onclick="removeCartItem(${i})" title="Hapus">✕</button>
    </div>
  `).join('');
}

export function cartTotal(){ return cart.reduce((s,c) => s+c.subtotal, 0); }

export function removeCartItem(i){
  setCart(cart.filter((_, idx) => idx !== i));
  renderCartChips();
  renderCartStep2();
  renderWizardBar();
  if(currentWizardStep === 2){
    document.getElementById('bayarTotalLbl').textContent = fmtRupiah(cartTotal());
    calcKembalian();
    if(cart.length === 0) { goToStep(1); toast('Keranjang kosong, kembali pilih barang'); }
  }
}

// ── Payment ───────────────────────────────────────────────────────────────
export function setMetodeBayar(m){
  setBayarMetode(m);
  // Update button states with aria-pressed
  document.querySelectorAll('#metodeBayarTabs button').forEach(b => {
    const isActive = b.dataset.m === m;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
    
  // Update payment footer styling based on method
  const footerEl = document.getElementById('paymentFooter');
  if (footerEl) {
    footerEl.classList.remove('state-utang', 'state-piutang', 'state-kembalian');
    if (m === 'tempo') {
      const tipeUtang = activeTransTipe === 'beli' ? 'state-utang' : 'state-piutang';
      footerEl.classList.add(tipeUtang);
    } else {
      footerEl.classList.add('state-kembalian');
    }
  }
    
  const bayarLbl = document.getElementById('bayarUangLabel');
  if(m === 'tempo'){
    if(bayarLbl) bayarLbl.textContent = activeTransTipe==='beli' ? 'Uang Muka ke Penjual (opsional)' : 'Uang Muka Diterima (opsional)';
    const kembEl = document.getElementById('kembalianLbl');
    if(kembEl) kembEl.textContent = activeTransTipe==='beli' ? 'Sisa Utang' : 'Sisa Piutang';
    const tempoHintEl = document.getElementById('tempoHint');
    if(tempoHintEl) tempoHintEl.style.display = 'block';
    // Saat metode tempo dipilih, input nilai harus nol sesuai permintaan
    const bayarInputEl = document.getElementById('bayarUangInput');
    if(bayarInputEl) { bayarInputEl.value = fmtRupiah(0); }
  } else {
    if(bayarLbl) bayarLbl.textContent = activeTransTipe==='beli' ? 'Uang Dibayarkan' : 'Uang Diterima';
    const kembEl = document.getElementById('kembalianLbl');
    if(kembEl) kembEl.textContent = 'Kembalian';
    const tempoHintEl = document.getElementById('tempoHint');
    if(tempoHintEl) tempoHintEl.style.display = 'none';
  }
  calcKembalian();
}

export function calcKembalian(){
  const bayarInputEl = document.getElementById('bayarUangInput');
  const bayar = bayarInputEl ? (unformatRupiah(bayarInputEl.value) || 0) : 0;
  const total = cartTotal();
  const uangDiterimaEl = document.getElementById('uangDiterimaVal');
  if(uangDiterimaEl) uangDiterimaEl.textContent = fmtRupiah(bayar);
  const kembalianEl = document.getElementById('kembalianVal');
  if(kembalianEl) kembalianEl.textContent = fmtRupiah(bayarMetode === 'tempo' ? Math.max(0, total - bayar) : bayar - total);
}

// ── Save Transaction ──────────────────────────────────────────────────────
export async function saveTransaksi(){
  if(isSaving){ toast('Sedang menyimpan transaksi, mohon tunggu...'); return; }
  if(cart.length === 0){ toast('Keranjang masih kosong'); return; }
  showLoading('Menyimpan transaksi...');
  await refreshShiftCache();
  if(!openShiftCache){ toast('Kas belum dibuka'); goToStep(1); openBukaKasSheet(); return; }

  setIsSaving(true);
  const wizardBarInner = document.getElementById('wizardBarInner');
  if(wizardBarInner) wizardBarInner.innerHTML = '<button class="btn btn-primary" disabled>⏳ Menyimpan...</button>';

  try {
    const total = cartTotal();
    const namaKontak = document.getElementById('transNamaKontak').value.trim();
    const catatan = document.getElementById('transCatatan').value.trim();
    const now = new Date().toISOString();
    const bayarInput = unformatRupiah(document.getElementById('bayarUangInput').value) || 0;
    let dibayarkan, sisa;
    // Validation: if payment method is immediate (not 'tempo'), require full payment
    if(bayarMetode === 'tempo'){
      dibayarkan = Math.min(Math.max(0,bayarInput), total);
      sisa = Math.round(total - dibayarkan);
    } else {
      if(bayarInput < total){
        // Reset saving flag + UI and notify user — do not proceed saving with insufficient cash
        setIsSaving(false);
        renderWizardBar();
        hideLoading();
        toast('Uangnya kurang — pilih metode Tempo atau masukkan jumlah yang cukup');
        return;
      }
      dibayarkan = total;
      sisa = 0;
    }

    let transaksiId;
    await db.transaction('rw', db.transaksi, db.transaksiItem, db.kategori, db.kas, async () => {
      transaksiId = await db.transaksi.add({ tipe: activeTransTipe, tanggal: now, total, kontakNama: namaKontak, catatan, metodeBayar: bayarMetode, dibayarkan, sisa });
      const items = cart.map(item => ({ transaksiId, kategoriId: item.kategoriId,kategoriNama: item.nama, berat: item.berat, hargaSatuan: item.harga, subtotal: item.subtotal }));
      await db.transaksiItem.bulkAdd(items);
      for(const item of cart){
        const kat = await db.kategori.get(item.kategoriId);
        const newStok = activeTransTipe==='beli' ? (kat.stokKg||0) + item.berat : (kat.stokKg||0) - item.berat;
        await db.kategori.update(item.kategoriId, { stokKg: Math.max(0, Math.round(newStok*1000)/1000) });
      }
      if(dibayarkan > 0){
        await db.kas.add({ tanggal: now, tipe: activeTransTipe==='beli'?'keluar':'masuk', jumlah: dibayarkan, keterangan: (activeTransTipe==='beli' ? 'Pembelian rosok' : 'Penjualan rosok') + (bayarMetode==='tempo' ? ' (DP tempo)' : '') + (bayarMetode==='transfer' ? ' (Transfer)' : '') + (namaKontak ? ' - '+namaKontak : ''), refTransaksiId: transaksiId });
      }
    });

    setLastNotaData({ id: transaksiId, tipe: activeTransTipe, tanggal: now, total, namaKontak, catatan, metodeBayar: bayarMetode, dibayarkan, sisa, items: cart.slice() });
    setCart([]); setCurrentWizardStep(1);
    document.getElementById('transNamaKontak').value = '';
    document.getElementById('transCatatan').value = '';
    document.getElementById('bayarUangInput').value = '';
    renderCartChips(); renderCartStep2(); goToStep(1);
    document.getElementById('wizardBar').classList.remove('show');
    renderNota(lastNotaData);
    openOverlay('sheetNota');
    if(_refreshAll) _refreshAll();
  } catch(error) {
    console.error('Error:', error);
    toast('Gagal menyimpan transaksi: ' + error.message);
  } finally {
    setIsSaving(false);
    renderWizardBar();
    hideLoading();
  }
}

// ── Nota ──────────────────────────────────────────────────────────────────
export function renderNota(data){
  const el = document.getElementById('notaBody');
  if(!el) return;
  const biz = (SETTINGS && SETTINGS.bizName) || 'Kasir Solo - Rosok';
  const itemsHtml = data.items.map(it => `
    <div class="nota-line">
      <span>${it.emoji||''} ${it.nama} (${fmtKg(it.berat)})</span><span>${fmtRupiah(it.subtotal)}</span>
    </div>`).join('');
  const paymentBadge = data.metodeBayar === 'tempo'
    ? `<div class="nota-sub mt6"><div class="flex-between"><span>Dibayar</span><span>${fmtRupiah(data.dibayarkan)}</span></div><div class="flex-between text-red-strong"><span>Sisa (${data.tipe==='beli'?'Utang':'Piutang'})</span><span>${fmtRupiah(data.sisa)}</span></div></div>`
    : `<div class="mt8"><span class="badge green">Lunas</span>${data.metodeBayar==='transfer' ? '<span class="badge blue transfer-badge">Transfer</span>' : ''}</div>`;
  const bankInfo = (data.metodeBayar === 'transfer' && SETTINGS && SETTINGS.bizBank) ? `<div class="nota-sub">Transfer ke: ${escapeHtml(SETTINGS.bizBank)}</div>` : '';
  el.innerHTML = `
    <div class="text-center mb10">
      <img src="assets/logo.png" class="logo-sm" alt="logo">
      <h3 class="nota-title">${escapeHtml(biz)}</h3>
      <div class="nota-sub">${data.tipe==='beli' ? 'Nota Pembelian Rosok' : 'Nota Penjualan Rosok'}</div>
    </div>
    <div class="divider"></div>
    <div class="nota-sub">${fmtDate(data.tanggal)}</div>
    ${data.namaKontak ? `<div class="nota-sub">${data.tipe==='beli'?'Penjual':'Pembeli'}: ${escapeHtml(data.namaKontak)}</div>` : ''}
    <div class="divider"></div>
    ${itemsHtml}
    <div class="divider"></div>
    <div class="flex-between total-strong"><span>Total</span><span>${fmtRupiah(data.total)}</span></div>
    ${paymentBadge}
    ${bankInfo}
    <div class="divider"></div>
    <div class="nota-sub nota-footer">Terima kasih 🙏<br>PT Mesin Kasir Solo · 0881-6566-935</div>
  `;
}

export function shareNotaWA(){
  if(!lastNotaData) return;
  const d = lastNotaData;
  const biz = (SETTINGS && SETTINGS.bizName) || 'Kasir Solo - Rosok';
  let text = `*${biz}*\n${d.tipe==='beli'?'Nota Pembelian Rosok':'Nota Penjualan Rosok'}\n${fmtDate(d.tanggal)}\n\n`;
  d.items.forEach(it => text += `${it.nama} - ${fmtKg(it.berat)} x ${fmtRupiah(it.harga)} = ${fmtRupiah(it.subtotal)}\n`);
  text += `\n*Total: ${fmtRupiah(d.total)}*\n\nTerima kasih 🙏`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// ── Navigation ───────────────────────────────────────────────────────────
export function goToStep(n){
  setCurrentWizardStep(n);
  document.getElementById('transStep1').classList.toggle('active', n===1);
  document.getElementById('transStep2').classList.toggle('active', n===2);
  if(n===2){
    document.getElementById('bayarTotalLbl').textContent = fmtRupiah(cartTotal());
    setMetodeBayar(bayarMetode); // sinkronkan label metode + kembalian sesuai tipe transaksi
    autoFillBayar();
  }
  renderWizardBar();
  window.scrollTo(0,0);
}

export function switchTransTab(tipe){
  setActiveTransTipe(tipe);
  document.getElementById('tabBeli').classList.toggle('active', tipe==='beli');
  document.getElementById('tabJual').classList.toggle('active', tipe==='jual');
  document.getElementById('transHint').textContent = tipe==='beli'
    ? 'Ketuk jenis rosok untuk timbang & masukkan ke keranjang'
    : 'Hanya jenis rosok dengan stok yang bisa dijual ke bandar/pabrik';
  goToStep(1);
  renderKatGrid();
  renderCartChips();
  renderCartStep2();
}

// ── Payment Amount Management ─────────────────────────────────────────────
export function autoFillBayar(){
  const total = cartTotal();
  document.getElementById('bayarUangInput').value = fmtRupiah(total);
  calcKembalian();
}

// helper: round up to nearest step and generate presets
function roundUpTo(n, step){ return Math.ceil(n/step) * step; }
function generatePresetAmounts(total){
  // Generate exactly 4 presets that SET the payment input (not add).
  // Examples: 63500→[64k,65k,70k,100k], 154500→[155k,160k,170k,200k]
  // Walk escalating steps; insert extra step for 100k-200k range to get 170k.
  var p = [];

  // P1: 1k
  p.push(roundUpTo(total, 1000));
  // P2: 5k (skip if same as P1)
  var v = roundUpTo(total, 5000);
  if (v !== p[0]) p.push(v);
  // P3: 10k (skip if same as prev)
  v = roundUpTo(total, 10000);
  if (v !== p[p.length-1]) p.push(v);

  // For 100k-200k range, insert mid = roundUp(total * 1.1, 5k) — gives 170k from 154500
  if (total >= 100000 && total < 200000 && p.length < 4) {
    v = roundUpTo(Math.round(total * 1.1), 5000);
    if (v > p[p.length-1] && !p.includes(v)) p.push(v);
  }

  // For <100k range, insert 20k or 50k bridge before big step
  if (total < 100000 && p.length < 4) {
    // Try 20k
    v = roundUpTo(total, 20000);
    if (v > p[p.length-1] && !p.includes(v)) p.push(v);
    if (p.length < 4) {
      v = roundUpTo(total, 25000);
      if (v > p[p.length-1] && !p.includes(v)) p.push(v);
    }
  }

  // P4 (or fill remaining): big step
  var finalSteps = [50000, 100000, 200000, 500000];
  for (var i = 0; i < finalSteps.length && p.length < 4; i++) {
    v = roundUpTo(total, finalSteps[i]);
    if (v > p[p.length-1] && !p.includes(v)) p.push(v);
  }

  // Absolute fallback pad
  while (p.length < 4) {
    var last = p[p.length - 1] || total;
    var step = last >= 100000 ? (last >= 500000 ? 200000 : 100000) : (last >= 50000 ? 50000 : (last >= 10000 ? 10000 : 5000));
    var fv = roundUpTo(last + 1, step);
    if (fv > total && !p.includes(fv)) p.push(fv);
  }
  return p.slice(0, 4);
}

export function setPresetAmount(preset){
  const total = cartTotal();
  const presets = generatePresetAmounts(total);
  const idx = Math.max(0, Math.min(preset - 1, presets.length - 1));
  const amount = presets[idx] || total;
  const bayarInputEl = document.getElementById('bayarUangInput');
  if(bayarInputEl) bayarInputEl.value = fmtRupiah(amount);
  calcKembalian();
}

// ── Global exports — EXACT function names to match onclick handlers in HTML ───
window.goToStep = goToStep;
window.switchTransTab = switchTransTab;
window.renderWizardBar = renderWizardBar;
window.renderKatGrid = renderKatGrid;
window.openTimbang = openTimbang;
window.buildKeypad = buildKeypad;
window.keypadPress = keypadPress;
window.stepBerat = stepBerat;
window.updateTimbangDisplay = updateTimbangDisplay;
window.confirmTimbang = confirmTimbang;
window.renderCartChips = renderCartChips;
window.renderCartStep2 = renderCartStep2;
window.cartTotal = cartTotal;
window.removeCartItem = removeCartItem;
window.setMetodeBayar = setMetodeBayar;
window.calcKembalian = calcKembalian;
window.autoFillBayar = autoFillBayar;
window.setPresetAmount = setPresetAmount;
window.saveTransaksi = saveTransaksi;
window.renderNota = renderNota;
window.shareNotaWA = shareNotaWA;

// setSatuan — bound to window for onclick handlers on unit tabs
import { setSatuan } from './app-state.js';
window.setSatuan = setSatuan;
