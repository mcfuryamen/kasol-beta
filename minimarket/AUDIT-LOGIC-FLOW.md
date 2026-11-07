# Audit Logic Flow — Minimarket Kasir Solo

**Tanggal:** 2026-08-27  
**Ruang Lingkup:** Data Flow, Business Logic, State Management, Sync Architecture  
**Stack:** Preact Signals + IndexedDB + Supabase

---

## Sekilas Architecture

```
User Action
    ↓
Service Class (singleton)
    ↓ (sync)  → Signal update (immediate UI)
    ↓ (async) → localDb.put() (fire-and-forget)
    ↓         → enqueue() → outbox → flush() → Supabase
```

Semua write: **local-first**, non-blocking. Sync ke cloud: fire-and-forget dengan outbox queue.

---

## Flow 1: POS Transaction (dari scan sampai receipt)

### Path: scan → payment → persist

```
Scanner/barcode input
    ↓
posService.scanBarcode(barcode) / addToCart(productId)
    → productService.getByBarcode() → validates active product
    → adds to cartItems signal
    ↓
posService.processPayment(method, amountPaid, shiftId?, voucherCode?)
    │
    ├─ 1. Validate: if cash && amountPaid < total → throw
    │
    ├─ 2. Build order object
    │     orderNumber = await nextOrderNumber()  ← RACE CONDITION (lihat F1)
    │     cashierId = currentUser.id
    │     createdAt = new Date().toISOString()
    │
    ├─ 3. ordersSignal.value = [order, ...ordersSignal]
    │
    ├─ 4. persist(order) [ASYNC, non-blocking]
    │     localDb.put("orders", order)
    │     enqueue("orders", "upsert", order)
    │     for each item: enqueue("order_items", "upsert", item)
    │     incrementTxCount() [fire-and-forget]
    │
    ├─ 5. For each item: productService.updateStock(item.productId, -item.qty)
    │     → productsSignal map update (sync)
    │     → localDb.put("products", updated) [fire-and-forget]
    │     → enqueue("products", "upsert", updated)
    │     → if afterStock < 0 → notificationService.add("warning", "Stok Minus")
    │
    ├─ 6. For each item: stockService.addMovement({ type: "sale", qty: item.qty })
    │     → stockMovementsSignal unshift (sync)
    │     → localDb.put("movements", movement) [fire-and-forget]
    │     → enqueue("stock_mutations", "upsert", movement)
    │
    ├─ 7. If customer: customerService.addPoints(pointsEarned, order.id)
    │     → loyaltyTxSignal UNSHIFT (sync)
    │     → customer mutate: points += earned, tier recompute
    │     → localDb.put("customers", updated) [fire-and-forget]
    │     → enqueue("customers", "upsert", updated)
    │     ⚠️ loyaltyTxSignal TIDAK di-persist ke localDb/enqueue! (lihat C1)
    │
    ├─ 8. If customer: customerService.updateSpent(total)
    │     → customer mutate: totalSpent += amount, tier recompute
    │     → localDb.put + enqueue
    │
    └─ 9. clearCart() [SYNC, immediate UI update]
          → cartItems = [], orderDiscount = 0, selectedCustomer = null
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| F1 | **Order number race condition** | CRITICAL | `nextOrderNumber()` adalah read-then-write non-atomic. Dua tab browser concurrent akan dapat nomor sama. Same root cause dengan audit fase 1–4 (#5 Order number race). |
| C1 | **Loyalty transactions tidak persist** | HIGH | `loyaltyTxSignal` di-update setiap `addPoints()`/`redeemPoints()`, tapi **tidak pernah ditulis ke localDb atau di-enqueue**. Refresh/hard reload → semua history poin hilang. Ini penyebab loyalty tidak bisa di-audit. |
| F2 | **Cart clear sync, persist async** | MEDIUM | `clearCart()` dijalankan synchronously di step 9, sementara `persist()` di step 4 masih pending. Jika user close tab antara step 4 dan 9, order tersimpan tapi cart belum clear — duplicate order possible. |
| F3 | **Stock minus notification only warning** | LOW | `afterStock < 0` hanya trigger notification warning. User masih bisa continue transaksi dengan stok minus. Stok minus tetap tercatat tapi tidak ada blokir di POS. |

---

## Flow 2: Kas (Shift) Management

### Path: Open Shift → Daily Operations → Close Shift

```
openKasModal → financeService.openShift(openingBalance, notes?)
    → Shift object built
    → shiftsSignal unshift (sync)
    → activeShift.value = shift (sync)
    → persistOne("shifts", "shifts", shift) [fire-and-forget]

