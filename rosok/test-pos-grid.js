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
    
    // Wait and clear
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      await db.delete();
    });
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Complete onboarding
    await page.evaluate(async () => {
      document.getElementById('bizName').value = 'Test';
      if (typeof finishOnboarding === 'function') finishOnboarding();
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Check kategori count BEFORE opening POS
    console.log('\n=== BEFORE OPENING POS ===');
    const kategoriCountBefore = await page.evaluate(() => window.KATEGORI?.length || 0);
    console.log('KATEGORI state count:', kategoriCountBefore);
    
    // Check DB count
    const dbCountBefore = await page.evaluate(async () => {
      const Dexie = window.Dexie;
      const db = new Dexie('KasirSoloRosokDB');
      db.version(1).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe' });
      db.version(2).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka' });
      db.version(3).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil' });
      db.version(4).stores({ settings: 'key', kategori: '++id, nama, aktif', transaksi: '++id, tipe, tanggal', transaksiItem: '++id, transaksiId, kategoriId', kas: '++id, tanggal, tipe', kasShift: '++id, status, waktuBuka', platformMessages: '++id, order, visibleFrom, visibleUntil', tutupBuku: '++id, tahun' });
      await db.open();
      const count = await db.kategori.count();
      return count;
    });
    console.log('DB kategori count:', dbCountBefore);
    
    // Open POS
    console.log('\n=== OPENING POS ===');
    await page.evaluate(async () => {
      if (typeof openTransaksi === 'function') {
        await openTransaksi('beli');
      }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Check grid count AFTER opening POS
    const gridItemsAfter = await page.evaluate(() => {
      const grid = document.getElementById('katGrid');
      return grid ? grid.querySelectorAll('.kat-item').length : 0;
    });
    console.log('POS grid items after open:', gridItemsAfter);
    
    // Check KATEGORI count AFTER
    const kategoriCountAfter = await page.evaluate(() => window.KATEGORI?.length || 0);
    console.log('KATEGORI state count after open:', kategoriCountAfter);
    
    // Screenshot
    await page.screenshot({ path: 'test-pos-grid.png' });
    console.log('\nScreenshot saved: test-pos-grid.png');
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
