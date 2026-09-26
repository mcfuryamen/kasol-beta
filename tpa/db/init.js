/**
 * TPA DB Initialization Bootstrap
 * Dijalankan di setiap halaman:
 *   1. Buka DB
 *   2. Verifikasi schema indexes
 *   3. Seed demo data kalau kosong
 *   4. Verifikasi session user
 */
import { db } from './dexie.js';
import { seedDemoData } from './seed.js';

const DB_INIT_KEY = 'tpa_db_initialized';

/**
 * Initialize database. Returns true if init succeeded.
 */
export async function initDB() {
  try {
    // Buka koneksi DB (Dexie lazy-open)
    await db.open();
    console.log('[init] Database opened:', db.name, 'v' + db.verno);

    // Seed demo data jika DB kosong
    await seedDemoData();

    // Tandai sudah di-init (per browser, per session)
    sessionStorage.setItem(DB_INIT_KEY, '1');

    return true;
  } catch (err) {
    console.error('[init] DB init failed:', err);
    return false;
  }
}

/**
 * Check if DB was already initialized this session
 */
export function isDBInitialized() {
  return sessionStorage.getItem(DB_INIT_KEY) === '1';
}

/**
 * Get current session user from localStorage
 * Format: { id, name, role, locationId, locationName, teacherId?, guardianId? }
 */
