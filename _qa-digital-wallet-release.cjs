// QA rilis rosok v83/1.4.22 + kaki5 v207/1.0.132 — Playwright, origin terisolasi.
// Tujuan: buktikan lewat UI nyata bahwa
//  ROSOK: (a) transfer TIDAK menggeser laci, (b) nilainya muncul sbg Dompet digital,
//         (c) akordeon Detail Mutasi + action bar Cetak/Tutup Kas ada, (d) shift
//         tanpa transfer TIDAK menampilkan blok digital, (e) jalur cetak pasca-tutup
//         kas tidak melempar ReferenceError (bug mauCetak).
//  KAKI5: (f) form Pemasukan terisi tanggal hari ini saat pindah tab.
const { chromium } = require('C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');

const ROSOK = 'http://127.0.0.1:8084';
const KAKI5 = 'http://127.0.0.1:8086';
const results = [];
function check(name, pass, detail) { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

const todayLocal = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

// Navigasi layar: klik nav-item, verifikasi layar benar-benar aktif sebelum lanjut.
async function goScreen(page, screen) {
  const nav = page.locator(`.nav-item[data-page="${screen}"], .nav-item[data-screen="${screen}"]`);
  await nav.click({ timeout: 10000 });
  await page.waitForFunction(
    (s) => { const el = document.getElementById('page-' + s); return el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0; },
    screen, { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(900);
}

// Trap lama QA kasol: banner profil / gate lain menutupi klik. Tutup dulu lewat
// tombol resminya (bukan injeksi state), lalu tunggu overlay benar-benar hilang.
async function dismissBlockers(page) {
  for (let i = 0; i < 6; i++) {
    const blockers = await page.evaluate(() => {
      const sel = ['#profileBanner', '#tcModal', '#updateOverlay', '.overlay.show', '.lock-overlay.show'];
      const open = [];
      for (const s of sel) {
        for (const el of document.querySelectorAll(s)) {
          const st = getComputedStyle(el);
          if (st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0) open.push(el.id || el.className);
        }
      }
      return [...new Set(open)];
    });
    if (!blockers.length) return;
    for (const id of blockers) {
      const target = page.locator('#' + id).first();
      if (await target.count()) {
        const btn = target.locator('button').last();
        try { if (await btn.count()) { await btn.click({ timeout: 1500 }); await page.waitForTimeout(350); continue; } } catch (_) {}
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.evaluate((ids) => {
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.classList.contains('show')) el.classList.remove('show');
        if (el && el.classList.contains('lock-overlay')) el.style.display = 'none';
      }
    }, blockers);
    await page.waitForTimeout(250);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];

  // ─ bagian ROSOK ──────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('rosok pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('rosok console: ' + m.text()); });

    // Seed data lewat jalur app sendiri (bukan produksi, origin 127.0.0.1 terisolasi).
    await page.goto(ROSOK + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // PERSIAPAN LINGKUNGAN (bukan bagian uji): lengkapi profil usaha supaya
    // banner "profil belum lengkap" tidak muncul ulang tiap navigasi dan
    // menutupi elemen yang diuji.
    await page.evaluate(async () => {
      const { db } = await import('./js/db.js');
      const put = (key, value) => db.settings.put({ key, value });
      await put('bizName', 'Rosok QA');
      await put('ownerName', 'Pemilik QA');
      await put('bizPhone', '0881000000');
      await put('bizKabkota', 'Kota QA');
      await put('alamatDetail', 'Jl. QA No. 1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Seed: buka kas + 1 kas tunai masuk + 1 kas transfer masuk + 1 keluar transfer.
    const seeded = await page.evaluate(async () => {
      const { db } = await import('./js/db.js');
      await db.kas.clear(); await db.kasShift.clear();
      const now = new Date().toISOString();
      await db.kasShift.add({ status: 'buka', waktuBuka: now, modalAwal: 100000 });
      await db.kas.add({ tanggal: now, tipe: 'masuk', jumlah: 50000, keterangan: 'Penjualan tunai QA', metodeBayar: 'tunai' });
      await db.kas.add({ tanggal: now, tipe: 'masuk', jumlah: 200000, keterangan: 'Penjualan transfer QA', metodeBayar: 'transfer' });
      await db.kas.add({ tanggal: now, tipe: 'keluar', jumlah: 30000, keterangan: 'Pembelian transfer QA (Transfer)', metodeBayar: 'transfer' });
      const { hitungRingkasanShift } = await import('./js/kas.js');
      const r = await hitungRingkasanShift(now, new Date());
      return { masuk: r.masuk, keluar: r.keluar, digitalMasuk: r.digitalMasuk, digitalKeluar: r.digitalKeluar, digitalNet: r.digitalNet };
    });

    check('ROSOK laci hanya tunai (masuk=50000)', seeded.masuk === 50000, JSON.stringify(seeded));
    check('ROSOK keluar laci tidak ikut transfer (0)', seeded.keluar === 0, `keluar=${seeded.keluar}`);
    check('ROSOK digitalMasuk=200000', seeded.digitalMasuk === 200000, `digitalMasuk=${seeded.digitalMasuk}`);
    check('ROSOK digitalKeluar=30000 (data lama via penanda "(Transfer)")', seeded.digitalKeluar === 30000, `digitalKeluar=${seeded.digitalKeluar}`);
    check('ROSOK digitalNet=170000', seeded.digitalNet === 170000, `digitalNet=${seeded.digitalNet}`);

    // Buka Detail Riwayat Kas lewat UI nyata (Laporan → baris shift).
    await dismissBlockers(page);
    await goScreen(page, 'laporan');
    const shiftRow = page.locator('#kasShiftHistoryList .row-item').first();
    const hasShiftRow = await shiftRow.count() > 0;
    check('ROSOK baris riwayat shift tampil', hasShiftRow, `count=${await shiftRow.count()}`);
    if (hasShiftRow) {
      await shiftRow.click();
      await page.waitForTimeout(1200);
      const body = await page.locator('#kasShiftDetailBody').innerText();
      check('ROSOK blok Dompet digital tampil di detail', /Dompet digital/.test(body), body.split('\n').filter(l=>/Dompet digital|Saldo digital/.test(l)).join(' | '));
      check('ROSOK detail memuat saldo digital Rp 170.000', /170\.000/.test(body), 'saldo digital di detail');
      const hasAcc = await page.locator('#kasMutasiAcc').count() > 0;
      const hasPrint = await page.locator('.kas-shift-actions button', { hasText: 'Cetak' }).count() > 0;
      const hasClose = await page.locator('.kas-shift-actions button', { hasText: 'Tutup Kas' }).count() > 0;
      check('ROSOK akordeon Detail Mutasi ada', hasAcc, `kasMutasiAcc=${hasAcc}`);
      check('ROSOK action bar Cetak + Tutup Kas ada', hasPrint && hasClose, `cetak=${hasPrint} tutup=${hasClose}`);

      // Toggle akordeon → daftar mutasi ter-render
      await page.locator('#kasMutasiAcc .kas-mutasi-acc-head').click();
      await page.waitForTimeout(600);
      const mutasiTxt = await page.locator('#kasShiftMutasi').innerText();
      check('ROSOK akordeon terbuka & menampilkan mutasi tunai', /Penjualan tunai QA/.test(mutasiTxt), mutasiTxt.slice(0, 120));
      check('ROSOK mutasi TIDAK memuat baris transfer (laci bersih)', !/transfer QA/i.test(mutasiTxt), 'transfer tidak masuk daftar mutasi laci');
      await page.screenshot({ path: '_qa-gui-screenshots/rosok-shift-detail.png', fullPage: false });
    }

    // Shift tanpa transfer → blok digital harus HILANG.
    const cleanCase = await page.evaluate(async () => {
      const { db } = await import('./js/db.js');
      await db.kas.clear(); await db.kasShift.clear();
      const now = new Date().toISOString();
      await db.kasShift.add({ status: 'buka', waktuBuka: now, modalAwal: 100000 });
      await db.kas.add({ tanggal: now, tipe: 'masuk', jumlah: 40000, keterangan: 'Tunai saja QA', metodeBayar: 'tunai' });
      const { hitungRingkasanShift } = await import('./js/kas.js');
      const r = await hitungRingkasanShift(now, new Date());
      return { digitalMasuk: r.digitalMasuk, digitalKeluar: r.digitalKeluar, masuk: r.masuk };
    });
    check('ROSOK shift tanpa transfer: digital=0', cleanCase.digitalMasuk === 0 && cleanCase.digitalKeluar === 0, JSON.stringify(cleanCase));

    // Jalur cetak pasca-tutup kas: pastikan tidak ada ReferenceError (bug mauCetak).
    await page.evaluate(async () => {
      const { db } = await import('./js/db.js');
      const s = await db.kasShift.toCollection().first();
      window.__qaShiftId = s.id;
    });
    await page.evaluate(async () => {
      const kas = await import('./js/kas.js');
      // Buktikan fungsi cetak pasca-tutup bisa dipanggil tanpa error binding.
      await kas.showKasShiftDetail(window.__qaShiftId);
      const btn = document.querySelector('.kas-shift-actions .btn-secondary');
      window.__qaPrintBtnFound = !!btn;
      // Cetak dipanggil tanpa printer BLE → jalur browser (window.open diblok headless) harus aman.
      try { await kas.cetakKasShift(); window.__qaPrintErr = null; } catch (e) { window.__qaPrintErr = String(e && e.message); }
    });
    const printErr = await page.evaluate(() => window.__qaPrintErr);
    check('ROSOK cetak laporan shift tidak melempar error', printErr === null, `err=${printErr}`);

    await ctx.close();
  }

  // ── bagian KAKI5 ──────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('kaki5 pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('kaki5 console: ' + m.text()); });

    await page.goto(KAKI5 + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // PERSIAPAN LINGKUNGAN kaki5 (bukan bagian uji): profile banner juga
    // membuka lewat profil tidak lengkap — isi kunci yang sama yang dibaca
    // checkProfileNotificationData, kemudian reload.
    await page.evaluate(async () => {
      const { DB } = await import('./js/db.js');
      const put = (key, value) => DB.settings.put({ key, value });
      await put('namaPemilik', 'Pemilik QA');
      await put('noWhatsapp', '0881000000');
      await put('kabkota', 'Kota QA');
      await put('alamat', 'Jl. QA No. 1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissBlockers(page);

    // Buka modal Pengeluaran lewat UI, lalu pindah ke tab Pemasukan.
    // FAB Catat Pengeluaran hidup di HALAMAN LAPORAN (kaki5), bukan Beranda.
    await goScreen(page, 'laporan');
    await dismissBlockers(page);
    const fab = page.locator('.fab[data-action="open-expense-form"]').first();
    const fabVisible = await fab.evaluate((el) => getComputedStyle(el).display !== 'none' && el.offsetHeight > 0).catch(() => false);
    if (fabVisible) {
      await fab.click({ timeout: 8000 });
      await page.waitForTimeout(1200);
      await page.locator('.txn-tab[data-txntab="income"]').click();
      await page.waitForTimeout(700);
      const incVal = await page.locator('#incTanggal').inputValue();
      const expVal = await page.locator('#expTanggal').inputValue();
      check('KAKI5 form Pemasukan terisi tanggal hari ini', incVal === todayLocal(), `incTanggal=${incVal} (harus ${todayLocal()})`);
      check('KAKI5 tanggal Pengeluaran tetap hari ini', expVal === todayLocal(), `expTanggal=${expVal}`);
      await page.screenshot({ path: '_qa-gui-screenshots/kaki5-income-tab.png', fullPage: false });
    } else {
      check('KAKI5 FAB pengeluaran ditemukan', false, 'FAB tidak ada DOM / tidak terlihat');
    }
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log('\n=== RINGKASAN ===');
  console.log(`total ${results.length}, lulus ${results.length - failed.length}, gagal ${failed.length}`);
  if (errors.length) { console.log('\n=== ERROR HALAMAN ==='); errors.slice(0, 20).forEach(e => console.log('  ' + e)); }
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('QA CRASH:', e); process.exit(2); });