# Program Mitra — App Terpisah (`mitra/`)

Landing program kemitraan/referral + **Akun Kasol** (daftar/login/dashboard lintas app).
Hosting sendiri di **mitra.kasirsolo.com**, terpisah dari situs utama
**www.kasirsolo.com** (app `company/`).

> Keputusan "app terpisah" ada di `docs/ADR-VOUCHER-REFERRAL.md` §1 (D1) dan
> §12.8 (opsi A). Perubahan D1 dari "company/" → "app terpisah" dicatat di
> §14.4 tabel revisi narasi.

## Isi app

| Halaman | Route | Isi |
|---|---|---|
| Landing | `/` | Narasi program (dipindah persis dari `company/mitra.astro`), section Portal Mitra, CTA ke `/akun`, FAQ akordeon |
| Akun Kasol | `/akun` | **Satu pintu daftar/login** (WA + PIN): dashboard lisensi lintas app, kode aktivasi perangkat, opt-in mitra, kode referal, pencairan, ganti PIN. Layout `bare` — header/footer/tabbar disembunyikan |
| Pendaftaran lama | `/daftar` | **Redirect → `/akun`** (2026-11-03). Komponen `FormDaftar.astro` + RPC `partner_register` **dihapus** (2026-11-04) — registrasi 100% lewat `/akun` |
| Portal lama | `/portal` | **Redirect → `/akun`** (2026-11-04). Modul portal token dimigrasikan ke tab Referal di `/akun`; `portal.astro` dihapus |
| Link referral | `/r/<kode>` | Halaman buat yang DIREKOMENDASIKAN: kode, pilihan aplikasi, tombol lanjut ke situs utama |

## Jalur dev

```powershell
Set-Location 'C:\Users\Admin\Documents\kasol\mitra'
npm install          # WAJIB di dalam folder ini (bukan di root repo)
npm run dev          # http://127.0.0.1:13132
npm run build        # output ke dist/
npm run preview      # cek hasil build
```

## Env

Salin `company/.env` ke `mitra/.env` (isi sama):

```
PUBLIC_SUPABASE_URL=https://hhywrvedlwljawgxzpkq.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

`PUBLIC_*` = aman untuk browser. **JANGAN** pernah masukin service-role key ke
folder ini — output-nya static dan dibaca publik.

### Env di Vercel (konektor Supabase)

Konektor Supabase di Vercel sync env dengan nama `SUPABASE_URL` +
`SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` — **bukan** `PUBLIC_*`. Karena
Vite cuma meng-inline env berawalan `PUBLIC_`, `astro.config.mjs` membaca env
build-time itu dan expose ke bundle lewat `vite.define` (nama custom
`__MKS_SUPABASE_URL__` / `__MKS_SUPABASE_ANON_KEY__`). `src/lib/api.ts` baca
keduanya: hasil build lebih dulu, `import.meta.env.PUBLIC_*` sebagai fallback
(dev lokal).

`SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `POSTGRES_*` **nggak pernah
diambil** — kredensial itu server-side, bocor ke bundle = siapa pun bisa nulis DB.

> Catatan: `defineConfig` **bentuk fungsi** bikin config ke-drop di setup ini
> (`Astro.site` jadi `undefined` → error `Invalid URL` saat generate static
> routes). Pakai bentuk **objek** statis.

## Data: mock vs live

Data dashboard diambil **di sisi klien** lewat `src/lib/account.ts` (Supabase Auth + RPC berbasis **sesi**), bukan token:

| RPC / sumber | Dipakai buat |
|---|---|
| Edge Function `account-register` | Buat akun (WA + PIN) + tautkan lisensi perangkat lama |
| `account_my_profile` | Identitas + status mitra + data klien (prefill Data Diri) |
| `hub_my_licenses` | Lisensi per app + daftar perangkat aktif |
| `account_my_summary` · `account_my_referrals` · `account_my_payouts` · `account_request_payout` | Ringkasan, riwayat referral, riwayat & ajukan pencairan |
| `account_create_activation_code` | Kode aktivasi perangkat `HUB-...` (10 menit, maks 2 device) → ditukar di app klien |
| `account_become_partner` · `account_update_profile` · `account_ensure_referral` | Opt-in mitra, edit identitas, pastikan kode referal |
| `partner_claim_referral(p_code, p_nama, p_wa, p_kota, p_app_type)` | Klaim diskon di `/r/<kode>` → ledger reward + voucher `DSK-…` (voucher ikut produk yang dipilih referee) |

