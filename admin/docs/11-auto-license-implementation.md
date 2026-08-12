# Auto Activation License - Implementation Summary

> ⚠️ **SUPERSEDED (2026-08-11):** Implementasi "Tab Pembelian" di dokumen ini memakai
> tabel `pembelian` yang sudah di-DROP. Pembayaran kini diverifikasi via stage
> `menunggu_verifikasi` di pipeline `clients`. Disimpan sebagai catatan riwayat.

## ✅ Yang Sudah Diimplementasi

### 1. Admin Dashboard (C:\Users\Admin\Documents\kasol\admin)
- **Tab Pembelian** di halaman Klien (`index.html` + `js/clients.js`)
- List pembelian dengan filter status (pending/aktif/ditolak)
- Tombol Verifikasi & Aktivasi
- Preview bukti pembayaran
- File: `js/pembelian.js` (module baru)

### 2. Edge Function (C:\Users\Admin\Documents\kasol\supabase\functions)
- **activate-license/index.ts** - Generate serial HMAC + update client
- Algorithm identik dengan `generate-license` (HMAC-SHA256 + Base32)
- Update `clients.license_*` dan `pembelian.status`
- **Status**: Code sudah dibuat, perlu deploy manual via Supabase Dashboard atau CLI

### 3. Kaki5 App (C:\Users\Admin\Documents\kasol\kaki5)
- **Sheet Pembelian** dengan QRIS static + upload bukti (`index.html`)
- **purchase.js** - Module baru untuk handle pembelian:
  - Tampilkan QRIS dari settings Supabase
  - Upload bukti ke bucket `bukti`
  - Insert record ke tabel `pembelian`
  - Polling status aktivasi (30s intervals)
- **license.js** - Updated button "Beli Lisensi" → buka sheet purchase
- **app.js** - Realtime subscription ke `license-updates` channel
- **sw.js** - Cache bump v26 → v27, include `purchase.js`

## 📁 File yang Diubah/Dibuat

| File | Aksi |
|------|------|
| `admin/index.html` | +Tab Pembelian |
| `admin/js/clients.js` | +loadPembelianList, renderPembelianList, verifyPembelian, activatePembelian |
| `admin/js/pembelian.js` | **BARU** - Module pembelian |
| `admin/js/app.js` | +import pembelian |
| `kaki5/index.html` | +Sheet pembelian |
| `kaki5/js/license.js` | +openPurchaseSheet, update tombol |
| `kaki5/js/app.js` | +subscribeToLicenseUpdates |
| `kaki5/js/purchase.js` | **BARU** - Module pembelian |
| `kaki5/sw.js` | +purchase.js, bump v27 |
| `supabase/functions/activate-license/index.ts` | **BARU** - Edge Function |

## 🚀 Deployment Checklist

### 1. Deploy Edge Function
```bash
# Opsi A: Via Supabase Dashboard
# 1. Buka https://supabase.com/dashboard/project/hhywrvedlwljawgxzpkq
# 2. Functions → New Function → Activate License
# 3. Copy paste isi supabase/functions/activate-license/index.ts
# 4. Deploy

# Opsi B: Via CLI (jika deno terinstall)
supabase functions deploy activate-license --project-ref hhywrvedlwljawgxzpkq
```

### 2. Setup QRIS (Settings)
```sql
-- Update settings table dengan URL QRIS Anda
UPDATE public.settings 
SET value = '{"url": "https://your-bucket/storage/v1/object/public/qris/qr-is.jpg"}'::jsonb
WHERE key = 'qris_url';
```

### 3. Test Flow
1. Buka kaki5 di http://localhost:8086
2. Settings → Kelola Lisensi → Beli Lisensi
3. Upload bukti transfer
4. Cek admin di http://localhost:8082 → Klien → Tab Pembelian
5. Klik "Verifikasi" lalu "Aktivasi"
6. Lisensi akan otomatis aktif di perangkat klien

## 📊 Flow Diagram

```
[User] → Klik "Beli Lisensi" → [Sheet Pembelian]
                                    ↓
                            [Tampil QRIS] + [Upload Bukti]
                                    ↓
                            [Submit ke Supabase]
                                    ↓
                    [Status: menunggu_verifikasi]
                                    ↓
[Admin] → Buka Tab Pembelian → [Review Bukti]
                                    ↓
                            [Verifikasi] → [Aktivasi]
                                    ↓
                    [Edge Function: Generate Serial]
                                    ↓
                [Update clients.license_status = 'aktif']
                                    ↓
                    [Realtime Broadcast ke Client]
                                    ↓
                  [Client: Toast "Lisensi Aktif! 🎉"]
```

## 🔐 Security Notes

1. **Edge Function** menggunakan service_role key (dari env)
2. **Bucket bukti** private, hanya admin yang bisa akses
3. **Bukti QRIS** public read (bucket `qris`)
4. **HMAC salt** tidak terekspos ke browser

## 📝 Next Steps (Optional)

1. **Payment Gateway Integration** - Integrasi Xendit/Midtrans untuk auto-activation
2. **Email Notification** - Kirim notifikasi ke user saat lisensi aktif
3. **Bulk Activation** - Admin bisa aktivasi multiple pembelian sekaligus
4. **Retry Logic** - Auto-retry jika aktivasi gagal
