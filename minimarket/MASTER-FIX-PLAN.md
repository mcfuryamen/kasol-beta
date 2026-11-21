# MASTER FIX PLAN — Minimarket Kasir Solo
### Gabungan: AUDIT-UI-FASE5 + AUDIT-UI-FASE6 + AUDIT-LOGIC-FLOW

**Tanggal:** 2026-08-27
**Total Temuan:** ~90 issues (7 CRITICAL, 15 HIGH, 34 MEDIUM, ~35 LOW)
**Estimasi Sprint:** 8 minggu (2 bulan)
**Tim:** 1 developer + 1 QA

---

## BAGIAN 1: KONSOLIDASI SEMUA ISSUE

### 1.1 CRITICAL Issues (行动迫在眉睫)

| ID | Audit | Deskripsi | Dampak | File |
|----|-------|-----------|--------|------|
| **C-01** | LOGIC-FLOW | Order number race condition — `nextOrderNumber()` read-write non-atomic | Duplikat INV-20260927-XXX | `order-service.ts`, `app-state.ts` |
| **C-02** | LOGIC-FLOW | Loyalty transactions TIDAK di-persist — `loyaltyTxSignal` hanya in-memory | History poin hilang tiap refresh | `loyalty-service.ts` |
| **C-03** | LOGIC-FLOW | Pull REPLACES signal (not merge) — data lokal overwrite oleh server | Offline-created data hilang | `sync-engine.ts`, `hydrate.ts` |
| **C-04** | LOGIC-FLOW | Pull overwrite tidak check pending outbox — state corruption risk | Sync state inconsistency | `sync-engine.ts` |
| **C-05** | UI-FASE6 | POS: Held orders in-memory only — hilang tiap page refresh | Data loss fatal | `pos.tsx` |
| **C-06** | UI-FASE6 | POS: F1-F10 `addEventListener` tanpa `removeEventListener` cleanup | Memory leak + stale handlers | `pos.tsx` |
| **C-07** | UI-FASE6 | POS bottom-nav return `null` saat page=pos — dead UI state | Broken navigation | `bottom-nav.tsx` |

### 1.2 HIGH Issues (行动在即)

| ID | Audit | Deskripsi | Dampak | File |
|----|-------|-----------|--------|------|
| **H-01** | UI-FASE6 | **3 algoritma berbeda** untuk quick cash calculation | User dapat jumlah berbeda tergantung cara bayar | `pos.tsx`, `numpad-panel.tsx`, `PaymentModal` |
| **H-02** | LOGIC-FLOW | Promo `usageCount` tidak pernah di-increment | Statistik promo tidak akurat | `promo-service.ts`, `voucher-service.ts` |
| **H-03** | LOGIC-FLOW | Outbox chunk: 1 record corrupt → 100 record ditolak | 99 data valid tidak tersync | `sync-engine.ts` |
| **H-04** | LOGIC-FLOW | Sync error = `console.warn` only — user tidak dapat notifikasi | User tidak tahu sync gagal | `sync-engine.ts` |
| **H-05** | LOGIC-FLOW | Voucher validation race — `!used` check tidak atomic | Double-use voucher possibility | `voucher-service.ts` |
| **H-06** | UI-FASE6 | use-dark-mode: `window`/`localStorage` tanpa SSR guard | Build failure saat SSR | `use-dark-mode.ts` |
| **H-07** | UI-FASE6 | Header online indicator hardcoded `true` — tidak ada actual check | User miskonsepsi koneksi | `header.tsx` |
| **H-08** | UI-FASE6 | Kas status banner di dashboard tidak reaktif terhadap signal | Stale UI state | `dashboard.tsx` |
| **H-09** | UI-FASE6 | Cart change → entire product list re-render (no memoization) | Performa degrade | `pos.tsx` |
| **H-10** | UI-FASE6 | Void transaction tanpa authorization gate — siapa saja bisa void | Security risk | `pos.tsx` |
| **H-11** | UI-FASE6 | `children` typed `any` di main-layout | Type safety gap | `main-layout.tsx` |
| **H-12** | UI-FASE6 | Document click + keyboard listeners tanpa cleanup di main-layout | Memory leak | `main-layout.tsx` |
| **H-13** | UI-FASE5 | `use-keyboard-shortcuts`: `setInterval` 60d tidak cleanup di RevokedLockScreen | Memory leak + state corruption | `license/ui.tsx` |
| **H-14** | UI-FASE5 | Fullscreen API tanpa try-catch | Unhandled exception | `use-keyboard-shortcuts.ts` |
| **H-15** | UI-FASE5 | `_trapFocus`: `first?.focus()` bisa throw jika tidak ada focusable element | A11y crash | `modal.tsx` |

