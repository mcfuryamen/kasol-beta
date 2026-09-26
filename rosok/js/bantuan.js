/* =========================================================================
   KASIR SOLO - ROSOK
   bantuan.js — Modul Bantuan (port implementasi kaki5 js/bantuan.js, 2026-09-14)
   Halaman 3 tab sticky: 📖 Tutorial (kartu hero ikut panel ini) | 🎬 Video | 📜 S & K.
   Riwayat versi BUKAN tab — modal #modalChangelog (konsep kaki5), pemicunya baris
   "Versi …" di Pengaturan → Tentang Aplikasi.

   ATURAN PERAWATAN (sama seperti kaki5):
   - Teks tutorial HANYA boleh menyebut label yang benar-benar ada di UI
     (tombol/judul sheet/baris Pengaturan). Ubah label → sesuaikan TUTORIALS.
   - CHANGELOGS: setiap rilis baru (bump), tambahkan entri di PALING ATAS —
     versi teratas = terbaru. Bahasa user singkat, tanpa jargon teknis.
     Chip "TERPASANG" tampil pada entri yang == APP_VERSION (versi.js).
   - initBantuan() idempoten; dipanggil nav.showScreen('bantuan').
   ========================================================================= */
import { escapeHtml, openOverlay } from './utils.js';
import { APP_VERSION } from './version.js';

