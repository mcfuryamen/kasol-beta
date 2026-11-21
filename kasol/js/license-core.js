/**
 * kasol/js/license-core.js
 * Wrapper re-export dari control/js/license-core.js
 * plus konfigurasi spesifik kasol
 */
export {
  b32Encode,
  b32Decode,
  hmacSignature,
  normalizeDeviceCode,
  generateSerial,
  verifySerial,
  checkExpired,
  getExpiryDate,
  formatExpiry,
  parseSerial
} from '../../control/js/license-core.js';

// ── Konfigurasi spesifik kasol ────────────────────────────────────────────────
/** @type {'kasol'} */
export const APP_TYPE = 'kasol';

/** Prefix serial: KSL-XXXX-XXXX-YY-SIGGGG */
export const PRODUCT_PREFIX = 'KSL';

/** Salt HMAC untuk lisensi kasol */
export const LICENSE_SALT = 'KASIRSOLO-KASOL-HMAC-V1';

/** Salt HMAC untuk offline budget (terpisah dari lisensi) */
export const OFFLINE_SALT = 'KASIRSOLO-KASOL-BUDGET-V1';

/** Unit ID prefix: KSL-XXXXXXXX */
export const UNIT_ID_PREFIX = 'KSL-';