### 1.3 MEDIUM Issues (行动有计划)

**Kelompok A: No Loading/Error States (12 issues)**

| ID | Audit | Deskripsi | File |
|----|-------|-----------|------|
| M-01 | UI-FASE6 | Settings: save tanpa loading state | `settings.tsx` |
| M-02 | UI-FASE6 | Settings: save tanpa try/catch | `settings.tsx` |
| M-03 | UI-FASE6 | Finance: openKas/closeKas tanpa loading state | `finance.tsx` |
| M-04 | UI-FASE6 | Dashboard: openKas/closeKas tanpa loading state | `dashboard.tsx` |
| M-05 | UI-FASE6 | Reports: tidak ada loading indicator | `reports.tsx` |
| M-06 | UI-FASE6 | POS: barcode scan tanpa error feedback | `pos.tsx` |
| M-07 | UI-FASE6 | MobileMenuSheet: license activation tanpa success/error UI | `mobile-menu-sheet.tsx` |
| M-08 | UI-FASE6 | MobileMenuSheet: dark mode toggle tanpa loading state | `mobile-menu-sheet.tsx` |
| M-09 | UI-FASE6 | Auth-layout: login tanpa loading state | `auth-layout.tsx` |
| M-10 | UI-FASE6 | POS: quick cash buttons stale saat modal terbuka | `pos.tsx` PaymentModal |
| M-11 | UI-FASE5 | ActivationModal tanpa loading spinner yang jelas | `license/ui.tsx` |
| M-12 | UI-FASE6 | Toast dan ConfirmDialog di-render sekaligus (no lazy mount) | `main-layout.tsx` |

**Kelompok B: No Empty/Validation States (7 issues)**

| ID | Audit | Deskripsi | File |
|----|-------|-----------|------|
| M-13 | UI-FASE6 | Finance: kas closed = layar kosong tanpa konteks | `finance.tsx` |
| M-14 | UI-FASE6 | Reports: report kosong tanpa empty state UI | `reports.tsx` |
| M-15 | UI-FASE6 | POS: held orders kosong tanpa "Tidak ada held order" | `pos.tsx` |
| M-16 | UI-FASE6 | POS: voucher invalid tanpa feedback | `pos.tsx` |
| M-17 | UI-FASE6 | Settings: taxRate tanpa validasi range | `settings.tsx` |
| M-18 | UI-FASE6 | POS: qty bisa 0 atau negatif tanpa validasi | `numpad-panel.tsx`, `pos.tsx` |
| M-19 | UI-FASE6 | Finance: kasTransactions filter type string literal prone to typo | `finance.tsx` |

**Kelompok C: Performance / Render Issues (8 issues)**

| ID | Audit | Deskripsi | File |
|----|-------|-----------|------|
| M-20 | UI-FASE6 | `Math.max(...salesReport.map())` spread array dinamis — tidak di-memoize | `reports.tsx` |
| M-21 | UI-FASE6 | Finance: 4 tab semua di-render sekaligus (no lazy mount) | `finance.tsx` |
| M-22 | UI-FASE6 | Settings: 3 tab semua di-render sekaligus | `settings.tsx` |
| M-23 | UI-FASE6 | Visible nav items tidak di-memoize | `sidebar.tsx`, `mobile-menu-sheet.tsx` |
| M-24 | UI-FASE6 | Numpad quick cash amounts tidak di-memoize | `numpad-panel.tsx` |
| M-25 | UI-FASE6 | POS: numpad mode switch langsung reset input tanpa konfirmasi | `numpad-panel.tsx` |
| M-26 | UI-FASE5 | `handlers` object sebagai useEffect dependency — re-attaches setiap render | `use-keyboard-shortcuts.ts` |
| M-27 | UI-FASE5 | Dynamic import `preact` setiap openModal — no caching | `modal.tsx` |

**Kelompok D: Logic / Data Consistency (7 issues)**

| ID | Audit | Deskripsi | File |
|----|-------|-----------|------|
| M-28 | UI-FASE6 | Finance: `new Date().toISOString().slice(0,10)` duplikat 3x — DRY violation | `finance.tsx` |
| M-29 | UI-FASE6 | Finance: Date formatting manual — potensi off-by-one timezone | `finance.tsx` |
| M-30 | UI-FASE6 | Finance: Void tanpa audit trail authorisasi | `finance.tsx` |
| M-31 | UI-FASE6 | POS: held order restore tanpa validasi product masih ada | `pos.tsx` |
| M-32 | UI-FASE6 | POS: CustomerPicker muncul setiap page load | `pos.tsx` |
| M-33 | UI-FASE6 | POS: applyInput mixed behavior (cash=set, qty=write langsung) | `numpad-panel.tsx` |
| M-34 | LOGIC-FLOW | Void tidak restore voucher state | `order-service.ts` |

