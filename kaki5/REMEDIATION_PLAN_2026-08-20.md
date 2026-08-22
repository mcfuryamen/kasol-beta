# 🛠️ REMEDIATION PLAN — KASIR SOLO KAKI5 Security Hardening
**Based on:** `SECURITY_AUDIT_2026-08-20.md`  
**Target:** Production-ready hardening dalam 4 sprint (4 minggu)  
**Approach:** Defense in depth — layer per layer, tidak breaking existing flow

---

## 🎯 SPRINT OVERVIEW

| Sprint | Fokus | Timeline | Critical Path |
|--------|-------|----------|---------------|
| **Sprint 1** | **CSP, Supply Chain, Secrets** | Week 1 (2026-08-20 – 08-27) | CSP nonce, SRI, Anon key move |
| **Sprint 2** | **License Crypto, Rate Limits, Backup Integrity** | Week 2 (2026-08-28 – 09-03) | Salt versioning, HMAC backup, Edge rate limits |
| **Sprint 3** | **Realtime Auth, RPC Audit, Device Identity** | Week 3 (2026-09-04 – 09-10) | Realtime JWT, device_known audit, identity reset |
| **Sprint 4** | **Privacy, Monitoring, Replication Prep** | Week 4 (2026-09-11 – 09-17) | Consent flow, dashboards, docs for rosok/gerobak/retail |

---

## 📋 SPRINT 1: CSP, SUPPLY CHAIN, SECRETS (Week 1)

### 1.1 CSP Nonce-Based Implementation
**Files:** `index.html`, `js/app.js`, `js/helpers.js`
```html
<!-- index.html: Generate nonce per load -->
<script>
  window.CSP_NONCE = crypto.getRandomValues(new Uint8Array(16)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'');
</script>
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${CSP_NONCE}';
  style-src 'self' 'nonce-${CSP_NONCE}';
  img-src 'self' data: https:;
  connect-src 'self' https://hhywrvedlwljawgxzpkq.supabase.co https://raw.githubusercontent.com;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
">
```

**Migration Steps:**
1. Add nonce to all `<script>` tags: `<script nonce="${CSP_NONCE}">`
2. Move all inline `onclick`/`oninput` → `addEventListener` di modul ESM (90% sudah)
3. Remaining inline handlers: wrap dengan `nonce="${CSP_NONCE}"`
4. Test di production build (Vercel preview)

**Effort:** 2 hari | **Owner:** Frontend | **Risk:** Low (sudah modular ESM)

---

### 1.2 Subresource Integrity (SRI) untuk Vendor Scripts
**Files:** `index.html`
```html
<!-- Generate hashes: openssl dgst -sha384 -binary dexie.min.js | openssl base64 -A -->
<script src="dexie.min.js" 
        integrity="sha384-DEXIE_HASH_HERE" 
        crossorigin="anonymous"></script>
<script src="js/supabase.min.js" 
        integrity="sha384-SUPABASE_HASH_HERE" 
        crossorigin="anonymous"></script>
```
**Action:** Generate hashes sekarang, commit ke repo.

**Effort:** 0.5 hari | **Owner:** DevOps | **Risk:** Zero

---

### 1.3 Anon Key — Move dari Hardcode ke Runtime Fetch
**Files:** `js/supabase-config.js`, `js/license.sync.js`, `js/sync.js`, `js/purchase.js`, `js/app-link.js`

**Current (BAD):**
```javascript
// supabase-config.js - hardcoded
window.KASIRSOLO_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Target (GOOD):**
```javascript
// supabase-config.js - hanya URL, key di-fetch
window.KASIRSOLO_SUPABASE_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co';

// license.sync.js / sync.js / purchase.js - fetch key saat boot
async function getAnonKey() {
  const sb = getSupabaseClient(); // butuh key untuk bikin client → chicken-egg
  // Solusi: fetch dari settings table via REST API langsung (no auth)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.anon_key&select=value`, {
    headers: { 'apikey': FALLBACK_ANON_KEY_FOR_BOOTSTRAP } // key minimal untuk read settings
  });
  // Fallback: key minimal hardcoded HANYA untuk bootstrap fetch settings
}
```

**Better Architecture:**
1. **Vercel Edge Function** `/api/supabase-config` → return anon key (server-side, rate limited)
2. Client fetch sekali di boot → cache di `sessionStorage`
3. Anon key **tidak pernah di source code**

**Effort:** 2 hari | **Owner:** Backend + Frontend | **Risk:** Medium (auth flow change)

---

### 1.4 Region Data Bundling (Remove GitHub Raw Dependency)
**Files:** `js/region.js`, build script

**Current:** Fetch dari `https://raw.githubusercontent.com/emsifa/api-wilayah-indonesia/...`
**Target:** Bundle static JSON di build time.

