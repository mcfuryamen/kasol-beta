/** Probe export rosok: klik Simpan Cadangan, dump toast/download/error. */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });
await page.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await page.evaluate(() => { document.getElementById('profileBanner')?.classList.remove('show'); window.showScreen('pengaturan'); });
await page.waitForTimeout(300);
const probe = page.evaluate(async () => {
  try {
    const { db } = await import('/js/db.js');
    return { kategori: await db.kategori.count() };
  } catch (e) { return 'db import gagal: ' + e.message; }
});
console.log('DB counts:', JSON.stringify(await probe));
page.waitForEvent('download', { timeout: 8000 }).then(d => console.log('DOWNLOAD:', d.suggestedFilename())).catch(() => console.log('DOWNLOAD: TIDAK ADA'));
await page.locator('div.setting-row[onclick="exportData()"]').click();
await page.waitForTimeout(2500);
const st = await page.evaluate(() => ({
  toast: document.getElementById('toast').textContent,
  toastShow: document.getElementById('toast').classList.contains('show'),
  loadingVisible: (() => { const l = document.getElementById('loadingOverlay'); return l ? getComputedStyle(l).display : 'n/a'; })()
}));
console.log('STATE:', JSON.stringify(st));
console.log('PAGEERRORS:', errors.length, errors.join(' | ').slice(0, 200));
await browser.close();
