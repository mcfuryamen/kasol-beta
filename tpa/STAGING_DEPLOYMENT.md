# Staging Deployment & Testing Guide (TPA)

> **Update 2026-10-12** — panduan lama (copy-paste SQL manual ke dashboard + curl
> INSERT browser ke `identity_recovery_challenges`) sudah tidak sesuai kondisi
> terkini. Kondisi sekarang:
>
> - Migrasi di-apply otomatis via **Supabase Management API** memakai
>   `SUPABASE_ACCESS_TOKEN` — tidak perlu SQL Editor.
> - Semua migrasi identity **dan** SPP/keuangan **sudah applied** di project
>   staging, terverifikasi 23/23 PASS.
> - INSERT langsung browser ke `identity_recovery_challenges` **ditolak RLS by
>   design** (migrasi `20261021`) — challenge hanya dibuat lewat
>   `identity_request_recovery` (SECURITY DEFINER) atau Edge Functions.
> - Edge Functions recovery **belum ter-deploy** di project ini.

## Target project

**TPA staging = `ozsjflxfkbcygbuxgwyf`** (project "kasol", region `ap-southeast-1`).

> ⚠️ **JEBAKAN `.env.local` — WAJIB BACA SEBELUM APPLY.** `SUPABASE_URL` di root
> `kasol/.env.local` menunjuk project **minimarket/platform**
> (`hhywrvedlwljawgxzpkq`), BUKAN TPA. Apply migrasi TPA tanpa `--ref` akan
> salah target. Selalu:
>
> 1. jalankan `check` dulu dan pastikan daftar tabelnya domain TPA (`tpa_*`);
> 2. selalu sertakan `--ref=ozsjflxfkbcygbuxgwyf`.
>
> Catatan juga: `apply-migrations-staging.js` (yang POST ke RPC `exec_sql`)
> **tidak bekerja** di Supabase hosted — RPC itu tidak ada di project hosted.

## STEP 1 — Cek & apply migrasi (otomatis)

Dari folder `tpa/` (kredensial dibaca dari root `.env.local`; nilainya tidak pernah dicetak):

```bash
node apply-migrations-live.js check  --ref=ozsjflxfkbcygbuxgwyf   # read-only: tabel, fungsi, policy, kolom
node apply-migrations-live.js apply  --ref=ozsjflxfkbcygbuxgwyf   # apply atomik per file migrasi
node apply-migrations-live.js verify --ref=ozsjflxfkbcygbuxgwyf   # asersi pasca-apply
```

- `apply` hanya mengirim file `20261020*` dan `20261021*` (target sesi hygiene/SPP);
  file migrasi memakai `IF NOT EXISTS` / `DROP IF EXISTS` sehingga re-apply aman.
- Setiap file berjalan dalam satu transaksi (`BEGIN`/`COMMIT` di file) — gagal
  di tengah berarti rollback penuh.
- Mode lain: `columns --table=<nama>` (lihat kolom) dan `functions` (daftar
  Edge Functions ter-deploy).

## STEP 2 — Status per 2026-10-12

| Komponen | Status |
|---|---|
| Migrasi identity recovery + akademik (20261009–20261016) | ✅ applied (terverifikasi via `check`: tabel `tpa_*` & `identity_*` + helper lengkap) |
| `20261020_tpa_spp_finance.sql` (SPP + kas) | ✅ applied — 4 tabel + RLS + 14 policy admin/wali, grant tanpa DELETE, anon ditolak |
| `20261021_identity_rpc_hygiene.sql` | ✅ applied — PUBLIC revoke di `identity_request_recovery`, legacy RPC OTP-accept-any tidak ada, policy `identity_recovery_challenges` dirapikan (SELECT milik sendiri via kolom `identity_id` OR admin; UPDATE ditutup) |
| Verifikasi katalog | ✅ 23/23 PASS (`node apply-migrations-live.js verify`) |
| Edge Functions recovery (`identity-approve-recovery`, `identity-complete-recovery`) | ⏳ **belum dideploy** — `node apply-migrations-live.js functions` kosong; butuh secret `RECOVERY_CORS_ORIGIN` (CORS fail-closed) |
| Smoke RLS berautentikasi (`scripts/smoke-rls-staging.js`) | ⏳ blocked — butuh akun staging di `.env.staging` (aman: keluar BLOCKED tanpa login) |

## STEP 3 — Saat mau mengaktifkan alur recovery

1. Putuskan origin aplikasi TPA yang dipakai browser (mis. `https://tpa.kasirsolo.app`).
2. Deploy kedua function dengan Supabase CLI
   (`supabase functions deploy <name> --project-ref ozsjflxfkbcygbuxgwyf`),
   lalu set secret: `supabase secrets set RECOVERY_CORS_ORIGIN=https://<origin>`
   (beberapa origin dipisah koma).
3. Tanpa secret itu, CORS fail-closed → browser dari origin mana pun ditolak.
   Ini disengaja; jangan kembali ke CORS `*`.

## STEP 4 — Smoke / verifikasi

```bash
node scripts/verify-academic-attendance-staging.js   # katalog akademik+absensi (non-destruktif)
node scripts/smoke-rls-staging.js                    # berautentikasi; butuh akun di .env.staging
```

Verifikator katalog **tidak membuktikan perilaku role end-user** — pengujian
admin/ustadz/wali lintas lokasi tetap butuh fixture akun berautentikasi, dan
tidak boleh memakai service-role key sebagai pengganti user.
