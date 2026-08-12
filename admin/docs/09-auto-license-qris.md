# 09 — KONSEP: Beli & Aktivasi Lisensi Otomatis (QRIS Statis + Supabase)

> ⚠️ **SUPERSEDED (2026-08-11):** Dokumen konsep ini memakai tabel `leads`/`pembelian`
> yang sudah di-DROP. Implementasi live kini memakai **pipeline satu-tabel `clients`**
> (stage `menunggu_verifikasi` untuk verifikasi pembayaran — lihat `01-overview.md`
> & `03-data-schema.md`). Disimpan sebagai catatan riwayat.

> **Status: KONSEP (belum diimplementasi).**
> Produk: **satu lisensi sekali bayar, berlaku seumur hidup** (buy-once, lifetime).
> Pembayaran: **QRIS gambar STATIS** (QRIS merchant milik sendiri), **fungsional
> dinamis** — nominal diinput **manual oleh user** saat scan & bayar, senilai harga
> produk yang diambil dari **katalog `products`**.
> Tujuan: hilangkan aktivasi manual ketik-serial di klien & pekerjaan generate/kirim
> di admin, dengan alur yang SAMA untuk verifikasi manual (sekarang) dan
> payment-gateway (masa depan, opsional).

---

## 1. Masalah sekarang

- **Klien:** tombol "💬 Beli Lisensi" cuma `window.open` WhatsApp → manusia ngobrol,
  bayar manual, dapat serial, **ketik manual** di box "Kode Lisensi".
- **Admin:** buka kartu klien → pilih masa aktif → Generate serial (in-browser) →
  Copy → WhatsApp → kirim → user ketik lagi. Rawan salah ketik, tidak terstruktur.

Konsep ini menaruh jalan bayar + terima lisensi **di aplikasi**, menyisakan hanya
**verifikasi** untuk manusia.

---

## 2. Model pembayaran (QRIS statis, nominal manual)

- **QRIS gambar statis** (punya merchant, dari bank/QRIS resmi), **di-upload admin**
  di dashboard.
- QRIS statis **tidak** membawa nominal → saat scan, **user mengetik nominal sendiri**
  sesuai **harga produk** yang ditampilkan app.
- Karena nominal diketik manual → **verifikasi manual** (admin cek bukti). Trade-off
  QRIS statis: tidak ada notifikasi "sudah dibayar" otomatis dari bank.

> Otomatisasi penuh via payment gateway (webhook "lunas") nanti masih mungkin, tapi
> butuh pindah ke QRIS dinamis/aggregator. Disiapkan sebagai jalur opsional (Fase 2).

---

## 3. Prinsip kunci

1. **Data model sama utk sekarang & nanti.** "Aktivasi" = aksi **idempotent**
   `aktivasi(unit_id)` → generate serial → tulis → client auto-terima. Pemicunya
   bisa admin klik (sekarang) atau webhook (nanti) — memanggil fungsi yang SAMA.
2. **Serial dibuat server-side** (Edge Function), salt tidak di browser. Fase 1 boleh
   lanjut generate di admin-browser → tulis ke server; Fase 2 wajib server-side.
3. **Kirim ke perangkat = Supabase Realtime + fallback pull boot.** Klien subscribe
   baris `clients` miliknya → begitu serial tertulis → auto-aktivasi lokal (HMAC
   offline tetap jalan saat mati internet).
4. **Serial device-bound** (berisi device_code) → aman walau lewat channel anon.
5. **Harga & QRIS dari katalog produk.** `products` (Katalog) = sumber harga;
   tambah kolom `qris_url` untuk gambar QRIS per produk. Admin kelola via Katalog.
6. **Status lisensi = kolom `clients` yang SUDAH ADA** (`license_status`,
   `license_serial`, `license_expires_at`) — tidak perlu kolom baru.

---

## 4. Model data

### 4.1 Pakai kembali tabel `products` (SUDAH ADA) — harga + QRIS

