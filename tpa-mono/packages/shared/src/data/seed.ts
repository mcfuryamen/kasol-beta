// ============================================================
// Enhanced Seed Data with 60+ curriculum materials
// ============================================================

export const SEED_CURRICULUM = {
  categories: [
    'Iqro / Baca Tulis Al-Quran',
    'Hafalan Al-Quran',
    'Tajwid',
    'Fiqh Ibadah',
    'Akhlak & Adab',
    'Doa Harian',
    'Sirah Nabi',
  ],
  materials: {
    0: ['Pengenalan Huruf Hijaiyah', 'Harakat Fathah Kasrah Dhammah', 'Huruf Bersambung', 'Tanwin', 'Sukun & Tasydid', 'Mad Thobi\'i'],
    1: ['Al-Fatihah', 'An-Nas', 'Al-Falaq', 'Al-Ikhlas', 'Al-Lahab', 'An-Nasr', 'Al-Kafirun', 'Al-Kausar', 'Al-Maun', 'Quraisy', 'Al-Fil', 'Al-Humazah', 'Al-Asr', 'At-Takasur'],
    2: ['Hukum Nun Mati & Tanwin', 'Hukum Mim Mati', 'Mad Far\'i', 'Waqaf & Ibtida\'', 'Idgham', 'Ikhfa\'', 'Iqlab', 'Idzhar'],
    3: ['Thaharah (Bersuci)', 'Wudhu & Tayammum', 'Shalat 5 Waktu', 'Shalat Berjamaah', 'Shalat Jumat', 'Puasa Ramadhan', 'Zakat Fitrah'],
    4: ['Adab Makan & Minum', 'Adab Tidur & Bangun', 'Adab di Masjid', 'Adab kepada Orang Tua', 'Adab kepada Guru', 'Kejujuran', 'Kasih Sayang', 'Sabar & Syukur'],
    5: ['Doa Sebelum Makan', 'Doa Setelah Makan', 'Doa Masuk Masjid', 'Doa Keluar Masjid', 'Doa Sebelum Tidur', 'Doa Bangun Tidur', 'Doa Belajar', 'Doa untuk Kedua Orang Tua', 'Doa Naik Kendaraan'],
    6: ['Kelahiran Nabi Muhammad', 'Masa Kanak-Kanak Nabi', 'Turunnya Wahyu Pertama', 'Dakwah di Mekkah', 'Hijrah ke Madinah', 'Perang Badar', 'Fathu Makkah', 'Khulafaur Rasyidin'],
  } as Record<number, string[]>,
};

export const SEED_SPP_TYPES = [
  { name: 'SPP Bulanan', amount: 50000, isRecurring: true },
  { name: 'Infaq', amount: 10000, isRecurring: true },
  { name: 'Seragam', amount: 150000, isRecurring: false },
  { name: 'Buku Iqro', amount: 25000, isRecurring: false },
];
