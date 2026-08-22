# 🔒 SECURITY AUDIT REPORT — KASIR SOLO KAKI5 (kaki5/)
**Role:** Senior Security Engineer + Fullstack Developer  
**Tanggal:** 2026-08-20  
**Versi:** 1.0.13 (cacheBust v65)  
**Scope:** Full codebase review — crypto, auth, data validation, client-side security, Supabase/RLS, PWA, supply chain

---

## 📊 EXECUTIVE SUMMARY

| Kategori | Rating | Temuan Kritis |
|----------|--------|---------------|
| **Kriptografi Lisensi** | 🟡 MEDIUM | Salt obfuscation only (security through obscurity), no key rotation |
| **Autentikasi/Autorisasi** | 🟢 LOW | Anonymous Auth + RLS proper, but session handling has edge cases |
| **Validasi Input & Sanitasi** | 🟢 LOW | `escapeHtml` consistent, `buildSafeHtml` opt-in raw, phone validation strict |
| **Client-Side Security (XSS/CSRF)** | 🟡 MEDIUM | CSP has `'unsafe-inline'`, inline event handlers, no CSRF tokens needed (no server state) |
| **Supabase/RLS Configuration** | 🟡 MEDIUM | Anon key embedded in client, `device_known` RPC SECURITY DEFINER critical |
| **PWA/Service Worker** | 🟢 LOW | Proper strategies, but SW caches Supabase URL pattern only |
| **Backup/Restore Integrity** | 🟢 LOW | Transactional, field validation, protected keys sanitized |
| **Device Fingerprinting Privacy** | 🟡 MEDIUM | Stable cross-browser ID = tracking vector, no user consent |
| **Supply Chain** | 🟡 MEDIUM | `supabase.min.js` 849 functions bundled, `dexie.min.js` global, no SRI |

**OVERALL RISK: MEDIUM** — Production ready dengan mitigasi, tapi butuh hardening pada kriptografi, CSP, dan supply chain.

---

## 🔴 CRITICAL FINDINGS (Perlu Perbaikan Segera)

### 1. **License HMAC Salt — Security Through Obscurity** (`license.logic.js:17-26`)

```javascript
// PROBLEMA: Salt di-derive runtime dari string fragments
function buildProductSalt() {
  const a = 'KASIR' + 'SOLO';
  const b = 'KAKI' + '5';
  const c = 'HMAC' + '-' + 'V2';
  return [a, b, c].join('-');  // Returns: "KASIRSOLO-KAKI5-HMAC-V2"
}
const PRODUCT_SALT = buildProductSalt();
```

**Vulnerability:**
- Salt **bukan rahasia** — bisa diekstrak via static analysis (string concatenation trivial)
- Comment sendiri mengakui: *"defensive entertainment (security-through-obscurity)"*
- Offline PWA **tidak bisa truly un-forgeable** — attacker dengan akses file bisa generate serial valid
- **Tidak ada key rotation** — kompromi salt = semua serial terbit kompromi

**Impact:** Attacker offline bisa generate serial `KK5-XXXX-XXXX-XX-XXXXXX` valid untuk deviceCode apa pun.

**Rekomendasi:**
1. **Server-side validation wajib** (sudah diimplementasikan via `syncLicenseStatus()` + Realtime) — ini mitigasi utama
2. **Salt rotation mechanism**: Simpan salt version di Supabase, client fetch saat sync
3. **Short expiry codes default**: Hindari `99` (seumur hidup) untuk serial baru
4. **Rate limit** `activate-license` edge function per device/IP

---

### 2. **CSP `script-src 'unsafe-inline'`** (`index.html:12`)

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline'; 
  ...