const TUTORIALS = [
  {
    icon: '🚀',
    title: 'Memulai Pakai Aplikasi',
    content: `
      <p><b>Langkah Pertama:</b></p>
      <ol>
        <li>Buka aplikasinya — langsung bisa dipakai, <b>tanpa masa coba hitungan hari</b></li>
        <li>Isi <b>Nama Usaha</b>, <b>Nama Pemilik</b>, <b>Alamat Lengkap</b>, dan <b>No. Telepon Usaha</b> di <b>⚙️ Pengaturan → blok 👤 Profil Usaha</b>, lalu <b>"Simpan Identitas"</b></li>
        <li>Selama profil belum lengkap, pengingat <b>"Lengkapi Profil Usahamu"</b> tampil di semua halaman — tekan <b>"Isi Profil Sekarang"</b></li>
      </ol>
      <p class="tut-mt"><b>Yang Dibatasi Hanya Kuota Transaksi Gratis Bulanan:</b></p>
      <p>Sisa kuota terlihat di badge <b>GRATIS</b> pojok kanan atas (tekan untuk membuka <b>"Status Lisensi"</b>). Detailnya di tutorial <b>🎟️ Lisensi &amp; Kuota Transaksi Gratis</b>.</p>
      <p class="tut-mt"><b>Isi Halaman Beranda:</b></p>
      <ul>
        <li><b>Ringkasan Hari Ini</b>: 💰 Kas · ⚖️ Stok · 🛒 Beli · 📦 Jual</li>
        <li><b>Transaksi Terakhir</b> — daftar kegiatan hari ini</li>
      </ul>
      <p class="tut-warn">💡 <b>Tips:</b> Menu bawah: <b>🏠 Beranda · ⚖️ Stok · ➕ Transaksi · 📊 Laporan · ⚙️ Pengaturan</b>. Halaman Bantuan ini dibuka dari tombol <b>📖</b> di pojok kanan atas.</p>
    `
  },
  {
    icon: '🛒',
    title: 'Catat Pembelian & Penjualan',
    content: `
      <p><b>Dua Arah di Satu Layar:</b></p>
      <ul>
        <li><b>"🛒 Beli dari Warga"</b> — rosok masuk dari pengepul/pemulung (menambah stok)</li>
        <li><b>"📦 Jual ke Bandar"</b> — rosok keluar ke bandar (mengurangi stok)</li>
      </ul>
      <p class="tut-mt"><b>Langkah Mencatat:</b></p>
      <ol>
        <li>Tekan <b>➕ Transaksi</b> di menu bawah, pilih tab Beli/Jual</li>
        <li><b>"Pilih Jenis Rosok"</b> — ketuk kartunya untuk menimbang</li>
        <li>Di sheet timbang: pilih <b>Kg / Ons / Kuintal</b>, isi berat lewat <b>keypad</b> atau tombol <b>−1 · −0,1 · +0,1 · +1</b>; harga per-kg dan subtotal dihitung otomatis → <b>"Masukkan ke Keranjang"</b></li>
        <li>Ulangi untuk jenis lain; <b>"← Tambah barang lain"</b> untuk kembali</li>
        <li>Isi <b>"Nama Penjual/Pembeli (opsional)"</b> dan <b>"Catatan (opsional)"</b> bila perlu</li>
        <li>Periksa <b>"Total Belanja"</b>, pilih metode bayar, tekan simpan — nota muncul, bisa langsung <b>"🖨️ Cetak"</b> atau <b>"💬 Kirim WA"</b></li>
      </ol>
      <p class="tut-note">🧺 Untuk <b>Tunai</b>: isi <b>"Uang Dibayarkan"</b> — boleh ketuk preset <b>+10K · +25K · +50K · +100K</b>; <b>"Kembalian"</b> dihitung otomatis.</p>
      <p class="tut-warn">⚠️ <b>Stok tidak bisa minus.</b> Menjual melebihi stok sisa ditolak dengan pesan <b>"Stok … cuma …"</b> — isi stoknya dulu lewat tab ⚖️ Stok.</p>
    `
  },
  {
    icon: '⚖️',
    title: 'Stok & Jenis Rosok',
    content: `
      <p><b>Daftar Jenis:</b> buka tab <b>⚖️ Stok</b> — "Stok &amp; Harga Jenis Rosok" berisi nama+emoji, sisa stok kg, harga beli &amp; jual per kg. Ada 10 jenis bawaan (kardus, besi, aluminium, tembaga, botol plastik, dan sebagainya).</p>
      <p class="tut-mt"><b>Menambah Jenis Baru:</b></p>
      <ol>
        <li>Tekan <b>"➕ Tambah Jenis Rosok Baru"</b> (baris di bawah)</li>
        <li>Isi <b>"Nama Jenis Rosok"</b> (misal: Botol Plastik (PET)), pilih <b>ikon emoji</b> dari pemilih, lalu <b>"Harga Beli / kg (Rp)"</b> dan <b>"Harga Jual / kg (Rp)"</b></li>
        <li>Tekan <b>"Simpan"</b></li>
      </ol>
      <p class="tut-mt"><b>Mengubah / Menonaktifkan:</b> ketuk item di daftar stok → form terbuka berisi datanya → ubah bila perlu atau tekan <b>"Nonaktifkan"</b> (jenis yang tidak pernah dipakai bisa disembunyikan tanpa menghapus jejak lama).</p>
      <p class="tut-note">⚖️ Berat yang dibeli otomatis menambah stok kg jenis itu; penjualan otomatis menguranginya — tidak perlu mengedit stok manual setiap transaksi.</p>
    `
  },
  {
    icon: '💰',
    title: 'Buka & Tutup Kas Harian',
    content: `
      <p><b>Saklar "Kas &amp; Shift Harian":</b></p>
      <p>Ada di <b>⚙️ Pengaturan → blok ⚙️ Fitur Aplikasi → baris "🧾 Kas &amp; Shift Harian"</b>. Kalau <b>aktif</b>, kamu wajib membuka kas dengan <b>modal awal</b> sebelum bertransaksi — menekan <b>➕ Transaksi</b> tanpa shift berjalan memunculkan <b>"Buka kas dulu sebelum mulai transaksi"</b> beserta sheet buka kas. Kalau <b>mati</b>, transaksi langsung bisa tanpa buka kas.</p>
      <p class="tut-mt"><b>Memulai Hari (Buka Kas):</b> tombol <b>"🔓 Buka Kas"</b> di bar bawah halaman <b>📊 Laporan</b> → isi <b>"Modal Awal (Rp)"</b> (uang tunai di laci sekarang) → <b>"🔓 Buka Kas &amp; Mulai"</b>. Modal awal tercatat otomatis sebagai catatan kas "Modal Awal - Buka Kas".</p>
      <p class="tut-mt"><b>Menutup Hari (Tutup Kas):</b></p>
      <ol>
        <li>Tekan <b>"🔒 Tutup Kas"</b> (tombol yang sama berganti status saat shift berjalan)</li>
        <li>Periksa <b>"Perkiraan Kas Sistem"</b> dan blok <b>"📊 Ringkasan Shift Hari Ini"</b> (jam buka, durasi, jumlah transaksi, kas masuk/keluar)</li>
        <li>Hitung uang asli, isi <b>"Uang Tunai Fisik Sekarang (hasil hitung manual)"</b> → <b>"Selisih"</b> terhitung otomatis</li>
        <li>Boleh isi <b>"Catatan (opsional)"</b>, lalu <b>"🔒 Tutup Kas Sekarang"</b></li>
      </ol>
      <p class="tut-mt"><b>Menengok Shift Lama:</b> di Laporan, blok <b>"Riwayat Buka/Tutup Kas"</b> — ketuk barisnya untuk membuka <b>"🕐 Detail Riwayat Kas"</b>: durasi, modal awal, kas masuk/keluar beserta jumlah transaksinya, kas sistem vs fisik, selisih, dan catatan tutup. Bila angka tersimpan berbeda dari hitungan ulang data hari ini, muncul peringatan <b>"Hitung ulang dari data"</b>.</p>
      <p class="tut-note">🚪 Gerbang kas hanya mengunci transaksi — semua halaman tetap bisa dibuka walau kas belum dibuka.</p>
    `
  },
  {
    icon: '🧾',
    title: 'Catat Kas Masuk & Keluar',
    content: `
      <p><b>Satu Form, Dua Tab.</b> Tekan <b>"➕ Catat Kas"</b> (bar bawah halaman <b>📊 Laporan</b>, kanan):</p>
      <ol>
        <li>Pilih tab <b>"🧾 Pengeluaran"</b> atau <b>"💰 Pemasukan"</b></li>
        <li>Isi <b>"Buat Apa?"</b> (misal: Beli bensin angkut)</li>
        <li>Pilih <b>"Jenis"</b> — pengeluaran: ⛽ BBM / Bensin · 💪 Ongkos Angkut · 🛍️ Karung &amp; Plastik · 👷 Gaji / Upah · 🍜 Makan &amp; Minum · 🔧 Peralatan · 🏪 Sewa Tempat · 💡 Listrik &amp; Air · 🏧 Setor Bank / Ambil Uang · 📦 Lainnya; pemasukan: 🤝 Pelunasan Piutang · 💰 Pemasukan Lain · 🏧 Modal Tambahan / Prive · ↩️ Retur / Refund · 🏷️ Penjualan Aset · 📦 Lainnya</li>
        <li>Isi <b>"Tanggal Catatan"</b> — boleh mundur beberapa hari untuk mencatat yang ketinggalan</li>
        <li>Isi <b>"Jumlah (Rp)"</b> dan <b>"Ambil dari?"</b>: 💵 Tunai dari laci · 🏦 Transfer bank</li>
        <li>Tekan <b>"💾 Simpan"</b></li>
      </ol>
      <p class="tut-warn">⚠️ Hanya <b>"💵 Tunai dari laci"</b> yang menggeser uang laci saat Tutup Kas. Transfer tetap masuk laporan tetapi tidak dihitung laci. Kategori <b>🏧 Setor Bank / Ambil Uang</b> dan <b>Modal Tambahan</b> bukan biaya/pendapatan usaha — tidak memotong laba.</p>
      <p class="tut-mt"><b>Mengubah / Menghapus Catatan:</b> ketuk catatannya di blok <b>"Buku Kas"</b> Laporan → form terbuka lagi dengan <b>"🗑️ Hapus Catatan"</b> tersedia. Catatan sistem (Modal Awal &amp; Pelunasan tempo) terkunci — tidak bisa diubah.</p>
    `
  },
  {
    icon: '📝',
    title: 'Tempo: Utang & Piutang + Pelunasan',
    content: `
      <p><b>Mencatat Tempo:</b> di pembayaran transaksi pilih <b>"📝 Tempo"</b>. Boleh dibayar sebagian di awal (isi "Uang Dibayarkan" di bawah total); sisanya otomatis tercatat sebagai <b>utang</b> (saat Beli dari warga) atau <b>piutang</b> (saat Jual ke bandar). Hint di layar: <i>"Sisa dicatat sebagai tempo, lunasi kapan saja di menu Laporan."</i></p>
      <p class="tut-mt"><b>Menutupnya (Pelunasan):</b></p>
      <ol>
        <li>Buka <b>📊 Laporan → blok "Utang &amp; Piutang Tempo"</b> — setiap baris berbunyi <b>"Utang ke …" / "Piutang dari …"</b> dengan sisa merah/hijau</li>
        <li>Tekan barisnya → form <b>Catat Kas</b> terbuka dengan tab dan isian tepat: kategori <b>"🤝 Pelunasan Utang Tempo"</b> / <b>"🤝 Pelunasan Piutang Tempo"</b>, keterangan otomatis, jumlah terisi sisa</li>
        <li>Bisa dibayar <b>sebagian</b> — ubah jumlahnya; simpan → sisa langsung terpotong (dicatat sekaligus dalam satu transaksi database, aman dari catat ganda)</li>
      </ol>
      <p class="tut-note">📊 Saldo total <b>📉 Utang</b> dan <b>📈 Piutang</b> terlihat sebagai kartu statistik di halaman Laporan. Bayar pelunasan lewat metode <b>Transfer</b> tidak menggeser hitungan laci.</p>
    `
  },
  {
    icon: '💵',
    title: 'Metode Pembayaran & Bukti Transfer',
    content: `
      <p><b>Tiga Metode:</b></p>
      <ul>
        <li><b>💵 Tunai</b> — isi uang diterima (ada preset nominal), kembalian otomatis</li>
        <li><b>🏦 Transfer</b> — nominal pas sesuai total; <b>foto bukti transfer wajib</b>: ketuk <b>"📷 Foto Bukti Transfer"</b>, ambil/pilih gambar, boleh isi <b>"Catatan transfer (opsional)"</b>. Tanpa bukti, penyimpanan ditolak dengan <b>"Foto tidak bisa dibaca"</b> / permintaan bukti</li>
        <li><b>📝 Tempo</b> — bayar sebagian/belum; sisa jadi utang/piutang (tutorial tersendiri)</li>
      </ul>
      <p class="tut-mt"><b>Menyalakan / Mematikan Opsi:</b> <b>⚙️ Pengaturan → blok ⚙️ Fitur Aplikasi</b> punya saklar <b>💵 Tunai</b>, <b>🏦 Transfer</b>, dan <b>📝 Tempo</b>. Metode yang dimati tidak muncul saat membayar.</p>
      <p class="tut-note">🧾 Foto bukti transfer tersimpan di transaksi dan bisa dilihat lagi di nota riwayat. Transfer masuk laporan tetapi <b>tidak dihitung sebagai uang laci</b> saat tutup kas.</p>
    `
  },
  {
    icon: '🖨️',
    title: 'Cetak Nota & Printer Thermal',
    content: `
      <p><b>Dua Jalur Cetak Otomatis:</b> setelah transaksi tersimpan, sheet <b>"Nota Transaksi"</b> punya <b>"🖨️ Cetak"</b> dan <b>"💬 Kirim WA"</b>. Printer Bluetooth terhubung → struk thermal ±38 kolom tercetak langsung ke printer (auto-cut); tidak terhubung → dibuka cetak lewat browser HP, tetap bisa dicetak.</p>
      <p class="tut-mt"><b>Menyiapkan Printer Bluetooth:</b></p>
      <ol>
        <li>Buka <b>⚙️ Pengaturan → blok 📱 Perangkat → "📡 Hubungkan Printer"</b> — pilih printer thermal kamu; status di baris itu berubah menjadi terhubung (koneksi <b>tersimpan</b>, tidak perlu pair ulang tiap buka aplikasi)</li>
        <li>Tekan <b>"📄 Cetak Tes"</b> untuk memastikan printer berfungsi</li>
        <li>Untuk melepas: <b>"❌ Putuskan Printer"</b></li>
      </ol>
      <p class="tut-warn">📄 <b>Bluetooth printing butuh Chrome di Android.</b> Browser lain tetap bisa mencetak nota lewat jalur print browser.</p>
      <p class="tut-mt"><b>Mencetak Ulang Nota Lama:</b> Laporan → <b>"🧾 Riwayat Transaksi"</b> → ketuk transaksi → sheet <b>"Nota Transaksi"</b> → <b>"🖨️ Cetak"</b>.</p>
    `
  },
  {
    icon: '📊',
    title: 'Laporan & Riwayat',
    content: `
      <p><b>Filter Periode</b> (menyelip di bawah header, ikut saat digulir): <b>Harian · Mingguan · Bulanan · Custom</b>. Untuk Custom, kalender tampil dua baris: ketuk <b>tanggal mulai</b> lalu <b>tanggal akhir</b> (otomatis ditukar bila terbalik); geser bulan dengan panah <b>‹ ›</b>.</p>
      <p class="tut-mt"><b>Isi Halaman Laporan:</b></p>
      <ul>
        <li>Kartu statistik: 🛒 Pembelian · 📦 Penjualan · ⬇️ Pengeluaran · 💰 Laba · 📉 Utang · 📈 Piutang · 💵 Total Kas · 🧾 Transaksi</li>
        <li><b>"📊 Margin Kotor"</b> dan grafik batang <b>Beli vs Jual</b> (legendanya di bawah batang; harian per jam, bulanan/panjang per minggu) — ↔️ geser untuk periode panjang</li>
        <li><b>"🏆 Rosok Terlaris (Berat)"</b> — ranking jenis berdasarkan kg</li>
        <li><b>"🧾 Riwayat Transaksi"</b> dikelompokkan <b>per hari</b> — ketuk judul harinya untuk buka/tutup; ketuk transaksi untuk membuka <b>notanya</b> (bisa <b>Void</b> = batalkan dengan jejak, atau <b>Hapus</b> permanen; dua-duanya membalik stok &amp; kas terkait otomatis)</li>
        <li><b>"Utang &amp; Piutang Tempo"</b>, <b>"Buku Kas"</b>, <b>"Riwayat Buka/Tutup Kas"</b>, dan <b>"Tutup Buku Tahunan"</b></li>
      </ul>
      <p class="tut-note">🔄 Semua angka mengikuti periode filter — kecuali saldo Utang/Piutang yang memang dihitung sejak awal (sisa tempo tidak memandang periode).</p>
    `
  },
  {
    icon: '📕',
    title: 'Tutup Buku Tahunan',
    content: `
      <p><b>Kegunaannya:</b> mengunci rekap laba <b>satu tahun kalender</b> sebagai patokan akhir pembukuan. Data lama <b>tidak dihapus</b> — hanya menjadi catatan resmi penutup tahun.</p>
      <p class="tut-mt"><b>Cara Menutup:</b></p>
      <ol>
        <li>Buka <b>📊 Laporan</b> → blok <b>"Tutup Buku Tahunan"</b> di bagian paling bawah; badge oranye menunjukkan status tahun berjalan</li>
        <li>Tekan <b>"🔒 Tutup Buku Tahun …"</b> → muncul sheet <b>"🔒 Tutup Buku Tahunan"</b> berisi rekap tahunan</li>
        <li>Tahun yang ditutup bisa diganti (menutup tahun yang sudah lewat), lalu konfirmasi</li>
      </ol>
      <p class="tut-warn">📌 Tahun yang sudah tertutup <b>terkunci</b>: menghapus/membatalkan transaksi atau mengutak-atik catatan kas di tahun itu akan diperingatkan dulu. Rekap tahun tersimpan permanen dan tetap bisa dibuka lagi untuk <b>dilihat</b>.</p>
    `
  },
  {
    icon: '👤',
    title: 'Profil Usaha & Cloud',
    content: `
      <p><b>Yang Diisi</b> (⚙️ Pengaturan → blok <b>👤 Profil Usaha</b>): <b>Nama Usaha</b>, <b>Nama Pemilik</b> (mis. "Pak Budi"), <b>No. Telepon Usaha</b>, dan <b>Alamat Lengkap</b> — ketuk kotak alamat untuk membuka <b>"📍 Pilih Alamat"</b>: pilih berantai <b>Provinsi → Kota / Kabupaten → Kecamatan → Desa / Kelurahan</b>, lalu isi <b>"Detail Alamat (jalan, nomor, RT/RW)"</b> → <b>"Simpan"</b>. Akhiri dengan <b>"Simpan Identitas"</b>.</p>
      <p class="tut-mt"><b>Sinkron Otomatis:</b> profil tersimpan di HP dan dikirim ke server kami (cloud = sumber kebenaran lintas perangkat/browser). Editan yang belum sempat terkirim saat offline tersimpan dulu dan menyusul sendiri ketika internet kembali.</p>
      <p class="tut-note">🆔 <b>ID Perangkat</b> (format XXXX-XXXX) terlihat di blok <b>"Tentang Aplikasi"</b> paling bawah Pengaturan. Nomor ini dipakai admin mengenali HP kamu — selalu sertakan saat minta bantuan.</p>
    `
  },
  {
    icon: '💾',
    title: 'Cadangan, Pulihkan & Diagnosa',
    content: `
      <p><b>Semua di ⚙️ Pengaturan → blok 💾 Data &amp; Cadangan:</b></p>
      <ol>
        <li><b>"💾 Simpan Cadangan"</b> — unduh file JSON ke HP (kategori, transaksi, kas, tutup buku; beri tanda tangan perangkat sehingga file ubahan ditolak)</li>
        <li><b>"📂 Pulihkan Data"</b> — pilih file cadangan; konfirmasi lalu data diganti isi file (restore atomik: gagal di tengah = data lama utuh)</li>
        <li><b>"☁️ Cadangan Cloud"</b> &amp; <b>"☁️ Pulihkan Cloud"</b> — <b>🔒 khusus lisensi aktif</b>; saat terkunci kamu langsung dibukakan halaman Beli Lisensi. Pulihkan menampilkan tanggal cadangan terakhir dulu sebelum konfirmasi</li>
        <li><b>"🗑️ Hapus Semua Data"</b> — mengosongkan seluruh data usaha, <b>tidak bisa dikembalikan</b> (lisensi tetap tersimpan)</li>
      </ol>
      <p class="tut-mt"><b>Pindah HP / Browser:</b> dengan lisensi aktif, aplikasi menawarkan pemulihan cloud sendiri saat pertama dibuka (<b>"Ada Cadangan di Cloud"</b>). Tanpa lisensi: Pulihkan Data dari file cadangan.</p>
      <p class="tut-mt"><b>Curiga Data Belum Aman?</b> ⚙️ Pengaturan → 📱 Perangkat → <b>"🩺 Diagnosa"</b> memeriksa 10 langkah rantai koneksi &amp; penyimpanan; hasilnya bisa disalin untuk dikirim ke admin.</p>
      <p class="tut-warn">⚠️ Biasakan bikin cadangan minimal seminggu sekali, dan jangan bagikan file cadangan ke orang lain — isinya data usaha kamu.</p>
    `
  },
  {
    icon: '🎟️',
    title: 'Lisensi & Kuota Transaksi Gratis',
    content: `
      <p><b>Badge Status Pojok Kanan Atas:</b></p>
      <ul>
        <li><b>GRATIS · N trx</b> — sisa kuota transaksi bulan ini (putus-nyala oranye bila tinggal sedikit)</li>
        <li><b>GRATIS · habis</b> — kuota terpakai semua</li>
        <li><b>LISENSI ✓ Aktif</b> — transaksi tanpa batasan kuota</li>
      </ul>
      <p class="tut-mt"><b>Kuota Habis?</b> Aplikasi <b>tidak mengunci</b> — semua halaman tetap bisa dibuka; hanya transaksi baru yang berhenti, dengan banner <b>"💳 Lisensi"</b> yang bisa ditutup. Kuota gratis segar lagi tiap awal bulan, tanpa dihitung hari.</p>
      <p class="tut-mt"><b>Beli Lisensi (satu jalur — terpusat di Control Center):</b> tekan badge → <b>"Status Lisensi"</b> menampilkan tahapan <b>1 Gratis → 2 Beli → 3 Proses → 4 Aktif</b>:</p>
      <ol>
        <li>Tekan <b>"💳 Beli Lisensi"</b> → terbuka <b>"💳 Beli Lisensi"</b> berisi QRIS / nomor rekening + nominal dari admin, plus <b>"📋 Cara Pembayaran"</b></li>
        <li>Bayar sesuai nominal, lalu <b>"📎 Lampirkan Bukti Pembayaran"</b> (pilih/foto struk) → tombol berubah jadi <b>"Kirim Sekarang"</b></li>
        <li>Status menjadi <b>⏳ menunggu verifikasi admin</b> — aplikasi mengecek sendiri secara berkala, lisensi aktif sendiri begitu admin menyetujui (bisa juga dipacu dengan <b>"🔄 Refresh Status"</b> di kartu lisensi)</li>
      </ol>
      <p class="tut-note">🔐 Tidak ada lagi kolom "kode lisensi manual" atau tombol WA lisensi — semua proses lewat jalur beli di atas dan diverifikasi admin. Bila perlu bantuan, hubungi kami lewat blok Tentang Aplikasi.</p>
    `
  },
  {
    icon: '📲',
    title: 'Pasang Aplikasi & Bekerja Offline',
    content: `
      <p><b>Kenapa Dipasang?</b> Aplikasi berjalan seperti app biasa (tanpa bar browser) dan <b>tetap bisa dipakai tanpa internet</b> — transaksi, stok, kas tersimpan di HP; profil &amp; lisensi tersinkron sendiri saat online kembali.</p>
      <p class="tut-mt"><b>Cara Pasang:</b> ⚙️ Pengaturan → blok 📱 Perangkat → <b>"📲 Pasang Aplikasi"</b> (baris muncul saat browser menawarkan instalasi) → setujui dialog browser.</p>
      <p class="tut-mt"><b>Alternatif:</b></p>
      <ul>
        <li><b>Android/Chrome:</b> menu titik tiga <b>⋮</b> → <b>"Install app"</b> / <b>"Tambahkan ke layar utama"</b></li>
        <li><b>iPhone/Safari:</b> tombol <b>Share</b> → <b>"Add to Home Screen"</b></li>
      </ul>
      <p class="tut-note">🔄 Aplikasi memeriksa rilis baru sendiri. Bila muncul <b>"Ada Versi Baru! 🔄"</b>, tekan <b>"OKE"</b> — aplikasi memuat ulang ke versi terbaru; riwayat perubahan tiap versi bisa dibaca lewat baris <b>"Versi …"</b> di <b>Pengaturan → Tentang Aplikasi</b>.</p>
    `
  },
  {
    icon: '📖',
    title: 'Tanya Jawab (FAQ)',
    content: `
      <p><b>Data hilang kalau HP mati / aplikasi ditutup?</b></p>
      <p>Tidak. Semua tersimpan di HP (IndexedDB) — aplikasi memang dirancang offline-first.</p>
      <p class="tut-mt"><b>Kenapa transaksi tidak bisa disimpan?</b></p>
      <p>Cek tiga hal: <b>(1)</b> kas belum dibuka padahal fitur shift aktif — buka dulu lewat Laporan; <b>(2)</b> kuota transaksi gratis bulan ini habis — beli lisensi; <b>(3)</b> stok jenis habis — isi lewat ⚖️ Stok atau kurangi jumlahnya.</p>
      <p class="tut-mt"><b>Bedanya void dan hapus transaksi?</b></p>
      <p><b>Void</b> membatalkan dengan meninggalkan jejak (barisnya tetap tampil bertanda batal); <b>Hapus</b> menghilangkan barisnya permanen. Dua-duanya membalik stok dan kaitan kasnya — dan tahun yang sudah tutup buku akan diperingatkan lebih dulu.</p>
      <p class="tut-mt"><b>Pindah HP, datanya gimana?</b></p>
      <p>Lisensi aktif → <b>"☁️ Pulihkan Cloud"</b> (atau terima penawaran otomatis saat pertama buka). Tanpa lisensi → file dari <b>"💾 Simpan Cadangan"</b> dipindahkan, lalu <b>"📂 Pulihkan Data"</b>.</p>
      <p class="tut-mt"><b>Kenapa hasil "Tutup Kas" beda dengan hitungan?</b></p>
      <p>Yang dibandingkan hanya uang <b>laci tunai</b>: modal awal + penjualan tunai − pengeluaran tunai + pemasukan tunai. Transfer/QRIS <b>tidak masuk laci</b>, jadi tak ikut dihitung — cek di rincian <b>"🕐 Detail Riwayat Kas"</b>.</p>
      <p class="tut-mt"><b>Data penjualan dikirim ke server?</b></p>
      <p>Tidak — yang disinkronkan hanya profil usaha dan status lisensi. Transaksi baru naik ke cloud kalau kamu sendiri menekan <b>"☁️ Cadangan Cloud"</b>.</p>
      <p class="tut-note">💬 <b>Butuh bantuan lain?</b> Hubungi <b>0881-6566-935</b> (WhatsApp, lihat blok Tentang Aplikasi) dan sertakan <b>ID Perangkat</b> kamu.</p>
    `
  }
];