Sumber harga **eksisting** = `products.price_label` (dikelola di modul Katalog admin).
Tambahkan **1 kolom baru** untuk QRIS:

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS qris_url TEXT;
-- contoh nilai: https://<ref>.supabase.co/storage/v1/object/public/qris/kaki5.png
```

- **Harga**: `products.price_label` (per `app_type`) — sudah ada, TIDAK buat tabel baru.
- **QRIS**: `products.qris_url` — di-upload admin di sheet Katalog produk.
- ⚠️ **P2 unifikasi (dari audit)**: harga juga masih `hardcoded` di
  `admin/js/license-ui.js` `PRODUCT_REGISTRY.price`. Sebaiknya harga lisensi
  mengambil `products.price_label`, bukan duplikat — biar satu sumber.
- RLS: `public_read_products` (visible=true) sudah ada → client & landing bisa baca.

### 4.2 Tabel baru — `pembelian` (1 transaksi beli lisensi)

```
id            uuid pk
user_id       uuid ref auth.users       -- pemilik (anonymous user)
unit_id       text not null             -- K5-XXXX-XXXX
app_type      text not null             -- kaki5 | rosok | gerobak | retail
device_code   text not null             -- tujuan serial (device-bound)
harga         numeric                   -- snapshot harga produk saat dibeli
status        text default 'menunggu_verifikasi'
              -- menunggu_verifikasi → 'aktif' | 'ditolak'
bukti_url     text                      -- bukti bayar (bucket bukti)
nama_pembayar text                      -- opsional: nama/ref transfer
serial        text                      -- diisi saat diaktivasi
created_at / verified_at / activated_at timestamptz
```

Index: `unit_id`, `status`, `created_at desc`.

### 4.3 Kolom `clients` (lisensi) — SUDAH ADA, dipakai sdg aktif

Kolom berikut **sudah ada** di tabel `clients` produksi (query Management API terverifikasi):

```
license_status      text    -- 'belum' (sekarang) → 'aktif' | 'ditolak' saat diaktivasi
license_serial      text    -- serial aktif
license_expires_at  timestamptz  -- null utk lifetime (seumur hidup)
```

> Seumur hidup ⇒ `license_expires_at = NULL`, `license_serial = "<KK5-...-99-...>"`.
> Client membaca `clients` baris miliknya utk auto-aktivasi.

### 4.4 Storage (bucket baru)

| Bucket | Isi | Akses |
|--------|-----|-------|
| `qris`  | gambar QRIS statis, path `{app_type}.png` | admin tulis; **public read** (klien tampilkan) |
| `bukti` | bukti bayar user (`{unit_id}/{ts}.jpg`) | anon: tulis/baca milik sendiri; admin (service_role): baca semua |

> Manajemen API tadi: **belum ada bucket** → perlu create pada implementasi.

---

## 5. State machine aktivasi

```
[klien lisensi habis → "Beli Lisensi"]
        │
        ▼
[BUY sheet]  baca products(app_type): nama + HARGA + qris_url → tampil QRIS (⬇️ Unduh)
        │
        ▼
[user scan QRIS → KETIK nominal = harga produk secara manual saat bayar]
        │
        ▼
["Saya Sudah Bayar" → upload bukti + create pembelian(menunggu_verifikasi)]
        │
        ▼
┌─────────────┬──────────────┐
│ FAZA 1: admin               │  FAZA 2 (opsional): gateway webhook "lunas"
│ cek bukti → ✅ Aktivasi / ❌ Tolak │  → auto panggil aktivasi(unit_id)
└─────────────┴──────────────┘
        ▼
[aktivasi(unit_id): generate serial '99' → set clients.license_status/deserial/expires]
        ▼
[Supabase Realtime push ke device unit_id tsb]
        ▼
