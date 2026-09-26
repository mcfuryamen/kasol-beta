/** Pulihkan state origin QA pasca-uji + konfirmasi identitas asli. */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
const r = await page.evaluate(async () => {
  const { setSetting, getSetting } = await import('./js/utils.js');
  // Identitas asli QA origin: fingerprint emulasi Playwright → 00O1-5RD4.
  const L = await import('./js/license.js');
  const fp = await L.getDeviceFingerprint(); // fingerprint asli engine ini
  await setSetting('deviceIdentity', {
    installId: 'DEV-FDE722088D3CA569386DDBCD81B6EC',
    deviceCode: '00O1-5RD4', fingerprint: fp,
    candidateCode: '00O1-5RD4', fpVersion: 'V5', legacyDeviceCode: ''
  });
  await setSetting('unitId', 'KSR-00O1-5RD4');
  await setSetting('unitReanchor', null);
  const di = await getSetting('deviceIdentity', null);
  const anchored = L.getDeviceCode(di.fingerprint) === di.deviceCode;
  return { unitId: await getSetting('unitId', null), fpVersion: di.fpVersion, anchored };
});
console.log('restore:', JSON.stringify(r));
await browser.close();
