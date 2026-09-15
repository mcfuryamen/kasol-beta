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
// ATURAN PEMILIK (revisi 2026-09-15): overlay HANYA disembunyikan oleh klik
// OKE — bahkan bila build lokal sudah ter-update (konvergen bukan pemicu
// tutup; ACK_VERSION_KEY juga DIHAPUS). OKE = hapus pending + force-update;
// bila update belum mendarat (offline dsb.) cek berikutnya men-arming ulang
// pending → overlay muncul lagi. Tidak pernah hilang tanpa jejak.
// Permintaan pemilik 2026-09-07: overlay update yang BELUM di-OKE harus tetap
// tampil meski browser direfresh. Status "ada update" dipersist di
// localStorage dan dipulihkan seketika saat boot — bukan cuma menunggu fetch
// version.json (yang butuh network + jeda 3 dtk, dan gagal total saat offline).
const PENDING_UPDATE_KEY = 'ksr:update-pending';
// Tunggu SINGKAT agar SW yg di-install di background sempat jadi `waiting`
// (edge case: OKE diklik sebelum install selesai). Bukan 6 dtk — akar "tombol bandel".
const SW_WAITING_GRACE_MS = 3000;
// Fallback bila event controllerchange tak kunjung fired setelah SKIP_WAITING.
const SW_ACTIVATE_TIMEOUT_MS = 2000;
const TOAST_DURATION_MS = 15000;

let watcherStarted = false;

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

// Refresh paksa (tombol OKE): SW baru SUDAH di-install di background (cek saat
// boot / visibilitychange / online — lihat startUpdateWatcher & checkForUpdate),
// jadi OKE cukup MENGAKTIFKAN SW yg menunggu lalu reload — tidak fetch ulang
// & tidak tunggu 6 dtk (akar "tombol bandel"). Kalau memang tak ada SW menunggu,
// reload tetap dijalankan; overlay self-heal bila versi belum berubah.
export async function performForceUpdate() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // sudah dalam proses reload
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // Pastikan pengecekan SW jalan (fire-and-forget; tidak memblokir).
        reg.update().catch(() => {});
        // Tunggu SEBENTAR agar SW yg di-install di background muncul sebagai
        // `waiting` (edge case: OKE diklik sebelum install selesai). Maks 3 dtk.
        const started = Date.now();
        const hasWaiting = await new Promise((resolve) => {
          const tick = () => {
            if (reg.waiting) return resolve(true);
            if (Date.now() - started > SW_WAITING_GRACE_MS) return resolve(false);
            setTimeout(tick, 200);
          };
          tick();
        });
        // Ada SW menunggu → aktifkan SEKARANG lalu reload.
        if (hasWaiting && reg.waiting) {
          // Listener SEBELUM postMessage — aktivasi bisa secepat itu; kalau
          // listener dipasang setelah claim, reload dilayani SW lama.
          const claimed = new Promise((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
            setTimeout(resolve, SW_ACTIVATE_TIMEOUT_MS);
          });
          reg.waiting.postMessage('SKIP_WAITING');
          await claimed;
        }
      }
    } catch (e) {
      console.warn('[UPDATE] Aktivasi SW gagal, reload tetap jalan:', e?.message || e);
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
  // Revisi 2026-09-15: TIDAK ada auto-dismiss oleh konvergensi — pemanggil
  // (watcher/check) yang memutuskan; di sini cukup persist + tampilkan.
  persistPendingUpdate(remote); // hidup sampai OKE — tahan refresh, offline, DAN konvergensi
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

  const btn = document.getElementById('updateOkBtn');
  if (btn) {
    // onclick di-assign ulang tiap panggilan (pola rosok — memperbaiki
    // addEventListener-sekali yang closure-nya basi saat versi berganti
    // cepat). OKE = SATU-SATUNYA pemicu tutup (revisi pemilik 2026-09-15):
    // hapus pending + force-update. SW baru sudah di-install di background —
    // OKE cukup mengaktifkan SW menunggu lalu reload, tanpa tunggu 6 dtk.
    btn.onclick = () => {
      clearPendingUpdate();
      // Feedback instan: tombol tampak merespons (audit "tombol bandel").
      btn.disabled = true;
      btn.textContent = 'Memperbarui…';
      performForceUpdate();
    };
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
  // Revisi pemilik 2026-09-15: selama pending ada, overlay SELALU dipulihkan
  // saat boot — APA APUN kondisi versi lokal (termasuk sudah konvergen).
  // Yang menghapus pending hanyalah klik OKE (lihat btn.onclick di atas).
  const pending = readPendingUpdate();
  if (pending) {
    notifyUpdateAvailable({ ...pending });
    // Mulai install SW baru di background SEGERA (jangan tunggu timer 3 dtk) —
    // supaya saat OKE diklik, reg.waiting biasanya sudah ada → aktivasi cepat
    // (pola decouple: install di background, aktivasi saat OKE diklik).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
    }
  }
  setTimeout(checkForUpdate, 3000); // sekali setelah app settle
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', checkForUpdate);
}
