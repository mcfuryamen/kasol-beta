# ADR — Voucher Pembelian Lisensi & Program Referal (Prototipe: Kaki5)

> **Status:** Keputusan produk diambil 2026-10-24 (McFury). Menunggu persetujuan go-live untuk implementasi.
> **Prototipe:** `kaki5/` (app klien referensi arsitektur). Tabel & RPC generik per-`app_type`
> → rosok / laundry / minimarket bisa pakai pola yang sama.
> **Dokumen ini** dibaca bersama `../CONTEXT.md`, `../docs/STATUS-LIVE.md`, `../docs/HUB-DESIGN-DECISIONS.md`.
>
> **Revisi:**
> - **v2** — setelah keputusan pemilik K1–K4 (satu sistem kode).
> - **v3** — setelah klarifikasi K5: **registrasi referal/mitra via website** → muncul
>   **modul manajemen referal/mitra** = itulah "modul HUB" yang dimaksud pemilik.
>   Lihat **§12–§15**.


---

## 1. Keputusan Pemilik (2026-10-24)

| # | Keputusan | Isi |
|---|---|---|
| **K1** | Bentuk voucher | **Kode redeem → lisensi instan.** Bukan kode diskon murni. |
| **K2** | Reward pengundang | **Poin** yang bisa dikonversi ke rupiah, **atau** rupiah langsung yang bisa di-**withdraw** / dipakai **bayar lisensi**. |
| **K2b** | Reward pendatang | **Diskon** (kayak voucher). Tanpa kode referal → **harga normal**. |
| **K3** | Pemegang kode | **Semua user** boleh punya & membagikan kode referal. |
| **K3b** | Akumulasi reward | Reward **masuk ke saldo mitra dan diakumulasi**. Tempo payout berdasarkan **status mitra itu sendiri**: punya **lisensi** (klien yang sekalian merekomendasikan) → **payout per 7 hari**; **fokus referensi doank tanpa lisensi** → **payout per 30 hari**. **Siklusnya berulang terus-menerus, bukan sekali lalu selesai** — mitra referral-only juga payout **per 30 hari** tanpa batas jumlah siklus. **Basis = status mitra**, bukan status orang yang dia tunjuk. (Revisi 2026-10-25 — sebelumnya basingnya kebalik: ngitung dari apakah referee-nya beli lisensi.) |
| **K3c** | Pencairan | **Manual dulu** lewat **sistem request** (user minta → admin proses). |
| **K4** | Scope | **Voucher & referal digabung** fungsinya, pakai **satu sistem kode**. |

---

## 2. Temuan audit (dasar desain)

Sebagian besar groundwork **sudah ada**:

| Komponen | Status | Lokasi |
|---|---|---|
| Flow pembelian lisensi | ✅ **ADA** | `kaki5/js/purchase.js` — sheet QRIS + rekening → upload bukti → `clients.status='menunggu_verifikasi'` → polling/realtime |
| Verifikasi & aktivasi admin | ✅ **ADA** | `control/js/clients.js:325` `restoreClientLicense()` |
| Mesin HMAC serial | ✅ **ADA** | `control/js/license-core.js` (server) & `kaki5/js/license.logic.js` (klien) — algoritma identik |
| RPC lisensi | ✅ **ADA** | `device_known`, `device_assign`, `license_activate_device`, `license_claim_identity` — semua `SECURITY DEFINER` |
| Bonus kuota | ✅ **ADA** | `clients.tx_adjust` — `control/js/clients.js:1563`; kaki5 baca dari cloud (`license.sync.js:410`) |
| Pembayaran | ✅ **ADA** | `settings.qris_url` + `settings.bank_info` (OCBC NISP 940810055142) |
| Registry produk | ✅ **ADA** | `products` (10 baris): `kode_produk`, `price_label`, `tx_quota`, `salt` |
| Pipeline WA | ✅ **ADA** | `outreach_contacts` 394, `wa_prospects` 88, `wa_broadcast_log` 46 |
| Tabel `vouchers` + `promos` | ⚠️ **TERPAKAI** minimarket (diskon retail) | jangan rebut nama & semantiknya |
| Kode lisensi | ❌ BELUM | — |
| Referral | ❌ BELUM | `lead_source` 23/23 masih `'app'` |

### 2.1 Hole yang ditemukan (di luar scope — dicatat, tidak diubah)

1. **Aktivasi admin tidak menulis ke `licenses`.** `restoreClientLicense()` hanya `PATCH clients`;
   tabel `licenses` (4 baris) & `license_devices` (4 baris) diisi lewat jalur HUB/seed.
   → **Harus ditutup di Fase 1**, kalau tidak kuota voucher & kuota app tidak sinkron.
2. **`products.salt` terbaca publik** (RLS `USING (visible = true)`, `roles={public}`)
   → serial bisa di-forge offline. Dampak kecil (coba-buat trial), tapi catat kalau nanti
   salt dianggap rahasia.

---

## 3. Model Unified — SATU sistem kode

```
                        ┌──────────────────────────┐
                        │      license_codes       │
                        │  (SATU tabel, 2 kind)    │
                        ├──────────────────────────┤
   ADMIN buat ─────────►│ kind='voucher'           │
   (dijual ke pembeli)  │  efek: lisensi instan     │
                        │        +/− diskon         │
                        │  batch, harga_paid        │
                        └────────────┬─────────────┘
                                     │  satu kode, dua channel
   USER dapet otomatis ►┌────────────┴─────────────┐
   (semua user)          │ kind='referral'           │
                        │  efek: diskon untuk       │
                        │  pendatang + poin untuk    │
                        │  pengundang                │
                        └──────────────────────────┘

CHANNEL 1 — DISKON  : di sheet pembelian kaki5 → kode → harga turun
CHANNEL 2 — REDEEM  : di gate lisensi kaki5 → kode → lisensi aktif instan
```

**Kenapa digabung (konsekuensi K4):**
- Satu mental model untuk user: *"kode itu buat diskon, atau buat lisensi gratis."*
- Satu tabel, satu set RPC, satu UI admin.
- Voucher yang terjual (admin) dan kode referal (user) **punya efek yang bisa ditumpuk**:
  kode voucher boleh punya diskon **dan** hak redeem; kode referal default-nya diskon saja.

**Kenapa `license_codes` baru, bukan tabel `vouchers` yang sudah ada:**
`vouchers` = diskon retail minimarket (`promo_id` NOT NULL, RLS `can_access_outlet()`).
Semantiknya berbeda total. Bikin tabel baru = nol bentrok & RLS bisa ketat sendiri.

---

## 4. Skema data (usulan)

### 4.1 `license_codes` — master kode (voucher & referral)

```sql
create table license_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null,
      -- 'KK5-8F2K-9QW2' (voucher admin)  |  'TOKO-8F2K' (referral user)
  kind              text not null,             -- 'voucher' | 'referral'
  app_type          text not null default 'kaki5',

  -- kepemilikan
  owner_client_id   uuid,                      -- referral: pemilik kode; voucher: null
  owner_unit_id     text,
  global_identity_id text,                     -- cadangan: HUB (0 akun, freeze)
  batch_id          uuid,                      -- pengelompokan voucher dari admin
  created_by        text,                      -- 'admin' | 'user'

  -- EFEK DISKON (channel 1)
  discount_type     text not null default 'fixed',  -- 'fixed' | 'percent'
  discount_value    numeric not null default 0,
  max_discount      numeric,
  min_purchase      numeric not null default 0,
  discount_max_uses integer,                   -- null = tak terbatas (referral)
  discount_used_count integer not null default 0,
  discount_used_by  uuid[],                    -- client yang sudah pakai
  discount_used_at  timestamptz,

  -- EFEK LISENSI (channel 2)
  grant_plan        text default 'single',
  grant_max_devices integer default 1,
  grant_tx_quota    integer,                   -- null = ikut products.tx_quota
  grant_exp_code    text default '99',         -- '99' = seumur hidup
  redeem_max_uses   integer default 1,
  redeem_used_count integer not null default 0,
  redeemed_by_client_id uuid,
  redeemed_by_unit_id   text,
  redeemed_by_device_code text,
  license_id        uuid,                      -- lisensi yang dihasilkan
  serial_issued     text,

  -- status & masa berlaku
  status            text not null default 'aktif',  -- aktif|terpakai|kadaluwarsa|dibatalkan
  expires_at        timestamptz not null,           -- masa berlaku KODE (bukan lisensi)
  price_paid        numeric not null default 0,     -- berapa yang dibayar ke admin
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint license_codes_kind_chk    check (kind in ('voucher','referral')),
  constraint license_codes_status_chk  check (status in ('aktif','terpakai','kadaluwarsa','dibatalkan'))
);
```

### 4.2 `code_redemptions` — log pemakaian (audit & anti-fraud)

```sql
create table code_redemptions (
  id                uuid primary key default gen_random_uuid(),
  code_id           uuid not null references public.license_codes(id),
  code              text not null,             -- denormalisasi untuk audit
  channel           text not null,             -- 'diskon' | 'lisensi'
  client_id         uuid,
  unit_id           text,
  app_type          text not null,
  discount_value    numeric default 0,
  points_awarded    integer default 0,
  hold_until        timestamptz,                -- reward boleh dicairkan setelah 1 siklus payout (basis: status mitra, K3b)
  points_released_at timestamptz,               -- NULL = masih nunggu siklus
  referrer_client_id uuid,
  referrer_partner_id uuid references public.referral_partners(id) on delete set null,
  -- snapshot identitas referee (implementasi Fase 1, 2026-10-26)
  referee_name  text,   -- nama toko referee saat pakai kode
  referee_city  text,
  referee_phone text,
  status            text not null default 'berhasil',  -- berhasil|ditolak
  reason            text,
  created_at        timestamptz not null default now()
);
```

> **Kenapa snapshot (Fase 1):** referee bisa datang dari **form website**, bukan
> cuma pengguna app → `client_id` bisa NULL. Plus riwayat referral harus tetap
> terbaca walau baris `clients` berubah atau dihapus. `partner_referrals()`
> baca `coalesce(referee_name, clients.nama_usaha, 'Pelanggan')`.

> **Ledger per-reward (wajib).** `points_pending` di `referral_wallets` cuma agregat, jadi
> `referral_resolve_pending()` nggak bisa nentuin reward mana yang sudah lewat siklus payout
> tanpa ledger per-baris. Karena itu `code_redemptions` yang pegang `hold_until` +
> `points_released_at`. `hold_until` dihitung dari **status mitra saat referral terjadi**
> (punya lisensi = 7 hari, referral-only = 30 hari). Reward **diakumulasi** di saldo —
> `points_pending` → `points_balance` tiap kali siklus selesai, dan mitra request payout
> minimal Rp 50.000 (diproses manual admin).

