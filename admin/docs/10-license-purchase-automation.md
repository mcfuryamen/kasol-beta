# Sistem Pembelian & Aktivasi Lisensi Otomatis

## Konsep

Flow pembelian lisensi yang **user-friendly** dan **low-friction**:
1. User klik "Beli Lisensi" di aplikasi klien
2. Tampil panduan dengan QRIS statis + tombol upload bukti
3. Admin verifikasi bukti pembayaran → klik "Aktivasi"
4. Sistem generate lisensi + kirim ke perangkat klien (realtime)
5. Future: integrasi payment gateway untuk aktivasi otomatis

## Flow Detail

### 1. Aplikasi Klien (kaki5)

```
[Halaman Pengaturan] → [Tombol "Beli Lisensi"]
                           ↓
                   [Sheet Pembelian]
                           ↓
           ┌───────────────┼───────────────┐
           ↓               ↓               ↓
     [QRIS Code]      [Nominal]      [Upload Bukti]
     (downloadable)   (from products)  (optional→admin)
           │               │               ↓
           └───────────────┼───────────────┘
                           ↓
                   [Kirim Bukti] → [Supabase]
                           ↓
                 [Status: Menunggu Verifikasi]
```

**Komponen UI:**
- `sheetPurchase.html` — modal pembelian
- `qris-image` — QRIS static dari bucket `qris/public`
- `price-display` — ambil dari `products.price_label`
- `upload-bukti-btn` — kirim foto bukti transfer
- `status-indicator` — Menunggu / Diverifikasi / Aktif

### 2. Database Schema

```sql
-- Tabel pembelian (transaksi)
CREATE TABLE pembelian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id TEXT NOT NULL REFERENCES clients(unit_id),
  product_code TEXT NOT NULL,  -- 'KSR', 'K5', 'GBK', 'RTL'
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending|verified|active|expired
  bukti_url TEXT,                -- URL foto bukti di bucket 'bukti'
  verified_by TEXT,              -- admin who verified
  verified_at TIMESTAMPTZ,
  license_serial TEXT,
  license_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk query cepat
CREATE INDEX idx_pembelian_unit ON pembelian(unit_id);
CREATE INDEX idx_pembelian_status ON pembelian(status);
CREATE INDEX idx_pembelian_created ON pembelian(created_at DESC);
```

### 3. Admin Dashboard (Verifikasi)

```
[Menu Klien] → [Detail Client] → [Tab Pembelian]
                                      ↓
                          [Daftar Pembelian Pending]
                                      ↓
                          [Card: Unit + Produk + Bukti]
                                      ↓
                          [Tombol: ✓ Verifikasi] [✗ Tolak]
                                      ↓
                          [Setelah Verifikasi: → AKTIFKAN]
                                      ↓
                          [Generate License + Kirim ke Client]
```

**Fitur Admin:**
- List semua pembelian dengan status
- Preview foto bukti (lightbox)
- Tombol "Verifikasi" → status = `verified`
- Tombol "Aktivasi" → generate serial + kirim ke client
- Riwayat semua transaksi

### 4. Engine Lisensi (Supabase Edge Function)

```typescript
// Function: generate-license
// Input: unit_id, product_code
// Process:
//   1. Ambil salt dari products.salt
//   2. Generate serial dengan HMAC
//   3. Update clients.license_*
//   4. Broadcast ke client via realtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function handle(request: Request) {
  const { unit_id, product_code } = await request.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!
  )
  
  // Get product salt
  const { data: product } = await supabase
    .from('products')
    .select('salt, price_label, days_valid')
    .eq('code', product_code)
    .single()
  
  if (!product) throw new Error('Product not found')
  
  // Generate license serial
  const serial = generateLicenseSerial(
    product.salt,
    unit_id,
    product.days_valid
  )
  
  // Update client
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + product.days_valid)
  
  await supabase
    .from('clients')
    .update({
      license_serial: serial,
      license_status: 'active',
      license_expires_at: expiresAt.toISOString()
    })
    .eq('unit_id', unit_id)
  
  // Update pembelian record
  await supabase
    .from('pembelian')
    .update({
      status: 'active',
      license_serial: serial,
      license_expires_at: expiresAt.toISOString()
    })
    .eq('unit_id', unit_id)
    .eq('status', 'verified')
    .is('license_serial', null)
  
  // Broadcast to client
  await supabase.auth.admin.signOut({ userId: unit_id }) // force re-login
  // Or send notification via realtime channel
  
  return { serial, expires_at: expiresAt.toISOString() }
}
```

