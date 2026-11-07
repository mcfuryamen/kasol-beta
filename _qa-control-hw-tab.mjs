/** QA: tab hardware di modul Konten Web control menampilkan JSON shape baru (6 produk). */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:8082/#content', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
// Editor JSON (about/site/hardware/...) ada di dalam tab "Lainnya (JSON)"
await page.locator('.content-tab', { hasText: 'Lainnya' }).click();
await page.waitForTimeout(800);

// Buka accordion JSON "hardware"
const res = await page.evaluate(() => {
  const details = Array.from(document.querySelectorAll('details.content-json'));
  const hw = details.find((d) => /mesin kasir/i.test(d.querySelector('summary')?.textContent || ''));
  if (!hw) return { found: false };
  hw.open = true;
  const ta = hw.querySelector('textarea');
  let parsed = null;
  try { parsed = JSON.parse(ta.value); } catch (e) { return { found: true, parseError: String(e) }; }
  return {
    found: true,
    produk: Array.isArray(parsed) ? parsed.length : null,
    first: Array.isArray(parsed) ? parsed[0]?.name : null,
    hasReview: Array.isArray(parsed) && !!parsed[0]?.review,
    hasSpecs: Array.isArray(parsed) && Array.isArray(parsed[0]?.specs),
    saveBtn: !!hw.querySelector('[data-savejson="hardware"]'),
  };
});
console.log(JSON.stringify(res));
console.log(errors.length ? 'PAGEERROR: ' + errors.join('|') : 'console bersih');
await page.screenshot({ path: 'C:/Users/Admin/Documents/kasol/_qa-gui-screenshots/qh5-control-tab.png', fullPage: false });
await browser.close();
process.exit(res.found && res.produk === 6 && res.hasReview && res.hasSpecs && res.saveBtn && !errors.length ? 0 : 1);