">
```

**Vulnerability:**
- `'unsafe-inline'` memungkinkan inline `<script>` dan `onclick`/`oninput` execution
- Semua handler di `index.html` pakai `onclick="window._ksr_..."` → butuh `'unsafe-inline'`
- Jika ada XSS vector (mis. `buildSafeHtml` misused dengan `__raw: true`), attacker bisa inject script

**Mitigasi Saat Ini:**
- `escapeHtml` digunakan konsisten di semua render dinamis
- `buildSafeHtml` hanya allow raw HTML via explicit `{__raw: true}` object
- Tidak ada user-generated content yang dirender tanpa escaping

**Rekomendasi:**
1. **Nonce-based CSP**: Generate nonce per load, apply ke `<script nonce="...">` dan inline handlers
2. **Atau**: Pindah semua inline handlers ke `addEventListener` di modul JS (sudah 90% di ESM)
3. **Hash-based CSP** untuk inline scripts yang tidak bisa dipindah

---

### 3. **Anon Key Embedded in Client** (`supabase-config.js:12-18`)

```javascript
window.KASIRSOLO_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Risk:**
- Anon key **public by design** (Supabase docs) — tapi embedded di client berarti:
  - Siapa pun bisa baca key via DevTools → `window.KASIRSOLO_SUPABASE_ANON_KEY`
  - Bisa dipakai untuk query Supabase langsung (bypass app logic)
  - **RLS adalah satu-satunya proteksi** — jika policy salah, data bocor

**Current Mitigation:**
- RLS policies: `auth.uid() = user_id` (per-device isolation)
- `device_known` RPC claim ownership saat session berganti
- `isPlaceholderKey()` check mencegah key dummy

**Rekomendasi:**
1. **Jangan hardcode** — fetch dari `/settings` table saat boot (sudah ada `fetchSetting()`)
2. **Atau**: Vercel Edge Function proxy untuk Supabase calls (hide key, add rate limit)
3. **Monitor** Supabase logs untuk anomalous anon key usage

---

### 4. **`device_known` RPC — SECURITY DEFINER Critical Path** (`license.sync.js`, `sync.js`, `purchase.js`)

```sql
-- migration-device-claim.sql (not shown but referenced)
-- RPC dengan SECURITY DEFINER yang:
-- 1. Mencari baris clients by unit_id
-- 2. Jika user_id NULL atau beda → UPDATE user_id = auth.uid()
-- 3. Return true/false
```

**Risk:**
- **Single point of failure** untuk cross-browser license unlock
- Jika RPC logic flawed → device hijacking (attacker claim device milik user lain)
- `SECURITY DEFINER` runs dengan privileges `postgres` role — bug = privilege escalation

**Code Paths yang Memanggil:**
1. `license.sync.js:isKnownDevice()` → check device known
2. `license.sync.js:recheckRowWithSession()` → recheck after session create
3. `sync.js:ensureSynced()` → claim before write
4. `purchase.js:submitPurchase()` → claim before upsert

**Rekomendasi:**
1. **Audit RPC SQL** terpisah (minta file `migration-device-claim.sql`)
2. **Add rate limiting** di RPC (per unit_id per menit)
3. **Log audit trail** di `clients` table saat ownership transfer

---

### 5. **Device Fingerprinting = Persistent Tracking** (`license.logic.js:78-130`)

```javascript
// V3 fingerprint: platform, hardwareConcurrency, deviceMemory, maxTouchPoints, screen resolution
// STABIL cross-browser → unit_id = 'K5-' + deviceCode
```

**Privacy Concern:**
- **Fingerprint tidak berubah** walau user clear storage, ganti browser, incognito
- `unit_id` jadi **supercookie** — track user tanpa consent
- GDPR/PDPA: Butuh consent untuk persistent identifier
- Data dikirim ke Supabase `clients` table (PII: nama, WA, alamat + fingerprint)

**Current State:**
- Tidak ada privacy notice di onboarding (onboarding disabled)
- `privacy policy` hanya di Syarat & Ketentuan modal (tidak ditampilkan lagi)

