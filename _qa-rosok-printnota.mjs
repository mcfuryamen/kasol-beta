/** QA dual-path cetak nota rosok (port kaki5, lebar 38 kolom). */
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
await page.waitForTimeout(2000);
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
await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));
await safeEval(async () => {
  const { setSetting } = await import('./js/utils.js');
  await setSetting('alamatDetail', 'Jl. Raya Uji No. 12');
  await setSetting('bizDesa', 'Gondangmanis');
  await setSetting('bizKabkota', 'Kartasura');
  await setSetting('bizProvinsi', 'Jawa Tengah');
});
await page.reload(); await page.waitForTimeout(2200);

// Seed + buka nota detail
await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const kats = await db.kategori.toArray();
  const kat = kats[0] || { id: 1, nama: 'Aluminium' };
  await db.transaksi.add({
    tanggal: new Date().toISOString(), tipe: 'jual', kontakNama: 'Budi', total: 30000,
    dibayarkan: 30000, sisa: 0, metodeBayar: 'tunai', void: false,
    items: [{ kategoriId: kat.id, kategoriNama: kat.nama, berat: 2, hargaSatuan: 15000, subtotal: 30000 }]
  }).then(async (id) => {
    // Detail riwayat memuat item dari tabel transaksiItem (bukan trx.items).
    await db.transaksiItem.add({ transaksiId: id, kategoriNama: kat.nama, berat: 2, hargaSatuan: 15000, subtotal: 30000 });
  });
  showScreen('laporan');
});
await page.waitForTimeout(800);
await safeEval(() => document.querySelector('#riwayatList .row-item')?.click());
await page.waitForTimeout(500);

// Intercept window.open → rekam HTML struk, JANGAN buka popup/print asli
const nota = await safeEval(() => {
  window.__cap = { html: null, printed: false };
  window.open = (u, name) => {
    window.__cap.opened = true;
    return {
      document: {
        write: (h) => { window.__cap.html = h; },
        close: () => {}
      },
      focus: () => {}, print: () => { window.__cap.printed = true; }, close: () => {}
    };
  };
  document.querySelector('#sheetNota .btn-outline').click(); // 🖨️ Cetak
  return new Promise(r => setTimeout(async () => r({
    opened: window.__cap.opened,
    settingsAlamat: (await import('./js/app-state.js')).SETTINGS.alamatDetail,
    printed: window.__cap.printed,
    html: window.__cap.html || ''
  }), 600));
});
console.log('DUMP settingsAlamat:', JSON.stringify(nota.settingsAlamat));
  ok('P1 jalur popup dipakai (BLE tidak terhubung)', nota.opened === true);
ok('P2 print() popup terpanggil', nota.printed === true);
const h = nota.html;
ok('P3 HTML struk: nama usaha + item + berat + total', /Kasir Solo - Rosok/.test(h) && / kg × 15\.000/.test(h) && /TOTAL/.test(h) && /30\.000/.test(h));
ok('P4 HTML struk: kontak + metode + footer', /Budi/.test(h) && /Tunai/.test(h) && /Terima kasih/.test(h));
ok('P5 HTML struk: lebar 333px (38 kolom thermal)', /width:333px/.test(h));
ok('P6 HTML struk: alamat lengkap di bawah nama usaha', /Jl. Raya Uji No. 12/.test(h) && /Gondangmanis/.test(h) && /Kartasura/.test(h) && /Jawa Tengah/.test(h));
ok('P7 HTML struk: footer Kasir Solo - Rosok Edition', /Kasir Solo - Rosok Edition/.test(h));

// Teks struk ESC/POS 38 kolom (jalur BLE — diverifikasi murni)
const receipt = await safeEval(() => import('./js/printer.js').then(async (P) => {
  const trx = {
    tipe: 'beli', tanggal: '2026-09-13T10:00:00', kontakNama: 'inem', total: 88000,
    dibayarkan: 0, sisa: 88000, metodeBayar: 'tempo', catatan: 'tempo 2 minggu',
    items: [{ kategoriNama: 'Kardus', berat: 5.5, hargaSatuan: 16000, subtotal: 88000 }]
  };
  const { SETTINGS } = await import('./js/app-state.js');
  const alamat = [SETTINGS.alamatDetail, SETTINGS.bizDesa, SETTINGS.bizKecamatan, SETTINGS.bizKabkota, SETTINGS.bizProvinsi].filter(Boolean).join(', ');
  const txt = P.buildReceiptText(trx, 'Toko Rosok Uji', alamat);
  return { txt, lines: txt.split('\n').map(l => l.length), max: Math.max(...txt.split('\n').map(l => l.length)) };
}));
ok('R1 struk BLE: ESC reset + align + cut code', receipt.txt.includes('\x1B@') && receipt.txt.includes('\x1Ba') && receipt.txt.includes('\x1DV'));
ok('R2 struk BLE: semua baris ≤ 38 kolom', receipt.max <= 38, 'max=' + receipt.max);
ok('R3 struk BLE: header/item/total/tempo lengkap', /Toko Rosok Uji/.test(receipt.txt) && /Pembelian - inem/.test(receipt.txt) && /Kardus/.test(receipt.txt) && /5,5 kg x 16\.000/.test(receipt.txt) && /TOTAL/.test(receipt.txt) && /Sisa \(Utang\)/.test(receipt.txt) && /Catatan:/.test(receipt.txt));
ok('R4 struk BLE: alamat di header + footer Edition', /Gondangmanis/.test(receipt.txt) && /Kartasura/.test(receipt.txt) && /Jl. Raya Uji/.test(receipt.txt) && /Kasir Solo - Rosok Edition/.test(receipt.txt));

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
