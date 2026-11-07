# STATUS LIVE — Ekosistem Kasol

> **Snapshot: 2026-10-26 06:50 WIB** · repo `C:\Users\Admin\Documents\kasol` · branch `main` · HEAD `6158c06` (docs) · **Fase 1 DB mitra portal sudah live di Supabase `hhywr…`** (5 tabel + 7 RPC + `settings.referral_config`) — sisanya masih working copy
>
> File ini berisi **fakta yang cepat basi** (jumlah baris DB, status deploy, proses lokal).
> Untuk **standar & keputusan yang permanen** → baca `../CONTEXT.md`.
> Semua angka di sini diverifikasi langsung ke API/lokal pada tanggal snapshot — bukan dari catatan lama.
>
> **Aturan:** jangan menyebut angka dari file ini sebagai fakta di masa depan tanpa verifikasi ulang.

---

## 1. Peta Repo (yang benar-benar berisi kode)

| Path | Peran | Status 2026-10-24 |
|---|---|---|
| `control/` | Control Center — admin marketing, klien, lisensi, sosmed | 🟡 **aktif, working copy dirty** (20 file ubah + 14 baru) |
| `kaki5/` | **Referensi arsitektur** app klien (offline-first, smart gate) | 🟡 v1.0.138-beta.1 (Stage 7, cacheBust v213) — belum live |
| `rosok/` | App klien flagship (kasir hape) | 🟢 live |
| `shop/` | Funnel/landing marketing | 🟡 idle sejak 19/10 |
| `tpa/` | Madrasah (domain terpisah, staging Supabase sendiri) | 🟢 staging, migrasi ter-apply |
| `minimarket/` | Platform minimarket (Vite + TS) | 🟢 MVP-0..2 tertutup |
| `laundry/` | App klien laundry (single `index.html` 98KB) | 🟡 ada, port bentrok |
| `retail/` | App klien retail | 🟢 ada, idle |
| `agent/` | Otak AI lokal (runner + callAI, Omniroute) | 🔴 **runner mati 20 hari** |
| `marketing-kit/` | Kit konten + agent marketing otonom | 🔴 **belum pernah jalan** |
| `supabase/` | Skrip migrasi lintas app | 🟡 dipakai |
| `company/` | Website korporat (Astro, port 13131, di luar registry 8081–8089) | 🟡 proyek terpisah — **35 halaman** (dari 36; `/mitra` dihapus 25/10) |
| `mitra/` | **Program Mitra + Portal Mitra** (Astro, port 13132, domain `mitra.kasirsolo.com`) | 🟢 **baru 25/10** — 4 halaman + sitemap, build ✅, dashboard masih mock |
| `kaki5-native/` | Bungkus Capacitor untuk kaki5 (+APK rilis) | 🟢 ada |
| `docs/` | ADR +-stage hardening + proposal | 🟢 **rumah status/ARD** |
| `grosir/`, `kelontong/`, `retail-enterprise/`, `fnb/` | **Placeholder kosong** (hanya `package-lock.json`/`.env.example`) | ⚪ belum ada app |

### Di luar repo ini (penting — mudah terlewat)

