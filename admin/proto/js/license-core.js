/**
 * Admin Marketing KASIRSOLO — License Core
 * Core license generation & validation logic (HMAC-based)
 * Must match client apps (kaki5, rosok, gerobak, retail) exactly
 */

// Product salts - MUST match each client app's PRODUCT_SALT
export const PRODUCT_SALTS = {
  kaki5: 'KASIRSOLO-KAKI5-HMAC-V2',
  rosok: 'KASIRSOLO-ROSOK-HMAC-V2',
  gerobak: 'KASIRSOLO-GEROBAK-HMAC-V2',
  retail: 'KASIRSOLO-RETAIL-HMAC-V2'
};

export const PRODUCT_PREFIXES = {
  kaki5: 'KK5',
  rosok: 'KSR',
  gerobak: 'GBK',
  retail: 'RTL'
};

const APP_META = {
  kaki5: { prefix: 'KK5', salt: 'KASIRSOLO-KAKI5-HMAC-V2', icon: '🛵', label: 'Kaki Lima' },
  rosok: { prefix: 'KSR', salt: 'KASIRSOLO-ROSOK-HMAC-V2', icon: '♻️', label: 'Rosok' },
  gerobak: { prefix: 'GBK', salt: 'KASIRSOLO-GEROBAK-HMAC-V2', icon: '🛒', label: 'Gerobak' },
  retail: { prefix: 'RTL', salt: 'KASIRSOLO-RETAIL-HMAC-V2', icon: '🏪', label: 'Retail' }
};

export function getProductMeta(appType) {
  return APP_META[appType] || { prefix: '', salt: '', icon: '📦', label: appType };
}

// Base32 encoding (RFC 4648, no padding)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str) {
  const clean = str.replace(/=/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

// HMAC-SHA256
async function hmacSHA256(keyStr, dataStr) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataStr));
  return new Uint8Array(signature);
}

// Generate license key V2 (matches client validateLicenseKeyV2)
export async function generateLicenseKeyV2({ product, deviceCode, ownerName, phone, days, maxDevices = 1, refCode = '' }) {
  const meta = getProductMeta(product);
  const prefix = meta.prefix;
  const salt = meta.salt;

  const now = Date.now();
  const expiresAt = now + days * 24 * 60 * 60 * 1000;
  const expDays = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));

  // Payload: deviceCode|expDays|maxDevices|ownerName|phone|refCode
  const payload = `${deviceCode}|${expDays}|${maxDevices}|${ownerName}|${phone}|${refCode}`;

  // HMAC
  const hmac = await hmacSHA256(salt, payload);
  // Take first 6 bytes = 48 bits = 8 base32 chars (we use 6 chars for shorter serial)
  const sig = base32Encode(hmac.slice(0, 4)).slice(0, 6);

  // Serial format: PREFIX-DEVICECODE-EXPDAYS-SIGNATURE
  // Device code normalized to 8 chars (from installId)
  const devShort = deviceCode.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8).padEnd(8, 'X');

  return `${prefix}-${devShort}-${expDays.toString().padStart(3, '0')}-${sig}`;
}

// Validate license key V2 (replicates client logic)
export async function validateLicenseKeyV2(serial, product) {
  const meta = getProductMeta(product);
  const prefix = meta.prefix;
  const salt = meta.salt;

  if (!serial.startsWith(prefix + '-')) {
    return { valid: false, reason: 'Prefix tidak cocok' };
  }

  const parts = serial.split('-');
  if (parts.length !== 4) {
    return { valid: false, reason: 'Format serial tidak valid' };
  }

  const [, devCode, expDaysStr, sig] = parts;
  const expDays = parseInt(expDaysStr, 10);
  if (isNaN(expDays) || expDays <= 0) {
    return { valid: false, reason: 'Masa aktif tidak valid' };
  }

  // Reconstruct payload (we don't have owner/phone/ref in serial, so partial validation)
  // For full validation, we need the original payload data
  // This is a simplified check - real validation happens client-side with stored data
  const payload = `${devCode}|${expDays}|1|||`; // maxDevices=1, empty owner/phone/ref
  const hmac = await hmacSHA256(salt, payload);
  const expectedSig = base32Encode(hmac.slice(0, 4)).slice(0, 6);

  if (sig !== expectedSig) {
    return { valid: false, reason: 'Tanda tangan tidak valid' };
  }

  const expiresAt = Date.now() + expDays * 24 * 60 * 60 * 1000;
  if (Date.now() > expiresAt) {
    return { valid: false, reason: 'Lisensi expired', expired: true };
  }

  return { valid: true, expiresAt, expDays, deviceCode: devCode };
}

// Parse serial to extract info
export function parseSerial(serial) {
  const parts = serial.split('-');
  if (parts.length !== 4) return null;

  const [prefix, deviceCode, expDaysStr, sig] = parts;
  let product = null;
  for (const [key, meta] of Object.entries(APP_META)) {
    if (meta.prefix === prefix) { product = key; break; }
  }

  return {
    product,
    prefix,
    deviceCode,
    expDays: parseInt(expDaysStr, 10),
    signature: sig
  };
}

// Generate referral code from unitId
export function generateReferralCode(unitId) {
  // unitId format: K5-xxxx or KSR-xxxx etc.
  return unitId.replace(/^[A-Z0-9]+-/, '').toUpperCase();
}

// Validate referral code format
export function isValidReferralCode(code) {
  return /^[A-Z0-9]{4,12}$/.test(code);
}