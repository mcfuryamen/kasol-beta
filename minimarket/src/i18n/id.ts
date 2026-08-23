export const id = {
  app: { name: "Kasir Solo - Minimarket", tagline: "Solusi POS untuk Minimarket Modern" },
  nav: {
    dashboard: "Dashboard", pos: "Kasir", products: "Produk", stock: "Stok",
    suppliers: "Supplier", customers: "Pelanggan", finance: "Keuangan",
    promos: "Promo", reports: "Laporan", staff: "Staf", settings: "Pengaturan", logout: "Keluar"
  },
  auth: {
    login: "Masuk", logout: "Keluar", email: "Email", password: "Kata Sandi",
    loginBtn: "Masuk", loginAsDemo: "Masuk sebagai Demo", demoMode: "Mode Demo",
    selectDemoUser: "Pilih pengguna demo", loginError: "Email atau password salah",
    forgotPassword: "Lupa Password?", welcomeBack: "Selamat Datang Kembali"
  },
  dashboard: {
    title: "Dashboard", todaySales: "Penjualan Hari Ini", totalOrders: "Total Transaksi",
    avgOrder: "Rata-rata Transaksi", activeMembers: "Member Aktif",
    recentTransactions: "Transaksi Terbaru", topProducts: "Produk Terlaris",
    lowStock: "Stok Menipis", revenue: "Pendapatan", profit: "Laba",
    weeklyChart: "Grafik Mingguan", stockAlert: "Peringatan Stok", newMembers: "Member Baru",
    kasStatus: "Status Kas", kasAktif: "Kas Aktif", kasTutup: "Kas Tutup"
  },
  pos: {
    title: "Kasir", searchProduct: "Cari produk (nama/barcode/SKU)...",
    barcodeInput: "Scan barcode...", cart: "Keranjang Belanja", total: "Total", subtotal: "Subtotal",
    discount: "Diskon", tax: "PPN 11%", grandTotal: "Grand Total", pay: "Bayar", clear: "Hapus Semua",
    hold: "Tahan", recall: "Panggil", qty: "Qty", price: "Harga",
    paymentMethod: "Metode Bayar", cash: "Tunai", qris: "QRIS", debit: "Debit",
    credit: "Kredit", ewallet: "E-Wallet", tempo: "Tempo",
    amountPaid: "Uang Diterima", change: "Kembalian", processPayment: "Proses Pembayaran",
    selectCustomer: "Pilih Pelanggan", memberPrice: "Harga Member",
    itemDiscount: "Diskon Item", orderDiscount: "Diskon Order",
    receipt: "Struk", printReceipt: "Cetak Struk", newTransaction: "Transaksi Baru",
    noItems: "Keranjang kosong", stock: "Stok", heldOrders: "Order Ditahan",
    category: "Kategori", allCategory: "Semua", scannerReady: "Scanner Siap",
    lastScanned: "Terakhir scan", scanCount: "Jumlah scan",
    numpadQty: "MODE QTY", numpadDisc: "MODE DISKON", numpadCash: "MODE BAYAR",
    numpadPrice: "MODE HARGA", payBtn: "BAYAR [F4]",
    holdBtn: "Tahan [F2]", clearBtn: "Hapus [F5]",
    kasRequired: "Buka Kas Terlebih Dahulu",
    kasRequiredMsg: "Anda harus membuka kas sebelum dapat menggunakan kasir."
  },
  kas: {
    openKas: "Buka Kas", closeKas: "Tutup Kas", kasAktif: "Kas Aktif",
    kasTutup: "Kas Tutup", modalAwal: "Modal Awal", modalAkhir: "Kas Aktual",
    ekspektasiKas: "Ekspektasi Kas", selisih: "Selisih", surplus: "Surplus",
    deficit: "Defisit", notes: "Catatan", openedAt: "Dibuka", closedAt: "Ditutup",
    denomination: "Hitung Denominasi", totalDenomination: "Total Denominasi"
  },
  cashflow: {
    title: "Uang Masuk/Keluar", cashIn: "Uang Masuk", cashOut: "Uang Keluar",
    addCashIn: "Tambah Uang Masuk", addCashOut: "Tambah Uang Keluar",
    setoranTambahan: "Setoran Tambahan", pengembalian: "Pengembalian",
    belanjaOperasional: "Belanja Operasional", setorBank: "Setor Bank",
    gaji: "Gaji", listrikAir: "Listrik/Air", kebersihan: "Kebersihan",
    lainnya: "Lainnya", runningBalance: "Saldo Berjalan", amount: "Jumlah",
    category: "Kategori", description: "Keterangan", history: "Riwayat"
  },
  product: {
    title: "Produk", add: "Tambah Produk", edit: "Edit Produk", delete: "Hapus Produk",
    name: "Nama Produk", sku: "SKU", barcode: "Barcode", category: "Kategori",
    buyPrice: "Harga Beli", sellPrice: "Harga Jual", wholesalePrice: "Harga Grosir",
    buyUnit: "Satuan Beli", sellUnit: "Satuan Jual", conversion: "Konversi",
    stock: "Stok", minStock: "Min Stok", maxStock: "Maks Stok",
    photo: "Foto", searchPlaceholder: "Cari produk...",
    gridView: "Grid", listView: "List", allCategories: "Semua Kategori",
    confirmDelete: "Hapus produk ini?", noProducts: "Tidak ada produk",
    active: "Aktif", inactive: "Nonaktif"
  },
  stock: {
    title: "Stok & Inventori", stockIn: "Stok Masuk", stockOut: "Stok Keluar",
    stockOpname: "Stok Opname", history: "Riwayat Mutasi", expiry: "Kedaluwarsa",
    batch: "Batch", lowStock: "Stok Menipis", overStock: "Overstock",
    quantity: "Jumlah", reason: "Alasan", date: "Tanggal", notes: "Catatan",
    physical: "Stok Fisik", system: "Stok Sistem", variance: "Selisih"
  },
  supplier: {
    title: "Supplier", add: "Tambah Supplier", edit: "Edit Supplier",
    name: "Nama Supplier", contact: "Kontak", phone: "Telepon", email: "Email",
    address: "Alamat", purchaseOrder: "Purchase Order", createPO: "Buat PO",
    poNumber: "No PO", status: "Status", items: "Item", totalAmount: "Total",
    draft: "Draft", approved: "Disetujui", ordered: "Dipesan", received: "Diterima",
    approve: "Setujui", order: "Pesan", receive: "Terima", confirmDelete: "Hapus supplier?"
  },
  customer: {
    title: "Pelanggan & Member", add: "Tambah Pelanggan", edit: "Edit",
    name: "Nama", phone: "Telepon", email: "Email", address: "Alamat",
    memberCard: "Kartu Member", tier: "Tier", points: "Poin", totalSpent: "Total Belanja",
    debt: "Piutang", bronze: "Bronze", silver: "Silver", gold: "Gold",
    memberSince: "Member sejak", lastVisit: "Kunjungan Terakhir", noCustomers: "Tidak ada pelanggan"
  },
  finance: {
    title: "Keuangan & Kas", openShift: "Buka Shift", closeShift: "Tutup Shift",
    cashDrawer: "Kas Laci", openingBalance: "Saldo Awal", closingBalance: "Saldo Akhir",
    pettyCash: "Kas Kecil", addExpense: "Tambah Pengeluaran", cashFlow: "Arus Kas",
    shift: "Shift", shiftStart: "Mulai Shift", shiftEnd: "Akhir Shift",
    operator: "Operator", expectedCash: "Ekspektasi", actualCash: "Aktual",
    difference: "Selisih", description: "Keterangan", amount: "Jumlah",
    noActiveShift: "Tidak ada shift aktif", tabKasAktif: "Kas Aktif",
    tabCashFlow: "Uang Masuk/Keluar", tabRiwayat: "Riwayat Shift", tabVoid: "Void & Retur"
  },
  promo: {
    title: "Diskon & Promo", add: "Tambah Promo", edit: "Edit Promo",
    name: "Nama Promo", type: "Tipe", discountPercent: "Diskon %",
    discountAmount: "Diskon Nominal", startDate: "Tgl Mulai", endDate: "Tgl Akhir",
    active: "Aktif", inactive: "Nonaktif", voucher: "Voucher", code: "Kode",
    minPurchase: "Min Pembelian", maxDiscount: "Maks Diskon", used: "Terpakai"
  },
  report: {
    title: "Laporan", sales: "Laporan Penjualan", profit: "Laba Rugi",
    stock: "Laporan Stok", customer: "Laporan Pelanggan", daily: "Harian",
    weekly: "Mingguan", monthly: "Bulanan", export: "Export", period: "Periode",
    revenue: "Pendapatan", cogs: "HPP", grossProfit: "Laba Kotor",
    netProfit: "Laba Bersih", topProducts: "Produk Terlaris",
    byPayment: "Per Metode Bayar", stockValue: "Nilai Stok"
  },
  staff: {
    title: "Manajemen Staf", add: "Tambah Staf", edit: "Edit Staf",
    name: "Nama", email: "Email", role: "Role", active: "Aktif",
    owner: "Pemilik", manager: "Manager", kasir: "Kasir", gudang: "Gudang"
  },
  settings: {
    title: "Pengaturan", storeName: "Nama Toko", address: "Alamat", phone: "Telepon",
    taxRate: "Tarif Pajak", receiptFooter: "Footer Struk", currency: "Mata Uang",
    language: "Bahasa", darkMode: "Mode Gelap", save: "Simpan",
    printer: "Printer", printerType: "Tipe Printer", paperSize: "Ukuran Kertas",
    connectionType: "Koneksi", autoPrint: "Auto Cetak", copies: "Jumlah Salinan",
    testPrint: "Test Print", printerEnabled: "Printer Aktif",
    headerText: "Header Struk", footerText: "Footer Struk", printBarcode: "Cetak Barcode"
  },
  shortcuts: {
    title: "Pintasan Keyboard", f1: "Fokus Barcode/Cari", f2: "Tahan Order",
    f3: "Tampilkan Order Ditahan", f4: "Bayar / Proses", f5: "Hapus Keranjang",
    f6: "Toggle Mode Numpad", f7: "Pilih Pelanggan", f8: "Buka Cash Drawer",
    f9: "Cetak Struk Terakhir", f10: "Hapus Item Terakhir", f12: "Fullscreen",
    esc: "Tutup Modal", enter: "Konfirmasi", plus: "Tambah Qty", minus: "Kurang Qty",
    delete: "Hapus Item", question: "Tampilkan/Sembunyikan Bantuan"
  },
  common: {
    save: "Simpan", cancel: "Batal", delete: "Hapus", edit: "Edit", add: "Tambah",
    search: "Cari", filter: "Filter", export: "Export", import: "Import",
    yes: "Ya", no: "Tidak", ok: "OK", close: "Tutup", back: "Kembali",
    loading: "Memuat...", error: "Error", success: "Berhasil", warning: "Peringatan",
    noData: "Tidak ada data", all: "Semua", active: "Aktif", inactive: "Nonaktif"
  }
};
