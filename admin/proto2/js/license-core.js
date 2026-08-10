/**
 * Admin Marketing KASIRSOLO — License Core (Pure Logic)
 * HMAC-SHA256 + Base32 license generation & verification
 * Zero DOM, zero side effects - portable to client apps
 */

// Base32 alphabet (no 0, 1, I, O for readability)
export const B32_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Encode bytes to Base32 string
 * @param {Uint8Array} bytes
 * @param {number} length - Output length
 * @returns {string}
 */
export function b32Encode(bytes, length = 6) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && output.length < length) {
      output += B32_ALPHABET[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  // Pad if needed
  while (output.length < length) {
    if (bits >= 5) {
      output += B32_ALPHABET[(value >> (bits - 5)) & 31];
      bits -= 5;
    } else {
      value <<= (5 - bits);
      output += B32_ALPHABET[value & 31];
      bits = 0;
    }
  }

  return output;
}

/**
 * Decode Base32 string to bytes
 * @param {string} str
 * @returns {Uint8Array}
 */
export function b32Decode(str) {
  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (const char of str) {
    const val = B32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    buffer = (buffer << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Generate HMAC-SHA256 signature
 * @param {string} salt - Secret salt
 * @param {string} data - Data to sign
 * @returns {Promise<string>} Base32 encoded signature (6 chars)
 */
export async function hmacSignature(salt, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(salt + data));
  return b32Encode(new Uint8Array(sig));
}

/**
 * Normalize device code input
 * @param {string} input - Raw device code
 * @returns {string} Normalized (8 chars, uppercase, alphanumeric only)
 */
export function normalizeDeviceCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
    .padEnd(8, 'X');
}

/**
 * Generate license serial
 * @param {string} prefix - Product prefix (e.g., 'KSR', 'K5', 'GBK')
 * @param {string} salt - HMAC salt
 * @param {string} deviceCodeRaw - Raw device code from client
 * @param {string|number} expCode - Expiry code (99 = lifetime, 01-99 = months)
 * @returns {Promise<string>} Full serial (e.g., "KSR-A1B2-C3D4-99-X7K9M2")
 */
export async function generateSerial(prefix, salt, deviceCodeRaw, expCode) {
  const deviceCode = normalizeDeviceCode(deviceCodeRaw);
  const exp = String(expCode).padStart(2, '0');
  const data = `${deviceCode}${exp}`;
  const sig = await hmacSignature(salt, data);

  const part1 = deviceCode.slice(0, 4);
  const part2 = deviceCode.slice(4, 8);

  return `${prefix}-${part1}-${part2}-${exp}-${sig}`;
}

/**
 * Verify license serial
 * @param {string} prefix - Expected product prefix
 * @param {string} salt - HMAC salt
 * @param {string} serialRaw - Serial to verify
 * @param {string} deviceCodeRaw - Device code from client
 * @returns {Promise<{valid: boolean, expired: boolean, expCode: string, deviceCode: string}>}
 */
export async function verifySerial(prefix, salt, serialRaw, deviceCodeRaw) {
  const serial = String(serialRaw || '').toUpperCase().trim();
  const expectedPrefix = prefix.toUpperCase();

  // Parse serial format: PREFIX-XXXX-XXXX-YY-SIGGGG
  const parts = serial.split('-');
  if (parts.length !== 5) return { valid: false, expired: false, expCode: '', deviceCode: '' };
  if (parts[0] !== expectedPrefix) return { valid: false, expired: false, expCode: '', deviceCode: '' };

  const deviceCode = normalizeDeviceCode(deviceCodeRaw);
  const expCode = parts[3].padStart(2, '0');
  const providedSig = parts[4].slice(0, 6);

  const data = `${deviceCode}${expCode}`;
  const expectedSig = await hmacSignature(salt, data);

  const valid = providedSig === expectedSig;
  const expired = checkExpired(expCode);

  return { valid, expired, expCode, deviceCode };
}

/**
 * Check if license is expired
 * @param {string} expCode - Expiry code (99 = lifetime, 01-99 = months)
 * @param {string|Date} [activationDate] - Optional activation date for month-based expiry
 * @returns {boolean}
 */
export function checkExpired(expCode, activationDate = null) {
  if (expCode === '99') return false; // Lifetime

  const months = parseInt(expCode, 10);
  if (isNaN(months) || months <= 0) return true;

  if (!activationDate) return false; // Can't determine without activation date

  const activated = new Date(activationDate);
  const expiry = new Date(activated);
  expiry.setMonth(expiry.getMonth() + months);

  return Date.now() > expiry.getTime();
}

/**
 * Get expiry date from expCode and activation date
 * @param {string} expCode
 * @param {string|Date} activationDate
 * @returns {Date|null}
 */
export function getExpiryDate(expCode, activationDate) {
  if (expCode === '99') return null; // Lifetime

  const months = parseInt(expCode, 10);
  if (isNaN(months) || months <= 0) return null;

  const activated = new Date(activationDate);
  const expiry = new Date(activated);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry;
}

/**
 * Format expiry for display
 * @param {string} expCode
 * @param {string|Date} [activationDate]
 * @returns {string}
 */
export function formatExpiry(expCode, activationDate = null) {
  if (expCode === '99') return 'Seumur Hidup';
  if (!activationDate) return `${expCode} Bulan (belum aktif)`;

  const expiry = getExpiryDate(expCode, activationDate);
  if (!expiry) return 'Tidak valid';

  const now = Date.now();
  const expired = now > expiry.getTime();

  const dateStr = expiry.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return expired ? `${dateStr} (Kadaluarsa)` : dateStr;
}

/**
 * Parse serial into components
 * @param {string} serialRaw
 * @returns {Object|null}
 */
export function parseSerial(serialRaw) {
  const serial = String(serialRaw || '').toUpperCase().trim();
  const parts = serial.split('-');
  if (parts.length !== 5) return null;

  return {
    prefix: parts[0],
    devicePart1: parts[1],
    devicePart2: parts[2],
    expCode: parts[3],
    signature: parts[4],
    deviceCode: parts[1] + parts[2]
  };
}