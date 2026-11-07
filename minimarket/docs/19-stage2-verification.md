# Tahap 2 — Verification Checklist

Status: **BLOCKED — staging branch unavailable**  
Migration: `013_stage2_business_membership_hardening.sql`  
Tanggal: 2026-10-06

Blocker: Supabase project `hhywrvedlwljawgxzpkq` is not on a plan that supports database branching. Branch creation returned `PaymentRequiredException: Branching is supported only on the Pro plan or above`. Migration was **not** applied to production. Schema/policy queries below were run read-only against the current project and are not a Stage 2 pass.

> Jalankan di staging/branch terlebih dahulu. Jangan menandai PASS hanya karena query mengembalikan nol pada tabel kosong.

## Schema and lifecycle

```sql
select conname, contype, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('public.businesses'::regclass, 'public.outlets'::regclass, 'public.outlet_memberships'::regclass)
order by conrelid::text, conname;

select indexname, tablename, indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('businesses','outlets','outlet_memberships')
order by tablename, indexname;

select tgname, tgrelid::regclass, pg_get_triggerdef(oid)
from pg_trigger
where not tgisinternal
  and tgrelid in ('public.businesses'::regclass, 'public.outlets'::regclass, 'public.outlet_memberships'::regclass)
order by tgrelid::text, tgname;
```

Expected:

- `outlet_memberships.business_id` is `NOT NULL`.
- Membership has a foreign key to `businesses` and a cross-business consistency trigger.
- Outlet lifecycle trigger exists; no direct DELETE policy exists.
- Minimum-one-active-outlet guard exists.
- `businesses` and `outlets` have updated-at triggers.

## Policy audit

```sql
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in (
    'businesses','outlets','outlet_memberships','profiles',
    'products','customers','orders','order_items','shifts','cash_flows',
    'petty_cash','void_records','stock_mutations','suppliers',
    'purchase_orders','promos','vouchers','loyalty_transactions','pos_products'
  )
order by tablename, policyname;
```

Expected:

- No legacy global policy using only `auth.role() = 'authenticated'` remains on target tables.
- Identity policies use Stage 2 helpers or own-user predicates.
- No `DELETE` policy exists for `outlets`.
- Membership write policies require business owner.
- Businesses operating mode update requires business owner.

## Data integrity audit

```sql
select business_id, count(*)
from public.outlets
group by business_id
having count(*) = 0;

select m.*
from public.outlet_memberships m
join public.outlets o on o.id = m.outlet_id
where m.business_id <> o.business_id;

select b.id, b.owner_id
from public.businesses b
left join public.outlets o on o.business_id = b.id and o.is_active and o.archived_at is null
where o.id is null;

select b.id
from public.businesses b
left join public.profiles p on p.id = b.owner_id
where b.owner_id is null or p.id is null;
```

Expected: every membership matches its outlet business; every business has an owner and at least one operational outlet.

## Authenticated smoke tests

Run as separate users/sessions and record the actual UUIDs:

1. Owner reads own business and both assigned outlets.
2. Owner changes `operating_mode` and receives a confirmed server row.
3. Owner inserts/updates membership with matching `business_id` and `outlet_id`.
4. Cashier reads own profile and assigned outlet.
5. Cashier cannot read or write an unassigned outlet.
6. Cashier cannot insert a membership or change operating mode.
7. Attempt to insert mismatched membership business/outlet and expect rejection.
8. Attempt to delete an outlet and expect rejection; archive update remains allowed only to owner.
9. Attempt to archive the final operational outlet and expect rejection.

## Application checks

```bash
cd minimarket
npm run check
npm run build
```

Record commit, migration status, Supabase project/branch, user IDs, outlet IDs, query outputs, and screenshots in a timestamped JSON result. Verdict must be `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`; empty tables are not evidence of functional isolation.
