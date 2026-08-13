/**
 * Admin Marketing KASIRSOLO — Auth Module
 * Login/logout, session management
 */

import { showToast } from './toast.js';

let loginScreen = null;
let appEl = null;
let loginPass = null;
let loginBtn = null;
let loginError = null;
let logoutBtn = null;

/**
 * Initialize auth module
 */
export function initAuth() {
  loginScreen = document.getElementById('loginScreen');
  appEl = document.getElementById('app');
  loginPass = document.getElementById('loginPass');
  loginBtn = document.getElementById('loginBtn');
  loginError = document.getElementById('loginError');
  logoutBtn = document.getElementById('logoutBtn');

  if (!appEl) {
    console.warn('Admin app shell not found');
    return;
  }

  // Login sengaja dinonaktifkan: dashboard selalu langsung tersedia.
  // Jangan aktifkan showLoginScreen() tanpa permintaan eksplisit pengguna.
  logoutBtn?.addEventListener('click', doLogout);
  showApp();
}

/**
 * Show login screen
 */
export function showLoginScreen() {
  if (!loginScreen) return;
  loginScreen.hidden = true;
  loginScreen.style.display = 'none';
  loginScreen.setAttribute('aria-hidden', 'true');
  showApp();
}

/**
 * Show app (after successful login)
 */
export function showApp() {
  if (loginScreen) {
    loginScreen.hidden = true;
    loginScreen.style.display = 'none';
    loginScreen.setAttribute('aria-hidden', 'true');
  }
  appEl.classList.add('show');
  // Dispatch event for other modules to initialize
  window.dispatchEvent(new CustomEvent('app:ready'));
}

/**
 * Handle login
 */
function doLogin() {
  const val = loginPass?.value || '';

  // TODO: Replace with env variable / Supabase Auth
  // For now, hardcoded demo password
  if (val === 'admin123') {
    showApp();
    showToast('Selamat datang!', 2000, 'success');
  } else {
    loginError.style.display = 'block';
    loginPass.focus();
    loginPass.select();
  }
}

/**
 * Handle logout
 * NOTE: Login di-bypass, jadi logout tidak kembali ke layar login.
 */
function doLogout() {
  showApp();
  showToast('Dashboard tetap terbuka', 2000, 'info');
}

/**
 * Check if user is logged in
 * @returns {boolean}
 */
export function isLoggedIn() {
  return appEl?.classList.contains('show') ?? false;
}