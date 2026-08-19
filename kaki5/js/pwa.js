// ==================== PWA SUPPORT (ESM) ====================
import { showToast } from './helpers.js';

let deferredPrompt = null;
let isPWAInstalled = false;

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

  // 3. Check if service worker is controlling this page (strong indicator)
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    return true;
  }

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
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
      console.log('[SW] Registered, scope:', reg.scope);

      // Check for SW updates (app already installed, new version available)
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] Service worker baru terpasang — menunggu reload berikutnya.');
            }
          });
        }
      });
    }).catch(err => {
      console.warn('[SW] Registration failed:', err.message);
    });
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
  banner.style.cssText = 'position:fixed;top:calc(var(--header-h) + 8px);left:8px;right:8px;max-width:90%;margin:0 auto;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;border-radius:16px;padding:14px 16px;z-index:150;box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;align-items:center;gap:12px;animation:slideDown .3s ease';
  banner.innerHTML = '<div style="font-size:32px">📲</div><div style="flex:1"><div style="font-weight:700;font-size:14px">Pasang di HP</div><div style="font-size:12px;opacity:.85">Biar gampang dibuka kayak app biasa</div></div><button onclick="installPWA()" style="background:#fff;color:var(--primary);border:none;padding:8px 16px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer">Pasang</button><button onclick="this.parentElement.remove()" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;padding:4px">✕</button>';
  document.body.appendChild(banner);

  const style = document.createElement('style');
  style.textContent = '@keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(style);
}

// ── Install PWA (native prompt) ─────────────────────────────────────────────
export async function installPWA() {
  if (!deferredPrompt) {
    showManualInstallGuide();
    return;
  }
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  if (result.outcome === 'accepted') {
    showToast('🎉 App berhasil dipasang!', 'success');
    isPWAInstalled = true;
    try { localStorage.setItem('kasirsolo:pwa-installed', 'true'); } catch {}
  }
  deferredPrompt = null;
  const banner = document.getElementById('installBanner');
  if (banner) banner.remove();
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
      <button onclick="document.getElementById('installGuideOverlay').remove()" style="background:var(--primary);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer">Tutup</button>
    </div>`;
  document.body.appendChild(overlay);
}

// ── Module-level listeners ───────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  if (isPWAInstalled || checkPWAInstalled()) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  showToast('🎉 Kasir Solo sudah terpasang!', 'success');
  deferredPrompt = null;
  isPWAInstalled = true;
  try { localStorage.setItem('kasirsolo:pwa-installed', 'true'); } catch {}
  const banner = document.getElementById('installBanner');
  if (banner) banner.remove();
});

// ── Export ────────────────────────────────────────────────────────────────────
export { isPWAInstalled, checkPWAInstalled };
