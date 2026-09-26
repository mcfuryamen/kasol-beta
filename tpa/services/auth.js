/**
 * Auth Service
 * Login demo & session management
 */
import { db } from '../db/dexie.js';
import { setSessionUser, getSessionUser, clearSessionUser } from '../db/init.js';

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

/** Logout */
export function logout() {
  clearSessionUser();
  window.location.href = 'index.html';
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
