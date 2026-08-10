/**
 * Admin Marketing KASIRSOLO — App State
 * Single source of truth for all reactive state
 */

// --- Default Data ---
export const DEFAULT_CATALOG = [
  { id: 'retail', icon: '🛒', name: 'Kasir Retail', desc: 'Sistem kasir lengkap untuk toko retail, minimarket, dan warung. Dilengkapi manajemen stok & laporan.', price: 250000, category: 'bisnis', hot: true },
  { id: 'konveksi', icon: '👕', name: 'Manajemen Konveksi', desc: 'Kelola produksi konveksi dari order hingga pengiriman. Tracking progress & manajemen bahan.', price: 350000, category: 'bisnis', hot: false },
  { id: 'bengkel', icon: '🔧', name: 'Bengkel + Sparepart', desc: 'Manajemen bengkel lengkap dengan antrian service, stok sparepart, dan invoice otomatis.', price: 400000, category: 'bisnis', hot: true },
  { id: 'masjid', icon: '🕌', name: 'Manajemen Masjid', desc: 'Kelola keuangan masjid transparan: infaq, zakat, kas, dan laporan untuk jamaah.', price: 200000, category: 'institusi', hot: false },
  { id: 'tpa', icon: '📖', name: 'Manajemen TPA/TPQ', desc: 'Sistem manajemen TPA/TPQ untuk pencatatan santri, absensi, progres hafalan, dan laporan wali.', price: 200000, category: 'institusi', hot: false },
  { id: 'klinik', icon: '🩺', name: 'Klinik THT', desc: 'Sistem informasi klinik THT: rekam medis, antrian pasien, kasir, dan laporan. Serba terintegrasi.', price: 500000, category: 'kesehatan', hot: false },
  { id: 'apotek', icon: '💊', name: 'Apotek', desc: 'Manajemen apotek lengkap: stok obat, penjualan, resep, expired date tracking, dan laporan.', price: 450000, category: 'kesehatan', hot: true },
  { id: 'dapur', icon: '🍳', name: 'Dapur SPPG', desc: 'Sistem manajemen dapur untuk institusi: perencanaan menu, stok bahan, kalkulasi porsi & laporan.', price: 300000, category: 'institusi', hot: false }
];

export const DEFAULT_SETTINGS = {
  waNumber: '628816566935',
  email: 'owner.kasirsolo@gmail.com',
  addrLegal: 'Perum Graha Tiara 2 B1 Gumpang 07/01, Kartasura, Sukoharjo, Jawa Tengah 57169',
  mapsLegal: 'https://maps.app.goo.gl/DtNwuJvY9KufJN3CA',
  addrOps: 'Gumiring 04/04, Sidomulyo, Banjarejo, Blora, Jawa Tengah 58253',
  mapsOps: 'https://maps.app.goo.gl/F9YMpuBUPMd1tcNWA',
  statClients: 500,
  statUptime: 99.9
};

// --- Reactive State ---
export const STATE = {
  catalog: [],
  settings: {},
  leads: [],
  stats: { visits: 0 },
  licenseProducts: [],
  currentUser: null,
  isLoading: false
};

// --- Subscriber System ---
const subscribers = new Map(); // key -> Set<callback>

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch
 * @param {Function} callback - Called with new value when key changes
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, callback) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(callback);
  return () => subscribers.get(key).delete(callback);
}

/**
 * Set state value and notify subscribers
 * @param {string} key - State key
 * @param {*} value - New value
 */
export function setState(key, value) {
  STATE[key] = value;
  subscribers.get(key)?.forEach(cb => cb(value));
}

/**
 * Get current state value
 * @param {string} key - State key
 * @returns {*}
 */
export function getState(key) {
  return STATE[key];
}

/**
 * Initialize state from storage
 * @param {Object} storage - Storage abstraction
 */
export async function initState(storage) {
  STATE.isLoading = true;
  notifyLoading(true);

  try {
    const [catalog, settings, leads, stats] = await Promise.all([
      storage.get('catalog', DEFAULT_CATALOG),
      storage.get('settings', DEFAULT_SETTINGS),
      storage.get('leads', []),
      storage.get('stats', { visits: 0 })
    ]);

    STATE.catalog = catalog;
    STATE.settings = { ...DEFAULT_SETTINGS, ...settings };
    STATE.leads = leads;
    STATE.stats = stats;

    notifyLoading(false);
  } catch (error) {
    console.error('Failed to init state:', error);
    // Fallback to defaults
    STATE.catalog = DEFAULT_CATALOG;
    STATE.settings = { ...DEFAULT_SETTINGS };
    STATE.leads = [];
    STATE.stats = { visits: 0 };
    notifyLoading(false);
  }
}

function notifyLoading(isLoading) {
  STATE.isLoading = isLoading;
  subscribers.get('isLoading')?.forEach(cb => cb(isLoading));
}

/**
 * Refresh all data from storage
 * @param {Object} storage - Storage abstraction
 */
export async function refreshAll(storage) {
  STATE.isLoading = true;
  notifyLoading(true);

  try {
    const [catalog, settings, leads, stats] = await Promise.all([
      storage.get('catalog', DEFAULT_CATALOG),
      storage.get('settings', DEFAULT_SETTINGS),
      storage.get('leads', []),
      storage.get('stats', { visits: 0 })
    ]);

    STATE.catalog = catalog;
    STATE.settings = { ...DEFAULT_SETTINGS, ...settings };
    STATE.leads = leads;
    STATE.stats = stats;

    notifyLoading(false);
    return true;
  } catch (error) {
    console.error('Failed to refresh:', error);
    notifyLoading(false);
    return false;
  }
}

// --- License Products State (separate key) ---
export async function loadLicenseProducts(storage) {
  try {
    const products = await storage.getLicenseProducts();
    if (products) {
      STATE.licenseProducts = products;
      subscribers.get('licenseProducts')?.forEach(cb => cb(products));
    }
  } catch (error) {
    console.error('Failed to load license products:', error);
  }
}

export async function saveLicenseProducts(storage, products) {
  try {
    await storage.setLicenseProducts(products);
    STATE.licenseProducts = products;
    subscribers.get('licenseProducts')?.forEach(cb => cb(products));
    return true;
  } catch (error) {
    console.error('Failed to save license products:', error);
    return false;
  }
}