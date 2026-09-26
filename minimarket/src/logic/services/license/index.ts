/**
 * minimarket/src/logic/services/license/index.ts
 * Barrel export — modul lisensi (pola kaki5/js/license.js)
 */
export { APP_VERSION, CACHE_BUST } from './version';
export { db, getSetting, setSetting } from './db';

// Inti (crypto murni + state) — util untuk tooling/admin:
export {
  APP_TYPE,
  PRODUCT_PREFIX,
  SERIAL_REGEX,
  UNIT_ID_PREFIX,
  DEFAULT_LICENSE_SALT,
  isPlaceholderKey,
  simpleHash,
  b32Encode,
  getDeviceFingerprint,
  deriveDeviceCode,
  hmacSignatureWithSalt,
  generateSerial,
  parseSerial,
} from './core';

// Logic (state lisensi + status):
export {
  DEFAULT_TX_QUOTA,
  currentTxMonth,
  getTxQuota,
  getDeviceIdentity,
  getDeviceCode,
  getInstallId,
  getUnitId,
  ensureUnitId,
  hmacSignature,
  validateSerial,
  checkExpired,
  decodeExpiryLabel,
  getLicense,
  saveLicense,
  markLicenseRevoked,
  clearLocalLicense,
  startTrial,
  incrementTxCount,
  activateSerial,
  persistCloudLicense,
  getLicenseStatus,
  isLicensed,
  type LicenseRecord,
  type LicenseState,
  type LicenseStatus,
  type ActivateResult,
} from './logic';

// Kuota offline:
export {
  OFFLINE_DAYS_LIMIT,
  OFFLINE_TRX_LIMIT,
  OFFLINE_MONTH_LIMIT,
  quotaEnsure,
  quotaTickTx,
  quotaMarkOnline,
  quotaBudgetStatus,
  quotaMetaRead,
  quotaMetaWrite,
  type QuotaMeta,
  type QuotaBudget,
} from './quota';

// Cloud sync:
export {
  ensureSynced,
  syncLicenseStatus,
  fetchProductSalt,
  clearProductSaltCache,
  fetchTxQuotaConfig,
  verifyAndAssignSerial,
  fetchLicenseStatusFromCloud,
  ensureAuthSession,
} from './sync';

// UI + modal gate:
export {
  showActivationModal,
  LicenseStatusChip,
  LicenseStatusBar,
  RevokedLockScreen,
  ActivationModal,
} from './ui';
export { isHardGateActive, setHardGate, openModal, closeModal, closeAllModals } from './modal';
