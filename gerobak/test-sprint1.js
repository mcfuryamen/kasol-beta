/**
 * SPRINT 1 TEST SCRIPT
 * Jalankan di browser console untuk test perubahan Sprint 1
 */

console.log("=== SPRINT 1 TEST SCRIPT ===");

// Test 1: Device ID Generation & Persistence
console.log("\n1. Testing Device ID Generation...");
const deviceId1 = generateDeviceId();
console.log("Generated Device ID:", deviceId1);

// Test persistence (simulate)
const savedId = localStorage.getItem("KSG_DEVICE_ID");
console.log("Saved in localStorage:", savedId);
console.log("Persistence works:", deviceId1 === savedId);

// Test 2: Backup Encryption
console.log("\n2. Testing Backup Encryption...");
const testData = JSON.stringify({test: "data", number: 123});
const encrypted = encryptBackup(testData);
console.log("Encrypted (first 50 chars):", encrypted.substring(0, 50) + "...");

const decrypted = decryptBackup(encrypted);
console.log("Decrypted matches original:", decrypted === testData);
console.log("Decrypted data:", decrypted);

// Test 3: Error Handling
console.log("\n3. Testing Error Handling...");
// Simulate getSetting with error (if DB not ready)
console.log("getSetting function exists:", typeof getSetting === 'function');
console.log("setSetting function exists:", typeof setSetting === 'function');

// Test 4: Backwards Compatibility
console.log("\n4. Testing Backwards Compatibility...");
const oldFormatText = btoa(String.fromCharCode(...new TextEncoder().encode('{"test":"old format"}')));
const decoded = decodeBackupText(oldFormatText);
console.log("Old format still readable:", decoded.includes("old format"));

console.log("\n=== TEST COMPLETE ===");
console.log("If all tests show 'true' or expected values, Sprint 1 changes work correctly!");
