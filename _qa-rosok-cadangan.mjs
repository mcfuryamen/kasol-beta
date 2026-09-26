/** QA blok "💾 Data & Cadangan" rosok: export/import/validasi/clear-all/cloud-guard + cek UI (label Diagnosa, swap blok). */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync, readFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};

const tmp = mkdtempSync(join(tmpdir(), 'qa-rosok-cadangan-'));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
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
async function confirmOk(n = 1) {
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(350);
    const shown = await safeEval(() => document.getElementById('confirmModal').classList.contains('show'));
    if (!shown) return false;
    await page.locator('#confirmOkBtn').click();
  }
  await page.waitForTimeout(400);
  return true;
}
const dbCounts = () => safeEval(async () => {
  const { db } = await import('/js/db.js');
  return {
    kategori: await db.kategori.count(), transaksi: await db.transaksi.count(),
    transaksiItem: await db.transaksiItem.count(), kas: await db.kas.count(),
    kasShift: await db.kasShift.count(), tutupBuku: await db.tutupBuku.count()
  };
});
const dbTrans = () => safeEval(async () => {
  const { db } = await import('/js/db.js');
  return JSON.stringify(await db.transaksi.toArray());
});

await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));

// ── 0. UI: label Diagnosa + urutan blok (Data & Cadangan sebelum Lisensi) ──
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(300);
const ui = await safeEval(() => {
  const sec = document.getElementById('screen-pengaturan');
  const titles = [...sec.querySelectorAll('.card-title')].map(e => e.textContent.trim());
  const rowDiag = [...sec.querySelectorAll('.s-title')].some(e => e.textContent === 'Diagnosa');
  const rowOld = [...sec.querySelectorAll('.s-title')].some(e => e.textContent === 'Cek Data Online');
  const sheetTitle = document.querySelector('#sheetCekData .sheet-title span').textContent;
  return { titles, rowDiag, rowOld, sheetTitle };
});
ok('UI: label row "Diagnosa" ada', ui.rowDiag);
ok('UI: label lama "Cek Data Online" hilang', !ui.rowOld);
ok('UI: judul sheet "🩺 Diagnosa"', ui.sheetTitle.includes('Diagnosa'), ui.sheetTitle);
const iData = ui.titles.findIndex(t => t.includes('Data & Cadangan'));
const iLic = ui.titles.findIndex(t => t.includes('Lisensi Aplikasi'));
ok('UI: blok Data & Cadangan kini di ATAS Lisensi Aplikasi', iData !== -1 && iLic !== -1 && iData < iLic, `idx data=${iData}, lisensi=${iLic}`);

// ── 0b. Seed data uji bila DB QA kosong (payload TANPA signature — kompatibel) ──
let before = await dbCounts();
if (before.transaksi === 0 && before.kategori === 0) {
  const seed = {
    version: 3,
    exportDate: new Date().toISOString(),
    kategori: [{ id: 9001, nama: 'QA Tembaga', hargaBeli: 10000, hargaJual: 12000, stokKg: 5 }],
    transaksi: [{ id: 9001, tipe: 'jual', tanggal: new Date().toISOString(), total: 24000, dibayarkan: 24000, sisa: 0, metodeBayar: 'tunai', kontakNama: 'QA Buyer' }],
    transaksiItem: [{ id: 9001, transaksiId: 9001, kategoriNama: 'QA Tembaga', berat: 2, hargaSatuan: 12000, subtotal: 24000 }],
    kas: [{ id: 9001, tanggal: new Date().toISOString(), tipe: 'masuk', jumlah: 24000, keterangan: 'QA seed' }],
    kasShift: [], tutupBuku: []
  };
  writeFileSync(join(tmp, 'seed.json'), JSON.stringify(seed));
  await page.setInputFiles('#importFile', join(tmp, 'seed.json'));
  await confirmOk(1);
  await page.waitForTimeout(600);
  before = await dbCounts();
  ok('Seed: data uji terpasang (kategori+transaksi+item+kas)', before.kategori === 1 && before.transaksi === 1 && before.transaksiItem === 1 && before.kas === 1, JSON.stringify(before));
} else {
  ok('Seed: QA origin sudah punya data (dipakai apa adanya)', true, JSON.stringify(before));
}