**Rekomendasi:**
1. **Privacy notice** di first-run / settings
2. **Option to reset identity** (generate new `unitId` + `deviceIdentity`)
3. **Data minimization**: Hanya kirim field yang perlu ke CRM
4. **Document legal basis** (legitimate interest vs consent)

---

## 🟠 HIGH FINDINGS

### 6. **No Key Rotation / Salt Versioning** (`license.logic.js`, `admin/docs/04-license-system.md`)

- Salt `KASIRSOLO-KAKI5-HMAC-V2` **hardcoded v2** — tidak ada mekanisme v3
- Jika salt kompromi (mis. source code leak, insider), **semua serial terbit jadi forgeable**
- Admin product registry di localStorage → bisa dimodifikasi attacker dengan akses device

**Fix:** Simpan salt di Supabase `products` table dengan `version`, client fetch saat boot.

---

### 7. **Realtime Subscription — No Authorization Check** (`purchase.js:480-520`)

```javascript
const channel = sb.channel(`license:${unitId}`);
channel.on('postgres_changes', { event: 'UPDATE', table: 'clients', filter: `unit_id=eq.${unitId}` }, ...)
```

**Risk:**
- Channel name `license:${unitId}` **predictable** — siapa pun tahu unitId bisa subscribe
- Supabase Realtime **anon key bisa subscribe** ke channel apa pun
- Data yang diterima: `license_status`, `license_serial`, `license_expires_at`, `first_seen` — **PII leakage** ke listener

**Mitigasi:**
- Supabase Realtime RLS **tidak apply** ke `postgres_changes` filter
- Harus pakai **Supabase Realtime JWT** dengan claims `unit_id` (bukan anon)
- Atau: Jangan kirim sensitive data via realtime, hanya trigger `syncLicenseStatus()`

---

### 8. **Service Worker Caches Supabase URL Pattern Only** (`sw.js:38-45`)

```javascript
if (request.url.includes('/supabase.co')) {
  event.respondWith(fetch(request).catch(() => new Response(...)));
  return;
}
```

**Issue:**
- Hanya match `/supabase.co` — **tidak cover** custom domain, edge functions, storage URLs
- `supabase.co` di URL bisa muncul di path lain (false positive/negative)
- Better: Check `request.destination === 'fetch'` + origin match

**Fix:** Gunakan `new URL(request.url).origin === SUPABASE_URL`

---

### 9. **Backup Import — No Signature Verification** (`backup.js`)

```javascript
export async function importData(event) {
  const text = await file.text();
  const data = JSON.parse(text);
  const err = validateBackup(data);  // Hanya validasi struktur
  // ... DB.transaction clear + bulkAdd
}
```

**Risk:**
- File backup **bisa dimodifikasi attacker** (tambah transaksi palsu, ubah harga modal)
- `validateBackup` hanya cek struktur & tipe data — **tidak verify integrity/authenticity**
- User bisa restore backup dari device lain (meski `sanitizeSettingsRows` hapus license/unitId)

**Rekomendasi:**
1. **HMAC-SHA256 signature** di backup file (sign dengan device key)
2. **Encrypt backup** (AES-GCM) dengan key dari device fingerprint
3. **Versioned backup format** dengan signature field

---

### 10. **Purchase Flow — Price Tampering Client-Side** (`purchase.js:270-275`)

```javascript
function parsePriceToNumber(label) {
  const cleaned = String(label).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10);
}

// priceLabel dari Supabase products table → parsed client-side
```

**Risk:**
- `priceLabel` & `priceBeforeLabel` **dari Supabase** (aman) — tapi parsed client-side
- Jika attacker modify `window._ksr_currentPrice` sebelum `submitPurchase()` → tidak divalidasi server-side
- Edge function `activate-license` seharusnya verify harga tapi **tidak dicek di client**

**Fix:** Validasi harga di edge function `activate-license` (server-side authority).

---

## 🟡 MEDIUM FINDINGS

