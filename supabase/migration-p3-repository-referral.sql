-- =============================================================================
-- HARDENING P3 (bagian 2) — Repository data referral: kode yatim + dompet kosong
-- =============================================================================
-- Tanggal : 20 November 2026
-- Project : hhywrvedlwljawgxzpkq
-- Sesi    : audit koneksi data 4 app kasol (lanjutan P0/P1/P2)
--
-- PRINSIP
--   Semua baris yang "rusak" diarsipkan dulu ke tabel `p3_arsip_referral`
--   (payload JSONB lengkap + alasan) sebelum diubah/dihapus. Jadi kalau ternyata
--   ada yang ternyata masih dipakai, nilainya bisa dipulihkan persis.
--   Tidak ada DELETE tanpa arsip.
--
-- TEMUAN 1 — 9 KODE REFERRAL YATIM
--   `license_codes` kind='referral' yang:
--     - owner_partner_id IS NULL
--     - owner_client_id IS NULL
--     - owner_unit_id IS NULL
--     - global_identity_id IS NULL
--     - TIDAK punya pasangan di `referral_partners` (referral_partners.code)
--     - TIDAK PERNAH dipakai (0 baris di code_redemptions)
--     - dibuat 10 Nov 2026 oleh created_by='mitra', notes "Kode referral akun
--       (universal)" —也就是说 dibuat saat pendaftaran, tapi baris mitranya
--       belum sempat ada / sudah terhapus.
--
--   Kode:
--     MKS-5AD21C, MKS-815C8C, MKS-9EC492, MKS-A8FAFC, MKS-BCA15A,
--     MKS-C42373, MKS-DF6E01, MKS-E13B41, MKS-EC8BD2
--
--   Bahaya kalau dibiarkan:
--     `partner_claim_referral` mencari kode lewat `license_codes` dengan
--     kind='referral' + status='aktif'. Kode yatim yang TIDAK punya owner
--     sebenarnya tidak bisa diklaim (fungsi menolak kode tanpa owner_partner_id
--     dengan "kode ini nggak punya mitra") — tapi tetap berstatus 'aktif' dan
--     muncul di daftar kode Control, jadi(owner) bisa salah分发 / bagikan kode
--     yang经理 tidak pernah bisa dipakai.
--
--   TINDAKAN: set status = 'dibatalkan' (bukan DELETE).
--     - 'dibatalkan' sudah termasuk CHECK resmi license_codes_status_chk:
--       ('aktif','terpakai','kadaluwarsa','dibatalkan')
--     - `partner_claim_referral` menolak kode dengan status <> 'aktif'
--     - `code_apply_discount` juga menolak kode non-aktif
--     - kode tetap ada di arsip & di tabel → bisa diaktifkan lagi kapan saja
--
-- TEMUAN 2 — 2 DOMPET KOSONG TANPA MITRA
--   `referral_wallets` dengan partner_id IS NULL dan seluruh saldo 0:
--     - 773c5506-7148-4e18-b336-eb33c45b9541 (client_id 3327cb8d...)
--     - 5731b29c-a271-44cf-8e95-492db477fa29 (client_id 0053f79e...)
--   Keduanya milik global_identity_id 05d7b964-e2c7-4748-bfa8-ac5f78351239
--   ("amin maghfuri"), yang SUDAH punya mitra aktif:
--     - referral_partners 52cb8533-9f7c-479c-90a5-1aa5c383f8f6 (MKS-68166A)
--     - dompet pasangannya 9a372e97-2b76-4568-b926-e4c0091be7f7 (juga saldo 0)
--
--   Artinya: 2 dompet ini adalah DUPLIKAT era lama (keyed by client_id)
--   yang ditinggalkan saat dompet berubah jadi keyed by partner_id.
--   Tidak ada payout_requests yang menunjuknya (dicek: 0).
--
--   TINDAKAN: DELETE — tapi HANYA yang:
--     - partner_id IS NULL
--     - semua kolom saldo = 0 (balance/pending/earned/rupiah/withdrawable)
--     - TIDAK direferensikan payout_requests.wallet_id
--     - partner pasangannya SUDAH ada & dompet partner-nya juga saldo 0
--   Kalau salah satu syarat tidak terpenuhi → baris TIDAK dihapus.
--
--   Kenapa boleh hapus (pakai client_id, bukan partner_id):
--     - kolom `partner_id` NULL = dompet ini tidak pernah dipakai program mitra
--       modern (semua RPC mitra modern: partner_my_balance, partner_register,
--       referral_my_code, code_apply_discount, partner_claim_referral →
--       selalu读的 partner_id).
--     - saldo 0 → tidak ada uang/poin yang hilang.
--     - arsip JSONB menyimpan seluruh baris → bisa dipulihkan.
--
--   TIDAK dihapus: dompet mitro yang sah (partner_id NOT NULL), termasuk yang
--   saldonya nol (mis. MKS-913C3A pending 5 poin, MKS-68166A, dst).
--
-- YANG TIDAK DISENTUH
--   - `referral_partners` (tidak ada mitra yatim; semua partner punya dompet
--     atau memang mitra tanpa dompet karena belum ada poin)
--   - `code_redemptions` (ledger — tidak pernah dihapus)
--   - `payout_requests` (riwayat pencairan — tidak pernah dihapus)
--   - nomor WhatsApp yang mirip (62823251033366 / ...666 / ...661) → butuh
--     verifikasi manusia, TIDAK dinormalisasi otomatis.
--
-- ROLLBACK
--   -- kode:
--   update public.license_codes lc
--      set status = a.status_sebelum, updated_at = now()
--     from public.p3_arsip_referral a
--    where a.kategori = 'kode_yatim' and a.id::text = lc.id::text;
--   -- dompet:
--   insert into public.referral_wallets
--     (id, partner_id, client_id, unit_id, app_type, points_balance,
--      points_pending, points_earned, rupiah_balance, withdrawable,
--      created_at, updated_at)
--   select (a.payload->>'id')::uuid, null, (a.payload->>'client_id')::uuid,
--          a.payload->>'unit_id', a.payload->>'app_type',
--          (a.payload->>'points_balance')::int, (a.payload->>'points_pending')::int,
--          (a.payload->>'points_earned')::int, (a.payload->>'rupiah_balance')::numeric,
--          (a.payload->>'withdrawable')::numeric,
--          (a.payload->>'created_at')::timestamptz, now()
--     from public.p3_arsip_referral a where a.kategori = 'dompet_kosong';
--
-- VERIFIKASI (setelah apply)
--   select kategori, count(*) from public.p3_arsip_referral group by kategori;
--   select count(*) from public.license_codes
--    where kind='referral' and owner_partner_id is null and status='aktif';
--   select count(*) from public.referral_wallets where partner_id is null;
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabel arsip (idempoten — aman dijalankan ulang)
-- ---------------------------------------------------------------------------
create table if not exists public.p3_arsip_referral (
  id          uuid primary key default gen_random_uuid(),
  kategori    text not null,
  ref_id      uuid not null,
  payload     jsonb not null,
  alasan      text not null,
  dibuat_pada timestamptz not null default now()
);

