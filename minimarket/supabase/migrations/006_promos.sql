-- Migration 006: Promos & vouchers
-- Mirrors src/data/types/promo.ts (Promo, Voucher):
--   Promo.type: percent | amount | bxgy | bundling | happyhour
--   discount_type: percent | amount; dates are timestamptz.
--   Voucher: unique code, promo ref, used/used_at/expires_at.

create table if not exists promos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null
    check (type in ('percent','amount','bxgy','bundling','happyhour')),
  discount_value numeric(15,2) not null default 0,
  discount_type text not null default 'amount'
    check (discount_type in ('percent','amount')),
  min_purchase numeric(15,2) not null default 0,
  max_discount numeric(15,2),
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean not null default true,
  usage_count int not null default 0
    check (usage_count >= 0),
  max_usage int,
  product_ids uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  promo_id uuid not null references promos(id) on delete cascade,
  discount_value numeric(15,2) not null default 0,
  discount_type text not null default 'amount'
    check (discount_type in ('percent','amount')),
  min_purchase numeric(15,2) not null default 0,
  max_discount numeric(15,2),
  used boolean not null default false,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_promos_active_window on promos(is_active, start_date, end_date);
create index if not exists idx_vouchers_promo on vouchers(promo_id);
create index if not exists idx_vouchers_unused on vouchers(code) where used = false;

drop trigger if exists trg_promos_set_updated_at on promos;
create trigger trg_promos_set_updated_at
  before update on promos
  for each row execute function public.set_updated_at();

alter table promos enable row level security;
alter table vouchers enable row level security;

-- Promotions are pricing decisions: manage = owner + manager only.
drop policy if exists "Authenticated users can view promos" on promos;
create policy "Authenticated users can view promos"
  on promos for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owner/manager can insert promos" on promos;
create policy "Owner/manager can insert promos"
  on promos for insert
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can update promos" on promos;
create policy "Owner/manager can update promos"
  on promos for update
  using (public.has_role(array['owner','manager']))
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can delete promos" on promos;
create policy "Owner/manager can delete promos"
  on promos for delete
  using (public.has_role(array['owner','manager']));

drop policy if exists "Authenticated users can view vouchers" on vouchers;
create policy "Authenticated users can view vouchers"
  on vouchers for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owner/manager can insert vouchers" on vouchers;
create policy "Owner/manager can insert vouchers"
  on vouchers for insert
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can update vouchers" on vouchers;
create policy "Owner/manager can update vouchers"
  on vouchers for update
  using (public.has_role(array['owner','manager']))
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can delete vouchers" on vouchers;
create policy "Owner/manager can delete vouchers"
  on vouchers for delete
  using (public.has_role(array['owner','manager']));
