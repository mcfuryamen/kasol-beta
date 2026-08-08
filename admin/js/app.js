/**
 * Admin Marketing KASIRSOLO — Main Entry Point
 * Bootstraps all modules
 */

import { initState, STATE } from './app-state.js';
import { storage } from './storage.js';
import { initAuth } from './auth.js';
import { initNavigation } from './navigation.js';
import { initDashboard } from './dashboard.js';
import { initCatalog } from './catalog.js';
import { initSettings } from './settings.js';
import { initLicense } from './license-ui.js';
import { initClients } from './clients.js';
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
    initLicense();
    initClients();

    // Listen for screen changes to trigger specific renders if needed
    window.addEventListener('screen:change', (e) => {
      const { screen } = e.detail;
      // Modules subscribe to state changes, so they auto-render
      // But we can trigger specific actions here if needed
      console.log('Screen changed to:', screen);
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

// Start the app
bootstrap();

// Export for debugging
window.AdminApp = { STATE, storage };