**Kelompok E: UI/UX Issues (10 issues)**

| ID | Audit | Deskripsi | File |
|----|-------|-----------|------|
| M-35 | UI-FASE6 | MobileMenuSheet tanpa backdrop — tap accidental | `mobile-menu-sheet.tsx` |
| M-36 | UI-FASE6 | MobileMenuSheet logout tanpa konfirmasi | `mobile-menu-sheet.tsx` |
| M-37 | UI-FASE6 | MobileMenuSheet tanpa close button visual (X) | `mobile-menu-sheet.tsx` |
| M-38 | UI-FASE6 | Toast tanpa stack limit — 100 toast = 100 DOM nodes | `main-layout.tsx` |
| M-39 | UI-FASE6 | Toast bottom-left overlap bottom-nav mobile (64px) | `main-layout.tsx` |
| M-40 | UI-FASE6 | Dark mode toggle duplicate di header + sidebar | `header.tsx`, `sidebar.tsx` |
| M-41 | UI-FASE6 | POS: 5+ modal signals terpisah — no z-index management | `pos.tsx` |
| M-42 | UI-FASE6 | POS: F9 shortcut ambiguous (comment vs body beda) | `pos.tsx` |
| M-43 | UI-FASE6 | POS: F1 (Clear) tanpa konfirmasi — accidental data loss | `pos.tsx` |
| M-44 | UI-FASE6 | Header: `window.innerWidth` check di onClick — tidak reactive | `header.tsx` |

**Kelompok F: Data Persistence Issues (6 issues)**

| ID | Audit | Deskripsi | File |
|----|-------|-----------|------|
| M-45 | LOGIC-FLOW | `flushTimer` tidak cleanup saat page unload | `sync-engine.ts` |
| M-46 | LOGIC-FLOW | `kvSet` fire-and-forget tanpa error handling | `sync-engine.ts` |
| M-47 | LOGIC-FLOW | Cart clear sync, persist async — gap memungkinkan duplikat order | `order-service.ts` |
| M-48 | LOGIC-FLOW | activeShift restore tidak check date — shift kemarin masih terbuka | `app-state.ts` |
| M-49 | LOGIC-FLOW | InitLocalData dipanggil ulang on refresh — signal di-overwrite | `app-state.ts` / login flow |
| M-50 | UI-FASE5 | `window.location.reload()` untuk license recovery — kill state | `license/ui.tsx` |

### 1.4 LOW Issues (~35 findings)

Detail lengkap di masing-masing file audit. Ringkasan:

- **UI Consistency:** PPN 11% hardcoded di receipt, WA_SUPPORT hardcoded, `DENOMINATIONS` duplikat tidak di-deduksi, toast duration 3000ms hardcoded, paper size/type string literal tanpa validasi
- **Input Validation:** Decimal numpad bisa input `0.5.5.5`, numeric overflow tidak di-handle, locale hardcoded `'id-ID'` di quick cash
- **A11y:** Icon sizing vs text mismatch, tooltip/truncation tanpa title attribute, active route exact match only, auth gradient tanpa fallback
- **Bundle Size:** 80+ icons di-load upfront, tidak ada lazy loading
- **Memory Leak (minor):** `setTimeout` 120ms di numpad-key tanpa cleanup, orphaned Promise di `showConfirm()`
- **Maintenance:** visibleItems exported tapi tidak di-test, activeShift recompute implicit, bottom-nav items hardcoded tidak dari centralized nav config

---

## BAGIAN 2: WORK STREAMS (PARALEL)

### Work Stream A: CRITICAL Data Loss — minggu 1-2

```
STREAM A: Data Loss Prevention
├── A1: POS held orders → localStorage persistence
│   File: pos.tsx, app-state.ts
│   Issue: C-05
│   Solusi: Pakai existing `effect(() => kvSet("pos_held", heldOrders))` pattern
│           yang sudah ada di initLocalData. Tapi heldOrders saat ini dari 
│           useSignal([]) bukan dari kvGet restore.
│           Fix: heldOrders init dari kvGet("pos_held") ?? []
│
├── A2: Loyalty transactions → persist
│   File: loyalty-service.ts
│   Issue: C-02
│   Solusi: Di addPoints() dan redeemPoints(), tambah:
│           localDb.put("loyalty_transactions", tx)
│           enqueue("loyalty_transactions", "upsert", tx.id, tx)
│           BUT: Schema belum ada tabel loyalty_transactions
│           Fix: Buat migration + fix service
│
├── A3: Order number atomic increment
│   File: app-state.ts, order-service.ts
│   Issue: C-01
│   Solusi: Pakai navigator.locks API atau IDB transaction
│           Ganti read-modify-write dengan atomic counter
│
└── A4: Pull merge instead of replace
    File: sync-engine.ts, hydrate.ts
    Issue: C-03, C-04
    Solusi: Flush outbox SEBELUM pull, ATAU implement merge strategy
            (local + server = union, conflict = server wins + notify)
```

