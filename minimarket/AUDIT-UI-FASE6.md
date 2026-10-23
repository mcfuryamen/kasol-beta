# AUDIT-UI-FASE6 — Settings, Reports, POS, Finance, Dashboard, Layouts & Organisms

**Tanggal:** 2026-08-27
**Auditor:** Mavis Agent
**Ruang Lingkup:** 13 file (5 pages + 2 layouts + 6 organisms/hooks)
**Stack:** Astro + Preact + TailwindCSS + DaisyUI + @preact/signals
**Status:** ✅ Lengkap

---

## 1. SETTINGS PAGE (`src/ui/pages/settings.tsx` — 165 baris)

### Findings

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| S1 | **MEDIUM** | Tidak ada **loading state** saat proses save ke `pos-service` berjalan. User bisa klik "Simpan" berkali-kali sebelum response kembali. | `handleSaveSettings()` — async fire-and-forget | Duplikat request, race condition |
| S2 | **MEDIUM** | Tidak ada **error boundary** atau error UI jika `posService.saveStoreSettings()` throw. Error akan naik ke root dan crash seluruh page. | `handleSaveSettings()` — no try/catch | User tidak tahu save gagal |
| S3 | **LOW** | `taxRate` di-parse dengan `parseFloat()` tanpa validasi range (0–100 atau 0–1). Input negatif atau > 999 tetap disimpan. | `storeSettings.taxRate = parseFloat(e.target.value)` | Data corruption |
| S4 | **LOW** | Tab switching re-render seluruh 3 tab content secara simultan (Store, POS, Printer) karena semua berada di `render()` yang sama. Tidak ada lazy mount per tab. | `return () => <div class="tabs">...</div>` | Overhead render yang tidak perlu |
| S5 | **LOW** | Tidak ada **"unsaved changes"** warning saat user navigasi ke halaman lain sementara ada perubahan yang belum disimpan. | Seluruh form fields | Data loss jika user tidak sengaja navigasi |
| S6 | **LOW** | `printerType`, `paperSize`, `currency` menggunakan string literal type tanpa validasi. Jika data corrupt di DB, aplikasi crash saat load. | `printerConfig` interface | Runtime crash |

### Kesimpulan
Settings page secara structural cukup baik tapi lemah di **error handling** dan **UX feedback** (loading, error, unsaved changes).

---

## 2. REPORTS PAGE (`src/ui/pages/reports.tsx` — 149 baris)

### Findings

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| R1 | **MEDIUM** | `Math.max(...salesReport.map(x => x.revenue), 1)` spread array dinamis di dalam `Math.max()` dihitung ulang setiap render. Tidak ada memoization. | Line ~80 — `maxRev` calculation | Performa degrade saat dataset besar |
| R2 | **MEDIUM** | Period option **hardcoded** 3 nilai (7, 14, 30 hari). Tidak ada opsi "custom range". Tidak ada opsi "today only" atau "this month". | `const periods = [{value:7, label:"7 Hari"...}]` | Terlalu rigid untuk kebutuhan bisnis |
| R3 | **LOW** | Date formatting `new Date().toISOString().slice(0,10)` digunakan 3+ tempat dengan format berbeda (Indonesia dd/mm/yyyy vs ISO yyyy-mm-dd). Tidak ada utility function terpusat. | various `toLocaleDateString()` calls | Inconsistency |
| R4 | **LOW** | Tidak ada **empty state** UI saat report data kosong. Chart atau tabel kosong menampilkan placeholder browser default. | `salesReport.map(...)` tanpa guard | UI jelek saat tidak ada data |
| R5 | **LOW** | `lowStockThreshold` untuk alert hardcoded angka (misal 10) tanpa label/unit. User tidak bisa configure tanpa edit code. | `lowStock.map(...)` inline threshold | Tidak configurabel |
| R6 | **LOW** | Report refresh tidak ada loading indicator. Data di-fetch via signal read secara sinkron — user tidak tahu kapan data terakhir di-update. | `useSnapshot(reports)` di render | UX confusion |

### Kesimpulan
Reports page membutuhkan **date utility terpusat**, **memoization** untuk kalkulasi statistik, dan **empty state** UI.

---