```javascript
// build-region.mjs (run sekali)
import fs from 'fs';
import https from 'https';

const BASE = 'https://raw.githubusercontent.com/emsifa/api-wilayah-indonesia/master/static/api';
const endpoints = ['provinces.json', 'regencies.json', 'districts.json', 'villages.json'];

for (const ep of endpoints) {
  const data = await fetch(`${BASE}/${ep}`).then(r => r.json());
  fs.writeFileSync(`assets/region/${ep}`, JSON.stringify(data));
}

// region.js → load dari local assets/region/
```

**Effort:** 1 hari | **Owner:** Frontend | **Risk:** Low

---

### 1.5 Dev SW Unregister — Fix Hostname Check
**File:** `index.html:30-40`

```javascript
// Current: hanya localhost/127.0.0.1
// Fix: semua non-HTTPS + non-FQDN
if (navigator.serviceWorker && 
    (location.protocol === 'http:' && !location.hostname.includes('.') || 
     location.hostname === 'localhost')) {
  // unregister
}
```

**Effort:** 0.5 hari | **Owner:** Frontend | **Risk:** Zero

---

## 📋 SPRINT 2: LICENSE CRYPTO, RATE LIMITS, BACKUP INTEGRITY (Week 2)

### 2.1 Salt Versioning di Supabase
**Files:** `admin/` (product registry), `js/license.logic.js`, `js/license.sync.js`

**Supabase Schema (products table):**
```sql
ALTER TABLE products ADD COLUMN salt_version INTEGER DEFAULT 2;
ALTER TABLE products ADD COLUMN salt_hmac TEXT; -- encrypted dengan service_role key
-- Atau: simpan salt plaintext tapi hanya readable via service_role
```

**Client Flow:**
```javascript
// license.sync.js - fetch salt saat syncLicenseStatus()
async function fetchProductSalt() {
  const sb = getSupabaseClient();
  const { data } = await sb.from('products')
    .select('salt_hmac, salt_version')
    .eq('app_type', 'kaki5')
    .eq('prefix', 'KK5')
    .maybeSingle();
  return data?.salt_hmac; // server-side decrypt atau plaintext (service_role only)
}

// license.logic.js - fallback ke embedded salt v2 jika fetch gagal
let PRODUCT_SALT = buildProductSalt(); // v2 fallback
async function initSalt() {
  try { PRODUCT_SALT = await fetchProductSalt(); } catch { /* keep v2 */ }
}
```

**Admin Dashboard:** Update product registry UI untuk manage salt version.

**Effort:** 3 hari | **Owner:** Fullstack | **Risk:** Medium (schema change)

---

### 2.2 HMAC Signature pada Backup File
**Files:** `js/backup.js`

**Export:**
```javascript
// Tambah signature field di backup object
const backupData = {
  version: 1,
  exportDate: new Date().toISOString(),
  // ... data tables
  _signature: null // akan diisi
};

// Sign dengan device key (derive dari fingerprint)
const { deviceCode } = await getDeviceIdentity();
const signKey = await crypto.subtle.importKey(
  'raw', new TextEncoder().encode(deviceCode + PRODUCT_SALT),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
);
const sig = await crypto.subtle.sign('HMAC', signKey, new TextEncoder().encode(JSON.stringify(backupData)));
backupData._signature = b32Encode(new Uint8Array(sig), 16);
```

**Import (validateBackup):**
```javascript
// Verify signature sebelum parse
const providedSig = data._signature;
delete data._signature;
const expectedSig = await computeHMAC(data, deviceCode);
if (providedSig !== expectedSig) return 'File ditolak: signature tidak valid (file dimodifikasi)';
```