| Path | Isi | Status |
|---|---|---|
| `C:\Users\Admin\Documents\kasol-v2` | Monorepo **Next.js 15 + Turborepo + Firebase**, dari template Gemini AI Studio. `apps/website` (landing korporat), `apps/mitra` (skeleton **"MKS.MITRA"** — nav: Overview, Partner Database, Aktifitas, Forum Mitra, Bagi Hasil, Konfigurasi, Security Hub), `apps/system` (POS/inventory, skeleton). **TIDAK ada `.git`** → source deploy-nya tidak ada di workspace ini. | 🟡 `apps/website` **sedang live** di `www.kasirsolo.com`; `apps/mitra` belum ter-deploy (`/mitra` → 404), datanya masih mock (`DataContext` → `setPartners([])`), data layer Firebase |
| `C:\Users\Admin\Documents\kasol\company` | **Website Kasir Solo (Astro, port 13131)** — 35 halaman statis (dari 36; `/mitra` **dihapus** 25/10, CTA header → `https://mitra.kasirsolo.com/`), SEO `kota/[slug].astro`, `rekrutmen.astro`, `hardware.astro`. **Git-tracked di repo kasol**. **Supabase sudah terpasang** (`PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`). `.vercel` → project `comp-beta` (**404 = belum ada deploy aktif**). | 🟡 **Penerus website Next.js** — README: *"Konten diadopsi dari kasol-v1 + kasol-v2 dan disederhanakan jadi statis"*. **Bukan** host portal mitra lagi (D1 berubah → app `mitra/`) |
| `C:\Users\Admin\Documents\kasol\mitra` | **Program Mitra (Astro, port 13132, domain `mitra.kasirsolo.com`)** — 4 halaman: landing `/`, `/daftar`, `/portal` (dashboard P0), `/r/<kode>` (link referral). Design system `company/` dicopy utuh. Env = `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` (sama kayak `company/`). `vercel.json` rewrite `/r/:code` → `/r?code=:code`. | 🟢 **BARU 25/10** — build ✅ 4 halaman, i18n 176 key (0 missing / 0 orphan). 🟢 **data layer LIVE 26/10** (Fase 1 DB aktif → portal di localhost baca data live). 🔴 **Deploy publik = 2 langkah manual owner**: (1) env `PUBLIC_SUPABASE_*` di project Vercel `mitrabeta` (2) DNS `mitra.kasirsolo.com` → `mitrabeta` |
| `C:\Users\Admin\Documents\GitHub\kasol` | Mirror **LIVE** (`mcfuryamen/kasol`) | 🟡 snapshot 2026-10-20 |
| `C:\Users\Admin\Documents\GitHub\kasol-beta` | Mirror **BETA** (`mcfuryamen/kasol-beta`) | 🟢 snapshot `a4487a2` (26/10 04:53 WIB) — sudah ter-push |
| `C:\Users\Admin\.copilot\.../kasol/mcfuryamen-stunning-memory` | Worktree git lain (branch `mcfuryamen-audit-tpa-vs-tpa-mono`) | ⚪ eksperimen |

---

## 2. Supabase — 2 project, jangan tertukar

| Ref | Nama | Region | Pemakai | Status |
|---|---|---|---|---|
| `hhywrvedlwljawgxzpkq` | "mcfury's Project" | ap-northeast-1 | **Control/Platform + HUB + Minimarket** | 🟢 ACTIVE_HEALTHY |
| `ozsjflxfkbcygbuxgwyf` | "kasol" | ap-southeast-1 | **TPA staging** | 🟢 ACTIVE_HEALTHY |

> ⚠️ `SUPABASE_URL` di root `.env.local` → **`hhywr...` (minimarket)**, BUKAN TPA.
> Migrasi TPA tanpa `--ref` eksplisit = bisa merusak schema identity minimarket.

### 2.1 `hhywr…` — 47 tabel, jumlah baris live