[client auto-aktivasi lokal (HMAC) → toast "✅ Lisensi aktif"]
```

Beda fase 1/2 hanya *siapa* yang manggil `aktivasi(unit_id)` — tanpa ubah app klien.

---

## 6. Detail per sisi

### A. Klien (app kaki5, dll)
1. "💬 Beli Lisensi" → buka **sheet Beli** (bukan WA): baca `products?app_type=eq.<t>`
   → tampil nama, **harga**, **QRIS** (`qris_url` from bucket), tombol ⬇️ Unduh,
   petunjuk "ketik nominal Rp {harga}". Cache Dexie → offline tetap tampil.
2. **Saya Sudah Bayar** → pilih bukti → upload `bukti` → URL → `INSERT pembelian`
   (`status=menunggu_verifikasi`, `harga`, `bukti_url`).
3. **Subscribe realtime `clients`** (filter `license_serial` berubah) → `activateSerial()`
   (fungsi HMAC yang sdh ada) → toast "✅ Lisensi aktif!".
4. **Fallback pull** tiap boot / N menit: `GET clients?unit_id=eq..&select=license_serial`
   → kalau beda dari lokal → auto-aktifkan.
5. Offline-first tetap: validasi HMAC lokal.

### B. Admin
1. **Katalog** (Sudah ada): tambah field **QRIS upload** (`products.qris_url`) di sheet
   produk. Harga sudah di-manage di sini → satu sumber. (Opsional cleanup: hapus harga
   hardcoded di `license-ui.js`.)
2. **Klien screen**:
   - badge **🔔 1 pembayaran menunggu verifikasi** (hitung `pembelian` per unit_id)
   - kartu → **Riwayat Pembelian** → lihat bukti + nominal + nama pembayar
   - **✅ Aktivasi** → panggil `generate-license` → set `clients.license_*` + realtime → aktif
   - **❌ Tolak** → `pembelian.status='ditolak'`

### C. Supabase
- `ALTER products ADD qris_url` · tabel `pembelian` + RLS · buckets `qris`/`bukti`.
- Edge Function `generate-license` (pegang salt, batch gen `expCode '99'`) → tulis
  `clients.license_status/serial/expires_at`.
- `aktivasi(unit_id)` = panggil `generate-license`. Dipanggil admin (fase 1) ATAU webhook (fase 2).

---

## 7. Keamanan
- RLS anon → client hanya akses baris/file milik sendiri (`pembelian`, `clients`, `bukti`).
- `products` & `qris` public (memang perlu ditampilkan klien/landing).
- Salt server-side (fase 2) → serial tak bisa dipalsukan. Serial device-bound → aman.
- Verifikasi manual: admin cek bukti + nominal sesuai harga.

---

## 8. Roadmap fase

### Fase 1 — Verifikasi manual (yang diminta user)
- [ ] Supabase: `ALTER products ADD qris_url` · tabel `pembelian` + RLS · bucket `qris`/`bukti`
- [ ] Admin Katalog: field upload QRIS (`qris_url`) per produk
- [ ] Klien kaki5: sheet Beli (harga + QRIS dari `products`, cache offline) + upload bukti + create `pembelian`
- [ ] Klien kaki5: subscribe realtime `clients` + fallback boot → auto-aktivasi
- [ ] Admin Klien: badge + Riwayat Pembelian + Aktivasi/Tolak → set `clients.license_*`
- [ ] Generate serial '99': pindah ke Edge Function / lock di service_role

### Fase 2 — Payment Gateway (MASA DEPAN, OPSIONAL)
- [ ] Pindah ke QRIS dinamis/aggregator (bawa PNR + webhook)
- [ ] Webhook `lunas` → `aktivasi(unit_id)` (FUNGSI SAMA dgn klik admin)
- [ ] Drop upload bukti manual (webhook yg ngasih tahu lunas)

**Verifikasi lintas sisi**: 1 script Node ulangi algoritma HMAC (klien & generate-license)
supaya prefix (KK5 dst) + salt tidak meleset (`04-license-system.md`).

---

## 9. Keputusan yang perlu dipastikan sebelum implementasi

1. **Harga** = danai dari `products.price_label` (Katalog). Setuju harga lisensi pakai
   harga Katalog yang sudah ada (mis. kaki5 = Rp180.000)? ✓ sesuai arahan user.
2. **QRIS satu utk semua app atau per app** → `products.qris_url` per produk
   (upload di Katalog). Kalau cuma satu QRIS merchant, cukup set di tiap produk.
3. **Salt generate** pindah ke Edge Function sekarang (fase 1) atau nanti (fase 2)?
4. Konfirmasi **kolom `clients.license_*`** (sudah ada) dipakai sebagai target status
   lisensi (bukan nambah kolom baru)?
5. Notifikasi "ditolak" dibalas ke klien atau diam + admin follow-up WA?
6. **P2 unifikasi**: hapus harga hardcoded `license-ui.js` PRODUCT_REGISTRY (ambil `products`)?

---

*Konsep — KASIRSOLO (terverifikasi thd skema prod 2026-08-09)*