// ==================== CHANGELOG (tab kanan) ====================
// PERAWATAN: setiap rilis baru (bump 4-slot), tambah entri di PALING ATAS.
// Bahasa user singkat — cermin poin-poin CHANGELOG.md untuk pemilik aplikasi.
const CHANGELOGS = [
  { versi: '1.4.24', items: [
    'Penguatan lisensi: aplikasi yang tak pernah online kini punya jatah pemakaian — bila jatah habis, hubungkan internet sekali saja untuk verifikasi, lalu lanjut berjualan seperti biasa.',
    'Perlindungan internal: penghitung jatah kini disegel supaya tidak bisa diubah sembarangan.'
  ]},
  { versi: '1.4.23', items: [
    'Perbaikan penting: memuat versi baru tidak akan lagi menampilkan layar "Ada Versi Baru" berulang kali — pembaruan langsung selesai dengan benar.'
  ]},
  { versi: '1.4.22', items: [
    'Uang laci dan Dompet digital dipisah: pembayaran transfer tidak lagi dihitung sebagai uang tunai di laci, jadi hitungan Tutup Kas lebih akurat.',
    'Detail Riwayat Kas kini bisa dibuka mutasinya, dan laporan shift bisa dicetak — setelah kas ditutup kamu langsung ditawari cetak laporan.',
    'ID Perangkat lebih stabil: identitas lisensi dicadangkan di penyimpanan kedua sehingga tidak berubah sendiri.',
    'Halaman Bantuan tampil dengan gradasi oranye, dan Syarat & Ketentuan disusun rapi per pasal.'
  ]},
  { versi: '1.4.21', items: [
    'Tombol "Pasang Aplikasi" kini selalu tampil dan menampilkan proses pemasangan (Memasang… → Menginstal… → Terpasang) dengan spinner, plus panduan manual untuk iOS/Android.',
    'Baris versi dipindah ke bawah nama aplikasi dan dirapatkan, dengan jarak lebih lapang ke nama PT.'
  ]},
  { versi: '1.4.20', items: [
    'Ikon disempurnakan: logo bulat di atas latar oranye penuh — rapi di home screen apa pun bentuk mask perangkatmu, dan bersih tanpa kartu putih saat aplikasi dibuka.'
  ]},
  { versi: '1.4.19', items: [
    'Layar pembuka baru di dalam aplikasi: logo bulat di atas latar gradasi oranye sebelum dashboard muncul.',
    'Ikon aplikasi kembali berbentuk bulat (bukan kotak) di layar pembuka.'
  ]},
  { versi: '1.4.18', items: [
    'Riwayat versi kini berupa modal di tengah layar dengan tombol "Tutup" oranye — daftarnya bisa digulir.',
    'Ikon aplikasi di-bake ulang: gradasi oranye + logo bulat — layar pembuka aplikasi kini tampil penuh dengan tampilan baru.',
    'Pemberitahuan update: catatan panjang bisa di-scroll dan tombolnya cukup bertuliskan "OKE".'
  ]},
  { versi: '1.4.17', items: [
    'Layar pembuka (splash) baru: logo bulat yang jernih di atas latar gradasi oranye.',
    'Pemberitahuan update hanya bisa ditutup dengan menekan OKE — hard refresh tidak menghapusnya; walau aplikasi sudah ter-update, OKE tetap harus ditekan sekali.',
    'OKE kini menunggu pembaruan benar-benar selesai — belum mendarat? pemberitahuan muncul lagi sampai tuntas.'
  ]},
  { versi: '1.4.16', items: [
    'Halaman 📖 Bantuan kini punya 3 tab: Tutorial | 🎬 Video | 📜 S & K — syarat & ketentuan pindah ke tabnya sendiri.',
    'Riwayat versi pindah tempat: ketuk baris "Versi …" di Pengaturan → Tentang Aplikasi.',
    'Kartu hero Bantuan tampil dengan gradasi oranye, dibedakan dari isi di bawahnya.',
    'Tab 🎬 Video siap menampilkan video tutorial yang admin publikasikan lewat Control Center — muncul otomatis.'
  ]},
  { versi: '1.4.15', items: [
    'Pembaruan keamanan: keranjang & nota kini menampilkan isi file cadangan yang dibuat jahat sebagai teks biasa — celah sisipan skrip ditutup.',
    'Alamat berkas bukti transfer di server ikut diacak sehingga tidak bisa ditebak dari luar.',
    'Perketat sisi server: tabel produk hanya-baca untuk aplikasi — data pembayaran lisensi tidak lagi terbuka lewat jalur publik.'
  ]},
  { versi: '1.4.14', items: [
    'Halaman baru 📖 Bantuan (tombol di pojok kanan atas): tab Tutorial berisi 15 panduan langkah-langkah yang persis seperti tombol & layar di aplikasi — timbang, buka/tutup kas, catat kas, tempo & pelunasan, printer, cadangan cloud, lisensi, sampai FAQ.',
    'Tab 🕓 Changelog menampilkan riwayat versi; versi yang sedang kamu pakai ditandai chip "TERPASANG".',
    'Membuka topik tutorial otomatis menggulir layar sampai judulnya pas di bawah bar tab — isi tidak pernah lagi terlewat di luar layar.',
    'Kartu 💬 Butuh Bantuan? merangkum pintasan WhatsApp admin, 🩺 Diagnosa, dan ID Perangkat untuk disebut saat minta tolong.'
  ]},
  { versi: '1.4.13', items: [
    'Pesan notifikasi (toast) seperti "Tersimpan", "Printer terputus", dan "Tempo lunas!" ternyata tidak pernah tampil sejak versi pertama — kini diperbaiki, semua pesan kembali terlihat.',
    'Kotak notifikasi tidak lagi bisa menghalangi sentuhan tombol di bawahnya.',
    'Perbaikan overlay "versi baru tersedia" yang sempat muncul palsu pada pengguna beta.',
    'Halaman Bantuan ini kini punya tab Tutorial + Changelog (diadopsi dari Kaki Lima).'
  ]},
  { versi: '1.4.12', items: [
    'Pembelian lisensi satu jalur lewat halaman Beli Lisensi (QRIS/transfer + kirim bukti, diverifikasi admin) — kolom kode manual dan tombol WhatsApp lisensi dihapus.',
    'Penguncian Cadangan Cloud & Pulihkan Cloud kini benar-benar berfungsi; saat terkunci kamu langsung dibukakan halaman Beli Lisensi.',
    'Bayar utang/piutang tempo memakai form Catat Kas lengkap (terisi otomatis, bisa sebagian) — sama seperti Kaki Lima.',
    'Riwayat Transaksi dikelompokkan per hari; baris buka/tutup kas bisa diketuk untuk detail shift.',
    'Perbaikan lain: tombol blok Data & Cadangan tidak lagi mati di detik-detik pertama, label menjadi "Diagnosa", bar kuota hijau solid.'
  ]},
  { versi: '1.4.11', items: [
    'Catat Kas Masuk/Keluar lengkap ala Kaki Lima: dua tab, tanggal boleh mundur, sumber Tunai/Transfer, catatan bisa diubah & dihapus.',
    'Cetak nota dua jalur otomatis: printer Bluetooth aktif → struk thermal; tidak aktif → cetak lewat browser.'
  ]},
  { versi: '1.4.10', items: [
    'Identitas perangkat makin stabil: kode lisensi yang terbit di HP-mu tidak lagi ditolak saat ganti browser atau bersih-bersih data; ID perangkat tidak bisa lahir ulang.'
  ]},
  { versi: '1.4.9', items: [
    'Kode perangkat yang berbeda antar browser di satu HP dituntaskan (dikunci sekali lahir).'
  ]},
  { versi: '1.4.8', items: [
    'Identitas perangkat V5: satu perangkat satu kode — kebal rotasi layar & beda browser, data lokal dilindungi dari penghapusan otomatis sistem.'
  ]},
  { versi: '1.4.7', items: [
    'Aplikasi selalu terang (tidak ikut mode gelap ponsel).',
    'Picker alamat desa/kelurahan pulih setelah perubahan server wilayah — dan tetap bisa offline.',
    'Grafik laporan diselaraskan ala Kaki Lima; dialog konfirmasi jadi popup in-app; banyak perbaikan pencatatan (POS, tempo, kas, riwayat).'
  ]},
  { versi: '1.4.6', items: [
    'Logo baru — ikon aplikasi, splash, header, dan nota ikut terbarukan.'
  ]},
  { versi: '1.4.5', items: [
    'Aplikasi kini memberi tahu ada versi baru lewat layar "OKE, Perbarui Sekarang" — tidak perlu lagi tutup-buka manual untuk dapat rilis terbaru.'
  ]}
];