### 11. **Clock Anchor Anti-Rollback — Bypassable** (`license.logic.js:170-190`)

```javascript
const CLOCK_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000; // 2 hari
export async function getEffectiveNow() {
  let anchor = Number(await getSetting('clockAnchor', 0)) || 0;
  const now = Date.now();
  return (anchor && now < anchor - CLOCK_TOLERANCE_MS) ? anchor : now;
}
```

**Bypass:**
- Attacker: `localStorage.clear()` → hapus `clockAnchor` → `getEffectiveNow()` return `Date.now()`
- Atau: Set `clockAnchor` ke masa depan via DevTools
- **Wipe storage = reset anchor** (komentar kode akui: *"Wipe storage menghapus anchor"*)

**Mitigasi:** `first_seen` di server (T12) — tapi hanya untuk trial anchor, bukan license expiry.

---

### 12. **Trial Anchor `first_seen` — Trust on First Use (TOFU)** (`license.logic.js:270-280`)

```javascript
export async function startTrial(anchorStartedAt) {
  const anchorMs = anchorStartedAt ? new Date(anchorStartedAt).getTime() : NaN;
  const startedAt = (!isNaN(anchorMs) && anchorMs > 0)
    ? new Date(anchorMs).toISOString()
    : (lic.startedAt || now);
}
```

**Risk:**
- `first_seen` dari Supabase **diasumsikan benar** (TOFU)
- Jika attacker compromise Supabase (atau admin error) → set `first_seen` masa depan = trial extended
- Tidak ada cryptographic proof of `first_seen` timestamp

---

### 13. **Supabase Client Singleton — No Reauth on Token Refresh Failure** (`license.sync.js:60-75`, `sync.js:45-58`)

```javascript
if (!window._ksrSupabaseClient) {
  window._ksrSupabaseClient = window.supabase.createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}
return window._ksrSupabaseClient;
```

**Issue:**
- `autoRefreshToken: true` tapi **tidak ada error handler** untuk refresh failure
- Jika refresh token expired/revoked → subsequent calls fail silently
- `isPlaceholderKey()` check hanya di init, tidak periodik

---

### 14. **QRIS/Storage URLs — Public Bucket Access** (`purchase.js:10-12`)

```javascript
const QRIS_BUCKET_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co/storage/v1/object/public/qris/';
const BUKTI_BUCKET_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co/storage/v1/object/bukti/';
```

**Risk:**
- `public/qris/` bucket **public read** — siapa pun bisa download QRIS image
- `bukti/` bucket — upload via anon key, tapi **public URL** setelah upload (`getPublicUrl`)
- Bukti pembayaran user **accessible via URL guessing** (unit_id + timestamp)

**Fix:** 
- QRIS: Signed URL dengan expiry (Supabase Storage signed URLs)
- Bukti: Private bucket, signed URL untuk admin view only

---

### 15. **`supabase.min.js` — 849 Functions, No Integrity Check** (`index.html:42`)

```html
<script src="js/supabase.min.js"></script>
```

**Supply Chain Risk:**
- File 17KB, 849 exported functions — **large attack surface**
- Tidak ada **Subresource Integrity (SRI)** hash
- Jika file dikompromi (build supply chain, CDN) → full Supabase client control
- `dexie.min.js` sama — global script, no SRI

**Fix:** Add `integrity="sha384-..."` ke दोनों script tags.

---

### 16. **Duplicate Debounce/Throttle Implementations** (Maintenance Risk)

| File | Function |
|------|----------|
| `helpers.pure.js:135` | `debounce`, `throttle` |
| `pos.js:30` | `debounce` (local copy) |
| `menu.js:10` | `debounce` (local copy) |
| `laporan.js` | inline debounce logic |

**Risk:** Inconsistent behavior, bug fixes tidak propagate ke semua copy.

**Fix:** Import dari `helpers.pure.js` secara konsisten.

---

