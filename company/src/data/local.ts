// Konten portofolio Kasir Solo — konteks diadopsi dari kasol-v1 (PT Mesin Kasir Solo)

export const site = {
  brand: 'KASIRSOLO',
  legalName: 'PT Mesin Kasir Solo',
  tagline: 'Pusat Mesin Kasir Terbesar di Solo',
  heroSubtitle:
    'Aset Digital & sistem POS yang bikin ruko lo kerja otomatis — tanpa perlu lo tongkrongin tiap hari.',
  established: 'ESTABLISHED 2015 // SURAKARTA',
  whatsapp: '628816566935',
  phoneDisplay: '+62 881-6566-935',
  address: {
    legal: {
      label: 'KANTOR LEGAL',
      street: 'Perum Graha Tiara 2 B1, Kartasura',
      city: 'Sukoharjo, Jawa Tengah 57557',
    },
    operational: {
      label: 'KANTOR OPERASIONAL',
      street: 'Gumiring 04/04, Sidomulyo, Banjarejo',
      city: 'Kab. Blora, Jawa Tengah 58253',
    },
  },
  stats: [
    { value: '500+', label: 'Mitra Mesin Kasir' },
    { value: 'Se-Indonesia', label: 'Kirim' },
    { value: '99%', label: 'Uptime Server' },
    { value: '24/7', label: 'Support Teknis' },
  ],
};

export const apps = [
  {
    id: 'rosok',
    name: 'Rosok',
    type: 'Aplikasi Kasir',
    desc: 'POS flagship untuk warung & toko — offline-first, jalan penuh di HP. Transaksi, stok, laporan, dan buka-tutup kas dalam satu app.',
    tags: ['Offline-first', 'PWA', 'Laporan Otomatis'],
  },
  {
    id: 'kaki5',
    name: 'Kaki Lima',
    type: 'Aplikasi Kasir',
    desc: 'Kasir untuk pedagang keliling & gerobak. Ringan di HP spek rendah, tahan pesanan, grafik penjualan, dan lisensi seumur hidup.',
    tags: ['Mobile', 'Tahan Pesanan', 'Kuota Transaksi'],
  },
  {
    id: 'shop',
    name: 'Shop',
    type: 'Web Katalog',
    desc: 'Katalog & funnel pemasaran seluruh aplikasi — produk, harga, dan kontak terpusat, tersambung Supabase.',
    tags: ['Katalog', 'Funnel', 'Supabase'],
  },
];

// Shape adopsi dari kasol-v2 (packages/types/product.ts ProductCatalogue) —
// dikelola via Control Center > Konten Web > tab "hardware" (JSON).
export interface HardwareItem {
  id: number;
  name: string;
  price: number;
  image: string;
  gallery: string[];
  desc: string;
  review: string;
  specs: string[];
  inBox: string[];
  weight: string;
  dimensions: string;
  tag?: string;
  category: 'ANDROID' | 'PC' | 'PERIPHERALS';
}

export const hwCategoryLabel: Record<HardwareItem['category'], string> = {
  ANDROID: 'POS Android',
  PC: 'Desktop PC',
  PERIPHERALS: 'Aksesoris',
};