### Work Stream B: Memory Leaks — minggu 1-2

```
STREAM B: Memory Leak Prevention
├── B1: POS F1-F10 keyboard shortcuts → add cleanup
│   File: pos.tsx
│   Issue: C-06
│   Solusi: useEffect return () => removeEventListener('keydown', handler)
│
├── B2: main-layout document listeners → add cleanup
│   File: main-layout.tsx
│   Issue: H-12
│   Solusi: useEffect return cleanup functions untuk:
│           - document.addEventListener('click', closeMenu)
│           - document.addEventListener('keydown', handleGlobalKeys)
│
├── B3: license RevokedLockScreen setInterval → cleanup
│   File: license/ui.tsx
│   Issue: H-13
│   Solusi: Simpan timer di useRef, clearInterval di useEffect return
│
└── B4: use-dark-mode SSR guard
    File: use-dark-mode.ts
    Issue: H-06
    Solusi: if (typeof window === 'undefined') return
            Atau pakai useVisibleTask dari @preact/signals
```

### Work Stream C: Sync Reliability — minggu 2-3

```
STREAM C: Sync Engine Reliability
├── C1: Outbox chunk error handling
│   File: sync-engine.ts
│   Issue: H-03
│   Solusi: Ganti bulk upsert 100 → chunk 10 dengan per-record try/catch
│           Gagal 1 dari 10, 9 lainnya tetap tersync
│
├── C2: Sync error → UI notification
│   File: sync-engine.ts, toast.tsx or notification-panel.tsx
│   Issue: H-04
│   Solusi: Buat syncStatus signal (idle/syncing/error)
│           Tampilkan error banner saat flush() catch
│
├── C3: Voucher atomic validation
│   File: voucher-service.ts
│   Issue: H-05
│   Solusi: Gabung validateVoucher + applyVoucher jadi satu atomic method
│           Atau pakai optimistic lock dengan version field
│
└── C4: Promo usageCount increment
    File: promo-service.ts, order-service.ts
    Issue: H-02
    Solusi: applyVoucher(): usageCount++
            voidOrder(): usageCount-- (jika order pakai promo)
```

### Work Stream D: Quick Cash & Modal Stack — minggu 3

```
STREAM D: Business Logic Consistency
├── D1: Quick cash → single source of truth
│   Files: pos.tsx, numpad-panel.tsx
│   Issue: H-01 (CRITICAL inconsistency)
│   Solusi:
│   Buat shared utility: utils/cash-calculator.ts
│   export function getQuickCashAmounts(total: number): number[]
│   Semua 3 tempat import dari ini saja
│
├── D2: Modal stack manager
│   File: pos.tsx, main-layout.tsx
│   Issue: M-41
│   Solusi: Buat useModalStack() hook
│          Semua modal di POS pakai hook ini
│           Auto z-index management
│
└── D3: PaymentModal mixed parseInt/parseFloat → unified
    File: pos.tsx PaymentModal
    Issue: M-09 (UI-FASE6 P9)
    Solusi:统一 pakai parseFloat untuk amount dan change
```

### Work Stream E: UI/UX Polish — minggu 3-4

```
STREAM E: UI/UX Polish
├── E1: Loading states everywhere
│   Files: settings.tsx, finance.tsx, dashboard.tsx, reports.tsx,
│         pos.tsx, auth-layout.tsx, mobile-menu-sheet.tsx
│   Issues: M-01, M-02, M-03, M-04, M-05, M-06, M-08, M-09, M-11
│   Solusi: Buat reusable LoadingButton component
│           Tiap async action kasih isLoading signal
│
├── E2: Empty states everywhere
│   Files: finance.tsx (kas closed), reports.tsx (no data),
│         pos.tsx (held orders), products.tsx
│   Issues: M-13, M-14, M-15
│   Solusi: Pasang conditional "Tidak ada data" UI di map() calls
│
├── E3: Error boundaries
│   Files: semua pages
│   Issue: M-02 (settings), H-15 (modal trap)
│   Solusi: Preact error boundary wrapper component
│
├── E4: Toast improvements
│   Files: main-layout.tsx, toast.tsx
│   Issues: M-38, M-39
│   Solusi:
│   - Max 3 toast visible (queue + dismiss oldest)
│   - Bottom-left → bottom-center dengan margin bottom: 80px
│
└── E5: Confirmation dialogs
    Files: pos.tsx (F1 clear, void, logout), mobile-menu-sheet.tsx
    Issues: M-36, M-43
    Solusi: Pakai existing showConfirm() dari confirm-dialog.tsx
```