> RPC portal lama berbasis token (`partner_session`, `partner_my_balance`, `partner_referrals`, `partner_payouts`, `payout_request`, `partner_register`) masih ada di DB untuk kompatibilitas, tetapi **UI-nya sudah tidak dipasang** (portal.astro + FormDaftar.astro dihapus 2026-11-04).

> **Kode referal sekarang lewat `/akun`**, bukan form lagi: setiap akun otomatis
> punya kode (RPC `account_ensure_referral`) dan bisa dibagikan dari dashboard.
> Satu kode berlaku untuk **seluruh** produk (ADR §14.2 item 3).
>
> Halaman `/r/<kode>` tetap menangani pihak yang **direkomendasikan**: memilih
> produk lalu memanggil `partner_claim_referral` → mitra pengundang dapat **5 poin**,
> pendaftar dapat **voucher diskon** (Rp 50.000, min Rp 100.000) untuk pembelian
> pertamanya. Kode ngaco/udah kepake → klaim ditolak, tapi halaman tetap jalan.

> Semua RPC portal **berbasis token**, bukan `partner_id`/`client_id`. Kalau
> parameternya bebas, siapa pun bisa nunjuk wallet mitra orang lain. Token
> dicek di dalam fungsi (`SECURITY DEFINER`) dan yang tersimpan di DB cuma
> SHA-256-nya.

**Fase 1 SUDAH JALAN** (26/10/2026) → tabel + RPC di atas live di Supabase
`hhywr…`. `api.ts` otomatis pakai data live; badge **"Data contoh"** cuma
muncul kalau RPC-nya belum ada (PostgREST 404) → jatuh ke `src/lib/mock.ts`.
Markup-nya sama persis, cuma sumber datanya yang beda.

Mitra demo untuk uji: `MKS-8F2K` ("Warung Bu Tanti (DEMO)"), token portal
berlaku 30 hari. Hapus sebelum produksi:

```sql
delete from public.referral_partners where code = 'MKS-8F2K';
```

## Auth akun

`/akun` memakai **Supabase Auth** (email sintetis `<WA>@accounts.kasirsolo.local`
+ PIN 6 digit), sesi disimpan di browser dan auto-refresh. Pembuatan akun lewat
Edge Function `account-register` (service_role di server, tidak pernah masuk bundle).

Model **token portal** lama (`/portal?t=<token>`, ADR D3) **dihentikan 2026-11-04**
— `/portal` sekarang redirect ke `/akun`.

## Link referral

Link referral berformat `/r/<kode>`. Karena hosting-nya static, path-nya
di-rewrite ke `/r?code=<kode>` lewat `vercel.json`, lalu dibaca di sisi klien.
Halaman `/r` juga bisa dipanggil langsung dengan `?code=`.

## Deploy

1. Bikin project Vercel baru → framework preset **Astro**, root directory `mitra/`.
2. **Environment Variables (WAJIB)**: `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`
   (isi dari `mitra/.env`). Tanpa ini, build jadi static tanpa kredensial →
   portal diam-diam jatuh ke mode mock (badge "Data contoh") padahal DB-nya
   sudah siap. Redeploy setelah env-nya ditambahkan.
3. Domain: `mitra.kasirsolo.com` (DNS belum ada — harus diset manual di registrar).
4. Deploy lewat git integration (push ke mirror → auto-deploy), sama seperti
   app `company/`.

> Catatan: `VERCEL_OIDC_TOKEN` di repo sudah expired dan token API Vercel
> nggak ada, jadi deploy dari workspace **nggak bisa** — harus lewat dashboard.

## Yang belum ada / catatan P0

- **Redeem kode diskon saat pembelian** (`code_apply_discount`) — belum dipasang
  di app klien (kaki5/rosok). Voucher `DSK-...` dari `/r/<kode>` masih diproses
  manual oleh owner. (Yang **sudah** jalan di kaki5: kode aktivasi perangkat
  `HUB-...` → `hub_redeem_activation_code`.)
- **Poin tier "paid" (50)** naik manual lewat RPC admin `partner_mark_purchase`
  (belum ada tombolnya di UI).
- **Tab "🤝 Mitra" di Control Center** — `control/js/partners.js` sudah ada:
  list mitra + `partner_approve`, `partner_issue_token`, `referral_resolve_pending`.
- Halaman `/mitra` di `company/` **dihapus** — navigasinya diarahkan ke domain ini.
