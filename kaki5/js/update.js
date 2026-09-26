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
// Tunggu SW baru (hasil reg.update) jadi `waiting` — install precache ~60 aset
// dengan cache:'reload' (bypass HTTP cache) bisa >3 dtk di jaringan lambat.
// Grace 3 dtk dulu membuat reload DINI: halaman baru dilayani SW lama (cache-
// first index lama) → versi tak berubah → checkForUpdate men-arming ulang
// overlay → loop OKE→reload→overlay (audit 2026-09-17, akar "berkali-kali").
const SW_INSTALL_WAIT_MS = 20000;
// Fallback bila event controllerchange tak kunjung fired setelah SKIP_WAITING.
const SW_ACTIVATE_TIMEOUT_MS = 2000;
const TOAST_DURATION_MS = 15000;

let watcherStarted = false;

// Tunggu SW baru masuk status `waiting`. Event-driven (updatefound → statechange
// installed) + polling ringan sebagai backstop. Resolve `reg.waiting` bila ada,
// atau `null` bila (a) timeout, (b) update() settle tanpa ada worker baru sama
// sekali (offline/tak ada rilis) — tidak menunggu penuh 20 dtk sia-sia.
function waitForWaitingWorker(reg, updatePromise, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (w) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      if (typeof reg.removeEventListener === 'function') reg.removeEventListener('updatefound', onUpdateFound);
      resolve(w);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const poll = setInterval(() => { if (reg.waiting) finish(reg.waiting); }, 250);
    const onUpdateFound = () => {
      const inst = reg.installing;
      if (!inst) { if (reg.waiting) finish(reg.waiting); return; }
      inst.addEventListener('statechange', () => {
        if (inst.state === 'installed' && reg.waiting) finish(reg.waiting);
      });
    };
    reg.addEventListener('updatefound', onUpdateFound);
    // update() selesai & tak ada worker baru → bail cepat (jangan 20 dtk).
    if (updatePromise && typeof updatePromise.then === 'function') {
      updatePromise.then(() => {
        setTimeout(() => {
          if (!reg.waiting && !reg.installing) finish(null);
        }, 300);
      }).catch(() => {
        setTimeout(() => {
          if (!reg.waiting && !reg.installing) finish(null);
        }, 300);
      });
    }
    if (reg.waiting) { finish(reg.waiting); return; }
  });
}

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

// Refresh paksa (tombol OKE). FIX audit 2026-09-17 (loop "OKE→reload→overlay
// berkali-kali"): reload hanya layak bila HANYA tanpa SW, atau SW baru sudah
// benar-benar mengambil alih (waiting→SKIP_WAITING→controllerchange). Kalau SW
// ada tapi tak kunjung jadi waiting (install lambat / offline), JANGAN reload —
// reload dilayani SW lama (cache-first) → versi lokal tak berubah → checkForUpdate
// men-arming ulang overlay → loop tanpa pernah mendarat. Tombal: batalkan, tombol
// OKE dikembalikan, pending dipertahankan (atur pemilik: hilang hanya via OKE).
export async function performForceUpdate() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // sudah dalam proses reload
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));

  // Satu-satunya titik reload (di bawah) — pastikan semua jalur bail return
  // lebih dulu; jangan ada reload dari dalam try (error di jalur bail dulu
  // malah jatuh ke catch → reload → loop, lihat audit 2026-09-17).
  let shouldReload = true;

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // Jalan normal: SW ada → cek update, tunggu jadi `waiting`, baru reload.
        // updatePromise dipakai waitForWaitingWorker utk bail cepat bila update()
        // selesai tanpa worker baru (offline / tak ada rilis) — hindari tunggu 20 dtk.
        const updatePromise = reg.update().catch(() => {});
        const waiting = await waitForWaitingWorker(reg, updatePromise, SW_INSTALL_WAIT_MS);
        if (waiting) {
          // Ada SW menunggu → aktifkan SEKARANG. Listener SEBELUM postMessage —
          // aktivasi bisa secepat itu; kalau listener dipasang setelah claim,
          // reload dilayani SW lama.
          let claimed = false;
          const claimedP = new Promise((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true });
            setTimeout(() => resolve(false), SW_ACTIVATE_TIMEOUT_MS);
          });
          waiting.postMessage('SKIP_WAITING');
          claimed = await claimedP;
          if (!claimed && reg.waiting) {
            // SKIP_WAITING belum berlaku (SW masih `waiting`) — reload sekarang
            // akan dilayani SW lama. Batalkan; tap OKE lagi nanti.
            console.warn('[UPDATE] SKIP_WAITING belum mengambil alih dalam ' + SW_ACTIVATE_TIMEOUT_MS + 'ms — reload dibatalkan.');
            shouldReload = false;
          }
          // claimed=true ATAU reg.waiting sudah null (SW aktif) → aman reload:
          // navigasi berikutnya diambil alih SW aktif terbaru.
        } else {
          // SW terdaftar tapi tak kunjung waiting (install lambat / offline).
          // JANGAN reload — dilayani SW lama = versi tak berubah = loop overlay.
          console.warn('[UPDATE] SW baru belum jadi waiting dalam ' + SW_INSTALL_WAIT_MS + 'ms — reload dibatalkan (hindari loop overlay).');
          shouldReload = false;
        }
      }
    } catch (e) {
      // Error di jalur pending-an SW/registration -> jangan reload (SW mungkin
      // masih kuno; reload = loop). Perbaikan vs lama: catch tidak lagi reload.
      console.warn('[UPDATE] Aktivasi SW gagal, reload dibatalkan:', e?.message || e);
      shouldReload = false;
    }
  }

  if (!shouldReload) {
    // Batalkan: flag dilepas supaya tap OKE berikutnya bisa mencoba lagi.
    sessionStorage.removeItem(RELOAD_FLAG);
    const overlay = document.getElementById('updateOverlay');
    if (overlay && !overlay.classList.contains('show')) overlay.classList.add('show');
    const btn = document.getElementById('updateOkBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'OKE'; }
    showToast('⏳ Pembaruan belum selesai diunduh — cek koneksi lalu coba lagi', 'info', TOAST_DURATION_MS);
    return;
  }

  // Sukses: flag TIDAK dilepas di sini — halaman baru boot() via
  // startUpdateWatcher yang membersihkannya; selagi flag ada, tap ganda
  // ditiadakan. reload() di bawah selalu dieksekusi setelah jalur bail.
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