export function getSessionUser() {
  try {
    const raw = localStorage.getItem('tpa_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set session user
 */
export function setSessionUser(user) {
  localStorage.setItem('tpa_session', JSON.stringify(user));
}

/**
 * Clear session user (logout)
 */
export function clearSessionUser() {
  localStorage.removeItem('tpa_session');
}

/**
 * Get current location from session
 */
export function getSessionLocation() {
  const user = getSessionUser();
  if (!user) return null;
  return { id: user.locationId, name: user.locationName };
}

/**
 * Check if user has role
 */
export function hasRole(...roles) {
  const user = getSessionUser();
  return user && roles.includes(user.role);
}

/**
 * Require auth - redirect to login if not authenticated
 * @param {string[]} allowedRoles - roles yang boleh akses halaman ini
 */
export function requireAuth(...allowedRoles) {
  const user = getSessionUser();
  if (!user) {
    redirectToLogin();
    return false;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    redirectByRole(user.role);
    return false;
  }
  return true;
}

export function redirectToLogin() {
  window.location.href = 'login.html';
}

export function redirectByRole(role) {
  const pages = {
    admin: 'admin.html',
    ustadz: 'guru.html',
    wali: 'wali.html'
  };
  window.location.href = pages[role] || 'index.html';
}

  /**
   * Verifikasi session terhadap tabel users (cegah pemalsuan localStorage).
   * Mengembalikan user valid dari DB, atau null jika session tidak sah.
   */
  export async function verifySession() {
    const stored = getSessionUser();
    if (!stored) return null;
    try {
      const u = await db.users.get(stored.id);
      if (!u || !u.isActive) return null;
      // role & lokasi harus cocok dengan DB (tidak boleh dipalsukan)
      if (u.role !== stored.role || u.locationId !== stored.locationId) return null;
      return { id: u.id, name: u.name, role: u.role, locationId: u.locationId, locationName: stored.locationName };
    } catch (e) {
      console.warn('[auth] verifikasi session gagal:', e);
      return null;
    }
  }

/* =========================================================
   Utility functions (shared, not tied to a specific layer)
   ========================================================= */

export function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function nowLocal() {
  const d = new Date();
  return today() + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
}

export function monthLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function fd(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function fdl(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

export function fc(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

export function ini(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* =========================================================
   Enkripsi data sensitif (UU 27/2022 Pasal 35)
   - Telepon/NIS dienkripsi AES-GCM saat disimpan (at-rest)
   - Kunci disimpan di tabel settings (key 'cryptoKey')
   - Tampilan list memakai masking (tidak menampilkan penuh)
   ========================================================= */

// Masking untuk tampilan: 081234567890 -> 0812*****890
export function maskPhone(phone) {
  if (!phone) return '-';
  const p = String(phone);
  if (p.length <= 6) return p[0] + '****';
  return p.slice(0, 4) + '*****' + p.slice(-3);
}

// Masking NIS: TPA-2026-001 -> TPA-2026-***
export function maskNis(nis) {
  if (!nis) return '-';
  const s = String(nis);
  if (s.length <= 4) return '***';
  return s.slice(0, -3) + '***';
}

// Ambil atau buat kunci AES-GCM (disimpan base64 di settings)
async function getCryptoKey() {
  const row = await db.settings.get('cryptoKey');
  if (row && row.value) {
    const raw = Uint8Array.from(atob(row.value), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
  await db.settings.put({ key: 'cryptoKey', value: b64 });
  return key;
}

// Enkripsi teks -> "ivBase64:dataBase64" (atau null jika gagal)
export async function encryptText(plain) {
  if (!plain) return plain;
  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain)));
    return btoa(String.fromCharCode(...iv)) + ':' + btoa(String.fromCharCode(...new Uint8Array(enc)));
  } catch (e) {
    console.warn('[crypto] enkripsi gagal:', e);
    return plain;
  }
}

// Dekripsi teks hasil encryptText (atau kembalikan apa adanya jika bukan cipher)
export async function decryptText(cipher) {
  if (!cipher || !String(cipher).includes(':')) return cipher;
  try {
    const [ivB64, dataB64] = String(cipher).split(':');
    const key = await getCryptoKey();
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0));
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(dec);
  } catch (e) {
    console.warn('[crypto] dekripsi gagal:', e);
    return cipher;
  }
}

export function $id(id) {
  return document.getElementById(id);
}

export function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e[k] = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    });
  }
  if (children) {
    if (typeof children === 'string') e.innerHTML = children;
    else if (Array.isArray(children)) children.forEach(c => { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    else e.appendChild(children);
  }
  return e;
}

export function snack(type, message) {
  const icons = { ok: '&#10003;', err: '&#10007;', info: '&#8505;' };
  const s = el('div', {
    class: 'snack ' + type,
    html: icons[type] + ' ' + message
  });
  const wrap = $id('snacks') || document.body;
  wrap.appendChild(s);
  setTimeout(() => s.remove(), 3500);
}

export function openSheet(title, bodyContent, footerContent) {
  const bsTitle = $id('bs-title');
  const bsBody = $id('bs-body');
  const bsFoot = $id('bs-foot');
  const bs = $id('bs');
  const bsOv = $id('bs-ov');

  if (bsTitle) bsTitle.textContent = title;
  if (bsBody) {
    bsBody.innerHTML = '';
    if (typeof bodyContent === 'string') bsBody.innerHTML = bodyContent;
    else bsBody.appendChild(bodyContent);
  }
  if (bsFoot) {
    bsFoot.innerHTML = '';
    if (footerContent) {
      if (typeof footerContent === 'string') bsFoot.innerHTML = footerContent;
      else bsFoot.appendChild(footerContent);
      bsFoot.classList.remove('hidden');
    } else {
      bsFoot.classList.add('hidden');
    }
  }
  if (bsOv) bsOv.classList.add('show');
  if (bs) bs.classList.add('show');
}

export function closeSheet() {
  const bs = $id('bs');
  const bsOv = $id('bs-ov');
  if (bs) bs.classList.remove('show');
  if (bsOv) bsOv.classList.remove('show');
}

export async function delRec(table, id, label) {
  if (!confirm('Hapus ' + label + '?')) return;
  await db[table].delete(id);
  snack('ok', label + ' dihapus');
  closeSheet();
  // Trigger render callback if defined, else fallback ke render() global
  if (typeof window._renderCallback === 'function') window._renderCallback();
  else if (typeof window.render === 'function') window.render();
}

export function setRenderCallback(fn) {
  window._renderCallback = fn;
}

export function clearRenderCallback() {
  window._renderCallback = null;
}

/**
 * Catat aktivitas pemrosesan data ke audit log (UU 27/2022 Pasal 31).
 * Dipanggil pada operasi create/update/delete data pribadi.
 * @param {string} action  - 'create' | 'update' | 'delete' | 'export' | 'consent' | 'access'
 * @param {string} entity  - nama entitas, mis. 'students', 'guardians'
 * @param {number|string} [entityId] - id record
 * @param {string} [detail] - keterangan tambahan
 */
export async function logAudit(action, entity, entityId, detail) {
  try {
    const user = getSessionUser();
    await db.auditLog.add({
      locationId: user?.locationId || null,
      userId: user?.id || null,
      userRole: user?.role || 'system',
      action,
      entity,
      entityId: entityId ?? null,
      detail: detail || '',
      createdAt: nowLocal()
    });
  } catch (e) {
    console.warn('[audit] gagal mencatat:', e);
  }
}
