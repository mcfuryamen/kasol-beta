/**
 * Admin Marketing KASIRSOLO — Auth Module
 * Login/logout, session management
 *
 * CATATAN: Login sengaja dinonaktifkan — dashboard langsung terbuka.
 * Rencana upgrade: Supabase Auth / JWT admin (JWT_SECRET sudah disiapkan di env)
 * supaya ADMIN_API_KEY tidak perlu lagi dikirim dari browser.
 */

import { showToast } from './toast.js';

let appEl = null;
let logoutBtn = null;

/**
 * Initialize auth module
 */
export function initAuth() {
  appEl = document.getElementById('app');
  logoutBtn = document.getElementById('logoutBtn');

  if (!appEl) {
    console.warn('Admin app shell not found');
    return;
  }

  logoutBtn?.addEventListener('click', doLogout);
  showApp();
}

/**
 * Show app — login di-bypass sampai auth beneran diimplementasi.
 */
function showApp() {
  appEl.classList.add('show');
  // Dispatch event for other modules to initialize
  window.dispatchEvent(new CustomEvent('app:ready'));
}

/**
 * Handle logout
 * NOTE: Login di-bypass, jadi logout tidak kembali ke layar login.
 */
function doLogout() {
  showToast('Login belum aktif — dashboard tetap terbuka', 2000, 'info');
}
