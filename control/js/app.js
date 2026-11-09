/**
 * Control Center Kasir Solo — Main Entry Point
 * Bootstraps all modules
 */

import { initState, STATE } from './app-state.js';
import { storage } from './storage.js';
import { initAuth } from './auth.js';
import { initNavigation, getCurrentScreen } from './navigation.js';
import { initDashboard } from './dashboard.js';
import { initCatalog } from './catalog.js';
import { initContent } from './content.js';
import { initSettings } from './settings.js';
import { initOutreach } from './outreach.js';
import { initAgents } from './agents.js';
import { initKalender } from './kalender.js';
import { initGrowup } from './growup.js'; // Grow Up = Sosmed + Kalender Konten merged (2026-10-28)
import { initCrm } from './crm.js'; // CRM = Klien + Mitra merged (2026-10-28)
import './crm-whatsapp.js'; // side-effect: CRM client/partner WhatsApp composer
import { initToast } from './toast.js';
import { showToast } from './toast.js';
import './emoji-picker.js'; // side-effect: men-wire window.showEmojiPicker/hideEmojiPicker/pickEmoji
import './sosmed.js'; // side-effect: antrian posting Facebook (tab 'social' di Grow Up)
import './overlay-a11y.js'; // side-effect: fokus trap + Esc + restorasi fokus utk SEMUA sheet

// Global error handling
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  showToast('Terjadi error: ' + (e.error?.message || 'Unknown'), 3000, 'error');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
  showToast('Error: ' + (e.reason?.message || 'Unknown'), 3000, 'error');
});

/**
 * Initialize the application
 */
async function bootstrap() {
  try {
    // Initialize toast first (used by other modules)
    initToast();

    // Initialize auth (shows login gate)
    initAuth();

    // Initialize navigation (sidebar, tabs)
    initNavigation({ processInitialHash: false });

    // Initialize state from storage
    await initState(storage);

    // Initialize feature modules
    initDashboard();
    initCatalog();
    initContent();
    initSettings();
    initOutreach();
    initAgents();
    initKalender();
    initGrowup(); // shell tab Grow Up (Sosmed + Kalender Konten)
    initCrm(); // bootstrap CRM = initClients + initPartnersTab + initCrmContacts

    // Process the initial hash after merged tab APIs are registered.
    window.handleInitialNavigation?.();

    // Listen for app:ready (after login)
    window.addEventListener('app:ready', () => {
      // All modules already initialized, they'll render on state change
      showToast('Dashboard siap', 1500, 'success');
    });

    console.log('✅ Control Center Kasir Solo initialized');
  } catch (error) {
    console.error('Bootstrap failed:', error);
    showToast('Gagal memulai aplikasi', 3000, 'error');
  }
}

/**
 * Smart refresh: muat ulang data sesuai halaman yang sedang aktif.
 * Dipanggil dari tombol ⟳ di topbar (semua modul).
 */
window.refreshCurrentScreen = function () {
  const screen = getCurrentScreen();
  const btn = document.getElementById('refreshBtn');
  const prev = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳'; }
  const done = () => { if (btn) { btn.disabled = false; btn.innerHTML = prev; } };
  // CRM = refresh keempat tab sekaligus; 'klien'/'mitra' = legacy map (biar
  // tidak error walau dipanggil dari kode lama). 'outreach' kini tab CRM —
  // switchScreen mengarahkannya ke 'crm', jadi tak perlu entri sendiri.
  // Grow Up = refresh kedua tab (Sosmed + Kalender Konten); 'social'/'kalender'
  // legacy juga diarahkan switchScreen ke 'growup'.
  const fn = screen === 'crm' ? () => Promise.allSettled([
      window.refreshContacts?.(), window.refreshClients?.(), window.refreshPartners?.(), window.refreshOutreach?.()
    ])
    : screen === 'growup' ? () => Promise.allSettled([
      window.refreshSocial?.(), window.refreshKalender?.()
    ])
    : screen === 'klien' ? window.refreshClients
    : screen === 'agents' ? window.refreshAgents
    : screen === 'catalog' ? window.refreshCatalog
    : screen === 'dashboard' ? window.refreshDashboard
    : screen === 'mitra' ? window.refreshPartners
    : null;
  if (fn) { Promise.resolve(fn()).finally(done); }
  else { window.location.reload(); }
};

// Start the app
bootstrap();

// PWA: daftarkan service worker (mode offline). sw.js pakai strategi
// network-first, jadi update app tidak pernah tertahan cache lama.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

// Export for debugging
window.AdminApp = { STATE, storage };

/**
 * Sheet & overlay utilities (global)
 */
window.openSheet = function(sheetId) {
  const overlay = document.getElementById(sheetId);
  if (overlay) {
    overlay.classList.add('open');
    overlay.style.display = 'flex';
  }
};

window.closeSheet = function(sheetId) {
  const overlay = document.getElementById(sheetId);
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => { overlay.style.display = 'none'; }, 280); // wait for animation
  }
};

window.openMoreMenu = function() {
  window.openSheet('sheetMoreMenu');
};

window.switchScreen = function(screen, clientView) {
  // Import switchScreen from navigation module
  import('./navigation.js').then(({ switchScreen: switchScreenFn }) => {
    switchScreenFn(screen, clientView);
  });
};

/**
 * Universal data-action dispatcher
 * Wiring untuk button/element dengan data-action attribute
 */
window.dispatchAction = function(actionName, target, event) {
  const handlers = {
    closeAgentDraft: () => {
      window.closeSheet('sheetAgentDraft');
    },
    closeAgentDraftOnBackdrop: (target, evt) => {
      // Close hanya jika click di overlay backdrop, bukan di sheet content
      if (evt && evt.target === target) {
        window.closeSheet('sheetAgentDraft');
      }
    }
  };

  const handler = handlers[actionName];
  if (handler) {
    handler(target, event);
  } else {
    console.warn('Unknown action:', actionName);
  }
};

/**
 * Setup event delegation untuk data-action
 */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) {
    const action = el.dataset.action;
    window.dispatchAction(action, el, e);
  }
});