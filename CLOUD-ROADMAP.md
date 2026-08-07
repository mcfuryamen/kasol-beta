# Cloud & Dashboard Hub — KASIRSOLO Roadmap

> **Dokumen global** yang mendokumentasikan arsitektur cloud & roadmap ekosistem
> KASIRSOLO. Baca bersama [`CONTEXT.md`](./CONTEXT.md) (standar ekosistem) dan
> [`DEPLOYMENT.md`](./DEPLOYMENT.md) (monorepo & deploy).
>
> Status: **Konsep / Roadmap** — beberapa bagian sudah berjalan (Meta/CRM),
> sebagian lagi rencana (Data Bisnis & Dashboard Hub). Detail implementasi bisa
> berubah; dokumen ini adalah sumber kebenaran arah arsitektur.

---

## 🎯 Ringkasan Roadmap

Ekosistem KASIRSOLO berkembang dalam **3 lapisan arsitektur** yang dipisahkan
ketat, karena kebutuhan dan waktu pengembangannya berbeda:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAPISAN A — META / CRM  (Supabase SEKARANG, via repo admin/)           │
│  • customers / clients : profil outlet (unit, kontak, wilayah)          │
│  • licenses   : generate + VALIDASI lisensi                             │
│  • banners    : konten banner yang tampil di app klien                  │
│  • config     : konfigurasi per aplikasi (freemium/premium)             │
│  ↑  app klien menghubungi lapisan ini utk profil/lisensi/banner/meta    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ (dibangun SEKARANG)
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAPISAN B — DATA BISNIS  (masa depan, saat build Dashboard Hub)        │
│  • transactions{unitId, appType, tanggal, tipe, total, items, synced_at}│
│  • app PREMIUM sinkron transaksi lokal → cloud                          │
│  • Dashboard Hub (READ-ONLY) baca data ini → statistik per unit & global│
└─────────────────────────────────────────────────────────────────────────┘

LAPISAN C — OFFLINE (Dexie/IndexedDB per app) — tetap ada di SEMUA versi
  → Freemium : offline saja
  → Premium  : offline + sinkronisasi ke Lapisan B
```

---

## 🧱 Lapisan A — Meta / CRM (Supabase, SEKARANG)

Diakses & dikelola melalui **repo `admin/`** (Admin Dashboard). Ini adalah *CRM
internal* KasirSolo — **bukan** database transaksi bisnis klien.

### Fungsi
| Fungsi | Supabase | Keterangan |
|--------|----------|------------|
| **Profil outlet tersinkron** | `clients` | App klien push profil (unit, kontak, wilayah) via `sync.js` — **SUDAH BERJALAN** (kaki5) |
| Kelola **database pelanggan** | `customers`/`clients` | Data pelanggan, unit, kontak |
| **Generate lisensi** | `licenses` + product registry | Serial HMAC per produk |
| **Validasi lisensi** | `licenses` (API) | **Kolaborasi app klien** |
| **Banner** untuk app klien | `banners` / `app_config` | Konten ditampilkan di dashboard app |
| Konfigurasi app | `app_config` | Freemium/premium, fitur gating |

### Sinkronisasi profil klien (implementasi saat ini — kaki5)
App klien mengirim profil identitas outlet ke tabel `clients` (Lapisan A) —
**bukan** data transaksi. Pola: **Anonymous Auth** (tiap perangkat = user anonim,
RLS `auth.uid() = user_id` → cuma bisa ubah baris sendiri; admin full via
service_role). Wilayah tersruktur (id+nama) via API **emsifa**. Dua skenario
(user baru push saat onboarding; user lama di-backfill otomatis — offline-first).
Detail: [`CONTEXT.md`](./CONTEXT.md) → "Sinkronisasi Profil Klien".

### Sikap terhadap data transaksi
**Lapisan A TIDAK menyentuh data transaksi bisnis klien.** Transaksi klien tetap
di Dexie (Lapisan C) sampai Lapisan B aktif. Ini menjaga privasi & kesederhanaan,
dan memisahkan "data pelanggan & lisensi" dari "data penjualan".

> ⚠️ **Catatan status:** `admin/` kini **sudah terhubung Supabase** (katalog CRUD +
> tab Klien/CRM). Validasi lisensi di app klien masih **offline** (HMAC lokal);
> arah yang benar tetap **server-side via Supabase** dengan fallback offline.

---

## ☁️ Lapisan B — Data Bisnis & Dashboard Hub (MASA DEPAN)

Dibangun **bersamaan dengan ekosistem cloud**. Ini yang memungkinkan klien
memantau seluruh unit bisnisnya.

### Dashboard Hub — kebutuhan klien
Klien (pengusaha yang punya **beberapa unit bisnis**) dapat:
- **Per unit** : statistik satu unit bisnis tertentu (omzet, transaksi, tren).
- **Global** : akumulasi statistik dari **semua** unit bisnis miliknya.

```ini
cth. Klien "Pak Budi" punya 3 unit:
   Unit 1 : Warung (kaki5)
   Unit 2 : Gerobak (gerobak)
   Unit 3 : Toko (retail)