### 4.3 `referral_wallets` — saldo poin & rupiah per pengguna

```sql
create table referral_wallets (
  id                uuid primary key default gen_random_uuid(),
  partner_id        uuid unique references public.referral_partners(id) on delete cascade,
  client_id         uuid unique references public.clients(id) on delete cascade,  -- Fase 3
  unit_id           text,
  app_type          text not null default 'kaki5',
  points_balance    integer not null default 0,   -- poin siap dicairkan
  points_pending    integer not null default 0,   -- poin nunggu siklus payout (7/30 hari, basis: status mitra)
  points_earned     integer not null default 0,   -- akumulasi seumur hidup
  rupiah_balance    numeric not null default 0,   -- cermin rupiah dari poin siap dicairkan
  withdrawable      numeric not null default 0,   -- rupiah yg sudah ditahan utk request payout aktif
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

> **Revisi Fase 1 (2026-10-26):** wallet di-key ke **`partner_id`** (mitra),
> bukan `client_id`. Alasannya §14.2 — mitra ≠ `clients`, dan mitra
> referral-only **nggak punya** baris client sama sekali. `client_id` tetap
> ada (nullable) untuk wallet pengguna app di Fase 3.

### 4.4 `payout_requests` — request pencairan manual (K3c)

```sql
create table payout_requests (
  id                uuid primary key default gen_random_uuid(),
  wallet_id         uuid references public.referral_wallets(id) on delete set null,
  partner_id        uuid references public.referral_partners(id) on delete set null,
  client_id         uuid,
  unit_id           text,
  amount_rupiah     numeric not null,
  points_used       integer not null default 0,
  -- metode pencairan (K2: withdraw ATAU bayar lisensi)
  payout_type       text not null default 'withdraw',  -- 'withdraw' | 'bayar_lisensi'
  bank_info         text,                             -- isi persis dari form portal
  bank_name         text,
  bank_account      text,
  account_name      text,
  status            text not null default 'pending', -- pending|disetujui|dibayar|ditolak
  admin_note        text,
  processed_by      text,
  processed_at      timestamptz,
  paid_at           timestamptz,
  evidence_url      text,                           -- bukti transfer
  created_at        timestamptz not null default now(),
  constraint payout_requests_type_chk   check (payout_type in ('withdraw','bayar_lisensi')),
  constraint payout_requests_status_chk check (status in ('pending','disetujui','dibayar','ditolak'))
);
```

> **Revisi Fase 1 (2026-10-26):** `partner_id` = pemilik request (mitra),
> `wallet_id` = dompetnya, `client_id` opsional (NULL untuk mitra referral-only).
> `bank_info` nampung string persis dari form portal (`BCA 123 a.n. Tanti`),
> kolom terstruktur dipakai admin saat proses.

### 4.5 Kolom baru di `clients` (5 kolom — bukan tabel order baru)

```sql
alter table public.clients
  add column purchase_code       text,        -- kode yang dipakai saat beli
  add column purchase_discount   numeric not null default 0,
  add column price_paid          numeric,     -- nominal yang benar-benar dibayar
  add column voucher_id          uuid,        -- license_codes.id
  add column referred_by_code    text;        -- kode referal yang dipakai
```

> **Alasan bukan tabel `license_orders`:** seluruh flow pembelian sudah keyed di
> `clients.unit_id`, RLS `clients` sudah ada (hybrid anon/authenticated), UI admin
> sudah baca `clients`. Tabel order = 1 entitas + 1 policy + 1 join di 2 UI tanpa
> menambah kemampuan nyata untuk prototipe.

### 4.6 Tabel yang TIDAK diubah

`products` · `licenses` · `license_devices` · `promos` · `vouchers` ·
format serial · salt · algoritma HMAC · `license.logic.js` · `license-core.js` ·
`tpa/IDENTITY-CONTRACT.md` (HUB masih freeze).

---

## 5. RPC yang dibutuhkan

| RPC | Type | Fungsi |
|---|---|---|
| `code_apply_discount(p_code, p_unit_id, p_client_id, p_app_type, p_price)` | DEFINER | Validasi kode untuk channel diskon → hitung diskon → catat `code_redemptions` → **award poin ke pengundang** → update `clients.purchase_*` → return `{ok, discount, final_price, points_awarded}` |
| `code_redeem_license(p_code, p_unit_id, p_device_code, p_install_id, p_app_type)` | DEFINER | Validasi kode untuk channel lisensi (kode `kind='voucher'` + `grant_*`) → consume (atomic, `FOR UPDATE`) → buat `licenses` + `license_devices` → update `clients` → **award/pending poin** → return `{ok, salt, prefix, exp_code, license_id}` |
| `referral_my_code(p_client_id, p_app_type)` | DEFINER | Ambil/buat kode referal milik pemanggil (idempoten) |
| `wallet_my_balance(p_client_id)` | DEFINER | Saldo poin + rupiah + pending |
| `payout_request(p_client_id, p_points, p_amount, p_type, p_bank_info)` | DEFINER | Buat request pencairan (pending), potong saldo → `withdrawable`/`points_balance`. **Cadence:** maks **1 request per siklus payout** (7 hari kalau mitra punya lisensi, 30 hari kalau referral-only) — request berisi seluruh saldo yang sudah lepas siklus. Diproses manual admin (owner transfer bank sendiri). |
| `referral_resolve_pending()` | DEFINER | Dipanggil cron/manual: lepas reward yang sudah **lewat 1 siklus payout** → `points_pending` → `points_balance`. Siklus = **7 hari** (mitra punya lisensi) / **30 hari** (mitra referral-only), dihitung dari **status mitra**, bukan dari tier poin. **Berulang** — dijalankan terus tiap siklus, bukan sekali. |
| `partner_session(p_token)` | DEFINER | Validasi **token akses portal** (D3 — token dikirim via WA) → return `{ok, partner_id, client_id, code, status, tier, has_license, payout_cycle_days, next_payout_date, nama, kota}`. Dipakai `mitra/src/pages/portal.astro`. |
| `partner_my_balance(p_token)` | DEFINER | Saldo poin mitra (siap / dalam siklus / total / rupiah). |
| `partner_referrals(p_token)` | DEFINER | Daftar referral milik mitra → `[{name, city, product, status, points, date}]`. Dipakai section "Riwayat Referral" + "Klien Saya". |
| `partner_payouts(p_token)` | DEFINER | Riwayat pencairan mitra → `[{id, date, points, amount, status, note}]`. Dipakai section "Riwayat Pencairan". |
| `partner_register(p_nama, p_wa, p_kota, p_provinsi, p_email, p_produk, p_catatan)` | DEFINER | **Pendaftaran mitra** (Fase 2) → bikin `referral_partners` (aktif), `referral_wallets`, `license_codes` (referral) + terbitkan token portal (mentah, sekali). Return `{ok, partner_id, code, nama, portal_token}`. Guard: 1 WA = 1 mitra (WA terdaftar → ditolak **tanpa** token), anti-spam 20 daftar/jam. **Revisi v9 (26/10):** `p_produk` **selalu `'*'`** — kode referral mitra **universal** (`license_codes.app_type='*'`), berlaku buat seluruh produk Kasir Solo (§14.2 item 3). |
| `partner_claim_referral(p_code, p_nama, p_wa, p_kota, p_app_type)` | DEFINER | **Klaim diskon dari kode referral** (Fase 2) → catat ledger `code_redemptions` (poin 5 tier free, hold 7/30 hari) + terbitkan voucher diskon `DSK-…` untuk refereenya. Return `{ok, code, voucher_code, discount, min_purchase, points, expires_at}`. Guard: anti self-referral, idempoten per WA. **Revisi v9 (26/10):** voucher `DSK-…` sekarang **ikut `p_app_type`** — produk yang dipilih referee (`'*'` = semua aplikasi); sebelumnya hardcode `kaki5`. **Revisi v10 (26/10):** juga dipakai form daftar (`/daftar`) saat kolom kode referal diisi — pengundang dapat 5 poin, pendaftar dapat voucher diskon. |
| `partner_mark_purchase(p_partner_id, p_phone)` | DEFINER | **Admin** — naikkan poin referral 5 → 50 (tier paid) saat pembelian refereenya tercatat. |
| `partner_approve(p_partner_id, p_action, p_note)` | DEFINER | **Admin** — `approve` / `reject` / `suspend` + terbitkan token portal baru. |

> **REVISI KONTRAK RPC — 2026-10-26 (implementasi Fase 1).** Kelima RPC portal
> di atas **berbasis TOKEN**, bukan `partner_id` / `client_id`:
>
> | | kontrak lama (usulan) | kontrak yang dipakai |
> |---|---|---|
> | session | `partner_session(p_token)` | `partner_session(p_token)` (tetap) |
> | saldo | `wallet_my_balance(p_client_id)` | `partner_my_balance(p_token)` |
> | referral | `partner_referrals(p_client_id)` | `partner_referrals(p_token)` |
> | pencairan | `partner_payouts(p_client_id)` | `partner_payouts(p_token)` |
> | request | `payout_request(p_client_id, …)` | `payout_request(p_token, …)` |
>
> **Alasan:** parameter bebas = siapa pun bisa menunjuk wallet mitra orang lain.
> Dengan token, identitas mitra ditentukan **di dalam fungsi** (server validasi),
> bukan oleh browser. Token disimpan di `referral_partners.portal_token_hash`
> sebagai **SHA-256** — isi DB bocor ≠ token portal bocor.
> `wallet_my_balance(p_client_id)` sendiri **ditunda** ke Fase 3 (kartu "Ajak
> Teman" di kaki5, saldo milik pengguna app — bukan mitra).
>
> Plus 2 RPC khusus admin (hanya `service_role`, anon **DITOLAK**):
> `partner_issue_token(p_partner_id, p_days)` → terbitkan token portal (mentah,
> dikembalikan sekali) · `referral_resolve_pending()` → lepas reward yang sudah
> lewat 1 siklus payout (`points_pending` → `points_balance`), dipanggil dari
> Control Center / cron. |

> Semua `SECURITY DEFINER` + `SET search_path TO ''` + qualify `public.`
> — pola identik `license_activate_device` yang sudah ada.

**Kenapa RPC, bukan endpoint Vercel baru?**
Konsisten dengan pola existing (`device_known`, `license_activate_device`).
**Atomic**: consume + buat lisensi + award poin dalam 1 transaksi → dobel-klaim mustahil.
Nol endpoint publik baru yang bisa di-abuse (CORS, spam, rate limit).
RLS tabel kode tidak perlu dibuka ke `anon`.

**Kenapa client yang mint serial (bukan server)?**
Salt **sudah** publik di `products.salt` → tak ada secret baru terekspos.
Kode HMAC+Base32 **sudah ada & teruji** di `kaki5/js/license.logic.js` → nol kode kripto baru.
RPC mengembalikan salt otoritatif yang dipakainya → mustahil divergen.
Gate bisa tetap terbuka di device yang sama tanpa internet.

---

## 6. Alur pengguna (kaki5)

### 6.1 Channel diskon — pendatang
1. Buka app, daftar, dapat **kode referal sendiri** otomatis (semua user).
2. Teman kirim kode. User buka **"💰 Beli Lisensi"** → tempel kode → **"Terapkan"**.
3. Sheet menampilkan: ~~Rp 500.000~~ → **−Rp 50.000 (kodereferal)** → **Bayar Rp 450.000**.
4. Transfer + upload bukti → `clients.status='menunggu_verifikasi'` + `purchase_code` + `purchase_discount` + `price_paid`.
5. Admin verifikasi → aktivasi (dan **sekalian menulis `licenses` + `license_devices`** — closing gap §2.1).
6. **Pengundang** dapat **poin pending** (lihat §7).

### 6.2 Channel lisensi — pemilik kode voucher
1. User yang beli voucher dari admin (transfer ke admin, dapat kode `KK5-XXXX-XXXX`).
2. Buka app → gate "Masa Coba/Lisensi Habis" → **"🎫 Punya kode voucher?"** → tempel → **"Tukar"**.
3. RPC consume atomik → buat `licenses` + `license_devices` → client mint serial (HMAC) → **gate terbuka < 3 detik, tanpa admin**.

### 6.3 Kartu "🤝 Ajak Teman"
- Kode saya (tombol salin + share WA) + poin saya (siap / pending) + tombol **"💵 Tarik Saldo"**.
- Share text: `Hai! Saya pakai Kasir Solo. Coba juga — pakai kode {CODE} dan dapat diskon.`
- Riwayat: berapa yang inviting, berapa pending, berapa sudah dicairkan.

### 6.4 Pencairan (K3c — manual)
1. User isi form: jumlah poin/rupiah, rekening tujuan, atau pilih **"pakai untuk bayar lisensi"**.
2. RPC buat `payout_requests` (status `pending`), saldo dipotong dari `points_balance` → `withdrawable`.
3. Admin buka tab Referral → **Setujui** → **Tandai Dibayar** (transfer manual) → user dapat notifikasi.
4. Kalau `payout_type='bayar_lisensi'` → saldo jadi **potongan harga** di sheet pembelian (tanpa transfer).

---

## 7. Reward & Ekonomi

### 7.1 Alur poin (K2 + K3b)

Reward punya **dua dimensi yang terpisah** (revisi 2026-10-25), dan **berakumulasi** di saldo mitra:

| Dimensi | Penentu | Efek |
|---|---|---|
| **Besaran reward (poin)** | Apakah **referee** (orang yang lo tunjuk) **beli lisensi**? | Beli → tier `paid` **+50 poin**. Nggak beli → tier `free` **+5 poin**. |
| **Siklus payout** | **Status mitra itu sendiri** | Punya lisensi → **payout per 7 hari**. Fokus referensi doank tanpa lisensi → **payout per 30 hari**. **Berulang terus-menerus**, bukan sekali lalu habis. |

```
Pengguna baru pakai kode referal  →  event referral dibuat
                                     │
        ┌────────────────────────────┴────────────────────────────┐
        │ BESARAN POIN (dari referee)          │ SIKLUS PAYOUT (dari mitra) │
        ▼                                     ▼                     ▼