### 5. Realtime Notification ke Client

```javascript
// Di app klien (kaki5/js/license.js)
async function subscribeToLicenseUpdate() {
  const channel = supabase
    .channel('license-updates')
    .on('postgres_changes', 
      { event: 'UPDATE', schema: 'public', table: 'clients' },
      (payload) => {
        if (payload.new.unit_id === getCurrentUnitId()) {
          const newLicense = payload.new
          if (newLicense.license_status === 'active') {
            activateLicense(newLicense.license_serial, newLicense.license_expires_at)
            showNotification('Lisensi berhasil diaktifkan! 🎉')
          }
        }
      }
    )
    .subscribe()
}
```

## State Transitions

```
[pending] → [verified] → [active] → [expired]
                ↓
           [rejected] → [pending] (loop)
```

| Status | Keterangan |
|--------|-----------|
| `pending` | Bukti pembayaran dikirim, menunggu verifikasi admin |
| `verified` | Admin telah memverifikasi bukti |
| `active` | Lisensi digenerate dan dikirim ke client |
| `expired` | Masa aktif lisensi habis |
| `rejected` | Bukti tidak valid, user bisa upload ulang |

## API Endpoints

### Upload Bukti Pembayaran
```
POST /storage/v1/object/bukti/{unit_id}_{timestamp}.jpg
Headers: Authorization: Bearer {anon_key}
Body: FormData dengan file gambar
```

### Check Purchase Status
```
GET /rest/v1/pembelian?unit_id=eq.{unit_id}&status=eq.pending
Headers: apikey: {anon_key}
Response: { id, status, created_at }
```

### Admin Verify & Activate
```
POST /functions/v1/activate-license
Headers: Authorization: Bearer {service_role}
Body: { unit_id: string }
Response: { serial, expires_at }
```

## Security Considerations

1. **Salt tidak terekspos** — HMAC generation hanya di Edge Function
2. **Bukti pembayaran privat** — bucket `bukti` hanya bisa diakses admin dengan service_role
3. **Rate limiting** — batasi pembelian per unit_id (1 pembelian aktif sekaligus)
4. **Audit trail** — semua aksi admin tercatat di `verified_by` & `verified_at`

## Future: Payment Gateway Integration

Ketika siap integrasi auto:
1. User input nominal → system create invoice di payment gateway
2. Payment gateway webhook → auto-verify + auto-activate
3. No manual intervention needed
4. Support: Xendit, Midtrans, Tripay

## Implementation Steps

### Phase 1: Database & Storage
- [ ] Run migration SQL
- [ ] Setup bucket `bukti` dengan RLS
- [ ] Create Edge Function `generate-license`

### Phase 2: Admin UI
- [ ] Tambah tab "Pembelian" di halaman Klien
- [ ] List pembelian dengan filter status
- [ ] Preview bukti pembayaran
- [ ] Tombol Verifikasi + Aktivasi

### Phase 3: Client UI (kaki5)
- [ ] Sheet pembelian dengan QRIS
- [ ] Upload bukti pembayaran
- [ ] Status indicator
- [ ] Realtime subscription

### Phase 4: Polish
- [ ] Notification toast saat lisensi aktif
- [ ] Auto-refresh status setiap 30 detik
- [ ] Error handling
