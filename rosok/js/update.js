/* =========================================================================
   KASIR SOLO - ROSOK
   update.js — Deteksi rilis baru + REFRESH PAKSA via overlay (port kaki5
   update.js). TANPA polling berkala: cek sekali saat boot (settle 3 dtk),
   tiap kembali ke foreground (visibilitychange), dan tiap koneksi online.
   Bandingkan cacheBust js/version.json (network murni — sw.js mem-bypass
   file ini dari cache) dengan CACHE_BUST build lokal. Bila beda: overlay
   full-screen yang TIDAK bisa ditutup Escape/backdrop (pola .lock-overlay,
   sama seperti #mismatchLock) berisi catatan rilis + satu tombol OKE.
   OKE = performForceUpdate(): trigger SW baru (skipWaiting → activate →
   hapus cache lama) lalu reload — boot penuh menjalankan re-anchor, pull
   profil, push pending, dan sync lisensi. Inilah penjaga konvergensi yg
   menghilangkan insiden "tab beta stale tak pernah narik data" 2026-09-04.
   ========================================================================= */
import { CACHE_BUST } from './version.js';
import { toast, escapeHtml } from './utils.js';

function isDev() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || h.endsWith('.local') || !h.includes('.');
}

const VERSION_URL = './js/version.json';
const RELOAD_FLAG = 'ksr:update-reloading';          // cegah loop reload (session)
const ACK_VERSION_KEY = 'ksr:update-acked-version';  // versi yang sudah di-OKE (persist)
const SW_WAIT_TIMEOUT_MS = 6000;

let watcherStarted = false;
let _latestRemote = null;

async function fetchRemoteVersion() {
  const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('version.json -> HTTP ' + res.status);
  const data = await res.json();
  if (!data || typeof data.cacheBust !== 'string') throw new Error('version.json malformed');
  return data;
}

// Refresh paksa: minta SW terbaru (install → skipWaiting → activate → hapus
// cache lama), tunggu aktif (timeout 6 dtk), lalu reload. Tanpa SW → reload.
export async function performForceUpdate() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        await new Promise((resolve) => {
          const started = Date.now();
          const wait = () => {
            if (reg.active && reg.active.state === 'activated') return resolve();
            if (Date.now() - started > SW_WAIT_TIMEOUT_MS) return resolve();
            setTimeout(wait, 200);
          };
          wait();
        });
      }
    } catch (e) {
      console.warn('[UPDATE] SW update gagal, reload tetap jalan:', e?.message || e);
    }
  }
  window.location.reload();
}

// Catatan default bila version.json tidak menyertakan notes.
const DEFAULT_NOTES = [
  '✅ Perbaikan & penyempurnaan agar aplikasi makin lancar dipakai setiap hari',
  '🛡️ Data usahamu kini tersimpan lebih aman'
];

// Tampilkan overlay full-screen. Kontrak: `remote` hasil fetchRemoteVersion
// (punya cacheBust) — pemanggilan tanpa data / versi sama diabaikan (pola
// kaki5: cegah overlay palsu).
export function notifyUpdateAvailable(remote) {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  if (!remote || typeof remote !== 'object' || !remote.cacheBust) return;
  if (remote.cacheBust === CACHE_BUST) return;
  let acked = null;
  try { acked = localStorage.getItem(ACK_VERSION_KEY); } catch (_) {}
  if (acked === remote.cacheBust) return; // user sudah OKE versi ini
  const overlay = document.getElementById('updateOverlay');
  if (!overlay) {
    toast('🔄 Versi baru tersedia — tutup & buka ulang aplikasi ya');
    return;
  }
  _latestRemote = remote;
  const verEl = document.getElementById('updateVersionLabel');
  if (verEl) verEl.textContent = 'Versi ' + (remote.version || remote.cacheBust);
  const listEl = document.getElementById('updateNotesList');
  if (listEl) {
    const notes = Array.isArray(remote.notes) && remote.notes.length ? remote.notes : DEFAULT_NOTES;
    listEl.innerHTML = notes.map(n => '<li>' + escapeHtml(n) + '</li>').join('');
  }
  const btn = document.getElementById('updateOkBtn');
  if (btn) {
    // onclick di-assign ulang tiap panggilan → selalu ack versi TERBARU
    // (perbaikan dari kaki5 yang addEventListener sekali + closure basi).
    btn.onclick = () => {
      try { localStorage.setItem(ACK_VERSION_KEY, _latestRemote.cacheBust); } catch (_) {}
      performForceUpdate();
    };
  }
  // classList langsung, BUKAN openOverlay → tidak ada handler Escape →
  // overlay tidak bisa ditutup selain lewat OKE (pola #mismatchLock).
  overlay.classList.add('show');
}

export async function checkForUpdate() {
  try {
    const remote = await fetchRemoteVersion();
    if (remote.cacheBust !== CACHE_BUST) {
      if (isDev()) console.log(`[UPDATE] Versi baru ${remote.cacheBust} (lokal ${CACHE_BUST}).`);
      notifyUpdateAvailable(remote);
    }
  } catch (e) {
    if (isDev()) console.log('[UPDATE] Cek versi gagal (mungkin offline):', e?.message || e);
  }
  // Sekalian dorong SW check → event updatefound di app.js ikut bekerja.
  if ('serviceWorker' in navigator) {
    try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (_) {}
  }
}

export function startUpdateWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;
  sessionStorage.removeItem(RELOAD_FLAG); // sisa flag sesi sebelumnya
  setTimeout(checkForUpdate, 3000);       // sekali setelah app settle
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', checkForUpdate);
}
