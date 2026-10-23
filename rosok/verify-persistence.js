const puppeteer = require('puppeteer-core');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    protocolTimeout: 300000
  });
  
  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      if (msg.text().includes('[KATEGORI]') || msg.text().includes('[STATE]')) {
        console.log('PAGE LOG:', msg.text());
      }
    });
    
    await page.goto('http://localhost:8084', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Clear DB and reload
    console.log('\n=== STEP 1: Clear DB ===');
    await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      await db.delete();
    });
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Complete onboarding
    console.log('\n=== STEP 2: Onboarding ===');
    await page.evaluate(async () => {
      const inp = document.getElementById('bizName');
      if (inp) inp.value = 'Test Company';
      // Find and call finishOnboarding or similar
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.onclick && btn.onclick.toString().includes('finishOnboarding')) {
          btn.click();
          break;
        }
      }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Check KATEGORI state at dashboard
    console.log('\n=== STEP 3: Check KATEGORI at Dashboard ===');
    const kategoriAtDashboard = await page.evaluate(() => window.KATEGORI?.length || 0);
    console.log('KATEGORI count at dashboard:', kategoriAtDashboard);
    
    // Go to Stok
    console.log('\n=== STEP 4: Add Category ===');
    await page.evaluate(() => {
      if (typeof showScreen === 'function') showScreen('stok');
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // Check DB count before adding
    const dbCountBefore = await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      db.version(1).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe' });
      db.version(2).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka' });
      db.version(3).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil' });
      db.version(4).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil', tutupBuku: '++id, tahun' });
      await db.open();
      const cats = await db.kategori.toArray();
      return { count: cats.length, names: cats.map(c => c.nama) };
    });
    console.log('DB before add:', dbCountBefore);
    
    // Open kategori form and add new category
    await page.evaluate(() => {
      if (typeof openKategoriForm === 'function') openKategoriForm(null);
    });
    await new Promise(r => setTimeout(r, 500));
    
    await page.evaluate(() => {
      document.getElementById('katFormNama').value = 'PERSISTENCE_TEST_BARANG';
      document.getElementById('katFormHargaBeli').value = '9999';
      document.getElementById('katFormHargaJual').value = '11111';
    });
    
    // Save category
    console.log('\n=== STEP 5: Save Category ===');
    await page.evaluate(async () => {
      if (typeof saveKategori === 'function') await saveKategori();
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Check DB after save
    const dbCountAfter = await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      db.version(1).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe' });
      db.version(2).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka' });
      db.version(3).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil' });
      db.version(4).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil', tutupBuku: '++id, tahun' });
      await db.open();
      const cats = await db.kategori.toArray();
      const testCat = cats.find(c => c.nama === 'PERSISTENCE_TEST_BARANG');
      return { count: cats.length, testCat: testCat };
    });
    console.log('DB after add:', dbCountAfter.count, 'categories');
    console.log('Test category in DB:', dbCountAfter.testCat ? 'YES' : 'NO');
    
    // RELOAD PAGE
    console.log('\n=== STEP 6: RELOAD PAGE ===');
    await new Promise(r => setTimeout(r, 2000));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check KATEGORI state after reload
    console.log('\n=== STEP 7: Check After Reload ===');
    const kategoriAfterReload = await page.evaluate(() => {
      return {
        count: window.KATEGORI?.length || 0,
        hasTest: window.KATEGORI?.some(k => k.nama === 'PERSISTENCE_TEST_BARANG') ? 'YES' : 'NO'
      };
    });
    console.log('KATEGORI after reload:', kategoriAfterReload);
    
    // Check DB after reload
    const dbAfterReload = await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      db.version(1).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe' });
      db.version(2).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka' });
      db.version(3).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil' });
      db.version(4).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil', tutupBuku: '++id, tahun' });
      await db.open();
      const cats = await db.kategori.toArray();
      const testCat = cats.find(c => c.nama === 'PERSISTENCE_TEST_BARANG');
      return { count: cats.length, testCat: testCat };
    });
    console.log('DB after reload:', dbAfterReload.count, 'categories');
    console.log('Test category in DB after reload:', dbAfterReload.testCat ? 'YES' : 'NO');
    
    // Go to Stok and check list
    await page.evaluate(() => {
      if (typeof showScreen === 'function') showScreen('stok');
    });
    await new Promise(r => setTimeout(r, 1000));
    
    const testInStok = await page.evaluate(() => {
      const card = document.getElementById('stokListCard');
      return card ? card.innerText.includes('PERSISTENCE_TEST_BARANG') : false;
    });
    console.log('Test category in Stok list:', testInStok ? 'YES' : 'NO');
    
    // SUMMARY
    console.log('\n=== SUMMARY ===');
    console.log('Issue #3 Result:', (dbAfterReload.testCat && testInStok) ? '✓ PASS' : '✗ FAIL');
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