| Tabel | Baris | Catatan |
|---|---|---|
| `clients` | **23** | kaki5 12 · rosok 9 · laundry 2 — `license_status`: aktif 4, belum 19 |
| `licenses` | **4** | 3 kaki5 + 1 rosok, semua `status=active`, `global_identity_id` NULL |
| `license_devices` | 4 | 1 lisensi = 1 perangkat |
| `global_identities` | **0** | HUB Fase 0 = scaffold saja |
| `app_memberships` | **0** | belum ada akun Hub terikat |
| `content_materials` | **141** | 🆕 seed hari ini dari `marketing-kit/` (bank materi Kalender) |
| `social_posts` | **0** | 🔴 **tidak ada satu pun post otomatis yang pernah jalan** |
| `outreach_contacts` | 394 | pipeline outreach hidup |
| `wa_prospects` | 88 / `wa_broadcast_log` 46 | ?, zona cold-broadcast (0 hasil) |
| `agent_outputs` / `agent_tasks` | 31 / 27 | output agent lama |
| `profiles` | 32 | profil pengguna |
| `products` / `pos_products` | 10 / 14 | katalog minimarket |
| `orders` / `order_items` | 3 / 3 | transaksi minimarket |
| `outlets` / `outlet_memberships` | 2 / 1 | MVP-2 outlet contract |
| `sync_errors` | **176** | 🔴 akumulasi error sync — belum ada proposal ter-apply (`docs/SYNC-ERRORS-HARDENING-PROPOSAL.sql`) |
| `settings` | 9 | lihat di bawah |
| **Program mitra (Fase 1, 26/10)** | | |
| `referral_partners` | **1** | 🟡 **1 mitra DEMO** (`MKS-8F2K`) — hapus sebelum produksi |
| `referral_wallets` | 1 | saldo mitra (150 siap · 5 pending · 330 total) |
| `payout_requests` | 2 | riwayat pencairan DEMO (keduanya `dibayar`) |
| `license_codes` | 1 | kode referal mitra (`kind='referral'`, `app_type='*'` → **universal**, semua produk) |
| `code_redemptions` | 4 | ledger reward (3 released · 1 pending hold) |

> 5 tabel program mitra + 5 kolom baru di `clients` (`purchase_code`,
> `purchase_discount`, `price_paid`, `voucher_id`, `referred_by_code`) dibuat
> 26/10/2026. **RLS ON tanpa policy** → anon/authenticated nggak bisa baca
> langsung; data hanya lewat RPC `SECURITY DEFINER`.
> Script: `supabase/migration-mitra-portal-fase1*.sql` · rollback:
> `supabase/rollback-mitra-portal-fase1.sql` · seed demo:
> `supabase/seed-mitra-demo.sql` · Fase 2: `migration-mitra-registration-fase2.sql` ·
> kode universal: `migration-mitra-kode-universal-fase2b.sql` +
> `migration-mitra-voucher-universal-fase2c.sql`.

### 2.1b RPC program mitra (live di `hhywr…`)

| RPC | Akses | Fungsi |
|---|---|---|
| `partner_session` · `partner_my_balance` · `partner_referrals` · `partner_payouts` · `payout_request` | anon ✅ | dashboard portal mitra (semua **berbasis token**) |
| `partner_register` | anon ✅ | pendaftaran mitra (langsung aktif, dapat kode + token portal). Kode referral **universal** (`app_type='*'`) — berlaku buat seluruh produk |
| `partner_claim_referral` | anon ✅ | klaim diskon dari kode → ledger reward + voucher `DSK-…` (voucher **ikut produk** yang dipilih referee). Dipakai juga form `/daftar` (kolom "Kode Referal" opsional) → mitra pengundang dapat 5 poin, pendaftar dapat voucher diskon |
| `partner_issue_token` · `partner_mark_purchase` · `partner_approve` · `referral_resolve_pending` | **service_role only** | admin: terbitkan token, naikkan poin tier paid, approve/suspend mitra, lepas reward yg lewat siklus |

> ⚠️ **Supabase auto-grant EXECUTE ke `anon` + `authenticated` saat fungsi
> dibuat** → `revoke ... from public` aja **nggak cukup**; harus dicabut eksplisit
> juga dari `anon` & `authenticated` (lihat `migration-mitra-portal-fase1-grants-fix.sql`).

### 2.2 `settings` (project `hhywr…`) — kunci aktif

