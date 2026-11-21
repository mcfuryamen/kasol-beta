/* =========================================================================
   KASIR SOLO - ROSOK
   utils.js — Utilities. No imports from app modules.
   ========================================================================= */
import { db } from './db.js';
import { SETTINGS, setSETTINGS } from './app-state.js';

// URL website dinamis — mengikuti domain aktif tempat aplikasi dibuka.
// Fallback ke domain produksi Vercel untuk kasus file:// atau origin kosong.
const DEFAULT_WEBSITE = 'https://kasir-rosok.vercel.app';
export function getWebsiteUrl(){
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || '';
  if(origin && origin !== 'null' && !origin.startsWith('file:')) return origin;
  return DEFAULT_WEBSITE;
}

export function fmtRupiah(n){
  n = Math.round((n||0) * 100) / 100;
  return "Rp " + n.toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 2});
}

export function fmtKg(n){
  return (Math.round((n||0)*100)/100).toLocaleString('id-ID',{minimumFractionDigits:1, maximumFractionDigits:2}) + " kg";
}

export function fmtDate(d){
  d = new Date(d);
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) + " " + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}

export function todayStr(){
  // Tanggal LOKAL (port kaki5 helpers.pure.todayStr) — dulu toISOString()
  // berbasis UTC: antara 00:00–07:00 WIB "hari ini" mundur satu hari
  // (ketahuan saat QA backdate Catat Kas tepat lewat tengah malam).
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

export function showLoading(text = 'Memproses...'){
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if(textEl) textEl.textContent = text;
  if(overlay) overlay.classList.add('show');
}

export function hideLoading(){
  const overlay = document.getElementById('loadingOverlay');
  if(overlay) overlay.classList.remove('show');
}

export function escapeHtml(text){
  if(!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatInputRupiah(el) {
  let n = parseInt(el.value.replace(/\D/g,''), 10);
  if (isNaN(n)) n = 0;
  el.value = n.toLocaleString('id-ID');
}

export function unformatRupiah(formattedString) {
  return parseFloat(String(formattedString).replace(/\D/g,'')) || 0;
}

export function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}

export async function getSetting(key, def){
  const row = await db.settings.get(key);
  return row ? row.value : def;
}

export async function setSetting(key, value){
  await db.settings.put({key, value});
  setSETTINGS({ ...SETTINGS, [key]: value }); // sinkronkan state in-memory agar UI langsung update
}

export function generateDeviceId(){
  const rand = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0;
    const v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
  return 'DEV-' + rand.toUpperCase();
}

// ── Deteksi tipe browser & perangkat utk CRM (kolom clients) — port kaki5
// helpers.getDeviceInfo: murni parse userAgent, ramah offline.
export function getDeviceInfo(){
  const ua = String(navigator.userAgent || '');
  const uaLower = ua.toLowerCase();
  let browser = 'Lainnya';
  let browserMajor = '';
  const match = (re) => ua.match(re)?.[1] || '';
  if (/\bwv\b|; wv\)|webview/i.test(ua)) browser = 'WebView';
  else if (/Edg\//i.test(ua)) { browser = 'Edge'; browserMajor = match(/Edg\/(\d+)/i); }
  else if (/OPR\//i.test(ua)) { browser = 'Opera'; browserMajor = match(/OPR\/(\d+)/i); }
  else if (/SamsungBrowser\//i.test(ua)) { browser = 'Samsung Internet'; browserMajor = match(/SamsungBrowser\/(\d+)/i); }
  else if (/Firefox\//i.test(ua)) { browser = 'Firefox'; browserMajor = match(/Firefox\/(\d+)/i); }
  else if (/CriOS\//i.test(ua)) { browser = 'Chrome'; browserMajor = match(/CriOS\/(\d+)/i); }
  else if (/Chrome\//i.test(ua)) { browser = 'Chrome'; browserMajor = match(/Chrome\/(\d+)/i); }
  else if (/Safari\//i.test(uaLower) && !/chrome|android/i.test(uaLower)) { browser = 'Safari'; browserMajor = match(/Version\/(\d+)/i); }
  let os = 'Lainnya';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  const isTablet = /ipad/i.test(ua) ||
    (/android/i.test(ua) && !/mobile/i.test(ua)) ||
    (navigator.maxTouchPoints > 1 && /tablet/i.test(ua)) ||
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1 && typeof window.orientation !== 'undefined');
  const isMobile = !isTablet && (
    /mobile/i.test(ua) ||
    /iphone|ipod|android.*mobile|iemobile|blackberry|opera mini/i.test(uaLower)
  );
  const deviceType = isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop');
  const diagnosticUserAgent = ua.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  return { browser, browserMajor, os, deviceType, diagnosticUserAgent };
}

// Overlay yang TIDAK boleh ditutup dari UI (Escape) selama anggotanya aktif.
// Dipakai gerbang login #akunModal (port kaki5 HARD_GATE_OVERLAYS modal.js).
// CATATAN: ini hanya melarang penutupan DARI LUAR — closeSheet() sendiri tetap
// bebas dipanggil modul, dan itu jalur yang dipakai hideAkunLock() setelah
// login sukses. rosok tanpa backdrop-click-close, jadi Escape = satu-satunya
// penutup eksternal yang perlu dijaga.
export const HARD_GATE_OVERLAYS = new Set();

// ── TUMPUKAN OVERLAY (2026-11-10) ──────────────────────────────────────────
// Hanya overlay PALING ATAS yang memegang focus-trap Tab + listener Escape.
// Sebelumnya tiap overlay memasang handler sendiri: saat sheet S&K dibuka di
// ATAS gerbang login, dua trap Tab saling berebut fokus dan Escape ikut
// menutup gerbang di bawahnya — padahal gerbang wajib bertahan sampai
// login/daftar sukses. Fokus sebelum dibuka disimpan PER ID supaya menutup
// sheet mengembalikan kursor ke form login, bukan ke elemen yang sudah tak
// terlihat.
const _stack = [];     // id overlay terbuka, dari bawah ke atas
const _prevFocus = {}; // id → elemen fokus sebelum overlay dibuka
const _handlers = {};  // id → handler keydown yang sedang terpasang

const FOCUSABLE_SEL = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

function _focusables(el){ return Array.from(el.querySelectorAll(FOCUSABLE_SEL)); }

/** Lepas SEMUA handler, lalu pasang trap HANYA untuk puncak tumpukan. */
function _syncHandlers(){
  Object.keys(_handlers).forEach(id => {
    window.removeEventListener('keydown', _handlers[id]);
    delete _handlers[id];
  });
  const top = _stack[_stack.length - 1];
  if(!top) return;
  const el = document.getElementById(top);
  if(!el) return;
  const nodes = _focusables(el);
  const handler = function(e){
    if(e.key === 'Escape' && !HARD_GATE_OVERLAYS.has(top)){ closeSheet(top); return; }
    if(e.key === 'Tab'){
      if(nodes.length === 0){ e.preventDefault(); return; }
      const idx = nodes.indexOf(document.activeElement);
      if(e.shiftKey){ if(idx === 0 || document.activeElement === el){ e.preventDefault(); nodes[nodes.length - 1].focus(); } }
      else { if(idx === nodes.length - 1){ e.preventDefault(); nodes[0].focus(); } }
    }
  };
  _handlers[top] = handler;
  window.addEventListener('keydown', handler);
}

export function openOverlay(id){
  const el = document.getElementById(id);
  if(!el) return;
  if(_stack.indexOf(id) === -1){
    // simpan fokus SEBELUM dibuka — jangan ditimpa kalau overlay sudah
    // terbuka (buka ulang akan menyimpan fokus yang sudah di dalamnya).
    try{ _prevFocus[id] = document.activeElement; } catch(e){}
    _stack.push(id);
  }
  el.classList.add('show');
  const nodes = _focusables(el);
  if(nodes.length) nodes[0].focus();
  _syncHandlers();
}

export function closeSheet(id){
  const el = document.getElementById(id);
  if(el) el.classList.remove('show');
  const at = _stack.indexOf(id);
  if(at !== -1) _stack.splice(at, 1);
  _syncHandlers();   // turunkan trap ke overlay di bawahnya (kalau ada)
  const prev = _prevFocus[id];
  delete _prevFocus[id];
  try{
    if(prev && prev.isConnected) prev.focus();
  }catch(e){ /* elemen sudah lepas dari DOM — biarkan */ }
}