REFeree BELI LISENSI → tier "paid"     Mitra punya lisensi        → payout per 7 hari
                   → +50 poin            (klien yg jg rekomendasi) │
REFeree TIDAK BELI  → tier "free"                                  │
                   → +5 poin             Mitra fokus referensi    → payout per 30 hari
                                          doank tanpa lisensi      │
                                     │                                 │
                                     └────────► masuk `points_balance` ◄┘
                                                  (diakumulasi, bisa dicairkan)
```

> Jadi **mitra referral-only yang jualan sukses** tetap dapat 50 poin — cuma bisa dicairkan
> **per 30 hari**. Mitra yang sudah jadi klien bisa payout **per 7 hari** karena risikonya
> lebih rendah. Reward **nggak hangus** — numpuk di saldo, cuma nunggu siklus payout.
>
> **Siklus = berulang, bukan sekali.** Setelah satu siklus selesai, siklus berikutnya tetap
> jalan: reward baru yang masuk nunggu giliran siklus berikutnya, dan mitra boleh request
> payout lagi di siklus berikutnya. Mitra referral-only **juga payout per 30 hari** terus
> nerus — bukan "dicairkan sekali lalu selesai".

### 7.2 Konfigurasi (semua di `settings.referral_config` — bisa diubah admin tanpa deploy)

| Parameter | Nilai default | Catatan |
|---|---|---|
| `points_to_rupiah` | `1000` | 1 poin = Rp 1.000 |
| `points_per_paid_referral` | `50` | = Rp 50.000 per referral jadi klien paid |
| `points_per_free_referral` | `5` | = Rp 5.000 per referral yang tidak convert |
| `payout_cycle_days_licensed` | `7` | siklus payout — **mitra punya lisensi** (klien yg jg rekomendasi) |
| `payout_cycle_days_referral_only` | `30` | siklus payout — **mitra fokus referensi doank, tanpa lisensi** |
| `discount_referral` | `50000` | diskon pendatang (flat Rp) |
| `discount_type` | `fixed` | `fixed` \| `percent` |
| `min_purchase_for_discount` | `100000` | minimal pembelian utk pakai diskon |
| `min_payout_rupiah` | `50000` | minimal request pencairan |
| `max_payout_per_request` | `500000` | kontrol atas request per periode |
| `max_balance_rupiah` | `1000000` | plafon saldo |
| `referral_expire_days` | `30` | masa berlaku kode referal |

### 7.3 Margin check (angka jujur)

| Skenario | Omzet | Beban | Net |
|---|---|---|---|
| Pembeli normal | Rp 500.000 | — | **Rp 500.000** |
| Pembeli via referal | Rp 450.000 | poin Rp 50.000 | **Rp 400.000** (−20%) |
| Pembeli via referal (skema konservatif) | Rp 475.000 | poin Rp 25.000 | **Rp 450.000** (−10%) |

> ⚠️ Default di atas = **CAC 20%**. Konservatif 10% lebih aman untuk kondisi sekarang
> (1 pelanggan bayar, target 10–15 jual/bulan). Semua angka **config-driven** —
> bisa diturunkan tanpa deploy begitu ada data 1–2 bulan.
> Kunci: **referral harus Incremental**, bukan ganti penjualan yang sudah terjadi.

---

## 8. Anti-fraud (wajib)

| Ancaman | Penanganan |
|---|---|
| Self-referral | Tolak `referrer_unit_id = referee_unit_id` / `device_code` sama / WA sama |
| Akun dummy farming poin | Reward nunggu **1 siklus payout** (7/30 hari, K3b) + hanya cair saat penerima **benar-benar redeem** |
| Kode dipakai 2× | `FOR UPDATE` lock + status transition dalam 1 transaksi |
| Kode bocor (di-forward/screenshot) | Kode bind ke `device_code` saat redeem; kode ≠ lisensi utuh |
| Spam redeem | Rate limit RPC (mis. 5 percobaan/jam/device) + kode 16 char untuk voucher |
| Kode ditebak | Entropi cukup + `unique` + retry. Kode referral pendek = human-readable (bukan rahasia) |
| Diskon melebihi harga | Cap `discount <= price`, `max_discount`, `min_purchase` |
| Saldo keluar berlebihan | `min_payout`, `max_payout_per_request`, plafon saldo, verifikasi manual admin |
| Reward dicuri admin | Semua award lewat RPC, bukan update manual dari browser |

---

## 9. Fase & estimasi

| Fase | Isi | Estimasi |
|---|---|---|
| **1. inti — kode & lisensi** | migrasi 4 tabel + 5 kolom `clients` · RPC `code_redeem_license` + `referral_my_code` · tab "🎫 Kode" di Control (bikin batch + list + status) · sheet redeem di gate kaki5 · **closing gap `licenses`** | **3 hari** |
| **2. inti — diskon & poin** | RPC `code_apply_discount` + `wallet_my_balance` · input kode di sheet pembelian + tampilan harga akhir · tab "🤝 Referral" (leaderboard, wallet) · kartu "🤝 Ajak Teman" di kaki5 · award poin + siklus payout | **3 hari** |
| **3. pencairan manual** | RPC `payout_request` · form pencairan di kaki5 · UI proses pencairan di Control · `referral_resolve_pending` | **1,5 hari** |
| **4. polish** | statistik dashboard · template WA blast · guard anti-fraud · docs · replikasi ke rosok | **2 hari** |

**Total: ~9,5 hari kerja.** Fase 1 saja (3 hari) sudah bernilai —
produk bisa dijual dalam bentuk kode tanpa transfer per-pembeli.

---

## 10. Asumsi yang gue pakai (koreksi kalau beda)

1. **1 poin = Rp 1.000**, 50 poin per referral jadi klien paid, 5 poin per referral non-paid.
2. **Diskon pendatang = Rp 50.000 flat** (10% dari harga kaki5 Rp 500.000).
3. **Saldo bisa dipakai untuk dua hal**: withdraw (transfer manual admin) **atau**
   potong harga lisensi sendiri.
4. **Poin pending tidak hangus** setelah 1 siklus payout selesai — dicairkan sebagai nilai kecil
   (5 poin), bukan expired. Kalau mau hangus, tinggal ubah config.
5. **HUB tetap freeze** → kode referal diikat ke `unit_id` (device), kolom
   `global_identity_id` disiapkan untuk migrasi nanti.
6. **Tidak ada tabel order** untuk pembelian lisensi → riwayat "dibayar berapa,
   pakai kode apa" lewat 5 kolom di `clients`.
7. **Runner agent masih mati** → WA blast voucher/referral **manual dulu**
   (via `wa_broadcast_log`), atau hidupkan runner duluan.

---

## 11. Risiko

1. **Ekonomi belum teruji** — CAC 20% itu asumsi. Kalau ternyata referral bukan
   kanal yang mengubah penjualan, angka economics-nya perlu diturunkan.
2. **Cold-broadcast WA sudah gagal** (2 minggu, 0 hasil) → jangan pakai WA blast
   sebagai kunci; kode referal harus datang dari **pembeli yang sudah satisfied**.
3. **Gap `licenses`** harus ditutup di Fase 1, kalau tidak kuota meleset.
4. **Punto siklus payout 30 hari** menahan likuiditas pengundang → angka 7/30 hari
   perlu ditinjau setelah data pertama masuk.
5. **App klien lain belum ikut** — RPC generik, tapi tiap app butuh UI sendiri
   (+0,5 hari per app).

---

## 12. K5 — Registrasi referal/mitra VIA WEBSITE ⇒ modul manajemen mitra ("modul HUB")

> Klarifikasi pemilik 2026-10-24: *"semua orang bisa mendaftar menjadi referal … user
> registrasi via website"* dan *"kita mesti siapin modul manajemen referal/mitra —
> ini yang kemarin gue maksud dengan modul HUB"*.

### 12.1 Arti dari klarifikasi ini

| Asumsi lama | Facta baru |
|---|---|
| Setiap user app otomatis dapat kode referal | **Tidak.** Yang daftar **eksplisit** = orang yang mau jadi **mitra** (partner/reseller/promotor). |
| "HUB" = universal identity lintas aplikasi | **Tidak.** "HUB" = **modul manajemen referal/mitra**. Definisi yang tadinya beku jadi konkret. |
| Front door = app kaki5 | **Front door = website.** App kaki5 hanya konsumen kode. |

> ⚠️ **Efek ke HUB lama:** `docs/HUB-DESIGN-DECISIONS.md` (Fase 1 akun & binding, OTP recovery)
> **tetap beku** — tidak disentuh. Yang di-unfreeze cuma **slice "manajemen mitra"**:
> identitas mitra (bukan identitas universal), kode, poin, payout.
> Fase 0 HUB (`global_identities`, `app_memberships`) boleh dipakai ulang sebagai
> tempat mitra, tapi **tidak** migration baru yang menyentuh kontrak HUB.

### 12.2 Temuan lapangan website (verifikasi live)

| Fakta | Bukti |
|---|---|
| `www.kasirsolo.com` **sudah live** dan itu **kasol-v2 `apps/website`** (Next.js 15 + Turborepo) | `<title>PT MESIN KASIR SOLO - Savage Business Tools</title>`, `_next/static/chunks/*`, `X-Nextjs-Prerender: 1`, favicon SVG identik dengan `packages/ui/Logo.tsx`, JSON-LD `Perum Graha Tiara 2 B1 … Kartasura 57169` |
| Hanya **1 subdomain** hidup: `www` (shop/mitra/portal/admin → 000, tidak ada DNS) | probe HTTP 8 subdomain |
| `kasol-v2/apps/mitra` **sudah ada sebagai skeleton** | brand **"MKS.MITRA"**, nav: Overview · Partner Database · Aktifitas · **Forum Mitra** · **Bagi Hasil** · Konfigurasi · **Security Hub** |
| Tapi **data-nya masih mock** | `apps/mitra/contexts/DataContext.tsx` → `setPartners([])` setelah 1 dtk |
| Data layer kasol-v2 = **Firebase**, bukan Supabase | `packages/data/remote-db.ts` → `firebase/firestore`; `firestore.rules`, `firebase-blueprint.json` |
| `kasol-v2` **tidak punya `.git`** dan **tidak punya `.vercel`** | `Get-ChildItem -Force` → tidak ada; cari `*.vercel/project.json` di 3 depth → kosong |
| Artinya **source deploy website tidak ada di workspace ini** | live site age ≈ 46 hari; mirror `GitHub/kasol` tidak punya `website/`/`mitra/` |
| **Tidak ada token Vercel API** untuk deploy dari sini | `VERCEL_OIDC_TOKEN` = token OIDC **scoped** `project:admin-kasol / environment:development`, expired |
| `shop/` (funnel HTML lama "Bayar Sekali Seumur Hidup") **tidak lagi live** | `www.kasirsolo.com` menyajikan Next.js, bukan `shop/index.html` |

> 📌 **Bridge brand:** `packages/shared/src/config/ai-system.ts` menetapkan persona MKS:
> bicara **"Lo/Gue"**, dilarang "Anda/Saya", gaya "street-smart". Bahasa modul mitra
> harus mengikuti ini — **bukan** formal-korporat. Ini konsisten dengan gaya
> "Lo/Gue" yang selama ini lo pakai.

### 12.3 Arsitektur 4 lapis

```
┌────────────────────────────────────────────────────────────────┐
│ LAPIS 1 — WEBSITE (kasol-v2/apps/website)  →  LIVE di Vercel    │
│   • Halaman "Jadi Mitra" / form pendaftaran (public)            │
│   • CTA di hero & footer → form pendaftaran                    │
└───────────────────────────┬────────────────────────────────────┘
                            │ INSERT referral_partners (status=pending)
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ LAPIS 2 — MODUL MANAJEN MITRA ("HUB")                          │
│   a) ADMIN  → tab "🤝 Mitra" di Control Center (repo kasol)   │
│   b) MITRA  → portal (kode, poin, ajukan payout)              │
└───────────────────────────┬────────────────────────────────────┘
                            │ baca/tulis license_codes + wallet
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ LAPIS 3 — SUPABASE (hhywr…)  ← SATU-SATUNYA sumber kebenaran  │
│   referral_partners · license_codes · code_redemptions ·       │
│   referral_wallets · payout_requests · clients (+5 kolom)      │
└───────────────────────────┬────────────────────────────────────┘
                            │ kode dipakai di app
                            ▼
┌────────────────────────────────────────────────────────────────┐
│ LAPIS 4 — APP KAKI5 (prototipe konsumen kode)                  │
│   • Gate lisensi → "🎫 Punya kode voucher?" → redeem instan  │
│   • Sheet pembelian → input kode referal → diskon             │
└────────────────────────────────────────────────────────────────┘
```

### 12.4 Tabel baru: `referral_partners` (inti modul mitra)

```sql
create table referral_partners (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null,      -- kode referal mitra, mis. 'TOKO-8F2K'
  app_type          text not null default 'kaki5',
  app_key           text not null default 'kaki5',  -- app yang di-promosikan

  -- identitas mitra (dipisah dari identitas app client!)
  user_id           uuid,                       -- auth user (opsional, boleh null)
  global_identity_id text,                     -- reuse HUB Fase-0 bila tersedia
  client_id         uuid references public.clients(id) on delete set null,  -- NULL = afiliator murni
  nama              text not null,
  no_whatsapp       text not null,
  email             text,
  nik               text,                      -- untuk legit pencairan
  kota              text,
  provinsi          text,
  alamat            text,

  -- pencairan (dipakai saat request payout)
  bank_name         text,
  bank_account      text,
  account_name      text,

  -- akses portal (D3: token via WA, bukan password) — Fase 1
  portal_token_hash       text,                -- sha256 hex token (mentah TIDAK disimpan)
  portal_token_created_at timestamptz,
  portal_token_expires_at timestamptz,

  -- status & tier
  status            text not null default 'pending',
      -- pending | aktif | ditolak | nonaktif | suspend
  tier              text not null default 'bronze',   -- bronze | silver | gold
  notes             text,
  approved_by       text,
  approved_at       timestamptz,
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint referral_partners_status_chk
    check (status in ('pending','aktif','ditolak','nonaktif','suspend'))
);
```

> **Implementasi Fase 1 (2026-10-26).** Tabel ini + `referral_wallets` +
> `payout_requests` + `license_codes` + `code_redemptions` **sudah live** di
> Supabase `hhywr…` (RLS ON, tanpa policy untuk anon — data cuma bisa dibaca
> lewat RPC `SECURITY DEFINER`). Kolom `client_id` (§14.2) + `portal_token_hash`
> (D3) sudah masuk di versi implementasinya — hash token, bukan token mentah.
> Anti-fraud "1 WA = 1 mitra aktif" dijamin unique index parsial
> `(lower(btrim(no_whatsapp))) where status in ('pending','aktif')`.

**Pemisahan penting:** mitra **bukan** `clients`. `clients` = perangkat/outlet pengguna app.
`referral_partners` = orang yang **menjual** aplikasi. Satu WA bisa jadi keduanya
(ada yang pakai app **dan** jadi mitra) — tabel terpisah biar tidak kacau.

> `license_codes.owner_client_id` (mitra yang **memiliki** kode) → arahkan ke
> `referral_partners.id` lewat kolom baru `owner_partner_id`. Yang **memakai** kode
> tetap `clients`.

### 12.5 Alur pendaftaran mitra (via website)

```
1. Website (kasol-v2) → halaman /mitra  →  form: nama, WA, kota, alasan/portfolio
2. INSERT referral_partners (status='pending') + catat referral_event
3. Notifikasi ke admin (WA / tab Control)
4. Admin di tab "🤝 Mitra" → review → SETUJUI
      → status='aktif' → generate license_codes(kind='referral', owner_partner_id=…)
      → tier ditentukan dari histori
      → kirim WA: "Kode kamu: TOKO-8F2K"
5. Mitra buka portal → login → lihat kode, poin, ajukan payout
```

**Kenapa perlu approval admin (bukan auto-approve)?**
Program ini paying — poinnya ditulis ke saldo mitra. Auto-approve = siapa pun bisa daftar
membuat akun & farming. Approval juga jadi **filter kualitas** (mitra yang beneran
jualan, bukan sekadar daftar).

### 12.6 Portal mitra — isi & role

| Menu (mengikuti skeleton MKS.MITRA) | Isi | Prioritas |
|---|---|---|
| **Overview** | kode saya, poin siap/pending, jumlah.Unsafe invite, status | 🔴 P0 |
| **Kode Saya** | kode referal + tombol salin + share WA + link invite | 🔴 P0 |
| **Klien Saya** | daftar yang pakai kode saya (nama toko, kota, status) | 🟠 P1 |
| **Poin & Saldo** | poin, konversi ke rupiah, riwayat poin | 🔴 P0 |
| **Ajukan Pencairan** | form payout (withdraw / bayar lisensi) | 🔴 P0 |
| **Forum Mitra** | diskusi antar mitra (opsional, butuh moderasi) | 🟢 P2 |
| **Security Hub** | ganti token, riwayat perangkat, 2FA | 🟢 P2 |

### 12.7 Control Center — tab "🤝 Mitra" ( sisi admin)

| Fitur | Isi |
|---|---|
| **Pendaftaran masuk** | list `status='pending'` → approve/reject + catatan |
| **Database mitra** | semua mitra, filter status/tier, cari nama/WA |
| **Kode** | buat kode admin (`kind='voucher'`), batch, export CSV, matikan kode |
| **Leaderboard** | mitra dengan invite/klien paid terbanyak (motivasi + deteksi penyalahgunaan) |
| **Konfigurasi reward** | `settings.referral_config`: poin, siklus payout 7/30 hari, nilai diskon, rate konversi — **tanpa deploy** |
| **Payout** | list `payout_requests` → approve → tandai dibayar + catatan transfer |
| **Aktivitas** | audit `code_redemptions` (siapa pakai kode mana, kapan) |
| **Tiers** | naikkan tier mitra otomatis berdasarkan jumlah klien paid |

### 12.8 Realita deploy (penting — harus diputuskan)

| Opsi | Cara ship | Data layer | Git? | Verdict |
|---|---|---|---|---|
| **A. Static di repo kasol** (`mitra/`) | 1 project Vercel baru, rootDirectory `mitra/`, **git integration** (push mirror → auto-deploy, **tanpa token CLI**) | Supabase (RLS + RPC) | ✅ | 🟢 **DIPILIH — 2026-10-25** (D1) |
| **B. Next.js di kasol-v2** | butuh **git + .vercel + akses Vercel** untuk project website — tidak ada di workspace ini | Firebase (harus ganti ke Supabase) | ❌ | 🟠 Butuh setup user |
| **C. Cuma di Control Center** | admin input manual, mitra cuma terima kode via WA | Supabase | ✅ | 🟡 Opsi termurah, tapi UX & skala jelek |

> Kenapa **A** lebih aman sekarang:
> 1. **Deploy path sudah terbukti** — repo kasol pakai Vercel git integration (push ke
>    mirror → auto-deploy). Tidak butuh Vercel token, tidak butuh `vercel login` interaktif.
> 2. **Data satu sumber** — lisensi, kode, poin, wallet semuanya Supabase dengan
>    RLS + RPC `SECURITY DEFINER`. Kalau portal-nya di Firebase, ada 2 database
>    untuk 1 fitur → bobot & sinkronisasi.
> 3. **Version control** — kasol-v2 **tidak punya `.git`**. Membangun fitur produksi
>    tanpa version control = tanpa rollback. Ini risks yang harus ditutup dulu.
> 4. **Konsisten dengan Control** — tab admin ada di repo yang sama → 1 commit.
>
> Opsi B tetap menarik karena design MKS.MITRA sudah jadi — solusinya: **port visual**
> (sidebar MKS.MITRA, GlassCard, tema zinc + brand-500, gaya bahasa Lo/Gue) ke
> static page, dan **user yang menambahkan CTA "Jadi Mitra"** di kasol-v2
> (snippet gue siapkan).

### 12.9 Yang harus ditutup sebelum jalan

| Item | Status |
|---|---|
| **kasol-v2 tanpa `.git`** | ✅ **Nggak Relevan** lagi — D1 pilih app terpisah `mitra/` (git-tracked di repo kasol) |
| Vercel project baru untuk `mitra/` | 🔴 **Blocker deploy** — 1 langkah manual owner (buat project + connect repo + set rootDirectory `mitra/` + DNS `mitra.kasirsolo.com`) |
| Tabel `referral_partners` + RPC portal | ✅ **SELESAI 26/10/2026** — 5 tabel + 7 RPC live di `hhywr…`. Dashboard portal bukan mock lagi (bilang token → data live). Tinggal `partner_register`/`partner_approve` (Fase 2) + pencatatan referral dari kode (Fase 3) |
| `settings.referral_config` | 🟢 diisi dari Control (bukan hardcode) |
| Bahasa modul mitra | 🟢 gaya Lo/Gue (persona MKS), bukan formal |

---

## 13. Pembaruan Fase (revisi v3)

| Fase | Isi | Estimasi | Revisi |
|---|---|---|---|
| **1. Kode & lisensi** | migrasi 4 tabel + `referral_partners` + kolom `clients` · RPC `code_redeem_license` · tab "🎫 Kode" di Control · sheet redeem di kaki5 · closing gap `licenses` | 3 hari | +0,5 (tabel mitra) |
| **2. Modul mitra (HUB slice)** | halaman program di app `mitra/` (registrasi, static) · RPC `partner_register` + `partner_approve` · tab "🤝 Mitra" di Control · generate kode referral saat approve | 3 hari | 🆕 |
| **3. Diskon & poin** | RPC `code_apply_discount` + wallet · input kode di sheet pembelian · kartu "Ajak Teman" di kaki5 · award poin + siklus payout | 3 hari | — |
| **4. Portal mitra** | portal statis (login/token) · kode saya · poin · form payout + approve di Control | 3 hari | 🆕 |
| **5. Polish** | statistik dashboard · leaderboard · tier otomatis · WA blast template · guard anti-fraud · replikasi rosok | 2 hari | — |

**Total: ~14 hari kerja.** (v2 = 9,5 hari; v3 +4,5 hari karena modul mitra + portal.)

---

## 14. Keputusan yang sudah diambil (v3 final)

| # | Keputusan | **HASIL** | Catatan |
|---|---|---|---|
| **D1** | **Hosting portal mitra** | **App terpisah `mitra/` (Astro)** di `C:\Users\Admin\Documents\kasol\mitra`, domain `mitra.kasirsolo.com` | 🆕 **REVISI 2026-10-25** — sebelumnya `company/`. Lihat §16 |
| **D2** | Approval pendaftaran mitra | **Auto-approve setelah verifikasi WA** | Approval admin jadi **suspended/manual override**, bukan default |
| **D3** | Akses portal mitra | **Token akses via WA** | Nggak ada password, nggak ada akun yang harus dibuat |
| **D4** | Scope modul mitra | **P0 saja** | DB mitra · approval/verifikasi · kode · poin · payout · leaderboard. Forum & Security Hub **tunda** |
| **D5** | Arti kata "mitra" | **DIBEDAKAN** — lihat §14.2 | Di website "mitra" = **klien**; di program referal = **orang yang merekomendasikan** (bisa klien, bisa afiliator/reseller) |
| **D6** | Penempatan CTA | **Pojok kanan atas header, menggantikan CTA "Tanya Founder"** | Sudah diimplementasikan di `company/` — header → "JADI MITRA" (target `https://mitra.kasirsolo.com/`) |

### 14.2 D5 — Klarifikasi istilah "mitra" (KRITIS — jangan dibalik)

Kata **"mitra"** dipakai dengan **dua makna berbeda** di ekosistem Kasol:

| Konteks | Arti | Contoh |
|---|---|---|
| **Website / marketing** | **Klien** = pengguna aplikasi | `"500+ Mitra Mesin Kasir"` (`company/src/data/local.ts`), `"Mitra Lo."` (`index.astro`), tagline footer `"Mitra teknologi"` |
| **Program referal (modul ini)** | **Orang yang merekomendasikan** | Bisa **klien** yang juga mau rekomendasi, bisa **afiliator/reseller** yang fokus jualan |

**Konsekuensi ke desain:**

1. **Database tetap terpisah** — `referral_partners` ≠ `clients`.
   `referral_partners` = orang yang **menjual**; `clients` = perangkat/outlet **pengguna**.
   Satu WA boleh ada di keduanya (klien yang juga afiliator).
   Kolom penghubung: `referral_partners.client_id` (NULL = afiliator murni).
2. **Label UI harus aman dari ambiguitas.** Halaman program mitra menjelaskan selisihnya secara
   eksplisit di section "Biar Nggak Salah Paham".
3. **Kode referal bersifat universal** (`app_type='*'`), bukan per produk:
   satu kode bisa dipakai untuk diskon di produk apa pun → **satu link untuk di-share**.
   Kode `voucher` (dibuat admin) tetap per produk (`KK5`/`KSR`/`MML`) karena efeknya
  giving lisensi.
4. **Jangan pakai "mitra" di dalam teks yang menyiratkan pengguna aplikasi.**
   Untuk konteks program, pakai "mitra program" atau "afiliator" sesuai konteks.

> ⚠️ Kalau nanti konten marketing memakai "mitra" untuk menyebut **penguna aplikasi**,
> pastikan tidak berdekatan dengan UI program — istilah yang sama, audiens beda.

### 14.3 D6 — CTA "JADI MITRA" di pojok kanan atas (SUDAH DIIMPLEMENTASIKAN)

`company/src/layouts/Base.astro` — CTA header diganti:

```astro
<!-- SEBELUM -->
<a class="btn btn-primary nav-cta" href={wa.me/...} target="_blank">
  <span data-i18n="nav.tanyaFounder">Tanya Founder</span>
</a>

<!-- SESUDAH (target sudah absolut ke app terpisah — revisi 2026-10-25) -->
<a class="btn btn-primary nav-cta" href="https://mitra.kasirsolo.com/">
  <span data-i18n="nav.jadiMitra">Jadi Mitra</span><span class="shine"></span>
</a>
```

**Efek samping yang perlu diketahui:**
- CTA "Tanya Founder" **hilang dari header desktop**. Tapi jalur WA founder **tidak hilang**:
  tombol bubble WA di header mobile (`.nav-wa-short`), footer ("Hubungi Kami" + "Chat with
  the Founder"), dan section CTA di `/`.
- Halaman program **wajib ada** supaya CTA nggak 404 → sekarang ada di app terpisah
  `mitra/` (lihat §14.4). `company/src/pages/mitra.astro` **sudah dihapus**.

### 14.4 Halaman program mitra — pindah ke app terpisah `mitra/`

**Lokasi sekarang: `mitra/src/pages/index.astro`** (repo `C:\Users\Admin\Documents\kasol\mitra`,
Astro, port dev **13132**, domain `mitra.kasirsolo.com`).

Struktur (semua narasi **dipindah persis**, tanpa poles):
- `/` — landing: Hero · 3 keunggulan · **Dua-duanya Menang** · 3 langkah · **FAQ** (akordeon
  eksklusif) · klarifikasi istilah · **section baru "Portal Mitra"** · form pendaftaran
- `/daftar` — form pendaftaran + "Habis Daftar, Terus Apa?"
- `/portal` — dashboard P0 (Kode Saya · Poin & Saldo · Riwayat Referral · Klien Saya ·
  Ajukan Pencairan · Riwayat Pencairan)
- `/r/<kode>` — link referral buat pihak yang DIREKOMENDASIKAN

**Revisi narasi (v1 → v2).** Alasan CTA program nggak akan convert kalau narasi-nya salah:

| Masalah | Perbaikan |
|---|---|
| H1 "Lo Jual, Gue Bayar" → **menyesatkan**: mitra nggak jualan (pembeli beli langsung ke kami), dan "Gue Bayar" bisa dibaca "kami yang bayar hutang lo" | **"Lo Nunjuk, Dia Beli, Lo Dapet Komisi."** — mekanismenya langsung jelas: lo nunjuk → dia beli → lodapet komisi |
| Keuntungan **pendatang (diskon)** tenggelam di langkah 2 | Dipindah ke **hero** + section **"Dua-duanya Menang"** (tabel: buat lo vs buat mereka). Itu pembeda utama program ini — bukan zero-sum |
| Istilah "poin" terlalu abstrak; orang berpikir "duit" | Dibuat dua lapis: **"komisi"** di narasi (paham), **"poin"** di mekanisme (1 poin = Rp 1.000). Jelas di keunggulan ke-3 + FAQ ke-3 |
| Heading "Cair Nggak Ribet" **kontradiktif** dengan aturan tahan 7/30 hari | Diganti **"Tarik ke Bank, atau Potong Lisensi"** (manfaatnya, bukan mechanismenya). Aturan 7/30 hari dipindah ke FAQ (transparan, bukan scares) |
| "tanpa drama" — nada nggak nyambung | Dihapus |
| Nggak ada penjelasan cara nencairin | Ditambah **FAQ 4 pertanyaan** + JSON-LD `FAQPage` (bonus SEO) |
| Cara Daftar dikasih tahu belakangan | Dipindah ke awal (langkah 1 = "2 menit") |
| FAQ & sectionKeunggulan **nggak switch ke EN** (array tanpa `data-i18n`) | `data-i18n` dinamis ditambahkan → 65 key, 0 missing, 0 orphan |

**Revisi narasi (v2 → v3).** Review dari owner atas 4 komentar di halaman program mitra:

| Masalah | Perbaikan |
|---|---|
| Paragraf "Bukan Zero-Sum" **terlalu abstrak** ("Gitu cara program's kelar — bukan saling ngalahin") — owner bilang: "gue masih bingung memahami narasi ini" | Ditulis ulang jadi kalimat konkret: **"Bukan rebutan — bukan satu orang untung sementara yang lain rugi. Begitu satu orang beli lisensi lewat kode lo, dia dapat diskon dan lo dapat komisi. Dua-duanya untung: lo nambah satu penjualan, dan komisinya langsung masuk ke saldo lo."** → jargon "zero-sum" diterjemahkan langsung di paragraf itu sendiri |
| Langkah 1 bilang "Lo nggak perlu udah punya **kasir** buat mulai" — salah kaprah, "kasir" = alat bukan lisensi | Diganti **"Lo nggak harus punya lisensi untuk mulai nawarin."** → sesuai keputusan K5: mitra **nggak wajib** punya lisensi |
| FAQ pakai `<details>` **bisa kebuka semua bareng** | Jadi **akordeon eksklusif**: `<details name="mitra-faq">` (native grouping) + fallback JS `toggle` handler → buka satu, yang lain auto-close |
| Box klarifikasi istilah **bikin pembaca bingung** (paragraf padat 2 arti "mitra") | Dipecah jadi **2 kartu terpisah** ("Di program ini" vs "Di beranda") + 1 catatan penutup ("Dua-duanya boleh") → `mitra.clearL1/L2/Note`, `mitra.clearD` dihapus |

**Revisi narasi (v3 → v4) + revisi aturan (K3b).** Owner koreksi konteks FAQ "Gimana cara
komisi-nya cair?" — hold 7/30 hari **bukan** berdasarkan referee beli lisensi, tapi berdasarkan
**status mitra itu sendiri**:

| Yang salah | Yang benar |
|---|---|
| FAQ: "Komisi masuk setelah 7 hari (kalau yang lo bawa udah beli lisensi) atau 30 hari (kalau belum)" | **"Komisi lo masuk ke saldo, tapi lamanya beda tergantung status lo. Kalau lo punya lisensi — jadi klien yang sekalian ngar rekomendasi — komisi masuk setelah 7 hari. Kalau lo fokus referensi doank tanpa lisensi sama sekali, komisi masuk setelah 30 hari."** |
| K3b: hold 7/30 hari ngitung dari tier poin (referee paid/free) | Hold ngitung dari **status mitra**: `hold_days_licensed` = 7, `hold_days_referral_only` = 30 |
| §7.1 cuma 1 dimensi (tier → poin + hold) | **2 dimensi terpisah**: besaran poin dari referee (50/5), tempo hold dari mitra (7/30) |
| Skema nggak punya ledger per-reward | `code_redemptions` + `hold_until` + `points_released_at` (wajib, biar `referral_resolve_pending()` bisa nentuin mana yang sudah lepas hold) |

> **Konsekuensi ekonomi:** mitra referral-only yang jualan sukses tetap dapat **50 poin**, cuma
> ngantre **30 hari** sebelum bisa dicairkan. Mitra yang sudah jadi klien dapat release cepat
> (7 hari) karena risikonya lebih rendah. Tier poin **tidak** berubah — masih 50/5.

**Revisi narasi (v4 → v5).** Owner ganti lagi kata "masuk saldo setelah N hari" → **siklus
payout** + minta poin disebut **diakumulasi**. Teks final (dipakai persis di `mitra/src/pages/index.astro`):

> "Komisi lo masuk ke saldo dan diakumulasi, tapi lamanya beda tergantung status lo. Kalau lo
> punya lisensi — jadi klien yang sekalian ngasih rekomendasi — komisi bisa payout per 7 hari.
> Kalau lo fokus referensi doank tanpa lisensi sama sekali, komisi masuk per 30 hari. Request
> pencairan, minimal Rp 50.000, langsung gue transfer ke rekening lo."

| Yang berubah | Artinya |
|---|---|
| "masuk **setelah** 7/30 hari" → "**payout per** 7/30 hari" | Framing bergeser dari **release-lag** (sekali) ke **siklus payout** (berulang). Angka & basisnya sama — cuma cara nyampeinnya yang beda |
| "Komisi lo masuk ke saldo" → "**masuk ke saldo dan diakumulasi**" | Saldo itu numpuk, bukan tiap reward langsung cair. Reward nggak hangus, nunggu siklus |
| "Setelah itu lo request pencairan" → "**Request pencairan** … **langsung gue transfer**" | Pencairan manual ditegaskan lagi + nada Lo/Gue (owner yang transfer sendiri) |
| Config `hold_days_licensed` / `hold_days_referral_only` | Renamed → **`payout_cycle_days_licensed` / `payout_cycle_days_referral_only`** (dipakai ADR §7.2 + RPC `referral_resolve_pending()`) |
| `referral_resolve_pending()` | Sekarang conceptually "lepas reward yang sudah **lewat 1 siklus payout**" → `points_pending` → `points_balance` |

**Klarifikasi owner (2026-10-25, setelah v4→v5).** "yang referral only juga bisa payout per 30
hari — jadi bukan siklus sekali doank."

Artinya: **dua-duanya siklus berulang**, bukan sekali lalu selesai.

| | Mitra punya lisensi | Mitra referral-only |
|---|---|---|
| Frekuensi payout | **per 7 hari** | **per 30 hari** |
| Jumlah siklus | **nggak dibatasi** | **nggak dibatasi** |
| Bentuk reward | diakumulasi di saldo | diakumulasi di saldo |

> Yang **"sekali"** itu cuma satu reward: satu baris reward cuma perlu **lewat 1 siklus** buat
> dilepas dari `points_pending` → `points_balance`. Setelah itu, reward berikutnya masuk siklus
> berikutnya, dan mitra boleh request payout lagi. **Nggak ada** aturan "sekali daftar, sekali
> bayar, selesai".

> **Catatan:** angka 7/30 + basis status mitra **tidak berubah** sejak revisi v3→v4. Yang berubah
> hanya framing narasi (release-lag → siklus payout). Tier poin tetap 50/5 dari referee.

**Revisi narasi (v7 → v8) — 2026-10-26. Modul registrasi mitra + pencatatan referral.**
Owner: *"lanjutkan modul registrasi mitra"* + *"sekalian pencatatan referral"*.
Keputusan owner di sesi ini: **registrasi TANPA verifikasi WA** (langsung aktif) dan
**pencatatan referral ikut dikerjakan**.

| Yang berubah | Kenapa | Impact |
|---|---|---|
| Pendaftaran **tanpa verifikasi WA** — langsung `aktif`, langsung dapat kode + link portal | D2: auto-approve, nggak ada antre approve admin. "Verifikasi WA" (§12.5) **dibuang** | Fewer step buat mitra; risikoSelf-claim WA orang lain (lihat catatan risiko) |
| Form daftar → RPC `partner_register` (bukan kirim WA) | data langsung masuk DB | `FormDaftar.astro` arahin ke RPC, **fallback ke WA** kalau RPC belum ada |
| Halaman `/r/<kode>` punya **form klaim diskon** → RPC `partner_claim_referral` | pencatatan referral tanpa sentuh **app klien** (instruksi owner: jangan sentuh app klien) | Referee dapat voucher diskon; mitra dapat poin (5, tier free) + masuk ledger |
| Poin 5 → 50 (tier paid) lewat RPC admin `partner_mark_purchase` | pembelian refereenya belum bisa dicatat otomatis (butuh app klien) | Poin dinaikkan manual dari Control/SQL |
| RPC admin `partner_approve(p_partner_id, p_action, p_note)` | kontrol manual: approve / reject / suspend + terbitkan token | Dipakai **service_role** (Control Center), anon DITOLAK |

> **Kontrak baru di §5:** `partner_register(p_nama, p_wa, p_kota, p_provinsi,
> p_email, p_produk, p_catatan)` → `{ok, partner_id, code, nama, portal_token}` ·
> `partner_claim_referral(p_code, p_nama, p_wa, p_kota, p_app_type)` →
> `{ok, code, voucher_code, discount, min_purchase, points, expires_at}`.
> `portal_token` (mentah) **dikembalikan sekali**; DB cuma nyimpen SHA-256-nya.

> ⚠️ **Risiko "tanpa verifikasi" (jujur):** siapa pun bisa daftar pakai nomor WA
> orang lain → dia yang pegang token portal mitra itu. Mitigasi yang aktif:
> (1) **1 WA = 1 mitra** — WA yang sudah terdaftar ditolak **tanpa** token;
> (2) detail pendaftaran masuk ke WhatsApp owner, jadi owner bisa lihat & koreksi;
> (3) reward tetap nunggu siklus payout 7/30 hari + payout manual;
> (4) `partner_approve`/`partner_mark_purchase` service_role untuk koreksi manual.
> Kalau nanti volume mitranya banyak, beralih ke **link verifikasi sekali
> pakai** (infrastruktur `verify_token_hash` tinggal ditambah) tanpa mengubah
> bentuk RPC-nya.

> **Yang BELUM (Fase 3):** redeem kode saat pembelian di dalam **app klien**
> (`code_apply_discount`) — sengaja nggak dikerjakan di sesi ini karena app klien
> nggak boleh disentuh. Sampai itu ada, voucher `DSK-…` untuk refereenya masih
> diproses manual oleh owner, dan poin 50 (tier paid) naik lewat
> `partner_mark_purchase`.

**Revisi narasi (v8 → v9) — 2026-10-26. Kode referral mitra UNIVERSAL (semua produk).**
Owner: *"form produk yang mau dijual, ga usah dipilih di sini. gue maunya, mitra bisa menjual
semua produk. bahkan seluruh produk yang dijual di kasir solo"*.

§14.2 item 3 dari awal sudah bilang **"satu kode, satu link untuk di-share"** — sekarang
diimplementasikan utuh, dari form sampai isi DB:

| Yang berubah | Kenapa | Impact |
|---|---|---|
| Form daftar **nggak ada** lagi kolom "produk yang mau dijual" | mitra = seller **seluruh** produk, bukan cuma satu app | `FormDaftar.astro` (select dibuang) + `registerPartner()` kirim `p_produk='*'` |
| Kode referral mitra → `app_type='*'` (sebelumnya `'kaki5'`) | satu kode berlaku buat semua produk | **Fase 2b** — `partner_register` di-replace + data lama di-backfill |
| `referral_partners.produk_interest` default `'*'` (sebelumnya `null`) | satu sumber kebenaran: "mitra jual semua produk" | **Fase 2b** — data lama di-backfill |
| Voucher diskon `DSK-…` → `app_type` = produk yang dipilih referee (sebelumnya hardcode `'kaki5'`) | orang yang pilih "Kasir Retail" harus dapat voucher yang bisa dipakai di retail | **Fase 2c** — `partner_claim_referral` di-replace |

> **Yang TIDAK berubah (penting — jangan dibalik):**
> - Dropdown produk di `/r/<kode>` **tetap ada** — itu sisi **referee** yang memilih produk
>   yang mau dibeli, dan itulah yang jadi **atribusi poin**. Kode *mitra* universal; pilihan
>   *produk* = atribusi.
> - `code_redemptions.app_type` tetap merekam produk yang benar-benar dibeli.
> - `referral_wallets.app_type` (`'kaki5'`) nggak disentuh — field historis Fase 1,
>   dompetnya di-key `partner_id`.
> - Bentuk RPC, alur pendaftaran & klaim **nggak berubah** — cuma cakupan produknya.

> **Migrasi:** `supabase/migration-mitra-kode-universal-fase2b.sql` +
> `supabase/migration-mitra-voucher-universal-fase2c.sql` — keduanya sudah **live**
> di `hhywr…` (26/10/2026), dry-run + apply diverifikasi, data uji dibersihin.

**Revisi narasi (v9 → v10) — 2026-10-26. Form "Kode Referal" di halaman daftar.**
Owner: *"tadi form produk yang dijual yang udah dihapus, ganti form kode referal"*.

Slot "produk yang mau dijual" di form daftar diganti jadi **field "Kode Referal" (opsional)** —
mitra isi kode dari mitra yang ngajak dia:

| Yang berubah | Kenapa | Impact |
|---|---|---|
| Field baru **"Kode Referal (opsional)"** di form daftar (5 field: nama/WA/kota/**kode referal**/catatan) | mitra bisa nyambungin diri ke mitra yang ngajak dia | `FormDaftar.astro` — helper text: *"Punya kode dari mitra yang ngajak lo? Masukin — dia dapet komisi, lo dapet diskon buat pembelian pertama."* |
| Kode diisi → `partner_claim_referral` dipanggil **setelah** pendaftaran sukses | **mitra pengundang dapat 5 poin**, pendaftar dapat **voucher diskon** (Rp 50.000, min Rp 100.000) buat pembelian pertamanya | panel sukses nambah kotak **"Kode diskon buat pembelian pertama lo"** + tombol salin |
| Kode ngaco / udah kepake → **pendaftaran tetap berhasil**, muncul catatan | salah ketik kode nggak boleh bikin mitra kehilangan pendaftaran | catatan oranye di panel sukses + alasan dari server (bilingual) |

