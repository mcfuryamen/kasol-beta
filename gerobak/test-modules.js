// Test script to verify modules are loaded correctly
(function(){
  console.log('=== Testing Modules ===');
  
  const modules = [
    'CryptoModule',
    'DatabaseModule', 
    'UIModule',
    'LicenseModule',
    'BackupModule'
  ];
  
  let allLoaded = true;
  for (const mod of modules) {
    const exists = typeof window[mod] !== 'undefined';
    console.log(`${mod}: ${exists ? '✅ LOADED' : '❌ NOT LOADED'}`);
    if (!exists) allLoaded = false;
  }
  
  if (allLoaded) {
    console.log('✅ All modules loaded successfully!');
    console.log('Available methods:');
    console.log('  - CryptoModule:', Object.keys(CryptoModule));
    console.log('  - DatabaseModule:', Object.keys(DatabaseModule));
    console.log('  - UIModule:', Object.keys(UIModule));
    console.log('  - LicenseModule:', Object.keys(LicenseModule));
    console.log('  - BackupModule:', Object.keys(BackupModule));
  } else {
    console.log('❌ Some modules are missing!');
  }
  
})();