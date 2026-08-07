/**
 * Admin Marketing KASIRSOLO — Storage Abstraction
 * Interface untuk localStorage (browser normal) DAN window.storage (lingkungan host seperti Hermes).
 * Semua module UI pakai ini — swap implementasi tanpa sentuh UI.
 *
 * Prioritas backend:
 *   1. window.storage  (environment yang inject storage khusus, mis. Hermes WebUI)
 *   2. window.localStorage (browser produksi standar)
 * Semua method return Promise agar kompatibel dengan swap Supabase di masa depan.
 */

const STORAGE_PREFIX = 'kasirsolo:';
const LICENSE_PRODUCTS_KEY = 'kasirsolo_license_products_v3';

/**
 * Cek backend window.storage (khusus environment host)
 */
function hasNativeStorage() {
  return typeof window !== 'undefined' && !!window.storage;
}

/**
 * Cek backend localStorage (browser standar)
 */
function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/**
 * Parse JSON dengan aman
 */
function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Baca nilai mentah (string) dari backend mana pun yang tersedia
 * @returns {string|null}
 */
async function readRaw(fullKey) {
  if (hasNativeStorage()) {
    const res = await window.storage.get(fullKey, true);
    return res && res.value != null ? res.value : null;
  }
  if (hasLocalStorage()) {
    return window.localStorage.getItem(fullKey);
  }
  return null;
}

/**
 * Tulis nilai mentah (string) ke backend yang tersedia
 * @returns {boolean}
 */
async function writeRaw(fullKey, value) {
  if (hasNativeStorage()) {
    await window.storage.set(fullKey, value, true);
    return true;
  }
  if (hasLocalStorage()) {
    window.localStorage.setItem(fullKey, value);
    return true;
  }
  return false;
}

/**
 * Hapus nilai mentah dari backend yang tersedia
 */
async function deleteRaw(fullKey) {
  if (hasNativeStorage()) {
    await window.storage.remove(fullKey, true);
    return;
  }
  if (hasLocalStorage()) {
    window.localStorage.removeItem(fullKey);
  }
}

/**
 * Storage abstraction interface
 * Semua method return Promises untuk kompatibilitas Supabase di masa depan
 */
export const storage = {
  /**
   * Get a value by key (tanpa prefix). Fallback: nilai default.
   * @param {string} key
   * @param {*} fallback
   */
  async get(key, fallback = null) {
    try {
      const raw = await readRaw(STORAGE_PREFIX + key);
      if (raw == null) return fallback;
      return safeParse(raw, fallback);
    } catch (error) {
      console.warn(`Storage get failed for ${key}:`, error);
      return fallback;
    }
  },

  /**
   * Set a value by key (akan di-JSON-stringify).
   * @returns {boolean}
   */
  async set(key, value) {
    try {
      return await writeRaw(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.error(`Storage set failed for ${key}:`, error);
      return false;
    }
  },

  /**
   * Get license products (storage key terpisah)
   */
  async getLicenseProducts() {
    try {
      const raw = await readRaw(LICENSE_PRODUCTS_KEY);
      if (raw == null) return null;
      return safeParse(raw, null);
    } catch (error) {
      console.warn('Storage getLicenseProducts failed:', error);
      return null;
    }
  },

  /**
   * Set license products
   */
  async setLicenseProducts(products) {
    try {
      return await writeRaw(LICENSE_PRODUCTS_KEY, JSON.stringify(products));
    } catch (error) {
      console.error('Storage setLicenseProducts failed:', error);
      return false;
    }
  },

  /**
   * Subscribe ke perubahan storage lintas-tab (localStorage). Return unsubscribe fn.
   * @param {string} key - Key tanpa prefix
   * @param {Function} callback - Dipanggil dengan nilai baru
   */
  subscribe(key, callback) {
    if (typeof window === 'undefined') return () => {};
    const fullKey = STORAGE_PREFIX + key;
    const handler = (event) => {
      if (event.key === fullKey && event.newValue !== null) {
        try {
          callback(safeParse(event.newValue));
        } catch (e) {
          console.warn('Storage event parse failed:', e);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  },

  /**
   * Subscribe ke perubahan license products
   */
  subscribeLicenseProducts(callback) {
    if (typeof window === 'undefined') return () => {};
    const handler = (event) => {
      if (event.key === LICENSE_PRODUCTS_KEY && event.newValue !== null) {
        try {
          callback(safeParse(event.newValue));
        } catch (e) {
          console.warn('License products event parse failed:', e);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  },

  /**
   * Clear semua data app (untuk testing/logout)
   */
  async clearAll() {
    const keys = ['catalog', 'settings', 'leads', 'stats'];
    try {
      for (const k of keys) await deleteRaw(STORAGE_PREFIX + k);
      await deleteRaw(LICENSE_PRODUCTS_KEY);
      return true;
    } catch (error) {
      console.error('Storage clearAll failed:', error);
      return false;
    }
  },

  /**
   * Cek apakah ada backend storage yang tersedia
   */
  isAvailable() {
    return hasNativeStorage() || hasLocalStorage();
  }
};

// Export constants untuk referensi
export { STORAGE_PREFIX, LICENSE_PRODUCTS_KEY };
