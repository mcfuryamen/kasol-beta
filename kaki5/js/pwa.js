// ==================== PWA SUPPORT (ESM) ====================
import { showToast } from './helpers.js';

let deferredPrompt = null;

// Generate manifest blob URL with icon
export function setupPWA() {
  // Manifest disediakan sebagai file statis (manifest.json) yang direferensikan
  // di index.html via <link rel="manifest">. Browser TIDAK menerima manifest dari
  // blob: URL untuk persyaratan installability, jadi jangan dibangun dinamis.
  // Cukup daftarkan Service Worker (file eksternal, cache-first).
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
      console.log('[SW] Registered, scope:', reg.scope);
    }).catch(err => {
      console.warn('[SW] Registration failed:', err.message);
    });
  }
}

export function showInstallBanner() {
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
    showToast('🎉 App berhasil dipasang!');
  }
  deferredPrompt = null;
  const banner = document.getElementById('installBanner');
  if (banner) banner.remove();
}

// Module-level global listeners (run once on import)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  showToast('🎉 Kasir Solo sudah terpasang!');
  deferredPrompt = null;
});
