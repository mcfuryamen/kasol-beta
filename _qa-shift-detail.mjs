/** QA adopsi kaki5: riwayat buka/tutup kas → baris clickable → sheet Detail Riwayat Kas. */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const tmp = mkdtempSync(join(tmpdir(), 'qa-shift-'));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.addInitScript(() => {
  const css = document.createElement('style');
  css.textContent = '#profileBanner{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(css));
});
await page.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
async function safeEval(fn, arg) {
  for (let i = 0; i < 10; i++) {
    try { await page.waitForLoadState('domcontentloaded'); return await page.evaluate(fn, arg); }
    catch (e) { if (i === 9) throw e; await page.waitForTimeout(1000); }
  }
}
async function goSettings() {
  for (let i = 0; i < 24; i++) {
    const done = await safeEval(() => {
      document.getElementById('sheetRestoreOffer')?.classList.remove('show');
      window.showScreen?.('pengaturan');
      return [...document.querySelectorAll('section[id^="screen-"]')].find(s => getComputedStyle(s).display !== 'none')?.id === 'screen-pengaturan';
    });
    if (done) return;
    await page.waitForTimeout(500);
  }
}
await goSettings();

// ── Seed: 1 shift tutup (angka tersimpan ≠ hitung ulang → baris oranye) + 1 buka ──
const duaHariLalu = new Date(Date.now() - 2 * 86400000);
const iso = (d, h, m) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString(); };
const seed = {
  version: 3, exportDate: new Date().toISOString(), kategori: [],
  transaksi: [
    { id: 9301, tipe: 'jual', tanggal: iso(duaHariLalu, 12, 0), total: 200000, dibayarkan: 200000, sisa: 0, metodeBayar: 'tunai' },
    { id: 9303, tipe: 'jual', tanggal: iso(duaHariLalu, 13, 0), total: 50000, dibayarkan: 50000, sisa: 0, metodeBayar: 'tunai' },
    { id: 9302, tipe: 'jual', tanggal: iso(new Date(), 9, 0), total: 30000, dibayarkan: 30000, sisa: 0, metodeBayar: 'tunai' }
  ],
  transaksiItem: [], kas: [],
  kasShift: [
    { id: 1, status: 'tutup', waktuBuka: iso(duaHariLalu, 10, 0), waktuTutup: iso(duaHariLalu, 18, 30), modalAwal: 100000, kasSistemAkhir: 260000, kasFisikAkhir: 255000, selisih: -5000, catatanTutup: 'Kurang karena kembalian' },
    { id: 2, status: 'buka', waktuBuka: iso(new Date(), 8, 0), waktuTutup: null, modalAwal: 50000, kasSistemAkhir: null, kasFisikAkhir: null, selisih: null, catatanTutup: '' }
  ],
  kas: [
    { tanggal: iso(duaHariLalu, 10, 0), tipe: 'masuk', jumlah: 100000, keterangan: 'Modal Awal - Buka Kas', refKasShiftId: 1 },
    { tanggal: iso(duaHariLalu, 12, 0), tipe: 'masuk', jumlah: 200000, keterangan: 'Penjualan rosok', metodeBayar: 'tunai' },
    { tanggal: iso(duaHariLalu, 15, 0), tipe: 'keluar', jumlah: 50000, keterangan: 'Beli karung', metodeBayar: 'tunai' },
    { tanggal: iso(new Date(), 8, 0), tipe: 'masuk', jumlah: 50000, keterangan: 'Modal Awal - Buka Kas', refKasShiftId: 2 }
  ],
  tutupBuku: []
};
const f = join(tmp, 'seed.json');
writeFileSync(f, JSON.stringify(seed));
await page.setInputFiles('#importFile', f);
await page.waitForTimeout(400);
await page.locator('#confirmOkBtn').click();
await page.waitForTimeout(900);

// ── Laporan: baris riwayat shift clickable ala kaki5 ───────────────────────
await safeEval(() => window.showScreen('laporan'));
await page.waitForTimeout(800);
const rows = await safeEval(() => [...document.querySelectorAll('#kasShiftHistoryList .row-item')].map(r => ({
  onclick: /_ksr_showKasShiftDetail/.test(r.getAttribute('onclick') || ''),
  detail: /Detail ›/.test(r.textContent),
  badge: /Berjalan|Tutup/.test(r.querySelector('.kas-shift-go')?.textContent || ''),
  text: r.textContent.replace(/\s+/g, ' ').slice(0, 90)
})));
ok('2 baris riwayat shift dirender', rows.length === 2, JSON.stringify(rows.map(r => r.text)));
ok('Semua baris clickable → _ksr_showKasShiftDetail', rows.every(r => r.onclick));
ok('Semua baris punya badge + "Detail ›" (pola kaki5)', rows.every(r => r.detail && r.badge));
ok('Baris shift tutup menampilkan catatan italic', await safeEval(() => /Kurang karena kembalian/.test(document.querySelector('#kasShiftHistoryList .row-item:nth-child(2)')?.textContent || '')));

// ── Klik shift TUTUP → detail dengan selisih + hitung ulang ────────────────
await safeEval(() => window._ksr_showKasShiftDetail(1));
await page.waitForTimeout(500);
const d1 = await safeEval(() => ({
  shown: getComputedStyle(document.getElementById('sheetShiftDetail')).display !== 'none',
  txt: document.getElementById('kasShiftDetailBody').textContent.replace(/\s+/g, ' ')
}));
ok('Sheet detail shift tutup terbuka', d1.shown);
ok('Header "🔒 Shift ditutup" + Ditutup + Durasi', /Shift ditutup/.test(d1.txt) && /Ditutup/.test(d1.txt) && /Durasi.*jam/.test(d1.txt), d1.txt.slice(0, 140));
ok('Baris Selisih −Rp 5.000 (merah)', /Selisih\s*−?[-−]?Rp 5\.000/.test(d1.txt) || /Selisih.*5\.000/.test(d1.txt), d1.txt.slice(0, 200));
ok('Mismatch terdeteksi → baris "Hitung ulang dari data"', /Hitung ulang dari data/.test(d1.txt), '');
ok('Kas masuk/keluar + jumlah transaksi tampil', /Kas masuk selama shift \(2 transaksi\)/.test(d1.txt) && /Kas keluar selama shift/.test(d1.txt), '');
ok('Catatan saat tutup tampil', /Catatan saat tutup.*Kurang karena kembalian/.test(d1.txt), '');
await safeEval(() => window._ksr_closeKasShiftDetail());
await page.waitForTimeout(300);

// ── Klik shift BUKA → hint berjalan, tanpa selisih ────────────────────────
await safeEval(() => window._ksr_showKasShiftDetail(2));
await page.waitForTimeout(500);
const d2 = await safeEval(() => document.getElementById('kasShiftDetailBody').textContent.replace(/\s+/g, ' '));
ok('Shift buka: "🔓 Shift masih berjalan" + "— belum ditutup —"', /Shift masih berjalan/.test(d2) && /belum ditutup/.test(d2), d2.slice(0, 120));
ok('Shift buka: hint angka masih berjalan', /Angka masih berjalan/.test(d2));
ok('Shift buka: TANPA baris Selisih/fisik', !/Selisih/.test(d2) && !/Kas fisik/.test(d2));
await page.screenshot({ path: '_qa-gui-screenshots/fix-rosok-shift-detail.png' });
await safeEval(() => window._ksr_closeKasShiftDetail());

ok('Tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
