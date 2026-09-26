/** QA blok "📱 Perangkat" (Pengaturan rosok): printer BLE connect/test/disconnect+persist, PWA, Cek Data Online. */
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
await page.waitForTimeout(2200);

async function safeEval(fn) {
  for (let i = 0; i < 6; i++) {
    try {
      await page.waitForLoadState('domcontentloaded');
      return await page.evaluate(fn);
    } catch (e) {
      if (i === 5) throw e;
      await page.waitForTimeout(1200);
    }
  }
}
async function toastState() {
  return await safeEval(() => {
    const t = document.getElementById('toast');
    return { txt: t?.textContent || '', show: !!t?.classList.contains('show') };
  });
}
const rowClick = async (sel) => {
  await safeEval(() => window.showScreen('pengaturan'));
  await page.waitForTimeout(250);
  await page.locator(sel).click();
  await page.waitForTimeout(400);
};

await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));

// ── Wire + kondisi awal ───────────────────────────────────────────────────
const w0 = await safeEval(() => ({
  fns: ['connectBTPrinter', 'disconnectBTPrinter', 'testPrint', 'installPwa', 'openCekDataSheet', '_ksr_copyDiag'].map(f => ({ f, ok: typeof window[f] === 'function' })),
  status: document.getElementById('btPrinterStatus').textContent,
  pwaRow: document.getElementById('rowInstallPwa').style.display
}));
for (const f of w0.fns) ok(`Wire: window.${f.f} terpasang`, f.ok);
ok('Wire: status printer awal "Belum terhubung"', w0.status === 'Belum terhubung', w0.status);

// ── 1. Cetak Tes tanpa printer → ditolak ramah ────────────────────────────
await safeEval(() => window.testPrint());
await page.waitForTimeout(300);
let t = await toastState();
ok('Cetak Tes tanpa printer → toast "Hubungkan printer dulu!"', t.show && /Hubungkan printer dulu/i.test(t.txt), t.txt);

// ── 2. Putuskan tanpa printer → toast ─────────────────────────────────────
await safeEval(() => window.disconnectBTPrinter());
await page.waitForTimeout(300);
t = await toastState();
ok('Putuskan tanpa printer → toast "Tidak ada printer terhubung"', t.show && /Tidak ada printer terhubung/i.test(t.txt), t.txt);

// ── 3. Hubungkan — jalur gagal (NotFoundError) ────────────────────────────
await page.evaluate(() => {
  Object.defineProperty(navigator, 'bluetooth', {
    configurable: true,
    value: { requestDevice: async () => { const e = new Error('user cancelled'); e.name = 'NotFoundError'; throw e; } }
  });
});
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(250);
await page.locator('#btPrinterConnectRow').click();
await page.waitForTimeout(500);
t = await toastState();
const s3 = await safeEval(() => document.getElementById('btPrinterStatus').textContent);
ok('Hubungkan gagal (NotFoundError) → toast "Printer tidak ditemukan"', t.show && /tidak ditemukan/i.test(t.txt), t.txt);
ok('Hubungkan gagal: status tetap "Belum terhubung"', s3 === 'Belum terhubung', s3);

// ── 4. Hubungkan — jalur sukses (fake BLE device) ─────────────────────────
await page.evaluate(() => {
  window.__qaWriteLog = [];
  const char = {
    properties: { write: true, writeWithoutResponse: true },
    writeValueWithoutResponse: async (b) => { window.__qaWriteLog.push(Array.from(b)); },
    writeValue: async (b) => { window.__qaWriteLog.push(Array.from(b)); }
  };
  const service = { getCharacteristics: async () => [char] };
  const server = {
    connected: true, disconnectedCalled: false,
    connect: async () => server,
    getPrimaryService: async () => service,
    disconnect: () => { server.connected = false; server.disconnectedCalled = true; if (dev._onDisc) dev._onDisc(); }
  };
  const dev = {
    name: 'RPP-TEST', gatt: server, _onDisc: null,
    addEventListener: (type, fn) => { if (type === 'gattserverdisconnected') dev._onDisc = fn; }
  };
  Object.defineProperty(navigator, 'bluetooth', {
    configurable: true,
    value: { requestDevice: async () => dev }
  });
});
await page.locator('#btPrinterConnectRow').click();
await page.waitForTimeout(600);
t = await toastState();
const s4 = await safeEval(() => ({
  status: document.getElementById('btPrinterStatus').textContent,
  stored: localStorage.getItem('printer_bluetooth_state')
}));
ok('Hubungkan sukses: status "✅ Terhubung: RPP-TEST"', s4.status.includes('Terhubung: RPP-TEST'), s4.status);
ok('Hubungkan sukses: state persisten tersimpan', !!s4.stored && s4.stored.includes('RPP-TEST'), s4.stored);
ok('Hubungkan sukses: toast konfirmasi', t.show && /terhubung/i.test(t.txt), t.txt);