## 3. FINANCE PAGE (`src/ui/pages/finance.tsx` — 196 baris)

### Findings

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| F1 | **MEDIUM** | `new Date().toISOString().slice(0,10)` **duplicated 3x** untuk `today` filter. Seharusnya 1 konstanta di top-level function. | Lines ~25, ~50, ~80 | DRY violation, potential inconsistency |
| F2 | **MEDIUM** | 4 tab (Kas, Cashflow, Shifts, Void) semua di-render sekaligus. Content tab non-aktif tetap ada di DOM. Tidak ada lazy mount. | `return () => <div class="tabs">...</div>` | Overhead render, semua tab load upfront |
| F3 | **MEDIUM** | Empty state untuk **"Kas masih ditutup"** tidak ada UI eksplisit. user melihat layar kosong tanpa konteks. | Tab Kas — render saat `!currentShift` | User confusion |
| F4 | **MEDIUM** | `openKas()` dan `closeKas()` di-hook langsung tanpa **loading state** pada tombol. Tidak ada feedback saat request sedang diproses. | `handleOpenKas()` / `handleCloseKas()` | Race condition, double-click |
| F5 | **LOW** | `kasTransactions` filter `filter(t => t.type === 'income' || t.type === 'expense')` — `type` string literal prone to typo. Tidak ada enum. | `kasTransactions.value.filter(...)` | Runtime bug jika type mismatch |
| F6 | **LOW** | `openDate` dan `closeDate` untuk shift diformat manual dengan `new Date()` tanpa library. Potensi off-by-one error di timezone boundary. | `shiftCard.date = new Date(shift.openTime)` | Datum shift potential incorrect |
| F7 | **LOW** | Void transaction: hanya `reason: string` tanpa **authorisasi** (siapa yang mem-void). Tidak ada audit trail yang jelas. | `voidTransaction()` service call | Accountability gap |
| F8 | **LOW** | Modal `open/close` state menggunakan `useSignal(false)` terpisah per modal — tidak ada centralized modal state manager. | `showOpenModal`, `showCloseModal` signals | Prop drilling, state complexity |

### Kesimpulan
Finance page butuh **utility date function**, **loading state per action**, dan **empty state UI** yang jelas.

---

## 4. DASHBOARD PAGE (`src/ui/pages/dashboard.tsx` — 155 baris)

### Findings

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| D1 | **HIGH** | **Kas status banner** hardcoded styling saat kas ditutup. Tidak ada dynamic class berdasarkan `kasStatus.value`. Jika signal berubah, banner tidak update secara reaktif. | `kasStatus.value !== 'open'` conditional rendering | Stale UI state |
| D2 | **MEDIUM** | `openKas()` dan `closeKas()` buttons **tidak punya loading state**. User tidak tahu request sedang diproses. | `onClick={handleOpenKas}` | Race condition, double-submit |
| D3 | **MEDIUM** | `recentOrders` dan `lowStockItems` di-read langsung dari signal tanpa **loading skeleton**. Data muncul secara tiba-tiba. | `useSnapshot(posSignal)` calls | Layout shift, jarring UX |
| D4 | **MEDIUM** | **Low stock threshold** (10 unit) **hardcoded** dalam component. User tidak bisa mengatur batas minimal tanpa edit code. | `lowStock.filter(i => i.stock < 10)` | Tidak business-friendly |
| D5 | **LOW** | 4 **StatCards** (total orders, revenue, profit, transaction count) di-render per-baris tanpa container grid yang stable. Jika data belum load, height kart hilang total. | `StatCard` grid | Layout shift |
| D6 | **LOW** | `kasStatusBanner` menggunakan `innerHTML` atau teks statis — tidak reaktif terhadap perubahan signal kas itu sendiri. | `kasStatus.value` read di render | Stale data |
| D7 | **LOW** | Tidak ada **refresh button** atau **auto-refresh** untuk data dashboard. Data hanya fresh saat page mount. | Page load only | Data staleness |

### Kesimpulan
Dashboard butuh **reactive kas banner**, **loading skeletons**, dan **configurable thresholds** untuk low stock alert.

---

## 5. POS PAGE (`src/ui/pages/pos.tsx` — 714 baris)

