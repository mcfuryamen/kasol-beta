// Final Verification Script - Run this in browser console
(function() {
  console.log('=== FINAL VERIFICATION SCRIPT ===\n');
  
  const checks = [];
  
  // 1. Check modules
  checks.push({ name: 'CryptoModule', passed: typeof CryptoModule !== 'undefined' });
  checks.push({ name: 'DatabaseModule', passed: typeof DatabaseModule !== 'undefined' });
  checks.push({ name: 'UIModule', passed: typeof UIModule !== 'undefined' });
  checks.push({ name: 'LicenseModule', passed: typeof LicenseModule !== 'undefined' });
  checks.push({ name: 'BackupModule', passed: typeof BackupModule !== 'undefined' });
  
  // 2. Check Dexie
  checks.push({ name: 'Dexie', passed: typeof Dexie !== 'undefined' });
  
  // 3. Check errorTracker
  checks.push({ name: 'errorTracker', passed: typeof errorTracker !== 'undefined' });
  
  // 4. Check localStorage
  checks.push({ name: 'localStorage', passed: !!window.localStorage });
  
  // 5. Check UI function availability
  const uiMethods = ['toast', 'formatRp', 'escapeHtml'];
  uiMethods.forEach(m => {
    checks.push({ name: `UIModule.${m}`, passed: typeof UIModule[m] === 'function' });
  });
  
  // 6. Check DB function availability
  const dbMethods = ['getSetting', 'setSetting'];
  dbMethods.forEach(m => {
    checks.push({ name: `DatabaseModule.${m}`, passed: typeof DatabaseModule[m] === 'function' });
  });
  
  // 7. Check encryption methods
  const cryptoMethods = ['encryptBackup', 'decryptBackup', 'encryptLicense', 'decryptLicense'];
  cryptoMethods.forEach(m => {
    checks.push({ name: `CryptoModule.${m}`, passed: typeof CryptoModule[m] === 'function' });
  });
  
  // Display results
  const passed = checks.filter(c => c.passed);
  const failed = checks.filter(c => !c.passed);
  
  console.log(`✅ Total checks: ${checks.length}`);
  console.log(`✅ Passed: ${passed.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log('');
  
  if (failed.length > 0) {
    console.log('FAILED CHECKS:');
    failed.forEach(f => console.log(`  ❌ ${f.name}`));
  } else {
    console.log('🎉 ALL CHECKS PASSED!');
  }
  
  // Detailed results
  console.log('\n=== DETAILED RESULTS ===');
  checks.forEach(c => {
    console.log(c.passed ? `✅ ${c.name}` : `❌ ${c.name}`);
  });
  
  // Store results
  window.__lastTestResults = { checks, passed, failed };
  console.log('\n✅ Verification complete!');
  
  return { checks, passed, failed };
})();