> **Nol migrasi DB** — RPC `partner_claim_referral` yang sudah live dipakai ulang (voucher
> `DSK-…` pun ikut produk yang dipilih, hasil revisi v9).
> Efek ke mitra pengundang = **poin pending** (tier free = 5); naik ke 50 (tier paid) tetap
> lewat `partner_mark_purchase`, sama seperti alur referral di `/r/<kode>`.

> **Yang TETAP sama:** kode referral mitra tetap universal (`app_type='*'`), dropdown produk
> di `/r/<kode>` tetap ada (sisi **referee**), dan **form daftar tetap nggak menanyakan
> produk** — satu kode buat seluruh produk.

**Revisi narasi (v6 → v7) — 2026-10-26. Lapisan data portal mitra (Fase 1).**
Owner: *"DB Fase 1 portal mitra"*. Yang berubah **bukan** isi narasi — tapi
**kontrak RPC** dan isi database di belakang portal:

| Yang berubah | Kenapa | Impact |
|---|---|---|
| RPC portal: `partner_id`/`client_id` → **token** | parameter bebas = siapa pun bisa nunjuk wallet mitra lain | `api.ts` + `portal.astro` ikut berubah; halaman **tidak** berubah markup-nya |
| `wallet_my_balance(p_client_id)` → `partner_my_balance(p_token)` | mitra referral-only **nggak punya** baris `clients` | saldo mitra diambil dari `referral_wallets` (key `partner_id`) |
| `referral_wallets` di-key `partner_id` (client_id nullable) | §14.2 — mitra ≠ clients | `wallet_my_balance` client (Fase 3) menyusul |
| `code_redemptions` + kolom snapshot `referee_name/city/phone` | referee bisa dari form website (bukan cuma user app) | riwayat referral tetap terbaca walau baris `clients` berubah |
| `referral_partners` + `portal_token_hash` (SHA-256) | D3 token via WA | token mentah cuma sekali muncul (saat diterbitkan), DB cuma nyimpen hash |
| `settings.referral_config` diisi default §7.2 | config-driven, tanpa deploy | tier poin **50/5** + siklus **7/30** + min pencairan Rp 50.000 — semuanya kebaca dari config |
| RPC admin `partner_issue_token` + `referral_resolve_pending` | terbitkan token & lepas reward yg lewat siklus | **hanya `service_role`** — anon DITOLAK (Supabase auto-grant EXECUTE ke anon saat fungsi dibuat → harus dicabut eksplisit) |

