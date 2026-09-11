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
import { openModal, closeModal } from './modal.js';

// Dev detection helper
function isDev() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.startsWith('192.168.') || location.hostname.startsWith('10.') || location.hostname.endsWith('.local') || !location.hostname.includes('.');
}

const VERSION_URL = './js/version.json';
const RELOAD_FLAG = 'ksr:update-reloading';
const ACK_VERSION_KEY = 'ksr:update-acked-version'; // versi yang sudah di-OKE user (localStorage, persisten)
// Permintaan pemilik 2026-09-07: overlay update yang BELUM di-OKE harus tetap
// tampil meski browser direfresh. Status "ada update" dipersist di localStorage
// dan dipulihkan seketika saat boot — bukan cuma menunggu fetch version.json
// (yang butuh network + jeda 3 dtk, dan gagal total saat offline).
const PENDING_UPDATE_KEY = 'ksr:update-pending';
const SW_WAIT_TIMEOUT_MS = 6000;
const TOAST_DURATION_MS = 15000;

let watcherStarted = false;
let overlayWired = false;

function readPendingUpdate() {
  try {
    const raw = localStorage.getItem(PENDING_UPDATE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return (p && typeof p.cacheBust === 'string') ? p : null;
  } catch {
    return null;
  }
}

function persistPendingUpdate(remote) {
  try {
    localStorage.setItem(PENDING_UPDATE_KEY, JSON.stringify({
      cacheBust: remote.cacheBust,
      version: remote.version || '',
      notes: Array.isArray(remote.notes) ? remote.notes : []
    }));
  } catch {}
}

function clearPendingUpdate() {
  try { localStorage.removeItem(PENDING_UPDATE_KEY); } catch {}
}

async function fetchRemoteVersion() {
  const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`version.json -> HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.cacheBust !== 'string') throw new Error('version.json malformed');
  return data;
}

// Refresh paksa (tombol OKE): pastikan SW terbaru terunduh & masuk status
// "waiting" (v187: TANPA skipWaiting otomatis — SW baru TIDAK aktif sendiri),
// lalu perintahkan aktif via pesan SKIP_WAITING, tunggu claim, dan reload.
// Kalau tidak ada SW (open biasa / non-PWA) cukup reload langsung.
export async function performForceUpdate() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // sudah dalam proses reload
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update(); // fetch sw.js terbaru -> install (waiting, tanpa skipWaiting)
        // Tunggu SW baru selesai install & masuk status waiting.
        await new Promise((resolve) => {
          const started = Date.now();
          const wait = () => {
            if (reg.waiting) return resolve();
            if (Date.now() - started > SW_WAIT_TIMEOUT_MS) return resolve();
            setTimeout(wait, 200);
          };
          wait();
        });
        // User sudah klik OKE → perintahkan SW yang menunggu aktif SEKARANG.
        if (reg.waiting) {
          // PASANG listener SEBELUM postMessage — aktifasi bisa secepat itu;
          // kalau listener baru terpasang setelah claim, reload jalan saat SW
          // lama masih mengontrol navigasi = user dapat versi lama sekali lagi.
          const claimed = new Promise((resolve) => {
            const onClaim = () => { cleanup(); resolve(); };
            const cleanup = () => navigator.serviceWorker.removeEventListener('controllerchange', onClaim);
            navigator.serviceWorker.addEventListener('controllerchange', onClaim, { once: true });
            setTimeout(() => { cleanup(); resolve(); }, SW_WAIT_TIMEOUT_MS);
          });
          reg.waiting.postMessage('SKIP_WAITING');
          await claimed;
        }
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
// Kontrak: `remote` HARUS objek hasil fetchRemoteVersion (punya cacheBust).
// Pemanggilan tanpa data remote / versi yang sama diabaikan — mencegah overlay
// palsu dari event SW atau pemanggil lawas (bug ketemu saat uji v56).
export async function notifyUpdateAvailable(remote) {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  if (!remote || typeof remote !== 'object' || !remote.cacheBust) return;
  if (remote.cacheBust === CACHE_BUST) {
    // Lokal sudah versi terbaru → status "menunggu OKE" (kalau ada) basi.
    clearPendingUpdate();
    return;
  } // versi sama → tidak ada update
  // User sudah klik OKE untuk versi ini → jangan tampilkan lagi
  // (RELOAD_FLAG sessionStorage dibersihkan saat boot, localStorage tidak)
  let ackedVersion = null;
  try { ackedVersion = localStorage.getItem(ACK_VERSION_KEY); } catch {}
  if (ackedVersion && ackedVersion === remote.cacheBust) {
    clearPendingUpdate(); // sudah di-OKE — pastikan status menunggu ikut bersih
    return;
  }
  persistPendingUpdate(remote); // WAJIB dikabar: hidup sampai OKE, tahan refresh
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
    if (btn) btn.addEventListener('click', () => {
      // Simpan versi yang di-acknowledge → overlay tidak muncul lagi untuk versi ini
      // walau RELOAD_FLAG dibersihkan saat boot startUpdateWatcher().
      try { localStorage.setItem(ACK_VERSION_KEY, remote.cacheBust); } catch {}
      clearPendingUpdate();
      performForceUpdate();
    });
  }
  await openModal('updateOverlay', { modalSelector: '.update-card' });
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
export async function checkForUpdate() {
  try {
    const remote = await fetchRemoteVersion();
    if (remote.cacheBust !== CACHE_BUST) {
      if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log(`[UPDATE] Versi baru ${remote.cacheBust} (lokal ${CACHE_BUST}).`);
      notifyUpdateAvailable(remote);
    }
  } catch (e) {
    if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[UPDATE] Cek versi gagal (mungkin offline):', e?.message || e);
  }
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update(); // minta SW cek ulang (updatefound -> notify)
    } catch (e) {
      if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[UPDATE] SW update check:', e?.message || e);
    }
  }
}

export function startUpdateWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;
  // Sisa flag reload dari session sebelumnya dibersihkan saat app baru boot.
  sessionStorage.removeItem(RELOAD_FLAG);
  // Permintaan pemilik 2026-09-07: overlay update yang belum di-OKE TETAP tampil
  // setelah refresh. Pulihkan dari localStorage seketika (tanpa fetch network —
  // harus muncul juga saat offline), sebelum jadwal cek berkala di bawah.
  const pending = readPendingUpdate();
  if (pending && pending.cacheBust !== CACHE_BUST) {
    let acked = null;
    try { acked = localStorage.getItem(ACK_VERSION_KEY); } catch {}
    if (acked !== pending.cacheBust) {
      notifyUpdateAvailable({ ...pending });
    } else {
      clearPendingUpdate(); // sudah pernah di-OKE — status menunggu basi
    }
  } else if (pending) {
    clearPendingUpdate(); // lokal ternyata sudah versi tsb — bersihkan
  }
  setTimeout(checkForUpdate, 3000); // sekali setelah app settle
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', checkForUpdate);
}