comment on table public.p3_arsip_referral is
  'Arsip data referral yatim hasil audit P3 (20 Nov 2026). Sumber pemulihan data.';

create index if not exists p3_arsip_referral_kategori_idx
  on public.p3_arsip_referral (kategori, ref_id);

-- RLS aktif, TANPA policy → anon/authenticated tidak bisa baca arsip.
alter table public.p3_arsip_referral enable row level security;
revoke all on public.p3_arsip_referral from anon, authenticated;
grant select, insert, update, delete on public.p3_arsip_referral to service_role;

-- ---------------------------------------------------------------------------
-- 2. Arsipkan + batalkan 9 kode referral yatim
-- ---------------------------------------------------------------------------
do $kode$
declare
  n_arsip integer := 0;
  n_batal integer := 0;
begin
  -- 2a. Arsip dulu (payload = baris SEBELUM diubah).
  insert into public.p3_arsip_referral (kategori, ref_id, payload, alasan)
  select 'kode_yatim',
         lc.id,
         to_jsonb(lc) - 'id',   -- id disimpan di kolom ref_id
         'Kode referral tanpa owner (partner/client/unit/gid kosong), tanpa pasangan di referral_partners, dan belum pernah dipakai. Dibatalkan P3 20 Nov 2026.'
    from public.license_codes lc
   where lc.kind = 'referral'
     and lc.status = 'aktif'
     and lc.owner_partner_id is null
     and lc.owner_client_id is null
     and lc.owner_unit_id is null
     and lc.global_identity_id is null
     and not exists (
           select 1 from public.referral_partners rp where rp.code = lc.code
         )
     and not exists (
           select 1 from public.code_redemptions cr where cr.code_id = lc.id
         )
  on conflict do nothing;

  get diagnostics n_arsip = row_count;

  -- 2b. Batalkan kodenya.
  update public.license_codes lc
     set status = 'dibatalkan',
         notes = coalesce(lc.notes, '') ||
                 ' [P3 2026-11-20] Dibatalkan: kode referral tanpa owner, belum pernah dipakai. Bisa diaktifkan lagi dari p3_arsip_referral.',
         updated_at = now()
    from public.p3_arsip_referral a
   where a.kategori = 'kode_yatim'
     and a.ref_id = lc.id
     and lc.status = 'aktif';

  get diagnostics n_batal = row_count;

  raise notice 'Kode yatim: % diarsipkan, % dibatalkan', n_arsip, n_batal;