**Effort:** 2 hari | **Owner:** Frontend | **Risk:** Low (backward compatible — old backup tanpa signature = reject dengan pesan jelas)

---

### 2.3 Backup Encryption (AES-GCM) — Optional Layer
**Files:** `js/backup.js`

```javascript
// Encrypt seluruh backup dengan AES-GCM
async function encryptBackup(data, deviceCode) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(deviceCode + PRODUCT_SALT),
    { name: 'PBKDF2' }, false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('kaki5-backup-v1'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return { iv: b32Encode(iv), data: b32Encode(new Uint8Array(ciphertext)) };
}
```

**Priority:** Optional (HMAC signature sudah cukup untuk integrity). Encrypt untuk confidentiality.

**Effort:** 1 hari | **Owner:** Frontend | **Risk:** Low

---

### 2.4 Edge Function Rate Limits
**Supabase Edge Functions:** `activate-license`, `generate-license` (future), storage upload

**Implementation (Deno/TypeScript):**
```typescript
// supabase/functions/activate-license/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RATE_LIMIT = new Map(); // unit_id -> { count, windowStart }

serve(async (req) => {
  const { unit_id } = await req.json();
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 menit
  const maxRequests = 10;
  
  const record = RATE_LIMIT.get(unit_id) || { count: 0, windowStart: now };
  if (now - record.windowStart > windowMs) { record.count = 0; record.windowStart = now; }
  if (++record.count > maxRequests) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
  }
  RATE_LIMIT.set(unit_id, record);
  
  // ... existing logic
});
```

**Apply ke:** `activate-license`, `device_known` RPC (via wrapper), storage upload.

**Effort:** 2 hari | **Owner:** Backend | **Risk:** Low

---

### 2.5 Client-Side Rate Limit Helpers
**Files:** `js/helpers.pure.js` (add), `js/license.ui.js`, `js/purchase.js`

```javascript
// helpers.pure.js
export function createRateLimiter(maxCalls, windowMs) {
  const calls = [];
  return () => {
    const now = Date.now();
    while (calls.length && now - calls[0] > windowMs) calls.shift();
    if (calls.length >= maxCalls) return false;
    calls.push(now);
    return true;
  };
}

// Usage di license.ui.js
const activateRateLimit = createRateLimiter(5, 60000); // 5 calls/menit
export async function activateLicense(inputId) {
  if (!activateRateLimit()) { showToast('Terlalu banyak percobaan, tunggu sebentar', 'error'); return; }
  // ... existing logic
}
```

**Effort:** 1 hari | **Owner:** Frontend | **Risk:** Low

---

## 📋 SPRINT 3: REALTIME AUTH, RPC AUDIT, DEVICE IDENTITY (Week 3)

### 3.1 Supabase Realtime JWT dengan `unit_id` Claim
**Files:** `js/purchase.js`, `js/license.sync.js`, `js/app.js`

**Current:** Anon key subscribe ke channel `license:${unitId}` — **bisa di-subscribe siapa pun**.

**Target:** JWT token dengan claim `unit_id` untuk Realtime auth.

```javascript
// app.js boot() - setelah anon signIn, get session, mint JWT dengan unit_id claim
async function setupRealtimeAuth() {
  const sb = getSupabaseClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  
  // Supabase Realtime JWT: sign dengan service_role key (server-side)
  // Atau: gunakan anon token tapi Supabase Realtime RLS sekarang support filter by auth.uid()
  // Better: Custom JWT via edge function
  const { data } = await sb.functions.invoke('realtime-token', { 
    body: { unit_id: await getUnitId() } 
  });
  // data.token = JWT dengan claim { unit_id: 'K5-...', role: 'realtime' }
  return data.token;
}

// purchase.js - subscribe dengan token
const channel = sb.channel(`license:${unitId}`, {
  params: { events: { '*': '*', '*': '*' } }, // Supabase Realtime config
  // Authorization via JWT di connection params
});
```

**Simpler Alternative:** Jangan kirim sensitive data via realtime. Hanya trigger `syncLicenseStatus()`.

```javascript
// purchase.js realtime handler - HANYA trigger sync
channel.on('postgres_changes', { event: 'UPDATE', table: 'clients', filter: `unit_id=eq.${unitId}` },
  (payload) => {
    if (payload.new.license_status !== payload.old.license_status) {
      syncLicenseStatus().then(() => checkLicenseGate()); // fetch fresh data via RLS
    }
  }
);
```