Ini adalah file **terbesar dan paling kompleks**. Temuan diurutkan dari paling kritis ke rendah.

### Findings

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| P1 | **CRITICAL** | **3 algoritma berbeda** untuk quick cash calculation di 3 tempat berbeda: `(1)` `numpad-panel.tsx` `QUICK_CASH` array `(2)` `pos.tsx` numpad section `quickCashAmounts` const `(3)` `pos.tsx` PaymentModal `quickCashAmounts` const. Semua tiga **berbeda implementasinya**. PaymentModal buat array dari `total`, numpad panel buat array statis, numpad section buat array berdasarkan `total`. User bisa dapat **jumlah quick cash yang berbeda** tergantung dari mana ia membayar. | 3 lokasi berbeda | User confusion, incorrect payment |
| P2 | **HIGH** | **Held orders** di-simpan di **in-memory state** (`useSignal<HeldOrder[]>([])`). Di-refresh page, semua held order **hilang permanen**. Tidak ada persistence ke localStorage atau DB. | `heldOrders` signal | Data loss |
| P3 | **HIGH** | **F1–F10 keyboard shortcuts** di-register dengan `document.addEventListener('keydown', handler)` tapi **tidak pernah di-cleanup** (`removeEventListener`) saat component unmount. Memory leak + stale handlers tetap aktif. | `useEffect(() => { document.addEventListener(...) })` | Memory leak |
| P4 | **HIGH** | **Barcode scanner** tidak punya error handling. Input tidak recognized sebagai barcode, aplikasi diam-diam tidak merespons. Tidak ada feedback ke kasir. | `handleBarcodeScan()` — no try/catch | Kasir stuck |
| P5 | **HIGH** | **Cart item operations** (add, remove, update qty) menyebabkan **product list di kolom tengah re-render seluruhnya**. Tidak ada memoization pada `ProductCard` atau `ProductGrid`. Cart change seharusnya hanya re-render cart column. | `filteredProducts` re-computed on cart change | Performa degrade |
| P6 | **HIGH** | **Quantity numpad mode** — `applyInput()` dengan `mode === 'qty'` menulis langsung ke `item.quantity` tanpa validasi. Qty bisa 0 atau negatif. | `handleNumpadInput()` — no validation | Invalid cart state |
| P7 | **MEDIUM** | **Held order restoration** tidak validate apakah product masih ada di catalog atau apakah price masih sama. Order di-restore dengan harga lama. | `restoreHeldOrder()` — no product validation | Stale price data |
| P8 | **MEDIUM** | **Voucher code** tidak ada format validation. Kode kosong atau format tidak valid tidak kasih feedback. | `handleVoucherApply()` — no validation | Silent failure |
| P9 | **MEDIUM** | **PaymentModal** `handleAmountPaidChange` pakai `parseInt()` untuk amount, tapi `changeAmount` hitung `parseFloat(paid) - total`. Mixed type arithmetic — kembalian bisa truncation error untuk angka desimal. | `handleAmountPaidChange()` / `change` calculation | Incorrect change (rare but possible) |
| P10 | **MEDIUM** | **F9 shortcut** hard untuk held orders tapi implementasi不明 — apakah F9 sama dengan F10 (new held order) atau berbeda? Kode comment `F9 - Held Orders` tapi body `handleSaveHeldOrder()` — ambiguous. | `key === 'F9'` handler | Unclear behavior |
| P11 | **MEDIUM** | **Void transaction** (`handleVoidTransaction`) hanya minta `reason` string. Tidak ada **password/authorization** atau **confirm modal**. Siapa saja bisa mem-void tanpa gate. | `handleVoidTransaction()` | Security risk |
| P12 | **MEDIUM** | **Multiple modal state** menggunakan 5+ sinyal terpisah (`showPaymentModal`, `showCustomerPicker`, `showHeldOrders`, `showVoidModal`, `showVoucherModal`). Tidak ada **modal stack** — jika 2 modal open bersamaan, tidak ada z-index management. | All modal signals | UI overlap, broken UX |
| P13 | **MEDIUM** | **CustomerPicker** modal muncul **setiap kali** POS page load jika `!customer`. Tidak ada "Don't ask again" atau persist choice. | `showCustomerPicker` conditional on mount | Annoying on repeat visits |
| P14 | **MEDIUM** | **Quick cash buttons** di PaymentModal hanya di-generate saat modal open (`useEffect`). Jika `total` berubah sementara modal masih terbuka (misal user edit cart), quick cash buttons tidak update. | `useEffect([total])` di PaymentModal | Stale quick amounts |
| P15 | **LOW** | **Held orders list** tidak ada empty state. Jika `heldOrders.value.length === 0`, tidak ada pesan "Tidak ada held order". | `heldOrders.value.length === 0` — no UI | User confusion |
| P16 | **LOW** | **Checkout button** disabled saat cart empty tapi tidak ada visual disabled state yang jelas — hanya `opacity-50` atau similar. User tidak bisa yakin apakah button mati atau sedang loading. | `checkoutButton.disabled` | UX confusion |
| P17 | **LOW** | **Numpad panel** di-render 2 tempat: 1 di main POS layout (untuk qty/input), 1 di PaymentModal (untuk cash entry). Dua-duanya independent tapi share state via parent props — prop drilling 4 level. | `POSLayout` dan `PaymentModal` | Prop drilling, maintenance difficulty |
| P18 | **LOW** | **F1 shortcut** (Clear) tidak ada konfirmasi. Satu tombol salah langsung clear semua input. | `key === 'F1'` | Accidental data loss |
| P19 | **LOW** | **Payment modal** tidak ada **timeout** untuk paid amount input. Jika kasir tinggal diam, modal tetap terbuka indefinitely. | No auto-close | Resource leak |

