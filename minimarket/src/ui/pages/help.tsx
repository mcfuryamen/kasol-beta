import { useState, useEffect, useRef } from "preact/hooks";
import { Icons } from "@/ui/atoms/icon";

type Section = {
  id: string;
  title: string;
  icon: any;
  steps: { title: string; content: string }[];
};

const SECTIONS: Section[] = [
  {
    id: "memulai",
    title: "Memulai",
    icon: Icons.Zap,
    steps: [
      {
        title: "Login ke Aplikasi",
        content: "Buka halaman login. Masukkan email dan password yang sudah didaftarkan. Tekan \"Masuk\". Untuk coba aplikasi tanpa akun, pilih \"Masuk sebagai Demo\" lalu pilih nama pengguna."
      },
      {
        title: "Buka Kas (Kasir)",
        content: "Setelah login,kasir harus membuka kas terlebih dahulu. Klik tombol \"Buka Kas\" di dashboard, masukkan nominal modal awal, lalu konfirmasi. Kas harus dalam keadaan terbuka sebelum bisa bertransaksi."
      },
      {
        title: "Tutup Kas",
        content: "Setelah jam operasional selesai, kasir wajib menutup kas dari menu Keuangan > Kas Aktif. Isi kas aktual (jumlah uang fisik di laci), sistem akan menghitung selisih otomatis. Jika ada selisih, tulis catatan alasannya."
      }
    ]
  },
  {
    id: "kasir",
    title: "Cara Bertransaksi (POS)",
    icon: Icons.ShoppingCart,
    steps: [
      {
        title: "Scan atau Input Barcode",
        content: "Fokuskan kursor ke kolom barcode (tekan F1). Scan barcode produk dengan scanner, atau ketik manual lalu tekan Enter. Jika barcode ditemukan, produk langsung masuk keranjang. Jika tidak ditemukan, akan muncul peringatan."
      },
      {
        title: "Cari Produk via Nama/SKU",
        content: "Jika tidak punya barcode scanner, ketik nama atau SKU produk di kolom pencarian. Tekan Enter untuk memicu pencarian. Pilih produk dari hasil yang muncul, produk akan ditambahkan ke keranjang."
      },
      {
        title: "Atur Jumlah (Qty)",
        content: "Klik item di keranjang untuk memilihnya. Gunakan tombol +/− di samping jumlah untuk mengubah qty. Atau klik langsung pada kolom jumlah, ketik angka baru, lalu Enter. Qty minimum adalah 1."
      },
      {
        title: "Hapus Item dari Keranjang",
        content: "Pilih item di keranjang, lalu tekan tombol × (X) di pojok kanan atas item. Atau tekan F10 untuk void item terakhir yang ditambahkan tanpa harus memilih."
      },
      {
        title: "Pilih Metode Pembayaran",
        content: "Pilih metode bayar dari 6 opsi: Tunai, QRIS, Debit, Kredit, E-Wallet, atau Tempo. Untuk Tunai, masukkan jumlah uang yang diterima di numpad, sistem otomatis menghitung kembalian."
      },
      {
        title: "Proses Pembayaran",
        content: "Tekan F4 atau klik tombol \"Bayar\". Jika metode Tunai dan uang diterima kurang dari total, sistem menolak transaksi. Setelah berhasil, struk akan dicetak (jika auto-print aktif) dan keranjang kosong otomatis."
      },
      {
        title: "Tahan Order (Hold)",
        content: "Jika pembayaran pelanggan belum final, tekan F2 untuk menahan order. Order tetap tersimpan tapi keranjang kosong. Tekan F3 untuk menampilkan daftar order yang ditahan. Klik order untuk memanggil kembali ke keranjang."
      },
      {
        title: "Gunakan Voucher/Diskon",
        content: "Ketik kode voucher di kolom \"Kode Voucher\" lalu tekan \"Pakai\". Voucher akan diterapkan otomatis — diskon berupa persen atau nominal sesuai konfigurasi. Voucher tidak stack (hanya satu voucher per transaksi)."
      },
      {
        title: "Pilih Pelanggan Member",
        content: "Tekan F7 atau klik ikon users di keranjang. Pilih pelanggan dari daftar. Transaksi akan tercatat ke akun member, dan jika tier Gold/Silver, harga akan mengikuti harga khusus member."
      },
      {
        title: "Kosongkan Keranjang",
        content: "Tekan F5 untuk mengosongkan seluruh keranjang. Konfirmasi tidak diminta — keranjang langsung kosong."
      }
    ]
  },
  {
    id: "produk",
    title: "Manajemen Produk",
    icon: Icons.Package,
    steps: [
      {
        title: "Tambah Produk Baru",
        content: "Buka halaman Produk, klik \"Tambah Produk\". Isi: Nama produk, SKU (wajib, unik), barcode (opsional). Pilih kategori, isi harga beli, harga jual, dan satuan. Tentukan stok awal, stok minimum, dan stok maksimum. Klik Simpan."
      },
      {
        title: "Edit Produk",
        content: "Di halaman Produk, klik tombol edit (pensil) pada baris produk yang ingin diubah. Modal edit terbuka dengan data terkini. Ubah field yang diperlukan, lalu Simpan. Harga dan stok bisa diubah langsung dari sini."
      },
      {
        title: "Hapus Produk",
        content: "Klik tombol hapus (trash) pada baris produk. Muncul konfirmasi. Jika produk sudah pernah terjual, sebaiknya nonaktifkan saja (arsip) daripada menghapus, untuk menjaga history laporan."
      },
      {
        title: "Filter & Cari Produk",
        content: "Gunakan kolom pencarian untuk mencari berdasarkan nama, SKU, atau barcode. Gunakan dropdown kategori untuk menampilkan hanya produk kategori tertentu. Ubah tampilan antara grid (foto) atau list (tabel) dengan tombol grid/list."
      }
    ]
  },
  {
    id: "stok",
    title: "Manajemen Stok",
    icon: Icons.Box,
    steps: [
      {
        title: "Lihat Stok Semua Produk",
        content: "Buka halaman Stok > tab Overview. Semua produk ditampilkan dalam tabel dengan info stok terkini, status (Normal/Menipis/Habis), dan Nilai Stok (stok × harga beli). Warna badge menunjukkan status: hijau=normal, kuning=menipis, merah=habis."
      },
      {
        title: "Sesuaikan Stok (Opname)",
        content: "Klik \"Sesuaikan Stok\". Pilih produk dari dropdown, masukkan jumlah penyesuaian, pilih tipe mutasi (Penyesuaian, Stok Masuk, Stok Keluar, Rusak, Kadaluarsa, Retur), isi catatan opsional. Sistem akan mengupdate stok produk secara langsung."
      },
      {
        title: "Riwayat Mutasi Stok",
        content: "Buka tab Riwayat Mutasi untuk melihat semua perubahan stok — pembelian, penjualan, penyesuaian, kerusakan, dll. Setiap transaksi penjualan otomatis mengurangi stok. Riwayat tidak bisa dihapus."
      },
      {
        title: "Stok Opname",
        content: "Tab Stok Opname digunakan untuk melakukan penghitungan fisik. Pilih produk, masukkan stok fisik aktual (hasil hitung nyata di rak), sistem akan menghitung selisih (variance) antara stok sistem dan stok fisik."
      }
    ]
  },
  {
    id: "pelanggan",
    title: "Manajemen Pelanggan & Member",
    icon: Icons.Users,
    steps: [
      {
        title: "Tambah Pelanggan Baru",
        content: "Buka halaman Pelanggan, klik \"Tambah Pelanggan\". Isi nama, telepon (wajib), email, alamat. Pelanggan otomatis mendapat kartu member dengan ID unik dan tier Bronze."
      },
      {
        title: "Sistem Tier Member",
        content: "Ada 3 tier: Bronze (default), Silver, Gold. Tier menentukan harga khusus (harga member). Tier naik secara otomatis berdasarkan total belanja kumulatif. Lihat aturan tier di menu Pelanggan."
      },
      {
        title: "Lihat & Edit Pelanggan",
        content: "Klik nama pelanggan di daftar untuk membuka profil lengkap: data diri, nomor member, tier saat ini, total poin, total belanja, dan riwayat kunjungan. Poin dan transaksi diperbarui secara real-time setiap kali pelanggan bayar."
      },
      {
        title: "Pilih Pelanggan di Kasir",
        content: "Di halaman kasir, tekan F7 atau klik ikon pelanggan. Cari dan pilih pelanggan. Transaksi selanjutnya akan link ke akun pelanggan tersebut — poin bertambah sesuai total belanja."
      }
    ]
  },
  {
    id: "supplier",
    title: "Manajemen Supplier",
    icon: Icons.Truck,
    steps: [
      {
        title: "Tambah Supplier",
        content: "Buka halaman Supplier, klik \"Tambah Supplier\". Isi nama, telepon, email, alamat. Data supplier digunakan untuk membuat purchase order."
      },
      {
        title: "Buat Purchase Order (PO)",
        content: "Pergi ke tab \"Purchase Order\". Klik \"Buat PO\". Pilih supplier, tambahkan produk beserta jumlah dan harga beli — total dihitung otomatis. PO tersimpan berstatus \"Dipesan\"."
      },
      {
        title: "Proses PO",
        content: "PO yang belum diterima memiliki tombol \"Terima\". Ketika barang datang, klik \"Terima\" — stok produk otomatis bertambah sesuai item PO dan tercatat sebagai mutasi \"Pembelian\" di riwayat stok. PO yang sudah diterima tidak bisa diterima ulang."
      }
    ]
  },
  {
    id: "keuangan",
    title: "Keuangan & Kas",
    icon: Icons.DollarSign,
    steps: [
      {
        title: "Tab Kas Aktif",
        content: "Menampilkan rangkuman kas yang sedang terbuka: uang masuk hari ini, uang keluar hari ini, dan saldo kas (modal awal + uang masuk - uang keluar). Transaksi penjualan otomatis masuk ke uang masuk."
      },
      {
        title: "Tab Uang Masuk/Keluar",
        content: "Catat transaksi non-penjualan: setoran ulang, pengembalian dana, belanja operasional (listrik, air, supplies), setor bank, gaji. Setiap entri memiliki kategori, jumlah, dan keterangan."
      },
      {
        title: "Tab Riwayat Shift",
        content: "Melihat history shift kasir: siapa membuka, modal awal, uang masuk/keluar selama shift, uang aktual saat tutup, dan selisih. Shift yang belum ditutup ditandai sebagai \"Aktif\"."
      },
      {
        title: "Tab Void & Retur",
        content: "Daftar transaksi yang dibatalkan (void) atau dikembalikan (retur). Mencatat nomor order, jenis, jumlah, siapa yang memproses, waktu, dan alasannya. Untuk mem-void transaksi, buka tab \"Kas Aktif\" lalu klik tombol ✕ pada transaksi hari ini — hanya bisa dilakukan oleh owner atau manager. Stok barang otomatis dikembalikan."
      }
    ]
  },
  {
    id: "promo",
    title: "Promo & Voucher",
    icon: Icons.Tag,
    steps: [
      {
        title: "Buat Promo Baru",
        content: "Buka halaman Promo, klik \"Buat Promo\". Pilih tipe: Diskon Persen atau Diskon Nominal. Tentukan nilai diskon, minimale pembelian (opsional), dan maksimal diskon (untuk diskon persen). Set tanggal mulai dan akhir. Toggle Aktif/Nonaktif."
      },
      {
        title: "Buat Voucher",
        content: "Buka tab Voucher. Voucher adalah kode promo yang harus dimasukkan manual oleh kasir. Isi kode unik (huruf besar, tanpa spasi), pilih promo yang terhubung, tentukan batas penggunaan total dan per pengguna."
      },
      {
        title: "Gunakan Voucher di Kasir",
        content: "Di kasir, ketik kode voucher di kolom \"Kode Voucher\", tekan Pakai. Sistem akan memvalidasi: apakah voucher aktif, belum expired, dan belum melebihi batas penggunaan. Jika valid, diskon otomatis diterapkan ke transaksi."
      }
    ]
  },
  {
    id: "laporan",
    title: "Laporan",
    icon: Icons.BarChart,
    steps: [
      {
        title: "Pilih Periode Laporan",
        content: "Di halaman Laporan, pilih rentang waktu: 7, 14, atau 30 hari. Semua data laporan akan difilter sesuai periode yang dipilih."
      },
      {
        title: "Ringkasan",
        content: "4 kartu ringkasan menampilkan: Total Pendapatan (semua penjualan), Laba Kotor (pendapatan - HPP), Total Transaksi, dan Nilai Stok (total keseluruhan produk × harga beli)."
      },
      {
        title: "Grafik Penjualan Harian",
        content: "Grafik bar horizontal menunjukkan penjualan per hari. Bar paling panjang = hari dengan penjualan tertinggi. Warna mengikuti intensitas pendapatan."
      },
      {
        title: "Produk Terlaris",
        content: "Daftar 10 produk terlaris berdasarkan jumlah unit terjual dalam periode. Berguna untuk mengetahui produk favorit pelanggan dan mengatur strategi stocking."
      },
      {
        title: "Metode Pembayaran",
        content: "Pie chart / breakdown menampilkan distribusi transaksi per metode bayar (Tunai, QRIS, Debit, dll). Berguna untuk melihat preferensi pembayaran pelanggan."
      },
      {
        title: "Ringkasan Harian (Detail)",
        content: "Tabel detail harian: tanggal, jumlah transaksi, total pendapatan, total keuntungan. Bisa discroll untuk melihat setiap hari dalam periode."
      }
    ]
  },
  {
    id: "staf",
    title: "Manajemen Staf",
    icon: Icons.Shield,
    steps: [
      {
        title: "Tambah Staf",
        content: "Buka halaman Staf, klik \"Tambah Staf\". Isi nama, email, password, dan role. Role menentukan menu yang bisa diakses: Owner (semua menu), Manager (kecuali pengaturan tarif pajak), Kasir (POS + lihat produk), Gudang (stok)."
      },
      {
        title: "Edit & Nonaktifkan Staf",
        content: "Klik tombol edit pada baris staf untuk mengubah data. Klik toggle Aktif/Nonaktif untuk menonaktifkan akun tanpa menghapus — staf yang dinonaktifkan tidak bisa login tapi data history tetap terjaga."
      }
    ]
  },
  {
    id: "pengaturan",
    title: "Pengaturan",
    icon: Icons.Settings,
    steps: [
      {
        title: "Profil Toko",
        content: "Di tab \"Toko\": nama toko, alamat, telepon, email. Semua info ini dicetak di header struk."
      },
      {
        title: "Pajak",
        content: "Di tab \"Pajak\": tarif PPN (default 11%). Angka ini otomatis ditambahkan ke setiap transaksi sebagai PPN 11% dari subtotal."
      },
      {
        title: "Printer",
        content: "Di tab \"Printer\": aktif/nonaktif printer, jumlah salinan, auto-print (otomatis cetak struk setiap transaksi berhasil). Header dan footer struk bisa dikustomisasi."
      },
      {
        title: "Tampilan",
        content: "Di tab \"Tampilan\": toggle Mode Gelap untuk mengubah tema aplikasi. Pengaturan ini berlaku per-browser, tidak sync antar perangkat."
      }
    ]
  },
  {
    id: "pintasan",
    title: "Pintasan Keyboard",
    icon: Icons.Keyboard,
    steps: [
      {
        title: "Pintasan Utama POS",
        content: "F1 = Fokus input barcode | F2 = Tahan order | F3 = Tampilkan order ditahan | F4 = Bayar | F5 = Kosongkan keranjang | F6 = Ganti mode numpad (Qty > Disc > Cash > Price) | F7 = Pilih pelanggan | F8 = Buka cash drawer | F9 = Cetak struk terakhir | F10 = Void item terakhir | Esc = Tutup modal"
      },
      {
        title: "Navigasi Umum",
        content: "Tekan ? di halaman manapun untuk menampilkan panel pintasan keyboard. Pintasan ini hanya aktif di halaman POS."
      }
    ]
  }
];