> **Konsekuensi ke ekonomi (diputuskan, bukan asumsi):** default config =
> poin **50** (CAC 20%) & siklus payout **7/30** hari. Skema konservatif 25
> poin (CAC 10%) **tidak** dipakai sebagai default — tapi tetap bisa diubah
> admin lewat `settings.referral_config` tanpa deploy. Tier poin referee
> **50/5** (belum beli = 5, beli lisensi = 50) sesuai §7.1.

**Revisi narasi (v5 → v6) — 2026-10-25. Halaman program PINDAH ke app terpisah `mitra/`.**

Owner: *"buat aplikasi terpisah dari company untuk mitra"* + *"yang referral only juga bisa payout
per 30 hari. jadi bukan siklus sekali doank"*.

Yang berubah **bukan** isi narasi — **tempatnya**. Semua teks owner di atas **dipindah persis**
ke `mitra/src/pages/index.astro`. Yang beda cuma struktur:

| Yang berubah | Artinya |
|---|---|
| Lokasi halaman | `company/src/pages/mitra.astro` → **dihapus**; isi dipindah ke `mitra/src/pages/index.astro` |
| Domain | `www.kasirsolo.com/mitra` → **`mitra.kasirsolo.com`** (project Vercel baru, rootDirectory `mitra/`) |
| CTA header `company/` | `href="/mitra"` → `href="https://mitra.kasirsolo.com/"` (absolut, cross-domain) |
| `company/src/pages/sitemap.xml.ts` | `/mitra` **dihapus** dari sitemap company |
| `company/src/i18n/dictionary.ts` | 65 key `mitra.*` **dihapus** (tinggal `nav.jadiMitra` buat label CTA) |
| Halaman baru | `/daftar` (form + "Habis Daftar, Terus Apa?"), `/portal` (dashboard P0), `/r/<kode>` (link referral) |
| Section baru di landing | **"Portal Mitra"** (3 fitur) — alasan app ini dipisah: portal butuh tempat sendiri |
| Auth portal | Token via WA (`/portal?t=<token>`) → RPC `partner_session(p_token)` |