export const hardware: HardwareItem[] = [
  {
    id: 1,
    name: 'MKS Fighter V1',
    price: 3500000,
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=400',
    gallery: [
      'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1585792180666-f7347c490ee2?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800',
    ],
    desc: 'Paket Kasir Android lengkap + Printer Thermal 58mm. Siap tempur untuk warung & cafe.',
    review:
      'Ini bukan tablet mainan. Gue rakit MKS Fighter V1 khusus buat lo yang butuh kecepatan. Layar responsif, gak pake lag pas jam sibuk. Printer thermal-nya ngebut, struk keluar sebelum pelanggan sempet kedip. Cocok banget buat Warung Makan, Cafe, atau Booth Minuman yang transaksinya ratusan per hari.',
    specs: ['Layar 10.1 Inch IPS', 'Printer Thermal 58mm Built-in', 'Android 11 OS', 'RAM 4GB / ROM 32GB', 'Battery 5000mAh'],
    inBox: ['Unit Utama MKS Fighter', 'Adaptor Power', 'Roll Kertas Thermal (Starter)', 'Manual Book', 'Kartu Garansi'],
    weight: '2.5 Kg',
    dimensions: '30 x 25 x 15 cm',
    tag: 'BEST SELLER',
    category: 'ANDROID',
  },
  {
    id: 2,
    name: 'Thermal Savage 80mm',
    price: 1250000,
    image: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&q=80&w=400',
    gallery: [
      'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1529236183275-4fdcf2bc987e?auto=format&fit=crop&q=80&w=800',
    ],
    desc: 'Printer dapur heavy duty. Auto cutter. Koneksi LAN + USB. Anti macet saat rush hour.',
    review:
      'Printer ini badak. Lo geber cetak 1000 struk sehari juga dia ketawa doang. Fitur Auto-Cutter nya tajem, gak bikin kertas nyangkut (paper jam) yang bikin emosi koki. Wajib punya buat dapur restoran yang hectic.',
    specs: ['Paper Width 80mm', 'Speed 260mm/sec', 'Interface: USB + LAN + Serial', 'Auto Cutter: 1.5 Million Cuts', 'Wall Mountable'],
    inBox: ['Printer Unit', 'Kabel USB & Power', 'CD Driver', 'Sample Paper 80mm'],
    weight: '1.8 Kg',
    dimensions: '19 x 14 x 14 cm',
    tag: 'HEAVY DUTY',
    category: 'PERIPHERALS',
  },
  {
    id: 3,
    name: 'Scanner Laser Gun',
    price: 450000,
    image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&q=80&w=400',
    gallery: [
      'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800',
    ],
    desc: 'Barcode scanner 1D/2D. Baca barcode lecek? Bisa. Respon milidetik.',
    review:
      "Scanner ini matanya tajem. Barcode lecek, basah, atau kepotong dikit masih bisa kebaca. Gak perlu ngeker-ngeker lama yang bikin antrian kasir panjang. Trigger-nya empuk, enak buat scan barang grosiran yang banyak.",
    specs: ['Sensor: CMOS', 'Scan Speed: 300 scans/sec', 'Drop Test: 1.5 Meter', 'Cable Length: 2M', 'Mode: Manual & Continuous'],
    inBox: ['Scanner Gun', 'Stand/Holder', 'Kabel USB', 'Manual Config'],
    weight: '0.5 Kg',
    dimensions: '17 x 10 x 7 cm',
    category: 'PERIPHERALS',
  },
  {
    id: 4,
    name: 'MKS Pro Tablet',
    price: 2800000,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=400',
    gallery: [
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?auto=format&fit=crop&q=80&w=800',
    ],
    desc: 'Tablet khusus POS. Baterai badak 8000mAh. Layar IPS jernih. Sudah include stand metal.',
    review:
      'Bukan tablet cina murahan yang dipake sebulan jebol. Ini Industrial Grade. Baterai 8000mAh kuat seharian tanpa colok charger. Stand metalnya kokoh, gak goyang pas ditutul-tul pelanggan.',
    specs: ['Screen: 10.1 FHD IPS', 'CPU: Octa Core 2.0GHz', 'RAM 4GB / Storage 64GB', 'Battery: 8000mAh', '4G LTE Support'],
    inBox: ['Tablet Unit', 'Metal Stand', 'Charger Fast Charging', 'Sim Ejector'],
    weight: '1.2 Kg',
    dimensions: '24 x 17 x 0.9 cm',
    category: 'ANDROID',
  },
  {
    id: 5,
    name: 'PC All-in-One Commander',
    price: 8500000,
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=400',
    gallery: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&q=80&w=800',
    ],
    desc: 'PC Touchscreen Industrial Grade. Core i5, RAM 8GB, SSD 256GB. Tahan nyala 24 jam nonstop.',
    review:
      'Ini mesin perang sesungguhnya buat Minimarket atau Resto besar. Fanless design (gak berisik & gak nyedot debu). Touchscreen kapasitif responsif banget. Dinyalain 24 jam non-stop aman sentosa.',
    specs: ['Intel Core i5 Gen 11', 'RAM 8GB DDR4 (Upgradable)', 'SSD 256GB NVMe', 'Screen: 15.6 Inch True Flat', 'Win 10 IoT Enterprise'],
    inBox: ['AIO PC Unit', 'Power Adapter', 'Keyboard & Mouse Wireless', 'Driver'],
    weight: '5.5 Kg',
    dimensions: '40 x 35 x 25 cm',
    tag: 'PREMIUM',
    category: 'PC',
  },
  {
    id: 6,
    name: 'Cash Drawer Baja',
    price: 650000,
    image: 'https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&q=80&w=400',
    gallery: [
      'https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&q=80&w=800',
    ],
    desc: 'Laci uang full metal. Koneksi RJ11 ke printer. Penjepit uang besi, bukan plastik murahan.',
    review:
      "Laci uang yang bunyinya 'Cring' nya mantep. Full metal body, ditendang maling gak bakal penyok. Penjepit uangnya besi, bukan plastik yang gampang patah. Koneksi RJ11 otomatis kebuka pas struk keluar.",
    specs: ['Material: Heavy Duty Steel', 'Interface: RJ11', 'Tray: 5 Bills / 8 Coins', 'Lock: 3-Position Key Lock', 'Cycle: 1 Million Opens'],
    inBox: ['Cash Drawer Unit', 'Kunci (2 Pcs)', 'Kabel RJ11'],
    weight: '4.2 Kg',
    dimensions: '41 x 42 x 10 cm',
    category: 'PERIPHERALS',
  },
];