### 17. **Error Messages Leak Internal Details** (Multiple Files)

```javascript
// license.sync.js:156
console.warn('fetchLicenseStatusFromCloud:', result.error?.message || result.error || result.kind);

// purchase.js:450
showToast('Gagal mengirim bukti: ' + e.message, 3000, 'error');

// sync.js:250
showToast('Gagal sinkron (' + stage + '): ' + message.slice(0, 120), 'error');
```

**Risk:** Error messages ke user mengandung internal details (stage, error type) — information disclosure.

**Fix:** Generic user-facing messages, detailed logs ke console only.

---

### 18. **No Rate Limiting on Client-Side Actions**

| Action | Risk |
|--------|------|
| `grantExtension` (share-to-extend) | User bisa spam share → bypass 20x limit via DevTools |
| `activateSerial` | Brute force serial input (6 char Base32 = 32^6 ≈ 1B kombinasi, tapi rate limit butuh server) |
| `submitPurchase` | Spam upload bukti → storage quota exhaustion |
| `syncLicenseStatus` / `ensureSynced` | Polling 60s + visibilitychange + online event = burst potential |

**Fix:** Client-side debounce + server-side rate limit di edge functions.

---

### 19. **IndexedDB — No Encryption at Rest**

- Dexie/IndexedDB **plaintext di disk** (browser storage)
- Data sensitif: transaksi, pengeluaran, profil usaha, **license state**
- Jika device dicuri & tidak encrypted (Android/iOS default encrypted tapi bukan selalu) → data accessible

**Mitigasi:** OS-level encryption (Android FBE, iOS Data Protection) — tapi tidak application-level.

---

### 20. **Purchase Upload — No File Type Validation Beyond `accept`** (`purchase.js:200`)

```html
<input type="file" id="buktiInput" accept="image/png,image/jpeg,image/webp" capture="environment">
```

**Risk:**
- `accept` attribute **hanya UI hint** — bisa bypass via DevTools
- File dikirim ke Supabase Storage tanpa server-side MIME validation
- Attacker upload `.php`, `.html`, `.svg` (XSS via SVG) → jika bucket misconfigured

**Fix:** Server-side validation di edge function / Storage policy `allowedMimeTypes`.

---

## 🟢 LOW / INFORMATIONAL

### 21. **Console Logs in Production** (Multiple Files)
- `console.log('[APP] Starting...')`, `console.log('[SW] Registered')`, etc.
- Info disclosure: module structure, timing, cache version
- **Fix:** Strip console via build step (tidak ada build step saat ini) atau wrap di `if (location.hostname === 'localhost')`

### 22. **`version.json` Notes Minimal** (`version.json`)
```json
{"notes": ["🔄 Folder kerja disinkronkan dengan mirror GitHub..."]}
```
- Release notes tidak deskriptif untuk user
- Force-update overlay menampilkan notes ini — user tidak tahu apa yang berubah

### 23. **Dev SW Unregister — Hostname Check Only** (`index.html:30-40`)
```javascript
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
```
- Tidak cover `192.168.x.x`, `10.x.x.x`, `*.local`, custom dev domains
- Fix: Check `location.protocol === 'http:' && !location.hostname.includes('.')` atau env flag

### 24. **`confirmClearAll` — License State Retained** (`backup.js:230`)
```javascript
// L5: status lisensi perangkat SENGAJA dipertahankan (anti reset-trial)
```
- Good: Anti reset-trial
- Tapi: User expectation "hapus semua data" ≠ "kecuali license" — UX mismatch

### 25. **`region.js` — External API Dependency** (`region.js:1-10`)
```javascript
const BASE = 'https://raw.githubusercontent.com/emsifa/api-wilayah-indonesia/master/static/api';
```
- **Single point of failure** — GitHub raw rate limit, repo move, DNS hijack
- No fallback / cached copy bundled
- **Fix:** Bundle wilayah data di build time (static JSON) atau cache aggressively

