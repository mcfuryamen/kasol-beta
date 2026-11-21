-- =============================================================================
-- MIGRASI — MITRA PORTAL FASE 3: fitur referral DI APP KLIEN (kaki5 dulu)
-- =============================================================================
-- Tanggal : 27/10/2026
-- Owner   : "keduanya" — (a) redeem kode diskon saat beli lisensi di app,
--           (b) kartu "🤝 Ajak Teman" (pengguna app jadi pengundang, dapat poin)
--
-- Yang dibuat:
--   1. code_apply_discount(p_code, p_unit_id, p_device_code, p_app_type, p_price)
--      → redeem kode (DSK- voucher / MKS- mitra / AJK- pelanggan) di layar
--        pembelian app. Validasi + hitung diskon + catat ledger + award poin
--        ke pengundang + tulis clients.purchase_*. Return
--        {ok, code, discount, final_price, points_awarded, already, reason}.
--   2. referral_my_code(p_unit_id, p_device_code, p_app_type)
--      → ambil/buat (idempoten) kode referral milik pengguna app + saldo
--        wallet-nya + riwayat referral. Return
--        {ok, code, discount, min_purchase, expires_at, points_*, referrals[]}.
--   3. Index code_redemptions(referrer_client_id) buat riwayat pelanggan.
--
-- PRINSIP KEAMANAN (revisi kontrak RPC 2026-10-26, ADR §5):
--   Identitas PEMANGGIL diverifikasi DI DALAM fungsi dari (unit_id +
--   device_code) — pola device_known. BUKAN parameter bebas p_client_id
--   (siapa pun bisa menunjuk wallet/baris orang lain lewat browser).
--
-- SENGKAH TIDAK ADA:
--   · ALTER TABLE pada tabel panas (clients/license_codes) → kolom yang
--     dibutuhkan SUDAH ada sejak Fase 1 (migration-mitra-portal-fase1*.sql)
--     → tanpa risiko deadlock 40P01.
--   · Perubahan perilaku app yang live: fungsi baru belum dipanggil siapa pun
--     sampai frontend kaki5 dirilis (gate rilis terpisah).
--
-- Verifikasi setelah apply:
--   node supabase/audit-schema.js --ref=<ref> --only=mitra_rows,mitra_acl
--   + cek has_function_privilege('anon', ..., 'execute') = yes untuk kedua
--     fungsi ini (client-facing), dan 'service_role' = yes.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. RPC code_apply_discount — redeem kode diskon/referral saat pembelian
-- -----------------------------------------------------------------------------
-- Dipanggil dari sheet "Beli Lisensi" kaki5 (tombol "Terapkan").
--
-- Jenis kode yang diterima (license_codes.kind):
--   'voucher'  → DSK- (hasil klaim referral) / voucher admin. Diskon dari
--                baris kode. Poin: kalau kodenya hasil klaim referral
--                (owner_partner_id terisi), reward tier free (+5) yang sudah
--                ada di-UPGRADE ke tier paid (+50) di tempat — semantik persis
--                partner_mark_purchase (delta, idempoten). Voucher admin
--                biasa (tanpa owner) → tidak mengubah poin siapa pun.
--   'referral' → MKS- (mitra) / AJK- (pengguna app). Dipakai LANGSUNG di
--                checkout. Pengundang dapat tier paid (+50) — baris ledger
--                baru channel='lisensi', atau upgrade baris claim-nya kalau
--                refereenya sempat klaim duluan di web.
--
-- Guard: kode aktif + belum kedaluwarsa + cocok app_type ('*' = universal),
--   min_purchase, batas pemakaian (discount_max_uses + 1 perangkat = 1x),
--   anti self-referral (pemilik kode = pemanggil → ditolak),
--   idempoten (perangkat yang sama kirim kode yang sama → balikin state
--   tersimpan, tidak menambah pemakaian — aman buka-ulang sheet).
--
-- PENTING: penulisan clients.purchase_* terjadi SAAT KODE DITERAPKAN (sebelum
-- transfer), bukan saat kirim bukti. Admin verifikasi bukti dengan membanding-
-- kan nominal transfer vs price_paid/purchase_discount yang sudah tercatat.
create or replace function public.code_apply_discount(
  p_code        text,
  p_unit_id     text,
  p_device_code text default null,
  p_app_type    text default null,
  p_price       numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code      text;
  v_app       text;
  v_lc        public.license_codes%rowtype;
  v_client    public.clients%rowtype;
  v_phone     text;
  v_cfg       jsonb := '{}'::jsonb;
  v_base      numeric;
  v_discount  numeric := 0;
  v_final     numeric;
  v_paid      integer := 50;
  v_cycle     integer := 30;
  v_red       public.code_redemptions%rowtype;
  v_old       integer := 0;
  v_delta     integer := 0;
  v_awarded   integer := 0;
begin
  v_code := upper(btrim(coalesce(p_code, '')));
  v_app  := coalesce(nullif(btrim(coalesce(p_app_type, '')), ''), 'kaki5');
  v_base := coalesce(p_price, 0);

  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'Ketik kode diskonnya dulu ya.');
  end if;
  if v_base < 0 then
    return jsonb_build_object('ok', false, 'reason', 'Harga produk belum diketahui.');
  end if;

  -- 0) Identitas pemanggil — pola device_known: unit_id dulu, fallback device_code.
  select * into v_client
    from public.clients
   where unit_id = p_unit_id
   limit 1;
  if not found and p_device_code is not null then
    select * into v_client
      from public.clients
     where device_code = p_device_code
     limit 1;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Perangkat belum terdaftar. Buka app dulu lalu coba lagi.');
  end if;
  v_phone := public.partner_norm_wa(v_client.no_whatsapp);

  -- 1) Kode harus ada & berlaku. Kunci baris sebelum membaca kuota/counter
  -- agar dua checkout bersamaan tidak sama-sama lolos validasi.
  select * into v_lc
    from public.license_codes
   where upper(code) = v_code
     and kind in ('voucher', 'referral')
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Kode nggak ketemu. Cek lagi penulisannya.');
  end if;
  if v_lc.status <> 'aktif' or v_lc.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'Kode ini udah nggak berlaku.');
  end if;
  if v_lc.app_type is distinct from '*' and v_lc.app_type is distinct from v_app then
    return jsonb_build_object('ok', false, 'reason', 'Kode ini bukan buat produk ini.');
  end if;

  -- 2) Anti self-referral: pemilik kode = pemanggil
  if v_lc.owner_client_id is not null and v_lc.owner_client_id = v_client.id then
    return jsonb_build_object('ok', false, 'reason', 'Nggak bisa pakai kode sendiri.');
  end if;
  if v_lc.owner_partner_id is not null and exists (
    select 1 from public.referral_partners p
     where p.id = v_lc.owner_partner_id
       and p.client_id = v_client.id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'Nggak bisa pakai kode sendiri.');
  end if;

  -- 3) Idempoten per perangkat: kode sama dikirim ulang → state tersimpan.
  --    (Buka-ulang sheet / sinyal jelek nggak boleh nambah pemakaian kode.)
  if v_lc.discount_used_by is not null and v_client.id = any(v_lc.discount_used_by) then
    if v_client.purchase_code = v_lc.code then
      v_discount := coalesce(v_client.purchase_discount, 0);
      v_final    := coalesce(v_client.price_paid, greatest(v_base - v_discount, 0));
      return jsonb_build_object(
        'ok', true, 'already', true,
        'code', v_lc.code, 'discount', v_discount, 'final_price', v_final,
        'points_awarded', 0,
        'message', 'Kode ini udah kepakai di perangkat ini.'
      );
    end if;
    return jsonb_build_object('ok', false, 'reason', 'Kode ini udah kepakai di perangkat ini.');
  end if;

  -- 4) Batas pemakaian global kode
  if v_lc.discount_max_uses is not null
     and v_lc.discount_used_count >= v_lc.discount_max_uses then
    return jsonb_build_object('ok', false, 'reason', 'Kode ini udah habis kuotanya.');
  end if;

  -- 5) Minimal pembelian (dihitung dari harga sebelum diskon)
  if v_base < v_lc.min_purchase then
    return jsonb_build_object(
      'ok', false, 'reason',
      'Kode ini berlaku buat pembelian minimal Rp ' ||
      to_char(v_lc.min_purchase, 'FM999999999') || '.',
      'min_purchase', v_lc.min_purchase
    );
  end if;

  -- 6) Hitung diskon
  if v_lc.discount_type = 'percent' then
    v_discount := round(v_base * v_lc.discount_value / 100.0);
    if v_lc.max_discount is not null then
      v_discount := least(v_discount, v_lc.max_discount);
    end if;
  else
    v_discount := v_lc.discount_value;
  end if;
  if v_discount < 0 then
    v_discount := 0;
  end if;
  v_discount := least(v_discount, v_base);
  v_final    := v_base - v_discount;

  -- 7) Consume kode (atomic; SECURITY DEFINER → lewati RLS)
  update public.license_codes
     set discount_used_count = discount_used_count + 1,
         discount_used_by    = coalesce(discount_used_by, '{}'::uuid[]) || v_client.id,
         discount_used_at    = now(),
         status              = case
                                 when discount_max_uses is not null
                                      and discount_used_count + 1 >= discount_max_uses
                                   then 'terpakai'
                                 else status
                               end,
         updated_at          = now()
   where id = v_lc.id;

  -- 8) Tulis pipeline pembelian di clients — admin bandingkan ini dengan bukti
  --    transfer saat verifikasi (purchase_discount vs nominal).
  update public.clients
     set purchase_code     = v_lc.code,
         purchase_discount = v_discount,
         price_paid        = v_final,
         voucher_id        = case
                               when v_lc.kind = 'voucher' then v_lc.id
                               else public.clients.voucher_id
                             end,
         referred_by_code  = v_lc.code,
         updated_at        = now()
   where id = v_client.id;

  -- 9) Poin ke pengundang — hanya kalau kodenya punya pemilik
  --    (voucher admin biasa: owner kosong → lewati, tidak mengubah poin).
  if v_lc.owner_partner_id is not null or v_lc.owner_client_id is not null then
    select coalesce(value, '{}'::jsonb) into v_cfg
      from public.settings where key = 'referral_config';
    v_paid := coalesce((v_cfg->>'points_per_paid_referral')::int, 50);

    -- Siklus payout = status referrer (punya lisensi → 7 hari, bukan → 30).
    if v_lc.owner_partner_id is not null then
      if exists (
        select 1
          from public.referral_partners p
          join public.clients c on c.id = p.client_id
         where p.id = v_lc.owner_partner_id
           and c.license_status = 'aktif'
      ) then
        v_cycle := coalesce((v_cfg->>'payout_cycle_days_licensed')::int, 7);
      else
        v_cycle := coalesce((v_cfg->>'payout_cycle_days_referral_only')::int, 30);
      end if;
    else
      if exists (
        select 1 from public.clients c
         where c.id = v_lc.owner_client_id
           and c.license_status = 'aktif'
      ) then
        v_cycle := coalesce((v_cfg->>'payout_cycle_days_licensed')::int, 7);
      else
        v_cycle := coalesce((v_cfg->>'payout_cycle_days_referral_only')::int, 30);
      end if;
    end if;

    -- Reward referee ini untuk referrer ini: sudah ada barisnya (hasil klaim
    -- web tier free) → upgrade di tempat (persis partner_mark_purchase);
    -- belum ada → baris baru channel='lisensi' langsung tier paid.
    select * into v_red
      from public.code_redemptions
     where (
             (v_lc.owner_partner_id is not null
              and referrer_partner_id = v_lc.owner_partner_id)
          or (v_lc.owner_client_id is not null
              and referrer_client_id = v_lc.owner_client_id)
           )
       and (client_id = v_client.id
            or (v_phone is not null and referee_phone = v_phone))
     order by created_at desc
     limit 1;

    if found and v_red.points_awarded < v_paid then
      -- Upgrade tier paid: 5 → 50 (delta), idempoten kalau sudah ≥ paid.
      v_old   := v_red.points_awarded;
      v_delta := v_paid - v_old;
      update public.code_redemptions
         set points_awarded = v_paid,
             reason = coalesce(reason || ' | ', '') || 'upgrade: pembelian tercatat (auto)'
       where id = v_red.id;

      if v_lc.owner_partner_id is not null then
        update public.referral_wallets w
           set points_pending = greatest(w.points_pending - v_old + v_paid, 0),
               points_earned  = w.points_earned + v_delta,
               points_balance = case
                                  when v_red.points_released_at is not null
                                    then w.points_balance + v_delta
                                  else w.points_balance
                                end,
               updated_at     = now()
         where w.partner_id = v_lc.owner_partner_id;
      else
        update public.referral_wallets w
           set points_pending = greatest(w.points_pending - v_old + v_paid, 0),
               points_earned  = w.points_earned + v_delta,
               points_balance = case
                                  when v_red.points_released_at is not null
                                    then w.points_balance + v_delta
                                  else w.points_balance
                                end,
               updated_at     = now()
         where w.client_id = v_lc.owner_client_id;
      end if;
      v_awarded := v_delta;
    elsif not found then
      insert into public.code_redemptions (
        code_id, code, channel, client_id, unit_id, app_type,
        discount_value, points_awarded, hold_until,
        referrer_client_id, referrer_partner_id, status,
        referee_name, referee_city, referee_phone
      )
      values (
        v_lc.id, v_lc.code, 'lisensi', v_client.id, v_client.unit_id, v_app,
        v_discount, v_paid, now() + (v_cycle || ' days')::interval,
        v_lc.owner_client_id, v_lc.owner_partner_id, 'berhasil',
        coalesce(v_client.nama_usaha, v_client.nama_pemilik),
        v_client.kabkota, v_phone
      );

      if v_lc.owner_partner_id is not null then
        insert into public.referral_wallets (partner_id, app_type, points_pending, points_earned)
        values (v_lc.owner_partner_id, 'kaki5', v_paid, v_paid)
        on conflict (partner_id) do update
          set points_pending = public.referral_wallets.points_pending + v_paid,
              points_earned  = public.referral_wallets.points_earned + v_paid,
              updated_at     = now();
      else
        insert into public.referral_wallets (client_id, app_type, points_pending, points_earned)
        values (v_lc.owner_client_id, 'kaki5', v_paid, v_paid)
        on conflict (client_id) do update
          set points_pending = public.referral_wallets.points_pending + v_paid,
              points_earned  = public.referral_wallets.points_earned + v_paid,
              updated_at     = now();
      end if;
      v_awarded := v_paid;
    else
      -- Sudah tier paid untuk referee ini → tidak ada poin tambahan.
      v_awarded := 0;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'code', v_lc.code,
    'discount', v_discount,
    'final_price', v_final,
    'points_awarded', v_awarded
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. RPC referral_my_code — kode referral milik pengguna app (🤝 Ajak Teman)
-- -----------------------------------------------------------------------------
-- Idempoten: belum punya → buat 'AJK-XXXXXX' (universal '*', masa berlaku
-- panjang & diperpanjang otomatis saat diakses — kode pelanggan buat
-- di-share terus, bukan kampanye 30 hari seperti kode mitra).
-- Sekalian balikin saldo wallet (client_id) + riwayat referral (maks 20).
create or replace function public.referral_my_code(
  p_unit_id     text,
  p_device_code text default null,
  p_app_type    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client  public.clients%rowtype;
  v_lc      public.license_codes%rowtype;
  v_wallet  public.referral_wallets%rowtype;
  v_cfg     jsonb := '{}'::jsonb;
  v_discount    numeric := 50000;
  v_min_purchase numeric := 100000;
  v_code    text;
  v_attempt integer := 0;
  v_hist    jsonb := '[]'::jsonb;
  v_cycle   integer := 30;
begin
  -- Identitas pemanggil — pola device_known.
  select * into v_client
    from public.clients
   where unit_id = p_unit_id
   limit 1;
  if not found and p_device_code is not null then
    select * into v_client
      from public.clients
     where device_code = p_device_code
     limit 1;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Perangkat belum terdaftar.');
  end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
    from public.settings where key = 'referral_config';
  v_discount     := coalesce((v_cfg->>'discount_referral')::numeric, 50000);
  v_min_purchase := coalesce((v_cfg->>'min_purchase_for_discount')::numeric, 100000);

  -- Siklus payout pelanggan = status lisensinya sendiri.
  if v_client.license_status = 'aktif' then
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_licensed')::int, 7);
  else
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_referral_only')::int, 30);
  end if;

  -- Sudah punya kode? (1 pelanggan = 1 kode, universal)
  select * into v_lc
    from public.license_codes
   where owner_client_id = v_client.id
     and kind = 'referral'
   order by created_at
   limit 1;

  if found then
    if v_lc.status = 'aktif' and v_lc.expires_at <= now() + interval '30 days' then
      -- Perpanjang otomatis — kartu harus selalu hidup.
      update public.license_codes
         set expires_at = now() + interval '365 days',
             updated_at = now()
       where id = v_lc.id
      returning * into v_lc;
    elsif v_lc.status <> 'aktif' then
      -- Dibatalkan admin → jangan bangkitkan sendiri; laporkan apa adanya.
      return jsonb_build_object('ok', false, 'reason', 'Kode referral lo sedang dinonaktifkan admin.');
    end if;
  else
    -- Buat kode baru (univers: bisa dipakai di semua produk Kasir Solo,
    -- selaras Fase 2b untuk kode mitra). Retry kalau bentrok (ketebalan
    -- 6 hex = 16 juta kombinasi; 5 percobaan lebih dari cukup).
    loop
      v_attempt := v_attempt + 1;
      v_code := 'AJK-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
      begin
        insert into public.license_codes (
          code, kind, app_type, owner_client_id, created_by, status, expires_at,
          discount_type, discount_value, min_purchase, notes
        )
        values (
          v_code, 'referral', '*', v_client.id, 'client', 'aktif',
          now() + interval '365 days',
          'fixed', v_discount, v_min_purchase,
          'Kode referral pengguna app (Ajak Teman)'
        )
        returning * into v_lc;
        exit;
      exception when unique_violation then
        if v_attempt >= 5 then
          return jsonb_build_object('ok', false, 'reason', 'Gagal bikin kode, coba lagi sebentar.');
        end if;
      end;
    end loop;
  end if;

  -- Dompet pelanggan (satu per client; unique index client_id sudah ada).
  insert into public.referral_wallets (client_id, app_type)
  values (v_client.id, 'kaki5')
  on conflict (client_id) do nothing;

  select * into v_wallet
    from public.referral_wallets
   where client_id = v_client.id
   limit 1;

  -- Riwayat referral (sumber: ledger; RLS tabel tidak dibuka ke anon).
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_hist
    from (
      select r.referee_name                              as name,
             coalesce(r.referee_city, '')                as city,
             r.points_awarded                            as points,
             to_char(r.created_at, 'YYYY-MM-DD')         as date,
             (r.points_released_at is not null)          as released,
             r.status
        from public.code_redemptions r
       where r.referrer_client_id = v_client.id
       order by r.created_at desc
       limit 20
    ) x;

  return jsonb_build_object(
    'ok', true,
    'code', v_lc.code,
    'expires_at', to_char(v_lc.expires_at, 'YYYY-MM-DD'),
    'discount', v_lc.discount_value,
    'min_purchase', v_lc.min_purchase,
    'points_balance', coalesce(v_wallet.points_balance, 0),
    'points_pending', coalesce(v_wallet.points_pending, 0),
    'points_earned', coalesce(v_wallet.points_earned, 0),
    'cycle_days', v_cycle,
    'referrals', v_hist
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Index riwayat referral pelanggan
-- -----------------------------------------------------------------------------
create index if not exists idx_code_redemptions_referrer_client
  on public.code_redemptions (referrer_client_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 4. GRANT — kedua fungsi ini CLIENT-FACING (dipanggil anon dari app kaki5),
--    pola device_known. BUKAN RPC admin.
-- -----------------------------------------------------------------------------
revoke all on function public.code_apply_discount(text, text, text, text, numeric) from public;
grant execute on function public.code_apply_discount(text, text, text, text, numeric)
  to anon, authenticated, service_role;

revoke all on function public.referral_my_code(text, text, text) from public;
grant execute on function public.referral_my_code(text, text, text)
  to anon, authenticated, service_role;

commit;

-- -----------------------------------------------------------------------------
-- Verifikasi manual (SQL editor / audit-schema.js):
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'execute')        as anon_ok,
--          has_function_privilege('service_role', p.oid, 'execute') as svc_ok
--     from pg_proc p
--    where p.proname in ('code_apply_discount', 'referral_my_code');
--   → anon_ok = yes untuk keduanya (client-facing).
--   Smoke test aman (kode ngawur, harus return ok=false, bukan error):
--   select public.code_apply_discount('DSK-NGAWUR', 'K5-XXXX-XXXX', null, 'kaki5', 500000);
-- =============================================================================
