const puppeteer = require('puppeteer-core');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    protocolTimeout: 300000
  });
  
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:8084', { waitUntil: 'domcontentloaded' });
    
    // Clear DB
    console.log('1. Clearing DB...');
    await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      await db.delete();
      await db.open();
    });
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Complete onboarding
    console.log('2. Completing onboarding...');
    await page.evaluate(async () => {
      const inp = document.getElementById('bizName');
      if (inp) inp.value = 'Test Company';
      const btn = document.querySelector('[onclick*="finishOnboarding"]');
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Navigate to Stok and add category
    console.log('3. Adding category...');
    await page.evaluate(async () => {
      if (typeof showScreen === 'function') showScreen('stok');
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Open kategori form
    await page.evaluate(() => {
      const btn = document.querySelector('[onclick*="openKategoriForm"]');
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    // Fill form
    await page.evaluate(() => {
      document.getElementById('katFormNama').value = 'Test Barang';
      document.getElementById('katFormHargaBeli').value = '10000';
      document.getElementById('katFormHargaJual').value = '15000';
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    // Save
    console.log('4. Saving kategori...');
    await page.evaluate(async () => {
      if (typeof saveKategori === 'function') {
        await saveKategori();
      }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if saved in Stok list
    const inStokBefore = await page.evaluate(() => {
      const card = document.getElementById('stokListCard');
      return card ? card.innerText.includes('Test Barang') : false;
    });
    console.log('5. Category in Stok list before reload:', inStokBefore);
    
    // Check IndexedDB directly
    const categoryCountBefore = await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      db.version(1).stores({
        settings: 'key',
        kategori: '++id, nama, aktif',
        transaksi: '++id, tipe, tanggal',
        transaksiItem: '++id, transaksiId, kategoriId',
        kas: '++id, tanggal, tipe'
      });
      db.version(2).stores({
        settings: 'key',
        kategori: '++id, nama, aktif',
        transaksi: '++id, tipe, tanggal',
        transaksiItem: '++id, transaksiId, kategoriId',
        kas: '++id, tanggal, tipe',
        kasShift: '++id, status, waktuBuka'
      });
      db.version(3).stores({
        settings: 'key',
        kategori: '++id, nama, aktif',
        transaksi: '++id, tipe, tanggal',
        transaksiItem: '++id, transaksiId, kategoriId',
        kas: '++id, tanggal, tipe',
        kasShift: '++id, status, waktuBuka',
        platformMessages: '++id, order, visibleFrom, visibleUntil'
      });
      db.version(4).stores({
        settings: 'key',
        kategori: '++id, nama, aktif',
        transaksi: '++id, tipe, tanggal',
        transaksiItem: '++id, transaksiId, kategoriId',
        kas: '++id, tanggal, tipe',
        kasShift: '++id, status, waktuBuka',
        platformMessages: '++id, order, visibleFrom, visibleUntil',
        tutupBuku: '++id, tahun'
      });
      await db.open();
      const cats = await db.kategori.toArray();
      console.log('[BROWSER] Categories before reload:', cats);
      return cats.length;
    });
    console.log('6. Category count in IndexedDB before reload:', categoryCountBefore);
    
    // Reload
    console.log('7. Reloading page...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check after reload
    const businessName = await page.evaluate(() => {
      return document.getElementById('bizNameHeader')?.innerText || 'N/A';
    });
    console.log('8. Business name after reload:', businessName);
    
    // Navigate to Stok
    await page.evaluate(() => {
      if (typeof showScreen === 'function') showScreen('stok');
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    const inStokAfter = await page.evaluate(() => {
      const card = document.getElementById('stokListCard');
      return card ? card.innerText.includes('Test Barang') : false;
    });
    console.log('9. Category in Stok list after reload:', inStokAfter);
    
    const categoryCountAfter = await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      db.version(1).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe' });
      db.version(2).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka' });
      db.version(3).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil' });
      db.version(4).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil', tutupBuku: '++id, tahun' });
      await db.open();
      const cats = await db.kategori.toArray();
      console.log('[BROWSER] Categories after reload:', cats);
      return cats.length;
    });
    console.log('10. Category count in IndexedDB after reload:', categoryCountAfter);
    
    console.log('\n=== SUMMARY ===');
    console.log('Persistence test:', inStokAfter ? 'PASS' : 'FAIL');
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
