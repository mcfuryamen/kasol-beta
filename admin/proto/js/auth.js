/**
 * Admin Marketing KASIRSOLO — Auth Module
 * Handles login/logout for admin dashboard
 */

import { getState, setState, subscribe, schedulePersist } from './app-state.js';

const ADMIN_PASSWORD = 'admin123'; // Hardcoded for now - TODO: Supabase Auth

export async function initAuth() {
  const loginScreen = document.getElementById('loginScreen');
  const app = document.getElementById('app');
  const loginBtn = document.getElementById('loginBtn');
  const loginPass = document.getElementById('loginPass');
  const loginError = document.getElementById('loginError');

  // Check if already logged in
  if (getState('isLoggedIn')) {
    showApp();
    return;
  }

  // Login handler
  async function handleLogin() {
    const pass = loginPass.value.trim();
    if (pass === ADMIN_PASSWORD) {
      setState('isLoggedIn', true);
      setState('loginTime', Date.now());
      loginError.hidden = true;
      loginPass.value = '';
      showApp();
      // Initialize other modules after login
      window.dispatchEvent(new CustomEvent('auth:login'));
    } else {
      loginError.hidden = false;
      loginPass.value = '';
      loginPass.focus();
    }
  }

  loginBtn.addEventListener('click', handleLogin);
  loginPass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Auto-focus password field
  setTimeout(() => loginPass.focus(), 300);
}

function showApp() {
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('app').hidden = false;
  setState('isLoggedIn', true);
  schedulePersist();
}

export function logout() {
  setState('isLoggedIn', false);
  setState('loginTime', null);
  document.getElementById('loginScreen').hidden = false;
  document.getElementById('app').hidden = true;
  document.getElementById('loginPass').focus();
  schedulePersist();
}

// Export for global access
window.logout = logout;