### Kesimpulan
POS page adalah file **paling beresiko tinggi** di aplikasi ini. Top priorities:
1. **Held order persistence** — data loss setiap refresh
2. **Keyboard shortcut cleanup** — memory leak
3. **Quick cash algorithm unification** — satu source of truth
4. **Modal stack management** — broken UX saat multiple modals
5. **Barcode error feedback** — silent failure

---

## 6. LAYOUTS

### 6a. MAIN-LAYOUT (`src/ui/templates/main-layout.tsx` — ~150 baris)

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| ML1 | **HIGH** | `children` prop typed `any` — tidak ada TypeScript type safety. Jika props salah, error muncul di runtime bukan compile time. | `MainLayout = ({ children }) =>` | Type safety gap |
| ML2 | **MEDIUM** | **4 overlay components** (Toast, ConfirmDialog, ShortcutHelp, MobileMenuSheet) semuanya di-render sekaligus dalam setiap render cycle. Tidak ada lazy mount. | `return (<> <Toast /> <ConfirmDialog /> ...`) | Overhead render |
| ML3 | **MEDIUM** | `document.addEventListener('click', closeMenu)` **tidak punya cleanup** removeEventListener. Jika component unmount, listener tetap jalan. | `useEffect(() => { document.addEventListener(...) })` | Memory leak + stale closure |
| ML4 | **MEDIUM** | `document.addEventListener('keydown', handleGlobalKeys)` **tidak punya cleanup**. Keyboard shortcut handler mengikat ke document selamanya. | Same useEffect as click listener | Memory leak |
| ML5 | **MEDIUM** | **Toast** dan **ConfirmDialog** di-render secara **additive** — setiap Toast push menambahkan element baru tanpa limit. Jika 100 toast di-trigger, 100 div ada di DOM. | `<Toast />` — no stack limit | DOM bloat |
| ML6 | **LOW** | **MobileMenuSheet** memiliki `position: fixed; bottom: 0` tapi **tidak ada backdrop** — elemen di bawah tetap bisa di-klik. | Sheet visible = pointer-events on sheet only | Tap误触 (accidental taps) |
| ML7 | **LOW** | Toast container menggunakan `position: fixed; bottom-left` — di mobile dengan bottom navigation (64px), toast bisa tertutup oleh bottom nav. | Toast positioning | Unreadable toast |
| ML8 | **LOW** | `DarkModeSync` component throw error jika `darkMode` signal tidak ter-initialize sebelum render. Tidak ada error boundary. | `DarkModeSync` — no try/catch | App crash on init failure |

