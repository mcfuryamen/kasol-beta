/** Probe sinyal fingerprint di Playwright Chrome (penjelajahan 00O1-5RD4). */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const sig = await page.evaluate(async () => {
  const L = await import('./js/license.js');
  return {
    hc: navigator.hardwareConcurrency, dm: navigator.deviceMemory,
    tp: navigator.maxTouchPoints, w: screen.width, h: screen.height,
    code: (await L.getDeviceIdentity()).deviceCode
  };
});
console.log('Playwright Chrome sinyal:', JSON.stringify(sig));
await browser.close();