### Work Stream F: Type Safety & Architecture — minggu 4-5

```
STREAM F: Type Safety & Code Quality
├── F1: children prop typed any → proper interface
│   File: main-layout.tsx
│   Issue: H-11
│   Solusi: type Props = { children: ComponentChildren }
│
├── F2: String literal types → proper enums
│   Files: finance.tsx (kas type), settings.tsx (printer config),
│         stock types
│   Issue: M-19
│   Solusi: Buat src/data/types/ untuk semua union type
│
├── F3: Fullscreen API try-catch
│   File: use-keyboard-shortcuts.ts
│   Issue: H-14
│   Solusi: Wrap requestFullscreen/exitFullscreen dalam try-catch
│
├── F4: useKeyboardShortcuts handlers dependency
│   File: use-keyboard-shortcuts.ts
│   Issue: M-26
│   Solusi: Extract handlers ke useCallback, atau accept flags object
│
└── F5: Dynamic import caching
    File: modal.tsx
    Issue: M-27
    Solusi: Simpan preactRender di module-level variable
```

### Work Stream G: Navigation & Routing — minggu 4-5

```
STREAM G: Navigation Fixes
├── G1: bottom-nav POS null → proper POS render
│   File: bottom-nav.tsx, pos.tsx
│   Issue: C-07
│   Solusi: POS page bottom-nav punya 'POS' tab aktif tapi POS 
│           page sendiri register fullscreen mode
│           bottom-nav tetap show tabs dengan active state POS
│
├── G2: Sidebar/header dark mode toggle → single instance
│   Files: sidebar.tsx, header.tsx
│   Issue: M-40
│   Solusi: DarkModeSync component di main-layout,
│           hapus toggle dari sidebar DAN header
│
├── G3: Online indicator → actual connectivity check
│   File: header.tsx
│   Issue: H-07
│   Solusi: window.addEventListener('online', 'offline', update signal)
│
└── G4: Active route detection → parent/child relationship
    Files: sidebar.tsx, bottom-nav.tsx
    Issue: SB-05 (UI-FASE6), BN-04 (UI-FASE6)
    Solusi: nav.href.startsWith(currentPath) untuk active state
            Atau pakai path-to-regexp untuk nested routes
```

### Work Stream H: Date/Utility Centralization — minggu 5-6

```
STREAM H: Utility Centralization
├── H1: Date utilities → single file
│   Files: finance.tsx, reports.tsx
│   Issues: M-28, M-29, R-03
│   Solusi: src/utils/date.ts
│   export function todayISO(): string
│   export function formatDateID(iso: string): string
│   export function parseDate(iso: string): Date
│
├── H2: Kas status reactive banner
│   File: dashboard.tsx
│   Issue: H-08
│   Solusi: Pakai useSnapshot(kasStatus) di component
│           Banner reaktif otomatis saat signal berubah
│
├── H3: Decimal input validation di numpad
│   File: numpad-panel.tsx
│   Issues: M-18, NP-04, NP-05
│   Solusi: Validasi format: hanya satu decimal point,
│           max 2 digit desimal, no overflow
│
└── H4: Quick cash amounts → memoize
    File: numpad-panel.tsx, pos.tsx PaymentModal
    Issues: M-20, M-24
    Solusi: useMemo(() => getQuickCashAmounts(total), [total])
```

---

## BAGIAN 3: SPRINT ROADMAP

### Sprint 0 — Emergency Patch (Day 1-2)
**Goal:** Prevent data loss dan fix dead UI state
```
Day 1:
□ C-07: bottom-nav POS null → fix immediate (5 menit)
□ C-06: POS keyboard shortcuts → add cleanup (15 menit)
□ H-12: main-layout document listeners → add cleanup (15 menit)

Day 2:
□ C-05: POS held orders → persist to kvGet/kvSet (1 jam)
□ B4: use-dark-mode → SSR guard (15 menit)
□ H-07: online indicator hardcoded → remove or make reactive (15 menit)
```

