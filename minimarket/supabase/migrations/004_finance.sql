-- Migration 004: Shifts & cash management
-- Mirrors src/data/types/finance.ts (Shift, CashFlow, PettyCash, VoidRecord).
-- Also completes the orders.shift_id foreign key deferred from migration 003.

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid references profiles(id) on delete set null,
  closed_by uuid references profiles(id) on delete set null,
  opening_balance numeric(15,2) not null default 0,
  closing_balance numeric(15,2),
  expected_cash numeric(15,2),
  difference numeric(15,2),
  status text not null default 'open'
    check (status in ('open','closed')),
  notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists cash_flows (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id) on delete set null,
  type text not null
    check (type in ('in','out')),
  category text not null
    check (category in ('setoran_tambahan','pengembalian','lainnya',
                        'belanja_operasional','setor_bank','gaji',
                        'listrik_air','kebersihan')),
  amount numeric(15,2) not null
    check (amount > 0),
  description text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists petty_cash (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id) on delete set null,
  description text not null,
  amount numeric(15,2) not null
    check (amount > 0),
  category text not null default 'operational'
    check (category in ('operational','cleaning','maintenance','food','other')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists void_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  order_number text not null,
  reason text not null,
  amount numeric(15,2) not null,
  type text not null default 'void'
    check (type in ('void','return')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Deferred FK from 003 (shifts did not exist yet at that point).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_shift_id_fkey'
  ) then
    alter table orders
      add constraint orders_shift_id_fkey
      foreign key (shift_id) references shifts(id) on delete set null;
  end if;
end;
$$;

create index if not exists idx_shifts_status on shifts(status);
create index if not exists idx_shifts_opened_by on shifts(opened_by);
create index if not exists idx_shifts_opened_at on shifts(opened_at desc);
create index if not exists idx_cash_flows_shift on cash_flows(shift_id);
create index if not exists idx_cash_flows_created_at on cash_flows(created_at desc);
create index if not exists idx_petty_cash_shift on petty_cash(shift_id);
create index if not exists idx_void_records_order on void_records(order_id);

alter table shifts enable row level security;
alter table cash_flows enable row level security;
alter table petty_cash enable row level security;
alter table void_records enable row level security;

-- shifts: any staff can open; the opener or a manager updates (e.g. closing).
drop policy if exists "Authenticated users can view shifts" on shifts;
create policy "Authenticated users can view shifts"
  on shifts for select
  using (auth.role() = 'authenticated');

drop policy if exists "Any staff can open shifts" on shifts;
create policy "Any staff can open shifts"
  on shifts for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Shift opener or manager can update shifts" on shifts;
create policy "Shift opener or manager can update shifts"
  on shifts for update
  using (opened_by = auth.uid() or public.has_role(array['owner','manager']))
  with check (opened_by = auth.uid() or public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can delete shifts" on shifts;
create policy "Owner/manager can delete shifts"
  on shifts for delete
  using (public.has_role(array['owner','manager']));

-- cash_flows: any staff records movements; corrections need owner+manager.
drop policy if exists "Authenticated users can view cash flows" on cash_flows;
create policy "Authenticated users can view cash flows"
  on cash_flows for select
  using (auth.role() = 'authenticated');

drop policy if exists "Any staff can create cash flows" on cash_flows;
create policy "Any staff can create cash flows"
  on cash_flows for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Owner/manager can update cash flows" on cash_flows;
create policy "Owner/manager can update cash flows"
  on cash_flows for update
  using (public.has_role(array['owner','manager']))
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can delete cash flows" on cash_flows;
create policy "Owner/manager can delete cash flows"
  on cash_flows for delete
  using (public.has_role(array['owner','manager']));

-- petty_cash: same as cash_flows.
drop policy if exists "Authenticated users can view petty cash" on petty_cash;
create policy "Authenticated users can view petty cash"
  on petty_cash for select
  using (auth.role() = 'authenticated');

drop policy if exists "Any staff can create petty cash entries" on petty_cash;
create policy "Any staff can create petty cash entries"
  on petty_cash for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Owner/manager can update petty cash" on petty_cash;
create policy "Owner/manager can update petty cash"
  on petty_cash for update
  using (public.has_role(array['owner','manager']))
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can delete petty cash" on petty_cash;
create policy "Owner/manager can delete petty cash"
  on petty_cash for delete
  using (public.has_role(array['owner','manager']));

-- void_records: read by all staff; the act of voiding is owner+manager only.
drop policy if exists "Authenticated users can view void records" on void_records;
create policy "Authenticated users can view void records"
  on void_records for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owner/manager can insert void records" on void_records;
create policy "Owner/manager can insert void records"
  on void_records for insert
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can update void records" on void_records;
create policy "Owner/manager can update void records"
  on void_records for update
  using (public.has_role(array['owner','manager']))
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owner/manager can delete void records" on void_records;
create policy "Owner/manager can delete void records"
  on void_records for delete
  using (public.has_role(array['owner','manager']));
