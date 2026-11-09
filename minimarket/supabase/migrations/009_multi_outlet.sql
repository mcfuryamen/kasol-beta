-- Multi-outlet foundation and data boundary.
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text not null default '',
  phone text not null default '',
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  receipt_footer text not null default '',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_outlets_business on public.outlets(business_id);

create table if not exists public.outlet_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  role text not null default 'cashier' check (role in ('owner','manager','cashier','stock')),
  created_at timestamptz not null default now(),
  primary key (user_id, outlet_id)
);

insert into public.businesses (name, owner_id)
select coalesce(nullif(p.name, ''), 'Usaha Saya'), p.id
from public.profiles p
where p.role = 'owner'
  and not exists (select 1 from public.businesses)
order by p.created_at
limit 1;

insert into public.outlets (business_id, name, address, phone, tax_rate, receipt_footer, is_default)
select b.id, 'Outlet Utama', '', '', 0, '', true
from public.businesses b
where not exists (select 1 from public.outlets);

insert into public.outlet_memberships (user_id, outlet_id, role)
select p.id, o.id, p.role
from public.profiles p cross join public.outlets o
where p.role = 'owner'
on conflict do nothing;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','customers','orders','order_items','shifts','cash_flows','petty_cash','void_records','stock_mutations','suppliers','purchase_orders','promos','vouchers','loyalty_transactions'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('alter table public.%I add column if not exists outlet_id uuid references public.outlets(id) on delete restrict', t);
      EXECUTE format('create index if not exists %I on public.%I(outlet_id)', 'idx_' || t || '_outlet', t);
      EXECUTE format('update public.%I set outlet_id = (select id from public.outlets where is_default order by created_at limit 1) where outlet_id is null', t);
    END IF;
  END LOOP;
END $$;

alter table public.businesses enable row level security;
alter table public.outlets enable row level security;
alter table public.outlet_memberships enable row level security;

drop policy if exists "Members can view businesses" on public.businesses;
create policy "Members can view businesses" on public.businesses for select using (
  owner_id = auth.uid() or exists (select 1 from public.outlets o join public.outlet_memberships m on m.outlet_id = o.id where o.business_id = businesses.id and m.user_id = auth.uid())
);
drop policy if exists "Members can view outlets" on public.outlets;
create policy "Members can view outlets" on public.outlets for select using (
  exists (select 1 from public.outlet_memberships m where m.outlet_id = outlets.id and m.user_id = auth.uid())
  or exists (select 1 from public.businesses b where b.id = outlets.business_id and b.owner_id = auth.uid())
);
drop policy if exists "Owners manage outlets" on public.outlets;
create policy "Owners manage outlets" on public.outlets for all using (
  exists (select 1 from public.businesses b where b.id = outlets.business_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.businesses b where b.id = outlets.business_id and b.owner_id = auth.uid())
);
drop policy if exists "Users view outlet memberships" on public.outlet_memberships;
create policy "Users view outlet memberships" on public.outlet_memberships for select using (user_id = auth.uid() or exists (select 1 from public.businesses b join public.outlets o on o.business_id = b.id where o.id = outlet_memberships.outlet_id and b.owner_id = auth.uid()));