**Effort:** 2 hari | **Owner:** Fullstack | **Risk:** Medium

---

### 3.2 `device_known` RPC Audit & Hardening
**File:** `supabase/migration-device-claim.sql` (perlu review), `js/license.sync.js`, `js/sync.js`, `js/purchase.js`

**Audit Checklist:**
- [ ] `SECURITY DEFINER` necessary? (yes untuk claim ownership)
- [ ] Input validation: `p_unit_id` format, `p_device_code` format, `p_app_type` whitelist
- [ ] Rate limit per `p_unit_id` per menit (max 5)
- [ ] Audit log: insert ke `device_claim_log` table saat ownership transfer
- [ ] Return minimal info (boolean only, no PII)

**Hardening SQL:**
```sql
CREATE OR REPLACE FUNCTION device_known(
  p_unit_id TEXT, p_device_code TEXT, p_app_type TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row clients%ROWTYPE;
BEGIN
  -- Validate input
  IF p_unit_id !~ '^K5-[A-Z0-9]{4}-[A-Z0-9]{4}$' THEN
    RAISE EXCEPTION 'Invalid unit_id format';
  END IF;
  IF p_device_code !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$' THEN
    RAISE EXCEPTION 'Invalid device_code format';
  END IF;
  IF p_app_type NOT IN ('kaki5','rosok','gerobak','retail') THEN
    RAISE EXCEPTION 'Invalid app_type';
  END IF;
  
  -- Rate limit check (per unit_id per minute)
  -- ... implementation
  
  SELECT * INTO v_row FROM clients WHERE unit_id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  
  IF v_row.user_id IS NULL OR v_row.user_id != auth.uid() THEN
    UPDATE clients SET user_id = auth.uid() WHERE unit_id = p_unit_id;
    -- Log audit
    INSERT INTO device_claim_log (unit_id, old_user_id, new_user_id, claimed_at)
    VALUES (p_unit_id, v_row.user_id, auth.uid(), now());
  END IF;
  
  RETURN TRUE;
END;
$$;
```

**Effort:** 2 hari | **Owner:** Backend (DBA) | **Risk:** High (auth logic change)

---

### 3.3 Device Identity Reset Option (Privacy/GDPR)
**Files:** `js/license.logic.js`, `js/settings.ui.js`, `js/settings.logic.js`

**Feature:** User bisa reset identity (generate baru `unitId`, `deviceIdentity`, `installId`)

```javascript
// license.logic.js - export function
export async function resetDeviceIdentity() {
  // Hapus semua identity keys
  await setSetting('deviceIdentity', null);
  await setSetting('installId', null);
  await setSetting('unitId', null);
  await setSetting('deviceInfo', null);
  // Generate baru
  return await getDeviceIdentity(); // akan create baru
}

// settings.ui.js - tambah di "Data & Cadangan" card
<div class="setting-item" onclick="confirmResetIdentity()">
  <div class="setting-icon" style="background:var(--orange-bg)">🔄</div>
  <div class="setting-info">
    <div class="s-title">Reset Identitas Perangkat</div>
    <div class="s-desc">Generate ID baru (logout dari semua browser, trial baru)</div>
  </div>
  <div class="setting-arrow">›</div>
</div>
```

**Warning Dialog:** Jelasin konsekuensi (logout semua browser, trial reset kalau first_seen < 7 hari, license butuh aktivasi ulang).

**Effort:** 1.5 hari | **Owner:** Frontend | **Risk:** Low

---

### 3.4 Clock Anchor Hardening
**File:** `js/license.logic.js`

**Current Issue:** `localStorage.clear()` → hapus `clockAnchor` → bypass anti-rollback.

**Fix:** Store anchor di **dua tempat** (IndexedDB + localStorage) + server verify.

