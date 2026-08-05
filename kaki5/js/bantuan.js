// ==================== BANTUAN (ESM) ====================
// Halaman tutorial singkat cara memakai Kasir Solo - Kaki Lima.
import { escapeHtml } from './helpers.js';

const SECTIONS = [
  {
    icon: '🏠',
    title: 'Beranda',
    body: 'Pusat ringkasan: total penjualan hari ini, jumlah transaksi, dan akses cepat ke menu favorit. Sentuh kartu untuk masuk ke halaman terkait.'
  },
  {
    icon: '🛒',
    title: 'Jualan (POS)',
    body: 'Tempat mencatat transaksi penjualan. Pilih menu yang dibeli, isi jumlah, lalu tekan tombol Bayar untuk menyelesaikan transaksi dan cetak struk.'
  },
  {
    icon: '🍽️',
    title: 'Menu',
    body: 'Kelola daftar menu jualan. Tekan tombol ＋ untuk menambah menu baru: isi nama, harga jual, dan estimasi modal bahan. Anda juga bisa mengubah atau menghapus menu yang sudah ada.'
  },
  {
    icon: '📊',
    title: 'Laporan & Pengeluaran',
    body: 'Lihat laporan omzet, modal, pengeluaran, dan untung bersih per hari/minggu/bulan. Untuk mencatat pengeluaran (bahan baku, gas, sewa, dll.), tekan tombol ＋ di bagian bawah pada seksi 💸 Pengeluaran.'
  },
  {
    icon: '🖨️',
    title: 'Cetak Struk',
    body: 'Struk bisa dicetak lewat printer Bluetooth. Di halaman Pengaturan, pilih status Bluetooth kemudian sambungkan printer, lalu gunakan "Cetak Tes" untuk memastikan printer berfungsi.'
  },
  {
    icon: '💾',
    title: 'Cadangkan Data',
    body: 'Agar data tidak hilang, buka Pengaturan → 💾 Data & Cadangan → "Simpan Cadangan". File disimpan ke HP. Untuk pindah HP, gunakan "Pulihkan Data".'
  },
  {
    icon: '⚙️',
    title: 'Pengaturan / Profil',
    body: 'Atur nama usaha, nama pemilik, dan nomor WhatsApp. Gunakan menu ini juga untuk mengelola lisensi, printer, dan data cadangan.'
  },
  {
    icon: '🎫',
    title: 'Lisensi & Trial',
    body: 'Aplikasi punya masa percobaan 7 hari. Jika serial lisensi sudah dibeli, masukkan kode di halaman Aktivasi Lisensi (klik badge TRIAL di pojok atas atau menu Kelola Lisensi).'
  }
];

export function initBantuan() {
  const box = document.getElementById('bantuanContent');
  if (!box) return;
  box.innerHTML = SECTIONS.map(s => `
    <div class="card">
      <div class="card-title">${s.icon} ${escapeHtml(s.title)}</div>
      <div style="font-size:14px;color:var(--text2);line-height:1.6">${escapeHtml(s.body)}</div>
    </div>
  `).join('');
}
