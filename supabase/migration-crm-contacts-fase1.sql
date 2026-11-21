-- ============================================================
-- CRM FASE 1 (Opsi B) — View terpadu Kontak
-- Repo: kasol | Project: hhywrvedlwljawgxzpkq | 2026-10-28
--
-- Tujuan: satu sumber data untuk tab "Kontak" di modul CRM (app Control):
-- gabungan `clients` (pelanggan) + `referral_partners` (mitra) per orang,
-- dipasangkan via global_identity_id, fallback nomor WA ternormalisasi,
-- fallback id sumber. READ-ONLY — tidak mengubah tabel/RPC eksisting.
-- Skema HUB (global_identities/licenses/...) TIDAK disentuh.
--
-- Kontrak kolom (dipakai control/js/crm.js):
--   identity_key, nama, wa, kota, provinsi,
--   kinds text[]            -> {klien} | {mitra} | {klien,mitra}
--   client_id, partner_id   -> drill-down ke detail modul lama
--   status_klien, status_mitra, tier_mitra,
--   kode_referral (Mitra MKS-* diprioritaskan, fallback AJK-* klien),
--   app_type (terakhir), app_types text[], nilai_klien (sum price_paid),
--   last_seen (ISO text), global_identity_id, source_rows
--
-- Rollback: supabase/rollback-crm-contacts-fase1.sql
-- ============================================================

create or replace view crm_contacts as
with src as (
    select
        'klien'::text                                                     as kind,
        c.id::text                                                        as client_id,
        null::text                                                        as partner_id,
        coalesce(nullif(btrim(c.nama_usaha), ''), nullif(btrim(c.nama_pemilik), '')) as nama,
        c.no_whatsapp                                                     as wa,
        coalesce(c.kabkota, c.kecamatan, '')                              as kota,
        coalesce(c.provinsi, '')                                          as provinsi,
        c.app_type                                                        as app_type,
        c.status                                                          as status_klien,
        null::text                                                        as status_mitra,
        null::text                                                        as tier,
        (
            select lc.code
            from license_codes lc
            where lc.kind = 'referral'
              and lc.owner_client_id = c.id
            order by lc.created_at desc nulls last
            limit 1
        )                                                                 as kode_referral,
        coalesce(c.price_paid, 0)::numeric                                as nilai,
        coalesce(c.last_seen, c.first_seen, c.created_at)                 as last_seen_ts,
        c.global_identity_id                                              as global_identity_id,
        nullif(regexp_replace(coalesce(c.no_whatsapp, ''), '[^0-9]', '', 'g'), '') as phone_key
    from clients c

    union all

    select
        'mitra'::text,
        null::text,
        p.id::text,
        p.nama,
        p.no_whatsapp,
        coalesce(p.kota, ''),
        coalesce(p.provinsi, ''),
        p.app_type,
        null::text,
        p.status,
        p.tier,
        p.code,
        0::numeric,
        coalesce(p.approved_at, p.verified_at, p.created_at),
        p.global_identity_id,
        nullif(regexp_replace(coalesce(p.no_whatsapp, ''), '[^0-9]', '', 'g'), '')
    from referral_partners p
),
keyed as (
    select
        s.*,
        coalesce(
            nullif(btrim(coalesce(s.global_identity_id, '')), ''),
            case when s.phone_key is not null then 'wa:' || s.phone_key end,
            'id:' || coalesce(s.client_id, s.partner_id)
        ) as identity_key
    from src s
)
select
    k.identity_key::text                                                    as identity_key,
    -- Nama usaha klien diprioritaskan (paling spesifik), fallback nama mitra;
    -- kalau satu orang punya banyak outlet, ambil yang last_seen terbaru.
    (array_agg(k.nama order by (k.kind = 'klien') desc, k.last_seen_ts desc nulls last))[1]::text as nama,
    (array_remove(array_agg(k.wa), null))[1]::text                          as wa,
    (array_remove(array_agg(nullif(k.kota, '')), null))[1]::text            as kota,
    (array_remove(array_agg(nullif(k.provinsi, '')), null))[1]::text        as provinsi,
    array_agg(distinct k.kind)                                              as kinds,
    (array_remove(array_agg(k.client_id), null))[1]::text                   as client_id,
    (array_remove(array_agg(k.partner_id), null))[1]::text                  as partner_id,
    (array_agg(k.status_klien order by k.last_seen_ts desc nulls last)
        filter (where k.status_klien is not null))[1]::text                 as status_klien,
    (array_agg(k.status_mitra order by k.last_seen_ts desc nulls last)
        filter (where k.status_mitra is not null))[1]::text                 as status_mitra,
    (array_remove(array_agg(k.tier), null))[1]::text                        as tier_mitra,
    -- Kode mitra (MKS-*) diprioritaskan; klien punya kode referral AJK-* juga.
    (array_remove(array_agg(k.kode_referral), null))[1]::text               as kode_referral,
    (array_agg(k.app_type order by k.last_seen_ts desc nulls last))[1]::text as app_type,
    array_agg(distinct k.app_type) filter (where k.app_type is not null)    as app_types,
    coalesce(sum(k.nilai), 0)::numeric                                      as nilai_klien,
    max(k.last_seen_ts)::text                                               as last_seen,
    (array_remove(array_agg(k.global_identity_id), null))[1]::text          as global_identity_id,
    count(*)::integer                                                       as source_rows
from keyed k
group by k.identity_key;

-- Eksplisit: view dibaca via proxy service-role, bukan publik.
alter view crm_contacts set (security_invoker = false);

-- Pelajaran Supabase (auto-grant): cabut eksplisit dari semua role non-service.
revoke all on crm_contacts from public, anon, authenticated;
grant select on crm_contacts to service_role;