```javascript
// license.logic.js
const ANCHOR_KEYS = ['clockAnchor', 'clockAnchorBackup']; // localStorage + IndexedDB

export async function bumpClockAnchor() {
  const now = Date.now();
  // Update both
  await setSetting('clockAnchor', now);
  try { localStorage.setItem('clockAnchorBackup', String(now)); } catch {}
}

export async function getEffectiveNow() {
  // Check both sources, take max
  let anchor = Number(await getSetting('clockAnchor', 0)) || 0;
  try { anchor = Math.max(anchor, Number(localStorage.getItem('clockAnchorBackup') || 0)); } catch {}
  
  const now = Date.now();
  if (anchor && now < anchor - CLOCK_TOLERANCE_MS) return anchor;
  
  // Server verify (optional): if online, fetch server time via Supabase RPC
  if (navigator.onLine) {
    try {
      const sb = getSupabaseClient();
      const { data } = await sb.rpc('server_time');
      if (data && Math.abs(data - now) > CLOCK_TOLERANCE_MS) {
        // Server time drift detected — use server time
        return data;
      }
    } catch {}
  }
  return now;
}
```

**Effort:** 1 hari | **Owner:** Frontend | **Risk:** Low

---

## 📋 SPRINT 4: PRIVACY, MONITORING, REPLICATION PREP (Week 4)

### 4.1 Privacy Notice & Consent Flow
**Files:** `index.html` (add notice), `js/app.js`, `js/settings.ui.js`

**Requirement:** PDPA/GDPR compliance untuk persistent fingerprinting.

**Implementation:**
```html
<!-- index.html - add di licenseGate onboarding (kalau enable) atau first-run banner -->
<div id="privacyNotice" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:600;align-items:center;justify-content:center;padding:24px">
  <div style="background:#fff;border-radius:20px;padding:24px;max-width:440px;width:100%">
    <h3>🔒 Privasi & Identitas Perangkat</h3>
    <p>Kami menggunakan fingerprint perangkat keras (CPU, RAM, layar) untuk membuat ID unik yang stabil lintas browser. ID ini dipakai untuk:</p>
    <ul>
      <li>Lisensi per perangkat (anti-bajakan)</li>
      <li>Sinkronisasi profil ke server (CRM)</li>
      <li>Anti-rollback trial/license</li>
    </ul>
    <p>Data ini <strong>tidak dijual</strong> & hanya dipakai untuk layanan Kasir Solo.</p>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-primary" onclick="acceptPrivacy()">Setuju & Lanjut</button>
      <button class="btn btn-secondary" onclick="openPrivacySettings()">Kelola Data</button>
    </div>
  </div>
</div>
```

**Settings:** Tambah "Privasi Data" card dengan opsi:
- Lihat data yang dikirim ke server
- Reset identitas perangkat
- Hapus semua data lokal
- Export data (GDPR Art. 20)

**Effort:** 2 hari | **Owner:** Frontend + Legal | **Risk:** Low

---

### 4.2 Monitoring Dashboards (Supabase + Client)
**Supabase Dashboard Queries:**

```sql
-- 1. License Activation Rate (per hari)
SELECT DATE(license_activated_at) as day, COUNT(*) as activations
FROM clients WHERE license_status = 'aktif' AND license_activated_at > now() - interval '30 days'
GROUP BY day ORDER BY day;

-- 2. Anomalous Anon Key Usage (cross-unit_id reads)
SELECT auth_uid, COUNT(DISTINCT unit_id) as units_accessed, COUNT(*) as requests
FROM pg_stat_statements WHERE query LIKE '%clients%' AND calls > 100
GROUP BY auth_uid HAVING COUNT(DISTINCT unit_id) > 5;

-- 3. Sync Error Patterns
SELECT stage, error, COUNT(*) as occurrences, MAX(at) as last_occurred
FROM sync_errors WHERE at > now() - interval '7 days'
GROUP BY stage, error ORDER BY occurrences DESC;

-- 4. Device Claim Transfers (potential hijacking)
SELECT * FROM device_claim_log 
WHERE claimed_at > now() - interval '24 hours' 
AND old_user_id IS NOT NULL AND old_user_id != new_user_id;
```

**Client-Side Error Tracking:**
```javascript
// js/helpers.js - enhance showToast untuk critical errors
export function reportError(context, error, severity = 'error') {
  const payload = {
    context,
    message: error?.message || String(error),
    stack: error?.stack,
    url: location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    severity
  };
  // Send to Supabase error_log table (RLS insert-only via anon)
  // Atau: console.error + localStorage buffer untuk offline
}
```

