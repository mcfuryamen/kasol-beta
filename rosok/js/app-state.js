/* =========================================================================
   KASIR SOLO - ROSOK
   app-state.js — Shared state + data loading
   Zero imports from other modules
   ========================================================================= */
import { db } from './db.js';

// ── State variables ───────────────────────────────────────────────────────
export let SETTINGS = {};
export let KATEGORI = [];
export let cart = [];
export let activeTransTipe = 'beli';
export let riwayatPage = 0; // riwayat ikut filter periode laporan (laporan.js)
export const RIWAYAT_PER_PAGE = 20;
export let laporanPeriode = 'harian'; // harian|mingguan|bulanan|semua|custom (pola kaki5)
export let laporanDateFrom = ''; // 'YYYY-MM-DD' utk preset custom
export let laporanDateTo = '';   // 'YYYY-MM-DD' utk preset custom
// Tanggal jangkar (YYYY-MM-DD, lokal) untuk navigasi ‹ › ala kaki5:
// harian = hari tsb, mingguan = 7 hari berakhir tsb, bulanan = bulan tsb.
export let laporanAnchor = '';
export function setLaporanPeriode(v){ laporanPeriode = v; }
export function setLaporanDateFrom(v){ laporanDateFrom = v; }
export function setLaporanDateTo(v){ laporanDateTo = v; }
export function setLaporanAnchor(v){ laporanAnchor = v || ''; }
export let currentTimbangKat = null;
export let currentBerat = 0;
export let currentSatuan = 'kg';
export const SATUAN_FACTOR = {kg:1, ons:0.1, kuintal:100};
export const SATUAN_LABEL = {kg:'KILOGRAM', ons:'ONS (100 GRAM)', kuintal:'KUINTAL (100 KG)'};
export let kasFormTipe = 'masuk';
export let lastNotaData = null;
export let currentWizardStep = 1;
export let openShiftCache = null;
export let isSaving = false;
export let keypadBuffer = '0';
export let bayarMetode = 'tunai';
export let lunasiTransaksiId = null;
export let platCurrentSlide = 0;
export let platAutoTimer = null;
export const PLAT_SCROLL_MS = 4000;

// ── Setter ─────────────────────────────────────────────────────────────────
// Binding export di ESM bersifat read-only bagi modul lain; setiap mutasi
// harus lewat setter di bawah ini (pola warisan single-file → modular).
export function setSETTINGS(v){ SETTINGS = v; }
export function setKATEGORI(v){ KATEGORI = v; }
export function setCart(v){ cart = v; }
export function setActiveTransTipe(v){ activeTransTipe = v; }
export function setRiwayatPage(v){ riwayatPage = v; }
export function setCurrentTimbangKat(v){ currentTimbangKat = v; }
export function setCurrentBerat(v){ currentBerat = v; }
export function setCurrentSatuan(v){ currentSatuan = v; }
export function setKasFormTipe(v){ kasFormTipe = v; }
export function setLastNotaData(v){ lastNotaData = v; }
export function setCurrentWizardStep(v){ currentWizardStep = v; }
export function setOpenShiftCache(v){ openShiftCache = v; }
export function setIsSaving(v){ isSaving = v; }
export function setKeypadBuffer(v){ keypadBuffer = v; }
export function setBayarMetode(v){ bayarMetode = v; }
export function setLunasiTransaksiId(v){ lunasiTransaksiId = v; }
export function setPlatCurrentSlide(v){ platCurrentSlide = v; }
export function setPlatAutoTimer(v){ platAutoTimer = v; }

// ── Helpers ───────────────────────────────────────────────────────────────
export function beratDalamKg(){ return Math.round(currentBerat * SATUAN_FACTOR[currentSatuan] * 1000) / 1000; }

// setSatuan — bound to window for onclick handlers
export function setSatuan(u){
  // State-only: set the logical unit and reset related state. DOM updates are handled by the UI layer.
  setCurrentSatuan(u);
  setCurrentBerat(0);
  setKeypadBuffer('0');
  // Notify UI to update visuals (separation of state vs DOM)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ksr-satuan-changed', { detail: u }));
}