export const portal = [
  {
    id: 'sibos',
    name: 'SIBOS',
    tagline: 'Teknologi Perang Buat Pedagang Jalanan',
    desc: 'Sistem yang 100% berpihak pada profit — head-to-head lawan raksasa ritel. Ringan, cepat, jalan di perangkat apapun.',
  },
  {
    id: 'qalam',
    name: 'QALAM',
    tagline: 'Portal Kepercayaan Pendidikan',
    desc: 'Manajemen sekolah & pesantren — absen guru mendarat di HP wali detik itu juga, setoran anak langsung naik ke dashboard.',
  },
  {
    id: 'dapur',
    name: 'Dapur SPPG',
    tagline: 'Manajemen Dapur MBG',
    desc: 'Audit stok, distribusi QR Code, dan laporan kepatuhan Juknis BGN untuk dapur umum & katering Makan Bergizi Gratis.',
  },
];

export const problems = [
  {
    title: 'Duit Bocor Alus',
    desc: "Kembalian salah, nota ilang, atau 'mark-up' harga sama karyawan nakal. Dikit sih, tapi tiap hari. Boncos, Bos!",
  },
  {
    title: 'Stok Barang Ghaib',
    desc: 'Di catetan ada, di rak kosong. Lo bingung duitnya lari kemana, padahal barang abis. Capek hati.',
  },
  {
    title: 'Lo Jadi Tahanan Toko',
    desc: 'Gak berani ninggalin toko karena takut dikadalin. Bisnis jalan, tapi hidup lo gak tenang.',
  },
];

export const solutions = [
  {
    title: 'Sistem Anti-Tuyul (Fraud)',
    desc: 'Setiap sen kecatet di mesin kasir. Void/batal transaksi butuh password lo. Karyawan gak bisa macem-macem.',
  },
  {
    title: 'Stok Opname Otomatis',
    desc: 'Sistem bakal teriak kalau stok tipis. Belanja barang jadi terukur, gak pake feeling doang.',
  },
  {
    title: 'Asisten Digital 24 Jam',
    desc: 'Mesin ini gak pernah sakit, gak pernah cuti, dan gak bakal resign. Hemat gaji admin, profit naik.',
  },
];