daily cash operations
    → financeService.addCashFlow({ type: "in"/"out", amount, shiftId, ... })
    → cashFlowsSignal unshift (sync)
    → persistOne [fire-and-forget]

closeKasModal → financeService.closeShift(actualCash, notes?)
    → if !activeShift → return null [guard]
    → filter orders: o.shiftId === shiftId AND o.createdAt >= shift.openedAt
    → calculate:
    │   cashSales = orders(cash).reduce total
    │   nonCashSales = orders(non-cash).reduce total
    │   pettyOut = pettyCash.filter(shiftId).reduce amount
    │   cashIn = cashFlows.filter(shiftId, in).reduce amount
    │   cashOut = cashFlows.filter(shiftId, out).reduce amount
    │   expectedCash = openingBalance + cashSales + cashIn - pettyOut - cashOut
    │   difference = actualCash - expectedCash
    → update shiftsSignal.map (status: "closed")
    → activeShift.value = null
    → persistOne [fire-and-forget]
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| F4 | **Time comparison uses string ISO vs Date object** | MEDIUM | `o.createdAt >= shift.openedAt` — `createdAt` adalah ISO string, `openedAt` juga ISO string. String comparison works correctly for ISO 8601 format (lexicographic = chronological). Tapi jika ada timezone mismatch antara browser dan server, bisa subtle error. Tidak ada konsistensi check. |
| F5 | **No shiftId on orders placed before shift open** | LOW | Jika clock browser salah (belakangan), order yang dibuat sebelum `openedAt` akan tetap masuk kalkulasi karena filter `createdAt >= openedAt`. Asumsi: browser clock correct. |
| F6 | **Petty cash tidak punya validasi saldo** | LOW | `addPettyCash` tidak check apakah jumlah exceeds available cash. Kasir bisa input petty cash lebih besar dari saldo kas. |
| F7 | **Closing balance tidak persist ke order** | LOW | `closingBalance`, `expectedCash`, `difference` tidak ditulis ulang ke setiap order. Jika perlu audit trail per order untuk cash reconciliation, tidak tersedia. |

---

## Flow 3: Void & Return

```
voidOrder(orderId, reason, type)
    → find order in ordersSignal
    → if status === "voided" or "returned" → EARLY RETURN (no-op)
    → update ordersSignal.map status → "voided"/"returned"
    → localDb.put + enqueue (order row only, not items)
    → for each item: productService.updateStock(item.productId, +item.qty)
    → for each item: stockService.addMovement({ type: "return" })
    → if customerId: customerService.updateSpent(-order.total)
    → if customerId: customerService.redeemPoints(pointsToReverse)
    → VoidRecord created → voidRecordsSignal → persistOne
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| F8 | **Void/return tidak restore voucher state** | MEDIUM | Jika order menggunakan voucher, `applyVoucher()` sudah mark voucher.used=true. Void tidak membalikkan state voucher — voucher tetap marked used dan tidak bisa dipakai ulang. |
| F9 | **Void tidak men-subtract dari promo usageCount** | MEDIUM | Promo usageCount tidak di-increment saat voucher applied, sehingga void juga tidak perlu decrement. Tapi ini berarti usageCount tidak pernah accurate. |

---

## Flow 4: Promo & Voucher

```
validateVoucher(code, subtotal)
    → find voucher by code.toUpperCase()
    → check: not used, not expired, subtotal >= minPurchase
    → lastVoucherError signal updated on failure
    → return Voucher | null

applyVoucher(voucherId)
    → vouchersSignal.map: used=true, usedAt=now
    → localDb.put + enqueue
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| F10 | **Promo usageCount tidak pernah di-increment** | HIGH | `promoService.add()` sets usageCount=0, `applyVoucher()` tidak touch usageCount. Tidak ada satupun tempat dalam codebase yang increment promo usageCount. usageCount hanya untuk display, tidak pernah akurat. |
| F11 | **Voucher validation race: used check tidak atomic** | MEDIUM | `validateVoucher` dan `applyVoucher`是两个 method terpisah. Dua request concurrent bisa kedua-duanya pass `!v.used` check sebelum salah satu call `applyVoucher`. solusinya: gunakan `.apply()` yang atomic atau optimistic lock. |

---

## Flow 5: Loyalty & Points

