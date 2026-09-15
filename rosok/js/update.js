/* =========================================================================
   KASIR SOLO - ROSOK
   update.js — Deteksi rilis baru + REFRESH PAKSA via overlay.
   PERILAKU DISELARASKAN PENUH DENGAN KAKI5 v187+ (pemilik 2026-09-15):
   1. TANPA polling berkala — cek sekali saat boot (settle 3 dtk), tiap kembali
      ke foreground, dan tiap koneksi online.
   2. Overlay full-screen TIDAK bisa ditutup selain OKE; status "update
      menunggu OKE" DIPERSIST di localStorage (ksr:update-pending) dan
      dipulihkan seketika saat boot tanpa menunggu network — overlay tetap
      tampil meski browser direfresh, muncul juga saat offline
      (permintaan pemilik di kaki5 2026-09-07).
   3. OKE = performForceUpdate(): sw.js TIDAK lagi skipWaiting otomatis (SW
      baru masuk status "waiting") → perintahkan aktif via pesan STRING
      'SKIP_WAITING', tunggu controllerchange SEBELUM reload — reload dijamin
      dilayani SW baru (pelajaran audit self-update kaki5 v187: tanpa ini
      user dapat versi lama sekali lagi / overlay tak pernah muncul).
   4. Guard anti-reload-loop (sessionStorage). TIDAK ada ack per-versi.
   5. REVISI PEMILIK 2026-09-15: overlay HANYA disembunyikan oleh klik OKE —
      bahkan bila build lokal sudah ter-update (konvergen). Konvergensi bukan
      pemicu tutup. OKE = hapus status pending + force-update; bila update
      belum mendarat (offline dsb.), cek berikutnya menemukan versi baru →
      pending di-arming ulang → overlay tampil lagi.
   Deteksi: bandingkan cacheBust js/version.json (network murni — sw.js
   mem-bypass file ini dari cache) dengan CACHE_BUST build lokal.
   ========================================================================= */
import { CACHE_BUST } from './version.js';
import { toast, escapeHtml } from './utils.js';

function isDev() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || h.endsWith('.local') || !h.includes('.');
}

const VERSION_URL = './js/version.json';
const RELOAD_FLAG = 'ksr:update-reloading';          // cegah loop reload (session)
const PENDING_UPDATE_KEY = 'ksr:update-pending';     // update menunggu OKE (persist — tahan refresh & offline)
const SW_WAIT_TIMEOUT_MS = 6000;

let watcherStarted = false;

// ── Persist status "menunggu OKE" (paritas kaki5) ─────────────────────────
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
  if (!res.ok) throw new Error('version.json -> HTTP ' + res.status);
  const data = await res.json();
  if (!data || typeof data.cacheBust !== 'string') throw new Error('version.json malformed');
  return data;
}

// Refresh paksa (tombol OKE): pastikan SW terbaru terunduh & masuk status
// "waiting" (sw.js TANPA skipWaiting otomatis — SW baru tidak aktif sendiri),
// lalu perintahkan aktif via pesan SKIP_WAITING, tunggu claim, baru reload.
// Kalau tidak ada SW (open biasa / non-PWA) cukup reload langsung.
export async function performForceUpdate() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // sudah dalam proses reload
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update(); // fetch sw.js terbaru -> install (waiting, tanpa skipWaiting)
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
          // PASANG listener SEBELUM postMessage — aktivasi bisa secepat itu;
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

// Catatan default bila version.json tidak menyertakan notes.
const DEFAULT_NOTES = [
  '✅ Perbaikan & penyempurnaan agar aplikasi makin lancar dipakai setiap hari',
  '🛡️ Data usahamu kini tersimpan lebih aman'
];

// Tampilkan overlay full-screen. Kontrak: `remote` objek dengan cacheBust.
// ATURAN PEMILIK (revisi 2026-09-15): tidak ada auto-dismiss oleh konvergensi
// — yang memanggil notify-lah yang memutuskan; watcher selalu meneruskan
// pending apa pun statusnya, dan hanya klik OKE yang menghapus pending.
export function notifyUpdateAvailable(remote) {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  if (!remote || typeof remote !== 'object' || !remote.cacheBust) return;
  persistPendingUpdate(remote); // hidup sampai OKE — tahan refresh, offline, DAN konvergensi
  const overlay = document.getElementById('updateOverlay');
  if (!overlay) {
    toast('🔄 Versi baru tersedia — tutup & buka ulang aplikasi ya');
    return;
  }
  const verEl = document.getElementById('updateVersionLabel');
  if (verEl) verEl.textContent = 'Versi ' + (remote.version || remote.cacheBust);
  const listEl = document.getElementById('updateNotesList');
  if (listEl) {
    const notes = Array.isArray(remote.notes) && remote.notes.length ? remote.notes : DEFAULT_NOTES;
    listEl.innerHTML = notes.map(n => '<li>' + escapeHtml(n) + '</li>').join('');
  }
  const btn = document.getElementById('updateOkBtn');
  if (btn) {
    // onclick di-assign ulang tiap panggilan (anti closure basi ala kaki5).
    // OKE = SATU-SATUNYA pemicu tutup (revisi pemilik 2026-09-15): hapus
    // pending lalu force-update. Bila update belum mendarat (offline),
    // checkForUpdate berikutnya menemukan versi ≠ lokal → pending di-arming
    // ulang → overlay muncul lagi. Tidak pernah hilang tanpa jejak.
    btn.onclick = () => { clearPendingUpdate(); performForceUpdate(); };
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
  // Sekalian dorong SW check → event updatefound ikut bekerja.
  if ('serviceWorker' in navigator) {
    try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (_) {}
  }
}

export function startUpdateWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;
  sessionStorage.removeItem(RELOAD_FLAG); // sisa flag sesi sebelumnya
  // Revisi pemilik 2026-09-15: selama pending ada, overlay SELALU dipulihkan
  // saat boot — APA APUN kondisi versi lokal (termasuk sudah konvergen).
  // Yang menghapus pending hanyalah klik OKE (lihat btn.onclick di atas).
  const pending = readPendingUpdate();
  if (pending) notifyUpdateAvailable({ ...pending });
  setTimeout(checkForUpdate, 3000);       // sekali setelah app settle
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', checkForUpdate);
}
