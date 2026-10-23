/** QA fix pengunci lisensi cloudCtx rosok: tanpa lisensi → 🔒; lisensi aktif → guard lolos. */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const browser = await chromium.launch({ channel: 'chrome' });

async function safeEval(page, fn) {
  for (let i = 0; i < 8; i++) {
    try { await page.waitForLoadState('domcontentloaded'); return await page.evaluate(fn); }
    catch (e) { if (i === 7) throw e; await page.waitForTimeout(1200); }
  }
}
async function toastSettle(page) {
  for (let i = 0; i < 20; i++) {
    const s = await page.evaluate(() => document.getElementById('toast')?.classList.contains('show') || false);
    if (!s) return;
    await page.waitForTimeout(250);
  }
}
async function waitToast(page, re, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => ({ txt: document.getElementById('toast')?.textContent || '', show: document.getElementById('toast')?.classList.contains('show') || false }));
    if (s.show && re.test(s.txt)) return s.txt;
    await page.waitForTimeout(250);
  }
  return null;
}
async function openSettings(page) {
  await page.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  // initApp bisa selesai KETIKA router:ready menavigasi ulang ke dashboard —
  // poll sampai layar pengaturan stabil.
  for (let i = 0; i < 24; i++) {
    const okScr = await safeEval(page, () => {
      document.getElementById('profileBanner')?.classList.remove('show');
      document.getElementById('sheetRestoreOffer')?.classList.remove('show');
      window.showScreen?.('pengaturan');
      return [...document.querySelectorAll('section[id^="screen-"]')].find(s => getComputedStyle(s).display !== 'none')?.id === 'screen-pengaturan';
    });
    if (okScr) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
  await toastSettle(page);
}

// ══ A. TANPA lisensi (konteks baru = tier gratis) → 🔒 harus MENOLAK ════════
const ctxA = await browser.newContext({ viewport: { width: 420, height: 900 } });
const a = await ctxA.newPage();
const aErr = [];
a.on('pageerror', (e) => aErr.push('PAGEERROR: ' + e.message));
await openSettings(a);
// Cek selera pemilik: bar kuota HIJAU SOLID, bukan gradasi
const bar = await safeEval(a, () => {
  const s = document.querySelector('#licenseInfoCard .license-progress span');
  const cs = s ? getComputedStyle(s) : null;
  return cs ? { bg: cs.backgroundImage, color: cs.backgroundColor } : null;
});
ok('Bar kuota: hijau SOLID tanpa gradasi', !!bar && bar.bg === 'none' && /rgb\(63, 140, 82\)/.test(bar.color), JSON.stringify(bar));
await a.locator('div.setting-row[onclick="cloudSaveBackup()"]').click();
const ta = await waitToast(a, /lisensi aktif|tersimpan ke cloud|Gagal simpan|Tidak ada koneksi|muat ulang|Sesi server/);
ok('A Save tanpa lisensi → toast 🔒', !!ta && /lisensi aktif/.test(ta), String(ta));
await a.waitForTimeout(400);
const sheetA = await safeEval(a, () => getComputedStyle(document.getElementById('sheetPurchase')).display !== 'none');
ok('A Save terkunci → sheet Beli Lisensi TERBUKA (paritas kaki5)', sheetA);
if (sheetA) { await safeEval(a, () => window.closeSheet('sheetPurchase')); await a.waitForTimeout(400); await toastSettle(a); }
await a.locator('div.setting-row[onclick="cloudRestoreLatest()"]').click();
const tb = await waitToast(a, /lisensi aktif|tersimpan|modal|Belum ada|Gagal ambil/);
ok('A Restore tanpa lisensi → toast 🔒', !!tb && /lisensi aktif/.test(tb), String(tb));
const sheetB = await safeEval(a, () => getComputedStyle(document.getElementById('sheetPurchase')).display !== 'none');
ok('A Restore terkunci → sheet Beli Lisensi TERBUKA', sheetB);
if (sheetB) { await safeEval(a, () => window.closeSheet('sheetPurchase')); await a.waitForTimeout(300); }
ok('A tanpa pageerror', aErr.length === 0, aErr.join(' | ').slice(0, 120));
await ctxA.close();

// ══ B. LISPENSI AKTIF (suntik settings.license) → guard harus LOLOS ════════
const ctxB = await browser.newContext({ viewport: { width: 420, height: 900 } });
const b = await ctxB.newPage();
const bErr = [];
b.on('pageerror', (e) => bErr.push('PAGEERROR: ' + e.message));
await openSettings(b);
const injectLic = () => safeEval(b, async () => {
  const { db } = await import('/js/db.js');
  await db.settings.put({ key: 'license', value: { status: 'active', startedAt: new Date().toISOString(), serial: 'KSR-QA-TEST-AKTIF', deviceCode: 'QA-TEST' } });
});
await injectLic();
await b.waitForTimeout(3500); // beri jalur sync/gate boot selesai (bisa downgrade trial)
await injectLic();             // inject ulang deterministik
await toastSettle(b);
await safeEval(b, () => document.getElementById('sheetRestoreOffer')?.classList.remove('show'));
await b.locator('div.setting-row[onclick="cloudSaveBackup()"]').click();
const tc = await waitToast(b, /lisensi aktif|tersimpan ke cloud|Gagal simpan|Tidak ada koneksi|muat ulang|Sesi server/, 25000);
ok('B Save dengan lisensi aktif → guard LOLOS (bukan 🔒)', !!tc && !/lisensi aktif/.test(tc), String(tc));
const sheetB2 = await safeEval(b, () => getComputedStyle(document.getElementById('sheetPurchase')).display !== 'none');
ok('B berlisensi → sheet Beli TIDAK terbuka (tanpa false positive)', !sheetB2);
ok('B tanpa pageerror', bErr.length === 0, bErr.join(' | ').slice(0, 120));
await ctxB.close();

await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