### Sprint 1 — Data Integrity (Week 1-2)
**Goal:** Fix all CRITICAL data loss issues
```
□ C-01: Order number atomic increment
□ C-02: Loyalty transactions persist
□ C-03: Pull merge instead of replace
□ C-04: Pull + pending outbox conflict handling
□ A1:  Held orders persistence (dari Stream A)
□ A2:  Loyalty persist (dari Stream A)
□ A3:  Order number atomic (dari Stream A)
□ A4:  Pull merge (dari Stream A)
□ B1:  POS keyboard cleanup (dari Stream B)
□ B2:  main-layout cleanup (dari Stream B)
□ B3:  RevokedLockScreen setInterval cleanup (dari Stream B)
□ B4:  use-dark-mode SSR guard (dari Stream B)
□ H-13: use-keyboard-shortcuts setInterval cleanup
□ H-14: fullscreen try-catch
□ H-15: _trapFocus null check
```

### Sprint 2 — Sync & Promo (Week 2-3)
**Goal:** Reliable cloud sync + promo accuracy
```
□ H-03: Outbox chunk error handling (chunk 100 → 10)
□ H-04: Sync error → UI notification
□ H-05: Voucher atomic validation
□ H-02: Promo usageCount increment
□ C1:   Outbox chunk handling (dari Stream C)
□ C2:   Sync error notification (dari Stream C)
□ C3:   Voucher atomic (dari Stream C)
□ C4:   Promo usageCount (dari Stream C)
□ F-47: Cart clear/gap handling
□ F-45: flushTimer cleanup
□ F-46: kvSet error handling
```

### Sprint 3 — Business Logic (Week 3-4)
**Goal:** Fix incorrect business logic
```
□ H-01: Quick cash single source of truth (CRITICAL inconsistency)
□ M-41: Modal stack manager
□ D3:   PaymentModal unified parseFloat
□ M-28: Finance date duplication → centralized date util
□ R-03: Reports date inconsistency
□ M-30: Finance void audit trail
□ M-31: Held order restore validation
□ M-32: CustomerPicker every load → persist choice
□ H1:   Date utilities centralization (dari Stream H)
□ D1:   Quick cash unified (dari Stream D)
□ D2:   Modal stack (dari Stream D)
□ D3:   PaymentModal float (dari Stream D)
□ H-02: Kas status reactive (dari Stream H)
□ H-03: Decimal validation numpad (dari Stream H)
□ H-04: Quick cash memoize (dari Stream H)
```

### Sprint 4 — UI/UX Polish (Week 4-5)
**Goal:** Professional user experience
```
□ M-01: Settings loading state
□ M-03: Finance loading state
□ M-04: Dashboard loading state
□ M-05: Reports loading state
□ M-06: POS barcode error feedback
□ M-08: MobileMenuSheet dark mode loading
□ M-09: Auth login loading
□ M-11: ActivationModal loading spinner
□ M-12: Toast/ConfirmDialog lazy mount
□ M-13: Finance empty state (kas closed)
□ M-14: Reports empty state
□ M-15: POS held orders empty state
□ M-35: MobileMenuSheet backdrop
□ M-36: MobileMenuSheet logout confirm
□ M-37: MobileMenuSheet close button
□ M-38: Toast stack limit (max 3)
□ M-39: Toast margin bottom
□ M-43: POS F1 clear confirm
□ E1:   Loading states (dari Stream E)
□ E2:   Empty states (dari Stream E)
□ E3:   Error boundaries (dari Stream E)
□ E4:   Toast improvements (dari Stream E)
□ E5:   Confirmation dialogs (dari Stream E)
```

### Sprint 5 — Type & Nav (Week 5-6)
**Goal:** Type safety + proper navigation
```
□ H-11: children prop typed
□ F2:   String literals → enums
□ M-19: Finance kas type enum
□ M-18: POS qty validation
□ M-19: printerConfig string literals
□ M-16: Voucher validation feedback
□ M-17: Tax rate range validation
□ G1:   bottom-nav POS fix (kembali dicek setelah Sprint 1)
□ G2:   Dark mode single toggle
□ G3:   Online connectivity check
□ G4:   Active route parent/child
□ F1:   children typed (dari Stream F)
□ F2:   Enums (dari Stream F)
□ F3:   Fullscreen try-catch (dari Stream F)
□ F4:   useKeyboardShortcuts handlers (dari Stream F)
□ F5:   Dynamic import caching (dari Stream F)
□ G1:   bottom-nav POS (dari Stream G)
□ G2:   Dark mode single (dari Stream G)
□ G3:   Online check (dari Stream G)
□ G4:   Active route (dari Stream G)
```