| Key | Isi | Status |
|---|---|---|
| `referral_config` | 12 parameter economics program mitra (poin 50/5, siklus payout 7/30, min pencairan Rp 50.000, …) | 🆕 26/10 — default ADR §7.2, config-driven (bisa diubah admin tanpa deploy) |
| `biz_info` | nama/tags/alamat biz | ✅ |
| `bank_info` | rekening pembayaran | ✅ |
| `qris_url` | URL QRIS | ✅ |
| `app_links` | 8 tautan app (fnb, kaki5, …) | ✅ |
| `agent_config` | `model=kiro/claude-haiku-4.5`, `variasi=2`, folder followup | ✅ |
| `ai_providers` | **KOSONG** | 🔴 fitur "Variasikan AI" (Control v1.12.0) akan gagal — `_ai-core.js` membacanya |
| `agents` | **KOSONG** | 🔴 konfigurasi agen kosong |
| `runner_heartbeat` | `2026-10-04T05:42Z` | 🔴 **stale 20 hari** → runner lokal mati |
| `social_fb` | **TIDAK ADA** | 🔴 jalur auto-post FB **belum pernah dikonfigurasi** |

### 2.3 `ozsjf…` (TPA staging) — 45 tabel

Domain TPA: `tpa_students`, `tpa_teachers`, `tpa_classes`, `tpa_class_sessions`, `tpa_class_teachers`,
`tpa_class_students`, `tpa_guardians`, `tpa_guardian_directory`, `tpa_memberships`, `tpa_spp_bills`,
`tpa_spp_payments`, `tpa_spp_types`, `tpa_hafalan_progress`, `tpa_iqro_progress`, `tpa_schedules`,
`tpa_locations`, `tpa_cash_flows`, `tpa_student_directory`, `tpa_teacher_directory`,
`tpa_student_detail_directory`, `tpa_attendances` + domain POS + `identity_*`
(`identity_otp_attempts`, `identity_recovery_audit`, `identity_recovery_challenges`,
`identity_security_events`).

> ⚠️ Kolom pemilik di `identity_recovery_challenges` **beda antar project**:
> TPA (`ozsjf`) = `identity_id`; project minimarket = `global_identity_id`. Migrasi identity
> harus memilih kolom secara dinamis.

---

## 3. Status Rilis

| Target | Versi deployed | Selisih vs working copy |
|---|---|---|
| `kaki5.kasirsolo.com` (LIVE) | `1.0.136` / cacheBust `v211` | working copy `1.0.138-beta.1` / `v213` (**Stage 7 belum live**) |
| `rosok.kasirsolo.com` (LIVE) | 200 OK | ada perubahan `license.sync.js` + `utils.js` yang belum_commit |
| `ctrlbeta.vercel.app` (BETA) | 200 OK, **versi baru** (25/10 11:38) | ✅ `js/kalender.js` (33 KB) **sudah ada** + `api/social-oauth` hidup (balas 400 "Gagal connect" → normal, `FB_APP_ID` kosong). `api/_*-core.js` balas 404 **by design** (prefix `_` = helper, bukan endpoint Vercel) |
| `kq5beta.vercel.app` (BETA kaki5) | `1.0.138-beta.1` / cacheBust `v213` | ✅ ter-deploy 26/10 04:50 (push mirror `a4487a2`): 4 slot versisinkron (`js/app.js?v=213`, `sw.js CACHE_NAME kasir-solo-kaki5-v213`, `version.json` cacheBust v213, `version.js` CACHE_BUST v213) — browser yg cache `version.js?v212` sekarang ambil label baru |
| `mitrabeta.vercel.app` (BETA mitra) | 200 OK (4 route: `/` `/daftar` `/portal` `/sitemap.xml`) | ✅ **app `mitra/` punya project Vercel beta sendiri** (terhubung ke repo `kasol-beta` → push = auto-deploy). Ter-deploy 26/10: CSS baru `daftar.BrUxZpD5.css` (hash sama dgn build lokal, ada `--sp-section`) → ritme vertikal 1 token/2 token aktif. 🔴 domain live `mitra.kasirsolo.com` **belum** di-point (masih 1 langkah manual owner) |
| `rosok-beta.vercel.app` (BETA) | 200 OK | ✅ ikon PWA baru ter-deploy (`assets/logo.png` 104.486 B = match byte-for-byte dgn file lokal) |
| `laundrybeta.vercel.app` (BETA) | 200 OK | ✅ ikon PWA + `manifest.json` baru ter-deploy (`assets/icon-512.png` 92.188 B = match byte-for-byte). ⚠️ **`laundry-beta.vercel.app` (dengan hyphen) = 200 tapi BUKAN app laundry** (404 utk asset) — jangan ketuker |
| `admin-kasol.vercel.app` | **404** | domain admin yang ke-bind ke project `control` tidak hidup |
| `kasirsolo.com` | 308 (redirect) | ✅ |
| `kaki5.vercel.app` / `rosok.vercel.app` | **404** | nama domain beta ≠ `<app>.vercel.app` |
| `mitra.kasirsolo.com` | 🔴 **BELUM ADA** | domain live belum di-point. App `mitra/` sudah **ter-deploy ke beta** (`mitrabeta.vercel.app`) ✅ → arahin domain `mitra.kasirsolo.com` ke project Vercel itu (DNS). ⚠️ **plus**: project `mitrabeta` belum punya env `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` → portal masih mode mock (nilai di `mitra/.env`). `VERCEL_OIDC_TOKEN` expired & tanpa token API → **nggak bisa set dari workspace** |
| `www.kasirsolo.com/mitra` | 🔴 **404** (sengaja) | halaman `company/src/pages/mitra.astro` **dihapus** 25/10 → program pindah ke `mitra.kasirsolo.com`. CTA header `company/` sudah diarahkan ke domain baru |

