// ==================== AUTO UPDATE (ESM) ====================
// Deteksi rilis baru via version.json — TANPA polling berkala ke server.
// Cek dilakukan event-driven: sekali saat app boot, sekali tiap app balik ke
// foreground (visibilitychange), dan saat koneksi kembali online. Saat versi
// cache (CACHE_BUST) belum update, munculkan toast DENGAN TOMBOL REFRESH —
// user yang memutuskan kapan memuat ulang. Sebelum reload, cache Service
// Worker lama dibersihkan (via SW baru yang aktif).

import { CACHE_BUST } from './version.js';
import { showToast } from './helpers.js';

const VERSION_URL = './js/version.json';
const RELOAD_FLAG = 'ksr:update-reloading';
const SW_WAIT_TIMEOUT_MS = 6000;
const TOAST_DURATION_MS = 15000;

let watcherStarted = false;
let toastActive = false;

async function fetchRemoteVersion() {
  const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`version.json -> HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.cacheBust !== 'string') throw new Error('version.json malformed');
  return data;
}

// Refresh paksa: trigger SW baru (skipWaiting -> activate -> hapus cache lama),
// lalu reload. Kalau tidak ada SW (open biasa / non-PWA) cukup reload langsung.
export async function performForceUpdate() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // sudah dalam proses reload
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update(); // fetch sw.js terbaru -> install -> skipWaiting -> activate
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

// Toast + tombol Refresh (bukan auto reload): user yang putuskan kapan muat ulang.
export function notifyUpdateAvailable(msg) {
  if (sessionStorage.getItem(RELOAD_FLAG) || toastActive) return;
  toastActive = true;
  showToast(msg || '🔄 Versi baru tersedia!', 'info', {
    duration: TOAST_DURATION_MS,
    actionLabel: '⟳ Refresh',
    onAction: () => { toastActive = false; performForceUpdate(); }
  });
  setTimeout(() => { toastActive = false; }, TOAST_DURATION_MS);
}

// Event-driven cek update (bukan polling berkala): sekali saat boot, sekali tiap
// app balik ke foreground, dan saat kembali online. Juga dorong SW update biar
// event updatefound ke-trigger (mekanisme PWA di pwa.js).
async function checkForUpdate() {
  try {
    const remote = await fetchRemoteVersion();
    if (remote.cacheBust !== CACHE_BUST) {
      console.log(`[UPDATE] Versi baru ${remote.cacheBust} (lokal ${CACHE_BUST}).`);
      notifyUpdateAvailable();
    }
  } catch (e) {
    console.log('[UPDATE] Cek versi gagal (mungkin offline):', e?.message || e);
  }
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update(); // minta SW cek ulang (updatefound -> notify)
    } catch (e) {
      console.log('[UPDATE] SW update check:', e?.message || e);
    }
  }
}

export function startUpdateWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;
  // Sisa flag reload dari session sebelumnya dibersihkan saat app baru boot.
  sessionStorage.removeItem(RELOAD_FLAG);
  setTimeout(checkForUpdate, 3000); // sekali setelah app settle
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', checkForUpdate);
}
