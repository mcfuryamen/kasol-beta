// ==================== LISENSI (ESM) ====================
// Kaki Lima license — adopts the full Kasir Solo trial & license feature set
// from the Rosok app: 7-day trial, share-to-extend (20x, +1 hari), paid serial
// (KK5 prefix, HMAC-SHA256 v2).
// Follows the universal Kasir Solo v2-HMAC scheme (see admin/docs/04-license-system.md).
// NOTE: Validation here is OFFLINE (HMAC local) as the current fallback; the
// cloud target is server-side validation via Supabase (Lapisan Meta/CRM), see
// ../CLOUD-ROADMAP.md. The scaffolding keeps a single gate point so the server
// check can be added later without touching the app flow.
//
// Refactored 2026-08-10: split into license.logic.js, license.ui.js, license.sync.js
// for strict separation of concerns.
//
// NEW (2026-08-20): Dynamic salt versioning via Supabase products table
// - Salt fetched from products table (salt_hmac, salt_version)
// - Local fallback for offline support
// - Cache with manual clear for rotation

// Re-export pure logic functions
export {
  TRIAL_DAYS, EXTEND_DAYS, MAX_EXTENSIONS,
  simpleHash, b32Encode, checkExpired, decodeExpiryLabel,
  getDeviceIdentity, getDeviceCode, getInstallId, getDeviceFingerprint,
  hmacSignature, validateSerial,
  startTrial, activateSerial, getLicenseStatus,
  getUnitId, ensureUnitId,
  isLicensed, trialEndDate, daysLeft,
  getLicense, saveLicense, grantExtensionLogic,
  isOnboarded, markOnboarded, markLicenseRevoked, clearLocalLicense,
  // Salt management (NEW 2026-08-20)
  clearHmacSaltCache, clearProductSaltCache
} from './license.logic.js';

// Re-export UI functions
export {
  setLicenseRefs,
  openOverlay, closeOverlay, closeSheet,
  licenseStatusHtml,
  renderLicenseStatusArea, checkCloudStatusAndUnlock, toggleManualKey,
  checkLicenseGate, updateTrialChip, openLicenseSheet, renderLicenseInfoCard,
  contactViaWA, openExtendFlow, tryShare, grantExtension, activateLicense,
  enforceRevoked, renderProfileMismatchOverlay
} from './license.ui.js';

// Re-export sync functions
export {
  syncLicenseStatus,
  fetchLicenseStatusFromCloud,
  isDeviceKnownOnCloud,
  verifyAndAssignSerial,    // NEW: Opsi 3 — verifikasi serial + reassign unit_id
  fetchProductSalt,          // NEW: fetch salt from Supabase products table
  getSupabaseClient
} from './license.sync.js';

// Window wiring terpusat di app.js (lihat app.js:114-117).
// (Audit 2026-08-09: hapus self-wire dari license.js — duplikat dgn app.js)