let _initialized = false;

// Render daftar tutorial (akordeon — satu terbuka pada satu waktu) + changelog.
export function initBantuan(){
  if(_initialized) return;
  const box = document.getElementById('bantuanContent');
  if(!box) return;

  let html = '';
  TUTORIALS.forEach((tutorial, idx)=>{
    const tutId = `tutorial-${idx}`;
    html += `
      <div class="card tut-card">
        <div class="tut-head" role="button" tabindex="0" onclick="toggleTutorial('${tutId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleTutorial('${tutId}')}">
          <span class="tut-icon">${escapeHtml(tutorial.icon)}</span>
          <div class="tut-title">${escapeHtml(tutorial.title)}</div>
          <span id="${tutId}-arrow" class="tut-arrow" aria-hidden="true">›</span>
        </div>
        <div id="${tutId}" class="tut-panel" style="display:none">
          <div class="tut-body">${tutorial.content}</div>
        </div>
      </div>
    `;
  });
  box.innerHTML = html;

  // ID Perangkat: salin dari blok Tentang (diisi app.js saat boot — sumbernya
  // identitas AKTIF pasca-reanchor, bukan cache).
  const devEl = document.getElementById('bantuanDeviceId');
  const srcEl = document.getElementById('aboutDeviceCode');
  if(devEl && srcEl && srcEl.textContent && srcEl.textContent !== '—') devEl.textContent = srcEl.textContent;

  renderVideos();
  loadCloudVideos(); // fire-and-forget; render ulang saat data tiba
  _initialized = true;
}