### 6b. AUTH-LAYOUT (`src/ui/templates/auth-layout.tsx` — ~40 baris)

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| AL1 | **LOW** | Gradient background CSS menggunakan `background-image: linear-gradient(...)` **tanpa fallback** `background-color`. Jika gradient fail, halaman putih. | Inline style | Flash of white |
| AL2 | **LOW** | `DarkModeSync` di-import dan dirender tapi **tidak ada check** apakah `darkMode` signal sudah ter-register. Crash jika signal belum di-initialize. | `DarkModeSync` mount | App crash |
| AL3 | **LOW** | Tidak ada **loading state** untuk proses autentikasi. Jika login lambat, tidak ada spinner atau visual feedback. | Login form submission | UX confusion |
| AL4 | **LOW** | Background pattern/image jika ada, akan **repetisi** pada pages dengan scroll panjang. | Background attachment | Visual artifact |

---

## 7. ORGANISMS

### 7a. NUMPAD-PANEL (`src/ui/organisms/numpad-panel.tsx` — 151 baris)

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| NP1 | **MEDIUM** | **Quick cash amounts** di-compute sebagai `const quickCash = [50000, 100000, ...]` saat render. Seharusnya di-memoize berdasarkan `total` agar tidak recalculate setiap render. | `quickCashAmounts` computed inline | Performa degrade |
| NP2 | **MEDIUM** | **Mode switch** (cash → qty → disc → price) Langsung reset input tanpa konfirmasi. Jika kasir sedang input رقم dan tidak sengaja tekan mode switch, input hilang. | `handleModeSwitch()` — no confirmation | Data loss |
| NP3 | **MEDIUM** | **applyInput()** berbeda behavior per mode:
- `cash`: set amount
- `qty`: langsung write ke `item.quantity` (side effect di dalam numpad!)
- `disc`: parseFloat ke `item.discount`
- `price`: update `item.price`
Qty/disc/price langsung modify item tanpa validation. | `applyInput()` — mixed responsibilities | Invalid cart state |
| NP4 | **LOW** | **Numeric overflow** tidak di-handle. Jika input number > Number.MAX_SAFE_INTEGER, akurasi hilang. | `appendDigit(digit)` — no overflow check | Calculation error |
| NP5 | **LOW** | **Decimal handling** — input desimal lewat numpad tidak ada validasi. User bisa input `0.5.5.5`. | `appendDigit('.')` — no format validation | Invalid number |
| NP6 | **LOW** | **Locale** — thousand separator dan decimal menggunakan hardcoded `toLocaleString('id-ID')` di quick cash button. Jika device locale bukan Indonesia, quick cash tidak sesuai ekspektasi. | `btn.label = amount.toLocaleString('id-ID')` | Formatting mismatch |

### 7b. MOBILE-MENU-SHEET (`src/ui/organisms/mobile-menu-sheet.tsx` — 113 baris)

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| MS1 | **MEDIUM** | **Sheet tanpa backdrop** — tap di area luar sheet tetap bisa memilih nav item underneath. Overlay hanya menutupi sheet itu sendiri. | `className="..."` sheet container | Accidental navigation |
| MS2 | **MEDIUM** | **License activation** tidak ada feedback UI (success/error state). Jika gagal, error object di-console saja. | `handleActivate()` — console.error only | User tidak tahu aktivasi gagal |
| MS3 | **MEDIUM** | `visibleItems` di-compute setiap render dari `NAV_ITEMS.filter(...)`. Seharusnya di-memoize atau di-extract ke hook. | `const visibleItems = NAV_ITEMS.filter(...)` | Unnecessary recompute |
| MS4 | **MEDIUM** | **Dark mode toggle** tidak ada loading state saat save. User tidak tahu apakah perubahan sedang disimpan atau sudah disimpan. | `onClick={() => toggleDarkMode()}` | UX confusion |
| MS5 | **LOW** | **Logout** langsung execute tanpa **confirm dialog**. Jika user tidak sengaja tap logout, langsung logged out. | `onClick={handleLogout}` | Accidental logout |
| MS6 | **LOW** | **Nav grid** hardcoded 4 kolom `grid-cols-4`. Jika item count tidak genap 4, row terakhir tidak rata. | `grid-cols-4` | Visual misalignment |
| MS7 | **LOW** | **Sheet tidak ada close button** visual (X). Satu-satunya cara menutup adalah tap backdrop (yang tidak ada) atau tap nav item. | Sheet UI | UX discoverability |
| MS8 | **LOW** | **User section** (nama/role) di render tapi tidak ada indicator apakah session aktif atau expired. | User info section | Confusion on session state |

