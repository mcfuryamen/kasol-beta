/**
 * kasol/js/db.js
 * Dexie IndexedDB — KasirSolo Root
 * Schema v1: settings, cache
 */
import Dexie from 'dexie';

export const db = new Dexie('KasirSoloRoot');

db.version(1).stores({
  settings: 'key',
  cache: 'key'
});

/**
 * @param {string} key
 * @param {any} defaultValue
 * @returns {Promise<any>}
 */
export async function getSetting(key, defaultValue = null) {
  try {
    const row = await db.settings.get(key);
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}
