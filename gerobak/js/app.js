/* Kasir Solo - Gerobak (Refactored Core) */
(function(){
  "use strict";

  // Ensure we have all modules
  const required = ['CryptoModule', 'DatabaseModule', 'UIModule', 'LicenseModule', 'BackupModule'];
  for (const m of required) {
    if (typeof window[m] === 'undefined') {
      console.error(`Module ${m} not loaded!`);
      return;
    }
  }

  // Simple error handler
  window.onerror = function(msg, url, line) {
    console.error('Error:', msg, 'at', url, ':', line);
    return true;
  };

  // Initialize with delay to ensure modules are ready
  setTimeout(async function() {
    try {
      // 1. Database operations
      const deviceID = await (async() => {
        let id = await DatabaseModule.getSetting('deviceId', null);
        if (!id) {
          id = 'DID-' + Math.random().toString(36).substr(2,9) + '-' + Math.random().toString(36).substr(2,9);
          await DatabaseModule.setSetting('deviceId', id);
        }
        return id;
      })();

      // 2. Show UI
      if (document.getElementById('app')) {
        const app = document.getElementById('app');
        app.innerHTML = `
          <div style="min-height:100vh;padding:20px;max-width:600px;margin:0 auto;font-family:sans-serif;">
            <h1 style="color:#FF7A1A;">🛒 Kasir Solo - Gerobak</h1>
            <p>Application loaded successfully!</p>
            <p>Device ID: ${deviceID}</p>
            <p><small>Version v4.0 - Modular Architecture</small></p>
            <button onclick="location.reload()" style="padding:8px 16px;background:#FF7A1A;color:white;border:none;border-radius:4px;cursor:pointer;">Reload</button>
          </div>
        `;
      }
      console.log('✅ App rendered successfully');
    } catch(e) {
      console.error('❌ App failed to initialize:', e);
      if (typeof errorTracker !== 'undefined') errorTracker.captureException(e);
    }
  }, 100);

})();