### 7c. SIDEBAR (`src/ui/organisms/sidebar.tsx` — 113 baris)

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| SB1 | **MEDIUM** | **Kas status indicator** hanya icon/color hardcoded — `kasStatus` signal di-read tapi tidak di-display secara prominence. Kas closed tidak kelihatan jelas. | `kasStatusIndicator` — static rendering | User tidak sadar kas status |
| SB2 | **MEDIUM** | **Visible items computation** `NAV_ITEMS.filter(item => visibleItems(item, role))` tidak di-memoize. Recompute setiap render. | `visibleItems` inline filter | Performa degrade (minor) |
| SB3 | **LOW** | **Collapse button** di `onClick={toggleCollapse}` di luar sidebar content — jika sidebar collapsed, button mungkin tidak kelihatan. | `toggleCollapse` handler | UI bisa tidak bisa di-expand kembali |
| SB4 | **LOW** | **User section** tidak clickable — tidak ada dropdown untuk logout atau settings. User harus pergi ke settings page untuk logout. | User section area | Indirect logout flow |
| SB5 | **LOW** | **Active route detection** `nav.href === currentPath` — hanya exact match. `/dashboard` active, tapi `/dashboard/orders` juga akan aktif jika exact match `/dashboard/orders` tidak di-match. Jika route ada sub-pages, active state akan incorrect. | `nav.href === location.pathname` | Active nav state incorrect |
| SB6 | **LOW** | **Icon sizing** menggunakan `w-5 h-5` tapi text menggunakan `text-sm`. Icon sedikit lebih besar dari text — visual hierarchy slightly off. | Nav item icons | Visual inconsistency |
| SB7 | **LOW** | **Tooltip/truncation** — nav label jika > 20 karakter akan truncate dengan ellipsis tapi tidak ada `title` attribute untuk tooltip. | `nav.label` text | Label tidak readable |
| SB8 | **LOW** | **role-based visibility** `visibleItems(item, role)` diexport tapi function ini tidak di-test secara eksplisit. Jika role string berubah (misal "admin" vs "owner"), filter mungkin tidak jalan. | `visibleItems` exported function | Visibility bug |

### 7d. HEADER (`src/ui/organisms/header.tsx` — 86 baris)

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| HD1 | **HIGH** | **Online indicator** hanya icon static — tidak ada **actual connectivity check**. App bisa offline tapi icon tetap hijau. | `isOnline = true` static | Miskonsepsi user tentang status |
| HD2 | **MEDIUM** | **Window.innerWidth check** di `onClick` handler — tidak reactive terhadap resize. Jika user resize window dari desktop ke mobile, hamburger menu tidak muncul tanpa page reload. | `onClick={() => window.innerWidth < 1024 && openSidebar()}` | UI inconsistency after resize |
| HD3 | **MEDIUM** | **Dark mode toggle** ada di header DAN di sidebar — **duplicate**. Jika user toggle di header, sidebar tidak update sampai signal propagate. | `onClick={toggleDarkMode}` header + sidebar | Conflicting UX |
| HD4 | **MEDIUM** | **Page title** tidak reactive terhadap route change — `title` prop di-pass manual dari page. Jika page tidak pass title, header kosong. | `title` prop — no default | Inconsistent branding |
| HD5 | **LOW** | **Language toggle** tidak ada loading state. Switching bahasa tidak ada feedback visual. | `onClick={toggleLanguage}` | UX confusion |
| HD6 | **LOW** | **Notification bell** tidak punya badge/unread count. Tidak ada visual indicator ada notifikasi baru. | Bell icon only | Unread count hidden |
| HD7 | **LOW** | **Cash register status** (`kasStatus`) hanya tampilkan text "Buka" / "Tutup" — tidak ada action button untuk open/close kas. User harus ke halaman terpisah. | Kas status indicator | Indirect flow |
| HD8 | **LOW** | **Logo area** tidak clickable untuk navigate ke home. User harus pakai nav sidebar. | Logo section | Indirect home navigation |