end
$kode$;

-- ---------------------------------------------------------------------------
-- 3. Arsipkan + hapus 2 dompet kosong tanpa mitra
-- ---------------------------------------------------------------------------
do $dompet$
declare
  n_arsip integer := 0;
  n_hapus integer := 0;
begin
  -- 3a. Arsip dulu.
  insert into public.p3_arsip_referral (kategori, ref_id, payload, alasan)
  select 'dompet_kosong',
         w.id,
         to_jsonb(w) - 'id',
         'Dompet tanpa partner_id dan seluruh saldo 0, tidak direferensikan payout_requests, dan akunnya sudah punya mitra+dompet pasangannya. Dihapus P3 20 Nov 2026.'
    from public.referral_wallets w
   where w.partner_id is null
     and w.points_balance = 0
     and w.points_pending = 0
     and w.points_earned = 0
     and w.rupiah_balance = 0
     and w.withdrawable = 0
     and not exists (
           select 1 from public.payout_requests pr where pr.wallet_id = w.id
         )
     -- akunnya sudah punya mitra aktif + dompetnya juga ada
     and exists (
           select 1
             from public.clients c
             join public.referral_partners rp
               on rp.global_identity_id = c.global_identity_id
              and rp.status = 'aktif'
             join public.referral_wallets pw
               on pw.partner_id = rp.id
            where c.id = w.client_id
              and pw.points_balance = 0
              and pw.points_pending = 0
              and pw.points_earned = 0
              and pw.rupiah_balance = 0
              and pw.withdrawable = 0
         )
  on conflict do nothing;

  get diagnostics n_arsip = row_count;

  -- 3b. Hapus hanya yang sudah terarsip & memenuhi syarat sama.
  delete from public.referral_wallets w
   using public.p3_arsip_referral a
   where a.kategori = 'dompet_kosong'
     and a.ref_id = w.id
     and w.partner_id is null
     and w.points_balance = 0
     and w.points_pending = 0
     and w.points_earned = 0
     and w.rupiah_balance = 0
     and w.withdrawable = 0
     and not exists (
           select 1 from public.payout_requests pr where pr.wallet_id = w.id
         );

  get diagnostics n_hapus = row_count;

  raise notice 'Dompet kosong: % diarsipkan, % dihapus', n_arsip, n_hapus;
