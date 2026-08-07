/**
 * DATABASE MODULE (Sprint 4 - Code Splitting Completion)
 * 
 * Database initialization, settings, and utility functions.
 */

const DatabaseModule = (function() {
  'use strict';

  // Database instance (will be set by app.js)
  let db = null;

  function setDatabase(databaseInstance) {
    db = databaseInstance;
  }

  // Settings functions with error handling
  async function getSetting(key, def) {
    try {
      const row = await db.settings.get(key);
      return row ? row.value : def;
    } catch (e) {
      console.error(`[DB] Error getting setting ${key}:`, e);
      if (typeof errorTracker !== 'undefined') {
        errorTracker.captureException(e, { context: 'getSetting', key });
      }
      return def;
    }
  }

  async function setSetting(key, value) {
    try {
      await db.settings.put({ key, value });
    } catch (e) {
      console.error(`[DB] Error setting ${key}:`, e);
      if (typeof errorTracker !== 'undefined') {
        errorTracker.captureException(e, { context: 'setSetting', key });
      }
      if (typeof UIModule !== 'undefined') {
        UIModule.toast("Gagal menyimpan pengaturan", "error");
      } else {
        toast("Gagal menyimpan pengaturan", "error");
      }
    }
  }

  // Safe database operation wrapper
  async function safeDbOperation(operation, errorMessage) {
    try {
      return await operation();
    } catch (e) {
      console.error(`[DB] ${errorMessage}:`, e);
      if (typeof errorTracker !== 'undefined') {
        errorTracker.captureException(e, { context: errorMessage });
      }
      throw e; // Re-throw for caller to handle
    }
  }

  // Seed initial data
  async function seedIfEmpty() {
    return safeDbOperation(async () => {
      const count = await db.menuCategories.count();
      if (count > 0) return;

      // Seed default categories
      await db.menuCategories.bulkAdd([
        { id: 1, name: "Makanan Utama", sort: 10 },
        { id: 2, name: "Minuman", sort: 20 },
        { id: 3, name: "Camilan", sort: 30 },
      ]);

      // Seed sample menu items
      await db.menuItems.bulkAdd([
        { id: 1, categoryId: 1, name: "Nasi Goreng", price: 15000, stock: 100, sort: 10 },
        { id: 2, categoryId: 1, name: "Mie Goreng", price: 12000, stock: 100, sort: 20 },
        { id: 3, categoryId: 2, name: "Es Teh", price: 5000, stock: 200, sort: 10 },
        { id: 4, categoryId: 2, name: "Es Jeruk", price: 7000, stock: 200, sort: 20 },
        { id: 5, categoryId: 3, name: "Kerupuk", price: 2000, stock: 300, sort: 10 },
      ]);

      console.log("[DB] Seeded initial data");
    }, "Failed to seed initial data");
  }

  // Normalize menu item for import
  function normalizeMenuItem(m) {
    if (!m) return null;
    return {
      ...m,
      price: Number(m.price) || 0,
      stock: Number(m.stock) || 0,
      sort: Number(m.sort) || 0,
    };
  }

  // Public API
  return {
    setDatabase,
    getSetting,
    setSetting,
    safeDbOperation,
    seedIfEmpty,
    normalizeMenuItem,
  };
})();

if (typeof window !== 'undefined') {
  window.DatabaseModule = DatabaseModule;
}
