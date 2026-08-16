// ==================== AUTO UPDATE (ESM) ====================
// Deteksi rilis baru via version.json — TANPA polling berkala ke server.
// Cek dilakukan event-driven: sekali saat app boot, sekali tiap app balik ke
// foreground (visibilitychange), dan saat koneksi kembali online. Saat versi
// cache (CACHE_BUST) belum update, tampilkan OVERLAY FULL-SCREEN (di atas
// seluruh dashboard, tidak bisa ditutup) berisi catatan perubahan dari
// version.json + satu tombol "OKE" sebagai pemicu refresh paksa. Refresh
// memuat aset baru sekaligus menjalankan boot() -> profil terkirim ke server.

import { CACHE_BUST } from './version.js';
import { showToast } from './helpers.js';

const VERSION_URL = './js/version.json';
const RELOAD_FLAG = 'ksr:update-reloading';
const SW_WAIT_TIMEOUT_MS = 6000;
const TOAST_DURATION_MS = 15000;

let watcherStarted = false;
let overlayWired = false;

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

// Catatan perubahan default bila version.json tidak menyertakan `notes`.
const DEFAULT_NOTES = [
  '✅ Perbaikan & penyempurnaan agar aplikasi makin lancar dipakai setiap hari',
  '🛡️ Data usahamu kini tersimpan lebih aman'
];

// Tampilkan overlay full-screen versi baru (tidak bisa ditutup kecuali OKE).
// Tombol OKE = pemicu refresh paksa -> aset baru + profil tersinkron ke server.
export function notifyUpdateAvailable(remote) {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  const overlay = document.getElementById('updateOverlay');
  if (!overlay) {
    // Fallback (elemen overlay tidak ada — seharusnya tidak terjadi): toast lama.
    showToast('🔄 Versi baru tersedia!', 'info', {
      duration: TOAST_DURATION_MS,
      actionLabel: '⟳ Refresh',
      onAction: () => performForceUpdate()
    });
    return;
  }

  const verEl = document.getElementById('updateVersionLabel');
  if (verEl) verEl.textContent = 'Versi ' + (remote?.version || remote?.cacheBust || 'Baru');

  const listEl = document.getElementById('updateNotesList');
  if (listEl) {
    const notes = Array.isArray(remote?.notes) && remote.notes.length ? remote.notes : DEFAULT_NOTES;
    listEl.innerHTML = notes.map(n => `<li>${escapeHtmlText(n)}</li>`).join('');
  }

  if (!overlayWired) {
    overlayWired = true;
    const btn = document.getElementById('updateOkBtn');
    if (btn) btn.addEventListener('click', () => performForceUpdate());
  }
  overlay.classList.add('show');
}

// Escape ringan tanpa dependensi DOM helper (update.js minimal-dependency).
function escapeHtmlText(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Event-driven cek update (bukan polling berkala): sekali saat boot, sekali tiap
// app balik ke foreground, dan saat kembali online. Juga dorong SW update biar
// event updatefound ke-trigger (mekanisme PWA di pwa.js).
async function checkForUpdate() {
  try {
    const remote = await fetchRemoteVersion();
    if (remote.cacheBust !== CACHE_BUST) {
      console.log(`[UPDATE] Versi baru ${remote.cacheBust} (lokal ${CACHE_BUST}).`);
      notifyUpdateAvailable(remote);
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