**Isi mirror BETA (`kasol-beta`, commit `a4487a2`, 2026-10-26 04:53 WIB):**
✅ **1082 file** (dari 1011) · ✅ kaki5 v1.0.138-beta.1 + cacheBust v213 · ✅ `control/js/kalender.js` +
`control/api/social-oauth.js` + `ai-variasi.js` + 4 file `_*-core.js` + 2 migrasi SQL · ✅ app `mitra/`
(29 file, **ter-deploy** ke `mitrabeta.vercel.app`) · ✅ **ritme vertikal** `company/` + `mitra/`
(token `--sp-section`) + fix i18n `visi-misi` · ✅ logo + PWA icons rosok/laundry/kaki5 ·
✅ docs ADR/status/HUB/hardening · ✅ skrip migrasi supabase.
→ **Rilis beta sebelumnya (`63aec86`) memotong semua pekerjaan ini — sekarang sudah ketutup.**

> ⚠️ Cara verifikasi deploy Control: `ctrlbeta.vercel.app` me-fallback `index.html` untuk path statis
> tak dikenal → **HTTP 200 pada `js/*.js` BUKAN bukti file ter-deploy**. Cek isi responsnya, bukan statusnya.

---

## 4. Layanan Lokal (per 2026-10-26 04:45 WIB)

| Port | Proses | Keterangan |
|---|---|---|
| **8082** | `node server.js 8082` (PID 7616, start 09:11:31) | Control dev mirror. `server.js` diubah 09:10:55 → **proses FRESH** ✅ (bukan basi) |
| 8086 | `node server.cjs` (PID 10676, bind 127.0.0.1) | kaki5 dev |
| 20128 | Omniroute `server-ws.mjs` | otak AI lokal ✅ hidup |
| 3000 | `next dev -p 3000` (kasol-v2) | website korporat ✅ hidup |
| 8087 / 8088 | — | minimarket (Vite) & TPA (Vite) tidak sedang jalan |
| 8088 | ⚠️ **BENTROK** | `tpa/package.json` pin `8088 --strictPort`; `laundry/EVALUASI-MODUL.md` juga mengklaim 8088. Hanya satu bisa menang |
| 8081 / 8084 / 8085 / 8089 | — | shop / rosok / retail / grosir tidak jalan |
| **13131** | `node node_modules/astro/astro.js dev --port 13131` (PID 3888, start 04:43) | **website korporat `company/`** ✅ hidup — **launch detached** (biar nggak mati di batas 1 jam background task) |
| **13132** | `node node_modules/astro/astro.js dev --port 13132` (PID 8204, start 04:43) | **app Program Mitra `mitra/`** ✅ hidup — launch detached |
| — | ⚠️ **cek pakai `localhost`, bukan `127.0.0.1`** | Astro dev bind ke IPv6 (`::1`) → `curl http://127.0.0.1:13131` balas `000` padahal server hidup |

