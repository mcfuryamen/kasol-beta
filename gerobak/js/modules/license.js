/**
 * LICENSE MODULE (Sprint 3 - Code Splitting)
 * 
 * Dipisahkan dari app.js untuk meningkatkan maintainability.
 * Berisi fungsi-fungsi terkait license validation dan activation.
 */

// License Module
const LicenseModule = (function() {
  'use strict';

  // Private functions (already defined in app.js, but we can reference them)
  // This module assumes the main app.js has already loaded with:
  // - djb2Hash, sdbmHash, toBase36_4, normalizeDeviceId, computeDeviceChecksum
  // - encryptLicense, decryptLicense, getSetting, setSetting, generateDeviceId
  // - toast, todayISO, escapeHtml

  /**
   * Validate serial number with device ID
   * @param {string} serial - Serial number to validate
   * @param {string} deviceId - Device ID to validate against
   * @returns {boolean} True if valid
   */
  function validateSerialWithDevice(serial, deviceId) {
    // This function is defined in app.js, but we can call it from there
    // For modularity, we'll assume it's available globally
    if (typeof window.validateSerialWithDevice === 'function') {
      return window.validateSerialWithDevice(serial, deviceId);
    }
    console.error('[LicenseModule] validateSerialWithDevice not available');
    return false;
  }

  /**
   * Check if license is valid and activated
   * @returns {Promise<boolean>} True if license is valid
   */
  async function checkLicense() {
    try {
      const encryptedKey = await getSetting("licenseKey", null);
      const deviceId = await getSetting("deviceId", null);
      
      // Decrypt license key before validation
      const key = encryptedKey ? decryptLicense(encryptedKey) : null;
      
      if (key && deviceId && validateSerialWithDevice(key, deviceId)) {
        return true;
      }
      
      await setSetting("licenseActivated", false);
      return false;
    } catch (e) {
      console.error('[LicenseModule] Error checking license:', e);
      if (typeof errorTracker !== 'undefined') {
        errorTracker.captureException(e, { context: 'checkLicense' });
      }
      return false;
    }
  }

  /**
   * Activate license with serial number
   * @param {string} serial - Serial number to activate
   * @param {function} onSuccess - Callback on success
   * @returns {Promise<void>}
   */
  async function activateLicense(serial, onSuccess) {
    try {
      const s = (serial || "").trim().toUpperCase();
      if (!s) {
        toast("Nomor serial tidak boleh kosong", "error");
        return;
      }

      const deviceId = generateDeviceId();
      if (!validateSerialWithDevice(s, deviceId)) {
        toast("Nomor serial tidak valid untuk perangkat ini", "error");
        return;
      }

      await setSetting("licenseActivated", true);
      // Encrypt license key before storing
      const encryptedLicense = encryptLicense(s);
      await setSetting("licenseKey", encryptedLicense);
      
      toast("Lisensi berhasil diaktifkan!", "success");
      
      if (typeof updateTopbarLicenseInfo === 'function') {
        await updateTopbarLicenseInfo();
      }
      
      if (onSuccess) onSuccess();
      
    } catch (e) {
      console.error('[LicenseModule] Error activating license:', e);
      if (typeof errorTracker !== 'undefined') {
        errorTracker.captureException(e, { context: 'activateLicense' });
      }
      toast("Gagal mengaktifkan lisensi: " + e.message, "error");
    }
  }

  /**
   * Get license info for display
   * @returns {Promise<object>} License information
   */
  async function getLicenseInfo() {
    try {
      const licenseActivated = await getSetting("licenseActivated", false);
      const encryptedLicenseKey = await getSetting("licenseKey", null);
      const licenseKey = encryptedLicenseKey ? decryptLicense(encryptedLicenseKey) : null;
      const installId = await getSetting("installId", "-");
      const deviceId = await getSetting("deviceId", "-");

      return {
        activated: licenseActivated,
        key: licenseKey,
        installId: installId,
        deviceId: deviceId,
      };
    } catch (e) {
      console.error('[LicenseModule] Error getting license info:', e);
      return {
        activated: false,
        key: null,
        installId: "-",
        deviceId: "-",
      };
    }
  }

  // Public API
  return {
    validateSerialWithDevice,
    checkLicense,
    activateLicense,
    getLicenseInfo,
  };
})();

// Export for use in app.js (if using ES modules, otherwise attached to window)
if (typeof window !== 'undefined') {
  window.LicenseModule = LicenseModule;
}
