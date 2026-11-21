-- Migration 002: Categories & products
-- Mirrors src/data/types/product.ts (Category, Product) with snake_case columns:
--   Product: sku unique, barcode unique-when-present, category one of the TS
--   ProductCategory values, wholesale_price nullable, buy/sell units + conversion,
--   stock numeric(12,3), min/max stock, photo?, is_active, timestamps.

create table if not exists categories (
  id text primary key
    check (id in ('snacks','beverages','staples','tobacco','toiletries',
                  'household','frozen','spices','dairy','other')),
  name text not null,
  icon text not null default 'grid'
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  barcode text,
  category text not null default 'other'
    check (category in ('snacks','beverages','staples','tobacco','toiletries',
                        'household','frozen','spices','dairy','other'))
    references categories(id),
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

-- Multiple NULLs are allowed by a partial unique index; duplicates rejected.
create unique index if not exists uq_products_barcode on products(barcode)
  where barcode is not null;
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_name on products(name);

drop trigger if exists trg_products_set_updated_at on products;
create trigger trg_products_set_updated_at
  before update on products
  for each row execute function public.set_updated_at();

alter table categories enable row level security;
alter table products enable row level security;

-- categories: read for everyone signed in; manage (C/U/D) owner+manager+stock.
drop policy if exists "Authenticated users can view categories" on categories;
create policy "Authenticated users can view categories"
  on categories for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owner/manager/stock can insert categories" on categories;
create policy "Owner/manager/stock can insert categories"
  on categories for insert
  with check (public.has_role(array['owner','manager','stock']));

drop policy if exists "Owner/manager/stock can update categories" on categories;
create policy "Owner/manager/stock can update categories"
  on categories for update
  using (public.has_role(array['owner','manager','stock']))
  with check (public.has_role(array['owner','manager','stock']));

drop policy if exists "Owner/manager/stock can delete categories" on categories;
create policy "Owner/manager/stock can delete categories"
  on categories for delete
  using (public.has_role(array['owner','manager','stock']));

-- products: same sensitivity as categories.
drop policy if exists "Authenticated users can view products" on products;
create policy "Authenticated users can view products"
  on products for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owner/manager/stock can insert products" on products;
create policy "Owner/manager/stock can insert products"
  on products for insert
  with check (public.has_role(array['owner','manager','stock']));

drop policy if exists "Owner/manager/stock can update products" on products;
create policy "Owner/manager/stock can update products"
  on products for update
  using (public.has_role(array['owner','manager','stock']))
  with check (public.has_role(array['owner','manager','stock']));

drop policy if exists "Owner/manager/stock can delete products" on products;
create policy "Owner/manager/stock can delete products"
  on products for delete
  using (public.has_role(array['owner','manager','stock']));

-- Seed the ten ProductCategory values from product.ts.
insert into categories (id, name, icon) values
  ('snacks',     'Snack',     'cookie'),
  ('beverages',  'Minuman',   'coffee'),
  ('staples',    'Sembako',   'wheat'),
  ('tobacco',    'Rokok',     'wind'),
  ('toiletries', 'Kebersihan','sparkles'),
  ('household',  'Rumah Tangga','home'),
  ('frozen',     'Frozen',    'snowflake'),
  ('spices',     'Bumbu',     'flame'),
  ('dairy',      'Dairy',     'milk'),
  ('other',      'Lainnya',   'grid')
on conflict (id) do nothing;
