/**
 * Auth Service
 * Login demo & session management
 */
import { db } from '../db/dexie.js';
import { setSessionUser, getSessionUser, clearSessionUser } from '../db/init.js';
import { createIdentityAdapter } from './identity/adapter.js';
import { getIdentitySession, setIdentitySession, revokeIdentitySession } from './identity/session.js';

function getSupabaseClient() {
  const client = globalThis.__TPA_SUPABASE_CLIENT__;
  if (!client) throw new Error('SUPABASE_NOT_READY');
  return client;
}

function mapRole(role) {
  return ({ owner: 'admin', admin: 'admin', manager: 'admin', stock: 'ustadz', ustadz: 'ustadz', teacher: 'ustadz', wali: 'wali', guardian: 'wali' })[role] || null;
}

function getIdentityAdapter() {
  return globalThis.__TPA_IDENTITY_ADAPTER__ || createIdentityAdapter();
}

export const GENERIC_LOGIN_ERROR = 'Nomor WhatsApp atau credential tidak valid.';
export const GENERIC_RECOVERY_MESSAGE = 'Jika akun cocok, instruksi pemulihan akan diproses.';

// ─── Throttle klien untuk login gagal (jalur Supabase langsung) ────────────
// Hitung kegagalan berturut per nomor HP di localStorage; setelah >=3 gagal
// berlaku backoff 2^n x 2 detik (cap 30 detik), reset saat sukses. Ini hanya
// memperlambat brute-force dari klien ini — bukan kontrol keamanan server.
const LOGIN_BACKOFF_KEY = 'tpa_login_backoff';
const LOGIN_BACKOFF_THRESHOLD = 3;
const LOGIN_BACKOFF_BASE_MS = 2 * 1000;
const LOGIN_BACKOFF_CAP_MS = 30 * 1000;

function readLoginBackoff() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOGIN_BACKOFF_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function writeLoginBackoff(phone, entry) {
  try {
    const store = readLoginBackoff();
    if (entry) store[phone] = entry;
    else delete store[phone];
    localStorage.setItem(LOGIN_BACKOFF_KEY, JSON.stringify(store));
  } catch { /* localStorage tidak tersedia: throttle best-effort saja */ }
}

function loginBackoffRemainingMs(phone) {
  const entry = readLoginBackoff()[phone];
  if (!entry || typeof entry.lockedUntil !== 'number') return 0;
  return Math.max(0, entry.lockedUntil - Date.now());
}

function recordLoginFailure(phone) {
  const count = (readLoginBackoff()[phone]?.count || 0) + 1;
  const backoffMs = Math.min(LOGIN_BACKOFF_CAP_MS, LOGIN_BACKOFF_BASE_MS * 2 ** count);
  writeLoginBackoff(phone, { count, lockedUntil: count >= LOGIN_BACKOFF_THRESHOLD ? Date.now() + backoffMs : 0 });
}

function resetLoginBackoff(phone) {
  writeLoginBackoff(phone, null);
}

export async function requestIdentityRecovery(phone, adapter = getIdentityAdapter()) {
  return adapter.requestRecovery(phone);
}

export async function approveIdentityRecovery(challengeId, adapter = getIdentityAdapter()) {
  return adapter.approveRecovery(challengeId);
}

export async function completeIdentityRecovery(challengeId, approvalToken, newCredential, adapter = getIdentityAdapter()) {
  const result = await adapter.completeRecovery(challengeId, approvalToken, newCredential);
  clearSessionUser();
  try { await revokeIdentitySession(adapter); } catch { /* old session may already be revoked server-side */ }
  return result;
}

async function recordSecurityEvent(adapter, event) {
  try { await adapter.recordSecurityEvent(event); } catch (error) {
    if (error?.code !== 'IDENTITY_PROVIDER_NOT_CONFIGURED') console.warn('[auth] security event gagal:', error);
  }
}

async function loginWithIdentityAdapter(phone, credential, adapter) {
  let identity = null;
  try {
    identity = await adapter.resolveIdentity(phone);
    const verified = await adapter.verifyCredential(identity.globalIdentityId, credential);
    const memberships = (await adapter.listMemberships(verified.globalIdentityId, 'tpa')).filter(m => m.membership?.status === 'active' && m.membership?.appKey === 'tpa');
    if (memberships.length !== 1) throw new Error('ambiguous_or_missing_membership');
    const selected = memberships[0];
    const session = await adapter.createAppSession(selected.membership.membershipId);
    const link = (selected.subjectLinks || [])[0] || {};
    // Struktur listMemberships ({ membership, subjectLinks }) tidak membawa
    // legacyUserId, jadi id kompatibilitas memakai membershipId session.
    const compatibility = { id: session.membershipId, name: identity.displayName, role: session.role, locationId: session.locationId, locationName: '', globalIdentityId: session.globalIdentityId, membershipId: session.membershipId, appSessionId: session.appSessionId, expiresAt: session.expiresAt, ...(link.subjectType === 'teacher' ? { teacherId: link.subjectId } : {}), ...(link.subjectType === 'guardian' ? { guardianId: link.subjectId } : {}) };
    setSessionUser(compatibility);
    setIdentitySession(session);
    return session;
  } catch (error) {
    await recordSecurityEvent(adapter, { identityId: identity?.globalIdentityId || null, eventType: 'login_failure', success: false, metadataRedacted: { reason: error?.code || 'login_failed' } });
    throw error;
  }
}

/**
 * Batas keamanan sesungguhnya adalah rate limit Supabase Auth di dashboard
 * (dianjurkan diperketat); throttle klien di bawah hanya lapisan tambahan.
 * Kelemahan desain yang diketahui: email sintetis dibentuk deterministik dari
 * nomor HP, sehingga nomor memprediksi identifier login.
 */