**Effort:** 2 hari | **Owner:** Backend + Frontend | **Risk:** Low

---

### 4.3 Replication Package untuk App Baru (rosok/gerobak/retail)
**Deliverable:** `REPLICATION_GUIDE.md` + template files

**Structure:**
```
REPLICATION_GUIDE.md
templates/
  ├── license.logic.template.js      # Ganti PRODUCT_PREFIX, buildProductSalt()
  ├── license.sync.template.js       # Ganti APP_TYPE, table names
  ├── license.ui.template.js         # Ganti branding, WA number
  ├── sync.template.js               # Ganti APP_TYPE, payload mapping
  ├── purchase.template.js           # Ganti APP_TYPE, bucket names
  ├── supabase-config.template.js    # Ganti URL/key vars
  └── db.template.js                 # Ganti DB name, table schemas
```

**Checklist untuk App Baru:**
- [ ] Prefix unik (KSR, KK5, GBK, RTL, ...)
- [ ] Salt di Supabase products table
- [ ] Edge function `activate-license` support app_type baru
- [ ] `device_known` RPC whitelist app_type
- [ ] CSP connect-src include Supabase URL
- [ ] Region picker same (reuse)
- [ ] Backup protected keys include app-specific

**Effort:** 2 hari | **Owner:** Architect | **Risk:** Low

---

### 4.4 Documentation & Runbooks
**Files:** `docs/SECURITY_RUNBOOK.md`, `docs/INCIDENT_RESPONSE.md`

**Security Runbook:**
- License compromise response (salt rotation procedure)
- Anon key leak response
- Device hijacking investigation steps
- Backup tampering detection

**Incident Response:**
- Severity levels (P0-P3)
- Escalation contacts
- Communication templates
- Post-mortem template

**Effort:** 1 hari | **Owner:** Security | **Risk:** Zero

---

## 📊 PROGRESS TRACKING

### Sprint 1 (Week 1) — Target: 2026-08-27
| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| CSP Nonce Implementation | 🔄 Planned | Frontend | 2 hari |
| SRI Hashes | 🔄 Planned | DevOps | 0.5 hari |
| Anon Key Runtime Fetch | 🔄 Planned | Fullstack | 2 hari |
| Region Data Bundling | 🔄 Planned | Frontend | 1 hari |
| Dev SW Unregister Fix | 🔄 Planned | Frontend | 0.5 hari |

### Sprint 2 (Week 2) — Target: 2026-09-03
| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Salt Versioning Supabase | 🔄 Planned | Fullstack | 3 hari |
| Backup HMAC Signature | 🔄 Planned | Frontend | 2 hari |
| Backup Encryption (Optional) | 🔄 Planned | Frontend | 1 hari |
| Edge Function Rate Limits | 🔄 Planned | Backend | 2 hari |
| Client Rate Limit Helpers | 🔄 Planned | Frontend | 1 hari |

### Sprint 3 (Week 3) — Target: 2026-09-10
| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Realtime JWT Auth | 🔄 Planned | Fullstack | 2 hari |
| device_known RPC Audit | 🔄 Planned | Backend | 2 hari |
| Device Identity Reset | 🔄 Planned | Frontend | 1.5 hari |
| Clock Anchor Hardening | 🔄 Planned | Frontend | 1 hari |

### Sprint 4 (Week 4) — Target: 2026-09-17
| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Privacy Notice & Consent | 🔄 Planned | Frontend+Legal | 2 hari |
| Monitoring Dashboards | 🔄 Planned | Backend+Frontend | 2 hari |
| Replication Package | 🔄 Planned | Architect | 2 hari |
| Runbooks | 🔄 Planned | Security | 1 hari |

---

## 🔄 DEPENDENCY MAP