### Sprint 6 — Polish & Low Priority (Week 6-8)
**Goal:** Resolve remaining LOW issues
```
□ L1:  PPN 11% hardcoded → config
□ L2:  WA_SUPPORT hardcoded → config
□ L3:  Toast duration config
□ L4:  DENOMINATIONS deduplication
□ L5:  Icon lazy loading
□ L6:  Tooltip title attributes
□ L7:  Icon/text sizing alignment
□ L8:  Auth gradient fallback
□ L9:  Receipt PPN config
□ L10: Low stock threshold → config (dashboard + reports)
□ L11: Report period custom range
□ L12: ProductCard stock threshold config
□ L13: Held order stale price restore warning
□ L14: POS checkout disabled visual clarity
□ L15: Numpad prop drilling → context or state management
□ L16: MobileMenuSheet grid alignment
□ L17: MobileMenuSheet user session indicator
□ L18: Sidebar collapse expand UX
□ L19: Sidebar user section → dropdown
□ L20: ConfirmDialog orphaned promise timeout
□ L21: Numpad-key setTimeout cleanup
□ L22: App initialization effect debounce
□ L23: Seed data ID verification
□ L24: Settings unsaved changes warning
□ L25: Payment modal timeout
□ L26: POS held orders UI naming consistency
□ L27: Locale hardcoded 'id-ID' → system locale
□ L28: Reports lowStockThreshold hardcoded → config
□ L29: PaymentModal useEffect total dependency (stale closure)
□ L30: LicenseStatusChip vs LicenseStatusBar inconsistency
□ L31: InitLocalData called on every refresh (state overwrite)
□ L32: activeShift tidak check date (shift kemarin terbuka)
□ L33: window.location.reload license recovery → soft re-render
□ L34: BottomNav POS fullscreen = dead UI (recheck setelah G1)
□ L35: Promo usageCount display vs actual (UI only, sudah fixed di C4)
```

---

## BAGIAN 4: DEPENDENCY GRAPH

```
Sprint 0 (EMERGENCY) — tidak tergantung sprint lain
    └─ C-07, C-06, H-12, C-05, B4, H-07

Sprint 1 (DATA INTEGRITY) — setelah Sprint 0
    ├─ C-01 depends on: (nothing — foundational)
    ├─ C-02 depends on: schema migration (loyalty_transactions table)
    ├─ C-03 depends on: C-01 (atomic ops prerequisite)
    ├─ C-04 depends on: C-03
    └─ B1-B4 depends on: (nothing — isolated)

Sprint 2 (SYNC) — setelah Sprint 1
    ├─ H-03 depends on: (nothing — isolated)
    ├─ H-04 depends on: toast/notification component ready
    ├─ H-05 depends on: C-01 (atomic voucher ops)
    └─ H-02 depends on: (nothing)

Sprint 3 (BUSINESS LOGIC) — setelah Sprint 2
    ├─ H-01 depends on: nothing (isolated)
    ├─ M-41 depends on: nothing (isolated but HIGH value)
    ├─ D3 depends on: H-01 (quick cash unified)
    ├─ H1 depends on: nothing (isolated)
    └─ M-28 depends on: H1 (date util must exist first)

Sprint 4 (UX) — setelah Sprint 3 (date util ready)
    ├─ All loading states: isolated per-page
    ├─ Toast stack: depends on toast component exists
    └─ Empty states: depends on date util (H1)

Sprint 5 (TYPE & NAV) — after Sprint 1 (clean data layer)
    ├─ F2 (enums): depends on (nothing)
    ├─ G2: depends on F1 (children typed first)
    ├─ G3: depends on (nothing)
    └─ G4: depends on (nothing)

Sprint 6 (POLISH) — independent
    └─ All LOW issues isolated
```

---

## BAGIAN 5: TESTING STRATEGY

### Unit Testing
- **Services:** Order number atomic, loyalty persist, promo usageCount
- **Utilities:** getQuickCashAmounts consistency, date formatting
- **Hooks:** useDarkMode SSR, useKeyboardShortcuts cleanup

### Integration Testing
- POS flow: add item → held order → refresh → restore
- Loyalty flow: earn points → refresh → points still there
- Sync flow: offline create → online → data in Supabase
- Pull flow: server data exists → pull → local data merged

