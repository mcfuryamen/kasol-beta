/** Identity login page for the TPA portal. */
import { loginWithIdentity } from '../../services/auth.js';
import { seedDemoData } from '../../db/seed.js';

const GENERIC_LOGIN_ERROR = 'Nomor WhatsApp atau credential tidak valid.';
const DEMO_MODE = () => globalThis.__TPA_DEMO_MODE__ === true || new URLSearchParams(location.search).has('demo');

async function ensureSeed() {
  if (!DEMO_MODE()) return;
  await seedDemoData();
}

async function doLogin(event) {
  event?.preventDefault();
  const err = document.getElementById('gate-err');
  const phone = document.getElementById('gate-phone')?.value.trim() || '';
  const credential = document.getElementById('gate-credential')?.value || '';
  err.classList.add('hidden');
  try {
    await ensureSeed();
    const session = await loginWithIdentity(phone, credential);
    const target = { admin: 'admin.html', ustadz: 'guru.html', wali: 'wali.html' }[session.role];
    if (!target) throw new Error('invalid_role');
    window.location.href = target;
  } catch (error) {
    console.warn('[login] identity login rejected', error?.code || error?.message || 'unknown');
    err.textContent = GENERIC_LOGIN_ERROR;
    err.classList.remove('hidden');
  }
}

export function initLogin() {
  const form = document.getElementById('identity-login-form');
  form?.addEventListener('submit', doLogin);
  window.doLogin = doLogin;
  ensureSeed().catch(error => console.warn('[login] demo seed unavailable:', error));
}

export { GENERIC_LOGIN_ERROR, doLogin };
