/**
 * BACKUP MODULE (Sprint 3 - Code Splitting)
 * 
 * Dipisahkan dari app.js untuk meningkatkan maintainability.
 * Berisi fungsi-fungsi terkait backup dan restore data.
 */

const BackupModule = (function() {
  'use strict';

  // Private variables
  const EXCLUDED_SETTINGS = new Set([
    "licenseActivated", "licenseKey", "deviceId", "installId", 
    "firstInstallTs", "trialExtendCount", "trialExtendLastDate", "activeKasSessionId"
  ]);

  const PROTECTED_SETTINGS = [
    "licenseActivated", "licenseKey", "deviceId", "installId", 
    "firstInstallTs", "trialExtendCount", "trialExtendLastDate"
  ];

  /**
   * Collect all data for backup
   * @returns {Promise<object>} Data object ready for backup
   */
  async function collectBackupData() {
    try {
      const tables = ["settings", "menuCategories", "menuItems", "transactions", "expenses", "kasSessions"];
      const data = {};
      
      for (const t of tables) {
        data[t] = await db[t].toArray();
      }

      // Exclude sensitive settings from backup
      data.settings = data.settings.filter(s => !EXCLUDED_SETTINGS.has(s.key));

      const deviceId = await getSetting("deviceId", null);
      data.__meta__ = {
        exportedAt: todayISO(),
        app: "Kasir Solo - Gerobak",
        version: 2,
        deviceId: deviceId || "UNKNOWN"
      };

      return data;
    } catch (e) {
      console.error('[BackupModule] Error collecting backup data:', e);
      if (typeof errorTracker !== 'undefined') {
        errorTracker.captureException(e, { context: 'collectBackupData' });
      }
      throw e;
    }
  }

  /**
   * Export backup to file
   * @returns {Promise<void>}
   */
  async function exportBackup() {
    try {
      const data = await collectBackupData();
      const jsonStr = JSON.stringify(data);

      // Encrypt backup before export
      const encrypted = encryptBackup(jsonStr);

      const blob = new Blob([encrypted], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kasirsolo-gerobak-backup-" + new Date().toISOString().slice(0, 10) + ".gerobak";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1000);
      
      toast("Backup berhasil diunduh (terenkripsi)", "success");
    } catch (err) {
      console.error("[Backup] gagal export:", err);
      if (typeof errorTracker !== 'undefined') {
        errorTracker.captureException(err, { context: 'exportBackup' });
      }
      toast("Backup gagal: " + err.message, "error");
    }
  }

  /**
   * Decode backup text (supports both encrypted and legacy formats)
   * @param {string} text - Backup text to decode
   * @returns {string} Decoded JSON string
   */
  function decodeBackupText(text) {
    // Try decryption first (new format), if fails try legacy format
    const decrypted = decryptBackup(text);
    if (decrypted) {
      return decrypted;
    }

    // Fallback to legacy format (not encrypted)
    try {
      const raw = atob(text);
      const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (e) {
        return raw;
      }
    } catch (e) {
      // Not base64, return original text
      return text;
    }
  }

  /**
   * Import backup from file
   * @param {File} file - Backup file to import
   * @returns {Promise<void>}
   */
  async function importBackup(file) {
    try {
      const text = await file.text();
      let data;

      try {
        // Try to decrypt and parse
        const decoded = decodeBackupText(text);
        data = JSON.parse(decoded);
      } catch (e) {
        // Fallback: try plain JSON for backwards compatibility
        try {
          data = JSON.parse(text);
        } catch (e2) {
          toast("File backup tidak valid atau rusak", "error");
          return;
        }
      }

      if (!data || typeof data !== "object" || !Array.isArray(data.menuItems)) {
        toast("Struktur file backup tidak dikenali", "error");
        return;
      }

      // Validate device ID if present in backup
      if (data.__meta__ && data.__meta__.deviceId) {
        const currentDeviceId = await getSetting("deviceId", null);
        if (data.__meta__.deviceId !== "UNKNOWN" && data.__meta__.deviceId !== currentDeviceId) {
          const confirmed = await confirmDestructiveAsync(
            "⚠️ Backup ini dari perangkat berbeda:\n" +
            "- Perangkat backup: " + data.__meta__.deviceId + "\n" +
            "- Perangkat sekarang: " + (currentDeviceId || "UNKNOWN") + "\n\n" +
            "Lanjutkan restore? Data akan ditimpa sepenuhnya."
          );
          if (!confirmed) return;
        }
      }

      // Preserve protected settings (license, device ID, etc.)
      const preserved = [];
      for (const key of PROTECTED_SETTINGS) {
        const row = await db.settings.get(key);
        if (row) preserved.push(row);
      }

      const tables = ["settings", "menuCategories", "menuItems", "transactions", "expenses", "kasSessions"];
      
      await db.transaction("rw", tables.map(t => db[t]).concat([db.currentCart]), async () => {
        for (const t of tables) {
          if (!Array.isArray(data[t])) continue;
          let rows = data[t];
          
          if (t === "settings") {
            const protectedKeys = new Set(PROTECTED_SETTINGS);
            rows = rows.filter(r => r && typeof r.key === "string" && !protectedKeys.has(r.key));
            rows = rows.concat(preserved);
          }
          
          if (t === "menuItems") rows = rows.map(normalizeMenuItem);
          
          if (t === "kasSessions") {
            rows = rows.map(r => (r && r.status === "buka")
              ? { ...r, status: "tutup", dateClose: r.dateClose || todayISO(), closedByRestore: true }
              : r
            );
          }

          await db[t].clear();
          if (rows.length > 0) await db[t].bulkAdd(rows);
        }
      });

      toast("Restore berhasil! Halaman akan dimuat ulang...", "success");
      setTimeout(() => location.reload(), 1200);
      
    } catch (err) {
      console.error("[Backup] gagal import:", err);
      if (typeof errorTracker !== 'undefined') {
        errorTracker.captureException(err, { context: 'importBackup' });
      }
      toast("Restore gagal: " + err.message, "error");
    }
  }

  // Public API
  return {
    collectBackupData,
    exportBackup,
    importBackup,
    decodeBackupText,
  };
})();

// Export for use in app.js
if (typeof window !== 'undefined') {
  window.BackupModule = BackupModule;
}
