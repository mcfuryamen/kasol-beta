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

export function todayStr(){ return new Date().toISOString().slice(0,10); }

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
  if (ua.includes('Edg/') || uaLower.includes('edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || uaLower.includes('opr/')) browser = 'Opera';
  else if (ua.includes('SamsungBrowser')) browser = 'Samsung Internet';
  else if (uaLower.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('CriOS') || uaLower.includes('crios')) browser = 'Chrome (iOS)';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !uaLower.includes('chrome')) browser = 'Safari';
  else if (ua.includes('wv') || uaLower.includes('webview')) browser = 'WebView';
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
  return { browser, os, deviceType: isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop'), userAgent: ua.slice(0, 500) };
}

export function openOverlay(id){
  const el = document.getElementById(id);
  if(!el) return;
  // save previous focused element to restore later
  try{ window._ksr_prevFocus = document.activeElement; } catch(e){}
  el.classList.add('show');
  // focus trap for accessibility
  const focusableSelectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
  const nodes = Array.from(el.querySelectorAll(focusableSelectors));
  if(nodes.length) nodes[0].focus();
  const handler = function(e){
    if(e.key === 'Escape') { closeSheet(id); }
    if(e.key === 'Tab'){
      if(nodes.length === 0){ e.preventDefault(); return; }
      const idx = nodes.indexOf(document.activeElement);
      if(e.shiftKey){ if(idx === 0 || document.activeElement === el){ e.preventDefault(); nodes[nodes.length - 1].focus(); } }
      else { if(idx === nodes.length - 1){ e.preventDefault(); nodes[0].focus(); } }
    }
  };
  window._ksr_overlayHandlers = window._ksr_overlayHandlers || {};
  window._ksr_overlayHandlers[id] = handler;
  window.addEventListener('keydown', handler);
}

export function closeSheet(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove('show');
  if(window._ksr_overlayHandlers && window._ksr_overlayHandlers[id]){
    window.removeEventListener('keydown', window._ksr_overlayHandlers[id]);
    delete window._ksr_overlayHandlers[id];
  }
  if(window._ksr_prevFocus){ try{ window._ksr_prevFocus.focus(); } catch(e){}; window._ksr_prevFocus = null; }
}
