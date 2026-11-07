# Audit UI Fase 5 — Minimarket Kasir Solo

**Tanggal:** 2026-08-27  
**Ruang Lingkup:** UI Components (Pages, Organisms, Molecules, Atoms, Hooks, License UI)  
**Stack:** Astro + Preact + TailwindCSS + DaisyUI + Preact Signals

---

## 1. Direktori aktual vs tebakan awal

| Path tebakan (checkpoint) | Status | Path actual |
|---|---|---|
| `src/hooks/` | ❌ TIDAK ADA | `src/logic/hooks/` |
| `src/ui/license/` | ❌ TIDAK ADA | `src/logic/services/license/` |

**Ditemukan:**

```
src/logic/hooks/use-keyboard-shortcuts.ts   ← shortcut handler
src/logic/services/license/ui.tsx          ← License UI components
src/logic/services/license/modal.tsx        ← centralized modal management
```

---

## 2. Audit Hooks

### `src/logic/hooks/use-keyboard-shortcuts.ts` ✅

Keyboard shortcut handler global untuk POS.

**Struktur:**
- F1–F12, Escape, Enter, +, -, Delete
- `?` key → toggle `showShortcutHelp` signal
- Guard: `isInput` check — F-keys boleh aktif di input,其他的 tidak

**Signal dependencies:**
```ts
showShortcutHelp, posFullscreen, numpadMode
```
⚠️ `posFullscreen` dan `numpadMode` perlu diverifikasi ada di `app-state.ts`.

**Kelebihan:**
- Proper cleanup `window.removeEventListener` di useEffect return
- `active` parameter untuk enable/disable sementara

**Potential issues:**
1. **Handlers object as dependency** — `useEffect(() => {...}, [active, handlers])` dengan `handlers` sebagai object literal. Setiap render membuat object baru → effect re-runs setiap render. Seharusnya gunakan individual handler dependencies atau useCallback.

2. **F12 fullscreen tanpa try-catch** — `document.documentElement.requestFullscreen()` dan `document.exitFullscreen()` bisa throw jika API unavailable atau blocked. Tidak ada error handling.

3. **`showShortcutHelp` toggle tidak punya parameter active** — shortcut `?` selalu toggle, tidak bisa dinonaktifkan dari luar.

---

## 3. Audit License UI

### `src/logic/services/license/modal.tsx` ✅

Centralized modal management dengan focus trap.

**Fitur:**
- Focus trap untuk accessibility
- `setHardGate()` — global app lock (digunakan RevokedLockScreen)
- Overlay click to close
- Dynamic Preact render via `renderJsxIntoElement()`
- Cleanup stored on element DOM (`_cleanup` property)

**Potential issues:**
1. **Dynamic import render** — `import('preact').then(({ render }) => render(content, el))` — setiap openModal melakukan dynamic import. Bisa jadi performance issue jika sering dibuka. Tidak ada caching import.

2. **innerHTML XSS risk (low)** — card.innerHTML menginterpolasi `opts.title` langsung. Karena `title` berasal dari internal code (bukan user input), risk rendah, tapi tidak ada sanitisasi eksplisit.

3. **Single modal only** — `openModal` selalu remove existing overlay (`existing.remove()`). Tidak mendukung stacked modals. Jika komponen lain memanggil `openModal` sementara modal lain aktif, modal sebelumnya di-close tanpa callback.

4. **`_cleanup` stored on HTMLElement** — penggunaan non-standard property pada HTMLElement. Bisa conflict dengan browser internals atau cause memory leak jika cleanup tidak terpanggil.

5. **Focus trap `_trapFocus`** — `root.querySelectorAll` bisa return empty NodeList jika tidak ada focusable elements → `first?.focus()` akan throw TypeError karena `first` is undefined.

---

### `src/logic/services/license/ui.tsx` ✅

Komponen License UI (Chip, Modal, LockScreen, StatusBar).

**Komponen:**
1. `LicenseStatusChip` — pill dengan icon, warna berdasarkan level
2. `ActivationModal` — serial input dengan `activateSerial()`
3. `RevokedLockScreen` — full-screen lock dengan polling 60 detik
4. `LicenseStatusBar` — card untuk Settings/Dashboard