**Narasi inti TIDAK berubah sama sekali** — masih pakai teks owner persis. Yang gue tambahkan cuma
2 section baru yang **tidak pernah ada** di `company/`: section "Portal Mitra" (fitur) dan
3 langkah "Habis Daftar, Terus Apa?".

**Alur narasi (urutan disengaja):**
1. Hero → mekanisme inti (nunjuk → beli → komisi)
2. Keunggulan → "tanpa apa-APA" (modal/stok) + otomatis + cara cair
3. **Dua-duanya Menang** → tabel apa yang lo dapat vs apa yang mereka dapat
4. Cara kerja → 3 langkah
5. FAQ → jawab keberatan (modal, orang gak beli, cara cair, satu kode semua app)
6. Klarifikasi istilah + Form

**Form untuk sementara → WhatsApp.** Submit menyusun pesan ke `wa.me/628816566935` dengan
isi form (nama, WA, kota, produk, catatan) — **belum** menyentuh database.
Saat Fase 2 (tabel + RPC `partner_register`) siap, action form tinggal diarahkan ke RPC;
tampilan form tidak berubah.

Sudah di-verify:
- `npm run build` ✅ — **app `mitra/`**: 4 halaman + `sitemap.xml`; **`company/`**: 35 halaman
  (dari 36, `/mitra` dihapus), `dist/` ter-gitignore
