/**
 * Admin Marketing KASIRSOLO — Main Entry Point
 * Bootstraps all modules
 */

import { initState, STATE } from './app-state.js';
import { storage } from './storage.js';
import { initAuth } from './auth.js';
import { initNavigation, getCurrentScreen } from './navigation.js?v=20260812i';
import { initDashboard } from './dashboard.js';
import { initCatalog } from './catalog.js';
import { initSettings } from './settings.js';
import { initClients } from './clients.js?v=20260813a';
import { initToast } from './toast.js';
import { showToast } from './toast.js';
import './emoji-picker.js'; // side-effect: men-wire window.showEmojiPicker/hideEmojiPicker/pickEmoji
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
    initNavigation();

    // Initialize state from storage
    await initState(storage);

    // Initialize feature modules
    initDashboard();
    initCatalog();
    initSettings();
    initClients();

    // Listen for screen changes to trigger specific renders if needed
    window.addEventListener('screen:change', (e) => {
      const { screen, clientView } = e.detail;
      if (screen === 'klien' && clientView) {
        window.switchClientView(clientView);
      }
      console.log('Screen changed to:', screen, clientView ? `(view: ${clientView})` : '');
    });

    // Listen for app:ready (after login)
    window.addEventListener('app:ready', () => {
      // All modules already initialized, they'll render on state change
      showToast('Dashboard siap', 1500, 'success');
    });

    console.log('✅ Admin Marketing KASIRSOLO initialized');
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
  const fn = screen === 'klien' ? window.refreshClients
    : screen === 'catalog' ? window.refreshCatalog
    : screen === 'dashboard' ? window.refreshDashboard
    : null;
  if (fn) { Promise.resolve(fn()).finally(done); }
  else { window.location.reload(); }
};

// Start the app
bootstrap();

// Export for debugging
window.AdminApp = { STATE, storage };