### QA Checklist (per sprint)
```
Sprint 0:
□ bottom-nav POS visible and clickable
□ keyboard shortcuts registered and cleaned up on unmount
□ held orders persist after hard refresh
□ dark mode toggle works without SSR crash
□ online indicator shows actual status

Sprint 1:
□ order numbers always unique across 3 concurrent tabs
□ loyalty history survives page refresh
□ pull from server merges, not replaces local offline data
□ no console error on page unload (memory leaks fixed)

Sprint 2:
□ voucher cannot be used twice concurrently
□ promo usageCount accurate after apply + void
□ outbox chunk: 1 bad row doesn't block 99 good rows
□ sync error shows notification to user

Sprint 3:
□ quick cash amounts identical from all 3 entry points
□ date formatting consistent across finance + reports
□ payment modal shows correct change (no truncation)

Sprint 4:
□ all buttons show loading state during async action
□ empty states show proper messages
□ toast does not overlap bottom nav on mobile
□ no more than 3 toasts visible simultaneously

Sprint 5:
□ TypeScript compilation: no implicit any
□ navigation active state correct for parent/child routes
□ dark mode toggle: one place only

Sprint 6:
□ PPN configurable
□ low stock threshold configurable
□ period report: custom range option available
```

---

## BAGIAN 6: FILE AFFECTED MAP

```
src/
├── ui/
│   ├── pages/
│   │   ├── pos.tsx                  → Stream A(C-05,C-06), B(B1), D(H-01,D3), E(all loading), G(G1)
│   │   ├── finance.tsx              → Stream E(loading), H(H1,M-28,M-30)
│   │   ├── dashboard.tsx           → Stream E(loading), H(H-02)
│   │   ├── reports.tsx             → Stream E(loading), H(H1,M-28)
│   │   ├── settings.tsx           → Stream E(loading), F(F2), F1(children)
│   │   ├── login.tsx               → Stream E
│   │   ├── products.tsx            → Stream E(empty state)
│   │   └── ...
│   ├── templates/
│   │   ├── main-layout.tsx         → Stream B(B2), E(M-38,M-39), F(F1)
│   │   └── auth-layout.tsx        → Stream E(M-09)
│   ├── organisms/
│   │   ├── numpad-panel.tsx        → Stream D(H-01), H(H-03,H-04)
│   │   ├── mobile-menu-sheet.tsx  → Stream E(M-07,M-08), G(G2)
│   │   ├── sidebar.tsx            → Stream E(M-40), G(G2,G4)
│   │   ├── header.tsx             → Stream G(G2,G3,G4)
│   │   └── bottom-nav.tsx         → Stream A(C-07), G(G1,G4)
│   ├── molecules/ (minor changes)
│   └── atoms/ (minor changes)
├── logic/
│   ├── hooks/
│   │   ├── use-dark-mode.ts        → Stream B(B4)
│   │   └── use-keyboard-shortcuts.ts → Stream B(H-13,H-14), F(F3,F4)
│   └── services/
│       ├── order-service.ts       → Stream A(C-01), C(C4), F(F-47)
│       ├── loyalty-service.ts      → Stream A(C-02)
│       ├── sync-engine.ts         → Stream C(H-03,H-04)
│       ├── voucher-service.ts     → Stream C(H-05)
│       ├── promo-service.ts       → Stream C(H-02)
│       ├── finance-service.ts     → Stream F(F-47)
│       └── license/
│           └── ui.tsx             → Stream B(H-13), F(F-50)
├── data/
│   └── types/
│       └── finance.ts             → Stream F(F2), M(M-19)
└── utils/
    └── date.ts                    → Stream H(H1)

SUPABASE:
└── supabase/migrations/
    └── add_loyalty_transactions.sql → Stream A(C-02)
```

---

## BAGIAN 7: UKURAN UKURAN KEBERHASILAN

```
METRIC                          | BEFORE | TARGET | MEASURE
--------------------------------|--------|--------|------------------
Critical issues remaining       |   7    |   0    | Manual audit
High issues remaining           |   15   |   0    | Manual audit
Memory leaks (console error)    |   4    |   0    | Chrome DevTools
Data loss on refresh (held ord)|  YES   |   NO   | Manual test
Sync failure UI notification    |   NO   |  YES   | Manual test
Quick cash algorithm的一致性 |  3 ALGO | 1 ALGO | Code review
Loading states coverage         |   0%   | 100%   | QA checklist
TypeScript implicit any         |  MANY  |   0    | tsc --strict
```

---

*Plan ini menggabungkan 3 audit file (AUDIT-UI-FASE5.md, AUDIT-UI-FASE6.md, AUDIT-LOGIC-FLOW.md) menjadi satu roadmap komprehensif. Estimate: 8 minggu untuk 1 developer. Dengan 2 developer paralel: bisa dimangkas jadi 4-5 minggu.*
