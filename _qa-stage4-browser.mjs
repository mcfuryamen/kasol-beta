import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const cases = [
  { name: 'kaki5', url: 'http://127.0.0.1:8086/', title: /Kasir|Kaki5|Warung/i },
  { name: 'rosok', url: 'http://127.0.0.1:8084/', title: /Rosok|Kasir/i },
];
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let failed = 0;
for (const item of cases) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const failedResponses = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  page.on('response', (res) => { if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`); });
  try {
    const response = await page.goto(item.url, { waitUntil: 'networkidle', timeout: 30000 });
    const title = await page.title();
    const body = await page.locator('body').innerText();
    const expectedAuthNoise = failedResponses.filter((entry) => /supabase\.co|auth|rest\/v1/i.test(entry));
    const unexpectedErrors = errors.filter((error) => !/401|403|Failed to load resource/i.test(error));
    const ok = response?.ok() && item.title.test(title + '\n' + body) && unexpectedErrors.length === 0;
    console.log(`${ok ? '✓' : '✗'} ${item.name}: HTTP ${response?.status()} title="${title}" auth/network=${expectedAuthNoise.length} unexpected=${unexpectedErrors.length}`);
    for (const entry of failedResponses.slice(0, 5)) console.log(`  response: ${entry}`);
    if (!ok) { failed++; for (const error of unexpectedErrors.slice(0, 5)) console.log(`  ${error}`); }
  } catch (error) {
    failed++;
    console.log(`✗ ${item.name}: ${error.message}`);
  } finally { await page.close(); }
}
await browser.close();
if (failed) process.exit(1);
console.log('✓ Stage 4 browser smoke test lulus');
