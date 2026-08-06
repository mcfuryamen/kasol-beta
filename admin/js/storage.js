/**
 * Admin Marketing KASIRSOLO — Storage Abstraction
 * Interface for localStorage (now) and Supabase (future)
 * All UI modules use this - swap implementation without touching UI
 */

const STORAGE_PREFIX = 'kasirsolo:';
const LICENSE_PRODUCTS_KEY = 'kasirsolo_license_products_v3';

/**
 * Check if we're in a valid storage environment
 */
function isStorageAvailable() {
  return typeof window !== 'undefined' && !!window.storage;
}

/**
 * Parse JSON safely
 */
function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Storage abstraction interface
 * All methods return Promises for future Supabase compatibility
 */
export const storage = {
  /**
   * Get a value by key
   * @param {string} key - Key without prefix (e.g., 'catalog', 'leads')
   * @param {*} fallback - Default value if not found
   */
  async get(key, fallback = null) {
    if (!isStorageAvailable()) return fallback;

    try {
      const res = await window.storage.get(STORAGE_PREFIX + key, true);
      if (res && res.value) {
        return safeParse(res.value, fallback);
      }
      return fallback;
    } catch (error) {
      console.warn(`Storage get failed for ${key}:`, error);
      return fallback;
    }
  },

  /**
   * Set a value by key
   * @param {string} key - Key without prefix
   * @param {*} value - Value to store (will be JSON stringified)
   */
  async set(key, value) {
    if (!isStorageAvailable()) return false;

    try {
      await window.storage.set(STORAGE_PREFIX + key, JSON.stringify(value), true);
      return true;
    } catch (error) {
      console.error(`Storage set failed for ${key}:`, error);
      return false;
    }
  },

  /**
   * Get license products (different storage key)
   */
  async getLicenseProducts() {
    if (!isStorageAvailable()) return null;

    try {
      const res = await window.storage.get(LICENSE_PRODUCTS_KEY, true);
      if (res && res.value) {
        return safeParse(res.value, null);
      }
      return null;
    } catch (error) {
      console.warn('Storage getLicenseProducts failed:', error);
      return null;
    }
  },

  /**
   * Set license products
   */
  async setLicenseProducts(products) {
    if (!isStorageAvailable()) return false;

    try {
      await window.storage.set(LICENSE_PRODUCTS_KEY, JSON.stringify(products), true);
      return true;
    } catch (error) {
      console.error('Storage setLicenseProducts failed:', error);
      return false;
    }
  },

  /**
   * Subscribe to cross-tab storage changes (localStorage only)
   * @param {string} key - Key without prefix
   * @param {Function} callback - Called with new value
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!isStorageAvailable() || typeof window === 'undefined') {
      return () => {};
    }

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
   * Subscribe to license products changes
   */
  subscribeLicenseProducts(callback) {
    if (!isStorageAvailable() || typeof window === 'undefined') {
      return () => {};
    }

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
   * Clear all app data (for testing/logout)
   */
  async clearAll() {
    if (!isStorageAvailable()) return false;

    const keys = ['catalog', 'settings', 'leads', 'stats'];
    try {
      await Promise.all(keys.map(k => window.storage.remove(STORAGE_PREFIX + k, true)));
      await window.storage.remove(LICENSE_PRODUCTS_KEY, true);
      return true;
    } catch (error) {
      console.error('Storage clearAll failed:', error);
      return false;
    }
  },

  /**
   * Check if storage is available
   */
  isAvailable: isStorageAvailable
};

// Export constants for reference
export { STORAGE_PREFIX, LICENSE_PRODUCTS_KEY };