/** QA visual lisensi: screenshot kartu + sheet beli, rosok (8084) vs kaki5 (8086). */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });

// ── ROSOK ──────────────────────────────────────────────────────────────────
const r = await ctx.newPage();
await r.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await r.waitForTimeout(2200);
await r.evaluate(() => document.getElementById('profileBanner')?.classList.remove('show'));
await r.evaluate(() => window.showScreen('pengaturan'));
await r.waitForTimeout(400);
await r.evaluate(() => document.getElementById('licenseInfoCard')?.scrollIntoView({ block: 'center' }));
await r.waitForTimeout(300);
await r.screenshot({ path: '_qa-gui-screenshots/cmp-rosok-lisensi-card.png' });
await r.evaluate(() => window._ksr_openPurchaseSheet());
await r.waitForTimeout(2000);
await r.screenshot({ path: '_qa-gui-screenshots/cmp-rosok-beli-sheet.png' });
const rosokSheet = await r.evaluate(() => ({
  shown: getComputedStyle(document.getElementById('sheetPurchase')).display !== 'none',
  bodyLen: document.getElementById('purchaseSheetBody').innerHTML.length,
  hasQris: !!document.querySelector('#purchaseSheetBody img[alt="QRIS"]'),
  hasBank: /No\. Rekening/.test(document.getElementById('purchaseSheetBody').textContent),
  hasBukti: !!document.getElementById('buktiInput')
}));
console.log('ROSOK beli-sheet:', JSON.stringify(rosokSheet));
await r.close();

// ── KAKI5 ─────────────────────────────────────────────────────────────────
const k = await ctx.newPage();
await k.goto('http://127.0.0.1:8086/index.html', { waitUntil: 'domcontentloaded' });
await k.waitForTimeout(3000);
// Bersihkan overlay boot kaki5 (banner profil + TC) — paksa hide utk keperluan screenshot.
for (let i = 0; i < 4; i++) {
  await k.evaluate(() => {
    const b = document.getElementById('profileBanner'); if (b) b.classList.remove('show');
    const t = document.getElementById('tcModal'); if (t) t.classList.remove('show');
  });
  await k.waitForTimeout(400);
}
await k.evaluate(() => document.querySelector('[data-page="pengaturan"]')?.click());
await k.waitForTimeout(600);
await k.evaluate(() => document.getElementById('licenseInfoCard')?.scrollIntoView({ block: 'center' }));
await k.waitForTimeout(300);
await k.screenshot({ path: '_qa-gui-screenshots/cmp-kaki5-lisensi-card.png' });
const kaki5Card = await k.evaluate(() => ({
  cardLen: document.getElementById('licenseInfoCard').innerHTML.length,
  hasSteps: !!document.querySelector('#licenseInfoCard .license-steps'),
  hasWa: /WhatsApp/.test(document.getElementById('licenseInfoCard').textContent),
  hasManualToggle: !!document.querySelector('#licenseInfoCard .manual-key-toggle'),
  hasProgress: !!document.querySelector('#licenseInfoCard .license-progress')
}));
console.log('KAKI5 card:', JSON.stringify(kaki5Card));
// Sheet lisensi kaki5 (berisi manual key)
const chip = k.locator('#trialChip');
if (await chip.isVisible().catch(() => false)) { await chip.click(); }
else { await k.evaluate(() => document.getElementById('trialChip')?.click()); }
await k.waitForTimeout(600);
await k.screenshot({ path: '_qa-gui-screenshots/cmp-kaki5-sheet-lisensi.png' });
// Sheet beli kaki5: klik tombol beli di sheet lisensi
const bought = await k.evaluate(() => {
  const btn = document.querySelector('#sheetLicense [data-action="open-purchase-sheet"]');
  if (btn) { btn.click(); return true; } return false;
});
await k.waitForTimeout(1800);
await k.screenshot({ path: '_qa-gui-screenshots/cmp-kaki5-beli-sheet.png' });
console.log('KAKI5 beli-sheet diklik dari sheet lisensi:', bought);
await k.close();

await browser.close();
console.log('SELESAI — 4 screenshot di _qa-gui-screenshots/cmp-*');
