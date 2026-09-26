/** QA lisensi pasca-hapus manual+WA (rosok & kaki5) + uji injeksi M6 (mock Supabase route). */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });

// ══ ROSOK (8084) ═══════════════════════════════════════════════════════════
const r = await ctx.newPage();
const rErr = [];
r.on('pageerror', (e) => rErr.push('PAGEERROR: ' + e.message));
await r.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await r.waitForTimeout(2200);
await r.evaluate(() => document.getElementById('profileBanner')?.classList.remove('show'));
await r.evaluate(() => window.showScreen('pengaturan'));
await r.waitForTimeout(500);
const rc = await r.evaluate(() => {
  const card = document.getElementById('licenseInfoCard');
  return {
    steps: !!card.querySelector('.license-steps'),
    waBtn: /WhatsApp|Hubungi Admin/.test(card.textContent),
    manual: /Aktivasi Manual|Aktifkan Kode|Sudah punya kode/i.test(card.textContent),
    buy: !!card.querySelector('[onclick*="openPurchaseSheet"]'),
    activeCard: !!card.querySelector('.license-card-active'),
    refresh: !!card.querySelector('[onclick*="_ksr_refreshLicenseStatus"]')
  };
});
ok('R kartu: stepper 4 tahap ada', rc.steps);
ok('R kartu: TANPA tombol WhatsApp', !rc.waBtn);
ok('R kartu: TANPA aktivasi manual', !rc.manual);
ok('R kartu: tombol Beli Lisensi ada', rc.buy);
if (rc.activeCard) {
  const done = await r.evaluate(() => [...document.querySelectorAll('#licenseInfoCard .license-step')].filter(s => s.classList.contains('is-done')).length);
  ok('R kartu AKTIF: stepper sampai langkah 4 (3 done)', done === 3, `done=${done}`);
  ok('R kartu AKTIF: tombol Refresh Status ada', rc.refresh);
  await r.evaluate(() => window._ksr_refreshLicenseStatus());
  await r.waitForTimeout(1200);
  const chip = await r.evaluate(() => document.getElementById('trialChip').textContent);
  ok('R Refresh Status: chip ikut ter-render ulang', /Aktif|GRATIS/.test(chip), chip);
} else {
  ok('R kartu AKTIF (skip — QA origin tier trial)', true);
}
// Sheet lisensi tanpa manual/WA
await r.evaluate(() => window.openLicenseSheet());
await r.waitForTimeout(600);
const rs = await r.evaluate(() => {
  const b = document.getElementById('licenseSheetBody');
  return { manual: /Aktivasi Manual|Aktifkan Kode|Sudah punya kode/i.test(b.textContent), wa: /WhatsApp/i.test(b.textContent), shown: getComputedStyle(document.getElementById('sheetLicense')).display !== 'none' };
});
ok('R sheet lisensi terbuka', rs.shown);
ok('R sheet lisensi: TANPA aktivasi manual & WA', !rs.manual && !rs.wa, JSON.stringify(rs));
await r.evaluate(() => window.closeSheet('sheetLicense'));
// Sheet beli + uji injeksi M6 (mock route Supabase)
await r.route('**/rest/v1/settings**', (route) => {
  const u = route.request().url();
  const accept = route.request().headers()['accept'] || '';
  const isObject = accept.includes('vnd.pgrst.object');
  let val = {};
  if (u.includes('qris_url')) val = { url: 'javascript:alert(1)' };
  else if (u.includes('bank_info')) val = { bank: '<img src=x onerror=window.__xss=1>', account_number: '"><script>alert(2)</script>', account_name: '<b>PT</b>' };
  const body = isObject ? JSON.stringify({ value: JSON.stringify(val) }) : JSON.stringify([{ value: JSON.stringify(val) }]);
  return route.fulfill({ status: 200, contentType: 'application/json', body });
});
await r.route('**/rest/v1/products**', (route) => {
  const accept = route.request().headers()['accept'] || '';
  const isObject = accept.includes('vnd.pgrst.object');
  const row = { name: 'KSR', price_label: '<u>hack</u>', price_before_label: '<i>x</i>' };
  const body = isObject ? JSON.stringify(row) : JSON.stringify([row]);
  return route.fulfill({ status: 200, contentType: 'application/json', body });
});
await r.evaluate(() => window._ksr_openPurchaseSheet());
await r.waitForTimeout(1800);
const rm = await r.evaluate(() => {
  const b = document.getElementById('purchaseSheetBody');
  return {
    xss: window.__xss === 1,
    qrisFallback: /QRIS belum diatur/.test(b.textContent),
    qrisHref: !!b.querySelector('a[href^="javascript"]'),
    bankLiteral: b.textContent.includes('<img src=x onerror=window.__xss=1>'),
    bankTag: !!b.querySelector('img[src="x"]'),
    priceLiteral: b.textContent.includes('<u>hack</u>'),
    priceTag: !!b.querySelector('u'),
    scriptInjected: !!b.querySelector('script')
  };
});
ok('R M6: QRIS non-https → fallback "belum diatur"', rm.qrisFallback && !rm.qrisHref);
ok('R M6: injeksi onerror TIDAK dieksekusi', !rm.xss);
ok('R M6: bank dirender sebagai TEKS (ter-escape), bukan tag', rm.bankLiteral && !rm.bankTag);
ok('R M6: label harga ter-escape', rm.priceLiteral && !rm.priceTag);
ok('R M6: tidak ada <script> tersuntik', !rm.scriptInjected);
ok('R tanpa pageerror', rErr.length === 0, rErr.join(' | ').slice(0, 120));
await r.screenshot({ path: '_qa-gui-screenshots/after-rosok-lisensi.png' });
await r.close();

