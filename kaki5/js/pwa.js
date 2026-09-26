// ==================== PWA SUPPORT (ESM) ====================
import { showToast } from './helpers.js';

// Dev detection helper
function isDev() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.startsWith('192.168.') || location.hostname.startsWith('10.') || location.hostname.endsWith('.local') || !location.hostname.includes('.');
}

let deferredPrompt = null;
let isPWAInstalled = false;
// Mesin status "Pasang Aplikasi": idle -> installing (dialog browser terbuka)
// -> installing-app (diterima, menunggu appinstalled) -> installed.
let installState = 'idle';
let installFallbackTimer = null;

// ── Check PWA installed state ────────────────────────────────────────────────
function checkPWAInstalled() {
  // 1. Standalone display mode (Android Chrome, Edge, Firefox, Safari PWA)
  if (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches) {
    return true;
  }

  // 2. iOS Safari standalone (legacy)
  if (window.navigator.standalone === true) {
    return true;
  }

  // 3. NOTE: service worker controller TIDAK menandakan app terpasang sebagai PWA.
  //    SW aktif di setiap kunjungan, bukan hanya setelah install. Hapus check ini
  //    karena menyebabkan beforeinstallprompt ditolak dan install prompt tidak muncul.

  // 4. Check localStorage flag (set after successful install)
  try {
    if (localStorage.getItem('kasirsolo:pwa-installed') === 'true') {
      return true;
    }
  } catch {}

  return false;
}

// ── Register Service Worker ──────────────────────────────────────────────────
export function setupPWA() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Dev server (localhost): JANGAN pakai SW — server.cjs sudah no-store,
    // dan cache-first membuat iterasi CSS/JS di localhost selalu menyajikan
    // file lama sampai cache dibersihkan manual. Unregister sisa SW lama.
    if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      }).catch(() => {});
    } else {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
      if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[SW] Registered, scope:', reg.scope);

      // Check for SW updates (app already installed, new version available)
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) console.log('[SW] Service worker baru terpasang — menunggu reload berikutnya.');
            }
          });
        }
      });
    }).catch(err => {
      console.warn('[SW] Registration failed:', err.message);
      // Audit toast 2026-09-07: mode offline/instalabilitas rusak diam-diam.
      showToast('⚠️ Mode offline tidak aktif — muat ulang dengan koneksi stabil', 'warning', 5000);
    });
    }
  }

  // Initial check
  isPWAInstalled = checkPWAInstalled();

  // Listen for display mode changes (e.g., user installs, then reopens)
  if (window.matchMedia) {
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = () => {
      const wasInstalled = isPWAInstalled;
      isPWAInstalled = checkPWAInstalled();
      if (!wasInstalled && isPWAInstalled) {
        try { localStorage.setItem('kasirsolo:pwa-installed', 'true'); } catch {}
        showToast('🎉 Kasir Solo sudah terpasang!', 'success');
      }
      updateInstallRow(); // dua arah: terpasang → pasif; balik ke browser (copot) → aktif
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler); // Safari legacy
  }
}