---

## 5. Kredensial — status isi (tanpa mencetak nilai)

| Key | Sumber | Panjang | Status |
|---|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | 40 / 208 / 219 | ✅ ada |
| `SUPABASE_ACCESS_TOKEN` | `.env.local` | 44 | ✅ valid, **berlaku lintas 2 project** (Management API) |
| `SUPABASE_JWT_SECRET` | `.env.local` | 36 | ✅ ada |
| `ADMIN_API_KEY` | `.env.local` | 42 | ✅ ada |
| `VERCEL_OIDC_TOKEN` | `.env.local` | 1132 | ✅ ada |
| **`FB_APP_ID`** | `.secure.env` | **0** | 🔴 **KOSONG** |
| **`FB_APP_SECRET`** | `.secure.env` | **0** | 🔴 **KOSONG** |

**Dampak `FB_APP_ID`/`FB_APP_SECRET` kosong:** jalur OAuth Meta yang ditulis 23/10
(`control/api/_social-oauth-core.js` → `social-oauth.js`) **tidak bisa dijalankan** — butuh
redirect_uri terdaftar di app Meta. Belum terisi = OAuth FB/IG/Threads mati.
⚠️ Control **tidak wajib** punya Meta App untuk auto-post: cukup `page_id` + `page_token`
(Graph API Explorer → extend 60 hari → `/me/accounts`). Yang butuh Meta App = login OAuth.

---

## 6. Blocker & temuan aktif (urut prioritas)

1. 🔴 **Tidak ada jalur publishing otomatis yang hidup.** `social_posts = 0`, `settings.social_fb`
   tidak ada, `FB_APP_ID/SECRET` kosong. Yang hidup sekarang = **jalur MANUAL** (Kalender Konten v1.11.0:
   atur rencana → salin caption → tayangkan sendiri → tandai "sudah tayang").
2. 🟠 **Program Mitra — beta sudah nyambung DB, domain live belum.**
   App `mitra/` ter-deploy ke `mitrabeta.vercel.app` + data layer live di Supabase `hhywr…`
   (5 tabel + 11 RPC mitra). **Env sudah kepakai** (26/10/2026): konektor Supabase di Vercel
   sync `SUPABASE_URL` + anon/publishable key, dan `mitra/astro.config.mjs` membacanya saat
   build — perlu bridge itu karena Vite **cuma** meng-inline env berawalan `PUBLIC_` ke
   bundle browser, sedangkan nama env dari konektor nggak berawalan `PUBLIC_`.
   Bukti (bundle deploy, bukan asumsi): string `supabase.co` **ada** di bundle, portal beta
   nampilin **data live** (badge "Data contoh" hilang), dan form `/daftar` di beta **nulis ke
   DB** (nggak jatuh fallback WA) — contoh: `MKS-20A370` (data uji, udah dibersihin).
   Sisa **1 langkah manual pemilik**: arahin DNS `mitra.kasirsolo.com` → project Vercel
   untuk `mitra/` (**nggak bisa dari workspace** — `VERCEL_OIDC_TOKEN` expired, tanpa token API).
   ⚠️ Konektor Supabase juga harus disambungkan ke project Vercel **produksi**-nya
   (yang sekarang baru ada `mitrabeta`), atau env-nya dicopy manual ke sana.
   Sisa fitur (nggak blocking): `code_apply_discount` (redeem kode saat pembelian di app
   klien) + tab "🤝 Mitra" di Control Center.
3. 🔴 **`ai_providers` kosong** → tombol "Variasikan" (Control v1.12.0) akan gagal saat dipanggil.
4. 🔴 **Runner lokal mati 20 hari** (`runner_heartbeat` 2026-10-04, `agent/runner.log` 04/10).
   Agent marketing otonom tidak mungkin jalan selama ini.