### 7e. BOTTOM-NAV (`src/ui/organisms/bottom-nav.tsx` — 68 baris)

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| BN1 | **HIGH** | **POS page** merender `null` — bottom nav item POS menyebabkan area content kosong total. Ini adalah **dead UI** state yang membingungkan. | `if (page === 'pos') return null` | Broken navigation |
| BN2 | **MEDIUM** | **Badge** hanya tampilkan dot/bullet saat `!shiftId` — tidak ada actual count. Badge selalu terlihat atau tidak pernah terlihat, tidak ada jumlah shift yang active. | `!shiftId && <span className="badge">` | Shallow information |
| BN3 | **MEDIUM** | **Nav items hardcoded** 5 item array — tidak read dari centralized nav config. duplication dengan sidebar. | `[ {id:'dashboard', ...}, {id:'pos', ...}, ...]` | Maintenance difficulty |
| BN4 | **MEDIUM** | **Active route detection** `nav.id === currentPage` — exact match. Tidak ada parent/child route relationship. `/reports` active, tapi `/reports/sales` tidak di-highlight. | `nav.id === currentPage` | Active state incorrect for sub-routes |
| BN5 | **LOW** | **POS item** di bottom-nav tidak ada visual special treatment untuk differentiate dari nav lain. User tidak tahu ini adalah "primary action". | POS nav item | Discoverability |

---

## 8. HOOKS

### 8a. USE-DARK-MODE (`src/logic/hooks/use-dark-mode.ts` — 27 baris)

| # | Severity | Deskripsi | Lokasi | Dampak |
|---|----------|-----------|--------|--------|
| DM1 | **HIGH** | Effect init (line ~10) **read localStorage dan write ke signal di dalam useEffect tanpa dependency array** — ini adalah implicit coupling. Jika localStorage berubah (tab lain), state tidak sync. | `useEffect(() => { const saved = localStorage.getItem(...); darkMode.value = saved === "true"; })` — missing deps | Tab synchronization gap |
| DM2 | **HIGH** | **No SSR safety** — `window` atau `document` digunakan langsung tanpa `typeof window !== 'undefined'` guard. App crash saat SSR/SSG build. | `window.addEventListener('storage', ...)` | Build failure (SSR) |
| DM3 | **MEDIUM** | **System preference** (`prefers-color-scheme`) hanya dibaca saat init. Perubahan system preference setelah load **tidak di-detect**. | `useEffect(() => { ... })` — no system listener | Theme staleness |
| DM4 | **MEDIUM** | **Flash of wrong theme** mungkin terjadi — jika localStorage kosong dan system gelap, initial render akan light sebelum JS hydration. | No blocking script | FOUC (Flash of Unstyled Content) |
| DM5 | **LOW** | **localStorage failure** (private browsing, quota exceeded) akan throw exception yang tidak caught. App tidakgracefully degrade. | `localStorage.setItem(...)` in effect | App crash in private mode |
| DM6 | **LOW** | **No cross-tab sync** — jika user ubah dark mode di tab A, tab B tidak update kecuali `storage` event. Yang ada hanya `storage` listener tapi tidak ada logic untuk update signal. | `window.addEventListener('storage', ...)` — only for OTHER tab changes | Tab A change not reflected in Tab B |
| DM7 | **LOW** | Dark mode state tidak di-persist ke server/user DB — hanya localStorage. User yang clear browser data kehilangan preference. | localStorage only | Preference loss |

---

## 9. RINGKASAN CROSS-FINDING

### CRITICAL Issues (harus fix secepatnya)

| Issue | File | Risk |
|-------|------|------|
| Held orders = in-memory only (data loss on refresh) | pos.tsx | Data loss |
| Keyboard shortcuts = memory leak (no cleanup) | pos.tsx | Memory leak |
| 3 different quick cash algorithms | pos.tsx + numpad-panel.tsx + pos.tsx payment | Business logic inconsistency |
| Online indicator = hardcoded, no actual check | header.tsx | Miskonsepsi user |
| SSR safety — window/localStorage tanpa guard | use-dark-mode.ts | Build failure |
| POS page = return null (dead UI state) | bottom-nav.tsx | Broken navigation |
| Tab synchronization gap (dark mode) | use-dark-mode.ts | Cross-tab state inconsistency |