```
addPoints(customerId, points, referenceId)
    → loyaltyTxSignal unshift { type: "earn", points, ... }
    → customer mutate: points += points, tier recompute
    → localDb.put + enqueue

redeemPoints(customerId, points)
    → loyaltyTxSignal unshift { type: "redeem", points: -points, ... }
    → customer mutate: points -= points (floor 0)
    → localDb.put + enqueue

updateSpent(customerId, amount)
    → customer mutate: totalSpent += amount, tier recompute, lastVisit updated
    → localDb.put + enqueue
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| C1 | **loyaltyTxSignal tidak di-persist** | CRITICAL | Loyalty transactions hanya ada di memory signal. Tidak ada `localDb.put("loyalty_transactions")` atau `enqueue()`. Setiap refresh → history poin kosong. Dari audit fase 1–4: tidak ada tabel `loyalty_transactions` di schema. |
| F12 | **Tier recompute dari totalSpent setiap mutate** | LOW | Setiap `addPoints`/`redeemPoints`/`updateSpent` recompute tier dari `totalSpent` (bukan dari actual points balance). Ini konsisten tapi implicit. |
| F13 | **Points redemption tidak ada authorization check** | MEDIUM | `redeemPoints` tidak check apakah customer.points >= points yang di-redeem. Hanya `Math.max(0, c.points - points)` — bisa result in negative display if bug. |

---

## Flow 6: Sync Engine (Outbox Queue)

```
enqueue(table, op, recordId, row?)
    → if isDemoMode → return (no-op)
    → outbox.push({ id, table, op, recordId, row, createdAt })
    → if outbox.length > 5000 → slice (FIFO eviction)
    → pendingCount signal update
    → kvSet(OUTBOX_KEY, outbox) [async write to IDB]
    → scheduleFlush()

scheduleFlush()
    → clear existing flushTimer
    → setTimeout(flush, 2000ms)

flush() [called 2s after first enqueue, or on online event]
    → guard: isDemoMode, !isOnline, !hasSession, flushing, outbox empty
    → for each table in TABLE_PRIORITY [order matters for FK]
        → entries = outbox.filter(table)
        → upserts: chunk 100 rows → supabase.upsert(chunk, { onConflict: "id" })
        → deletes: supabase.delete().eq("id", recordId)
        → remove processed entries from outbox
    → lastSyncAt update
    → kvSet(OUTBOX_KEY, outbox)
    → on error: console.warn + scheduleFlush() [retry]
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| F14 | **Outbox chunk: 1 corrupt → 100 rejected** | HIGH | Batch upsert 100 rows per table. Jika 1 row corrupt (e.g., wrong type), seluruh chunk 100 di-reject oleh Supabase. Remaining 99 yang valid tidak ter-sync. |
| F15 | **Flush timer tidak di-cleanup saat page unload** | MEDIUM | `flushTimer` adalah module-level variable. Jika user close tab, pending flush bisa tidak jalan. `beforeunload` event tidak触发 flush. |
| F16 | **Sync error = console.warn only** | HIGH | `flush()` catch block: `console.warn("[sync] flush gagal")`. User tidak mendapat notifikasi UI bahwa sync gagal. Dari audit fase 1–4: confirmed. |
| F17 | **kvSet fire-and-forget tanpa error handling** | MEDIUM | `enqueue()` calls `kvSet()` tanpa await/catch. Jika IDB write gagal, outbox hanya di memory — akan hilang saat page unload. |

---

## Flow 7: Pull (Server → Local)