// ── 1. Simpan Cadangan (exportData) → file JSON + signature ──────────────
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.locator('div.setting-row[onclick="exportData()"]').click()
]);
const fileExport = join(tmp, 'cadangan-export.json');
await download.saveAs(fileExport);
const t1 = await toastState();
ok('Export: toast "Cadangan tersimpan ke file!"', t1.show && /tersimpan ke file/i.test(t1.txt), t1.txt);
ok('Export: nama file cadangan-rosok-YYYY-MM-DD.json', /^cadangan-rosok-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
const payload = JSON.parse(readFileSync(fileExport, 'utf-8'));
const dataKeys = ['kategori', 'transaksi', 'transaksiItem', 'kas', 'kasShift', 'tutupBuku'];
ok('Export: payload v3 — version + 6 tabel data', payload.version === 3 && dataKeys.every(k => Array.isArray(payload[k])), JSON.stringify(Object.keys(payload)));
ok('Export: signature device-bound tercantum (6 char b32 ala kaki5)', typeof payload._signature === 'string' && payload._signature.length === 6 && payload._signatureVersion === 1, JSON.stringify({ sigLen: (payload._signature || '').length, sigHead: (payload._signature || '').slice(0, 12), ver: payload._signatureVersion }));

// ── 2. Hapus Semua Data (2 konfirmasi) → DB bersih ───────────────────────
const totalBefore = await safeEval(async () => {
  const { db } = await import('/js/db.js');
  const t = await db.transaksi.toArray();
  return t.length ? t[0].total : null;
});
await page.locator('div.setting-row[onclick="confirmClearAll()"]').click();
const ok1 = await confirmOk(1);
const ok2 = await confirmOk(1);
const t2 = await toastState();
ok('Hapus Semua: dua modal konfirmasi tampil & disetujui', ok1 && ok2);
ok('Hapus Semua: toast "Semua data dihapus"', t2.show && /Semua data dihapus/i.test(t2.txt), t2.txt);
const afterClear = await dbCounts();
ok('Hapus Semua: keenam tabel kosong', Object.values(afterClear).every(v => v === 0), JSON.stringify({ before, afterClear }));
const payOpt = await safeEval(async () => {
  const { db } = await import('/js/db.js');
  const r = await db.settings.get('payOptions');
  return r ? r.value : null;
});
ok('Hapus Semua: payOptions di-reset ke default', !!payOpt && payOpt.tunai === true && payOpt.transfer === true && payOpt.tempo === true, JSON.stringify(payOpt));

// ── 3. Pulihkan Data (importData + modal) → data kembali identik ─────────
await page.setInputFiles('#importFile', fileExport);
await confirmOk(1);
await page.waitForTimeout(600);
const t3 = await toastState();
const afterRestore = await dbCounts();
const totalAfter = await safeEval(async () => {
  const { db } = await import('/js/db.js');
  const t = await db.transaksi.toArray();
  return t.length ? t[0].total : null;
});
ok('Restore: toast "Data berhasil dipulihkan!"', t3.show && /berhasil dipulihkan/i.test(t3.txt), t3.txt);
ok('Restore: counts kembali persis spt sebelum clear', JSON.stringify(afterRestore) === JSON.stringify(before), JSON.stringify({ before, afterRestore }));
ok('Restore: isi transaksi identik (total sama)', totalBefore === totalAfter, `before=${totalBefore}, after=${totalAfter}`);

// ── 4. Validasi: file rusak / dimodifikasi / versi baru ditolak ──────────
writeFileSync(join(tmp, 'rusak1.json'), JSON.stringify({ foo: 1 }));
await page.setInputFiles('#importFile', join(tmp, 'rusak1.json'));
await page.waitForTimeout(500);
let tv = await toastState();
let modalShown = await safeEval(() => document.getElementById('confirmModal').classList.contains('show'));
ok('Validasi: file asing ditolak tanpa modal', /tidak valid/i.test(tv.txt) && !modalShown, tv.txt);

const bad = JSON.parse(JSON.stringify(payload)); bad._signature = undefined; bad._signatureVersion = undefined;
bad.transaksi.push({ tipe: 'jualan', tanggal: '2026-09-14T10:00:00.000Z', total: 1000 });
writeFileSync(join(tmp, 'rusak2.json'), JSON.stringify(bad));
await page.setInputFiles('#importFile', join(tmp, 'rusak2.json'));
await page.waitForTimeout(500);
tv = await toastState();
modalShown = await safeEval(() => document.getElementById('confirmModal').classList.contains('show'));
ok('Validasi: transaksi tipe aneh ditolak', /tipe tidak dikenal/i.test(tv.txt) && !modalShown, tv.txt);

const newer = JSON.parse(JSON.stringify(payload)); newer.version = 99;
writeFileSync(join(tmp, 'rusak3.json'), JSON.stringify(newer));
await page.setInputFiles('#importFile', join(tmp, 'rusak3.json'));
await page.waitForTimeout(500);
tv = await toastState();
ok('Validasi: versi lebih baru ditolak', /versi aplikasi yang lebih baru/i.test(tv.txt), tv.txt);

const tampered = JSON.parse(JSON.stringify(payload));
if (tampered.transaksi.length) tampered.transaksi[0].total = 123456789;
else if (tampered.kategori.length) tampered.kategori[0].hargaJual = 999999; // modifikasi apa pun memicu signature
else tampered.exportDate = '2020-01-01T00:00:00.000Z';
writeFileSync(join(tmp, 'tampered.json'), JSON.stringify(tampered));
await page.setInputFiles('#importFile', join(tmp, 'tampered.json'));
await page.waitForTimeout(600);
tv = await toastState();
modalShown = await safeEval(() => document.getElementById('confirmModal').classList.contains('show'));
ok('Validasi: file dimodifikasi ditolak (signature)', /Signature tidak valid/i.test(tv.txt) && !modalShown, tv.txt);

// ── 5. Cloud: cabang berdasar status lisensi EFEKTIF (toast dibiarkan settle dulu) ──
async function toastSettle() {
  for (let i = 0; i < 20; i++) { const s = await toastState(); if (!s.show) return; await page.waitForTimeout(250); }
}
async function waitToast(re, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await toastState();
    if (s.show && re.test(s.txt)) return s.txt;
    await page.waitForTimeout(250);
  }
  return null;
}
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(200);
await toastSettle();
await page.locator('div.setting-row[onclick="cloudSaveBackup()"]').click();
const saveTxt = await waitToast(/tersimpan ke cloud|lisensi aktif|Gagal simpan/);
ok('Cloud save: hasil tegas (sukses / guard / gagal-jelas)', !!saveTxt, String(saveTxt));
if (saveTxt && /tersimpan ke cloud/.test(saveTxt)) {
  // Lisensi aktif: upload jalan → lastCloudBackupAt tercatat (poll, ditulis setelah upload)
  let cs = null;
  for (let i = 0; i < 14 && !cs; i++) {
    cs = await safeEval(async () => {
      const { db } = await import('/js/db.js');
      const r = await db.settings.get('lastCloudBackupAt');
      return r ? r.value : null;
    });
    if (!cs) await page.waitForTimeout(400);
  }
  ok('Cloud save: lastCloudBackupAt tercatat', !!cs, String(cs));
  await page.locator('div.setting-row[onclick="cloudRestoreLatest()"]').click();
  let modalShown2 = false;
  for (let i = 0; i < 20 && !modalShown2; i++) {
    await page.waitForTimeout(350);
    modalShown2 = await safeEval(() => document.getElementById('confirmModal').classList.contains('show'));
  }
  ok('Cloud restore: modal konfirmasi muncul (cadangan cloud ada & valid)', modalShown2);
  if (modalShown2) { await safeEval(() => document.getElementById('confirmCancelBtn').click()); await page.waitForTimeout(300); }
} else {
  ok('Cloud save: guard 🔒 (lisensi belum aktif)', /lisensi aktif/.test(saveTxt || ''), String(saveTxt));
  await page.locator('div.setting-row[onclick="cloudRestoreLatest()"]').click();
  const rt = await waitToast(/lisensi aktif|Belum ada cadangan/);
  ok('Cloud restore: guard 🔒 / belum ada cadangan', !!rt, String(rt));
}

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