- i18n ID/EN ✅ — **app `mitra/`**: 176 key, **0 missing / 0 orphan** (termasuk `data-i18n-ph`
  placeholder + key yang di-inject JS); **`company/`**: 0 missing, 10 orphan **pre-existing**
  (`home.trust.*`, `home.ctaSlots*`, `nav.tanyaFounder`, `visi.dnaKicker`, `visi.quoteCard` —
  key lama yang belum pernah dipasang ke markup, bukan efek pemindahan)
- scan karakter asing (CJK/Cyrillic/Hangul/Vietnam) ✅ **0** di kedua app
- form submit ✅ menyusun URL WA dengan benar (terverifikasi: pesan pencairan sampai ke
  `api.whatsapp.com` dengan isi nama/kode/jumlah/poin/rekening)
- FAQ JSON-LD ✅ `FAQPage` + 4 `<details>` di HTML
- FAQ akordeon eksklusif ✅ `<details name="mitra-faq">` + fallback JS `toggle` → buka satu, yang lain auto-close (terverifikasi di browser: item 2 → item 4 → item 2 auto-close)
- `sitemap.xml` ✅ app `mitra/` memuat `/`, `/daftar`, `/portal` (link `/r/<kode>` **nggak** ikut — per-referral, nggak worthy di-index); `company/` **nggak** ada `/mitra` lagi
- link referral ✅ `/r/MKS-8F2K` → rewrite Vercel → `/r?code=MKS-8F2K`; di dev ditiru `src/middleware.ts`
- dashboard P0 ✅ Kode · Poin & Saldo · Riwayat Referral · Klien Saya · Ajukan Pencairan · Riwayat Pencairan (desktop 1440 + mobile 390, tabel scroll horizontal, halaman nggak overflow)
- toggle bahasa ✅ langsung berlaku ke baris tabel/kartu yang di-inject JS (bukan cuma markup statis)



