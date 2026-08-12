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

  if (!loginScreen || !appEl) {
    console.warn('Auth elements not found');
    return;
  }

  loginBtn?.addEventListener('click', doLogin);
  loginPass?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  logoutBtn?.addEventListener('click', doLogout);

  // CHECKPOINT: Login page di-bypass (user request "skip, jangan ditampilin").
  // Modul kredensial (auth/login proper + JWT admin) ditunda — lihat audit-admin-kasirsolo.md (BACKLOG).
  // Saat modul kredensial dikerjakan, aktifkan lagi showLoginScreen() di bawah.
  showApp();
}

/**
 * Show login screen
 */
export function showLoginScreen() {
  loginScreen.style.display = 'flex';
  appEl.classList.remove('show');
  loginPass.value = '';
  loginError.style.display = 'none';
  loginPass.focus();
}

/**
 * Show app (after successful login)
 */
export function showApp() {
  loginScreen.style.display = 'none';
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
  showToast('Login sementara di-bypass', 2000, 'info');
}

/**
 * Check if user is logged in
 * @returns {boolean}
 */
export function isLoggedIn() {
  return appEl?.classList.contains('show') ?? false;
}