```
pull() [called on login/boot when online]
    → guard: isDemoMode, !isOnline, !hasSession
    → for each [table, applyFn] in registered pullers
        → data = await supabase.from(table).select("*")
        → applyFn(data.map(toCamel))

registerPuller("products", rows => {
    productsSignal.value = rows;           ← REPLACE (not merge!)
    localDb.bulkPut("products", rows);
});
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| F18 | **Pull REPLACES signal, not merge** | HIGH | Setiap `applyFn` melakukan direct assignment `signal.value = rows`. Data lokal yang tidak ada di server (misalnya: created offline, belum ter-flush) akan hilang setelah pull. Dari audit fase 1–4: confirmed #6 Pull overwrites local. |
| F19 | **Pull overwrite tidak respect pending outbox** | CRITICAL | Jika ada unflushed outbox entries + pull happens, local server data overwrite sinyal + IDB. Outbox entries untuk tabel yang sama akan tetap di outbox dan di-flush, tapi state sudah tidak konsisten. |
| F20 | **No conflict resolution** | MEDIUM | Jika同一 record diedit di dua device, last-write-wins dari Supabase. Tidak ada timestamp-based atau version-based conflict detection. |

---

## Flow 8: App Initialization

```
initLocalData() [called from LoginPage on login]
    │
    ├─ seedIfEmpty("products", seedProducts?, apply)
    │     → localDb.getAll()
    │     → if empty: bulkPut + apply
    │     → else: apply(existing)
    │
    ├─ seedIfEmpty("customers", ...)
    ├─ seedIfEmpty("suppliers", ...)
    ├─ seedIfEmpty("promos", ...)
    ├─ seedIfEmpty("vouchers", ...)
    ├─ seedIfEmpty("orders", ...)
    │
    ├─ shiftsSignal = getAll("shifts")
    ├─ activeShift = shiftsSignal.find(status === "open") ?? null
    ├─ cashFlowsSignal = getAll("cashflows")
    ├─ pettyCashSignal = getAll("pettycash")
    ├─ voidRecordsSignal = getAll("voids")
    ├─ stockMovementsSignal = getAll("movements")
    ├─ stockOpnameSignal = getAll("opnames")
    ├─ batchInfoSignal = getAll("batches")
    │
    ├─ setOrderCounterProvider(async () => {
    │     key = `order_counter_YYYYMMDD`
    │     next = (kvGet(key) ?? 0) + 1   ← RACE CONDITION (F1)
    │     kvSet(key, next)
    │     return next
    │   })
    │
    ├─ Restore UI state from kv:
    │     cartItems, heldOrders, storeSettings, printerConfig
    │
    ├─ effect(() => kvSet("pos_cart", cartItems))   ← auto-save
    ├─ effect(() => kvSet("pos_held", heldOrders))
    ├─ effect(() => kvSet("store_settings", storeSettings))
    ├─ effect(() => kvSet("printer_config", printerConfig))
    │
    └─ registerPuller for each table
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| F1 | **Order counter race** | CRITICAL | Race condition di `setOrderCounterProvider` — read-modify-write tidak atomic. Di-browser tabs concurrent: duplikat order number. Dari audit fase 1–4: confirmed #5. |
| F21 | **activeShift restore dari IDB tidak check date** | MEDIUM | `activeShift.value = shifts.find(s => s.status === "open")`. Jika shift "open" dari hari kemarin (browser crash sebelum close), tidak ada check apakah `openedAt` masih hari ini. User bisa melanjutkan shift lama. |
| F22 | **Effect auto-save tanpa debounce** | LOW | Setiap perubahan cart/held/settings trigger `kvSet()` langsung. Untuk cart dengan banyak item, ini berarti setiap add-to-cart trigger IDB write. |
| F23 | **Seed data tidak memiliki UUID generator** | LOW | Seeds tidak menggunakan `generateId()` dari utils — apakah seed IDs konsisten dengan format app? Perlu dicek di `seeds.ts`. |

---

## Flow 9: License & Auth

```
App mount → getLicenseStatus() → setLicenseStatus()
    → if isHardGateActive() OR licenseStatus.level === 'revoked'
        → <RevokedLockScreen /> [full lock, polling 60s]
    → else if !currentUser
        → <LoginPage />
    → else → MainLayout + PageComponent

LoginPage on mount → initLocalData()
    → Demo mode: load seeds into IDB → signals
    → Online mode: pull() from Supabase → signals
    → Demo login: set demo user → navigate to POS

LoginPage on demo login → currentUser.value = demoUser
    → no license check for demo
```

### Issues

| ID | Finding | Severity | Detail |
|---|---|---|---|
| F24 | **RevokedLockScreen hard reload saat recovery** | MEDIUM | Polling 60s mendeteksi license revived → `window.location.reload()`. Ini kill semua state (cart, held orders, unsaved data). Soft re-render preferred. |
| F25 | **initLocalData di-dispatch tanpa guard** | MEDIUM | `LoginPage` triggers `initLocalData()` on mount. Jika user refresh di halaman lain (dashboard, POS), initLocalData dipanggil ulang — akan overwrite signals dengan IDB data, potensially losing in-memory state. |

---

## Ringkasan Issue per Severity

### CRITICAL (4)

| ID | Flow | Issue |
|---|---|---|
| F1 | Order #, Init | **Order number race condition** — read-modify-write non-atomic via kvGet/kvSet |
| C1 | Loyalty | **Loyalty transactions tidak persist** — loyaltyTxSignal tidak ditulis ke IDB/enqueue |
| F18 | Sync Pull | **Pull REPLACES signal** — overwrite local data yang belum ter-flush |
| F19 | Sync Pull | **Pull overwrite tidak care pending outbox** — state corruption risk |

