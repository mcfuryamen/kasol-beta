-- Migration 005: Stock mutations, suppliers & purchase orders
-- Mirrors src/data/types/stock.ts (StockMovement) and supplier.ts (Supplier, PurchaseOrder).
--   stock_mutations.type: purchase | sale | adjustment | damaged | expired | return.
--   The stored qty is always a magnitude; the AFTER INSERT trigger below derives
--   the stock delta FROM TYPE AND QTY. Client-supplied after-stock is not trusted.

create table if not exists stock_mutations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  product_name text not null,
  type text not null
    check (type in ('purchase','sale','adjustment','damaged','expired','return')),
  qty numeric(12,3) not null
    check (qty >= 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  phone text not null,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  supplier_name text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(15,2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft','approved','ordered','received')),
  notes text,
  created_by uuid references profiles(id) on delete set null,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stock_mutations_product on stock_mutations(product_id);
create index if not exists idx_stock_mutations_type on stock_mutations(type);
create index if not exists idx_stock_mutations_created_at on stock_mutations(created_at desc);
create index if not exists idx_purchase_orders_supplier on purchase_orders(supplier_id);
create index if not exists idx_purchase_orders_status on purchase_orders(status);

-- Apply the mutation to products.stock based on type + qty only:
--   sale / damaged / expired -> subtract qty
--   purchase / return        -> add qty
--   adjustment               -> qty IS the new absolute stock level
create or replace function public.apply_stock_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric(12,3);
begin
  if new.type in ('sale','damaged','expired') then
    v_delta := -new.qty;
  elsif new.type in ('purchase','return') then
    v_delta := new.qty;
  end if;

  if v_delta is null then
    update products
       set stock = new.qty, updated_at = now()
     where id = new.product_id;
  else
    update products
       set stock = stock + v_delta, updated_at = now()
     where id = new.product_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_stock_mutation on stock_mutations;
create trigger trg_apply_stock_mutation
  after insert on stock_mutations
  for each row execute procedure public.apply_stock_mutation();

drop trigger if exists trg_suppliers_set_updated_at on suppliers;
create trigger trg_suppliers_set_updated_at
  before update on suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_purchase_orders_set_updated_at on purchase_orders;
create trigger trg_purchase_orders_set_updated_at
  before update on purchase_orders
  for each row execute function public.set_updated_at();

alter table stock_mutations enable row level security;
alter table suppliers enable row level security;
alter table purchase_orders enable row level security;

-- stock_mutations is an append-only ledger: staff append, nobody edits/deletes
-- through the API (no update/delete policies => denied by RLS).
drop policy if exists "Authenticated users can view stock mutations" on stock_mutations;
create policy "Authenticated users can view stock mutations"
  on stock_mutations for select
  using (auth.role() = 'authenticated');

drop policy if exists "Any staff can record stock mutations" on stock_mutations;
create policy "Any staff can record stock mutations"
  on stock_mutations for insert
  with check (auth.role() = 'authenticated');

-- suppliers & purchase orders: manage = owner+manager+stock.
drop policy if exists "Authenticated users can view suppliers" on suppliers;
create policy "Authenticated users can view suppliers"
  on suppliers for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owner/manager/stock can insert suppliers" on suppliers;
create policy "Owner/manager/stock can insert suppliers"
  on suppliers for insert
  with check (public.has_role(array['owner','manager','stock']));

drop policy if exists "Owner/manager/stock can update suppliers" on suppliers;
create policy "Owner/manager/stock can update suppliers"
  on suppliers for update
  using (public.has_role(array['owner','manager','stock']))
  with check (public.has_role(array['owner','manager','stock']));

drop policy if exists "Owner/manager/stock can delete suppliers" on suppliers;
create policy "Owner/manager/stock can delete suppliers"
  on suppliers for delete
  using (public.has_role(array['owner','manager','stock']));

drop policy if exists "Authenticated users can view purchase orders" on purchase_orders;
create policy "Authenticated users can view purchase orders"
  on purchase_orders for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owner/manager/stock can insert purchase orders" on purchase_orders;
create policy "Owner/manager/stock can insert purchase orders"
  on purchase_orders for insert
  with check (public.has_role(array['owner','manager','stock']));

drop policy if exists "Owner/manager/stock can update purchase orders" on purchase_orders;
create policy "Owner/manager/stock can update purchase orders"
  on purchase_orders for update
  using (public.has_role(array['owner','manager','stock']))
  with check (public.has_role(array['owner','manager','stock']));

drop policy if exists "Owner/manager/stock can delete purchase orders" on purchase_orders;
create policy "Owner/manager/stock can delete purchase orders"
  on purchase_orders for delete
  using (public.has_role(array['owner','manager','stock']));
