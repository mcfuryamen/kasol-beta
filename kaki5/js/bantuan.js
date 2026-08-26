// ==================== BANTUAN (ESM) ====================
// Modul pembelajaran & tutorial penggunaan Kasir Solo - Kaki Lima
import { escapeHtml } from './helpers.js';

const TUTORIALS = [
  {
    icon: '🚀',
    title: 'Memulai Pakai Aplikasi',
    content: `
      <div class="klh18 kfs14">
        <p><b>Cara Mulai (Onboarding 2 Langkah):</b></p>
        <ol class="kpl20 kmy8">
          <li>Isi <b>Nama Usaha</b> di layar pertama (misal: Bakso Pak Budi)</li>
          <li>Tekan tombol <b>"🚀 Mulai Masa Percobaan"</b></li>
          <li>Baca <b>Syarat &amp; Ketentuan</b> → tekan <b>"✓ Setuju &amp; Lanjut"</b> untuk mulai memakai</li>
        </ol>
        <p class="kmt16"><b>Setelah Masuk:</b></p>
        <p class="kpl20 kmy8">
          Lengkapi profil usaha (nama pemilik, WhatsApp, alamat) di menu
          <b>Pengaturan → Profil</b>. Kalau belum lengkap, di halaman Beranda akan muncul
          pengingat <b>"Lengkapi Profil Tokomu"</b> — tekan <b>"Isi Profil Sekarang"</b>.
        </p>
        <p class="kwarn-card">
          💡 <b>Tips:</b> Nama usaha, pemilik, WhatsApp &amp; alamat bisa diubah kapan saja di menu
          <b>Pengaturan → Profil</b>.
        </p>
      </div>
    `
  },
  {
    icon: '🍽️',
    title: 'Atur Menu Jualan',
    content: `
      <div class="klh18 kfs14">
        <p><b>Cara Menambah Menu:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka tab <b>Makanan</b> (menu bawah: 🍽️ Menu)</li>
          <li>Tekan tombol <b>➕</b> (hijau) di pojok kanan bawah</li>
          <li>Isi <b>Nama Menu</b> (misal: Bakso Urat)</li>
          <li>Pilih <b>Kategori</b> dari daftar: 🍚 Makanan / 🥤 Minuman / 🍢 Snack / Jajanan / 📦 Lainnya</li>
          <li>Isi <b>Harga Jual</b> (misal: 15000) — wajib</li>
          <li>Isi <b>Harga Modal / Bahan</b> (misal: 8000) — untuk menghitung untung</li>
          <li>Tekan <b>"💾 Simpan"</b></li>
        </ol>
        <p class="kmt16"><b>Info di Daftar Menu:</b></p>
        <p class="kpl20 kmy8">
          Menu tampil berkelompok per kategori, lengkap dengan <b>Modal</b> dan <b>Untung</b> tiap item.
        </p>
        <p class="kmt16"><b>Edit / Nonaktifkan / Hapus:</b></p>
        <ul class="kpl20 kmy8">
          <li><b>✏️</b> = edit menu</li>
          <li><b>⏸️</b> = nonaktifkan (menu <b>tidak muncul</b> di halaman Jualan, tapi tetap tersimpan); tekan <b>▶️</b> untuk aktifkan lagi</li>
          <li><b>🗑️</b> = hapus menu (ada konfirmasi dulu)</li>
        </ul>
      </div>
    `
  },
  {
    icon: '🛒',
    title: 'Catat Penjualan (Jualan)',
    content: `
      <div class="klh18 kfs14">
        <p><b>Langkah Mencatat Penjualan:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka tab <b>Jualan</b> (🛒)</li>
          <li>Pilih kategori di atas atau cari menu di kolom <b>"Cari menu..."</b></li>
          <li>Ketuk menu → masuk keranjang; ketuk lagi = tambah jumlah</li>
          <li>Muncul <b>bilah hijau "🛒 jumlah item / total Rp"</b> di bawah → ketuk untuk bayar</li>
        </ol>
        <p class="kmt16"><b>Di Layar Bayar:</b></p>
        <ul class="kpl20 kmy8">
          <li>Atur jumlah dengan tombol <b>−</b> / <b>+</b></li>
          <li>Kolom uang sudah otomatis terisi total (uang pas)</li>
          <li>Atau ketuk tombol uang pas yang tersedia (misal 10.000, 20.000, 50.000)</li>
          <li><b>Kembalian dihitung otomatis</b></li>
          <li>Tekan <b>"✅ Simpan"</b></li>
        </ul>
        <p class="kinfo-card">
          🖨️ <b>Tips:</b> Setelah transaksi tersimpan, muncul tombol <b>"🖨️ Cetak Nota"</b> (15 detik) untuk langsung mencetak struk.
        </p>
      </div>
    `
  },
  {
    icon: '💸',
    title: 'Catat Pengeluaran',
    content: `
      <div class="klh18 kfs14">
        <p><b>Langkah Mencatat Pengeluaran:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka tab <b>Laporan</b> (📊)</li>
          <li>Tekan tombol <b>➕</b> di pojok kanan bawah</li>
          <li>Isi <b>"Buat Apa?"</b> (keterangan, misal: Beli daging ayam)</li>
          <li>Pilih <b>"Jenis Pengeluaran"</b>: 🥬 Bahan Baku / ⛽ Gas &amp; BBM / 🏪 Sewa Tempat / 🍳 Peralatan / 📦 Lainnya</li>
          <li>Isi <b>"Jumlah Uang (Rp)"</b></li>
          <li>Tekan <b>"💾 Simpan"</b></li>
        </ol>
        <p class="kmt16"><b>Setelah Dicatat:</b></p>
        <p class="kpl20 kmy8">
          Pengeluaran masuk ke laporan harian dan otomatis <b>mengurangi Untung Bersih</b>.
          Ketuk item pengeluaran untuk melihat detailnya.
        </p>
      </div>
    `
  },
  {
    icon: '📊',
    title: 'Lihat Laporan Keuangan',
    content: `
      <div class="klh18 kfs14">
        <p><b>Cara Melihat Laporan:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka tab <b>Laporan</b> (📊)</li>
          <li>Pilih periode: <b>Harian / Mingguan / Bulanan</b> (ada juga <b>Custom</b> untuk rentang tanggal)</li>
          <li>Geser tanggal dengan tombol <b>‹</b> dan <b>›</b></li>
        </ol>
        <p class="kmt16"><b>Yang Bisa Dilihat:</b></p>
        <ul class="kpl20 kmy8">
          <li>Ringkasan: 💰 Omzet, 🧮 Modal Bahan, 💸 Pengeluaran, 📈 Untung Bersih, transaksi &amp; porsi terjual</li>
          <li>📊 Margin kotor + grafik (periode Mingguan / Bulanan)</li>
          <li>🏆 <b>Menu Paling Laris</b> (5 teratas)</li>
          <li>💸 <b>Rincian Pengeluaran</b> per kategori (ketuk untuk buka daftar)</li>
          <li>📝 <b>Daftar Transaksi</b> (harian) — ketuk untuk lihat detail</li>
        </ul>
        <p style="background:var(--blue-bg);padding:12px;border-radius:8px;margin-top:12px">
          🔎 <b>Tips:</b> Ketuk satu transaksi untuk lihat rincian (Total, Bayar, Kembalian, Modal, Untung Kotor) &amp; mencetak nota.
        </p>
      </div>
    `
  },
  {
    icon: '🖨️',
    title: 'Cetak Struk Nota',
    content: `
      <div class="klh18 kfs14">
        <p><b>Menyiapkan Printer Bluetooth:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka <b>Pengaturan → Printer Bluetooth</b></li>
          <li>Tekan <b>"📡 Hubungkan Printer"</b>, pilih printer thermal kamu</li>
          <li>Tekan <b>"📄 Cetak Tes"</b> untuk memastikan printer berfungsi</li>
          <li>Untuk melepas koneksi: <b>"❌ Putuskan Printer"</b></li>
        </ol>
        <p class="kmt16"><b>Mencetak Nota:</b></p>
        <ol class="kpl20 kmy8">
          <li>Setelah simpan penjualan, tekan <b>"🖨️ Cetak Nota"</b> yang muncul</li>
          <li>Atau buka detail transaksi → tekan <b>"🖨️ Cetak Nota"</b></li>
        </ol>
        <p class="kwarn-card">
          📄 <b>Tanpa printer Bluettooth?</b> Nota otomatis dibuka lewat <b>print browser</b> — kamu tetap bisa mencetak lewat HP.
        </p>
      </div>
    `
  },
  {
    icon: '💾',
    title: 'Simpan & Pulihkan Data (Cadangan)',
    content: `
      <div class="klh18 kfs14">
        <p><b>Membuat Cadangan:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka <b>Pengaturan → Data &amp; Cadangan</b></li>
          <li>Tekan <b>"💾 Simpan Cadangan"</b> → file data terunduh ke HP</li>
        </ol>
        <p class="kmt16"><b>Memulihkan Cadangan (misal pindah HP):</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka <b>Pengaturan → Data &amp; Cadangan</b></li>
          <li>Tekan <b>"📂 Pulihkan Data"</b>, pilih file cadangan</li>
          <li>Konfirmasi — data lama diganti dengan data dari file</li>
        </ol>
        <p class="kmt16"><b>Hapus Semua Data:</b></p>
        <p class="kpl20 kmy8">
          Menu <b>"🗑️ Hapus Semua Data"</b> menghapus semua data dan <b>tidak bisa dikembalikan</b>.
        </p>
        <p class="kerr-card">
          ⚠️ <b>Penting:</b> Routin-routin buat cadangan (minimal seminggu sekali). Jangan bagikan file cadangan ke orang lain — berisi data usaha kamu.
        </p>
      </div>
    `
  },
  {
    icon: '👤',
    title: 'Profil & Data Usaha',
    content: `
      <div class="klh18 kfs14">
        <p><b>Yang Bisa Diisi:</b></p>
        <ul class="kpl20 kmy8">
          <li>🏪 <b>Nama Usaha</b></li>
          <li>👤 <b>Nama Pemilik</b></li>
          <li>💬 <b>Nomor WhatsApp</b></li>
          <li>📍 <b>Alamat</b> — pilih Provinsi → Kota/Kabupaten → Kecamatan → <b>Desa/Kelurahan</b>, lalu isi detail alamat</li>
        </ul>
        <p class="kmt16"><b>Cara Mengubah:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka <b>Pengaturan → Profil</b></li>
          <li>Ketuk baris yang mau diubah, isi, lalu <b>"Simpan"</b></li>
        </ol>
        <p class="kinfo-card">
          ☁️ <b>Info:</b> Profil tersimpan otomatis di HP dan dikirim ke server kami untuk dukungan &amp; pengelolaan lisensi.
        </p>
      </div>
    `
  },
  {
    icon: '📲',
    title: 'Pasang Aplikasi di Layar Utama & Offline',
    content: `
      <div class="klh18 kfs14">
        <p><b>Kenapa Perlu Dipasang?</b></p>
        <p class="kpl20 kmy8">
          Aplikasi bisa dibuka seperti app biasa (tanpa buka browser) dan tetap bisa dipakai
          <b>walaupun tidak ada internet</b>.
        </p>
        <p class="kmt16"><b>Cara Pasang (Paling Gampang):</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka halaman <b>⚙️ Pengaturan</b></li>
          <li>Cari menu <b>📲 Pasang Aplikasi</b> (di kartu Perangkat)</li>
          <li>Ketuk menu tersebut → dialog instalasi muncul otomatis</li>
          <li>Ketuk <b>"Instal"</b> → selesai! Ikon Kasir Solo muncul di layar utama</li>
        </ol>
        <p class="kmt16"><b>Alternatif (jika dialog tidak muncul):</b></p>
        <ul class="kpl20 kmy8">
          <li><b>Android/Chrome:</b> menu titik tiga <b>⋮</b> → "Tambahkan ke Layar Utama"</li>
          <li><b>iPhone/Safari:</b> tombol Share <b>⎋</b> → "Add to Home Screen"</li>
        </ul>
        <p class="kinfo-card">
          📶 <b>Tips Offline:</b> Semua data penjualan tersimpan otomatis di HP. Saat internet kembali,
          data profil tersinkron otomatis ke server.
        </p>
      </div>
    `
  },
  {
    icon: '🎟️',
    title: 'Lisensi, Masa Coba & Aktivasi',
    content: `
      <div class="klh18 kfs14">
        <p><b>Masa Coba Gratis:</b></p>
        <p class="kpl20 kmy8">
          Saat pertama pakai kamu otomatis dapat <b>masa coba 7 hari</b>. Status terlihat di chip
                  <b>TRIAL</b> pojok kanan atas.
        </p>
        <p class="kmt16"><b>Tambah 1 Hari Gratis (Berbagi):</b></p>
        <ol class="kpl20 kmy8">
                  <li>Tekan chip <b>"TRIAL"</b> di pojok kanan atas untuk buka panel lisensi</li>
          <li>Tekan <b>"🎁 Tambah 1 Hari Gratis"</b>, bagikan ke teman (maksimal 20 kali)</li>
        </ol>
        <p class="kmt16"><b>Beli Lisensi:</b></p>
        <ol class="kpl20 kmy8">
                  <li>Tekan chip <b>"TRIAL"</b> di pojok kanan atas untuk buka panel lisensi</li>
                  <li>Tekan <b>"💳 Beli Lisensi"</b> → muncul sheet dengan <b>QRIS</b> atau rekening &amp; nominal</li>
                  <li>Transfer sesuai nominal, lalu tekan <b>"🧾 Kirim Bukti Pembayaran"</b> → pilih foto bukti, tekan lagi untuk mengirim</li>
                  <li>Admin verifikasi → lisensi diaktifkan otomatis (tunggu beberapa saat)</li>
                </ol>
                <p class="kmt16"><b>Aktivasi Kode Lisensi Resmi:</b></p>
                <ol class="kpl20 kmy8">
                  <li>Tekan chip <b>"TRIAL"</b> di pojok kanan atas untuk buka panel lisensi</li>
                  <li>Masukkan kode berformat <b>KK5-XXXX-XXXX-XX-XXXXXX</b> → tekan <b>"🔑 Aktifkan Kode"</b></li>
                </ol>
        <p class="kwarn-card">
          🎟️ <b>Info:</b> Kode lisensi berlaku <b>per perangkat</b>. Simpan baik-baik kode yang dibeli.
        </p>
      </div>
    `
  },
  {
    icon: '❓',
    title: 'Tanya Jawab (FAQ)',
    content: `
      <div class="klh18 kfs14">
        <p><b>Data hilang kalau HP mati / app ditutup?</b></p>
        <p class="kpl20 kmy8">Tidak. Semua data tersimpan otomatis di HP (mode offline).</p>
        <p class="kmt14"><b>Pindah HP, data ikut pindah?</b></p>
        <p class="kpl20 kmy8">
          Buka <b>Pengaturan → Data &amp; Cadangan</b> untuk mengunduh file, pindahkan ke HP baru,
          lalu <b>Pulihkan Data</b>.
        </p>
        <p class="kmt14"><b>Printer tidak mau mencetak?</b></p>
        <p class="kpl20 kmy8">
          Pastikan printer Bluetooth sudah dihubungkan di <b>Pengaturan → Printer Bluetooth</b>,
          lalu uji dengan <b>"Cetak Tes"</b>. Tanpa printer, nota tetap bisa dicetak lewat print browser.
        </p>
        <p class="kmt14"><b>Masa coba habis, gimana?</b></p>
        <p class="kpl20 kmy8">
          Tambah 1 hari dengan berbagi ke teman, atau beli &amp; aktifkan kode lisensi resmi.
        </p>
        <p class="kmt14"><b>Data penjualan dikirim ke mana?</b></p>
        <p class="kpl20 kmy8">
          Hanya profil usaha (nama, WhatsApp, alamat) yang disinkronkan untuk dukungan.
          Data transaksi tetap lokal di HP.
        </p>
        <p class="kinfo-card">
          💬 <b>Butuh bantuan lain?</b> Hubungi kami di <b>0881-6566-935</b> (WhatsApp).
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
      <div class="card kmb12">
        <div data-action="toggle-tutorial" data-tut-id="${tutId}" style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:4px 0">
          <span class="kfs32">${escapeHtml(tutorial.icon)}</span>
          <div class="kflex-1">
            <div class="kfw700 kfs16">${escapeHtml(tutorial.title)}</div>
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

// Toggle tutorial accordion (auto-close: hanya satu panel terbuka)
export function toggleTutorial(tutId) {
  const panel = document.getElementById(tutId);
  const arrow = document.getElementById(`${tutId}-arrow`);
  if (!panel || !arrow) return;

  const isOpen = panel.style.display !== 'none';

  // Tutup semua panel lain (akordeon → hanya satu yang terbuka)
  TUTORIALS.forEach((_, idx) => {
    const id = `tutorial-${idx}`;
    if (id === tutId) return;
    const p = document.getElementById(id);
    const a = document.getElementById(`${id}-arrow`);
    if (p) p.style.display = 'none';
    if (a) a.style.transform = 'rotate(0deg)';
  });

  panel.style.display = isOpen ? 'none' : 'block';
    arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
  }
  // NOTE: initBantuan & toggleTutorial di-wire ke window oleh app.js (wire map),
  // bukan self-wire di sini — satu-satunya tempat wiring = app.js (R3).