### HIGH (4)

| ID | Flow | Issue |
|---|---|---|
| F10 | Promo | **Promo usageCount tidak pernah di-increment** |
| F14 | Sync | **Outbox chunk 100: 1 corrupt → 99 valid rejected** |
| F16 | Sync | **Sync error hanya console.warn, user tidak dapat notifikasi** |
| F11 | Voucher | **Voucher validation race: !used check tidak atomic** |

### MEDIUM (11)

| ID | | Issue |
|---|---|---|
| F2 | Cart clear before persist complete |
| F4 | ISO string time comparison — works but fragile |
| F8 | Void tidak restore voucher state |
| F12 | Tier recompute implicit |
| F13 | Points redemption tidak ada authorization check |
| F15 | Flush timer not cleaned up on page unload |
| F17 | kvSet fire-and-forget tanpa error handling |
| F20 | No conflict resolution on concurrent edits |
| F21 | activeShift restore tidak check date |
| F24 | RevokedLockScreen hard reload on recovery |
| F25 | initLocalData dipanggil ulang on refresh — overwrites in-memory state |

### LOW (5)

| ID | | Issue |
|---|---|---|
| F3 | Stock minus hanya warning, tidak blokir |
| F6 | Petty cash tidak ada validasi saldo |
| F7 | Closing balance tidak persist ke order |
| F22 | Effect auto-save tanpa debounce |
| F23 | Seed data IDs perlu di-verify |

---

## Cross-Flow Pattern Analysis

### Pattern: Fire-and-Forget Persistence
Semua service method melakukan `void this.persist()` atau `void localDb.put()`. Ini benar untuk UX (non-blocking), tapi:
- Tidak ada error feedback ke user
- Tidak ada retry mechanism untuk failed writes
- `kvSet` di enqueue juga fire-and-forget (F17)

### Pattern: Signal → localDb → enqueue (tiga langkah)
Setiap write melakukan:
1. Signal update (sync, immediate)
2. `localDb.put()` (async, fire-and-forget)
3. `enqueue()` → outbox (async, fire-and-forget)

Kelememahan: jika step 2 atau 3 gagal, signal tetap update (UI benar) tapi data tidak persist. User tidak tahu.

### Pattern: Replace vs Merge
Pull operations, `hydrate` initialization, dan beberapa service method melakukan direct assignment `signal.value = rows` (replace) bukan merge. Ini kehilangan data lokal yang tidak ada di server.

### Pattern: Optimistic UI
Semua operasi bersifat optimistic — signal diupdate dulu, baru kemudian persist. Jika persist gagal, signal sudah tidak sinkron dengan persistent state.

---

## Rekomendasi Priority Fix

### Immediate (This Week)

1. **Fix F1: Order number atomic** — Gunakan IndexedDB transaction atau LOCKED increment dengan `navigator.locks` API untuk order counter
2. **Fix C1: Loyalty tx persist** — Tambahkan `localDb.put("loyalty_transactions", tx)` dan `enqueue("loyalty_transactions", "upsert", tx.id, tx)` di `addPoints()` dan `redeemPoints()`
3. **Fix F18/F19: Pull merge instead of replace** — Puller harus merge, bukan replace. Atau: flush outbox SEBELUM pull, baru replace
4. **Fix F10: Promo usageCount** — Increment `usageCount` di `applyVoucher()` dan `voidOrder()` perlu decrement

### Short-term (This Month)

5. **Fix F14: Outbox chunk error handling** — Ganti bulk upsert 100 jadi individual atau smaller chunks dengan per-record error handling
6. **Fix F16: Sync error notification** — Tampilkan sync error di UI (toast atau status bar)
7. **Fix F11: Voucher atomic** — Gunakan optimistic lock atau check-and-set pattern
8. **Fix F25: Guard initLocalData** — Gunakan initialization flag atau check if already initialized sebelum panggil lagi

### Medium-term

9. **Implement conflict resolution** — Timestamp-based atau version field untuk multi-device edits
10. **Add IndexedDB migration path** — `idb.ts` DB_VERSION=1 tanpa upgrade function — tidak ada cara migrate schema
11. **Debounce effect auto-save** — Gunakan debounced effect untuk cart/settings untuk reduce IDB writes

---

*Audit generated from source code analysis. Flow paths traced from service classes through signals, localDb, and sync engine.*