// ── Data loading ──────────────────────────────────────────────────────────
export async function loadSettingsIntoState(){
  const rows = await db.settings.toArray();
  const settingsObj = {};
  rows.forEach(r => settingsObj[r.key] = r.value);
  setSETTINGS(settingsObj);
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  const setInput = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
  set('bizNameHeader', SETTINGS.bizName || "Kasir Solo - Rosok");
  set('bizTagHeader', SETTINGS.bizName ? "Pengepul Rosok" : "Barang Bekas Tak Terpakai");
  setInput('setBizName', SETTINGS.bizName || '');
  setInput('setBizOwner', SETTINGS.ownerName || '');
  setInput('setBizPhone', SETTINGS.bizPhone || '');
  // Kotak alamat lengkap (komposisi detail + desa..provinsi dihitung app.js
  // lewat updateAlamatBox saat initRegionPicker).
  const setAlamatBox = document.getElementById('setAlamatLengkap');
  if(setAlamatBox && typeof window.updateAlamatBox === 'function') window.updateAlamatBox();
}

export async function seedKategoriIfEmpty(){
  const count = await db.kategori.count();
  if(count > 0) return;
  const defaults = [
    {nama:'Kardus', emoji:'📦', hargaBeli:2500, hargaJual:3200, stokKg:0, aktif:1},
    {nama:'Kertas Koran/HVS', emoji:'📰', hargaBeli:2000, hargaJual:2700, stokKg:0, aktif:1},
    {nama:'Botol Plastik (PET)', emoji:'🥤', hargaBeli:3500, hargaJual:4500, stokKg:0, aktif:1},
    {nama:'Plastik Campur', emoji:'♻️', hargaBeli:1500, hargaJual:2200, stokKg:0, aktif:1},
    {nama:'Besi', emoji:'🔩', hargaBeli:3000, hargaJual:3800, stokKg:0, aktif:1},
    {nama:'Aluminium', emoji:'🥫', hargaBeli:12000, hargaJual:15000, stokKg:0, aktif:1},
    {nama:'Kaleng', emoji:'🫙', hargaBeli:4000, hargaJual:5200, stokKg:0, aktif:1},
    {nama:'Tembaga', emoji:'🟠', hargaBeli:70000, hargaJual:85000, stokKg:0, aktif:1},
    {nama:'Kabel', emoji:'🔌', hargaBeli:8000, hargaJual:10500, stokKg:0, aktif:1},
    {nama:'Botol Kaca', emoji:'🍾', hargaBeli:500, hargaJual:900, stokKg:0, aktif:1},
  ];
  await db.kategori.bulkAdd(defaults);
}

export async function loadKategori(){
  setKATEGORI(await db.kategori.orderBy('nama').toArray());
}

export async function seedPlatformMessagesIfEmpty(){
  const count = await db.platformMessages.count();
  if(count > 0) return;
  const now = new Date().toISOString();
  const farFuture = new Date(Date.now() + 365*24*3600*1000).toISOString();
  const defaults = [
    {order:1, visibleFrom: now, visibleUntil: farFuture, emoji:'🔥', title:'Promo Akhir Bulan!', body:'Setiap pembelian ≥ 50 kg, dapatkan diskon 5% untuk pembelian berikutnya. Berlaku sampai akhir bulan ini.', gradient:'linear-gradient(135deg, #E85D04 0%, #FF8C42 100%)'},
    {order:2, visibleFrom: now, visibleUntil: farFuture, emoji:'📱', title:'Info Penting', body:'Jangan lupa buka kas setiap pagi sebelum mulai transaksi. Tutup kas saat selesai kerja untuk menjaga keamanan.', gradient:'linear-gradient(135deg, #1982C4 0%, #2EABCA 100%)'},
    {order:3, visibleFrom: now, visibleUntil: farFuture, emoji:'🎁', title:'Kuota Transaksi Gratis', body:'Setiap bulan kamu dapat 100 transaksi gratis tanpa batas waktu — kuota segar lagi di awal bulan. Aktifkan lisensi untuk tanpa batas.', gradient:'linear-gradient(135deg, #70117E 0%, #B5368D 100%)'},
  ];
  await db.platformMessages.bulkAdd(defaults);
}