5. 🔴 **Agent marketing otonom belum pernah jalan sekali pun** — `marketing-kit/agent/` tidak punya
   `state.json` / `drafts.json` / `leads.jsonl`; `outreach-import.sql` + `klien-lama-clean.csv` ada
   tapi belum dieksekusi.
6. 🟠 **Stage 6 storage policy = BLOCKED / NOT RUN** (`docs/STAGE6-STORAGE-POLICY-VERIFICATION.md`).
   Belum ada target staging yang disetujui, fixture 2 unit, atau bukti `storage.objects`.
   Proposal: `kaki5/docs/STAGE6-STORAGE-POLICY-PROPOSAL.sql`.
7. 🟠 **Stage 7 kaki5 = candidate, belum ada release.** `kaki5/docs/STAGE7-BETA-RELEASE.md`
   (P1 backup lokal, P2 cloud envelope) + `STAGE7-P2-LIVE-CHECKLIST.md` — dua-duanya minta
   **perintah eksplisit pemilik** sebelum beta/live.
8. 🟠 **HUB di-FREEZE.** Fase 0 ter-apply (2026-10-20), Fase 1 belum mulai, Fase 2 sebagian.
   `global_identities` & `app_memberships` = 0 baris → north-star metric **0%**.
   Keputusan pemilik 2026-10-21: "skip modul HUB dulu" — definisi HUB belum final.
9. 🟠 **3 pasang device duplikat** di live (`unit_id` beda, `device_code` sama) → 2 lisensi untuk 1
   perangkat. **Tidak digabung otomatis** — butuh keputusan pemilik.
10. 🟠 **WA duplikat multi-baris** (`082325103336` ×4 rosok, `6282325103336` ×3 kaki5,
   `62823251033366` ×2 → kemungkinan salah ketik). Normalisasi WA baru ada di sisi UI, belum di server.
11. 🟡 **`sync_errors` 176 baris** — proposal hardening ada tapi belum di-apply.
12. 🟡 **Tidak ada OTP recovery untuk akun Hub** — kalau 1 akun memegang 3 app, kehilangan PIN =
    kehilangan semua akses. Ini gap paling menyakitan di HUB (temuan #4 di ADR HUB).
13. 🟡 **`admin-kasol.vercel.app` 404** — Control di domain admin tidak hidup.
14. 🟡 **10 key i18n orphan di `company/`** (`home.trust.*`, `home.ctaSlots*`, `nav.tanyaFounder`,
    `visi.dnaKicker`, `visi.quoteCard`) — key lama yang belum pernah dipasang ke markup, jadi
    trust strip + CTA slots **nggak ikut translate** ke EN. Pre-existing, bukan efek pemindahan.
15. 🟡 **Belum ada `AGENTS.md` di root repo kasol** — standar hidup di `CONTEXT.md` saja, sementara
    tiap app punya `AGENTS.md` sendiri (`kaki5/`, `rosok/`, `retail/`).

---

## 7. Guardrails yang berlaku (ringkas)

- **Jangan commit & jangan push** tanpa perintah eksplisit pemilik. Commit = repo produksi
  `C:\Users\Admin\Documents\kasol`; push = mirror + GitHub, hanya atas permintaan.
- **Rilis live butuh perintah eksplisit per rilis.** "Gas" atas fix ≠ izin rilis live.
- **Jangan improve di luar permintaan** — temuan lain = saran tertulis, dikerjakan setelah dipilih.
- **Jangan ubah auth admin** (`admin123` di `control/js/auth.js`) — disengaja ditunda pemilik.
- Modul HUB = **skip** sampai definisi selesai.
- Credit broadcast WA dingin: **jangan disarankan lagi** (2 minggu, 0 hasil). Arah: video organik,
  grup FB, Marketplace, Google Business Profile, referral.

---

*STATUS-LIVE.md — snapshot 2026-10-24 · angka wajib di-verifikasi ulang sebelum dipakai lagi*