DASHBOARD HUB      →  per unit  : OMZET Warung bulan ini = Rp 3.2jt
                   →  global    : OMZET total 3 unit     = Rp 8.7jt
```

### `unitId` — DNA agregasi data
Karena hub harus memisah "per unit" vs "global", **setiap record transaksi** yang
disinkronkan ke cloud **wajib** membawa:

```json
{
  "unitId":   "u_<app>_<nomor>",
  "appType":  "kaki5 | rosok | gerobak | retail",
  "txId":     "<unik global>",
  "tanggal":  "YYYY-MM-DD",
  "tipe":     "jual | beli | pengeluaran",
  "total":    "<nominal>",
  "items":    [ ... ]      // detail bebas sesuai konteks app
}
```

- `unitId` disimpan di **`settings`** tiap app (Lapisan C) sejak awal — bahkan
  freemium, supaya saat upgrade ke premium tidak perlu re-migrasi.
- Hub agregasi lintas-app hanya membaca **field inti** (unitId, tanggal, tipe,
  total) → detail `items` dibebaskan per konteks.

### Freemium vs Premium
| Aspek | Freemium | Premium |
|-------|----------|---------|
| Database transaksi | Dexie (offline HP) | Dexie (offline) **+ cloud (Lapisan B)** |
| Lisensi | Trial / validasi → via Lapisan A | Lapisan A + kontrak berbayar |
| Banner/meta dari cloud | ✅ (cache/online) | ✅ |
| Sync transaksi ke cloud | ❌ | ✅ |
| Akses Dashboard Hub | ❌ (nanti) | ✅ |

> **Aturan:** Lapisan C tetap ada di **semua** versi — jangan pernah menghapus
> offline-first. Premium = **offline + sync**, bukan *mengganti* offline dengan cloud.

---

## ⚙️ Prinsip Desain Wajib

1. **Pisahkan Lapisan A (meta/CRM) dari Lapisan B (data bisnis)** — jangan
   gabung schema pelanggan/lisensi dengan transaksi.
2. **Desain app klien "cloud-ready" sejak dini** — sediakan lapisan abstraksi
   (`fetchMeta()`, `validateLicense()`, kelak `syncTransactions()`) sejak freemium,
   supaya upgrade ke premium tidak memerlukan refactor besar.
3. **`unitId` ditetapkan sejak awal** di `settings` tiap app.
4. **Offline-first adalah fitur** — premium menambah sync, bukan mengganti Dexie.
5. **Validasi lisensi target = Supabase (server-side)**, dengan fallback offline.
6. **Dashboards Hub = read-only** terhadap Lapisan B (tidak menulis transaksi).

---

## 🆕 Penerapan ke Aplikasi Baru (cth. kaki5)

Saat membangun/mengintegrasi aplikasi klien ke ekosistem ini:

- [ ] Adopsi arsitektur modular ESM + state terpusat + entry point (pola rosok).
- [ ] Tambah tabel `settings` (untuk `bizName`, `setupDone`, `unitId`, lisensi).
- [ ] Tambah sistem lisensi — sumber kebenaran = Lapisan A (Supabase), fallback offline.
- [ ] Tampilkan banner/meta dari Lapisan A.
- [ ] Pertahankan tabel bisnis khusus app (menu, penjualan, pengeluaran, dll) di Dexie.
- [ ] Daftarkan produk (prefix + salt) di admin product registry.
- [ ] Siapkan `unitId` di settings (DNA untuk Dashboard Hub masa depan).
- [ ] Adopsi **Fitur Standar Global UX** (lihat `CONTEXT.md` → "Fitur Standar Global"):
      onboarding 2-langkah tanpa checkbox, profil tersruktur (region picker Provinsi/Kab/Kec),
      auto-sync profil on-update, banner "Lengkapi Profil" center-large, kontrak z-index,
      narasi benefit-driven, akordeon Bantuan auto-close. Referensi: `kaki5/`.

---

*Cloud & Dashboard Hub Roadmap — KASIRSOLO*
*Draf konsep — 2026*