---

## 📋 SECURITY CHECKLIST UNTUK PRODUKSI

### Pre-Deploy (Wajib)
- [ ] **CSP**: Remove `'unsafe-inline'` atau implement nonce-based CSP
- [ ] **SRI**: Add integrity hashes untuk `dexie.min.js`, `supabase.min.js`
- [ ] **Anon Key**: Move ke Vercel env / fetch dari Supabase `settings` table
- [ ] **QRIS/Bukti Storage**: Signed URLs, private bucket untuk bukti
- [ ] **Backup Signature**: HMAC-SHA256 pada file backup
- [ ] **Rate Limits**: Edge function rate limit untuk `activate-license`, `device_known`, storage upload
- [ ] **RPC Audit**: Review `migration-device-claim.sql` SECURITY DEFINER logic
- [ ] **Realtime Auth**: Supabase Realtime JWT dengan `unit_id` claim, bukan anon

### Post-Deploy (Monitoring)
- [ ] **Supabase Logs**: Alert anomalous anon key usage (bulk reads, cross-unit_id)
- [ ] **License Activations**: Monitor serial reuse, device mismatch, geo anomalies
- [ ] **Sync Errors**: Dashboard `sync_errors` table review berkala
- [ ] **PWA Updates**: Monitor `updateOverlay` trigger rate (detect stuck clients)

### Hardening Roadmap
| Timeline | Item |
|----------|------|
| **Sprint 1** | CSP nonce, SRI, Anon key move, Storage signed URLs |
| **Sprint 2** | Backup HMAC, Salt versioning di Supabase, Rate limits |
| **Sprint 3** | Realtime JWT auth, RPC audit, Device identity reset option |
| **Sprint 4** | Privacy notice, Consent flow, Data minimization audit |

---

## 🛡️ DEFENSE IN DEPTH SUMMARY (Yang Sudah Baik)

| Layer | Implementation |
|-------|----------------|
| **Transport** | HTTPS only (Vercel), CSP connect-src restrict Supabase + GitHub |
| **Authentication** | Anonymous Auth per device, RLS `auth.uid() = user_id` |
| **Authorization** | `device_known` RPC claim ownership, unit_id as natural key |
| **Input Validation** | `escapeHtml` everywhere, `buildSafeHtml` opt-in raw, strict phone validation |
| **License Crypto** | HMAC-SHA256 Web Crypto API, non-extractable key, Base32 encoding |
| **Anti-Rollback** | `clockAnchor` (T13), `first_seen` server anchor (T12) |
| **Revoke** | Real-time revoke via Supabase Realtime + local `markLicenseRevoked` |
| **Backup Integrity** | Transactional restore, field-level validation, duplicate ID check, protected keys sanitized |
| **Offline-First** | Dexie local DB, SW cache strategies, graceful degradation |
| **Observability** | `sync_errors` table, local recentErrors, sync health panel |

---

## 📝 CATATAN UNTUK TIM

1. **License system adalah hybrid** — offline HMAC fallback + online-first Supabase validation. **Online path adalah authoritative**. Offline path hanya untuk graceful degradation.

2. **`kaki5` adalah PILOT** untuk hybrid license. Replikasi ke `rosok/`, `gerobak/`, `retail/` harus copy pola `license.sync.js` + Realtime subscription + `device_known` RPC.

3. **Admin dashboard (`admin/`)** adalah **satu-satunya sumber kebenaran** untuk generate/activate/revoke. Client tidak pernah generate serial.

4. **Supabase project**: `hhywrvedlwljawgxzpkq` — anon key di `.env.local` root, service role key hanya di Vercel admin env.

5. **Deploy**: Vercel git integration (no GitHub Actions), npm workspaces selective deploy.

---

*Security Audit by Senior Security Engineer — 2026-08-20*  
*Next Review: Post Sprint 1 hardening (target 2026-09-01)*