```
Sprint 1
├── CSP Nonce → enables Sprint 2 (inline handlers removal)
├── Anon Key Fetch → enables Sprint 3 (Realtime auth)
└── Region Bundling → independent

Sprint 2
├── Salt Versioning → requires Sprint 1 Anon Key Fetch (Supabase access)
├── Backup HMAC → independent
├── Edge Rate Limits → requires Supabase Functions deploy
└── Client Rate Limits → independent

Sprint 3
├── Realtime JWT → requires Sprint 1 Anon Key Fetch + Sprint 2 Edge Functions
├── device_known RPC → independent (DB change)
├── Device Reset → requires Sprint 2 Salt Versioning (new identity = new license)
└── Clock Anchor → independent

Sprint 4
├── Privacy Notice → requires Sprint 3 Device Reset (UI)
├── Monitoring → requires Sprint 2 Edge Functions + Sprint 3 RPC logs
├── Replication Package → all sprints complete
└── Runbooks → all sprints complete
```

---

## 🎯 DEFINITION OF DONE (Per Sprint)

### Sprint 1 Done When:
- [ ] CSP header tanpa `'unsafe-inline'` (nonce-based), all inline handlers removed
- [ ] `dexie.min.js` & `supabase.min.js` punya `integrity` hash
- [ ] Anon key tidak ada di source code, di-fetch via Edge Function/bootstrap
- [ ] `region.js` load dari `assets/region/*.json` (no external fetch)
- [ ] Dev SW unregister works untuk semua local dev hostnames

### Sprint 2 Done When:
- [ ] Salt v3 di Supabase products table, client fetch saat boot, fallback v2
- [ ] Backup export include HMAC-SHA256 signature, import verify signature
- [ ] Edge functions `activate-license`, `device_known` wrapper rate limited (10 req/min/unit)
- [ ] Client-side rate limiters di `activateLicense`, `submitPurchase`, `grantExtension`

### Sprint 3 Done When:
- [ ] Realtime subscription hanya trigger `syncLicenseStatus()` (no sensitive data push)
- [ ] `device_known` RPC audited, rate limited, audit logged
- [ ] User bisa reset device identity via Settings → generate baru unitId/installId
- [ ] Clock anchor di IndexedDB + localStorage + server time verify

### Sprint 4 Done When:
- [ ] Privacy notice di first-run, consent logged, Settings punya "Privasi Data" card
- [ ] Supabase dashboard queries untuk license activations, anon anomalies, sync errors, device claims
- [ ] Replication guide + templates ready untuk rosok/gerobak/retail
- [ ] Security runbook + incident response documented

---

## 🚀 QUICK WINS (Bisa Dipercepat)

| Quick Win | Effort | Impact |
|-----------|--------|--------|
| SRI hashes untuk vendor scripts | 30 menit | Supply chain protection |
| Dev SW unregister hostname fix | 30 menit | Dev UX |
| Console.log strip di production | 1 jam | Info disclosure |
| Error message sanitization | 1 jam | Info disclosure |
| Duplicate debounce consolidation | 2 jam | Maintainability |
| `version.json` notes descriptive | 30 menit | User communication |

---

## 📝 RISK MITIGATION

| Risk | Mitigation |
|------|------------|
| CSP nonce break inline handlers | Test di Vercel preview sebelum merge; fallback ke `'unsafe-inline'` di preview only |
| Anon key fetch failure → app break | Fallback ke embedded key (warn di console), retry exponential backoff |
| Salt v3 fetch gagal → license verify fail | Fallback ke v2 embedded, log warning, retry next sync |
| RPC change break cross-browser unlock | Test di 2 browser berbeda device sama; feature flag RPC version |
| Backup signature break old restore | `validateBackup` detect missing signature → clear error message, allow manual override (dev only) |

---

## 📅 MILESTONE DATES

| Milestone | Target Date | Criteria |
|-----------|-------------|----------|
| **Sprint 1 Complete** | 2026-08-27 | CSP, SRI, Anon key, Region, SW fix |
| **Sprint 2 Complete** | 2026-09-03 | Salt versioning, Backup HMAC, Rate limits |
| **Sprint 3 Complete** | 2026-09-10 | Realtime auth, RPC audit, Device reset, Clock anchor |
| **Sprint 4 Complete** | 2026-09-17 | Privacy, Monitoring, Replication, Runbooks |
| **Production Hardening Release** | **2026-09-18** | All sprints done, tested, deployed |
| **Replication to rosok/gerobak/retail** | 2026-09-25 | Using replication package |

---

*Remediation Plan v1.0 — 2026-08-20*  
*Owner: Senior Security Engineer + Fullstack Team*  
*Review: Weekly (Monday 09:00 WIB)*