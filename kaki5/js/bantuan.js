// ==================== BANTUAN (ESM) ====================
// Modul pembelajaran & tutorial penggunaan Kasir Solo - Kaki Lima
// Teks tutorial HANYA boleh menyebut label yang benar-benar ada di UI.
// Setiap kali mengubah label tombol/judul modal/daftar kategori di index.html
// atau modul JS, sesuaikan juga isi TUTORIALS di bawah.
import { escapeHtml } from './helpers.js';

const TUTORIALS = [
  {
    icon: '🚀',
    title: 'Memulai Pakai Aplikasi',
    content: `
      <div class="klh18 kfs14">
        <p><b>Langkah Pertama:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka aplikasinya — jendela <b>"📜 Syarat &amp; Ketentuan"</b> muncul sendiri di awal</li>
          <li>Tekan <b>"✓ Saya Setuju"</b> untuk mulai, atau <b>"✕ Nanti Saja"</b> kalau mau membaca nanti (S&amp;K akan muncul lagi saat aplikasi dibuka ulang)</li>
          <li>Isi <b>Nama Usaha</b>, <b>Nama Pemilik</b>, <b>Nomor WhatsApp</b>, dan <b>Alamat</b> di <b>Pengaturan → kartu 👤 Profil</b></li>
        </ol>
        <p class="kmt16"><b>Tidak Ada Masa Coba Berhitung Hari:</b></p>
        <p class="kpl20 kmy8">
          Aplikasi langsung bisa dipakai. Yang dibatasi hanyalah <b>jumlah transaksi gratis per bulan</b> —
          sisa kuota terlihat di chip <b>GRATIS</b> pojok kanan atas. Detailnya di tutorial <b>🎟️ Lisensi &amp; Kuota Gratis</b>.
        </p>
        <p class="kmt16"><b>Setelah Masuk:</b></p>
        <p class="kpl20 kmy8">
          Selama profil belum lengkap, pengingat <b>"Lengkapi Profil Tokomu"</b> tampil di semua halaman
          kecuali Pengaturan — tekan <b>"Isi Profil Sekarang"</b>.
        </p>
        <p class="kmt16"><b>Isi Halaman Beranda:</b></p>
        <ul class="kpl20 kmy8">
          <li>Paling atas kartu kas <b>"🔒 Kas Belum Dibuka"</b> (kalau fitur kas aktif) — lihat tutorial <b>💰 Buka &amp; Tutup Kas</b></li>
          <li>Ringkasan hari ini: <b>💰 Omzet Hari Ini</b>, <b>🧾 Pengeluaran</b>, <b>📈 Laba Hari Ini</b>, <b>🛒 Jumlah Transaksi</b>, <b>🍽️ Porsi Terjual</b>, <b>💸 Rata-rata per Transaksi</b></li>
          <li><b>⏱️ Transaksi Terakhir</b> — daftar penjualan hari ini</li>
        </ul>
        <p class="kwarn-card">
          💡 <b>Tips:</b> Menu bawah: <b>🏠 Beranda · 🍽️ Menu · 🛒 Jualan · 📊 Laporan · ⚙️ Pengaturan</b>.
          Halaman Bantuan ini dibuka dari tombol <b>❓</b> di pojok kanan atas.
        </p>
      </div>
    `
  },
  {
    icon: '💰',
    title: 'Buka & Tutup Kas',
    content: `
      <div class="klh18 kfs14">
        <p><b>Fungsi Saklar "Buka / Tutup Kas":</b></p>
        <p class="kpl20 kmy8">
          Ada di <b>Pengaturan → kartu ⚙️ Aktifkan Fitur → baris "Buka / Tutup Kas"</b>.
          Kalau <b>aktif</b>, laci punya modal awal dan <b>kamu wajib mengisi modal sebelum bertransaksi</b>:
          modal <b>"🔓 Buka Kas"</b> muncul otomatis begitu tab <b>🛒 Jualan</b> dibuka selama belum ada shift berjalan.
          Kalau <b>mati</b>, aplikasi langsung bisa jualan tanpa buka kas.
        </p>
        <p class="kmt16"><b>Memulai Hari (Buka Kas):</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka tab <b>🛒 Jualan</b> → modal <b>"🔓 Buka Kas"</b> muncul otomatis (alternatif: kartu <b>"🔒 Kas Belum Dibuka"</b> di <b>🏠 Beranda</b>)</li>
          <li>Hitung uang tunai di laci, isi di kolom <b>"Modal Awal di Laci (Rp)"</b> (misal 100000)</li>
          <li>Tekan <b>"🔓 Buka Kas"</b> — kartu Beranda berubah jadi status shift: <b>Mulai</b>, <b>Modal Awal</b>, <b>Transaksi</b>, <b>Kas Sistem</b></li>
        </ol>
        <p class="kmt16"><b>Menutup Hari (Tutup Kas):</b></p>
        <ol class="kpl20 kmy8">
          <li>Tekan <b>"🔒 Tutup Kas"</b> di kartu Beranda (atau dari <b>Laporan</b> lewat <b>"🔒 Tutup Kas Sekarang"</b>)</li>
          <li>Periksa <b>Kas sistem (perkiraan di laci)</b> — hasil dari modal awal + penjualan tunai − pengeluaran tunai + pemasukan tunai</li>
          <li>Hitung uang asli, isi di <b>"Uang tunai fisik di laci (hitung manual)"</b> → baris <b>"Selisih (fisik − sistem)"</b> terisi otomatis</li>
          <li>Boleh isi <b>"Catatan (opsional)"</b> (misal: kurang Rp 5.000 buat kembalian), lalu tekan <b>"🔒 Tutup Kas"</b></li>
        </ol>
        <p class="kmt16"><b>Dompet Digital Tidak Lewat Laci:</b></p>
        <p class="kpl20 kmy8">
          Blok <b>"📱 Dompet digital — di luar laci"</b> di modal Tutup Kas merinci QRIS/Transfer yang masuk rekening.
          Uang itu <b>tidak</b> dibandingkan dengan hitungan fisik — yang dibandingkan cuma kas sistem.
        </p>
        <p class="kmt16"><b>Tombol "💸 Catat Kas":</b></p>
        <p class="kpl20 kmy8">
          Bukan modal terpisah — tombol ini membuka form <b>Pengeluaran</b> atau <b>Pemasukan</b> di Laporan,
          untuk uang laci yang keluar/masuk di luar penjualan (misal ambil uang buat pemilik, atau nambah modal).
        </p>
        <p class="kwarn-card">
          ⚠️ <b>Kalau kas belum dibuka</b> dan kamu menekan Bayar, muncul peringatan
          <b>"Kas belum dibuka — buka kas dulu untuk mulai transaksi 💰"</b> dan transaksi tidak tersimpan.
        </p>
        <p class="kinfo-card">
          🕐 Riwayat buka/tutup shift ada di <b>Laporan → blok "🕐 Riwayat Buka/Tutup Kas"</b>. Tekan salah satu barisnya
          untuk membuka modal <b>"🕐 Detail Riwayat Kas"</b>: jam mulai &amp; tutup, durasi, modal awal, penjualan tunai
          beserta jumlah transaksinya, pengeluaran/pemasukan, kas sistem, kas fisik, selisih, dan rincian dompet digital tiap shift.
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
          <li>Buka tab <b>🍽️ Menu</b> di menu bawah</li>
          <li>Tekan tombol <b>➕</b> (hijau) di pojok kanan bawah → muncul <b>"🍽️ Tambah Menu"</b></li>
          <li>Isi <b>Nama Menu</b> (misal: Bakso Urat)</li>
          <li>Isi <b>Harga Jual</b> (misal: 15000) — wajib, harus lebih besar dari nol</li>
          <li>Isi <b>Harga Modal</b> (misal: 8000) — untuk menghitung untung</li>
          <li>Pilih <b>Kategori</b>: 🍚 Makanan / 🥤 Minuman / 🍢 Snack / 📦 Lainnya / Titipan</li>
          <li>Lengkapi <b>📦 Pakai Stok</b>, <b>🛵 Harga Ojol</b>, <b>🍥 Topping</b> kalau perlu (tutorial tersendiri)</li>
          <li>Tekan <b>"💾 Simpan"</b></li>
        </ol>
        <p class="kmt16"><b>Kategori &amp; Suplayer Buatan Sendiri:</b></p>
        <p class="kpl20 kmy8">
          Di dalam form menu, buka accordion <b>Kategori</b> lalu tekan <b>"＋ Tambah Kategori"</b>;
          accordion <b>Suplayer</b> punya <b>"＋ Tambah Suplayer"</b>. Suplayer bawaan bernama <b>🏠 Umum</b>.
        </p>
        <p class="kmt16"><b>Info di Daftar Menu:</b></p>
        <ul class="kpl20 kmy8">
          <li>Setiap baris menampilkan <b>Modal Rp … · Untung Rp …</b>; menu titipan diberi badge <b>Titipan</b> dan nama suplayernya (🧾)</li>
          <li>Badge <b>📦 jumlah</b> = sisa stok; ikon <b>✅</b> = aktif, <b>⏸️</b> = sedang dijeda</li>
          <li>Cari lewat kolom <b>"Cari menu..."</b> atau saring lewat <b>"📂 Kategori"</b></li>
        </ul>
        <p class="kmt16"><b>Edit / Jeda / Hapus:</b></p>
        <ul class="kpl20 kmy8">
          <li><b>✏️</b> = edit menu (judulnya jadi "✏️ Edit Menu")</li>
          <li><b>⏸️</b> = jeda (menu <b>tidak muncul</b> di halaman Jualan tapi tetap tersimpan); tekan <b>▶️</b> untuk aktifkan lagi</li>
          <li><b>🗑️</b> = hapus menu — ada konfirmasi <b>"Yakin mau hapus menu ini?"</b> → <b>"Ya, Hapus"</b></li>
          <li><b>↩️</b> = retur barang titipan (muncul hanya pada menu titipan yang memakai stok)</li>
        </ul>
      </div>
    `
  },
  {
    icon: '📦',
    title: 'Stok, Topping & Harga Ojol',
    content: `
      <div class="klh18 kfs14">
        <p><b>📦 Pakai Stok:</b></p>
        <ol class="kpl20 kmy8">
          <li>Di form menu, nyalakan saklar <b>"📦 Pakai Stok"</b> → muncul kolom <b>"Jumlah stok awal"</b></li>
          <li>Setiap penjualan mengurangi stok; sisa stok tampil sebagai badge <b>angka di pojok kiri atas</b> kartu menu pada tab <b>🛒 Jualan</b> (tooltip <b>"Sisa stok"</b>). Badge <b>oranye</b> di pojok kanan atas adalah jumlah item di keranjang — beda hal</li>
          <li>Stok habis → menambah item ke keranjang ditolak dengan pesan <b>"… habis — stok harus diisi dulu di menu kelola 📦"</b></li>
          <li>Barang yang sudah terlanjur di keranjang dan stoknya habis → <b>"… habis — hapus dari keranjang dulu 🛒"</b></li>
        </ol>
        <p class="kmt16"><b>🍥 Topping:</b></p>
        <p class="kpl20 kmy8">
          Aktifkan blok <b>"🍥 Topping"</b> di form menu lalu tekan <b>"＋ Tambah Topping"</b> untuk membuat
          pilihan tambahan beserta harganya. Saat jualan, pilihan topping muncul di modal <b>"📋 Pilihan Menu"</b>
          dan harganya ikut menambah total item itu.
        </p>
        <p class="kmt16"><b>🛵 Harga Ojol:</b></p>
        <ol class="kpl20 kmy8">
          <li>Aktifkan blok <b>"🛵 Harga Ojol"</b> di form menu → tekan <b>"＋ Tambah baris"</b></li>
          <li>Isi nama aplikasi ojol dan harganya — tersedia <b>GoFood, GrabFood, ShopeeFood, Maxim, Lainnya</b></li>
          <li>Satu menu bisa punya harga berbeda per aplikasi ojol</li>
        </ol>
        <p class="kmt16"><b>Pakai Saat Jualan:</b></p>
        <p class="kpl20 kmy8">
          Tekan <b>Ojol</b> pada tiga tombol tipe pesanan di atas halaman Jualan
          (<b>Dine-in · Take-away · Ojol</b>). Tab pilihan aplikasi ojol muncul paling atas di modal
          <b>"📋 Pilihan Menu"</b> — pilih aplikasinya dulu, harga ojol per aplikasi tampil di tab itu.
          Header keranjang menampilkan <b>🛵 Ojol</b> beserta nama aplikasinya.
        </p>
        <p class="kinfo-card">
          📝 Kolom catatan di keranjang berubah sesuai tipe pesanan: <b>no. meja / nama pemesan</b> untuk Dine-in,
          <b>nama pemesan, jam ambil</b> untuk Take-away, <b>nama driver, no. orderan ojol, plat nomor</b> untuk Ojol.
        </p>
      </div>
    `
  },
  {
    icon: '🤝',
    title: 'Menu Titipan (Konsinyasi) & Retur',
    content: `
      <div class="klh18 kfs14">
        <p><b>Setting Barang Titipan:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buat / pilih <b>Suplayer</b> di form menu (accordion Suplayer → <b>"＋ Tambah Suplayer"</b>)</li>
          <li>Pilih kategori <b>Titipan</b> dan suplayernya, lalu nyalakan <b>"📦 Pakai Stok"</b> — titipan perlu stok supaya retur bisa dihitung</li>
          <li>Tekan <b>"💾 Simpan"</b>; menu itu kini ber-badge <b>Titipan</b> di daftar</li>
        </ol>
        <p class="kmt16"><b>Utang &amp; Setoran di Laporan:</b></p>
        <p class="kpl20 kmy8">
          Blok <b>"🤝 Konsinyasi"</b> di halaman Laporan mengelompokkan titipan <b>per suplayer</b>: barang terjual,
          sisa yang masih ada di kamu, dan utangnya. Tiap suplayer punya tombol <b>"💰 Setor"</b> (bayar ke pemilik barang)
          dan <b>"↩️ Retur"</b> (kembalikan barang).
        </p>
        <p class="kmt16"><b>Retur Barang:</b></p>
        <ol class="kpl20 kmy8">
          <li>Tekan <b>↩️</b> pada baris menu titipan (atau <b>"↩️ Retur"</b> di blok Konsinyasi) → modal <b>"↩️ Retur Barang"</b></li>
          <li>Isi jumlah yang dikembalikan dan <b>alasan selisihnya</b> — alasan wajib diisi</li>
          <li>Setelah dicatat: <b>"✅ Retur dicatat — sisa dikembalikan, selisih masuk hitungan setoran"</b></li>
        </ol>
        <p class="kmt16"><b>Jenis Catatan yang Terkait:</b></p>
        <ul class="kpl20 kmy8">
          <li><b>🤝 Setoran Konsinyasi</b> — di form Pengeluaran, untuk pembayaran ke suplayer</li>
          <li><b>↩️ Retur Konsinyasi</b> — muncul otomatis saat retur dicatat</li>
        </ul>
        <p class="kwarn-card">
          ⚠️ <b>Setoran konsinyasi bukan biaya usaha.</b> Uang itu milik pemilik barang, jadi jangan dicatat
          lewat kategori biasa — pakai kategori khusus supaya Laba tidak salah hitung.
        </p>
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
          <li>Buka tab <b>🛒 Jualan</b> — kalau fitur kas aktif dan belum ada shift berjalan, modal <b>"🔓 Buka Kas"</b> muncul lebih dulu; isi <b>modal awal</b> untuk bisa lanjut bertransaksi</li>
          <li>Pilih tipe pesanan di baris paling atas: <b>Dine-in</b> / <b>Take-away</b> / <b>Ojol</b> — <b>Dine-in</b> sudah jadi pilihan bawaan saat halaman dibuka (selama keranjang masih kosong)</li>
          <li>Pilih kategori lewat <b>"📂 Kategori"</b> atau cari di kolom <b>"Cari menu..."</b></li>
          <li>Ketuk menu → kalau menu itu punya <b>topping</b> atau <b>harga ojol</b>, muncul dulu modal <b>"📋 Pilihan Menu"</b> untuk mengatur jumlah, topping, dan catatannya; kalau tidak, langsung masuk keranjang. Ketuk lagi = tambah jumlah</li>
          <li>Bilah hijau <b>🛒</b> di bawah menampilkan <b>"N item"</b> dan totalnya → ketuk untuk membuka <b>"🛒 Keranjang"</b></li>
          <li>Periksa isinya, isi catatan kalau perlu, lalu tekan <b>"Bayar"</b></li>
        </ol>
        <p class="kmt16"><b>Di Dalam Keranjang:</b></p>
        <ul class="kpl20 kmy8">
          <li>Setiap baris menampilkan <b>nama menu + harga satuan</b> di kiri, tombol <b>− jumlah +</b> di tengah, dan <b>total</b> baris itu di kanan; <b>Total Harga</b> dihitung ulang otomatis</li>
          <li>Pilih metode bayar: <b>💵 Tunai</b> / <b>📱 QRIS</b> / <b>🏦 Transfer</b> (tutorial tersendiri)</li>
          <li>Untuk Tunai: kolom <b>"💵 Uang Diterima"</b> sudah otomatis terisi total (uang pas) — ketuk tombol nominal di bawahnya kalau menerima uang lebih, <b>"💰 Kembalian"</b> dihitung otomatis</li>
          <li>Tekan <b>"🤚 Tahan"</b> untuk menyimpan pesanan tanpa bayar, atau <b>"Bayar"</b> untuk menyimpan penjualan</li>
          <li>Tombol <b>✕</b> hanya menutup keranjang — transaksi belum tersimpan dan isinya tetap ada untuk dilanjutkan nanti</li>
        </ol>
        <p class="kinfo-card">
          🖨️ Setelah transaksi tersimpan muncul <b>"✅ Penjualan tersimpan!"</b> dan tombol <b>"🖨️ Cetak Nota"</b>.
          Bisa juga mencetak dari riwayat transaksi di Laporan.
        </p>
        <p class="kwarn-card">
          🔢 Setiap transaksi dapat nomor sendiri berformat <b>TRX-tangggal-urut</b> (misal TRX-20260904-007).
          Pemasukan bernomor <b>MSK</b>, pengeluaran bernomor <b>BLJ</b>. Nomornya ikut tampil di nota, riwayat, dan halaman detail.
        </p>
      </div>
    `
  },
  {
    icon: '🤚',
    title: 'Tahan Pesanan (Bayar Nanti)',
    content: `
      <div class="klh18 kfs14">
        <p><b>Cara Menahan Pesanan:</b></p>
        <ol class="kpl20 kmy8">
          <li>Isi keranjang seperti biasa, lalu tulis <b>catatan</b> di kolom catatan keranjang (misal: "Meja 3", "Budi", no. orderan ojol)</li>
          <li>Tekan <b>"🤚 Tahan"</b> di bagian bawah keranjang — pesanan tersimpan tanpa dihitung sebagai penjualan</li>
          <li>Catatan kosong → aplikasi menolak dan menampilkan <b>"📝 Isi catatan terlebih dahulu — biar pesanan ditahan gampang dibedakan"</b></li>
        </ol>
        <p class="kmt16"><b>Membuka Lagi Pesanan yang DITAHAN:</b></p>
        <ol class="kpl20 kmy8">
          <li>Tombol <b>🤚</b> melayang di pojok kanan bawah (dengan jumlah pesanan yang sedang ditahan) → ketuk</li>
          <li>Modal <b>"🤚 Pesanan Ditahan"</b> terbuka; cari lewat <b>"🔍 Cari catatan, nomor, atau menu..."</b> kalau daftarnya panjang</li>
          <li>Ketuk salah satu pesanan → isinya pindah ke keranjang (<b>"↩ Pesanan … dibuka kembali"</b>)</li>
          <li>Selesai → tekan <b>"Bayar"</b>. Pesanan memakai <b>nomor TRX aslinya</b> sejak pertama ditahan</li>
          <li>Tekan <b>"🤚 Tahan"</b> lagi untuk memperbarui pesanan yang sama — tidak membuat duplikat</li>
          <li>Tombol <b>🗑️</b> di tiap baris untuk menghapus pesanan ditahan (ada konfirmasi)</li>
          <li>Tekan <b>"Kembali"</b> untuk menutup daftar</li>
        </ol>
        <p class="kwarn-card">
          ⚠️ <b>Keranjang masih ada isinya</b> saat kamu membuka pesanan ditahan → muncul pilihan
          <b>"Buang &amp; Ganti"</b>. Sebaiknya tahan dulu pesanan yang sedang dikerjakan supaya tidak hilang.
        </p>
        <p class="kinfo-card">
          📊 Pesanan ditahan <b>belum terjual</b> — tidak dihitung sebagai omzet di Beranda maupun Laporan
          sampai dibayar.
        </p>
      </div>
    `
  },
  {
    icon: '💵',
    title: 'Metode Pembayaran & Foto Bukti',
    content: `
      <div class="klh18 kfs14">
        <p><b>Tiga Metode Pembayaran:</b></p>
        <ul class="kpl20 kmy8">
          <li><b>💵 Tunai</b> — isi <b>"💵 Uang Diterima"</b>, <b>"💰 Kembalian"</b> dihitung otomatis, ada tombol nominal cepat</li>
          <li><b>📱 QRIS</b> — pembeli scan; bayar <b>pas sesuai total</b></li>
          <li><b>🏦 Transfer</b> — pembeli transfer ke rekening; bayar <b>pas sesuai total</b></li>
        </ul>
        <p class="kmt16"><b>Membuka / Menutup Opsi Pembayaran:</b></p>
        <p class="kpl20 kmy8">
          Di <b>Pengaturan → kartu ⚙️ Aktifkan Fitur</b> ada saklar <b>Tunai</b>, <b>QRIS</b>, dan <b>Transfer</b>.
          Kalau hanya satu opsi yang aktif, baris pilihan metode disembunyikan di keranjang.
        </p>
        <p class="kmt16"><b>Bayar Non-Tunai Wajib Foto Bukti:</b></p>
        <ol class="kpl20 kmy8">
          <li>Pilih <b>📱 QRIS</b> atau <b>🏦 Transfer</b> di keranjang → blok Tunai diganti blok non-tunai</li>
          <li>Cek <b>"Nominal bayar"</b>, lalu tekan <b>"📸 Foto Bukti Pembayaran"</b> untuk memotret / memilih bukti transfer</li>
          <li>Boleh isi <b>"Catatan pembayaran (opsional)"</b> — misal sudah dikonfirmasi</li>
          <li>Tekan <b>"Bayar"</b>. Tanpa bukti foto muncul <b>"Foto bukti pembayaran dulu ya 📸"</b></li>
        </ol>
        <p class="kinfo-card">
          🧾 Uang QRIS/Transfer <b>tidak masuk laci</b> — tercatat sebagai dompet digital di rekening,
          sehingga tidak ikut dihitung saat Tutup Kas. Nominal dan <b>No. Referensi</b> tetap tersimpan
          dan bisa dilihat di detail transaksi.
        </p>
      </div>
    `
  },
  {
    icon: '🧾',
    title: 'Catat Pengeluaran & Pemasukan',
    content: `
      <div class="klh18 kfs14">
        <p><b>Langkah Mencatat Pengeluaran:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka tab <b>📊 Laporan</b> → tekan tombol <b>➕</b> di pojok kanan bawah</li>
          <li>Pastikan tab <b>"🧾 Pengeluaran"</b> aktif (ada juga tab <b>"💰 Pemasukan"</b>)</li>
          <li>Isi <b>"Buat Apa?"</b> (misal: Beli daging ayam)</li>
          <li>Pilih <b>"Jenis Pengeluaran"</b>: 🥬 Bahan Baku / Bumbu · ⛽ Gas &amp; BBM · 🏪 Sewa Tempat / Lapak · 🍳 Peralatan · 🤝 Setoran Konsinyasi · ↩️ Retur Konsinyasi · 🏧 Setor Bank / Ambil Uang · 📦 Lainnya</li>
          <li>Isi <b>"Tanggal Catatan"</b> — boleh tanggal mundur, tidak harus hari ini</li>
          <li>Isi <b>"Jumlah Uang (Rp)"</b> dan pilih <b>"Ambil dari?"</b>: 💵 Tunai dari laci · 📱 QRIS (dari rekening) · 🏦 Transfer bank</li>
          <li>Tekan <b>"💾 Simpan"</b></li>
        </ol>
        <p class="kmt16"><b>Catat Pemasukan Non-Penjualan:</b></p>
        <p class="kpl20 kmy8">
          Di tab <b>"💰 Pemasukan"</b>: isi <b>"Dari Apa?"</b>, pilih <b>"Jenis Pemasukan"</b>
          (💰 Pemasukan Lain · 🛍️ Penjualan Non-Menu · 🎁 Bonus / Cashback · 🏦 Modal Tambahan · 📦 Lainnya),
          tanggal, jumlah, lalu <b>"Masuk ke?"</b> (💵 Tunai ke laci · 📱 QRIS (ke rekening) · 🏦 Transfer bank).
        </p>
        <p class="kwarn-card">
          ⚠️ <b>Hanya "Tunai dari laci" yang mengurangi uang laci</b> saat tutup kas.
          Kategori <b>🏧 Setor Bank</b> tidak memotong Laba — itu uang pemilik, bukan kerugian usaha.
          Begitu pula <b>🏦 Modal Tambahan</b> di pemasukan.
        </p>
        <p class="kinfo-card">
          ✏️ Ketuk salah satu catatan di Laporan untuk membuka detailnya — bisa <b>"✏️ Ubah Catatan"</b> atau
          <b>🗑️ Hapus</b>. Nomor catatan (BLJ/MSK) dipertahankan selama tanggalnya tidak diganti.
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
          <li>Buka tab <b>📊 Laporan</b></li>
          <li>Pilih periode: <b>Harian / Mingguan / Bulanan</b>, atau <b>Custom</b> untuk rentang tanggal bebas (kalender muncul di bawah)</li>
          <li>Geser periode dengan tombol <b>‹</b> dan <b>›</b></li>
        </ol>
        <p class="kmt16"><b>Yang Bisa Dilihat:</b></p>
        <ul class="kpl20 kmy8">
          <li>Ringkasan: <b>💰 Omzet</b>, <b>🧮 Modal Bahan</b>, <b>💸 Biaya Usaha</b>, <b>📈 Untung Bersih</b>, <b>🛒 Transaksi</b>, <b>🍽️ Porsi Terjual</b>, <b>💵 Pemasukan Usaha</b>, <b>🛵 Ojol</b></li>
          <li><b>🏧 Non-Usaha (laci)</b> muncul kalau ada setor bank / modal tambahan</li>
          <li><b>📊 Margin Kotor</b> dan grafik per periode (<b>📊 Grafik Harian · Per Jam</b> untuk harian) — legenda <b>■ Omzet ■ Pengeluaran</b> tampil di bawah grafik</li>
          <li><b>🏆 Menu Paling Laris</b> beserta jumlah porsinya</li>
          <li><b>💸 Rincian Pengeluaran</b> dan <b>💰 Rincian Pemasukan</b> per kategori (ketuk untuk membuka daftarnya)</li>
          <li><b>🤝 Konsinyasi</b> per suplayer — kalau kamu punya barang titipan</li>
          <li><b>📝 Riwayat Transaksi</b> — ketuk untuk membuka <b>"📃 Detail Transaksi"</b>. Baris transaksi di kartu <b>🛵 Transaksi Ojol</b> juga bisa diketuk untuk hal yang sama</li>
          <li><b>🕐 Riwayat Buka/Tutup Kas</b> — ketuk barisnya untuk membuka <b>"🕐 Detail Riwayat Kas"</b>; lalu kartu <b>📕 Tutup Buku Tahunan</b> paling bawah</li>
        </ul>
        <p class="kinfo-card">
          🔎 <b>Di halaman detail transaksi</b> terlihat: daftar menu (<b>Menu / Jml / Harga</b>), <b>Total</b>,
          <b>Metode</b>, <b>No. Referensi</b>, <b>Catatan bayar</b>, <b>📸 Bukti pembayaran</b>, <b>Bayar</b>,
          <b>Kembalian</b>, <b>Modal Bahan</b>, dan <b>Untung Kotor</b>. Transaksi bisa dihapus dari sini
          (<b>"Ya, Hapus"</b>) — hati-hati, tidak bisa dibatalkan.
        </p>
      </div>
    `
  },
  {
    icon: '📕',
    title: 'Tutup Buku Tahunan',
    content: `
      <div class="klh18 kfs14">
        <p><b>Kegunaannya:</b></p>
        <p class="kpl20 kmy8">
          Mengunci rekap laba <b>satu tahun kalender</b> sebagai patokan akhir pembukuan.
          Data lama <b>tidak dihapus</b> — hanya menjadi catatan resmi penutup tahun.
        </p>
        <p class="kmt16"><b>Cara Menutup Buku:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka tab <b>📊 Laporan</b> → kartu <b>"📕 Tutup Buku Tahunan"</b> di bagian paling bawah</li>
          <li>Badge menunjukkan <b>"Tahun … ditutup"</b> atau <b>"Tahun … belum"</b></li>
          <li>Tekan <b>"📕 Tutup Buku Tahun …"</b> → muncul rekap: <b>Transaksi</b>, <b>Omzet</b>, <b>Modal Barang</b>, <b>Pengeluaran</b>, <b>Pemasukan</b>, <b>Laba Bersih</b></li>
          <li>Periksa <b>"Tahun yang ditutup"</b> (bisa diganti untuk menutup tahun yang sudah lewat), lalu tekan <b>"📕 Tutup Buku"</b> dan konfirmasi</li>
        </ol>
        <p class="kmt16"><b>Angka yang Perlu Dipahami:</b></p>
        <ul class="kpl20 kmy8">
          <li><b>Arus kas tunai kumulatif</b> sampai 31 Desember — uang laci, di luar modal awal</li>
          <li><b>Dompet digital kumulatif</b> — uang QRIS/Transfer yang ada di rekening</li>
          <li>Setor bank / ambil uang dan modal tambahan <b>di luar Laba</b>: menggeser laci tapi bukan hasil usaha</li>
        </ul>
        <p class="kwarn-card">
          📌 Rekap tahun <b>tersimpan permanen</b> dan tidak diubah ulang. Tahun yang sudah ditutup tidak bisa
          ditutup dua kali — tapi tetap bisa dibuka lagi lewat tombol yang sama untuk <b>melihatnya</b>.
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
          <li>Buka <b>Pengaturan → kartu 📱 Perangkat</b></li>
          <li>Tekan <b>"Hubungkan Printer"</b> lalu pilih printer thermal kamu — statusnya berubah jadi <b>"✅ … (tersimpan)"</b></li>
          <li>Tekan <b>"Cetak Tes"</b> untuk memastikan printer berfungsi (<b>"✅ Tes cetak berhasil!"</b>)</li>
          <li>Untuk melepas koneksi: <b>"Putuskan Printer"</b></li>
        </ol>
        <p class="kmt16"><b>Mencetak Nota:</b></p>
        <ul class="kpl20 kmy8">
          <li>Setelah menekan Bayar, tekan <b>"🖨️ Cetak Nota"</b> yang muncul di keranjang</li>
          <li>Atau lewat konfirmasi <b>"Transaksi tersimpan. Cetak nota sekarang?"</b> → <b>"🖨️ Cetak"</b></li>
          <li>Printer belum tersambung → nota otomatis dibuka lewat <b>print browser</b>, tetap bisa dicetak dari HP</li>
        </ol>
        <p class="kwarn-card">
          📄 <b>Butuh Chrome di Android.</b> Bluetooth printing tidak didukung semua browser — kalau muncul
          <b>"Browser ini tidak mendukung Bluetooth. Gunakan Chrome di Android."</b>, cetak saja lewat print browser.
        </p>
      </div>
    `
  },
  {
    icon: '💾',
    title: 'Simpan & Pulihkan Data (Cadangan)',
    content: `
      <div class="klh18 kfs14">
        <p><b>Cadangan ke File HP:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka <b>Pengaturan → kartu 💾 Data &amp; Cadangan</b></li>
          <li>Tekan <b>"Simpan Cadangan"</b> → file data terunduh ke HP (<b>"✅ Data tersimpan ke file!"</b>)</li>
        </ol>
        <p class="kmt16"><b>Memulihkan dari File (misal pindah HP):</b></p>
        <ol class="kpl20 kmy8">
          <li>Tekan <b>"Pulihkan Data"</b>, pilih file cadangan</li>
          <li>Konfirmasi <b>"Ya, Pulihkan"</b> — produk &amp; transaksi diganti dengan isi file; profil usaha mengikuti data server</li>
        </ol>
        <p class="kmt16"><b>Cadangan Cloud (khusus lisensi aktif):</b></p>
        <ol class="kpl20 kmy8">
          <li>Tekan <b>"Cadangan Cloud"</b> untuk menyimpan produk &amp; transaksi ke server (<b>"✅ Cadangan tersimpan ke cloud!"</b>)</li>
          <li>Tekan <b>"Pulihkan Cloud"</b> untuk mengambil cadangan terakhir dari server</li>
          <li>HP baru dengan lisensi yang sama → aplikasi menawarkan pemulihan sendiri saat pertama dibuka</li>
        </ol>
        <p class="kmt16"><b>Hapus Semua Data:</b></p>
        <p class="kpl20 kmy8">
          Baris <b>"Hapus Semua Data"</b> mengosongkan seluruh data usaha dan <b>tidak bisa dikembalikan</b>
          (status lisensi perangkat tetap tersimpan).
        </p>
        <p class="kmt16"><b>Kalau Data Curiga Belum Aman:</b></p>
        <p class="kpl20 kmy8">
          Tekan <b>"Cek Data Online"</b> di kartu <b>📱 Perangkat</b> → modal <b>"🔄 Cek Data Online"</b> memeriksa
          koneksi &amp; penyimpanan data. Ada tombol <b>"🔄 Periksa Ulang"</b> dan <b>"📋 Kirim ke Admin"</b>
          kalau butuh dibantu.
        </p>
        <p class="kerr-card">
          ⚠️ <b>Biasakan bikin cadangan</b> (minimal seminggu sekali). Jangan bagikan file cadangan ke orang lain —
          berisi data usaha kamu.
        </p>
      </div>
    `
  },
  {
    icon: '👤',
    title: 'Profil & Data Usaha',
    content: `
      <div class="klh18 kfs14">
        <p><b>Yang Bisa Diisi</b> (kartu <b>👤 Profil</b> di Pengaturan — semua bertanda wajib):</p>
        <ul class="kpl20 kmy8">
          <li>🏪 <b>Nama Usaha</b></li>
          <li>👤 <b>Nama Pemilik</b></li>
          <li>💬 <b>Nomor WhatsApp</b></li>
          <li>📍 <b>Alamat</b> — pilih <b>Provinsi → Kota / Kabupaten → Kecamatan → Desa / Kelurahan</b>, lalu isi <b>"Detail Alamat (jalan, no. rumah)"</b> dan tekan <b>"💾 Simpan"</b></li>
        </ul>
        <p class="kmt16"><b>Cara Mengubah:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka <b>Pengaturan → kartu 👤 Profil</b></li>
          <li>Ketuk baris yang mau diubah, isi, lalu simpan</li>
        </ol>
        <p class="kmt16"><b>Identitas Perangkat:</b></p>
        <p class="kpl20 kmy8">
          <b>ID Perangkat</b> (8 huruf/angka, format <b>XXXX-XXXX</b>) terlihat di banner status lisensi,
          di modal <b>"🔄 Cek Data Online"</b>, dan di layar kunci lisensi.
          Nomor ini yang dipakai admin mengenali HP kamu — selalu sertakan saat minta bantuan.
        </p>
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
          Aplikasi dibuka seperti app biasa (tanpa browser) dan tetap bisa dipakai
          <b>walaupun tidak ada internet</b>.
        </p>
        <p class="kmt16"><b>Cara Pasang:</b></p>
        <ol class="kpl20 kmy8">
          <li>Buka <b>Pengaturan → kartu 📱 Perangkat → baris "Pasang Aplikasi"</b></li>
          <li>Dialog instalasi dari browser muncul → setujui</li>
          <li>Selesai — ikon Kasir Solo ada di layar utama, dan baris itu berubah jadi <b>"✅ Sudah Terpasang"</b></li>
        </ol>
        <p class="kmt16"><b>Alternatif:</b></p>
        <ul class="kpl20 kmy8">
          <li>Banner <b>"Pasang di HP"</b> bisa muncul sendiri di layar → tekan <b>"Pasang"</b></li>
          <li><b>Android/Chrome:</b> menu titik tiga <b>⋮</b> → <b>"Install app"</b> atau <b>"Tambahkan ke layar utama"</b></li>
          <li><b>iPhone/Safari:</b> tombol <b>Share</b> → <b>"Add to Home Screen"</b> → <b>"Tambah"</b></li>
        </ul>
        <p class="kinfo-card">
          📶 <b>Tips Offline:</b> Semua data penjualan tersimpan otomatis di HP. Saat internet kembali,
          data profil tersinkron sendiri ke server.
        </p>
      </div>
    `
  },
  {
    icon: '🎟️',
    title: 'Lisensi & Kuota Transaksi Gratis',
    content: `
      <div class="klh18 kfs14">
        <p><b>Chip Status di Pojok Kanan Atas:</b></p>
        <ul class="kpl20 kmy8">
          <li><b>GRATIS · n trx</b> — masih pakai kuota gratis, sisa <b>n</b> transaksi bulan ini</li>
          <li><b>GRATIS · Habis</b> — kuota gratis bulan ini sudah terpakai semua</li>
          <li><b>LISENSI · ✓ Aktif</b> — lisensi berbayar aktif, transaksi tidak dibatasi kuota</li>
          <li><b>LISENSI · ✕ Dicabut</b> — lisensi dinonaktifkan admin</li>
        </ul>
        <p class="kmt16"><b>Kuota Transaksi Gratis:</b></p>
        <p class="kpl20 kmy8">
          Tekan chip itu untuk membuka <b>"🔐 Status Lisensi"</b>. Di sana ada kartu <b>"🎁 Kuota Transaksi Gratis"</b>
          yang menjelaskan berapa transaksi gratis tiap bulan dan berapa yang sudah terpakai. Kuota diperbarui
          otomatis di awal bulan — <b>tidak ada masa coba yang dihitung hari</b>.
        </p>
        <p class="kmt16"><b>Kalau Kuota Habis:</b></p>
        <p class="kpl20 kmy8">
          Aplikasi <b>tidak mengunci</b> — menu, laporan, dan seluruh halaman tetap bisa dibuka.
          Hanya transaksi baru yang berhenti, dengan banner
          <b>"🚫 Kuota transaksi bulan ini habis — eksplorasi tetap bebas, transaksi terkunci."</b>
          dan pesan <b>"Kuota transaksi bulan ini habis — aktifkan lisensi untuk lanjut jualan 💳"</b> saat menekan Bayar.
          Tekan <b>"💳 Lisensi"</b> di banner untuk lanjut.
        </p>
        <p class="kmt16"><b>Beli Lisensi (4 tahapan: 1 Gratis · 2 Beli · 3 Proses · 4 Aktif):</b></p>
        <ol class="kpl20 kmy8">
          <li>Tekan chip status → <b>"💳 Beli Lisensi"</b> → terbuka sheet <b>"💳 Beli Lisensi"</b></li>
          <li>Ikuti <b>"📋 Cara Pembayaran:"</b> (QRIS / rekening beserta nominalnya)</li>
          <li>Tekan <b>"📎 Lampirkan Bukti Pembayaran"</b> dan pilih foto struk transfer — atau <b>"Pembayaran belum siap"</b> kalau belum bayar</li>
          <li>Tekan <b>"🚀 Kirim Sekarang"</b> → statusnya <b>"⏳ Aktivasi sedang diproses"</b> dengan badge <b>"Menunggu admin"</b></li>
          <li>Admin verifikasi → lisensi aktif sendiri. Cek kapan saja dengan <b>"🔄 Cek Status Sekarang"</b> (tidak perlu kirim ulang bukti pembayaran)</li>
        </ol>
        <p class="kmt16"><b>Aktivasi Kode Lisensi Resmi:</b></p>
        <ol class="kpl20 kmy8">
          <li>Di panel <b>"🔐 Status Lisensi"</b>, ketuk <b>"Sudah punya kode? Aktivasi manual"</b></li>
          <li>Masukkan kode berformat <b>KK5-XXXX-XXXX-XX-XXXXXX</b> → tekan <b>"🔑 Aktifkan Kode"</b></li>
        </ol>
        <p class="kmt16"><b>Kalau Lisensi Aktif:</b></p>
        <p class="kpl20 kmy8">
          Kartunya berubah jadi <b>"✓ Lisensi Aktif"</b> — semua fitur terbuka tanpa batasan kuota,
          terikat ke perangkat ini. Ada <b>"🔄 Refresh Status"</b> untuk menyamakan status dengan server,
          dan keterangan <b>Masa berlaku</b> (atau <b>"Berlaku seumur hidup"</b>).
        </p>
        <p class="kwarn-card">
          🎟️ <b>Info:</b> Lisensi &amp; kode berlaku <b>per perangkat</b> (dikenali dari ID Perangkat).
          Simpan baik-baik bukti pembelianmu. Kalau muncul <b>"✖ Lisensi Dinonaktifkan"</b>, itu pencabutan oleh admin —
          aplikasi terkunci sampai lisensi dipulihkan; tekan <b>"💬 Hubungi Admin"</b>.
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
        <p class="kpl20 kmy8">Tidak. Semua data tersimpan otomatis di HP (semua bisa dikerjakan offline).</p>
        <p class="kmt14"><b>Kenapa saya tidak bisa menyimpan transaksi?</b></p>
        <p class="kpl20 kmy8">
          Cek tiga hal: <b>(1)</b> kas belum dibuka — buka dulu dari Beranda kalau fitur kas aktif;
          <b>(2)</b> kuota transaksi gratis bulan ini habis — beli/aktifkan lisensi;
          <b>(3)</b> stok menu habis — isi stoknya dulu di tab Menu.
        </p>
        <p class="kmt14"><b>Status kas tertutup tapi bisa langsung jualan?</b></p>
        <p class="kpl20 kmy8">
          Saklar <b>"Buka / Tutup Kas"</b> di <b>Pengaturan → ⚙️ Aktifkan Fitur</b> sedang mati, jadi gerbang kas tidak dipakai.
          Nyalakan saklarnya untuk memaksa buka kas sebelum transaksi.
        </p>
        <p class="kmt14"><b>Pindah HP, data ikut pindah?</b></p>
        <p class="kpl20 kmy8">
          Cara paling gampang: pakai lisensi aktif lalu <b>Pengaturan → 💾 Data &amp; Cadangan → "Pulihkan Cloud"</b>.
          Tanpa lisensi, unduh <b>"Simpan Cadangan"</b>, pindahkan file-nya ke HP baru, lalu <b>"Pulihkan Data"</b>.
        </p>
        <p class="kmt14"><b>Printer tidak mau mencetak?</b></p>
        <p class="kpl20 kmy8">
          Hubungkan dulu di <b>Pengaturan → 📱 Perangkat → "Hubungkan Printer"</b>, lalu uji dengan <b>"Cetak Tes"</b>.
          Tanpa printer Bluetooth, nota tetap bisa dicetak lewat print browser.
        </p>
        <p class="kmt14"><b>Bedanya QRIS dan Transfer dengan Tunai?</b></p>
        <p class="kpl20 kmy8">
          Non-tunai butuh <b>foto bukti pembayaran</b>, bayar pas sesuai total, dan uangnya <b>tidak masuk laci</b> —
          jadi tidak ikut dihitung waktu Tutup Kas.
        </p>
        <p class="kmt14"><b>Data penjualan dikirim ke mana?</b></p>
        <p class="kpl20 kmy8">
          Hanya profil usaha (nama, WhatsApp, alamat) yang disinkronkan untuk dukungan.
          Data transaksi tetap di HP, kecuali kamu sendiri menekan <b>"Cadangan Cloud"</b>.
        </p>
        <p class="kinfo-card">
          💬 <b>Butuh bantuan lain?</b> Hubungi kami di <b>0881-6566-935</b> (WhatsApp), atau tekan
          <b>"💬 WhatsApp"</b> (tombol hijau di panel lisensi) — pesannya otomatis membawa <b>Kode Perangkat</b> kamu.
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