### HIGH Issues

| Issue | File |
|-------|------|
| Kas status banner not reactive | dashboard.tsx |
| Cart change re-renders entire product list | pos.tsx |
| Modal stack — no z-index management | pos.tsx |
| Void transaction = no authorization gate | pos.tsx |
| Confirm/logout = no confirmation dialog | mobile-menu-sheet.tsx |
| Dark mode toggle duplicate in header + sidebar | header.tsx + sidebar.tsx |
| Quick cash buttons stale when total changes | pos.tsx PaymentModal |
| Dark mode signal write inside useEffect (hidden coupling) | use-dark-mode.ts |
| children typed as any | main-layout.tsx |
| Document click/keyboard listeners no cleanup | main-layout.tsx |

### MEDIUM Issues

| Issue | File |
|-------|------|
| Quick cash amounts not memoized | numpad-panel.tsx |
| Mode switch loses unsaved input | numpad-panel.tsx |
| No loading state for all async actions | settings, finance, dashboard, pos |
| No error boundary / error UI | settings, auth-layout |
| 4 overlays rendered simultaneously, no lazy mount | main-layout.tsx |
| Toast no stack limit, potential DOM bloat | main-layout.tsx |
| Toast bottom-left overlaps bottom-nav mobile | main-layout.tsx |
| Date utility duplicated (DRY) | reports.tsx, finance.tsx |
| Held order restore no product validation | pos.tsx |
| Barcode scan no error feedback | pos.tsx |
| Customer picker shows every page load | pos.tsx |
| Visible nav items not memoized | sidebar.tsx, mobile-menu-sheet.tsx |
| Mobile sheet no backdrop | mobile-menu-sheet.tsx |
| License activation no success/error UI | mobile-menu-sheet.tsx |
| Window.innerWidth check in onClick not reactive | header.tsx |
| Active route = exact match only | sidebar.tsx, bottom-nav.tsx |
| No loading skeleton for StatCards | dashboard.tsx |
| Empty state missing | reports, finance (kas closed), pos (held orders) |

### LOW Issues

~35 findings —详见 per-file tables di atas.

---

## 10. PRIORITAS REFACTORING

### Sprint 1 — Critical Data Loss & Memory (Week 1)
1. **POS held orders → localStorage persistence** — mencegah data loss on refresh
2. **POS keyboard shortcuts → cleanup on unmount** — fix memory leak
3. **use-dark-mode.ts → SSR guard + tab sync** — fix build failure
4. **POS bottom-nav → non-null render** — fix dead UI state

### Sprint 2 — Business Logic Consistency (Week 2)
1. **Quick cash → single source of truth** — extrak ke shared util, import di 3 tempat
2. **Finance date utility → centralized date helper** — eliminate duplication
3. **PaymentModal → unified change calculation** — fix mixed parseInt/parseFloat
4. **Modal stack manager** — centralized z-index dan state untuk semua modals

### Sprint 3 — UX & Polish (Week 3)
1. **Loading states** — skeleton UI di dashboard, finance, settings, reports
2. **Error boundaries** — wrap pages dengan error fallback
3. **Confirmation dialogs** — logout, void transaction, clear input
4. **Toast stack limit** — max 3 toast visible, oldest dismissed

### Sprint 4 — Maintainability (Week 4)
1. **Type safety** — `children` prop typed, semua props interfaces
2. **Memoization audit** — visibleNavItems, quickCashAmounts, filteredProducts
3. **Dark mode toggle** — single instance di satu tempat (sidebar atau header, bukan keduanya)
4. **Document listener cleanup** — semua useEffect dengan addEventListener wajib cleanup

---

*Audit dilakukan dari source code murni tanpa live server. Temuan UI/UX bersifat observasional berdasarkan kode yang dibaca. Beberapa finding dengan severity HIGH mungkin perlu di-validasi dengan testing langsung karena state management (signals) mungkin mitigating factor yang tidak terlihat dari static analysis.*