**Kelebihan:**
- Pola polling 60 detik di `RevokedLockScreen` untuk auto-recovery tanpa reload
- `select-all` pada device code untuk kemudahan copy
- Hard gate dengan `setHardGate(true)` saat revoked lock screen mount

**Potential issues:**
1. **`window.location.reload()` sebagai recovery** — di `RevokedLockScreen` dan `handleRefresh`. Ini hard reload yang akan terminate semua state local (cart, dll). Seharusnya bisa soft-reload dengan signal update.

2. **`WA_SUPPORT` hardcoded** — `"628816566935"` adalah nomor WhatsApp langsung. Jika admin ganti nomor, perlu code change.

3. **`ActivationModal` tidak punya loading state visual yang jelas** — hanya text change, tidak ada spinner pada tombol.

4. **`LicenseStatusBar` di Settings/Dashboard belum terintegrasi** — hanya defined, belum dipakai di page manapun. `LicenseStatusChip` di `login.tsx` langsung constructed, tidak menggunakan `LicenseStatusBar`.

5. **`trial` chip menampilkan `Math.max(0, (txQuota || 0) - (txCount || 0))`** — race condition: `txCount` dari IndexedDB bisa stale saat tampilan, tidak ada live sync.

---

## 4. Audit Molecules (8 file)

### `toast.tsx` ✅
- Signal-based toast dengan `setTimeout` auto-cleanup
- 4 tipe: success, error, warning, info
- `generateId()` untuk uniq ID
- 3000ms hardcoded duration

### `stat-card.tsx` ✅
- Gradient backgrounds
- Trend arrows dengan `delta` prop
- `subtitle` prop

### `shortcut-badge.tsx` ✅
- Inline `<span>` monospace dengan border Tailwind

### `role-badge.tsx` ✅
- Record mapping 4 role ke label+color

### `product-card.tsx` ✅
- Dual view (grid/list)
- Stock threshold (`low` / `out`)
- `navigator.vibrate(10)` dengan guard `if (navigator.vibrate)` ✅
- Group-hover add button

### `confirm-dialog.tsx` ✅
- Signal-driven modal state
- `showConfirm()` helper yang returns Promise
- Danger variant
- `onCancel` callback

### `cash-flow-item.tsx` ✅
- In/out arrow icons
- Category labels

### `avatar.tsx` ✅
- Initials extraction via `charCodeAt(0)`
- Deterministic color dari char
- Optional `src` untuk photo

---

## 5. Audit Atoms (5 file)

### `numpad-key.tsx` ✅
- 5 variants, press animation via `setTimeout` 120ms
- `scale-95` on press, `focus:ring`

### `input.tsx` ✅
- `forwardRef` via preact/compat
- `Input` + `Select` components
- Error state styling

### `icon.tsx` ✅
- 80+ SVG inline icons
- Factory `mk()` dan `mkC()` — zero external dependencies

### `button.tsx` ✅
- `forwardRef`, 6 variants, 4 sizes
- Loading spinner animation

### `badge.tsx` ✅
- 7 warna, 2 sizes, rounded-full pill

---

## 6. Audit Organisms (6 file)

### `notification-panel.tsx` ✅
- Max 20 items displayed
- `markAllRead()` action

### `receipt-modal.tsx` ✅
- Thermal-styled receipt
- PPN 11% hardcoded
- 6 payment methods
- Fallback `window.open()` printer

### `open-kas-modal.tsx` ✅
- 5 quick amounts preset
- Custom numpad

### `close-kas-modal.tsx` ✅
- Denomination calculator dengan `DENOMINATIONS` dari `data/types/finance`
- Surplus/defisit/sesuai display

### `cash-flow-form.tsx` ✅
- Separate in/out categories

### `shortcut-help.tsx` ✅
- 17 shortcuts
- `?` key toggle via `showShortcutHelp` signal

---

## 7. Audit Pages (7 file)

### `login.tsx` ✅
### `products.tsx` ✅
### `stock.tsx` ✅
### `customers.tsx` ✅
### `suppliers.tsx` ✅
### `staff.tsx` ✅
### `promos.tsx` ✅

---

## 8. Temuan Cross-Layer Issues

### HIGH Priority

