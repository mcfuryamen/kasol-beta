/**
 * Admin Marketing KASIRSOLO — Storage Layer (Dexie)
 * Offline-first data persistence for admin dashboard
 * Uses Dexie.js (already loaded via dexie.min.js)
 */

const DB_NAME = 'kasir-admin';
const DB_VERSION = 2;

export const STORES = {
  products: 'products',
  serials: 'serials',
  clients: 'clients',
  leads: 'leads',
  settings: 'settings',
  syncQueue: 'syncQueue'
};

let dbInstance = null;

// Wait for Dexie to be available
function waitForDexie() {
  return new Promise((resolve) => {
    if (window.Dexie) {
      resolve(window.Dexie);
    } else {
      const check = setInterval(() => {
        if (window.Dexie) {
          clearInterval(check);
          resolve(window.Dexie);
        }
      }, 50);
    }
  });
}

export async function getDB() {
  if (dbInstance) return dbInstance;

  const Dexie = await waitForDexie();

  dbInstance = new Dexie(DB_NAME);

  dbInstance.version(DB_VERSION).stores({
    products: 'id, app_type, active',
    serials: 'serial, product, device_code, status, created_at',
    clients: 'id, app_type, unit_id, last_seen, synced',
    leads: 'id, app_type, status, created_at, synced',
    settings: 'key',
    syncQueue: '++id, type, status, created_at'
  });

  // Handle upgrade
  dbInstance.on('populate', async () => {
    await seedIfEmpty();
  });

  await dbInstance.open();
  return dbInstance;
}

// Generic CRUD helpers
export async function getAll(storeName) {
  const db = await getDB();
  return db[storeName].toArray();
}

export async function getByKey(storeName, key) {
  const db = await getDB();
  return db[storeName].get(key);
}

export async function put(storeName, data) {
  const db = await getDB();
  return db[storeName].put(data);
}

export async function putMany(storeName, items) {
  const db = await getDB();
  return db.transaction('rw', db[storeName], async () => {
    for (const item of items) {
      await db[storeName].put(item);
    }
  });
}

export async function del(storeName, key) {
  const db = await getDB();
  return db[storeName].delete(key);
}

export async function clear(storeName) {
  const db = await getDB();
  return db[storeName].clear();
}

export async function getByIndex(storeName, indexName, value) {
  const db = await getDB();
  return db[storeName].where(indexName).equals(value).toArray();
}

export async function count(storeName) {
  const db = await getDB();
  return db[storeName].count();
}

// Sync queue operations
export async function addToSyncQueue(type, payload) {
  const db = await getDB();
  return db.syncQueue.add({
    type,
    payload,
    status: 'pending',
    created_at: Date.now(),
    retries: 0
  });
}

export async function getPendingSync() {
  const db = await getDB();
  return db.syncQueue.where('status').equals('pending').toArray();
}

export async function markSyncDone(id) {
  const db = await getDB();
  return db.syncQueue.delete(id);
}

export async function markSyncFailed(id, retries) {
  const db = await getDB();
  const item = await db.syncQueue.get(id);
  if (item) {
    item.retries = retries;
    item.status = retries >= 3 ? 'failed' : 'pending';
    return db.syncQueue.put(item);
  }
}

// Initialize with sample data if empty
export async function seedIfEmpty() {
  const db = await getDB();
  const [products, clients, leads] = await Promise.all([
    db.products.count(),
    db.clients.count(),
    db.leads.count()
  ]);

  if (products === 0) {
    await db.products.bulkPut([
      { id: 'kaki5', app_type: 'kaki5', name: 'Kaki Lima', icon: '🛵', prefix: 'KK5', price: 250000, active: true, description: 'Aplikasi POS untuk pedagang kaki lima & UMKM kecil. Transaksi cepat, laporan harian, sinkron cloud.' },
      { id: 'rosok', app_type: 'rosok', name: 'Rosok', icon: '♻️', prefix: 'KSR', price: 350000, active: true, description: 'Aplikasi POS untuk pengepul & bank sampah. Timbangan digital, harga per kg, laporan pickup.' },
      { id: 'gerobak', app_type: 'gerobak', name: 'Gerobak', icon: '🛒', prefix: 'GBK', price: 300000, active: true, description: 'Aplikasi POS untuk gerobak makanan & minuman. Menu cepat, keranjang, cetak struk Bluetooth.' },
      { id: 'retail', app_type: 'retail', name: 'Retail', icon: '🏪', prefix: 'RTL', price: 500000, active: true, description: 'Aplikasi POS untuk toko retail & minimarket. Manajemen stok, barcode scanner, multi-gudang.' }
    ]);
  }

  if (clients === 0) {
    await db.clients.bulkPut([
      { id: 'cli-1', app_type: 'kaki5', unit_id: 'K5-ABCD-1234', device_code: 'ABCD-1234', namaWarung: 'Warung Bu Siti', namaPemilik: 'Siti Rahayu', noWhatsapp: '081234567890', last_seen: Date.now() - 86400000, synced: true },
      { id: 'cli-2', app_type: 'rosok', unit_id: 'KSR-EFGH-5678', device_code: 'EFGH-5678', namaWarung: 'Bank Sampah Makmur', namaPemilik: 'Budi Santoso', noWhatsapp: '082345678901', last_seen: Date.now() - 172800000, synced: true },
      { id: 'cli-3', app_type: 'gerobak', unit_id: 'GBK-IJKL-9012', device_code: 'IJKL-9012', namaWarung: 'Bakso Pak Joko', namaPemilik: 'Joko Widodo', noWhatsapp: '083456789012', last_seen: Date.now() - 3600000, synced: true }
    ]);
  }

  if (leads === 0) {
    await db.leads.bulkPut([
      { id: 'lead-1', app_type: 'kaki5', nama: 'Warung Bu Siti', telepon: '081234567890', alamat: 'Jl. Merdeka No. 10', status: 'baru', created_at: Date.now() - 120000, synced: true },
      { id: 'lead-2', app_type: 'rosok', nama: 'Bank Sampah Sejahtera', telepon: '082345678901', alamat: 'Jl. Sudirman No. 25', status: 'dihubungi', created_at: Date.now() - 900000, synced: true },
      { id: 'lead-3', app_type: 'gerobak', nama: 'Sate Pak Budi', telepon: '083456789012', alamat: 'Jl. Gatot Subroto No. 5', status: 'tertarik', created_at: Date.now() - 3600000, synced: true }
    ]);
  }
}