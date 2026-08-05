// ==================== PWA SUPPORT (ESM) ====================
import { showToast } from './helpers.js';

let deferredPrompt = null;

// Generate manifest blob URL with icon
export async function setupPWA() {
  let iconSrc = 'assets/icon.png';
  try {
    const res = await fetch('assets/icon.png');
    const blob = await res.blob();
    iconSrc = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  } catch(e) { console.warn('[PWA] icon fetch failed, using path', e.message); }

  // Create manifest
  const manifest = {
    name: 'Kasir Solo - Kaki Lima',
    short_name: 'Kasir Solo',
    description: 'Aplikasi kasir gratis untuk pedagang kaki lima',
    start_url: './',
    display: 'standalone',
    orientation: 'any',
    background_color: '#FFFAF5',
    theme_color: '#E65100',
    icons: [
      { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: iconSrc, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  };

  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const manifestUrl = URL.createObjectURL(manifestBlob);
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = manifestUrl;
  document.head.appendChild(manifestLink);

  // Register Service Worker (external file for proper browser support)
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
