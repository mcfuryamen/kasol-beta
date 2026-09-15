// ============================================================
// Help / Tutorial data per role
// ============================================================

export interface TutorialItem {
  icon: string;
  title: string;
  description: string;
  steps: string[];
}

export const ADMIN_TUTORIALS: TutorialItem[] = [
  { icon: '🏠', title: 'Dashboard', description: 'Melihat ringkasan data TPA.', steps: ['Buka tab Beranda di bottom navigation', 'Dashboard menampilkan statistik: santri, ustadz, kelas', 'Scroll ke bawah untuk hafalan terbaru', 'Tap "Semua →" untuk melihat detail'] },
  { icon: '👨‍🎓', title: 'Kelola Santri', description: 'Menambah, mengedit, dan menghapus data santri.', steps: ['Buka tab Data → pilih chip Santri', 'Tap tombol + (FAB) untuk tambah baru', 'Isi form: nama, NIS, JK, wali, alamat', 'Tap 💾 Simpan', 'Untuk edit: tap nama santri di daftar'] },
  { icon: '👳', title: 'Kelola Ustadz', description: 'Mengelola data pengajar.', steps: ['Buka tab Data → chip Ustadz', 'Tap + untuk tambah', 'Isi nama, spesialisasi, telepon', 'Tap 💾 Simpan'] },
  { icon: '🏫', title: 'Kelola Kelas', description: 'Membuat dan mengatur kelas.', steps: ['Buka tab Data → chip Kelas', 'Tap + untuk tambah', 'Pilih level (Iqro 1-6, Juz Amma, Tahfidz)', 'Atur ruangan dan kapasitas'] },
  { icon: '📖', title: 'Kurikulum', description: 'Melihat dan mengelola 7 pilar kurikulum.', steps: ['Buka tab Akademik → chip Kurikulum', 'Lihat daftar materi per kategori (60+ materi)', 'Tap materi untuk detail: level, durasi, konten', 'Materi sudah di-seed: Iqro, Hafalan, Tajwid, Fiqh, Akhlak, Doa, Sirah'] },
  { icon: '✅', title: 'Absensi', description: 'Merekam kehadiran santri.', steps: ['Buka tab Akademik → chip Absensi', 'Tap + untuk input baru', 'Pilih kelas', 'Tap ✅/📝/🤒/❌ per santri', 'Tap 💾 Simpan'] },
  { icon: '🕌', title: 'Input Hafalan', description: 'Mencatat progres hafalan Al-Quran.', steps: ['Buka tab Akademik → chip Hafalan', 'Tap + untuk input baru', 'Pilih kelas → santri', 'Pilih jenis: Ziyadah/Murajaah/Tasmi\'', 'Pilih surat, ayat dari-sampai', 'Pilih nilai: Mumtaz → Belum Lulus', 'Tap 💾 Simpan'] },
  { icon: '📕', title: 'Input Iqro', description: 'Mencatat progres Iqro.', steps: ['Buka tab Akademik → chip Iqro', 'Tap + untuk input baru', 'Pilih kelas → santri → jilid → halaman', 'Pilih nilai: Lancar/Cukup/Mengulang'] },
  { icon: '💰', title: 'Pembayaran SPP', description: 'Mengelola tagihan dan pembayaran.', steps: ['Buka tab Keuangan → chip SPP', 'Tap "Generate Tagihan" untuk buat tagihan bulan ini', 'Tap tagihan belum lunas → isi jumlah', 'Pilih metode: Tunai/Transfer/QRIS'] },
  { icon: '🏦', title: 'Kas', description: 'Mencatat arus kas TPA.', steps: ['Buka tab Keuangan → chip Kas', 'Lihat ringkasan: Masuk, Keluar, Saldo', 'Tap + untuk catat transaksi baru'] },
  { icon: '💾', title: 'Backup', description: 'Export dan import data.', steps: ['Buka tab Lainnya → chip Pengaturan', 'Tap "Export JSON" untuk backup', 'Untuk restore: tap "Import" → pilih file'] },
];

export const GURU_TUTORIALS: TutorialItem[] = [
  { icon: '🏠', title: 'Dashboard', description: 'Melihat ringkasan kelas dan jadwal hari ini.', steps: ['Buka tab Beranda', 'Lihat jumlah kelas, santri, sesi hari ini', 'Scroll ke bawah untuk jadwal'] },
  { icon: '🏫', title: 'Kelas Saya', description: 'Melihat kelas yang diampu.', steps: ['Buka tab Kelas → chip Kelas Saya', 'Lihat semua kelas Anda', 'Badge "Wali Kelas" menandakan status Anda'] },
  { icon: '✅', title: 'Input Absensi', description: 'Mencatat kehadiran santri.', steps: ['Buka tab Input → chip Absensi', 'Tap ✅ (FAB) untuk mulai', 'Pilih kelas', 'Tap status per santri', 'Tap 💾 Simpan'] },
  { icon: '🕌', title: 'Input Hafalan', description: 'Mencatat progres hafalan.', steps: ['Buka tab Input → chip Hafalan', 'Tap 📖 (FAB) untuk input', 'Pilih kelas → santri → surat → ayat', 'Pilih nilai → Tap 💾 Simpan'] },
  { icon: '📕', title: 'Input Iqro', description: 'Mencatat progres Iqro.', steps: ['Buka tab Input → chip Iqro', 'Tap 📕 (FAB) untuk input', 'Pilih kelas → santri → jilid → halaman', 'Pilih nilai → Tap 💾 Simpan'] },
  { icon: '📖', title: 'Kurikulum', description: 'Melihat materi pembelajaran.', steps: ['Buka tab Kelas → chip Kurikulum', 'Lihat 7 kategori kurikulum', 'Tap materi untuk detail'] },
];

export const WALI_TUTORIALS: TutorialItem[] = [
  { icon: '🏠', title: 'Dashboard', description: 'Melihat data anak dan update terbaru.', steps: ['Buka tab Beranda', 'Lihat kartu profil anak', 'Scroll ke bawah untuk update hafalan'] },
  { icon: '🕌', title: 'Progres Hafalan', description: 'Memantau hafalan anak.', steps: ['Buka tab Progres → chip Hafalan', 'Lihat daftar hafalan per anak', 'Nilai: Mumtaz (terbaik) → Belum Lulus'] },
  { icon: '📕', title: 'Progres Iqro', description: 'Memantau Iqro anak.', steps: ['Buka tab Progres → chip Iqro', 'Lihat posisi terakhir: Jilid & Halaman'] },
  { icon: '✅', title: 'Kehadiran', description: 'Melihat rekap kehadiran.', steps: ['Buka tab Progres → chip Kehadiran', 'Lihat statistik per status', 'Persentase kehadiran otomatis'] },
  { icon: '💰', title: 'Pembayaran', description: 'Melihat status tagihan SPP.', steps: ['Buka tab Bayar', 'Lihat tagihan per anak per bulan', 'Status: Pending / Partial / Paid'] },
];