function renderChangelog(){
  const box = document.getElementById('changelogBody');
  if(!box) return;
  box.innerHTML = CHANGELOGS.map((entry)=>`
    <div class="card tut-card">
      <div class="cl-head">
        <span class="cl-clock">🕓</span>
        <div class="cl-ver">Versi ${escapeHtml(entry.versi)}</div>
        ${entry.versi === APP_VERSION ? '<span class="cl-installed">TERPASANG</span>' : ''}
      </div>
      <ul class="cl-list">
        ${entry.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

// Sheet riwayat versi — pemicunya baris "Versi …" di Pengaturan → Tentang
// Aplikasi (restruktur tab 2026-09-14 pemilik: Changelog bukan tab lagi;
// 2026-09-15: sheet → modal tengah, adopsi konsep #changelogModal kaki5).
export function openChangelogSheet(){
  renderChangelog();
  openOverlay('modalChangelog');
}

// ==================== VIDEO (tab 🎬) ====================
// Arsitektur (2026-09-14, selaras kaki5): pemilik menempelkan URL/iframe embed
// YouTube lewat kartu Katalog aplikasi di Control Center → kolom cloud
// `products.tutorials` (jsonb array). Klien menariknya via getSupabaseClient
// (pola fetchProductSalt). Item: string URL polos ATAU {judul?, url, durasi?, deskripsi?}.
// VIDEOS lokal = fallback offline/dev semata (kosong → empty-state rapi).
const VIDEOS = [
  // { judul: 'Contoh: Cara Buka/Tutup Kas', url: 'https://youtube.com/watch?v=XXXXXXXXXXX', durasi: '3:12', deskripsi: 'Dari modal awal sampai tutup kas + selisih.' },
];
let _cloudVideos = null;    // null = belum dimuat; [] = dimuat tapi kosong
let _videosLoading = false;

// Sanitizer: terima URL YouTube (watch/youtu.be/shorts/live/embed) ATAU kode
// <iframe ...src="..."> utuh. HANYA host youtube resmi; ID harus [A-Za-z0-9_-]{6,20}.
// Mengembalikan id embed-safe atau null (item tak valid tak pernah di-render).
export function parseYoutubeId(raw){
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  const iframe = s.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const url = iframe ? iframe[1] : s;
  if (!/^https:\/\//i.test(url)) return null;
  let u;
  try { u = new URL(url); } catch(_) { return null; }
  const host = u.hostname.toLowerCase();
  const OK = ['youtube.com','www.youtube.com','m.youtube.com','youtu.be','youtube-nocookie.com','www.youtube-nocookie.com'];
  if (!OK.includes(host)) return null;
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] || '';
  else if (u.searchParams.get('v')) id = u.searchParams.get('v');
  else { const m = url.match(/\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{6,20})/); if (m) id = m[2]; }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

async function loadCloudVideos(){
  if (_videosLoading) return;
  _videosLoading = true;
  try {
    const { getSupabaseClient } = await import('./license.sync.js');
    const sb = getSupabaseClient();
    if (!sb) return; // offline/belum siap → tetap pakai fallback lokal
    const { data, error } = await sb
      .from('products')
      .select('tutorials')
      .eq('app_type', 'rosok')
      .maybeSingle();
    if (!error && Array.isArray(data && data.tutorials)) {
      _cloudVideos = data.tutorials;
      renderVideos();
    }
  } catch(_) { /* opsional — silent */ }
  finally { _videosLoading = false; }
}

function videoCardHtml(v){
  const item = typeof v === 'string' ? { url: v } : (v || {});
  const id = parseYoutubeId(item.url);
  if (!id) return '';
  const judul = escapeHtml(item.judul || 'Video Tutorial');
  return `
    <div class="card tut-card">
      <div class="cl-head">
        <span class="cl-clock">🎬</span>
        <div class="cl-ver">${judul}</div>
        ${item.durasi ? `<span class="cl-installed">${escapeHtml(String(item.durasi))}</span>` : ''}
      </div>
      ${item.deskripsi ? `<div class="hint" style="margin-bottom:10px">${escapeHtml(String(item.deskripsi))}</div>` : ''}
      <div style="position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#111">
        <iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${judul}" loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin" allowfullscreen
          style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>
      </div>
    </div>`;
}

function renderVideos(){
  const box = document.getElementById('bantuanVideoList');
  if(!box) return;
  const list = (_cloudVideos && _cloudVideos.length ? _cloudVideos : VIDEOS)
    .map(videoCardHtml).filter(Boolean).join('');
  box.innerHTML = list || '<div class="card"><div class="hint">🎬 Video tutorial akan segera hadir — daftarnya dikelola admin lewat kartu aplikasi di Control Center. Sementara ini, panduan lengkap tersedia di tab <b>📖 Tutorial</b>.</div></div>';
}

// Switch tab Tutorial / Video / S&K (tab sticky di bawah header).
export function switchBantuanTab(tab){
  const tabs = ['tutorial', 'video', 'tc'];
  const active = tabs.includes(tab) ? tab : 'tutorial';
  const showEl = (id, show)=>{ const el = document.getElementById(id); if(el) el.style.display = show ? 'block' : 'none'; };
  showEl('bantuanPanelTutorial', active === 'tutorial');
  showEl('bantuanPanelVideo', active === 'video');
  showEl('bantuanPanelTc', active === 'tc');
  const btn = { tutorial: 'bantuanTabTutorial', video: 'bantuanTabVideo', tc: 'bantuanTabTc' };
  tabs.forEach(t=>{
    const el = document.getElementById(btn[t]);
    if(el){ el.classList.toggle('active', t === active); el.setAttribute('aria-selected', t === active ? 'true' : 'false'); }
  });
  if(active === 'video' && !_cloudVideos && !_videosLoading) loadCloudVideos();
  window.scrollTo(0, 0);
}

// Toggle akordeon tutorial — auto-close: hanya satu panel terbuka (pola kaki5).
export function toggleTutorial(tutId){
  const panel = document.getElementById(tutId);
  const arrow = document.getElementById(`${tutId}-arrow`);
  if(!panel || !arrow) return;

  const isOpen = panel.style.display !== 'none';

  // Tutup semua panel lain
  for(let idx = 0; idx < TUTORIALS.length; idx++){
    const id = `tutorial-${idx}`;
    if(id === tutId) continue;
    const p = document.getElementById(id);
    const a = document.getElementById(`${id}-arrow`);
    if(p) p.style.display = 'none';
    if(a) a.style.transform = 'rotate(0deg)';
  }

  panel.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';

  // Buka → auto-scroll: header akordeon aktif disejajarkan tepat di bawah tab
  // bar sticky (sebelumnya, ketuk header yang kebetulan di dekat dasar layar
  // membuat isi panel terbuka di luar pandang). Sudah di posisi = diam saja.
  // Tutup → tidak menggulir (user memang sedang melihatnya).
  if(!isOpen){
    requestAnimationFrame(()=>{
      const head = panel.parentElement && panel.parentElement.querySelector('.tut-head');
      if(!head) return;
      const tabs = document.querySelector('.bantuan-tabs');
      const stickyBottom = tabs ? tabs.getBoundingClientRect().bottom : 0;
      const delta = head.getBoundingClientRect().top - stickyBottom - 6;
      if(Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: 'smooth' });
    });
  }
}

// ── Jembatan window (pola handler global rosok — HTML memakai onclick) ────
window.initBantuan = initBantuan;
window.switchBantuanTab = switchBantuanTab;
window.toggleTutorial = toggleTutorial;
window.openChangelogSheet = openChangelogSheet;
