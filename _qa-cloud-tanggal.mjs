/** QA: konfirmasi Pulihkan Cloud rosok kini menyebut tanggal cadangan (lastCloudBackupAt). */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
async function safeEval(fn) {
  for (let i = 0; i < 8; i++) {
    try { await page.waitForLoadState('domcontentloaded'); return await page.evaluate(fn); }
    catch (e) { if (i === 7) throw e; await page.waitForTimeout(1200); }
  }
}
await safeEval(() => { document.getElementById('profileBanner')?.classList.remove('show'); window.showScreen('pengaturan'); });
await page.waitForTimeout(400);
async function toastSettle() {
  for (let i = 0; i < 20; i++) {
    const s = await page.evaluate(() => document.getElementById('toast')?.classList.contains('show') || false);
    if (!s) return;
    await page.waitForTimeout(250);
  }
}
async function waitToast(re, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => ({ txt: document.getElementById('toast')?.textContent || '', show: document.getElementById('toast')?.classList.contains('show') || false }));
    if (s.show && re.test(s.txt)) return s.txt;
    await page.waitForTimeout(250);
  }
  return null;
}
// 1. Save → setel lastCloudBackupAt
await toastSettle();
await page.locator('div.setting-row[onclick="cloudSaveBackup()"]').click();
const st = await waitToast(/tersimpan ke cloud|lisensi aktif|Gagal simpan/);
ok('Save cloud: hasil tegas', !!st, String(st));
if (!st || !/tersimpan ke cloud/.test(st)) { console.log('Lanjut tanpa stempel — uji tanggal dilewati'); }
const stamp = await page.evaluate(async () => {
  const { db } = await import('/js/db.js');
  const r = await db.settings.get('lastCloudBackupAt');
  return r ? r.value : null;
});
ok('Stempel lastCloudBackupAt tercatat', !!stamp, String(stamp));
// 2. Restore → modal berisi tanggal
await toastSettle();
await page.locator('div.setting-row[onclick="cloudRestoreLatest()"]').click();
let modalText = null;
for (let i = 0; i < 30 && !modalText; i++) {
  await page.waitForTimeout(350);
  modalText = await page.evaluate(() => document.getElementById('confirmModal').classList.contains('show') ? document.getElementById('confirmText').textContent : null);
}
ok('Modal konfirmasi muncul', !!modalText, (modalText || '').slice(0, 100));
ok('Konfirmasi menyebut TANGGAL cadangan', /\(\d{1,2} \w{3} \d{4} \d{2}\.\d{2}\)/.test(modalText || ''), (modalText || '').slice(0, 120));
if (modalText) { await page.evaluate(() => document.getElementById('confirmCancelBtn').click()); await page.waitForTimeout(300); }
ok('Tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 120));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
