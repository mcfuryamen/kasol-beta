-- Migration 003: Customers, orders & order items
-- Mirrors src/data/types/customer.ts (Customer) and order.ts (Order, OrderItem).
--   orders.status: pending | completed | voided | returned (matches OrderStatus).
--   order_items keeps unit_price (sell), discount, subtotal AND buy_price so
--   COGS/profit reports never depend on later product price edits.
-- NOTE: orders.shift_id has no FK here because shifts are created in 004;
-- migration 004 adds the foreign key.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  address text,
  member_card text not null unique,
  tier text not null default 'bronze'
    check (tier in ('bronze','silver','gold')),
  points int not null default 0
    check (points >= 0),
  total_spent numeric(15,2) not null default 0,
  debt numeric(15,2) not null default 0,
  member_since timestamptz not null default now(),
  last_visit timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references customers(id) on delete set null,
  customer_name text,
  cashier_id uuid references profiles(id) on delete set null,
  cashier_name text,
  shift_id uuid,
  subtotal numeric(15,2) not null default 0,
  discount numeric(15,2) not null default 0,
  tax numeric(15,2) not null default 0,
  total numeric(15,2) not null default 0,
  payment_method text not null default 'cash'
    check (payment_method in ('cash','qris','debit','credit','ewallet','tempo')),
  amount_paid numeric(15,2) not null default 0,
  change_amount numeric(15,2) not null default 0,
  voucher_code text,
  voucher_discount numeric(15,2) not null default 0,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','completed','voided','returned')),
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  product_sku text not null,
  qty numeric(12,3) not null default 1,
  unit text not null default 'pcs',
  buy_price numeric(15,2) not null default 0,
  unit_price numeric(15,2) not null,
  discount numeric(15,2) not null default 0,
  subtotal numeric(15,2) not null
);

create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_cashier on orders(cashier_id);
create index if not exists idx_orders_shift on orders(shift_id);
create index if not exists idx_orders_customer on orders(customer_id);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_product on order_items(product_id);

drop trigger if exists trg_customers_set_updated_at on customers;
create trigger trg_customers_set_updated_at
  before update on customers
  for each row execute function public.set_updated_at();

alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- customers: CRUD = owner + manager + cashier.
drop policy if exists "Authenticated users can view customers" on customers;
create policy "Authenticated users can view customers"
  on customers for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owner/manager/cashier can insert customers" on customers;
create policy "Owner/manager/cashier can insert customers"
  on customers for insert
  with check (public.has_role(array['owner','manager','cashier']));

drop policy if exists "Owner/manager/cashier can update customers" on customers;
create policy "Owner/manager/cashier can update customers"
  on customers for update
  using (public.has_role(array['owner','manager','cashier']))
  with check (public.has_role(array['owner','manager','cashier']));

drop policy if exists "Owner/manager/cashier can delete customers" on customers;
create policy "Owner/manager/cashier can delete customers"
  on customers for delete
  using (public.has_role(array['owner','manager','cashier']));

-- orders: any staff records sales; voiding/editing needs owner or manager.
drop policy if exists "Authenticated users can view orders" on orders;
create policy "Authenticated users can view orders"
  on orders for select
  using (auth.role() = 'authenticated');

drop policy if exists "Any staff can create orders" on orders;
create policy "Any staff can create orders"
  on orders for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Owner/manager can update orders (void approval)" on orders;
create policy "Owner/manager can update orders (void approval)"
  on orders for update
  using (public.has_role(array['owner','manager']))
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can delete orders" on orders;
create policy "Owner/manager can delete orders"
  on orders for delete
  using (public.has_role(array['owner','manager']));

-- order_items follow their order: staff insert at checkout, edits owner+manager.
drop policy if exists "Authenticated users can view order items" on order_items;
create policy "Authenticated users can view order items"
  on order_items for select
  using (auth.role() = 'authenticated');

drop policy if exists "Any staff can create order items" on order_items;
create policy "Any staff can create order items"
  on order_items for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Owner/manager can update order items" on order_items;
create policy "Owner/manager can update order items"
  on order_items for update
  using (public.has_role(array['owner','manager']))
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can delete order items" on order_items;
create policy "Owner/manager can delete order items"
  on order_items for delete
  using (public.has_role(array['owner','manager']));