export const cities = [
  { slug: 'solo', name: 'Solo (Surakarta)', type: 'Kandang' },
  { slug: 'sukoharjo', name: 'Sukoharjo', type: 'Kandang' },
  { slug: 'klaten', name: 'Klaten', type: 'Kandang' },
  { slug: 'boyolali', name: 'Boyolali', type: 'Kandang' },
  { slug: 'sragen', name: 'Sragen', type: 'Kandang' },
  { slug: 'karanganyar', name: 'Karanganyar', type: 'Kandang' },
  { slug: 'wonogiri', name: 'Wonogiri', type: 'Kandang' },
  { slug: 'semarang', name: 'Semarang', type: 'Ekspansi' },
  { slug: 'jogja', name: 'Yogyakarta', type: 'Ekspansi' },
  { slug: 'surabaya', name: 'Surabaya', type: 'Ekspansi' },
  { slug: 'madiun', name: 'Madiun', type: 'Ekspansi' },
  { slug: 'ngawi', name: 'Ngawi', type: 'Ekspansi' },
];

export const formatRupiah = (n: number) =>
  'Rp ' + new Intl.NumberFormat('id-ID').format(n);

// ---------- PORTOFOLIO PROYEK (klien riil, sumber: kasol-v2) ----------

export type ProjectCategory = 'PHYSICAL' | 'DIGITAL';

