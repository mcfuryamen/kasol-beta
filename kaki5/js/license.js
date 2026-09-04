// ==================== LISENSI (ESM) ====================
// Kaki Lima license — tier gratis berbasis KUOTA TRANSAKSI per bulan kalender
// (ganti trial 7 hari, keputusan pemilik 2026-08-29) + lisensi berbayar serial
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
  DEFAULT_TX_QUOTA, currentTxMonth, getTxQuota, incrementTxCount,
  simpleHash, b32Encode, checkExpired, decodeExpiryLabel,
  getDeviceIdentity, getDeviceCode, getInstallId, getDeviceFingerprint,
  getLegacyV3DeviceCode, cloudProfileMatchesLocal, // V3-grace & guard tabrakan identitas (2026-09-04)
  hmacSignature, validateSerial,
  startTrial, activateSerial, getLicenseStatus,
  getUnitId, ensureUnitId,
  isLicensed, getLicense, saveLicense,
  markLicenseRevoked, clearLocalLicense,
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
  contactViaWA, activateLicense,
  enforceRevoked, renderProfileMismatchOverlay
} from './license.ui.js';

// Re-export sync functions
export {
  syncLicenseStatus,
  reanchorUnitId,            // NEW 2026-09-04: konvergensi unit_id V3→V4
  fetchLicenseStatusFromCloud,
  isDeviceKnownOnCloud,
  verifyAndAssignSerial,    // NEW: Opsi 3 — verifikasi serial + reassign unit_id
  fetchProductSalt,          // NEW: fetch salt from Supabase products table
  fetchTxQuotaConfig,        // NEW: kuota transaksi global dari products.tx_quota
  getSupabaseClient,
  getReanchorBlock,          // NEW v169: status blokir re-anchor (diagnostik)
  clearReanchorBlock         // NEW v169: paksa konvergensi dicoba lagi
} from './license.sync.js';

// Window wiring terpusat di app.js (lihat app.js:114-117).
// (Audit 2026-08-09: hapus self-wire dari license.js — duplikat dgn app.js)