// ── 5. Cetak Tes dengan printer fake → byte terkirim, chunk ≤20 ──────────
await safeEval(() => window.testPrint());
await page.waitForTimeout(900);
const p5 = await safeEval(() => {
  const log = window.__qaWriteLog || [];
  const text = log.map(c => c.map(x => String.fromCharCode(x)).join('')).join('');
  const maxChunk = Math.max(...log.map(c => c.length), 0);
  return { chunks: log.length, maxChunk, hasTes: text.includes('=== TES CETAK ==='), hasDev: text.includes('RPP-TEST'), hasFeed: log.some(c => c.length === 4 && c.every(b => b === 10)) };
});
t = await toastState();
ok('Cetak Tes sukses: toast berhasil', t.show && /Tes cetak berhasil/i.test(t.txt), t.txt);
ok('Cetak Tes: teks tes + nama perangkat terkirim', p5.hasTes && p5.hasDev, JSON.stringify(p5));
ok('Cetak Tes: chunking BLE ≤20 byte', p5.maxChunk <= 20, `max=${p5.maxChunk}, chunks=${p5.chunks}`);
ok('Cetak Tes: feed kertas terkirim', p5.hasFeed);

// ── 6. Putuskan dengan printer terhubung ──────────────────────────────────
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(250);
await page.locator('div.setting-row[onclick="disconnectBTPrinter()"]').click();
await page.waitForTimeout(500);
const s6 = await safeEval(() => ({
  status: document.getElementById('btPrinterStatus').textContent,
  stored: localStorage.getItem('printer_bluetooth_state'),
  discCalled: window.__qaDiscFlag
}));
t = await toastState();
ok('Putuskan: toast "Printer diputus"', t.show && /diputus/i.test(t.txt), t.txt);
ok('Putuskan: state persisten dihapus', s6.stored === null, String(s6.stored));
ok('Putuskan: status kembali tidak terhubung', s6.status === 'Belum terhubung' || s6.status === 'Terputus', s6.status);

// ── 7. Persist status terakhir pasca reload ───────────────────────────────
// Sambung ulang (fake) agar state tersimpan, lalu reload → restore status.
await page.evaluate(() => {
  const char = { properties: { write: true, writeWithoutResponse: true }, writeValueWithoutResponse: async () => {}, writeValue: async () => {} };
  const service = { getCharacteristics: async () => [char] };
  const server = { connected: true, connect: async () => server, getPrimaryService: async () => service, disconnect: () => {} };
  const dev = { name: 'MPT-88', gatt: server, _onDisc: null, addEventListener: () => {} };
  Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: async () => dev } });
});
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(250);
await page.locator('#btPrinterConnectRow').click();
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
const s7 = await safeEval(() => document.getElementById('btPrinterStatus').textContent);
ok('Reload: status terakhir direstore ("Terakhir: MPT-88 …")', /Terakhir: MPT-88/.test(s7), s7);
// Bersihkan state QA
await safeEval(() => localStorage.removeItem('printer_bluetooth_state'));

// ── 8. Pasang Aplikasi (PWA) ──────────────────────────────────────────────
const s8 = await safeEval(() => ({ display: document.getElementById('rowInstallPwa').style.display }));
if (s8.display === 'none') {
  await safeEval(() => window.installPwa());
  await page.waitForTimeout(300);
  t = await toastState();
  ok('PWA row hidden (belum ada prompt) → installPwa guard toast', t.show && /belum siap dipasang/i.test(t.txt), t.txt);
} else {
  ok('PWA row tampil (beforeinstallprompt fire) — prompt native tidak ditrigger (aman)', true, s8.display);
}

// ── 9. Cek Data Online — sheet diagnosa 11 langkah ────────────────────────
await safeEval(() => window.openCekDataSheet());
await page.waitForTimeout(4500); // diagnosa jaringan (Supabase) butuh waktu
const s9 = await safeEval(() => {
  const sheet = document.getElementById('sheetCekData');
  const body = document.getElementById('cekDataBody');
  const rows = body.querySelectorAll('.setting-row');
  const card = body.querySelector('.diag-card');
  return {
    shown: getComputedStyle(sheet).display !== 'none',
    pending: body.textContent.includes('Memeriksa'),
    steps: rows.length,
    hasCard: !!card,
    cardTitle: card ? card.querySelector('b')?.textContent : '',
    step3: rows.length >= 3 ? rows[2].textContent : '',
    hasCopy: !!body.querySelector('button'),
    failCount: [...body.querySelectorAll('.setting-ic')].filter(i => i.classList.contains('ic-red')).length
  };
});
ok('Cek Data: sheet terbuka & diagnosa selesai (bukan pending)', s9.shown && !s9.pending, JSON.stringify({ shown: s9.shown, pending: s9.pending }));
ok('Cek Data: 11 langkah dirender', s9.steps >= 11, `rows=${s9.steps}`);
ok('Cek Data: kartu ringkasan ada', s9.hasCard, s9.cardTitle);
ok('Cek Data: langkah 3 koneksi internet OK', s9.step3.includes('✅'), s9.step3.slice(0, 80));
ok('Cek Data: tombol "Salin Hasil" ada', s9.hasCopy);
await page.screenshot({ path: '_qa-gui-screenshots/rosok-cekdata.png' });
// Salin hasil — clipboard bisa ditolak di Playwright; cukup fungsi jalan tanpa crash
await safeEval(() => window._ksr_copyDiag());
await page.waitForTimeout(400);
// Tutup sheet
await safeEval(() => window.closeSheet('sheetCekData'));
await page.waitForTimeout(300);
const s9b = await safeEval(() => getComputedStyle(document.getElementById('sheetCekData')).display);
ok('Cek Data: sheet bisa ditutup', s9b === 'none', s9b);

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