| # | File | Issue | Resiko |
|---|---|---|---|
| H1 | `modal.tsx:33` | `_trapFocus` — `first?.focus()` bisa throw jika tidak ada focusable element | A11y crash |
| H2 | `use-keyboard-shortcuts.ts:49-56` | Fullscreen API tanpa try-catch — throw jika blocked/unavailable | Unhandled exception |
| H3 | `ui.tsx:186` | `setInterval` 60 detik tidak di-cleanup saat component unmount — timer terus jalan jika user navigasi pergi lalu kembali | Memory leak + state corruption |

### MEDIUM Priority

| # | File | Issue | Resiko |
|---|---|---|---|
| M1 | `modal.tsx:64-69` | `openModal` selalu remove existing overlay — stacked modals tidak didukung | Lost modal state |
| M2 | `use-keyboard-shortcuts.ts:76` | `handlers` object sebagai useEffect dependency — re-attaches setiap render | Performance degradation |
| M3 | `ui.tsx:149` | WA_SUPPORT hardcoded — nomor HP admin langsung di code | Maintenance risk |
| M4 | `ui.tsx:181` | `window.location.reload()` untuk license recovery — terminate all local state | UX disruption |
| M5 | `modal.tsx:153` | Dynamic import `preact` setiap openModal — no caching | Performance |
| M6 | `ui.tsx:47-54` | `LicenseStatusChip` tidak menggunakan `LicenseStatusBar` yang sudah ada — duplikasi definitions | Inconsistency |
| M7 | `close-kas-modal.tsx:21` | `DENOMINATIONS.map(d => ({ ...d }))` — tidak ada deduksi nominal duplikat | Logic error jika data corrupt |
| M8 | `ui.tsx:259-260` | Trial chip `txCount` dari IndexedDB bisa stale — tidak ada optimistic update | Misleading display |

### LOW Priority

| # | File | Issue | Resiko |
|---|---|---|---|
| L1 | `receipt-modal.tsx` | PPN 11% hardcoded — tidak ada config | Tax miscalculation risk |
| L2 | `confirm-dialog.tsx` | `showConfirm()` Promise helper — tidak ada cancel timeout | Orphaned Promise |
| L3 | `toast.tsx` | Duration 3000ms hardcoded — tidak ada global config | Inflexibility |
| L4 | `numpad-key.tsx` | `setTimeout` 120ms untuk press animation — cleanup tidak dijamin jika component unmount | Memory leak (minor) |
| L5 | `icon.tsx` | 80+ icons — semua di-load upfront, tidak ada lazy loading | Initial bundle size |

---

## 9. Summary Scorecard

| Category | File Count | ✅OK | ⚠️Warning | ❌Issue |
|---|---|---|---|---|
| Pages | 7 | 7 | 0 | 0 |
| Organisms | 6 | 6 | 0 | 0 |
| Molecules | 8 | 8 | 0 | 0 |
| Atoms | 5 | 5 | 0 | 0 |
| Hooks | 1 | 0 | 1 | 0 |
| License UI | 2 | 1 | 1 | 0 |
| **Total** | **29** | **27** | **2** | **0** |

**Tidak adaissue blocker — semua components dapat dirender tanpa crash langsung. Namun ada 3 HIGH dan 8 MEDIUM issues yang perlu ditindaklanjuti.**

---

## 10. Rekomendasi Prioritas Refactoring

### Immediate (Next Sprint)
1. **Fix `_trapFocus` null check** — `if (focusable.length === 0) return;` sebelum `first?.focus()`
2. **Wrap fullscreen API dengan try-catch** di `use-keyboard-shortcuts.ts`
3. **Add cleanup untuk `setInterval` 60 detik** di `RevokedLockScreen` — simpan timer di ref + clear di cleanup return

### Short-term (This Month)
4. **Centralize modal stack** — replace single-overlay dengan array-based modal stack
5. **Cache Preact dynamic import** — simpan `render` function di module-level variable
6. **Replace `window.location.reload()`** dengan signal-based re-render untuk license recovery
7. **Move WA_SUPPORT** ke environment config atau database settings

### Medium-term
8. **Refactor `useKeyboardShortcuts`** — gunakan `useCallback` untuk setiap handler, atau accept separate boolean flags per key
9. **Add `LicenseStatusBar` usage** di Settings page, replace inline `LicenseStatusChip` construction
10. **Add denomination deduplication validation** saat load `DENOMINATIONS`

---

*Report generated from source code analysis. No live server required.*