end
$dompet$;

-- ---------------------------------------------------------------------------
-- 4. Verifikasi inline — gagal = rollback otomatis
-- ---------------------------------------------------------------------------
do $verif$
declare
  n_kode_aktif_yatim integer;
  n_dompet_yatim     integer;
  n_arsip_kode       integer;
  n_arsip_dompet     integer;
begin
  -- a) Tidak boleh ada lagi kode referral aktif tanpa owner.
  select count(*) into n_kode_aktif_yatim
    from public.license_codes lc
   where lc.kind = 'referral'
     and lc.status = 'aktif'
     and lc.owner_partner_id is null
     and lc.owner_client_id is null
     and lc.owner_unit_id is null
     and lc.global_identity_id is null
     and not exists (select 1 from public.referral_partners rp where rp.code = lc.code)
     and not exists (select 1 from public.code_redemptions cr where cr.code_id = lc.id);

  if n_kode_aktif_yatim > 0 then
    raise exception 'Masih ada % kode referral aktif tanpa owner', n_kode_aktif_yatim;
  end if;

  -- b) Tidak boleh ada dompet tanpa partner yang saldo 0 & tak terpakai.
  select count(*) into n_dompet_yatim
    from public.referral_wallets w
   where w.partner_id is null
     and w.points_balance = 0
     and w.points_pending = 0
     and w.points_earned = 0
     and w.rupiah_balance = 0
     and w.withdrawable = 0
     and not exists (select 1 from public.payout_requests pr where pr.wallet_id = w.id);

  if n_dompet_yatim > 0 then
    raise exception 'Masih ada % dompet kosong tanpa mitra', n_dompet_yatim;
  end if;

  -- c) Arsip harus memuat semuanya (9 kode + 2 dompet).
  select count(*) into n_arsip_kode
    from public.p3_arsip_referral where kategori = 'kode_yatim';
  select count(*) into n_arsip_dompet
    from public.p3_arsip_referral where kategori = 'dompet_kosong';

  if n_arsip_kode < 9 then
    raise exception 'Arsip kode yatim kurang dari 9 (% ada)', n_arsip_kode;
  end if;
  if n_arsip_dompet < 2 then
    raise exception 'Arsip dompet kosong kurang dari 2 (% ada)', n_arsip_dompet;
  end if;

  -- d) Dompet mitra yang SAH tidak boleh hilang (termasuk saldo nol).
  if (select count(*) from public.referral_wallets where partner_id is not null) < 8 then
    raise exception 'Dompet mitra sah berkurang — jangan sampai ikut terhapus';
  end if;

  -- e) Kode referral milik mitra yang sah tetap utuh & aktif.
  if not exists (
       select 1 from public.license_codes
        where kind = 'referral' and owner_partner_id is not null and status = 'aktif'
     ) then
    raise exception 'Semua kode referral mitra hilang —Something wrong';
  end if;

  -- f) Arsip tidak boleh bisa dibaca anon.
  if has_table_privilege('anon', 'public.p3_arsip_referral', 'SELECT') then
    raise exception 'Tabel arsip terbuka untuk anon';
  end if;

  raise notice 'Verifikasi P3 repository: LULUS (% arsip kode, % arsip dompet)',
    n_arsip_kode, n_arsip_dompet;
end
$verif$;

-- ---------------------------------------------------------------------------
-- 5. Laporan hasil
-- ---------------------------------------------------------------------------
select 'kode_yatim_dibatalkan' as laporan,
       lc.code,
       lc.kind,
       lc.app_type,
       lc.status,
       lc.notes
  from public.license_codes lc
  join public.p3_arsip_referral a
    on a.kategori = 'kode_yatim' and a.ref_id = lc.id
 order by lc.code;

commit;