### 14.1 D2 — auto-approve setelah verifikasi WA, tanpa lowering standar

Alur yang disepakati:

```
Form di website → INSERT referral_partners (status='pending')
        ↓
Verifikasi WA  (link 1-klik, atau admin cek manual)
        ↓
status='aktif'  →  auto-generate license_codes(kind='referral')
        ↓
Kirim WA ke mitra: kode + link portal
```

- **Auto-approve** = begitu verifikasi WA lolos, mitra **langsung aktif** dan dapat kode.
  Nggak ada antre approve manual.
- **Verifikasi WA** = harus membuktikan kepemilikan WA. Bentuk paling murah & efektif:
  **link verifikasi sekali pakai** yang dikirim balik ke WA mitra, ATAU
  admin centang "sudah cek WA" (kalau volume masih kecil).
- **S suspending tetap ada** — status `suspend`/`nonaktif` + `license_codes.status='dibatalkan'`
  buat mitra yang ketahuan abuse. Auto-approve ≠ tanpa kendali.
- **Anti-farm guardrail tetap jalan** (dari §8): siklus payout 7/30 hari, self-referral ditolak,
  1 WA = 1 mitra aktif, kode `unique` + retry.

> Catatan jujur: auto-approve + poin yang jadi uang = **lit bang**. Guardrail yang
> menyelamatkan: (1) siklus payout 7/30 hari sebelum poin bisa dicairkan, (2) payout **manual** & per-request,
> (3) verifikasi WA. Kalau mitra cuma daftar lalu nggak ada yang invite → 5 poin, bukan 50.

---

## 16. §16 — D1: hasil scan drive C & keputusan hosting portal mitra

### 16.1 Hasil scan: proyek Astro di seluruh `C:\Users\Admin\Documents`

| Path | Nama package | Domain | Kasol? |
|---|---|---|---|
| **`kasol\mitra\`** | `kasir-solo-mitra` | `mitra.kasirsolo.com` | ✅ **YA — INI YANG DIPILIH (D1, 2026-10-25)** |
| `kasol\company\` | `kasir-solo-company` | `www.kasirsolo.com` | ✅ Ya — situs utama (design system-nya jadi sumber copy `mitra/`) |
| `GitHub\kasol-beta\company\` | — | mirror beta | ya (mirror) |
| `GitHub\kasol\company\` | — | mirror live | ya (mirror) |
| `cbp\website\` | `cbp-legal-website` | cbplegal.com | ❌ proyek lain |
| `migoo\toko emas\gold-shop-landing\` | `gold-shop-landing` | tokoemas-sejahtera.com | ❌ proyek lain |

### 16.2 Kenapa **app terpisah** `mitra/` (Astro), bukan di dalam `company/`

> **REVISI 2026-10-25.** §16.2 sebelumnya concluded "pakai `company/`". Owner lalu minta
> *"buat aplikasi terpisah dari company untuk mitra"* → **D1 berubah**. Alasan barunya:

| Kriteria | `mitra/` (app terpisah) ✅ | `company/` (situs utama) | `kasol-v2` (Next.js) |
|---|---|---|---|
| **Pemisahan konteks** | ✅ Program + portal = domain sendiri (`mitra.kasirsolo.com`), `company/` = situs utama `www.kasirsolo.com` — nav saling absolut, nggak perlu cookie/session lintas domain | ⚠️ satu domain, satu project → perubahan program ikut deploy situs utama | ❌ |
| **Version control** | ✅ git-tracked di repo kasol (`mitra/`) | ✅ git-tracked | ❌ **tidak ada `.git`** |
| **Data layer** | ✅ Supabase (anon key + RPC `SECURITY DEFINER`) | ✅ Supabase | ❌ Firebase |
| **Deploy path** | ✅ project Vercel baru, rootDirectory `mitra/`, git integration (verifikasi §12.8 opsi A) | ✅ project `comp-beta` (⚠️ masih 404) | ❌ nggak ada `.vercel` |
| **Konten** | ✅ 4 halaman: landing, `/daftar`, `/portal`, `/r/<kode>` | ✅ 35 halaman situs utama | ✅ `apps/mitra` = skeleton MKS.MITRA |
| **Bahasa** | ✅ design system `company/` **dicopy utuh** (`global.css`, `Base.astro`, `client.ts`, blok `mitra.*`) → tone Lo/Gue konsisten, iterasi cepat | ✅ | ✅ |
| **Kesiapan auth** | ✅ token via WA → `partner_session(p_token)` | ⚠️ butuh token-portal | ⚠️ butuh Firebase→Supabase |
| **Domain** | ✅ `mitra.kasirsolo.com` (butuh DNS) | ✅ `www.kasirsolo.com` | ⚠️ sedang dipakai live |

> **`company/` tetap jadi penerus website Next.js** (`company/README.md`):
> *"Konten diadopsi dari `kasol-v1` + `kasol-v2` (Next.js) dan disederhanakan jadi statis."*
> Contoh pola yang sudah dipakai user di proyek lain (`migoo/toko emas/gold-shop-landing`):
> **Astro + islands + Supabase** — patokan untuk portal.

### 16.3 Rencana penempatan (Astro, mode static + client-side RPC)

```
mitra/                             ← APP TERPISAH, port dev 13132
├── src/
│   ├── pages/
│   │   ├── index.astro            ← LANDING PROGRAM (narasi owner, persis)
│   │   ├── daftar.astro           ← FORM PENDAFTARAN + "Habis Daftar, Terus Apa?"
│   │   ├── portal.astro           ← DASHBOARD P0 (kode, poin, riwayat, payout)
│   │   ├── r.astro                ← LINK REFERRAL /r/<kode>
│   │   └── sitemap.xml.ts
│   ├── components/FormDaftar.astro ← form dipakai bersama landing + /daftar
│   ├── layouts/Base.astro         ← nav absolut ke www.kasirsolo.com
│   ├── lib/api.ts                 ← adapter RPC (live → mock otomatis)
│   ├── lib/mock.ts                ← data contoh (badge "data contoh")
│   ├── i18n/dictionary.ts         ← 176 key (65 mitra.* + 111 m.*)
│   ├── styles/global.css          ← copy dari company/
│   └── middleware.ts              ← dev: /r/<kode> → /r?code=<kode>
└── vercel.json                    ← rewrite /r/:code → /r?code=:code (produksi)
```

**Mode: static + client-side Supabase (anon key) + RPC `SECURITY DEFINER`.**
Alasannya: **konsisten dengan pola kaki5 & shop** (anon key publik, keamanan di RLS),
nggak perlu ganti `output: 'static'` → `hybrid`, dan nggak ada secret service-role
di dalam output Astro. Guard ada di RPC + RLS, bukan di kode browser.

**Transisi mock → live tanpa edit halaman.** `src/lib/api.ts` nge-poll RPC `partner_session`:
kalau 404 (Fase 1 belum jalan) → jatuh ke `src/lib/mock.ts` + badge "Data contoh". Begitu
tabel + RPC-nya hidup, sumber data otomatis berubah — **markup-nya sama persis**.

### 16.4 Yang harus dikerjakan di `mitra/` (status P0)

| Item | Status |
|---|---|
| Landing + `/daftar` (form → WA) | ✅ **SELESAI** |
| Dashboard `/portal` (mock + adapter RPC) | ✅ **SELESAI** + ✅ **data live** (26/10 — Fase 1 DB aktif, badge "data contoh" hilang) |
| Link referral `/r/<kode>` | ✅ **SELESAI** (rewrite Vercel + middleware dev) |
| RPC `partner_register` (form → DB) | ⏳ Fase 1 — form sementara kirim ke WA, action tinggal diarahkan ke RPC |
| RPC `partner_session` / `partner_referrals` / `partner_payouts` | ✅ **Fase 1 live 26/10** — token-based (`partner_my_balance` + `payout_request` ikut) |
| Verifikasi WA → generate kode | ⏳ Fase 1 |
| Tombol ajukan payout | ✅ UI jadi — pakai `payout_request` kalau live, fallback ke WA kalau belum |
| Deploy project Vercel `mitra/` + DNS `mitra.kasirsolo.com` | 🔴 **1 langkah manual owner** (§12.9) |
| Copy tone | ✅ Lo/Gue, geser dari `company/src/data/local.ts` |

> ⚠️ **Catatan domain:** `comp-beta.vercel.app` sekarang **404** → project `company/`
> belum punya deploy aktif. Before go-live perlu: deploy `company/` ke project Vercel
> (atau subdomain `mitra.kasirsolo.com`).

---


---

## 15. Asumsi tambahan (v3)

5. **Mitra ≠ pengguna app.** Pisah tabel (`referral_partners` vs `clients`).
6. **Tier mitra** = bronze/silver/gold berdasarkan jumlah klien *paid* — jadi ada
   insentif naik level.
7. **Satu mitra = satu kode referal** (bukan banyak). Voucher admin tetap batch.
8. **Poin tidak hangus** — masuk saldo setelah 1 siklus payout, Minimal cair Rp 50.000.
9. **Subdomain**: `mitra.kasirsolo.com` (DNS + project Vercel baru) — belum ada DNSnya.