/**
 * Admin Marketing KASIRSOLO — Main Entry Point
 * Initializes all modules and handles app lifecycle
 */

import { initState, getState, setState, subscribe } from './app-state.js';
import { getDB, seedIfEmpty } from './storage.js';
import { initAuth } from './auth.js';
import { initNavigation } from './navigation.js';
import { initDashboard } from './dashboard.js';
import { initCatalog } from './catalog.js';
import { initLicense } from './license-ui.js';
import { initClients } from './clients.js';
import { initLeads } from './leads.js';
import { initSettings } from './settings.js';
import { showToast } from './toast.js';

// Initialize app
async function initApp() {
  try {
    // Initialize IndexedDB
    await getDB();
    await seedIfEmpty();

    // Initialize app state
    initState();

    // Initialize auth (shows login if needed)
    await initAuth();

    // Initialize navigation
    initNavigation();

    // Initialize all screen modules
    await Promise.all([
      initDashboard(),
      initCatalog(),
      initLicense(),
      initClients(),
      initLeads(),
      initSettings()
    ]);

    // Check if logged in and show app
    if (getState('isLoggedIn')) {
      document.getElementById('loginScreen').hidden = true;
      document.getElementById('app').hidden = false;
    }

    console.log('[Admin] App initialized successfully');
    showToast('🎉 Admin dashboard siap', 2000, 'success');
  } catch (e) {
    console.error('[Admin] Init failed:', e);
    showToast('❌ Gagal memuat aplikasi', 3000, 'error');
  }
}

// Global helpers
window.closeSheet = function(sheetId) {
  const sheet = document.getElementById(sheetId);
  if (sheet) sheet.classList.remove('open');
};

window.openLicenseSheet = function() {
  // Navigate to license screen
  const navItem = document.querySelector('[data-screen="license"]');
  if (navItem) navItem.click();
};

// Service Worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('[SW] Registered:', reg.scope))
    .catch(err => console.warn('[SW] Registration failed:', err));
}

// Start app
initApp();

// Handle visibility change for auto-refresh
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && getState('isLoggedIn')) {
    window.dispatchEvent(new CustomEvent('screen:change', { detail: { screen: getState('currentScreen') || 'dashboard' } }));
  }
});