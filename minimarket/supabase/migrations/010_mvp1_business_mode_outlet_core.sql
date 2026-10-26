-- MVP-1: operating mode, outlet identity, membership RLS, bootstrap trigger.
-- Terapan ke Supabase project hhywrvedlwljawgxzpkq (2026-10-05).

alter table public.businesses add column if not exists operating_mode text not null default 'single'
  check (operating_mode in ('single','multi'));

alter table public.outlets add column if not exists code text not null default '';
alter table public.outlets add column if not exists archived_at timestamptz;

-- Backfill kode outlet yang masih kosong: outlet pertama UTM, sisanya UTxx.
do $$
declare b record; i int; r record;
begin
  for b in select id from public.businesses loop
    i := 1;
    for r in select id from public.outlets where business_id = b.id and (code = '' or code is null) order by created_at loop
      update public.outlets set code = case when i = 1 then 'UTM' else 'UT' || lpad(i::text, 2, '0') end
      where id = r.id;
      i := i + 1;
    end loop;
  end loop;
end $$;

create unique index if not exists uq_outlets_business_code
  on public.outlets(business_id, code) where code <> '';
-- Hanya satu outlet default per business.
create unique index if not exists uq_outlets_one_default
  on public.outlets(business_id) where is_default = true;

-- ---------------------------------------------------------------------------
-- Helper RLS berbasis membership.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_outlet(p_outlet_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_outlet_id is not null and (
    exists (select 1 from public.outlet_memberships m
            where m.outlet_id = p_outlet_id and m.user_id = auth.uid())
    or exists (select 1 from public.outlets o join public.businesses b on b.id = o.business_id
               where o.id = p_outlet_id and b.owner_id = auth.uid())
  );
$$;

create or replace function public.can_manage_outlet(p_outlet_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_outlet_id is not null and (
    exists (select 1 from public.outlet_memberships m
            where m.outlet_id = p_outlet_id and m.user_id = auth.uid()
              and m.role in ('owner','manager'))
    or exists (select 1 from public.outlets o join public.businesses b on b.id = o.business_id
               where o.id = p_outlet_id and b.owner_id = auth.uid())
  );
$$;

create or replace function public.has_role(roles text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = any (roles)
  );
$$;

revoke all on function public.can_access_outlet(uuid) from public;
revoke all on function public.can_manage_outlet(uuid) from public;
revoke all on function public.has_role(text[]) from public;
grant execute on function public.can_access_outlet(uuid) to authenticated, service_role;
grant execute on function public.can_manage_outlet(uuid) to authenticated, service_role;
grant execute on function public.has_role(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Bootstrap pendaftaran: user pertama jadi owner + business + outlet default
-- + membership; user berikutnya jadi cashier tanpa business.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
  v_outlet uuid;
  v_role text;
  v_name text;
  v_phone text;
begin
  v_phone := nullif(new.phone, '');
  v_name := coalesce(nullif(new.raw_user_meta_data->>'name', ''), nullif(new.email, ''), v_phone, 'Pengguna');
  v_role := case when not exists (select 1 from public.profiles) then 'owner' else 'cashier' end;

  insert into public.profiles (id, name, email, phone_e164, role)
  values (new.id, v_name, nullif(new.email, ''),
          coalesce(v_phone, nullif(new.raw_user_meta_data->>'phone_e164', '')), v_role)
  on conflict (id) do update set
    name = excluded.name,
    email = coalesce(excluded.email, profiles.email),
    phone_e164 = coalesce(excluded.phone_e164, profiles.phone_e164);

  if v_role = 'owner' and not exists (select 1 from public.businesses) then
    insert into public.businesses (name, owner_id) values (v_name, new.id)
      returning id into v_business;
    insert into public.outlets (business_id, name, code, is_default)
      values (v_business, 'Outlet Utama', 'UTM', true)
      returning id into v_outlet;
    insert into public.outlet_memberships (user_id, outlet_id, role)
      values (new.id, v_outlet, 'owner');
  elsif v_role = 'owner' then
    -- Owner tambahan ikut business yang ada: membership ke outlet default-nya.
    select o.id into v_outlet
    from public.outlets o
    where o.is_default = true and o.is_active = true
    order by o.created_at limit 1;
    if v_outlet is not null then
      insert into public.outlet_memberships (user_id, outlet_id, role)
        values (new.id, v_outlet, 'owner') on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Katalog produk POS milik minimarket — tabel "products" sudah dipakai katalog
-- Control (schema berbeda), jadi katalog kasir memakai "pos_products".
-- ---------------------------------------------------------------------------
create table if not exists public.pos_products (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references public.outlets(id) on delete restrict,
  name text not null,
  sku text not null unique,
  barcode text,
  category text references public.categories(id),
  buy_price numeric(15,2) not null default 0,
  sell_price numeric(15,2) not null default 0,
  wholesale_price numeric(15,2),
  buy_unit text not null default 'pcs',
  sell_unit text not null default 'pcs',
  conversion_factor int not null default 1,
  stock numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  max_stock numeric(12,3) not null default 0,
  photo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_pos_products_barcode on public.pos_products(barcode) where barcode is not null;
create index if not exists idx_pos_products_category on public.pos_products(category);
create index if not exists idx_pos_products_outlet on public.pos_products(outlet_id);
alter table public.pos_products enable row level security;

-- ---------------------------------------------------------------------------
-- RLS berbasis membership. Tabel dengan kolom outlet_id dibatasi membership;
-- tabel master global (tanpa outlet_id) dibaca authenticated dan ditulis owner.
-- ---------------------------------------------------------------------------
do $$
declare t text; has_outlet boolean;
begin
  -- 1) Tabel operasional: member baca+tulis, owner/manager boleh ubah/hapus.
  foreach t in array array[
    'customers','orders','order_items','shifts','cash_flows','petty_cash',
    'stock_mutations','loyalty_transactions'
  ] loop
    select exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=t and column_name='outlet_id')
      into has_outlet;

    execute format('drop policy if exists %I on public.%I', 'mvp0_authenticated_select_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'mvp1_select_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'mvp1_insert_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'mvp1_update_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'mvp1_delete_' || t, t);

    if has_outlet then
      execute format($f$
        create policy %I on public.%I for select
        using (outlet_id is null or public.can_access_outlet(outlet_id))
      $f$, 'mvp1_select_' || t, t);
      execute format($f$
        create policy %I on public.%I for insert
        with check (outlet_id is null or public.can_access_outlet(outlet_id))
      $f$, 'mvp1_insert_' || t, t);
      execute format($f$
        create policy %I on public.%I for update
        using ((outlet_id is not null and public.can_manage_outlet(outlet_id))
               or (outlet_id is null and public.has_role(array['owner'])))
        with check ((outlet_id is not null and public.can_manage_outlet(outlet_id))
               or (outlet_id is null and public.has_role(array['owner'])))
      $f$, 'mvp1_update_' || t, t);
      execute format($f$
        create policy %I on public.%I for delete
        using ((outlet_id is not null and public.can_manage_outlet(outlet_id))
               or (outlet_id is null and public.has_role(array['owner'])))
      $f$, 'mvp1_delete_' || t, t);
    else
      execute format($f$
        create policy %I on public.%I for select using (auth.role() = 'authenticated')
      $f$, 'mvp1_select_' || t, t);
      execute format($f$
        create policy %I on public.%I for insert with check (public.has_role(array['owner']))
      $f$, 'mvp1_insert_' || t, t);
      execute format($f$
        create policy %I on public.%I for update
        using (public.has_role(array['owner'])) with check (public.has_role(array['owner']))
      $f$, 'mvp1_update_' || t, t);
      execute format($f$
        create policy %I on public.%I for delete using (public.has_role(array['owner']))
      $f$, 'mvp1_delete_' || t, t);
    end if;
  end loop;

  -- 2) shifts: penutup shift sendiri tetap boleh walau kasir.
  execute 'drop policy if exists "mvp1_update_shifts" on public.shifts';
  execute $f$
    create policy "mvp1_update_shifts" on public.shifts for update
    using ((outlet_id is not null and public.can_manage_outlet(outlet_id))
           or opened_by = auth.uid()
           or (outlet_id is null and public.has_role(array['owner'])))
    with check ((outlet_id is not null and public.can_manage_outlet(outlet_id))
           or opened_by = auth.uid()
           or (outlet_id is null and public.has_role(array['owner'])))
  $f$;

  -- 3) Tabel kelolaan: baca member outlet, tulis owner/manager outlet.
  foreach t in array array[
    'void_records','suppliers','purchase_orders','promos',
    'vouchers','store_settings','pos_products'
  ] loop
    select exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=t and column_name='outlet_id')
      into has_outlet;

    execute format('drop policy if exists %I on public.%I', 'mvp0_authenticated_select_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'mvp1_select_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'mvp1_insert_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'mvp1_update_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'mvp1_delete_' || t, t);

    if has_outlet then
      execute format($f$
        create policy %I on public.%I for select
        using (outlet_id is null or public.can_access_outlet(outlet_id))
      $f$, 'mvp1_select_' || t, t);
      execute format($f$
        create policy %I on public.%I for insert
        with check (public.can_manage_outlet(outlet_id) or (outlet_id is null and public.has_role(array['owner'])))
      $f$, 'mvp1_insert_' || t, t);
      execute format($f$
        create policy %I on public.%I for update
        using (public.can_manage_outlet(outlet_id) or (outlet_id is null and public.has_role(array['owner'])))
        with check (public.can_manage_outlet(outlet_id) or (outlet_id is null and public.has_role(array['owner'])))
      $f$, 'mvp1_update_' || t, t);
      execute format($f$
        create policy %I on public.%I for delete
        using (public.can_manage_outlet(outlet_id) or (outlet_id is null and public.has_role(array['owner'])))
      $f$, 'mvp1_delete_' || t, t);
    else
      execute format($f$
        create policy %I on public.%I for select using (auth.role() = 'authenticated')
      $f$, 'mvp1_select_' || t, t);
      execute format($f$
        create policy %I on public.%I for insert with check (public.has_role(array['owner']))
      $f$, 'mvp1_insert_' || t, t);
      execute format($f$
        create policy %I on public.%I for update
        using (public.has_role(array['owner'])) with check (public.has_role(array['owner']))
      $f$, 'mvp1_update_' || t, t);
      execute format($f$
        create policy %I on public.%I for delete using (public.has_role(array['owner']))
      $f$, 'mvp1_delete_' || t, t);
    end if;
  end loop;

  -- 4) categories: master global — baca authenticated, tulis owner.
  execute 'drop policy if exists "mvp0_authenticated_select_categories" on public.categories';
  execute 'drop policy if exists "mvp1_select_categories" on public.categories';
  execute 'drop policy if exists "mvp1_insert_categories" on public.categories';
  execute 'drop policy if exists "mvp1_update_categories" on public.categories';
  execute 'drop policy if exists "mvp1_delete_categories" on public.categories';
  execute $f$
    create policy "mvp1_select_categories" on public.categories for select using (auth.role() = 'authenticated')
  $f$;
  execute $f$
    create policy "mvp1_insert_categories" on public.categories for insert with check (public.has_role(array['owner']))
  $f$;
  execute $f$
    create policy "mvp1_update_categories" on public.categories for update
    using (public.has_role(array['owner'])) with check (public.has_role(array['owner']))
  $f$;
  execute $f$
    create policy "mvp1_delete_categories" on public.categories for delete using (public.has_role(array['owner']))
  $f$;
end $$;