export async function loginWithIdentity(phone, credential, adapter = null) {
  if (adapter || globalThis.__TPA_IDENTITY_ADAPTER__) return loginWithIdentityAdapter(phone, credential, adapter || getIdentityAdapter());
  const client = await getSupabaseClient();
  const normalized = String(phone || '').replace(/[^0-9+]/g, '').replace(/^0/, '+62');
  const email = normalized.includes('@') ? normalized : `${normalized.replace(/[^0-9]/g, '')}@accounts.kasirsolo.local`;
  // Cek sisa backoff sebelum signInWithPassword; pesan & code disamakan dengan
  // credential salah agar UI tidak bisa membedakan (tidak membocorkan state).
  const remainingMs = loginBackoffRemainingMs(normalized);
  if (remainingMs > 0) {
    throw Object.assign(new Error(GENERIC_LOGIN_ERROR), { code: 'AUTH_INVALID_CREDENTIALS', retryAfterMs: remainingMs });
  }
  const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password: credential });
  if (authError || !authData?.user) {
    recordLoginFailure(normalized);
    throw Object.assign(new Error(GENERIC_LOGIN_ERROR), { code: 'AUTH_INVALID_CREDENTIALS' });
  }
  resetLoginBackoff(normalized);

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id,name,email,phone,phone_e164,is_active')
    .eq('id', authData.user.id)
    .maybeSingle();
  const { data: memberships, error: membershipError } = await client
    .from('tpa_memberships')
    .select('id,location_id,role,teacher_id,guardian_id,is_active,tpa_locations(id,name)')
    .eq('user_id', authData.user.id)
    .eq('is_active', true);
  if (profileError || membershipError || !profile || profile.is_active === false || memberships?.length !== 1) {
    await client.auth.signOut();
    throw Object.assign(new Error(GENERIC_LOGIN_ERROR), { code: 'AUTH_MEMBERSHIP_INVALID' });
  }

  const membership = memberships[0];
  const role = membership.role;
  const location = Array.isArray(membership.tpa_locations) ? membership.tpa_locations[0] : membership.tpa_locations;
  const compatibility = {
    id: profile.id,
    name: profile.name || profile.email || 'Pengguna',
    role,
    phone: profile.phone_e164 || profile.phone || normalized,
    locationId: membership.location_id,
    locationName: location?.name || '',
    teacherId: membership.teacher_id || undefined,
    guardianId: membership.guardian_id || undefined,
    globalIdentityId: profile.id,
    authUserId: authData.user.id,
    membershipId: membership.id,
    expiresAt: authData.session?.expires_at ? new Date(authData.session.expires_at * 1000).toISOString() : null
  };
  setSessionUser(compatibility);
  return compatibility;
}

/** Demo login - cari user berdasarkan role */
export async function demoLogin(role) {
  const locationId = await db.locations.toCollection().first().then(l => l ? l.id : null);
  if (!locationId) throw new Error('Tidak ada lokasi. Jalankan seed dulu.');

  const user = await db.users
    .where('locationId').equals(locationId)
    .and(u => u.role === role && u.isActive)
    .first();

  if (!user) throw new Error('User role "' + role + '" tidak ditemukan');

  // Attach teacherId / guardianId dari relasi
  let teacherId = null, guardianId = null, teacherName = null, guardianName = null;
  if (role === 'ustadz') {
    const t = await db.teachers.get(user.teacherId);
    if (t) { teacherId = t.id; teacherName = t.name; }
  }
  if (role === 'wali') {
    const g = await db.guardians.get(user.guardianId);
    if (g) { guardianId = g.id; guardianName = g.name; }
  }

  const location = await db.locations.get(locationId);
  const sessionUser = {
    id: user.id,
    name: user.name,
    role: user.role,
    locationId,
    locationName: location ? location.name : '?',
    teacherId,
    teacherName,
    guardianId,
    guardianName
  };

  setSessionUser(sessionUser);
  return sessionUser;
}

/** Get user yang sedang login */
export function getCurrentUser() {
  return getSessionUser();
}

/** Logout universal identity session jika tersedia, lalu bersihkan compatibility session. */
export async function logout() {
  try {
    const client = await getSupabaseClient();
    await client.auth.signOut();
  } catch (error) {
    console.warn('[auth] Supabase signOut gagal:', error);
  } finally {
    clearSessionUser();
    try { await revokeIdentitySession(getIdentityAdapter()); } catch (error) { console.warn('[auth] revoke identity session gagal:', error); }
    window.location.href = 'index.html';
  }
}

/** Verifikasi app session identity; provider belum dikonfigurasi pada beta ini. */
export async function verifyIdentityAppSession() {
  const session = getIdentitySession();
  if (!session) return null;
  // Adapter diambil saat dipanggil (bukan konstanta module-level) supaya
  // tidak tertangkap sebelum bootstrap sebagai NotConfiguredIdentityAdapter.
  return getIdentityAdapter().verifySession(session.appSessionId);
}

/** Cek sudah login */
export function isLoggedIn() {
  return !!getSessionUser();
}

/** Cek role */
export function hasRole(...roles) {
  const u = getSessionUser();
  return u && roles.includes(u.role);
}

/** Redirect jika belum login */
export function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

/** Redirect jika role tidak sesuai */
export function requireRole(...roles) {
  if (!requireLogin()) return false;
  if (!hasRole(...roles)) {
    const u = getSessionUser();
    // Redirect ke halaman sesuai role
    const pages = { admin: 'admin.html', ustadz: 'guru.html', wali: 'wali.html' };
    window.location.href = pages[u.role] || 'index.html';
    return false;
  }
  return true;
}