// ══ KAKI5 (8086) ═══════════════════════════════════════════════════════════
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
await k.waitForTimeout(700);
const kc = await k.evaluate(() => {
  const card = document.getElementById('licenseInfoCard');
  return {
    steps: !!card.querySelector('.license-steps'),
    waBtn: /WhatsApp|Hubungi Admin/.test(card.textContent),
    manual: /Aktivasi manual|Aktifkan Kode|Sudah punya kode/i.test(card.textContent),
    buy: !!card.querySelector('[data-action="open-purchase-sheet"]')
  };
});
ok('K kartu: stepper ada', kc.steps);
ok('K kartu: TANPA tombol WhatsApp', !kc.waBtn);
ok('K kartu: TANPA aktivasi manual', !kc.manual);
ok('K kartu: tombol Beli ada', kc.buy);
// Sheet lisensi kaki5
await k.evaluate(() => document.getElementById('trialChip')?.click());
await k.waitForTimeout(700);
const ks = await k.evaluate(() => {
  const b = document.getElementById('licenseSheetBody');
  return { shown: getComputedStyle(document.getElementById('sheetLicense')).display !== 'none', manual: /Aktivasi manual|Aktifkan Kode|Sudah punya kode/i.test(b?.textContent || ''), wa: /WhatsApp/i.test(b?.textContent || '') };
});
ok('K sheet lisensi terbuka', ks.shown);
ok('K sheet lisensi: TANPA aktivasi manual & WA', !ks.manual && !ks.wa, JSON.stringify(ks));
// Wire: handler lama benar-benar hilang
const kw = await k.evaluate(() => ({
  act: typeof window._ksr_activateLicense,
  wa: typeof window._ksr_contactViaWA,
  mk: typeof window._ksr_toggleManualKey
}));
ok('K window handler lama hilang', kw.act === 'undefined' && kw.wa === 'undefined' && kw.mk === 'undefined', JSON.stringify(kw));
ok('K tanpa pageerror', kErr.length === 0, kErr.join(' | ').slice(0, 120));
await k.screenshot({ path: '_qa-gui-screenshots/after-kaki5-lisensi.png' });
await k.close();

await browser.close();
console.log(`\n${results.filter(x => x.pass).length}/${results.length} PASS`);
process.exit(results.some(x => !x.pass) ? 1 : 0);
