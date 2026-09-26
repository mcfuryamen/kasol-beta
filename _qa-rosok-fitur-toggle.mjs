/** QA saklar blok "⚙️ Fitur Aplikasi" (Pengaturan rosok): Tunai/Transfer/Tempo + Kas & Shift. */
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
const screenOf = (name) => safeEval(() => {
  const s = document.getElementById('screen-' + name);
  return !!s && getComputedStyle(s).display !== 'none';
});

await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));

// Input checkbox visual-hidden (pola toggle-switch) → klik label pembungkusnya.
async function toggleTo(id, want) {
  if ((await page.locator('#' + id).isChecked()) === want) return;
  await page.locator(`label.toggle-switch:has(#${id})`).click();
  await page.waitForTimeout(300);
  const now = await page.locator('#' + id).isChecked();
  if (now !== want) throw new Error(`toggle ${id} tidak berubah ke ${want}`);
}

// ── Normalisasi: nyalakan semua saklar lewat UI agar kondisi awal diketahui ──
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(300);
for (const id of ['payOptTunai', 'payOptTransfer', 'payOptTempo', 'fiturKasToggle']) {
  await toggleTo(id, true);
}
// Reload → loadPayOptions saat boot harus sinkron & apply filter awal
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));

const boot = await safeEval(() => ({
  boxes: ['payOptTunai', 'payOptTransfer', 'payOptTempo', 'fiturKasToggle'].map(id => ({ id, checked: document.getElementById(id).checked })),
  btns: ['tunai', 'transfer', 'tempo'].map(m => ({ m, disp: document.querySelector(`#metodeBayarTabs button[data-m="${m}"]`).style.display }))
}));
for (const b of boot.boxes) ok(`Boot: ${b.id} checked (persist baca settings)`, b.checked);
for (const b of boot.btns) ok(`Boot: tombol POS ${b.m} tampil`, b.disp === '', `display="${b.disp}"`);

// ── A. Saklar metode bayar ────────────────────────────────────────────────
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(300);
await toggleTo("payOptTunai", false);
await page.waitForTimeout(300);
let t = await toastState();
ok('A1 uncheck Tunai → toast simpan', t.show && /disimpan/i.test(t.txt), t.txt);
const a1 = await safeEval(() => ({
  tunai: document.querySelector('#metodeBayarTabs button[data-m="tunai"]').style.display,
  active: document.querySelector('#metodeBayarTabs button.active[data-m]')?.dataset.m
}));
ok('A1 tombol Tunai hilang dari POS', a1.tunai === 'none', `display="${a1.tunai}"`);
ok('A1 metode aktif pindah ke Transfer', a1.active === 'transfer', `active="${a1.active}"`);

await toggleTo("payOptTunai", true);
await page.waitForTimeout(250);
const a2 = await safeEval(() => document.querySelector('#metodeBayarTabs button[data-m="tunai"]').style.display);
ok('A2 re-check Tunai → tombol tampil lagi', a2 === '', `display="${a2}"`);

await toggleTo("payOptTransfer", false);
await page.waitForTimeout(200);
await toggleTo("payOptTempo", false);
await page.waitForTimeout(300);
// Guard: coba matikan satu-satunya metode (Tunai) — harus DITOLAK & Tunai auto aktif
await page.locator('label.toggle-switch:has(#payOptTunai)').click();
await page.waitForTimeout(300);
t = await toastState();
const a4 = await safeEval(() => ({
  checked: document.getElementById('payOptTunai').checked,
  btns: ['tunai', 'transfer', 'tempo'].map(m => ({ m, d: document.querySelector(`#metodeBayarTabs button[data-m="${m}"]`).style.display }))
}));
ok('A4 guard minimal satu: Tunai auto aktif lagi', a4.checked === true);
ok('A4 guard: toast peringatan', t.show && /Minimal satu/i.test(t.txt), t.txt);
ok('A4 guard: hanya Tunai tampil di POS', a4.btns.find(b => b.m === 'tunai').d === '' && a4.btns.every(b => b.m === 'tunai' || b.d === 'none'), JSON.stringify(a4.btns));

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));
const a5 = await safeEval(() => ({
  boxes: { tunai: document.getElementById('payOptTunai').checked, transfer: document.getElementById('payOptTransfer').checked, tempo: document.getElementById('payOptTempo').checked },
  btns: ['tunai', 'transfer', 'tempo'].map(m => ({ m, d: document.querySelector(`#metodeBayarTabs button[data-m="${m}"]`).style.display }))
}));
ok('A5 persist pasca reload (checkbox)', a5.boxes.tunai === true && !a5.boxes.transfer && !a5.boxes.tempo, JSON.stringify(a5.boxes));
ok('A5 persist pasca reload (filter tombol POS)', a5.btns.find(b => b.m === 'tunai').d === '' && a5.btns.every(b => b.m === 'tunai' || b.d === 'none'), JSON.stringify(a5.btns));