export function HelpPage() {
  const [activeSection, setActiveSection] = useState<string>("memulai");
  const [mobileOpen, setMobileOpen] = useState<string>("memulai");
  const contentRef = useRef<HTMLDivElement>(null);

  // Mobile accordion: auto-close others when one opens
  const toggleMobile = (id: string) => {
    setMobileOpen(prev => (prev === id ? "" : id));
    // Konten yang baru terbuka dibaca dari awal — halaman kembali ke atas.
    requestAnimationFrame(() => {
      const main = document.querySelector("main");
      if (main) main.scrollTop = 0;
    });
  };

  // Auto-scroll to top of content area whenever active section changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeSection]);

  const selectSection = (id: string) => {
    setActiveSection(id);
    setMobileOpen(id); // sinkronkan accordion mobile
  };

  const current = SECTIONS.find(s => s.id === activeSection) ?? SECTIONS[0];

  return (
    <div class="space-y-3 max-w-6xl mx-auto">
      {/* Header */}
      <div class="flex items-center gap-2">
        <Icons.HelpCircle size={20} class="text-primary-500" />
        <h2 class="text-xl font-black text-gray-900 dark:text-gray-100">Bantuan</h2>
      </div>

      <p class="text-xs text-gray-500">Panduan penggunaan Kasir Solo berdasarkan alur kerja nyata.</p>

      {/* Desktop: 2-column grid. Mobile: hidden. */}
      <div class="hidden lg:grid lg:grid-cols-[220px_1fr] gap-4">
        {/* Sidebar menu */}
        <aside class="self-start sticky top-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
            <p class="font-semibold text-[10px] uppercase tracking-wide text-gray-500">Topik</p>
          </div>
          <nav class="p-1.5 space-y-0.5">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => selectSection(s.id)}
                  class={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                    active
                      ? "bg-primary-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon size={14} class="flex-shrink-0" />
                  <span class="flex-1 truncate">{s.title}</span>
                  <span class={`text-[10px] flex-shrink-0 ${active ? "text-white/80" : "text-gray-400"}`}>{s.steps.length}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content area */}
        <div ref={contentRef} class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin">
          {/* Section header */}
          <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 sticky top-0">
            <current.icon size={16} class="text-primary-500" />
            <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">{current.title}</h3>
              <span class="ml-auto text-[10px] text-gray-400">{current.steps.length} panduan</span>
          </div>

          {/* Steps */}
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {current.steps.map((step, idx) => (
              <div key={idx} class="p-4">
                <div class="flex items-start gap-3">
                  <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-xs text-gray-900 dark:text-gray-100 mb-1.5">{step.title}</h4>
                    <p class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{step.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: accordion auto-close */}
      <div class="lg:hidden space-y-2">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const isOpen = mobileOpen === s.id;
          return (
            <div key={s.id} class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleMobile(s.id)}
                class="w-full flex items-center gap-2 px-3 py-2.5 text-left active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors"
                aria-expanded={isOpen}
              >
                <Icon size={14} class={`flex-shrink-0 ${isOpen ? "text-primary-500" : "text-gray-400"}`} />
                <span class="flex-1 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{s.title}</span>
                <span class="text-[10px] text-gray-400 flex-shrink-0">{s.steps.length}</span>
                <Icons.ChevronDown
                  size={14}
                  class={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div class="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {s.steps.map((step, idx) => (
                    <div key={idx} class="p-3">
                      <div class="flex items-start gap-2.5">
                        <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {idx + 1}
                        </span>
                        <div class="flex-1 min-w-0">
                          <h4 class="font-semibold text-xs text-gray-900 dark:text-gray-100 mb-1">{step.title}</h4>
                          <p class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{step.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-start gap-2">
        <Icons.Info size={14} class="text-blue-500 mt-0.5 flex-shrink-0" />
        <p class="text-xs text-blue-700 dark:text-blue-400">
          Butuh bantuan lebih lanjut? Hubungi administrator toko atau buka menu{" "}
          <span class="font-semibold">Pengaturan → Tentang</span> untuk info kontak dukungan.
        </p>
      </div>
    </div>
  );
}
