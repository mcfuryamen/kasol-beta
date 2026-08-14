// ==================== PWA SUPPORT (ESM) ====================
import { showToast } from './helpers.js';
import { notifyUpdateAvailable } from './update.js';

let deferredPrompt = null;
let isPWAInstalled = false;

// Check if app is already installed/running as PWA
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

// Generate manifest blob URL with icon
export function setupPWA() {
  // Manifest disediakan sebagai file statis (manifest.json) yang direferensikan
  // di index.html via <link rel="manifest">. Browser TIDAK menerima manifest dari
  // blob: URL untuk persyaratan installability, jadi jangan dibangun dinamis.
  // Cukup daftarkan Service Worker (file eksternal, cache-first).
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
      console.log('[SW] Registered, scope:', reg.scope);
      
      // Check for SW updates (app already installed, new version available)
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Versi baru tersedia -> toast + tombol Refresh (bukan auto reload)
              notifyUpdateAvailable('🔄 Versi baru tersedia!');
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
        // Just got installed! Mark in localStorage
        try { localStorage.setItem('kasirsolo:pwa-installed', 'true'); } catch {}
        showToast('🎉 Kasir Solo sudah terpasang!', 'success');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler); // Safari legacy
  }
}

export function showInstallBanner() {
  // Jika sudah terinstal (running as PWA), jangan tampilkan banner
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

  // Add slideDown animation
  const style = document.createElement('style');
  style.textContent = '@keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(style);
}

export async function installPWA() {
  if (!deferredPrompt) return;
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

// Module-level global listeners (run once on import)
window.addEventListener('beforeinstallprompt', (e) => {
  // Browser already knows app is installable - don't show if already installed
  if (isPWAInstalled || checkPWAInstalled()) {
    e.preventDefault(); // Still prevent default to keep control
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

// Export for manual checking
export { isPWAInstalled, checkPWAInstalled };
