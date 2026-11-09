-- ============================================================================
-- RAPIKAN SISA `licenses.plan` (2026-11-05)
-- ============================================================================
-- Sejak `migration-hub-device-quota-global.sql`, kuota perangkat berasal dari
-- SATU angka `products.max_devices` di Katalog. Kolom warisan `licenses.plan`
-- ('single' | 'multi') tidak lagi punya makna mandiri — dulu ditulis oleh
-- tombol "→ Multi perangkat" di kartu Klien yang sudah dihapus.
--
-- KENAPA TIDAK DI-DROP:
--   · 4 migrasi historis masih menyebut kolom ini dalam INSERT backfill
--     (migration-hub-identity-licenses.sql, ...-account-kasol-fase-a1.sql,
--      ...-hub-fase1-jembatan-akun.sql, ...-voucher-license-redeem-fase-b2.sql).
--     migration-hub-identity-licenses.sql secara eksplisit IDEMPOTEN & aman
--     dijalankan ulang → drop kolom akan mematahkan janji itu.
--   · RPC lama `partner_my_apps` (era portal) masih mengembalikan `plan`.
--   · `licenses.plan` NOT NULL + CHECK, jadi INSERT lama butuh nilainya.
--
-- SOLUSI: jadikan `plan` MIRROR yang DIJAGA DB, persis seperti `max_devices`.
--   · Trigger `licenses_sync_device_quota` diperluas: menulis ulang `plan`
--     dari kuota produk pada INSERT/UPDATE (termasuk UPDATE OF plan), sehingga
--     tidak ada kode yang bisa membuatnya basi / berbohong lagi.
--   · `hub_my_licenses()` (sumber data layar "Aplikasi Saya" di mitra)
--     BERHENTI mengembalikan key `plan` dan membaca `max_devices` langsung
--     dari `products` — bukan dari mirror.
--   · Kode aplikasi (mitra, Control, QA, audit) tidak membaca/menulis `plan`.
--
-- ROLLBACK: jalankan ulang migration-hub-device-quota-global.sql (trigger tanpa
--   pengaturan `plan`), lalu migration-hub-identity-licenses.sql untuk
--   mengembalikan definisi hub_my_licenses() lama.
-- ============================================================================

begin;

-- ── 1) Trigger lisensi: rawat max_devices DAN plan dari produk ─────────────
create or replace function public.licenses_sync_device_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q integer;
begin
  v_q := public.product_device_quota(new.product_id);
  new.max_devices := v_q;
  -- 'plan' diturunkan, bukan dipilih. Nilai dari INSERT lama / tombol lawas
  -- selalu ditimpa ⇒ tidak ada lagi dua sumber kebenaran untuk paket perangkat.
  new.plan := case when v_q > 1 then 'multi' else 'single' end;
  return new;
end;
$$;

drop trigger if exists licenses_sync_device_quota on public.licenses;
create trigger licenses_sync_device_quota
  before insert or update of product_id, max_devices, plan on public.licenses
  for each row execute function public.licenses_sync_device_quota();

comment on column public.licenses.plan is
  'DEPRECATED — mirror otomatis dari products.max_devices (trigger licenses_sync_device_quota): multi bila >1, single bila 1. Dipertahankan hanya demi kompatibilitas migrasi/RPC lama. Jangan dipakai sebagai sumber kebenaran.';

-- Samakan seluruh baris existing (UPDATE ini memicu trigger di atas).
update public.licenses set plan = plan;

-- ── 2) hub_my_licenses(): buang `plan`, baca kuota dari PRODUK ──────────────
create or replace function public.hub_my_licenses()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'license_id',  l.id,
          'app_type',    l.app_type,
          'kode_produk', p.kode_produk,
          -- 'plan' SENGAJA DIHAPUS. Klien memakai max_devices (angka) & status.
          'max_devices', p.max_devices,
          'status',      l.status,
          'expired',     (l.expires_at is not null and l.expires_at <= now()),
          'outlet_ref',  l.outlet_ref,
          'tx_used',     l.tx_used,
          'tx_quota',    p.tx_quota,
          'devices', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'device_code', d.device_code,
                'label',       d.device_label,
                'status',      d.status,
                'last_seen',   d.last_seen
              ) order by d.activated_at desc
            )
            from public.license_devices d
            where d.license_id = l.id
          ), '[]'::jsonb)
        ) order by l.app_type
      )
      from public.licenses l
      left join public.products p on p.id = l.product_id
      where l.global_identity_id = public.current_global_identity_id()
    ),
    '[]'::jsonb
  )
$$;

revoke all on function public.hub_my_licenses() from public;
grant execute on function public.hub_my_licenses() to authenticated, service_role;

-- ── 3) Verifikasi dalam transaksi ──────────────────────────────────────────
do $$
declare
  v_beda integer;
begin
  select count(*)::int into v_beda
    from public.licenses l
    join public.products p on p.id = l.product_id
   where l.max_devices is distinct from p.max_devices
      or l.plan is distinct from (case when p.max_devices > 1 then 'multi' else 'single' end);
  if v_beda > 0 then
    raise exception 'Pembersihan plan gagal: % lisensi masih menyimpang', v_beda;
  end if;
end;
$$;

commit;
