// ==================== BANTUAN (ESM) ====================
// Modul pembelajaran & tutorial penggunaan Kasir Solo - Kaki Lima
import { escapeHtml } from './helpers.js';

const TUTORIALS = [
  {
    icon: '🚀',
    title: 'Memulai Usaha Baru',
    content: `
      <div style="line-height:1.8;font-size:14px">
        <p><b>Langkah Pertama Menggunakan Aplikasi:</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Isi <b>Nama Usaha</b> (misal: Bakso Pak Budi)</li>
          <li>Isi <b>Nama Pemilik</b> dan <b>Nomor WhatsApp</b></li>
          <li>Isi <b>Alamat</b> usaha Anda</li>
          <li>Klik <b>"Mulai Pakai!"</b></li>
        </ol>
        <p style="background:var(--orange-bg);padding:12px;border-radius:8px;margin-top:12px">
          💡 <b>Tips:</b> Data ini bisa diubah kapan saja di menu <b>Pengaturan → Profil</b>
        </p>
      </div>
    `
  },
  {
    icon: '🍽️',
    title: 'Mengelola Menu Jualan',
    content: `
      <div style="line-height:1.8;font-size:14px">
        <p><b>Cara Menambah Menu Baru:</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Buka halaman <b>Menu</b></li>
          <li>Klik tombol <b>➕ (hijau)</b> di pojok kanan bawah</li>
          <li>Isi <b>Nama Menu</b> (misal: Bakso Urat)</li>
          <li>Isi <b>Harga Jual</b> (misal: 15000)</li>
          <li>Isi <b>Modal Bahan</b> (opsional, untuk laporan untung)</li>
          <li>Pilih <b>Kategori</b> (misal: Makanan)</li>
          <li>Klik <b>"Simpan"</b></li>
        </ol>
        
        <p style="margin-top:16px"><b>Cara Edit/Hapus Menu:</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Klik menu yang mau diubah</li>
          <li>Ubah data yang perlu, lalu <b>"Simpan"</b></li>
          <li>Atau klik <b>"Hapus Menu"</b> (merah) untuk menghapus</li>
        </ol>
        
        <p style="background:var(--green-bg);padding:12px;border-radius:8px;margin-top:12px">
          ✅ <b>Tips:</b> Menu yang tidak aktif tetap tersimpan tapi tidak muncul di halaman Jualan
        </p>
      </div>
    `
  },
  {
    icon: '🛒',
    title: 'Melakukan Transaksi Penjualan',
    content: `
      <div style="line-height:1.8;font-size:14px">
        <p><b>Skenario: Pembeli Pesan Bakso Urat 2 Porsi</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Buka halaman <b>Jualan</b></li>
          <li>Klik menu <b>Bakso Urat</b> → otomatis masuk keranjang (1 porsi)</li>
          <li>Klik lagi untuk tambah porsi → jadi 2 porsi</li>
          <li>Klik <b>"Bayar"</b> di pojok kanan bawah</li>
          <li>Masukkan <b>uang yang dibayar</b> (misal: 50000)</li>
          <li>Atau klik tombol preset <b>Rp 50.000</b> (lebih cepat!)</li>
          <li>Kembalian otomatis muncul: <b>Rp 20.000</b></li>
          <li>Klik <b>"Simpan Transaksi"</b></li>
        </ol>
        
        <p style="margin-top:16px"><b>Cara Ubah/Hapus Item di Keranjang:</b></p>
        <ul style="padding-left:20px;margin:8px 0">
          <li>Klik <b>➕</b> atau <b>➖</b> untuk ubah jumlah</li>
          <li>Klik <b>🗑️</b> untuk hapus item</li>
        </ul>
        
        <p style="background:var(--blue-bg);padding:12px;border-radius:8px;margin-top:12px">
          💰 <b>Tips:</b> Jika uang pas, ketik nominal sama dengan total → kembalian = 0
        </p>
      </div>
    `
  },
  {
    icon: '💸',
    title: 'Mencatat Pengeluaran',
    content: `
      <div style="line-height:1.8;font-size:14px">
        <p><b>Skenario: Beli Bahan Baku Air Mineral 1 Kardus</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Buka halaman <b>Laporan</b></li>
          <li>Klik tombol <b>➕ Catat Pengeluaran</b> (pojok kanan bawah)</li>
          <li>Isi <b>Keterangan</b>: "Air mineral 1 kardus"</li>
          <li>Pilih <b>Kategori</b>: "Bahan Baku"</li>
          <li>Isi <b>Jumlah</b>: 50000</li>
          <li>Klik <b>"Simpan"</b></li>
        </ol>
        
        <p style="margin-top:16px"><b>Kategori Pengeluaran:</b></p>
        <ul style="padding-left:20px;margin:8px 0">
          <li><b>🥬 Bahan Baku</b> → bahan utama jualan</li>
          <li><b>⛽ Gas & BBM</b> → gas elpiji, bensin gerobak</li>
          <li><b>🏪 Sewa Tempat</b> → sewa lapak/gerobak</li>
          <li><b>🍳 Peralatan</b> → panci, kompor, piring</li>
          <li><b>📦 Lainnya</b> → tissu, kantong plastik, dll</li>
        </ul>
        
        <p style="background:var(--red-bg);padding:12px;border-radius:8px;margin-top:12px">
          📝 <b>Tips:</b> Catat pengeluaran setiap hari agar laporan untung/rugi akurat!
        </p>
      </div>
    `
  },
  {
    icon: '📊',
    title: 'Melihat Laporan Keuangan',
    content: `
      <div style="line-height:1.8;font-size:14px">
        <p><b>Laporan Harian (Hari Ini):</b></p>
        <ul style="padding-left:20px;margin:8px 0">
          <li><b>💰 Omzet</b> → total penjualan hari ini</li>
          <li><b>🧮 Modal Bahan</b> → biaya bahan menu yang terjual</li>
          <li><b>💸 Pengeluaran</b> → pengeluaran operasional</li>
          <li><b>📈 Untung Bersih</b> → omzet - modal - pengeluaran</li>
          <li><b>📊 Margin Kotor</b> → persentase keuntungan kotor</li>
        </ul>
        
        <p style="margin-top:16px"><b>Laporan Mingguan & Bulanan:</b></p>
        <ul style="padding-left:20px;margin:8px 0">
          <li>Klik tab <b>Mingguan</b> atau <b>Bulanan</b></li>
          <li>Lihat grafik <b>Pemasukan vs Pengeluaran</b></li>
          <li>Navigasi tanggal dengan tombol <b>‹</b> dan <b>›</b></li>
        </ul>
        
        <p style="margin-top:16px"><b>Menu Paling Laris:</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Lihat 5 menu terlaris berdasarkan jumlah porsi terjual
        </p>
        
        <p style="margin-top:16px"><b>Rincian Pengeluaran (Accordion):</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Klik kategori pengeluaran (misal: <b>🥬 Bahan Baku</b>)</li>
          <li>Daftar transaksi muncul di bawahnya</li>
          <li>Klik transaksi untuk lihat detail lengkap</li>
        </ol>
        
        <p style="background:var(--green-bg);padding:12px;border-radius:8px;margin-top:12px">
          📈 <b>Tips:</b> Cek laporan setiap hari untuk pantau performa jualan!
        </p>
      </div>
    `
  },
  {
    icon: '🖨️',
    title: 'Mencetak Struk Belanja',
    content: `
      <div style="line-height:1.8;font-size:14px">
        <p><b>Cara Cetak Struk via Bluetooth:</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Hubungkan printer Bluetooth di <b>Pengaturan → Printer Bluetooth</b></li>
          <li>Setelah transaksi selesai, buka <b>Beranda</b></li>
          <li>Klik transaksi yang baru saja dilakukan</li>
          <li>Klik tombol <b>🖨️ Cetak Nota</b></li>
          <li>Struk otomatis tercetak!</li>
        </ol>
        
        <p style="margin-top:16px"><b>Atau Cetak Transaksi Terakhir:</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Buka <b>Pengaturan → Printer Bluetooth</b></li>
          <li>Klik <b>Cetak Transaksi Terakhir</b></li>
        </ol>
        
        <p style="margin-top:16px"><b>Test Print (Cek Printer):</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Klik <b>Test Print</b> untuk coba cetak contoh struk
        </p>
        
        <p style="background:var(--blue-bg);padding:12px;border-radius:8px;margin-top:12px">
          🖨️ <b>Tips:</b> Pastikan printer sudah paired di Bluetooth HP sebelum disambungkan!
        </p>
      </div>
    `
  },
  {
    icon: '💾',
    title: 'Backup & Restore Data',
    content: `
      <div style="line-height:1.8;font-size:14px">
        <p><b>Cara Backup Data:</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Buka <b>Pengaturan → Cadangkan Data</b></li>
          <li>Klik <b>📥 Ekspor Data</b></li>
          <li>File JSON otomatis terunduh</li>
          <li>Simpan file di tempat aman (Google Drive, dll)</li>
        </ol>
        
        <p style="margin-top:16px"><b>Cara Restore Data:</b></p>
        <ol style="padding-left:20px;margin:8px 0">
          <li>Buka <b>Pengaturan → Cadangkan Data</b></li>
          <li>Klik <b>📤 Impor Data</b></li>
          <li>Pilih file JSON backup sebelumnya</li>
          <li>Data otomatis digabung dengan data saat ini</li>
        </ol>
        
        <p style="margin-top:16px"><b>Hapus Semua Data:</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Klik <b>🗑️ Hapus Semua Data</b> untuk reset aplikasi (hati-hati!)
        </p>
        
        <p style="background:var(--red-bg);padding:12px;border-radius:8px;margin-top:12px">
          ⚠️ <b>Penting:</b> Backup data secara rutin (minimal seminggu sekali)!
        </p>
      </div>
    `
  },
  {
    icon: '🎓',
    title: 'Tips & Trik Jualan Sukses',
    content: `
      <div style="line-height:1.8;font-size:14px">
        <p><b>1. Kelola Stok dengan Baik</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Catat pengeluaran bahan baku setiap hari agar tahu berapa modal sebenarnya
        </p>
        
        <p style="margin-top:16px"><b>2. Pantau Menu Laris</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Cek <b>Menu Paling Laris</b> di Laporan untuk fokus ke menu favorit pembeli
        </p>
        
        <p style="margin-top:16px"><b>3. Hitung Margin dengan Benar</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Isi <b>Modal Bahan</b> saat tambah menu agar margin kotor terhitung otomatis
        </p>
        
        <p style="margin-top:16px"><b>4. Gunakan Preset Nominal</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Saat bayar, klik tombol nominal (50rb, 100rb) lebih cepat daripada ketik manual
        </p>
        
        <p style="margin-top:16px"><b>5. Cetak Struk untuk Profesionalitas</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Pembeli lebih percaya kalau dapat struk resmi, terutama untuk pembelian besar
        </p>
        
        <p style="margin-top:16px"><b>6. Backup Data Rutin</b></p>
        <p style="padding-left:20px;margin:8px 0">
          Setiap akhir minggu, ekspor data dan simpan di cloud (Google Drive/Dropbox)
        </p>
        
        <p style="background:var(--green-bg);padding:12px;border-radius:8px;margin-top:12px">
          💪 <b>Semangat!</b> Dengan aplikasi ini, usaha kaki lima Anda bisa lebih tertata dan untung meningkat!
        </p>
      </div>
    `
  }
];

export function initBantuan() {
  let html = '';
  
  TUTORIALS.forEach((tutorial, idx) => {
    const tutId = `tutorial-${idx}`;
    html += `
      <div class="card" style="margin-bottom:12px">
        <div onclick="toggleTutorial('${tutId}')" style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:4px 0">
          <span style="font-size:32px">${escapeHtml(tutorial.icon)}</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:16px">${escapeHtml(tutorial.title)}</div>
          </div>
          <span id="${tutId}-arrow" style="font-size:20px;color:var(--text3);transition:transform .2s">›</span>
        </div>
        <div id="${tutId}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          ${tutorial.content}
        </div>
      </div>
    `;
  });
  
  document.getElementById('bantuanContent').innerHTML = html;
}

// Toggle tutorial accordion
export function toggleTutorial(tutId) {
  const panel = document.getElementById(tutId);
  const arrow = document.getElementById(`${tutId}-arrow`);
  if (!panel || !arrow) return;
  
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
}

// Auto-initialize when module loads (called from navigation.js)
window.initBantuan = initBantuan;
window.toggleTutorial = toggleTutorial;
