/**
 * CRYPTO MODULE (Sprint 4 - Security Upgrade)
 * 
 * Uses Web Crypto API for stronger encryption instead of XOR cipher.
 * Fallback to XOR if Web Crypto is not available.
 */

const CryptoModule = (function() {
  'use strict';

  const ENCRYPTION_KEY_STRING = "KSG_SECURE_KEY_2026"; // For key derivation
  const ALGORITHM = "AES-GCM";
  const KEY_LENGTH = 256;
  const IV_LENGTH = 12; // 12 bytes for AES-GCM

  // Check if Web Crypto API is available
  const cryptoAvailable = typeof window !== 'undefined' && 
                         window.crypto && 
                         window.crypto.subtle;

  // Fallback XOR functions (from Sprint 1 & 2)
  function xorEncrypt(text, key) {
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return btoa(result);
  }

  function xorDecrypt(encoded, key) {
    try {
      const decoded = atob(encoded);
      let result = "";
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch (e) {
      console.error("[Crypto] XOR decrypt failed:", e);
      return null;
    }
  }

  // Web Crypto API functions
  async function deriveKey(salt) {
    if (!cryptoAvailable) return null;

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(ENCRYPTION_KEY_STRING),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptStrong(text) {
    if (!cryptoAvailable) {
      console.warn("[Crypto] Web Crypto not available, falling back to XOR");
      return { data: xorEncrypt(text, ENCRYPTION_KEY_STRING), method: "xor" };
    }

    try {
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(salt);

      const enc = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv: iv },
        key,
        enc.encode(text)
      );

      // Combine salt + iv + encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);

      return {
        data: btoa(String.fromCharCode(...combined)),
        method: "aes-gcm",
      };
    } catch (e) {
      console.error("[Crypto] Strong encrypt failed:", e);
      return { data: xorEncrypt(text, ENCRYPTION_KEY_STRING), method: "xor" };
    }
  }

  async function decryptStrong(encoded) {
    if (!cryptoAvailable) {
      return xorDecrypt(encoded, ENCRYPTION_KEY_STRING);
    }

    try {
      const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      
      // Extract salt, iv, and encrypted data
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 16 + IV_LENGTH);
      const encrypted = combined.slice(16 + IV_LENGTH);

      const key = await deriveKey(salt);

      const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: iv },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.warn("[Crypto] Strong decrypt failed, trying XOR fallback:", e);
      return xorDecrypt(encoded, ENCRYPTION_KEY_STRING);
    }
  }

  // Wrapper functions for backup
  async function encryptBackup(text) {
    const result = await encryptStrong(text);
    return result.data; // Return only the encrypted data
  }

  async function decryptBackup(encoded) {
    return await decryptStrong(encoded);
  }

  // Wrapper functions for license
  async function encryptLicense(text) {
    const result = await encryptStrong(text);
    return result.data;
  }

  async function decryptLicense(encoded) {
    return await decryptStrong(encoded);
  }

  // Check if strong encryption is available
  function isStrongEncryptionAvailable() {
    return cryptoAvailable;
  }

  // Public API
  return {
    encryptBackup,
    decryptBackup,
    encryptLicense,
    decryptLicense,
    isStrongEncryptionAvailable,
    // Expose for testing
    _deriveKey: deriveKey,
    _xorEncrypt: xorEncrypt,
    _xorDecrypt: xorDecrypt,
  };
})();

if (typeof window !== 'undefined') {
  window.CryptoModule = CryptoModule;
}
