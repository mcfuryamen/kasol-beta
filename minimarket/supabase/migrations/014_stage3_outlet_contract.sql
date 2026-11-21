-- Stage 3: canonical outlet contract for operational data.
-- Staging-first, additive, idempotent. No NOT NULL yet — only after writers
-- have been observed writing zero nulls/sentinels (see docs/20).

-- ---------------------------------------------------------------------------
-- 1. Canonical product FK: order_items.product_id & stock_mutations.product_id
--    must point at pos_products (the POS catalog), not legacy products.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid IN ('public.order_items'::regclass, 'public.stock_mutations'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%products%'
      AND conrelid::regclass::text LIKE '%product%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', fk.tbl, fk.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.order_items'::regclass AND conname = 'order_items_product_fkey'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_fkey
      FOREIGN KEY (product_id) REFERENCES public.pos_products(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stock_mutations'::regclass AND conname = 'stock_mutations_product_fkey'
  ) THEN
    -- Ledger must NOT cascade with product deletion.
    ALTER TABLE public.stock_mutations
      ADD CONSTRAINT stock_mutations_product_fkey
      FOREIGN KEY (product_id) REFERENCES public.pos_products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Product identity: outlet-local (per Stage 3 contract). Global uniqueness
--    is dropped only here in staging after duplicate inspection.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT outlet_id, sku FROM public.pos_products
      WHERE sku IS NOT NULL AND outlet_id IS NOT NULL
      GROUP BY outlet_id, sku HAVING count(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION 'stage3 blocked: duplicate (outlet_id, sku) rows exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_products_outlet_sku
  ON public.pos_products(outlet_id, sku);

-- ---------------------------------------------------------------------------
-- 3. Mandatory parent-child outlet consistency. Parent NULL + child set
--    (or vice versa) must fail, unlike the MVP-2 trigger that let NULL pass.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_child_outlet_matches_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  parent_outlet uuid;
  child_outlet uuid := NEW.outlet_id;
BEGIN
  CASE TG_ARGV[0]
    WHEN 'order_items' THEN
      SELECT outlet_id INTO parent_outlet FROM public.orders WHERE id = NEW.order_id;
    WHEN 'cash_flows', 'petty_cash' THEN
      SELECT outlet_id INTO parent_outlet FROM public.shifts WHERE id = NEW.shift_id;
    WHEN 'void_records' THEN
      SELECT outlet_id INTO parent_outlet FROM public.orders WHERE id = NEW.order_id;
    WHEN 'stock_mutations' THEN
      SELECT outlet_id INTO parent_outlet FROM public.pos_products WHERE id = NEW.product_id;
    WHEN 'vouchers' THEN
      SELECT outlet_id INTO parent_outlet FROM public.promos WHERE id = NEW.promo_id;
    ELSE
      RETURN NEW;
  END CASE;

  IF parent_outlet IS NOT NULL AND child_outlet IS DISTINCT FROM parent_outlet THEN
    RAISE EXCEPTION 'outlet mismatch for %: parent=% child=%', TG_ARGV[0], parent_outlet, child_outlet
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT 'order_items' table_name WHERE to_regclass('public.order_items') IS NOT NULL
           UNION ALL SELECT 'cash_flows' WHERE to_regclass('public.cash_flows') IS NOT NULL
           UNION ALL SELECT 'petty_cash' WHERE to_regclass('public.petty_cash') IS NOT NULL
           UNION ALL SELECT 'void_records' WHERE to_regclass('public.void_records') IS NOT NULL
           UNION ALL SELECT 'stock_mutations' WHERE to_regclass('public.stock_mutations') IS NOT NULL
           UNION ALL SELECT 'vouchers' WHERE to_regclass('public.vouchers') IS NOT NULL
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || r.table_name || '_outlet_parent', r.table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF outlet_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assert_child_outlet_matches_parent(%L)',
      'trg_' || r.table_name || '_outlet_parent', r.table_name, r.table_name);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.assert_child_outlet_matches_parent() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 4. Report view: writer observation gate for the future NOT NULL migration.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.stage3_outlet_contract_check
WITH (security_invoker = true) AS
SELECT t.table_name, t.row_count, t.null_outlet_count, t.sentinel_count
FROM (
  SELECT 'pos_products' table_name, count(*) row_count,
         count(*) FILTER (WHERE outlet_id IS NULL) null_outlet_count, 0 sentinel_count FROM public.pos_products
  UNION ALL SELECT 'customers', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.customers
  UNION ALL SELECT 'orders', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.orders
  UNION ALL SELECT 'order_items', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.order_items
  UNION ALL SELECT 'shifts', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.shifts
  UNION ALL SELECT 'cash_flows', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.cash_flows
  UNION ALL SELECT 'petty_cash', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.petty_cash
  UNION ALL SELECT 'void_records', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.void_records
  UNION ALL SELECT 'stock_mutations', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.stock_mutations
  UNION ALL SELECT 'suppliers', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.suppliers
  UNION ALL SELECT 'purchase_orders', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.purchase_orders
  UNION ALL SELECT 'promos', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.promos
  UNION ALL SELECT 'vouchers', count(*), count(*) FILTER (WHERE outlet_id IS NULL), 0 FROM public.vouchers
) t;

COMMENT ON VIEW public.stage3_outlet_contract_check IS 'Stage 3 gate: all counts must be reported; NOT NULL only after zero nulls are observed on real writes.';
