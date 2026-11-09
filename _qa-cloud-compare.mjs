/** QA perilaku tombol "Cadangan Cloud" & "Pulihkan Cloud": rosok (8084) vs kaki5 (8086). */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });

async function toastSettle(page) {
  for (let i = 0; i < 20; i++) {
    const s = await page.evaluate(() => document.getElementById('toast')?.classList.contains('show') || false);
    if (!s) return;
    await page.waitForTimeout(250);
  }
}
async function waitToast(page, re, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => ({ txt: document.getElementById('toast')?.textContent || '', show: document.getElementById('toast')?.classList.contains('show') || false }));
    if (s.show && re.test(s.txt)) return s.txt;
    await page.waitForTimeout(250);
  }
  return null;
}

// ══ ROSOK ══════════════════════════════════════════════════════════════════
const r = await ctx.newPage();
const rErr = [];
r.on('pageerror', (e) => rErr.push('PAGEERROR: ' + e.message));
await r.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await r.waitForTimeout(2200);
await r.evaluate(() => { document.getElementById('profileBanner')?.classList.remove('show'); window.showScreen('pengaturan'); });
await r.waitForTimeout(400);
await toastSettle(r);
await r.locator('div.setting-row[onclick="cloudSaveBackup()"]').click();
let rt = await waitToast(r, /tersimpan ke cloud|lisensi aktif|Gagal simpan/);
ok('R Cadangan Cloud: hasil tegas (sukses/guard/gagal)', !!rt, String(rt));
const rSaved = !!(rt && /tersimpan ke cloud/.test(rt));
await r.locator('div.setting-row[onclick="cloudRestoreLatest()"]').click();
let modalR = false, rt2 = null;
for (let i = 0; i < 24 && !modalR && !rt2; i++) {
  await r.waitForTimeout(350);
  modalR = await r.evaluate(() => document.getElementById('confirmModal').classList.contains('show'));
  if (!modalR) rt2 = await r.evaluate(() => {
    const t = document.getElementById('toast');
    return (t?.classList.contains('show') && /lisensi aktif|Belum ada cadangan|Gagal ambil/.test(t.textContent)) ? t.textContent : null;
  });
}
ok('R Pulihkan Cloud: jalur jelas (modal konfirmasi ATAU toast informatif)', modalR || !!rt2, modalR ? 'modal konfirmasi muncul' : String(rt2));
if (modalR) { await r.evaluate(() => document.getElementById('confirmCancelBtn').click()); await r.waitForTimeout(300); }
console.log('   → rosok: save =', rSaved ? 'SUKSES (lisensi aktif)' : 'guard/gagal');
ok('R tanpa pageerror', rErr.length === 0, rErr.join(' | ').slice(0, 120));
await r.close();

// ══ KAKI5 ══════════════════════════════════════════════════════════════════
const k = await ctx.newPage();
const kErr = [];
k.on('pageerror', (e) => kErr.push('PAGEERROR: ' + e.message));
await k.goto('http://127.0.0.1:8086/index.html', { waitUntil: 'domcontentloaded' });
await k.waitForTimeout(3000);
for (let i = 0; i < 4; i++) {
  await k.evaluate(() => {
    const b = document.getElementById('profileBanner'); if (b) b.classList.remove('show');
    const t = document.getElementById('tcModal'); if (t) t.classList.remove('show');
  });
  await k.waitForTimeout(300);
}
await k.evaluate(() => document.querySelector('[data-page="pengaturan"]')?.click());
await k.waitForTimeout(600);
await toastSettle(k);
// Klik Cadangan Cloud — catat hasil: sukses / guard+sheet pembelian
await k.evaluate(() => document.querySelector('[data-action="cloud-backup"]')?.click());
let kt = await waitToast(k, /tersimpan ke cloud|khusus lisensi aktif|Gagal simpan|Tidak bisa terhubung/, 20000);
const kSheet = await k.evaluate(() => getComputedStyle(document.getElementById('sheetPurchase')).display !== 'none');
ok('K Cadangan Cloud: hasil tegas', !!kt, String(kt));
console.log('   → kaki5: save =', kt && /tersimpan ke cloud/.test(kt) ? 'SUKSES (lisensi aktif)' : 'guard/gagal', kSheet ? '+ sheet pembelian terbuka' : '');
if (kSheet) { await k.evaluate(() => window._ksr_closeSheet?.('sheetPurchase')); await k.waitForTimeout(400); }
await toastSettle(k);
// Klik Pulihkan Cloud
await k.evaluate(() => document.querySelector('[data-action="cloud-restore-latest"]')?.click());
let kModal = false, kt2 = null;
for (let i = 0; i < 30 && !kModal && !kt2; i++) {
  await k.waitForTimeout(350);
  kModal = await k.evaluate(() => document.getElementById('confirmModal')?.classList.contains('show'));
  if (!kModal) kt2 = await k.evaluate(() => {
    const t = document.getElementById('toast');
    return (t?.classList.contains('show') && /khusus lisensi aktif|Belum ada cadangan|Gagal ambil|cadangan cloud/.test(t.textContent)) ? t.textContent : null;
  });
}
ok('K Pulihkan Cloud: jalur jelas (modal ATAU toast informatif/guard)', kModal || !!kt2, kModal ? 'modal konfirmasi muncul' : String(kt2));
if (kModal) {
  const mtxt = await k.evaluate(() => document.getElementById('confirmText').textContent);
  console.log('   → kaki5 restore modal:', mtxt.slice(0, 120));
  await k.evaluate(() => document.getElementById('confirmCancelBtn').click());
  await k.waitForTimeout(300);
}
ok('K tanpa pageerror', kErr.length === 0, kErr.join(' | ').slice(0, 120));
await k.close();

await browser.close();
console.log(`\n${results.filter(x => x.pass).length}/${results.length} PASS`);
