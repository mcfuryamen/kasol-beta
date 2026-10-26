import { createIdentityAdapter } from './adapter.js';
import { validateAppSession } from './contract.js';

const SESSION_KEY = 'tpa_identity_session';
const ACTIVITY_KEY = 'tpa_identity_last_activity';
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function nowMs() { return Date.now(); }
function touchActivity() { localStorage.setItem(ACTIVITY_KEY, String(nowMs())); }
function idleExpired(timeoutMs) {
  const raw = localStorage.getItem(ACTIVITY_KEY);
  if (!raw) return false;
  const last = Number(raw);
  return !Number.isFinite(last) || nowMs() - last > timeoutMs;
}

export function touchIdentitySession() { touchActivity(); }

function readStored() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setIdentitySession(session) {
  const canonical = validateAppSession(session);
  localStorage.setItem(SESSION_KEY, JSON.stringify(canonical));
  touchActivity();
  return canonical;
}

export function getIdentitySession() { return readStored(); }
export function clearIdentitySession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ACTIVITY_KEY);
}

export async function verifyIdentitySession(adapter = createIdentityAdapter(), { idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS } = {}) {
  const stored = readStored();
  if (!stored?.appSessionId) return null;
  if (idleExpired(idleTimeoutMs)) {
    clearIdentitySession();
    try { await adapter.revokeSession(stored.appSessionId); } catch {}
    return null;
  }
  try {
    const verified = validateAppSession(await adapter.verifySession(stored.appSessionId));
    setIdentitySession(verified);
    return verified;
  } catch (error) {
    clearIdentitySession();
    return null;
  }
}

export async function revokeIdentitySession(adapter = createIdentityAdapter()) {
  const stored = readStored();
  try {
    if (stored?.appSessionId) await adapter.revokeSession(stored.appSessionId);
  } finally {
    clearIdentitySession();
  }
}