export interface Project {
  slug: string;
  title: string;
  client: string;
  city: string;
  category: ProjectCategory;
  tag: string;
  desc: string;
  image: string;
  value?: string;
  duration?: string;
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const RAW_PROJECTS: Omit<Project, 'slug'>[] = [
  {
    title: 'Instalasi & Training Mesin Kasir Android Desktop — Fauzan Net',
    client: 'Fauzan Net',
    city: 'Sragen',
    category: 'PHYSICAL',
    tag: 'Hardware & Instalasi',
    desc: 'Penyusunan struktur kategori produk yang sistematis dan optimalisasi manajemen database, plus training operasional kasir sampai tim toko mandiri.',
    image: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?q=80&w=800&auto=format&fit=crop',
    value: 'Rp 12.000.000',
    duration: '3 Hari',
  },
  {
    title: 'Mesin Kasir Android Desktop Touchscreen — Short Coffee',
    client: 'Short Coffee',
    city: 'Surakarta',
    category: 'PHYSICAL',
    tag: 'Hardware & Instalasi',
    desc: 'Tantangan: menghadirkan area kasir yang selaras estetika interior kedai. Solusinya mesin kasir touchscreen Android yang ramping dan senyap.',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Instalasi & Training Mesin Kasir Komputer — Orinawa',
    client: 'Orinawa',
    city: 'BTC Solo',
    category: 'PHYSICAL',
    tag: 'Hardware & Instalasi',
    desc: 'Volume transaksi harian tinggi menuntut mesin kasir komputer full-setup: scanner cepat, printer kasir, dan alur kasir yang dipangkas langkahnya.',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Cafe POS System Dual Screen — Kopi Kenangan Mantan',
    client: 'Kopi Kenangan Mantan',
    city: 'Wonogiri',
    category: 'PHYSICAL',
    tag: 'Hardware & Instalasi',
    desc: 'Instalasi sistem Point of Sales dual screen: kasir depan menerima pesanan, dapur menerima antrian real-time. Tidak ada nota yang tercecer.',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Retail Management System — Toko Kelontong Berkah',
    client: 'Toko Kelontong Berkah',
    city: 'Solo Raya',
    category: 'PHYSICAL',
    tag: 'Hardware & Instalasi',
    desc: 'Implementasi barcode scanner omni-directional untuk percepatan transaksi di jam sibuk, lengkap dengan manajemen stok grosir-eceran.',
    image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Restaurant Management — Steak House',
    client: 'Steak House',
    city: 'Surakarta',
    category: 'PHYSICAL',
    tag: 'Hardware & Instalasi',
    desc: 'Setup full kitchen display system (KDS) menggantikan printer kertas — dapur jadi kering, rapi, dan efisien.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Website Company Profile — Pasirmas Barkah',
    client: 'Pasirmas Barkah',
    city: 'Rembang',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Pengembangan website profil perusahaan komprehensif yang mengintegrasikan seluruh lini bisnis strategis untuk memvalidasi kredibilitas.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop',
    value: 'Rp 15.000.000',
    duration: '21 Hari',
  },
  {
    title: 'Web Company Profile — Dinara Skincare',
    client: 'Dinara Skincare',
    city: 'Sukoharjo',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Website company profile responsif dan teroptimasi SEO — mesin pencari jadi sumber lead, bukan cuma brosur digital.',
    image: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?q=80&w=800&auto=format&fit=crop',
    value: 'Rp 8.500.000',
    duration: '14 Hari',
  },
  {
    title: 'Digital Marketing Executive — KPF Semarang',
    client: 'KPF Semarang (Broker Trading Emas)',
    city: 'Semarang',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Strategi pemasaran digital: analisis mendalam perilaku pasar dan eksekusi kampanye terukur untuk broker komoditi emas.',
    image: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'E-Commerce Integration — Batik Solo Modern',
    client: 'Batik Solo Modern',
    city: 'Surakarta',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Pembangunan platform e-commerce terintegrasi payment gateway dan perhitungan ongkir otomatis — batik jualan ke seluruh Indonesia.',
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Company Profile — Konstruksi Jaya Abadi',
    client: 'Konstruksi Jaya Abadi',
    city: 'Solo Raya',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Desain website korporat dengan portofolio proyek interaktif dan sistem tender online.',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'SEO Optimization — Klinik Kecantikan Glowing',
    client: 'Klinik Kecantikan Glowing',
    city: 'Solo Raya',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Optimasi SEO lokal untuk mendominasi kata kunci pencarian klinik kecantikan di area Solo Raya.',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Web Company Profile — Logistik Maju Bersama',
    client: 'Logistik Maju Bersama',
    city: 'Semarang',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Transformasi digital perusahaan logistik dengan fitur tracking armada dan integrasi sistem inventaris real-time.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop',
    value: 'Rp 18.500.000',
    duration: '25 Hari',
  },
  {
    title: 'Sistem Manajemen Franchise — Ayam Geprek Juara',
    client: 'Ayam Geprek Juara',
    city: 'Se-Indonesia',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Dashboard monitoring royalti dan supply chain terpusat untuk 50+ cabang di seluruh Indonesia.',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Smart School System — SMA Negeri 1 Solo',
    client: 'SMA Negeri 1 Solo',
    city: 'Surakarta',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Digitalisasi administrasi sekolah, pembayaran SPP online, dan sistem raport digital terintegrasi.',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Sistem Informasi Desa (SID) — Desa Wisata',
    client: 'Desa Wisata',
    city: 'Karanganyar',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Portal pelayanan publik desa mandiri untuk pengurusan surat menyurat dan transparansi dana desa.',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop',
  },
  {
    title: 'Inventory Control System — Pabrik Tekstil',
    client: 'Pabrik Tekstil',
    city: 'Surakarta',
    category: 'DIGITAL',
    tag: 'Solusi Bisnis',
    desc: 'Otomatisasi pencatatan bahan baku dan barang jadi menggunakan sistem barcode industrial.',
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=800&auto=format&fit=crop',
  },
];

export const projects: Project[] = RAW_PROJECTS.map((p) => ({
  ...p,
  slug: slugify(`${p.client}-${p.city}`),
}));

export const getProject = (slug: string) =>
  projects.find((p) => p.slug === slug);

export const categoryLabel: Record<ProjectCategory, string> = {
  PHYSICAL: 'Mesin Kasir (Fisik)',
  DIGITAL: 'Software & Web (Digital)',
};

// ---------- JASA DIGITAL (porting dari kasol-v1 ServicesGrid) ----------

export const services = [
  {
    id: 'web',
    title: 'Web Konversi Tinggi',
    subtitle: 'Landing Page / Company Profile',
    desc: 'Bukan website cantik doang — mesin penangkap lead: cepat di HP, jelas harganya, langsung nyambung ke WhatsApp lo.',
  },
  {
    id: 'erp',
    title: 'Sistem ERP Custom',
    subtitle: 'Web App / Internal System',
    desc: 'SIBOS untuk back-office, QALAM untuk sekolah, SID untuk desa — sistem internal dirakit sesuai alur kerja, bukan memaksa alur kerja ikut sistem.',
  },
  {
    id: 'seo',
    title: 'Jajah Google (SEO)',
    subtitle: 'SEO & Local Search',
    desc: 'Bikin usaha lo nongol paling atas pas orang nyari jasanya di kota lo: GBP, review, halaman kota, konten yang jawab pertanyaan pembeli.',
  },
];

// ---------- SOCIAL PROOF ----------
// ⚠️ MOCK DATA — semua entri di bawah ini FIKTIF untuk demo visual.
// ⚠️ Ganti dengan data riil (orders/leads/testimoni asli dari Supabase/control)
// ⚠️ SEBELUM situs dipasarkan ke publik. Jangan launch dengan blok ini aktif.

export const pulseEvents = [
  { name: 'Bu Sri', item: 'Paket Kasir Android Lite', location: 'Laweyan, Solo', time: '2 jam lalu' },
  { name: 'Pak Dian', item: 'Instalasi + Training Resto Pro', location: 'Sragen', time: '5 jam lalu' },
  { name: 'Kopi Senja', item: 'Lirik-lirik Produk', location: 'Karanganyar', time: 'kemarin' },
  { name: 'Pak Hendra', item: 'Website Company Profile', location: 'Semarang', time: 'kemarin' },
  { name: 'Mbak Rina', item: 'Paket Kasir Android Lite', location: 'Wonogiri', time: '2 hr lalu' },
  { name: 'Toko Berkah', item: 'SEO Lokal + GBP', location: 'Boyolali', time: '3 hr lalu' },
];

export const testimonials = [
  {
    quote:
      'Dulu tutup toko 2 jam buat rekap nota. Sekarang laporan tinggal buka HP. Mesinnya gak pernah rewel, kalaupun ada tinggal WA — dijawab founder langsung.',
    name: 'Pak Budi',
    business: 'Kopi Senja — Surakarta',
    since: 'Pakai sejak 2024',
  },
  {
    quote:
      'Stok 800 SKU kelar opname 10 menit. Yang bikin tenang: tiap transaksi kecatet, gak bisa ada duit hilang tanpa jejak.',
    name: 'Bu Ani',
    business: 'Toko Kelontong Berkah — Solo',
    since: 'Pakai sejak 2025',
  },
  {
    quote:
      'Franchise saya 12 cabang. Royalti dan stokpus sekarang keliatan dari satu dashboard. Tim support-nya beneran orang, bukan bot.',
    name: 'Om Fajar',
    business: 'Ayam Geprek Juara — Se-Indonesia',
    since: 'Pakai sejak 2023',
  },
];

// Slot kelola manual utk demo scarcity CTA — ⚠️ MOCK, nanti dari control.
export const founderSlots = { onsite: 4, digital: 6 };

// ---------- HALAMAN TENTANG (adopsi penuh dari kasol-v1 components/about) ----------

export const about = {
  founder: {
    name: 'Amin Maghfuri',
    role: 'Founder & Survivor',
    kicker: 'Commanding Officer',
    tagline: 'The Architect of Chaos & Cuan',
    battleTested: 'Battle-Tested Since 2015',
    quote:
      'Developer lain bikin fitur di ruangan ber-AC. Gue bikin fitur di lapangan panas, sambil ngadepin komplain pelanggan dan selisih stok nyata. Gue tau rasanya boncos.',
    // ⚠️ MOCK — ganti dengan foto founder asli (portrait 3:4) sebelum launch.
    portrait: null as string | null,
  },
  story: {
    quoteHeading: '"Jujur-jujuran aja..."',
    body:
      'Jujur-jujuran aja... Tahun 2022, gue pernah \'mati suri\'. Aset digital ilang, domain diambil orang, profil Google Bisnis disuspend. Pernah juga dikadalin sama karyawan. Sistem berantakan gara-gara gue terlalu percaya sama \'manusia\' tanpa sistem kontrol.',
    lesson: 'Gue belajar satu hal mahal: Bisnis tanpa sistem yang kuat cuma nunggu waktu buat meledak.',
    turnTitle: 'Titik Balik (The Turn)',
    turn: [
      'Dari kehancuran itu, gue bangun ulang semuanya sendirian. Bukan buat bales dendam, tapi buat mastiin <strong>lo gak perlu ngerasain sakit yang gue rasain.</strong>',
      '<strong>SIBOS</strong> dan <strong>Mesin Kasir</strong> yang gue rakit sekarang lahir dari trauma itu. Ini bukan sekadar alat jualan, ini adalah <strong>asuransi</strong> buat bisnis lo. Gue desain fitur-fiturnya berdasarkan apa yang <em>nyelametin duit</em>, bukan cuma apa yang <em>keliatan canggih</em>.',
    ],
  },
  timeline: [
    {
      chapter: 'Chapter 1', year: '2015', title: 'Sales Jalanan', tone: 'orange', icon: 'history',
      text: 'Tanpa tim, tanpa investor. Gue jalan kaki <em>door-to-door</em> nawarin mesin kasir di Solo Raya. Diusir satpam, diketawain owner toko, itu sarapan pagi gue. Di fase ini gue belajar satu hal: <strong>Pedagang butuh solusi praktis, bukan teori teknis ribet.</strong>',
    },
    {
      chapter: 'Chapter 2', year: '2019', title: 'Raja Kecil', tone: 'blue', icon: 'rocket',
      text: 'Kerja keras gue kebayar. 500+ outlet pake alat gue. Gue ngerasa di atas angin. Tim makin gede, omzet naik. Tapi gue lengah. Gue lupa kalau <strong>Sistem Kontrol Internal</strong> itu lebih penting daripada omzet.',
    },
    {
      chapter: 'Chapter 3', year: '2022', title: 'Kiamat Kecil', tone: 'red', icon: 'skull',
      text: 'Cashflow macet, infrastruktur digital runtuh. Domain legendaris hangus dan diambil orang karena keteledoran manajemen aset. Reputasi nasional lenyap sekejap. Gue balik ke titik nol. Sendirian lagi.',
    },
    {
      chapter: 'Chapter 4', year: '2025', title: 'Mode Perang', tone: 'orange', icon: 'sunrise',
      quote: '"Gue balik bukan buat main-main. Gue balik buat ngasih lo senjata biar bisnis lo gak ancur kayak gue dulu."',
      text: 'Dengan pondasi <strong>SIBOS</strong> &amp; <strong>QALAM</strong> yang jauh lebih kuat. Gue bukan lagi sekadar vendor mesin kasir. Gue partner yang jagain benteng pertahanan bisnis lo.',
    },
  ],
  // Nomor legal ditranskrip dari screenshot situs v1 (2026-09-10) —
  // ⚠️ OWNER: verifikasi digit terhadap dokumen asli sebelum launch.
  legality: {
    rows: [
      { label: 'Badan Hukum', value: 'PT MESIN KASIR SOLO', mono: false, badge: true },
      { label: 'NIB (Izin Usaha)', value: '1226000711085', mono: true },
      { label: 'SK Kemenkumham', value: 'AHU-006097.AH.01.30.Tahun 2021', mono: true },
      { label: 'NPWP Perusahaan', value: '53.494.885.6-532.000', mono: true },
      { label: 'Rekening Sah (BNC)', value: '5859459406740414', mono: true, sub: 'A.N PT MESIN KASIR SOLO' },
    ],
    note: '*Buat lo yang butuh dokumen asli buat vendor list atau tender, chat admin gue. Kita transparan.',
    ossUrl: 'https://oss.go.id',
  },
  office: {
    title: 'Markas Legal Mesin Kasir Solo',
    sub: 'Tempat di mana ide liar dieksekusi jadi solusi nyata. Dari garasi kecil gue sulap jadi markas Mesin Kasir Solo.',
    // ⚠️ MOCK — ganti foto kantor asli sebelum launch.
    image: null as string | null,
  },
};

// ---------- PROYEK PER KOTA ( utk halaman /kota/[slug] ) ----------
export const CITY_ALIASES: Record<string, string[]> = {
  solo: ['Surakarta', 'BTC Solo', 'Solo Raya', 'Solo'],
  sukoharjo: ['Sukoharjo'],
  klaten: ['Klaten'],
  boyolali: ['Boyolali'],
  sragen: ['Sragen'],
  karanganyar: ['Karanganyar'],
  wonogiri: ['Wonogiri'],
  semarang: ['Semarang'],
  jogja: ['Yogyakarta', 'Jogja'],
  surabaya: ['Surabaya'],
  madiun: ['Madiun'],
  ngawi: ['Ngawi'],
};

export const projectsForCity = (slug: string): Project[] => {
  const aliases = CITY_ALIASES[slug] ?? [];
  return projects.filter((p) => aliases.includes(p.city));
};

// ---------- COPY PER KOTA (halaman /kota/[slug]) ----------
// ⚠️ Sebagian detail lokal (landmark, jam pasar, sentra) perlu diselaraskan
// ⚠️ dengan pengetahuan lapangan owner sebelum launch.
export const cityInfo: Record<string, { intro: string; landmark: string }> = {
  solo: {
    intro: 'Kota pusat dagang dan kuliner — dari angkringan Jebres sampai toko oleh-oleh pinggir Slamet Riyadi. Kami pasang, training, dan support langsung di lokasi.',
    landmark: 'Area Solo kota, Laweyan, Jebres, Banjarsari, dan Panularan.',
  },
  sukoharjo: {
    intro: 'Sukoharjo dan Kartasura adalah kandang kami — kantor legal di Perum Graha Tiara Kartasura. Respons on-site paling cepat justru di sini.',
    landmark: 'Kartasura, Gumpang, Solo Baru, dan pasar-pasar tradisional Sukoharjo.',
  },
  klaten: {
    intro: 'Toko bangunan, grosir sembako, dan depot di sepanjang jalur Solo–Yogyakarta: pelanggan di Klaten kami layani on-site terjadwal.',
    landmark: 'Kota Klaten, Delanggu, dan Ceper sepanjang jalur utama.',
  },
  boyolali: {
    intro: 'Boyolali dengan sentra susu dan dagangernya di jalur utara Solo–Semarang butuh pencatatan yang cepat dan jujur. Kami support on-site.',
    landmark: 'Ampel, Babadan, dan kota Boyolali.',
  },
  sragen: {
    intro: 'Sragen: pasar ikan, toko kelontong, dan warung-warung pinggir jalur Solo–Ngawi. Sudah ada instalasi kami berjalan di sini (Fauzan Net).',
    landmark: 'Kota Sragen, Gemolong, dan Masaran.',
  },
  karanganyar: {
    intro: 'Karanganyar — dari desa wisata sampai pertokoan kota — sudah kami kerjakan sistem informasi dan mesin kasirnya. On-site penuh.',
    landmark: 'Kota Karanganyar, Tasikmadu, dan Mojogedang.',
  },
  wonogiri: {
    intro: 'Wonogiri dengan kafe-kafe mudanya dan sentra kerajinan: instalasi kami berjalan di sini (Kopi Kenangan Mantan). Support on-site terjadwal.',
    landmark: 'Kota Wonogiri dan jalur Wuryantoro–Giriwoyo.',
  },
  semarang: {
    intro: 'Ekspansi kami ke Semarang sudah jalan — company profile dan sistem digital klien (KPF, Logistik Maju Bersama) dikerjakan tim kami. Mesin kasir dikirim + support remote, kunjungan terjadwal.',
    landmark: 'Semarang kota, Ungaran, dan Kendal.',
  },
  jogja: {
    intro: 'Jogja: kafe, kos, dan UMKM kreatif yang meledak. Pengiriman paket + support remote, instalasi on-site terjadwal untuk proyek di atas nilai tertentu.',
    landmark: 'Kota Jogja, Sleman, dan Bantul.',
  },
  surabaya: {
    intro: 'Surabaya dan Jawa Timur kami layani dengan pengiriman paket tersegel, instalasi terpandu video, dan support remote prioritas.',
    landmark: 'Surabaya kota, Sidoarjo, dan Gresik.',
  },
  madiun: {
    intro: 'Madiun di jalur Solo–Surabaya: pengiriman paket + support remote, dengan kunjungan on-site terjadwal per kloter.',
    landmark: 'Kota Madiun dan Nganjuk.',
  },
  ngawi: {
    intro: 'Ngawi dan sekitarnya: pengiriman paket + support remote, on-site terjadwal mengikuti rute ekspansi kami.',
    landmark: 'Kota Ngawi dan Mantingan.',
  },
};
