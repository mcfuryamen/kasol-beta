const { chromium } = require('C:\\Users\\Admin\\AppData\\Roaming\\npm\\node_modules\\@playwright\\mcp\\node_modules\\playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\Admin\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:20221/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    return {
      title: document.title,
      font: getComputedStyle(document.body).fontFamily,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      manifestHref: manifestLink ? manifestLink.href : null,
    };
  });

  // Check service worker registration (may take a moment)
  await page.waitForTimeout(2500);
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'no-sw-support';
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? 'registered' : 'not-registered';
  });

  console.log('=== TPA LANDING + PWA ===');
  console.log('Title:', info.title);
  console.log('Font:', info.font);
  console.log('Body BG:', info.bodyBg);
  console.log('Manifest:', info.manifestHref);
  console.log('SW State:', swState);
  console.log('Console errors:', errors.length);
  errors.forEach(e => console.log('  ERR:', e.slice(0, 150)));

  await page.screenshot({ path: 'C:\\Users\\Admin\\Documents\\kasol\\tpa\\_verify_pwa.png', fullPage: false });
  await browser.close();
  console.log('Screenshot: _verify_pwa.png');
})();
