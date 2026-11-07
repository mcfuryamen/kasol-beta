# Program Mitra — App Terpisah (`mitra/`)

Landing program kemitraan/referral + portal mitra (dashboard P0).
Hosting sendiri di **mitra.kasirsolo.com**, terpisah dari situs utama
**www.kasirsolo.com** (app `company/`).

> Keputusan "app terpisah" ada di `docs/ADR-VOUCHER-REFERRAL.md` §1 (D1) dan
> §12.8 (opsi A). Perubahan D1 dari "company/" → "app terpisah" dicatat di
> §14.4 tabel revisi narasi.

## Isi app

| Halaman | Route | Isi |
|---|---|---|
| Landing | `/` | Narasi program (dipindah persis dari `company/mitra.astro`), section Portal Mitra, form daftar, FAQ akordeon |
| Pendaftaran | `/daftar` | Form daftar + "Habis Daftar, Terus Apa?" |
| Portal | `/portal` | Dashboard P0: Kode Saya, Poin & Saldo, Riwayat Referral, Klien Saya, Ajukan Pencairan, Riwayat Pencairan |
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

Semua data portal diambil **di sisi klien** lewat `src/lib/api.ts`:

| RPC | Dipakai buat |
|---|---|
| `partner_session(p_token)` | Validasi token dari `?t=`, status mitra, `has_license`, siklus payout |
| `partner_my_balance(p_token)` | Poin siap/cair, poin dalam siklus, total |
| `partner_referrals(p_token)` | Riwayat referral + klien |
| `partner_payouts(p_token)` | Riwayat pencairan |
| `payout_request(p_token, p_points, p_amount, p_type, p_bank_info)` | Request pencairan (dipakai kalau portal-nya live) |
| `partner_register(...)` | Pendaftaran mitra (form `/` & `/daftar`) — langsung aktif, dapat kode + token portal. **Kode universal** (`app_type='*'`): satu kode buat seluruh produk |
| `partner_claim_referral(p_code, p_nama, p_wa, p_kota, p_app_type)` | Klaim diskon di `/r/<kode>` → ledger reward + voucher `DSK-…` (voucher ikut produk yang dipilih referee) |

Akses portal = **token via WhatsApp** (`/portal?t=<token>`, ADR D3).

> **Form daftar nggak ada kolom produk** — mitra boleh jualan **seluruh** produk
> Kasir Solo, jadi satu kode referral berlaku untuk semua app (ADR §14.2 item 3).
> Dropdown produk di `/r/<kode>` tetap ada, tapi itu sisi **referee** yang milih
> mau beli apa — itu yang jadi atribusi poin.
>
> **Kolom "Kode Referal" (opsional) di form daftar**: kalau diisi, setelah
> pendaftaran sukses app manggil `partner_claim_referral` → mitra yang ngajak
> dapat **5 poin**, pendaftar dapat **voucher diskon** (Rp 50.000, min Rp 100.000)
> buat pembelian pertamanya. Kodenya ngaco / udah kepake? **Pendaftaran tetap
> berhasil** — cuma vouchernya nggak jadi (catatan muncul di panel sukses).

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

## Auth portal

Token-nya datang dari query string, dikirim ke WhatsApp mitra. Halaman portal
nggak punya login form — itu disengaja (P0, D3). Token dipakai sebagai
parameter RPC `SECURITY DEFINER`, jadi server yang validasi, bukan browser.

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

## Yang belum ada di P0

- **Redeem kode saat pembelian** (`code_apply_discount`) — butuh **app klien**
  (kaki5/rosok), jadi belum dikerjakan. Sampai itu ada, voucher diskon `DSK-…`
  dari `/r/<kode>` diproses manual oleh owner.
- **Poin tier "paid" (50)** naik manual lewat RPC admin `partner_mark_purchase`
  (belum ada tombolnya di UI).
- **Tab "🤝 Mitra" di Control Center** — list mitra, approve/suspend, issue token.
  RPC admin-nya (`partner_approve`, `partner_mark_purchase`) sudah siap, tinggal
  UI-nya.
- Halaman `/mitra` di `company/` **dihapus** — navigasinya diarahkan ke domain ini.
