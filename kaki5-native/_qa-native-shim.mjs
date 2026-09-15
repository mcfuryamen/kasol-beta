// QA shim Web Bluetooth (native-bridge.js) tanpa perangkat fisik.
// Mock window.Capacitor.Plugins.BluetoothLe persis kontrak plugin
// @capacitor-community/bluetooth-le lalu drive jalur UI + window.printer.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8087';
const results = [];
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// ── Skenario 1: lingkungan APK (Capacitor mock) → shim aktif + alur cetak ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const calls = { writes: [], writeCount: 0, init: 0, requestDevice: 0, connect: 0, listeners: [] };
  const SVC = '000018f0-0000-1000-8000-00805f9b34fb';
  const CHR = '00002af1-0000-1000-8000-00805f9b34fb';
  await ctx.addInitScript(`
    window.__KSR_FORCE_BT_SHIM = true;
    window.__bt = { writes: [], writeCount: 0, init: 0, requestDevice: 0, connect: 0, listeners: [] };
    const SVC = '000018f0-0000-1000-8000-00805f9b34fb';
    const CHR = '00002af1-0000-1000-8000-00805f9b34fb';
    window.Capacitor = { Plugins: { BluetoothLe: {
      initialize: async () => { window.__bt.init++; },
      requestDevice: async () => { window.__bt.requestDevice++; return { deviceId: 'TEST-01', name: 'TEST-PRINTER RPP58' }; },
      connect: async () => { window.__bt.connect++; },
      disconnect: async () => {},
      discoverServices: async () => {},
      getServices: async () => ({ services: [ { uuid: SVC, characteristics: [
        { uuid: CHR, properties: { write: true, writeWithoutResponse: true }, descriptors: [] }
      ] } ] }),
      write: async (o) => { window.__bt.writes.push(o); window.__bt.writeCount++; },
      writeWithoutResponse: async (o) => { window.__bt.writes.push(o); window.__bt.writeCount++; },
      addListener: async (name, cb) => { window.__bt.listeners.push(name); return { remove: async () => {} }; }
    } } };
  `);
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const badResponses = [];
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('127.0.0.1:8087')) badResponses.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2500);

  // First-run: tutup modal Syarat & Ketentuan + banner profil bila muncul
  const tc = page.locator('#tcModal.show [data-action="accept-tc"]');
  if (await tc.count()) {
    await tc.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
  const dismiss = page.locator('[data-action="dismiss-profile-banner"]');
  if (await dismiss.count()) {
    await dismiss.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
  // Jika masih ada overlay first-run lain, bersihkan (QA saja)
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay.show, #profileBanner.show')
      .forEach((m) => m.classList.remove('show'));
  });

  const native = await page.evaluate(() => ({ flag: !!window.KASIRSOLO_NATIVE, bt: typeof navigator.bluetooth, init: window.__bt.init }));
  check('native flag + navigator.bluetooth terpasang', native.flag && native.bt === 'object', JSON.stringify(native));

  // Jalur UI: buka Pengaturan, klik baris Hubungkan Printer
  const navBtn = page.locator('[data-page="pengaturan"], [data-page="settings"]').first();
  let uiPath = false;
  if (await navBtn.count()) {
    await navBtn.click();
    await page.waitForTimeout(600);
    const row = page.locator('[data-action="connect-printer"]').first();
    if (await row.count()) {
      await row.click();
      uiPath = true;
    }
  }
  if (!uiPath) await page.evaluate(() => window.connectBTPrinter());
  await page.waitForFunction(() => {
    const el = document.getElementById('btPrinterStatus');
    return el && el.textContent.includes('Terhubung');
  }, { timeout: 8000 }).catch(() => {});
  const status = await page.evaluate(() => document.getElementById('btPrinterStatus')?.textContent);
  check('konek printer via shim → status "Terhubung"', /Terhubung/.test(status || ''), `status="${status}"`);
  const rd = await page.evaluate(() => window.__bt.requestDevice);
  check('requestDevice terpanggil (izin+scan native)', rd === 1, `requestDevice=${rd}`);

  // Test print
  await page.evaluate(() => window.testPrint());
  await page.waitForFunction(() => window.__bt.writeCount > 0, null, { timeout: 15000 }).catch(() => {});
  const print = await page.evaluate(() => ({
    count: window.__bt.writeCount,
    first: window.__bt.writes[0] ? Array.from(atob(window.__bt.writes[0].value)).slice(0, 2).map((c) => c.charCodeAt(0)) : null,
    svc: window.__bt.writes[0]?.service,
    totalBytes: window.__bt.writes.reduce((a, w) => a + atob(w.value).length, 0)
  }));
  check('testPrint mengirim bytes ESC+@ via write', print.count > 0 && print.first?.[0] === 27 && print.first?.[1] === 64, JSON.stringify(print));
  check('write ke service thermal 18f0', print.svc === '000018f0-0000-1000-8000-00805f9b34fb', String(print.svc));
  await page.screenshot({ path: '_qa-shim-connect.png' });

  check('tanpa 404 aset saat boot', badResponses.length === 0, badResponses.join('; ') || 'bersih');
  check('console tanpa error saat boot+print', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || 'bersih');
  await ctx.close();
}

// ── Skenario 2: lingkungan web polos (tanpa Capacitor) → shim no-op ──
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  const env = await page.evaluate(() => ({ flag: !!window.KASIRSOLO_NATIVE, bt: typeof navigator.bluetooth }));
  // Di desktop Chrome navigator.bluetooth bisa ada BAKU (Web Bluetooth asli);
  // yang diuji: shim TIDAK menyalakan flag native tanpa Capacitor.
  check('di web polos flag native TIDAK menyala (shim no-op)', !env.flag, JSON.stringify(env));
  check('web polos tanpa pageerror', errs.length === 0, errs.slice(0, 2).join(' | ') || 'bersih');
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} lulus`);
process.exit(fails ? 1 : 0);
