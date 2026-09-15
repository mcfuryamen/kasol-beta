# Changelog - Kasir Solo - Minimarket

Semua perubahan penting pada proyek ini didokumentasikan di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/id/1.1.0/).

---

## [1.0.0] - 2026-08-14

### Rilis Awal — Kasir Solo Minimarket v1.0

Upgrade besar dari "Kasir Solo - Grocery" menjadi "Kasir Solo - Minimarket" dengan 8 peningkatan utama.

#### Ditambahkan

**POS 3-Column Layout**
- Layout kasir 3 kolom: Keranjang (38%) | Pembayaran (30%) | Numpad Jumbo (32%)
- Numpad mode switching: BAYAR (hijau), QTY (biru), DISKON (merah), HARGA (ungu)
- Quick cash amount buttons di kolom pembayaran
- Display kembalian real-time di numpad

**Buka/Tutup Kas (Mandatory)**
- Modal buka kas dengan input modal awal + numpad + quick amounts
- Modal tutup kas dengan summary (penjualan, pengeluaran, ekspektasi)
- Hitung denominasi (Rp 100.000 s/d Rp 500)
- Selisih surplus/defisit display
- Gate: WAJIB buka kas sebelum bisa transaksi
- Indikator kas di header (hijau = aktif, merah = tutup)

**Uang Masuk/Keluar**
- Type `CashFlow` dengan kategori masuk (Setoran Tambahan, Pengembalian, Lainnya) dan keluar (Belanja Operasional, Setor Bank, Gaji, Listrik/Air, Kebersihan, Lainnya)
- Form input uang masuk/keluar
- History log dengan filter
- Running balance calculation

**Barcode Scan Optimization**
- Auto-focus barcode input on POS page load
- Green pulse animation saat scanner ready
- Rapid scan mode (Enter = auto-add to cart)
- Fallback to search query jika barcode tidak ditemukan
- Scan counter per hari

**Keyboard Shortcuts (16 shortcuts)**
- F1-F12 function keys untuk operasi kasir
- +/- untuk qty, Delete untuk hapus item
- ? untuk panel bantuan shortcut
- Esc untuk tutup modal
- Enter untuk konfirmasi
- Hook `useKeyboardShortcuts` reusable

**Printer Module**
- Service `printer-service.ts` dengan print queue
- Receipt builder format ESC/POS (thermal 58mm/80mm)
- Tab Printer di Settings (paper size, connection, auto-print)
- Test print function
- Browser print fallback

**Enhanced Finance Page**
- 4 tab: Kas Aktif, Uang Masuk/Keluar, Riwayat Shift, Void & Retur
- Cash flow summary cards
- Running balance display

**UI/UX Improvements**
- Shortcut badges pada tombol POS (contoh: "[F2]", "[F4]")
- Scanner status indicator (green pulse)
- Kas status indicator di header
- Numpad mode color coding
- Denomination counter di tutup kas

#### Komponen Baru (vs Grocery)
- `src/data/types/printer.ts` — PrinterConfig, PrintJob types
- `src/logic/hooks/use-keyboard-shortcuts.ts` — 16 keyboard shortcuts
- `src/logic/services/printer-service.ts` — Print receipt, test, queue
- `src/ui/atoms/numpad-key.tsx` — Tombol numpad besar
- `src/ui/molecules/shortcut-badge.tsx` — Badge shortcut key
- `src/ui/molecules/cash-flow-item.tsx` — List item arus kas
- `src/ui/organisms/numpad-panel.tsx` — Panel numpad jumbo 4 mode
- `src/ui/organisms/open-kas-modal.tsx` — Modal buka kas
- `src/ui/organisms/close-kas-modal.tsx` — Modal tutup kas + denominasi
- `src/ui/organisms/shortcut-help.tsx` — Panel bantuan shortcut
- `src/ui/organisms/cash-flow-form.tsx` — Form uang masuk/keluar

#### Diubah
- `src/ui/pages/pos.tsx` — Complete rewrite: 2-column → 3-column layout (673 baris)
- `src/ui/pages/finance.tsx` — Complete rewrite: 4-tab layout
- `src/ui/pages/settings.tsx` — Tambah tab Printer configuration
- `src/ui/organisms/header.tsx` — Tambah indikator status kas
- `src/ui/organisms/sidebar.tsx` — Rename branding "Minimarket"
- `src/data/types/finance.ts` — Tambah CashFlow, Denomination, CashInCategory, CashOutCategory
- `src/logic/services/finance-service.ts` — Tambah cash flow, running balance, denomination
- `src/logic/services/pos-service.ts` — Tambah scanBarcode, voidLastItem, shift integration
- `src/logic/state/app-state.ts` — Tambah numpad, barcode, printer, fullscreen signals

#### Statistik
- **112 total files**
- **163 KB** compressed
- **12 halaman** aplikasi
- **11 services** bisnis logic
- **6 hooks** custom
- **250+ i18n keys** (ID + EN)
- **7 SQL migrations**
- **25 produk demo** realistis Indonesia
- **6 supplier demo** FMCG Indonesia
- **6 pelanggan demo** dengan loyalty tier

---

## [0.9.0] - 2026-08-13

### Kasir Solo - Grocery (Base Version)

#### Ditambahkan
- Foundation: Vite + Preact + TypeScript + Tailwind + Supabase + PWA
- Auth & User: 4 role, demo mode, staff management
- Produk: CRUD, 25 produk, 10 kategori, barcode/SKU
- POS: 2-column layout, 6 payment methods, receipt
- Stok: Mutasi, opname, low stock alert
- Supplier: 6 supplier, Purchase Order
- Pelanggan: 6 customer, 3 tier loyalty, points
- Keuangan: Shift, petty cash, void/retur
- Promo: 5 tipe promo, voucher
- Notifikasi: Bell icon, real-time alerts
- Laporan: Penjualan, P&L, stok
- i18n: Indonesia + English (200+ keys)
- Dark mode, responsive design