// Restore default semua metode
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(250);
await toggleTo("payOptTransfer", true);
await page.waitForTimeout(200);
await toggleTo("payOptTempo", true);
await page.waitForTimeout(250);
const a6 = await safeEval(() => ['tunai', 'transfer', 'tempo'].map(m => ({ m, d: document.querySelector(`#metodeBayarTabs button[data-m="${m}"]`).style.display })));
ok('A6 restore: ketiga tombol POS tampil', a6.every(b => b.d === ''), JSON.stringify(a6));

// ── B. Saklar Kas & Shift Harian ──────────────────────────────────────────
await safeEval(() => window.showScreen('laporan'));
await page.waitForTimeout(400);
const b1 = await safeEval(() => ({
  toggle: document.getElementById('btnToggleKas').style.display,
  kasBar: document.getElementById('kasBar').classList.contains('show'),
  shiftCard: getComputedStyle(document.getElementById('kasShiftCard')).display
}));
ok('B1 fitur ON: tombol Buka/Tutup Kas tampil di laporan', b1.toggle === '' && b1.kasBar, JSON.stringify(b1));
ok('B1 fitur ON: kartu riwayat shift tampil', b1.shiftCard !== 'none', b1.shiftCard);

await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(250);
await toggleTo("fiturKasToggle", false);
await page.waitForTimeout(300);
t = await toastState();
ok('B2 uncheck fiturKas → toast dimatikan', t.show && /dimatikan/i.test(t.txt), t.txt);
const b3 = await safeEval(() => ({
  toggle: document.getElementById('btnToggleKas').style.display,
  manual: document.getElementById('btnOpenKasManual').style.display
}));
ok('B3 Buka/Tutup Kas disembunyikan', b3.toggle === 'none', `display="${b3.toggle}"`);
ok('B3 Catat Kas tetap tersedia', b3.manual !== 'none', `display="${b3.manual}"`);

await safeEval(() => window.showScreen('laporan'));
await page.waitForTimeout(400);
const b4 = await safeEval(() => getComputedStyle(document.getElementById('kasShiftCard')).display);
ok('B4 kartu riwayat shift disembunyikan di laporan', b4 === 'none', b4);

// Gerbang POS lolos tanpa buka kas
await safeEval(() => window.openTransaksi('jual'));
await page.waitForTimeout(600);
const b5 = await safeEval(() => ({
  sheetBukaKas: getComputedStyle(document.getElementById('sheetBukaKas')).display,
  transaksi: !!document.getElementById('screen-transaksi') && getComputedStyle(document.getElementById('screen-transaksi')).display !== 'none'
}));
ok('B5 fitur OFF: transaksi jual terbuka TANPA sheet buka kas', b5.transaksi && b5.sheetBukaKas === 'none', JSON.stringify(b5));

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));
await safeEval(() => window.showScreen('laporan'));
await page.waitForTimeout(400);
const b6 = await safeEval(() => ({
  checked: document.getElementById('fiturKasToggle').checked,
  toggle: document.getElementById('btnToggleKas').style.display,
  shiftCard: getComputedStyle(document.getElementById('kasShiftCard')).display
}));
ok('B6 persist pasca reload (fitur tetap off)', !b6.checked && b6.toggle === 'none' && b6.shiftCard === 'none', JSON.stringify(b6));

await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(250);
await toggleTo("fiturKasToggle", true);
await page.waitForTimeout(300);
t = await toastState();
ok('B7 re-check → toast aktif', t.show && /aktif/i.test(t.txt), t.txt);
const b7 = await safeEval(() => ({
  toggle: document.getElementById('btnToggleKas').style.display,
  shiftCard: getComputedStyle(document.getElementById('kasShiftCard')).display
}));
ok('B7 tombol kas & kartu shift kembali', b7.toggle === '' && b7.shiftCard !== 'none', JSON.stringify(b7));

// Gerbang aktif: tanpa shift terbuka → sheet buka kas muncul; ada shift → transaksi langsung
await safeEval(() => window.openTransaksi('jual'));
await page.waitForTimeout(700);
const b8 = await safeEval(() => ({
  sheet: getComputedStyle(document.getElementById('sheetBukaKas')).display,
  transaksi: !!document.getElementById('screen-transaksi') && getComputedStyle(document.getElementById('screen-transaksi')).display !== 'none'
}));
ok('B8 fitur ON: gerbang sesuai state shift (sheet buka kas ATAU transaksi langsung)', b8.sheet !== 'none' || b8.transaksi, JSON.stringify(b8));

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