// ── Custom Install Banner ────────────────────────────────────────────────────
export function showInstallBanner() {
  if (isPWAInstalled || checkPWAInstalled()) {
    isPWAInstalled = true;
    return;
  }

  if (document.getElementById('installBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'installBanner';
  banner.style.cssText = 'position:fixed;top:calc(var(--header-h) + 8px);left:8px;right:8px;max-width:90%;margin:0 auto;background:var(--grad);color:#fff;border-radius:16px;padding:14px 16px;z-index:150;box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;align-items:center;gap:12px;animation:slideDown .3s ease';
  banner.innerHTML = '<div class="kfs32">📲</div><div class="kflex-1"><div class="kfw700 kfs14">Pasang di HP</div><div style="font-size:12px;opacity:.85">Biar gampang dibuka kayak app biasa</div></div><button data-action="install-pwa" style="background:#fff;color:var(--primary);border:none;padding:8px 16px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer">Pasang</button><button data-action="close-install-banner" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;padding:4px">✕</button>';
  document.body.appendChild(banner);

  const style = document.createElement('style');
  style.textContent = '@keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(style);
}

// ── CSS spinner instalasi (di-inject sekali, pola sama dgn keyframe banner) ──
function ensureInstallSpinnerCss() {
  if (document.getElementById('installSpinnerCss')) return;
  const s = document.createElement('style');
  s.id = 'installSpinnerCss';
  s.textContent = '@keyframes installSpin{to{transform:rotate(360deg)}}' +
    '.install-spinner{display:inline-block;width:18px;height:18px;border:3px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;animation:installSpin .8s linear infinite}';
  document.head.appendChild(s);
}

// ── Terapkan satu status ke baris pengaturan + tombol banner ────────────────
function setInstallState(state) {
  installState = state;
  ensureInstallSpinnerCss();
  const CFG = {
    idle: { title: 'Pasang Aplikasi', desc: 'Buka kayak app native di HP', disabled: false, opacity: '1', icon: '📲', btn: 'Pasang' },
    installing: { title: '📲 Memasang…', desc: 'Konfirmasi dialog pemasangan di browser', disabled: true, opacity: '0.85', icon: 'spin', btn: 'Memasang…' },
    'installing-app': { title: '📥 Menginstal…', desc: 'Menyelesaikan pemasangan di perangkat', disabled: true, opacity: '0.85', icon: 'spin', btn: 'Memasang…' },
    installed: { title: '✅ Sudah Terpasang', desc: 'Aplikasi sudah berjalan di layar utama', disabled: true, opacity: '0.45', icon: '📲', btn: '✓ Terpasang' }
  }[state] || { title: 'Pasang Aplikasi', desc: 'Buka kayak app native di HP', disabled: false, opacity: '1', icon: '📲', btn: 'Pasang' };

  const titleEl = document.getElementById('pwaInstallTitle');
  const descEl = document.getElementById('pwaInstallDesc');
  const row = document.getElementById('pwaInstallRow');
  if (titleEl) titleEl.textContent = CFG.title;
  if (descEl) descEl.textContent = CFG.desc;
  if (row) {
    const iconEl = row.querySelector('.setting-icon');
    if (iconEl) iconEl.innerHTML = CFG.icon === 'spin' ? '<span class="install-spinner"></span>' : CFG.icon;
    row.style.opacity = CFG.opacity;
    row.style.pointerEvents = CFG.disabled ? 'none' : '';
    if (CFG.disabled) row.setAttribute('aria-disabled', 'true'); else row.removeAttribute('aria-disabled');
  }
  // Tombol banner ikut feedback (kalau banner masih ada).
  const banner = document.getElementById('installBanner');
  const bannerBtn = banner ? banner.querySelector('[data-action="install-pwa"]') : null;
  if (bannerBtn) {
    bannerBtn.textContent = CFG.btn;
    if (CFG.disabled) { bannerBtn.setAttribute('disabled', ''); bannerBtn.style.opacity = '.65'; }
    else { bannerBtn.removeAttribute('disabled'); bannerBtn.style.opacity = '1'; }
  }
}

// ── Update setting row "Pasang Aplikasi" berdasarkan status terpasang ────────
function updateInstallRow() {
  // Jangan timpa state proses sementara (memasang/menginstal).
  if (installState === 'installing' || installState === 'installing-app') return;
  const installed = isPWAInstalled || checkPWAInstalled();
  setInstallState(installed ? 'installed' : 'idle');
}

// ── Install PWA (native prompt) ─────────────────────────────────────────────
export async function installPWA() {
  // beforeinstallprompt yang sudah terpendam sudah membuktikan:
  //    1. App eligible untuk di-install (manifest, SW, HTTPS)
  //    2. App BELUM terpasang (Chrome hanya fire event jika eligible + belum pasang)
  //
  // Jangan cek isPWAInstalled / checkPWAInstalled() di sini — itu bisa
  // false-positive (display-mode "nyangkut" saat navigasi, localStorage
  // dari install sebelumnya, dsb) dan menyebabkan native prompt TIDAK
  // pernah dipanggil, walau deferredPrompt tersedia.
  // Guard untuk TAMPILKAN BANNER tetap ada di beforeinstallprompt listener.

  // 1. Prompt native tersedia? → langsung panggil, dengan feedback visual.
  if (deferredPrompt) {
    setInstallState('installing'); // "Memasang…" + spinner, baris diblok (anti tap ganda)
    deferredPrompt.prompt();
    let result;
    try {
      result = await deferredPrompt.userChoice;
    } catch (_) {
      setInstallState('idle');
      return;
    }
    if (result.outcome === 'accepted') {
      // JANGAN langsung "Sudah Terpasang" — instalasi asli baru selesai di event
      // appinstalled. Tampilkan "Menginstal…" sampai saat itu.
      setInstallState('installing-app');
      clearTimeout(installFallbackTimer);
      installFallbackTimer = setTimeout(() => {
        if (installState !== 'installing-app') return;
        if (isPWAInstalled || checkPWAInstalled()) {
          setInstallState('installed');
          showToast('🎉 Kasir Solo sudah terpasang!', 'success');
        } else {
          setInstallState('idle');
          showToast('ℹ️ Pemasangan belum terdeteksi — coba lagi', 'info');
        }
      }, 8000);
    } else {
      // Audit toast 2026-09-07: prompt ditutup → banner hilang permanen tanpa
      // kabar — user tidak tahu bisa memasang lagi nanti.
      setInstallState('idle');
      showToast('ℹ️ Pemasangan ditunda — banner akan muncul lagi lain waktu', 'info');
    }
    deferredPrompt = null;
    const banner = document.getElementById('installBanner');
    if (banner) banner.remove();
    return;
  }

  // 3. Prompt belum tersedia saat klik → tunjukkan panduan instalasi manual
  //    (overlay full-screen dengan langkah, bukan toast yang hilang dalam 5 detik)
  showManualInstallGuide();
}

// ── Manual Install Guide (iOS / when prompt not available) ──────────────────
export function showManualInstallGuide() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let msg;
  if (isIOS) {
    msg = '🍎 <b>iOS:</b><br>1. Tekan tombol <b>Share</b> di browser<br>2. Pilih <b>"Add to Home Screen"</b><br>3. Konfirmasi dengan <b>"Tambah"</b>';
  } else {
    msg = '📱 <b>Android:</b><br>1. Buka menu <b>⋮</b> (pojok kanan atas)<br>2. Pilih <b>"Install app"</b> atau <b>"Tambahkan ke layar utama"</b><br><br>💡 Tip: Buka app 2x sebelum install agar prompt muncul otomatis.';
  }

  const overlay = document.createElement('div');
  overlay.id = 'installGuideOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:24px;max-width:320px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.3)">
      <div style="font-size:40px;margin-bottom:12px">${isIOS ? '🍎' : '📲'}</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:12px;color:#1a1a1a">Pasang Aplikasi</div>
      <div style="font-size:13px;color:#555;line-height:1.7;text-align:left;margin-bottom:20px">${msg}</div>
      <button data-action="close-install-guide" style="background:var(--grad);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer">Tutup</button>
    </div>`;
  document.body.appendChild(overlay);
}

// ── Module-level listeners ────────────────────────────────────────────────────
// beforeinstallprompt: browser memastikan app installable BELUM terpasang.
// Simpan deferredPrompt TERLEBIH DAHULU (tanpa cek checkPWAInstalled),
// karena check itu bisa false-positive (mis. SW controller). Hanya banner
// yang disembunyikan jika terdeteksi sudah terpasang.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // beforeinstallprompt = bukti OTORITATIF dari browser: app BELUM terpasang
  // (Chrome tidak pernah fire pada app yang sudah ter-install, dan fire lagi
  // setelah user mencopot). Bersihkan flag lama supaya tombol install kembali
  // AKTIF pasca-copot — bug lama: flag localStorage tak pernah dihapus sehingga
  // row selamanya "Sudah Terpasang" walau app sudah dicopot (pemilik 2026-09-15).
  try { localStorage.removeItem('kasirsolo:pwa-installed'); } catch {}
  isPWAInstalled = false;
  updateInstallRow();
  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  clearTimeout(installFallbackTimer);
  deferredPrompt = null;
  isPWAInstalled = true;
  try { localStorage.setItem('kasirsolo:pwa-installed', 'true'); } catch {}
  const banner = document.getElementById('installBanner');
  if (banner) banner.remove();
  setInstallState('installed'); // "✅ Sudah Terpasang"
  showToast('🎉 Kasir Solo sudah terpasang!', 'success');
});

// ── Export ────────────────────────────────────────────────────────────────────
export { isPWAInstalled, checkPWAInstalled, updateInstallRow };