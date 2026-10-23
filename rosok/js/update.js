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
// Tunggu SW baru (hasil reg.update) jadi `waiting` — install precache ~60 aset
// dengan cache:'reload' di jaringan lambat bisa >3/6 dtk. Timeout 6 dtk dulu
// membuat reload DINI: halaman baru dilayani SW lama → versi tak berubah →
// checkForUpdate men-arming ulang overlay → loop OKE→reload→overlay
// (paritas fix kaki5 `4529cd0`, audit 2026-09-17).
const SW_INSTALL_WAIT_MS = 20000;
// Fallback bila event controllerchange tak kunjung fired setelah SKIP_WAITING.
const SW_ACTIVATE_TIMEOUT_MS = 2000;

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

// Refresh paksa (tombol OKE). FIX paritas kaki5 (audit 2026-09-17, loop
// "OKE→reload→overlay berkali-kali"): reload hanya layak bila HANYA tanpa SW,
// atau SW baru sudah benar-benar mengambil alih (waiting→SKIP_WAITING→
// controllerchange). Kalau SW ada tapi tak kunjung jadi waiting (install lambat/
// offline), JANGAN reload — reload dilayani SW lama (cache-first) → versi lokal
// tak berubah → checkForUpdate men-arming ulang overlay → loop tanpa pernah
// mendarat. Tombal: batalkan, tombol OKE dikembalikan, pending dipertahankan.
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
        // selesai tanpa worker baru (offline / tak ada rilis).
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
    toast('⏳ Pembaruan belum selesai diunduh — cek koneksi lalu coba lagi');
    return;
  }

  // Sukses: flag TIDAK dilepas di sini — halaman baru boot() via
  // startUpdateWatcher yang membersihkannya; selagi flag ada, tap ganda
  // ditiadakan. reload() di bawah selalu dieksekusi setelah jalur bail.
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
