-- Migration 007: Store settings & reporting views
-- - store_settings: simple key/value store; write access owner-only.
-- - Loyalty seeds: silver >= 500.000, gold >= 2.000.000 spend,
--   1 point per 10.000 spent, 11% tax.
-- - Views group by WIB calendar day: (created_at AT TIME ZONE 'Asia/Jakarta')::date.

create table if not exists store_settings (
  key text primary key,
  value text not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into store_settings (key, value) values
  ('store_name', 'Kasir Solo - Minimarket'),
  ('store_address', 'Jl. Solo Raya No. 1, Surakarta'),
  ('store_phone', '0271-123456'),
  ('receipt_header', 'Kasir Solo - Minimarket'),
  ('receipt_footer', 'Terima kasih telah berbelanja!'),
  ('currency', 'IDR'),
  ('printer_paper_size', '58mm'),
  ('printer_auto_print', 'false'),
  ('tax_rate', '11'),
  ('loyalty_bronze_min', '0'),
  ('loyalty_silver_min', '500000'),
  ('loyalty_gold_min', '2000000'),
  ('points_spend_per_point', '10000')
on conflict (key) do nothing;

drop trigger if exists trg_store_settings_set_updated_at on store_settings;
create trigger trg_store_settings_set_updated_at
  before update on store_settings
  for each row execute function public.set_updated_at();

alter table store_settings enable row level security;

drop policy if exists "Authenticated users can view settings" on store_settings;
create policy "Authenticated users can view settings"
  on store_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owners can insert settings" on store_settings;
create policy "Owners can insert settings"
  on store_settings for insert
  with check (public.has_role(array['owner']));

drop policy if exists "Owners can update settings" on store_settings;
create policy "Owners can update settings"
  on store_settings for update
  using (public.has_role(array['owner']))
  with check (public.has_role(array['owner']));

drop policy if exists "Owners can delete settings" on store_settings;
create policy "Owners can delete settings"
  on store_settings for delete
  using (public.has_role(array['owner']));

-- Reporting helpers. security_invoker so the views respect table RLS.
create index if not exists idx_orders_wib_day
  on orders (((created_at at time zone 'Asia/Jakarta')::date));
create index if not exists idx_orders_status_created_at
  on orders(status, created_at desc);

create or replace view daily_sales_summary
with (security_invoker = true) as
select
  (created_at at time zone 'Asia/Jakarta')::date as sale_date,
  count(*)                                        as transaction_count,
  sum(total)                                      as total_revenue,
  sum(discount)                                   as total_discount,
  sum(tax)                                        as total_tax,
  avg(total)                                      as avg_order_value,
  count(distinct customer_id)                     as unique_customers
from orders
where status = 'completed'
group by (created_at at time zone 'Asia/Jakarta')::date
order by sale_date desc;

create or replace view product_sales_ranking
with (security_invoker = true) as
select
  oi.product_id,
  oi.product_name,
  oi.product_sku,
  sum(oi.qty)                                   as total_qty,
  sum(oi.subtotal)                              as total_revenue,
  sum(oi.buy_price * oi.qty)                    as total_cogs,
  sum(oi.subtotal - oi.buy_price * oi.qty)      as gross_profit,
  count(distinct oi.order_id)                   as order_count
from order_items oi
join orders o on o.id = oi.order_id
where o.status = 'completed'
  and o.created_at >= now() - interval '30 days'
group by oi.product_id, oi.product_name, oi.product_sku
order by total_revenue desc;
