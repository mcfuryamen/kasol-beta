/**
 * kasol/js/license.js
 * Barrel export — semua modul lisensi
 *
 * Usage di app:
 *   import { getLicenseStatus, activateSerial, renderLicenseStatusArea, ... } from './license.js';
 */
export {
  // license-core.js (pure HMAC from control)
  b32Encode,
  b32Decode,
  hmacSignature,
  normalizeDeviceCode,
  generateSerial,
  verifySerial,
  checkExpired,
  getExpiryDate,
  formatExpiry,
  parseSerial,
  APP_TYPE,
  PRODUCT_PREFIX,
  LICENSE_SALT,
  OFFLINE_SALT,
  UNIT_ID_PREFIX
} from './license-core.js';

// license.logic.js
export {
  currentTxMonth,
  getTxQuota,
  getDeviceFingerprint,
  getLegacyV3DeviceCode,
  getLegacyV4DeviceCode,
  getDeviceIdentity,
  checkExpired,
  decodeExpiryLabel,
  getEffectiveNow,
  bumpClockAnchor,
  validateSerial,
  getLicense,
  saveLicense,
  markLicenseRevoked,
  clearLocalLicense,
  startTrial,
  incrementTxCount,
  activateSerial,
  cloudProfileMatchesLocal,
  persistCloudLicense,
  getLicenseStatus
} from './license.logic.js';

// license.sync.js
export {
  getSupabaseClient,
  ensureSynced,
  pullCloudProfile,
  syncSettingsToCloud
} from './license.sync.js';

// license.ui.js
export {
  setLicenseRefs,
  openOverlay,
  closeOverlay,
  closeSheet,
  licenseStatusHtml,
  renderLicenseStatusArea,
  renderLicenseInfoCard,
  updateTrialChip,
  handleSerialActivation,
  enforceRevoked
} from './license.ui.js';

// db.js
export { db, getSetting, setSetting } from './db.js';

// quota.offline.js
export {
  quotaEnsure,
  quotaTickTx,
  quotaMarkOnline,
  quotaBudgetStatus
} from './quota.offline.js';

// helpers.pure.js
export {
  escapeHtml,
  rateLimit,
  isRateLimited,
  formatRp,
  isValidPhone,
  normalizePhone,
  calcCartTotal,
  calcCartQty,
  debounce,
  throttle,
  sleep,
  randomHex,
  clamp,
  deepClone
} from './helpers.pure.js';

// modal.js
export {
  getCurrentModal,
  isModalOpen,
  openModal,
  closeModal,
  closeAllModals,
  setHardGate,
  isHardGate,
  overlayClickClose
} from './modal.js';

// sync.js
export {
  getSupabase,
  ensureAuthSession,
  getDeviceId,
  ensureDeviceKnown,
  syncSettingsToCloud as syncSettingsToCloudGeneric,
  pullCloudProfile as pullCloudProfileGeneric
} from './sync.js';

// version.js
export { APP_VERSION, CACHE_BUST } from './version.js';
