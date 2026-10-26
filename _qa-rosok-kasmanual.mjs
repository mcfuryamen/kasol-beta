/** QA modul catat kas manual rosok (adopsi kaki5 pengeluaran, 2026-09-13). */
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
const toastText = () => page.evaluate(() => document.querySelector('.toast, #toast')?.textContent?.trim() || '');

await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));
await safeEval(() => showScreen('laporan'));
await page.waitForTimeout(500);

// K1: buka form default → tab Pengeluaran aktif, kategori default, tgl hari ini
const k1 = await safeEval(() => {
  window.openKasForm();
  return {
    title: document.getElementById('kasFormTitle').textContent,
    katVal: document.getElementById('kasKat').value,
    katCount: document.getElementById('kasKat').options.length,
    tgl: document.getElementById('kasTgl').value,
    tglMax: document.getElementById('kasTgl').max
  };
});
ok('K1 form default: judul + kategori BBM + tgl hari ini (max hari ini)',
  k1.title === '🧾 Catat Pengeluaran' && k1.katVal === 'BBM / Bensin' && k1.katCount === 10 && k1.tgl === k1.tglMax, JSON.stringify(k1));

// K2: simpan pengeluaran tunai
await safeEval(() => {
  document.getElementById('kasKet').value = 'Beli bensin angkut';
  document.getElementById('kasJumlah').value = '50000';
  window.saveKasManual();
});
await page.waitForTimeout(600);
const k2 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const rows = await db.kas.toArray();
  const last = rows[rows.length - 1];
  return { last, toast: document.querySelector('.toast, #toast')?.textContent?.trim() || '' };
});
ok('K2 pengeluaran tersimpan (kategori/metode/manual + toast dari laci)',
  k2.last && k2.last.tipe === 'keluar' && k2.last.kategori === 'BBM / Bensin' && k2.last.metodeBayar === 'tunai' && k2.last.manual === true && k2.last.jumlah === 50000 && /dari laci/.test(k2.toast), JSON.stringify(k2.toast));

// K3: daftar Buku Kas menandai manual + bisa diketuk → prefilled edit
const k3 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const rows = await db.kas.toArray();
  const manual = rows.filter(r => r.manual).pop();
  document.querySelector('#kasList .row-item[onclick]')?.click();
  await new Promise(r => setTimeout(r, 300));
  return {
    badge: document.querySelector('#kasList .row-item[onclick]')?.textContent?.includes('manual'),
    prefTitle: document.getElementById('kasFormTitle').textContent,
    prefJumlah: document.getElementById('kasJumlah').value,
    prefKet: document.getElementById('kasKet').value,
    editId: document.getElementById('kasEditId').value,
    expectId: manual && manual.id
  };
});
ok('K3 baris manual ada badge & klik → form ubah terisi dari DB',
  k3.badge === true && k3.prefTitle === '✏️ Ubah Pengeluaran' && k3.prefJumlah === 'Rp 50.000' && k3.prefKet === 'Beli bensin angkut' && Number(k3.editId) === k3.expectId, JSON.stringify(k3));

// K4: ganti tab saat mengubah → state edit dilepas (pelajaran kaki5 v165)
const k4 = await safeEval(() => {
  window.setKasTipe('masuk');
  return { editId: document.getElementById('kasEditId').value, title: document.getElementById('kasFormTitle').textContent, katVal: document.getElementById('kasKat').value };
});
ok('K4 pindah tab melepas state edit + kategori pemasukan', k4.editId === '' && k4.title === '💰 Catat Pemasukan' && k4.katVal === 'Pemasukan Lain', JSON.stringify(k4));

// K5: simpan pemasukan transfer → tipe masuk, metode transfer
await safeEval(() => {
  document.getElementById('kasKet').value = 'Setoran pemilik';
  document.getElementById('kasJumlah').value = '200000';
  document.getElementById('kasMet').value = 'transfer';
  window.saveKasManual();
});
await page.waitForTimeout(600);
const k5 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const rows = await db.kas.toArray();
  const last = rows[rows.length - 1];
  const keluarRows = rows.filter(r => r.tipe === 'keluar' && r.manual);
  return { last, keluarRows };
});
ok('K5 pemasukan transfer tersimpan (row keluar tidak tertimpa)',
  k5.last.tipe === 'masuk' && k5.last.metodeBayar === 'transfer' && k5.last.manual === true && k5.keluarRows.length === 1);

