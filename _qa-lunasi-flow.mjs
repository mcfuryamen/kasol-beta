/** QA adopsi flow lunasi kaki5: tombol Lunasi → form Catat Kas prefill → pelunasan atomik. */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const tmp = mkdtempSync(join(tmpdir(), 'qa-lunasi-'));
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
async function toastState() {
  return safeEval(() => { const t = document.getElementById('toast'); return { txt: t?.textContent || '', show: !!t?.classList.contains('show') }; });
}
async function waitToast(re, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await toastState();
    if (s.show && re.test(s.txt)) return s.txt;
    await page.waitForTimeout(250);
  }
  return null;
}
const dbGet = (id) => safeEval(async (tid) => {
  const { db } = await import('/js/db.js');
  return db.transaksi.get(tid);
}, id);
const kasFor = (id) => safeEval(async (tid) => {
  const { db } = await import('/js/db.js');
  return db.kas.where('refTransaksiId').equals(tid).toArray();
}, id);

// Layar stabil di pengaturan (hindari race router:ready → dashboard)
async function goSettings() {
  for (let i = 0; i < 24; i++) {
    const done = await safeEval(() => {
      document.getElementById('profileBanner')?.classList.remove('show');
      document.getElementById('sheetRestoreOffer')?.classList.remove('show');
      window.showScreen?.('pengaturan');
      return [...document.querySelectorAll('section[id^="screen-"]')].find(s => getComputedStyle(s).display !== 'none')?.id === 'screen-pengaturan';
    });
    if (done) return;
    await page.waitForTimeout(500);
  }
}
await goSettings();

// ── Seed 3 transaksi tempo via import resmi ────────────────────────────────
const now = new Date().toISOString();
const seed = {
  version: 3, exportDate: now, kategori: [],
  transaksi: [
    { id: 9201, tipe: 'beli', tanggal: now, total: 100000, dibayarkan: 40000, sisa: 60000, metodeBayar: 'tempo', kontakNama: 'Ujang' },
    { id: 9202, tipe: 'jual', tanggal: now, total: 50000, dibayarkan: 20000, sisa: 30000, metodeBayar: 'tempo', kontakNama: 'Budi' },
    { id: 9203, tipe: 'beli', tanggal: now, total: 80000, dibayarkan: 30000, sisa: 50000, metodeBayar: 'tempo', kontakNama: 'Asep' }
  ],
  transaksiItem: [], kas: [], kasShift: [], tutupBuku: []
};
const f = join(tmp, 'seed.json');
writeFileSync(f, JSON.stringify(seed));
await page.setInputFiles('#importFile', f);
await page.waitForTimeout(400);
await page.locator('#confirmOkBtn').click();
await page.waitForTimeout(900);

// ── 1. sheetLunasi lama hilang ─────────────────────────────────────────────
const gone = await safeEval(() => ({ el: !!document.getElementById('sheetLunasi'), fn: typeof window.saveLunasi }));
ok('Sheet Lunasi lama dihapus (DOM & window)', !gone.el && gone.fn === 'undefined', JSON.stringify(gone));

// ── 2. Lunasi UTANG → form Catat Kas prefill tab Pengeluaran ───────────────
await safeEval(() => window.showScreen('laporan'));
await page.waitForTimeout(700);
const rows0 = await safeEval(() => document.querySelectorAll('#tempoList .row-item').length);
ok('tempoList tampil 3 utang/piutang', rows0 === 3, `rows=${rows0}`);
await safeEval(() => window._ksr_openLunasi(9201));
await page.waitForTimeout(500);
const form1 = await safeEval(() => ({
  shown: getComputedStyle(document.getElementById('sheetKas')).display !== 'none',
  keluarAktif: document.getElementById('kasTabKeluar').classList.contains('active'),
  kat: document.getElementById('kasKat').value,
  ket: document.getElementById('kasKet').value,
  jml: document.getElementById('kasJumlah').value
}));
ok('Lunasi utang → sheetKas terbuka di tab PENGELUARAN', form1.shown && form1.keluarAktif, JSON.stringify(form1));
ok('Prefill kategori Pelunasan Utang + keterangan kontak', form1.kat === 'Pelunasan Utang' && /Pelunasan utang - Ujang/.test(form1.ket), `${form1.kat} | ${form1.ket}`);
ok('Prefill jumlah = sisa (Rp 60.000)', /60\.000/.test(form1.jml), form1.jml);

