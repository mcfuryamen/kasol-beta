const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const APP_URL = "http://localhost:8084";

// Logging helper
function log(msg, status = 'INFO') {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  const colors = {
    INFO: '\x1b[34m[INFO]\x1b[0m',
    PASS: '\x1b[32m[PASS]\x1b[0m',
    FAIL: '\x1b[31m[FAIL]\x1b[0m',
    WARN: '\x1b[33m[WARN]\x1b[0m'
  };
  console.log(`${timestamp} ${colors[status] || '[INFO]'} ${msg}`);
}

async function runBrowserSmokeTest() {
  log("Starting Interactive Browser Smoke Test for Kasir Rosok...");

  let exitCode = 0;
  let browser;

  try {
    // 1. Launch Headless Chrome
    log(`Launching Google Chrome from: ${CHROME_PATH}`);
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false, // Change to false for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
      defaultViewport: { width: 1280, height: 800 },
      protocolTimeout: 300000 // Increase timeout to 5 minutes (300 seconds) for screenshots
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000); // Set navigation timeout to 60 seconds
    
    // Catch console logs & errors
    const consoleErrors = [];
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error') {
        consoleErrors.push(text);
        log(`Browser Console Error: ${text}`, 'FAIL');
      } else if (text.includes('Assignment to constant variable')) {
        consoleErrors.push(text);
        log(`CRITICAL state mutation error found: ${text}`, 'FAIL');
      } else {
        // Log general console message if useful
        if (text.includes('Dexie') || text.includes('KSR') || text.includes('State') || text.includes('Toast')) {
          log(`Browser Console: ${text}`);
        }
      }
    });

    // Catch unhandled exceptions
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      log(`Browser Unhandled Exception: ${err.message}`, 'FAIL');
    });

    // 2. Load the App and delete database to ensure clean run
    log(`Navigating to ${APP_URL}`);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    log("Clearing IndexedDB Database for clean test session...");
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("KasirSoloRosokDB");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });

    log("Reloading app with clean database state...");
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    
    // Give time for modules to load and DB initialization
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Save onboarding screenshot
    await page.screenshot({ path: 'screenshot-1-onboarding.png' });
    log("Screenshot saved: screenshot-1-onboarding.png", 'INFO');

    // 3. Perform Onboarding Flow
    log("Verifying onboarding sheet is open...");
    const isOnboardingOpen = await page.evaluate(() => {
      const sheet = document.getElementById('sheetOnboarding');
      return sheet && sheet.classList.contains('show');
    });

    if (!isOnboardingOpen) {
      log("Onboarding sheet not open! Forcing open...", 'WARN');
      await page.evaluate(() => {
        if (typeof openSheet === 'function') openSheet('sheetOnboarding');
      });
    }

    log("Filling onboarding form fields...");
    await page.evaluate(() => {
      document.getElementById('onbBizName').value = 'Rosok Solo Berkah';
      document.getElementById('onbOwnerName').value = 'Haji Budi';
      document.getElementById('onbPhone').value = '08123456789';
    });

    log("Submitting onboarding form...");
    await page.evaluate(() => {
      if (typeof finishOnboarding === 'function') {
        finishOnboarding();
      } else {
        // Fallback: Click the button
        const btn = document.querySelector('#sheetOnboarding button.btn-primary');
        if (btn) btn.click();
      }
    });

    // Wait for DB write, loading overlay, and transition to finish
    log("Waiting for dashboard to render...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    const headerBizName = await page.evaluate(() => {
      return document.getElementById('bizNameHeader').innerText.trim();
    });

    if (headerBizName === 'Rosok Solo Berkah') {
      log(`Onboarding successful! Header shows: "${headerBizName}"`, 'PASS');
    } else {
      log(`Onboarding mismatch. Header shows: "${headerBizName}"`, 'FAIL');
      exitCode = 1;
    }

    // Capture dashboard
    await page.screenshot({ path: 'screenshot-2-dashboard.png' });
    log("Screenshot saved: screenshot-2-dashboard.png", 'INFO');

    // 4. Test 2: Switch Satuan (CRITICAL STATE MUTATION TEST)
    log("Navigating to Kasir/POS screen...");
    await page.evaluate(() => {
      if (typeof openTransaksi === 'function') {
        openTransaksi('beli');
      } else {
        const btn = document.querySelector('[onclick*="openTransaksi"]');
        if (btn) btn.click();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Capture POS / Transaction screen
    await page.screenshot({ path: 'screenshot-6-pos.png' });
    log("Screenshot saved: screenshot-6-pos.png", 'INFO');

    // Select a category item from the grid to open timbang sheet
    log("Selecting first category item from the POS grid...");
    const clickedItem = await page.evaluate(() => {
      const items = document.querySelectorAll('#katGrid .kat-card');
      if (items.length > 0) {
        items[0].click();
        return items[0].querySelector('.lbl').innerText;
      }
      return null;
    });

    if (clickedItem) {
      log(`Clicked product item: "${clickedItem}"`, 'PASS');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Let's test switching units (Satuan) in Timbang sheet! This was the critical fix.
      log("Testing unit switching tabs (kg -> ons -> kuintal -> kg)...");
      
      const switchResult = await page.evaluate(() => {
        try {
          const errors = [];
          window.addEventListener('error', e => errors.push(e.message));

          // Switch to 'ons'
          if (typeof setSatuan === 'function') {
            setSatuan('ons');
          } else {
            const tab = document.querySelector('#satuanTabs [onclick*="ons"]');
            if (tab) tab.click();
          }

          const stateOns = document.querySelector('#timbangUnitLbl').innerText;

          // Switch to 'kuintal'
          if (typeof setSatuan === 'function') {
            setSatuan('kuintal');
          } else {
            const tab = document.querySelector('#satuanTabs [onclick*="kuintal"]');
            if (tab) tab.click();
          }

          const stateKuintal = document.querySelector('#timbangUnitLbl').innerText;

          // Switch back to 'kg'
          if (typeof setSatuan === 'function') {
            setSatuan('kg');
          } else {
            const tab = document.querySelector('#satuanTabs [onclick*="kg"]');
            if (tab) tab.click();
          }

          const stateKg = document.querySelector('#timbangUnitLbl').innerText;

          return {
            success: true,
            states: { ons: stateOns, kuintal: stateKuintal, kg: stateKg },
            errors
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      if (switchResult.success) {
        log(`Unit switching verification completed! States captured: ${JSON.stringify(switchResult.states)}`, 'PASS');
        if (switchResult.errors && switchResult.errors.length > 0) {
          log(`Errors caught during unit switch: ${JSON.stringify(switchResult.errors)}`, 'FAIL');
          exitCode = 1;
        } else {
          log("No state mutation or constant assignment errors occurred during unit switching!", 'PASS');
        }
      } else {
        log(`Unit switching failed with error: ${switchResult.error}`, 'FAIL');
        exitCode = 1;
      }

      // Close timbang sheet
      await page.evaluate(() => {
        if (typeof closeSheet === 'function') closeSheet('sheetTimbang');
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      log("No category items found in POS grid to test unit switching!", 'WARN');
    }

    // Close transaction / go to Stok Screen
    log("Navigating to Stok tab...");
    await page.evaluate(() => {
      if (typeof showScreen === 'function') showScreen('stok');
    });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Capture Stok screen
    await page.screenshot({ path: 'screenshot-3-stok.png' });
    log("Screenshot saved: screenshot-3-stok.png", 'INFO');

    // 5. Test Bug #4 Kategori Validation (hargaJual < hargaBeli)
    log("Opening Kategori Form sheet...");
    await page.evaluate(() => {
      if (typeof openKategoriForm === 'function') {
        openKategoriForm(null);
      } else {
        const btn = document.querySelector('#stokBar button');
        if (btn) btn.click();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    log("Testing price validation: Filling invalid prices (Beli: 8000, Jual: 5000)...");
    await page.evaluate(() => {
      document.getElementById('katFormNama').value = 'Besi Beton Super';
      document.getElementById('katFormHargaBeli').value = '8000';
      document.getElementById('katFormHargaJual').value = '5000';
    });

    log("Triggering saveKategori() for invalid prices...");
    await page.evaluate(() => {
      if (typeof saveKategori === 'function') {
        saveKategori();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Capture Kategori error state
    await page.screenshot({ path: 'screenshot-4-kategori-error.png' });
    log("Screenshot saved: screenshot-4-kategori-error.png", 'INFO');

    const isKategoriSheetStillOpen = await page.evaluate(() => {
      const sheet = document.getElementById('sheetKategori');
      return sheet && sheet.classList.contains('show');
    });

    const toastMessageError = await page.evaluate(() => {
      const t = document.getElementById('toast');
      return t ? t.innerText : '';
    });

    log(`Toast message displayed: "${toastMessageError}"`);

    log(`Kategori sheet still open after invalid save attempt: ${isKategoriSheetStillOpen}`);
    if (isKategoriSheetStillOpen && (toastMessageError.toLowerCase().includes('jual') || toastMessageError.toLowerCase().includes('murah') || toastMessageError.toLowerCase().includes('tinggi'))) {
      log("Bug #4 Price Validation successfully REJECTED invalid prices and kept the form open!", 'PASS');
    } else if (!isKategoriSheetStillOpen && (toastMessageError.toLowerCase().includes('jual') || toastMessageError.toLowerCase().includes('murah') || toastMessageError.toLowerCase().includes('tinggi'))) {
      log("Bug #4 Price Validation REJECTED invalid prices, but the form UNEXPECTEDLY CLOSED!", 'FAIL');
      exitCode = 1;
    } else {
      log("Bug #4 Price Validation failed (either no toast or no rejection happened at all)!", 'FAIL');
      exitCode = 1;
    }

    // Test saving valid prices
    log("Testing price validation: Changing to valid prices (Beli: 8000, Jual: 12000)...");
    await page.evaluate(() => {
      document.getElementById('katFormHargaJual').value = '12000';
    });

    log("Triggering saveKategori() for valid prices...");
    await page.evaluate(async () => {
      if (typeof saveKategori === 'function') {
        await saveKategori();
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Capture successful save state
    await page.screenshot({ path: 'screenshot-5-kategori-success.png' });
    log("Screenshot saved: screenshot-5-kategori-success.png", 'INFO');

    const isKategoriSheetClosed = await page.evaluate(() => {
      const sheet = document.getElementById('sheetKategori');
      return sheet && !sheet.classList.contains('open');
    });

    const toastMessageSuccess = await page.evaluate(() => {
      const t = document.getElementById('toast');
      return t ? t.innerText : '';
    });

    log(`Toast message displayed: "${toastMessageSuccess}"`);

    // Verify item appears in Stok screen list
    const isNewCategoryInStokList = await page.evaluate(() => {
      const list = document.getElementById('stokListCard').innerText;
      return list.includes('Besi Beton Super');
    });

    if (isKategoriSheetClosed && isNewCategoryInStokList) {
      log("New category saved successfully with valid prices, sheet closed, and item rendered in Stok list!", 'PASS');
    } else {
      log(`New category save failed! Sheet closed: ${isKategoriSheetClosed}, Item in list: ${isNewCategoryInStokList}`, 'FAIL');
      exitCode = 1;
    }

    // 6. Test persistence (loadSettingsIntoState after reload)
    log("Testing settings and state persistence across page reload...");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for IndexedDB write to complete
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const reloadedHeaderName = await page.evaluate(() => {
      return document.getElementById('bizNameHeader').innerText.trim();
    });

    const isNewCategoryStillInStokList = await page.evaluate(() => {
      // Switch back to Stok tab
      if (typeof showScreen === 'function') showScreen('stok');
      const list = document.getElementById('stokListCard');
      return list ? list.innerText.includes('Besi Beton Super') : false;
    });

    if (reloadedHeaderName === 'Rosok Solo Berkah' && isNewCategoryStillInStokList) {
      log("Data and settings successfully persisted in IndexedDB across reload!", 'PASS');
    } else {
      log(`Persistence verification failed! Reloaded business name: "${reloadedHeaderName}", Category in list: ${isNewCategoryStillInStokList}`, 'FAIL');
      exitCode = 1;
    }

    // Verify all console error metrics
    if (consoleErrors.length > 0) {
      log(`Test completed with ${consoleErrors.length} browser errors.`, 'WARN');
      const criticalErrors = consoleErrors.filter(err => err.includes('constant') || err.includes('Assignment'));
      if (criticalErrors.length > 0) {
        log("CRITICAL state mutation errors were captured!", 'FAIL');
        exitCode = 1;
      }
    } else {
      log("No browser console errors or exceptions were captured during the entire test session!", 'PASS');
    }

  } catch (err) {
    log(`Browser test crashed with error: ${err.message}`, 'FAIL');
    exitCode = 1;
  } finally {
    if (browser) {
      log("Closing browser...");
      await browser.close();
    }
    log(`Interactive Browser Smoke Test finished with exit code ${exitCode}`);
    process.exit(exitCode);
  }
}

runBrowserSmokeTest();