// K6: hitung shift hanya geser tunai (transfer & legacy dikecualikan sesuai aturan)
const k6 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const { hitungKasSistemSejak } = await import('./js/kas.js');
  const rows = await db.kas.toArray();
  const manualKeluarTunai = rows.find(r => r.manual && r.tipe === 'keluar' && r.metodeBayar === 'tunai');
  await db.kas.add({ tanggal: new Date(new Date(manualKeluarTunai.tanggal).getTime() - 30000).toISOString(), tipe: 'masuk', jumlah: 500000, keterangan: 'Modal Awal - QA legacy' }); // tanpa metodeBayar = legacy tunai
  const awal = new Date(new Date(manualKeluarTunai.tanggal).getTime() - 60000).toISOString();
  const s = await hitungKasSistemSejak(awal);
  // modal awal legacy +500000; pengeluaran tunai -50000; transfer TIDAK menggeser
  return { s, expected: 500000 - 50000 };
});
ok('K6 Tutup Kas hanya geser tunai (transfer dilompati)', k6.s === k6.expected, `sistem=${k6.s} expected=${k6.expected}`);

// K7: backdate kemarin → waktu jam 12:00 tanggal itu
const k7 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  window.openKasForm();
  const y = new Date(Date.now() - 86400000);
  const iso = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  document.getElementById('kasTgl').value = iso;
  document.getElementById('kasKet').value = 'Beli karung kemarin';
  document.getElementById('kasJumlah').value = '25000';
  await window.saveKasManual();
  await new Promise(r => setTimeout(r, 400));
  const rows = await db.kas.toArray();
  const row = rows.find(r2 => r2.keterangan === 'Beli karung kemarin');
  const t = new Date(row.tanggal);
  return {
    tanggalBenar: row && row.tanggal.slice(0, 10) === iso,
    jam12: t.getHours() === 12 && t.getMinutes() === 0,
    dateOnly: row.tanggal.slice(0, 10)
  };
});
ok('K7 backdate kemarin → waktu jam 12:00 hari itu', k7.tanggalBenar && k7.jam12, JSON.stringify(k7));

// K8: validasi — keterangan kosong & tanggal masa depan
const k8 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const n0 = (await db.kas.toArray()).length;
  window.openKasForm();
  document.getElementById('kasKet').value = '';
  document.getElementById('kasJumlah').value = '10000';
  await window.saveKasManual();
  const t = new Date(Date.now() + 86400000);
  const iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  document.getElementById('kasKet').value = 'Masa depan';
  document.getElementById('kasTgl').value = iso;
  await window.saveKasManual();
  const n1 = (await db.kas.toArray()).length;
  return { n0, n1, tglMaxOk: document.getElementById('kasTgl').max === new Date().toISOString().slice(0, 10) };
});
ok('K8 validasi: keterangan kosong & tanggal masa depan ditolak', k8.n0 === k8.n1, JSON.stringify(k8));

// K9: hapus catatan manual via modal konfirmasi
const k9 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const rows = await db.kas.toArray();
  const manual = rows.filter(r => r.manual).pop();
  window._ksr_editKasManual(manual.id);
  await new Promise(r2 => setTimeout(r2, 300));
  document.getElementById('kasHapusBtn').click();
  await new Promise(r2 => setTimeout(r2, 400));
  const okBtn = document.querySelector('#confirmModal .btn-danger, #confirmModal #confirmOkBtn, #confirmModal .btn-primary');
  if (okBtn) okBtn.click();
  await new Promise(r2 => setTimeout(r2, 500));
  const after = await db.kas.get(manual.id);
  return { deleted: !after };
});
ok('K9 hapus catatan manual (konfirmasi) → baris hilang', k9.deleted === true, JSON.stringify(k9));

// K10: footer nota 3 baris + URL (regresi permintaan footer)
const k10 = await safeEval(async () => {
  const P = await import('./js/printer.js');
  const txt = P.buildReceiptText({ tipe: 'jual', tanggal: new Date().toISOString(), total: 1000, dibayarkan: 1000, sisa: 0, metodeBayar: 'tunai', items: [{ nama: 'Uji', berat: 1, harga: 1000, subtotal: 1000 }] }, 'Toko', 'Jl. Uji');
  const tail = txt.split('\n').filter(l => l.trim() && !l.includes(String.fromCharCode(29))).slice(-3).join('|');
  return { hasUrl: txt.includes('https://rosok.kasirsolo.com'), tail };
});
ok('K10 footer nota 3 baris: terima kasih | Edition | URL', k10.hasUrl && /Terima kasih! Semoga berkah\|Kasir Solo - Rosok Edition\|https:\/\/rosok\.kasirsolo\.com/.test(k10.tail), k10.tail);

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
