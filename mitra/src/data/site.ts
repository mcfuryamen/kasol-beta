/**
 * Data statis app mitra.
 * =============================================================================
 * Sengaja TIDAK pakai CMS `site_content` (keb Milan company/) karena:
 * - build harus tetap jalan offline tanpa fetch Supabase
 * - app ini kecil; dinamis = lambat
 *
 * Brand, kontak, dan daftar produk sengaja dicopy dari `company/src/data/local.ts`
 * supaya satu sumber kebenaran untuk nilai yang tampil di publik.
 */

export const site = {
  brand: 'KASIRSOLO',
  legalName: 'PT Mesin Kasir Solo',
  tagline: 'Program Mitra',
  whatsapp: '628816566935',
  phoneDisplay: '+62 881-6566-935',
  /** Situs utama — nav portal mitra nunjuk ke sini (cross-domain). */
  mainSite: 'https://www.kasirsolo.com',
  mainSiteLabel: 'www.kasirsolo.com',
} as const;

export interface Product {
  key: string;
  name: string;
  price: number;
  blurb: string;
  /** `app_type` di database (dipakai buat atribusi referral). */
  appType: string;
}

/**
 * Produk yang bisa direkomendasikan. Kode referal bersifat universal
 * (`app_type='*'`) — satu link berlaku buat semua produk di bawah.
 */
export const products: Product[] = [
  {
    key: 'KK5',
    name: 'Kaki5',
    appType: 'kaki5',
    price: 500000,
    blurb: 'Kasir Android untuk ruko. Offline dulu, sinkron online kalau sinyal balik.',
  },
  {
    key: 'KSR',
    name: 'Rosok',
    appType: 'rosok',
    price: 500000,
    blurb: 'Kasir + stok + laporan. Untuk ruko yang sudah mulai padat.',
  },
  {
    key: 'KSL',
    name: 'Laundry',
    appType: 'laundry',
    price: 500000,
    blurb: 'Antar-jemput laundry. Order, status cucian, sama piutang rapi.',
  },
  {
    key: 'MML',
    name: 'Minimarket',
    appType: 'minimarket',
    price: 199000,
    blurb: 'Kasir minimarket. Murah, cocok buat mulai dari rak kecil.',
  },
  {
    key: 'RTL',
    name: 'Kasir Retail',
    appType: 'retail',
    price: 2500000,
    blurb: 'Kasir + stok + laporan buat toko retail. Paket lengkap, buat yang sudah serius.',
  },
];

export const formatRupiah = (n: number): string =>
  'Rp ' + Math.round(n).toLocaleString('id-ID');

// Catatan audit 2026-11-18: `POIN_TO_RUPIAH` & `formatTanggal` dihapus —
// tak pernah dipakai (dashboard pencairan pindah ke /akun, angka poin dikonversi
// di sana: `points * 1000`).