// ── 3. Pelunasan sebagian (ubah 25.000) ────────────────────────────────────
await safeEval(() => { document.getElementById('kasJumlah').value = '25000'; });
await page.locator('#kasSaveBtn').click();
const t3 = await waitToast(/Pelunasan sebagian tercatat/);
const tr3 = await dbGet(9201);
const kas3 = await kasFor(9201);
ok('Simpan sebagian → toast "Pelunasan sebagian tercatat"', !!t3, String(t3));
ok('Transaksi: dibayarkan 65.000 sisa 35.000', tr3.dibayarkan === 65000 && tr3.sisa === 35000, JSON.stringify({ d: tr3.dibayarkan, s: tr3.sisa }));
ok('Baris kas refTransaksiId=9201, BUKAN manual', kas3.length === 1 && kas3[0].refTransaksiId === 9201 && !kas3[0].manual && kas3[0].tipe === 'keluar', JSON.stringify(kas3[0] || {}));
const rows1 = await safeEval(() => [...document.querySelectorAll('#tempoList .row-item')].map(r => r.textContent).join('|'));
ok('tempoList utang Ujang kini Rp 35.000', /35\.000/.test(rows1), rows1.slice(0, 120));

// ── 4. Pelunasan penuh → lunas ─────────────────────────────────────────────
await safeEval(() => window._ksr_openLunasi(9201));
await page.waitForTimeout(400);
const pre2 = await safeEval(() => document.getElementById('kasJumlah').value);
ok('Buka lagi → prefill sisa terbaru (35.000)', /35\.000/.test(pre2), pre2);
await page.locator('#kasSaveBtn').click();
const t4 = await waitToast(/Tempo lunas/);
const tr4 = await dbGet(9201);
ok('Simpan penuh → toast "Tempo lunas! 🎉" + sisa 0', !!t4 && tr4.sisa === 0, `${t4} sisa=${tr4?.sisa}`);

// ── 5. PIUTANG → tab PEMASUKAN + kategori Pelunasan Piutang ────────────────
await safeEval(() => window._ksr_openLunasi(9202));
await page.waitForTimeout(400);
const form5 = await safeEval(() => ({
  masukAktif: document.getElementById('kasTabMasuk').classList.contains('active'),
  kat: document.getElementById('kasKat').value,
  jml: document.getElementById('kasJumlah').value
}));
ok('Lunasi piutang → tab PEMASUKAN + kategori Pelunasan Piutang', form5.masukAktif && form5.kat === 'Pelunasan Piutang', JSON.stringify(form5));
ok('Prefill jumlah piutang Budi Rp 30.000', /30\.000/.test(form5.jml), form5.jml);
// metode transfer → kas row transfer (tidak geser laci)
await safeEval(() => { document.getElementById('kasMet').value = 'transfer'; });
await page.locator('#kasSaveBtn').click();
const t5 = await waitToast(/Tempo lunas/);
const kas5 = await kasFor(9202);
ok('Piutang lunas via TRANSFER → kas row metodeBayar transfer', !!t5 && kas5.length === 1 && kas5[0].metodeBayar === 'transfer' && kas5[0].tipe === 'masuk', JSON.stringify(kas5[0] || {}));

// ── 6. Guard: pindah tab melepas konteks pelunasan (jadi catatan manual) ──
await safeEval(() => window._ksr_openLunasi(9203));
await page.waitForTimeout(400);
await page.evaluate(() => window.setKasTipe ? window.setKasTipe('masuk') : document.getElementById('kasTabMasuk').click());
await page.waitForTimeout(250);
// setKasTipe mengosongkan form (pindah objek) — isi manual biasa:
await safeEval(() => { document.getElementById('kasKet').value = 'QA manual biasa'; document.getElementById('kasJumlah').value = '10000'; });
await page.locator('#kasSaveBtn').click();
const t6 = await waitToast(/dicatat|Pemasukan/);
const tr6 = await dbGet(9203);
const kas6 = await safeEval(async () => {
  const { db } = await import('/js/db.js');
  return (await db.kas.toArray()).filter(k => k.refTransaksiId === 9203).length;
});
ok('Pindah tab → simpan jadi manual biasa, transaksi 9203 TETAP utang', !!t6 && tr6.sisa === 50000 && kas6 === 0, `${t6} sisa=${tr6?.sisa} ref=${kas6}`);
await safeEval(() => document.getElementById('kasEditId') && window.closeSheet('sheetKas'));

// ── 7. Transaksi sudah lunas → ditolak ramah ──────────────────────────────
await safeEval(() => window._ksr_openLunasi(9201));
await page.waitForTimeout(400);
const t7 = await toastState();
ok('Lunasi transaksi lunas → toast "sudah lunas", form tidak terbuka', /sudah lunas/i.test(t7.txt) && !(await safeEval(() => getComputedStyle(document.getElementById('sheetKas')).display !== 'none')), t7.txt);

ok('Tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
