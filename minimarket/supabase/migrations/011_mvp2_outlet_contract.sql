-- MVP-2: outlet contract, parent-child integrity, and strict membership RLS.
-- Additive/idempotent. Apply only after the MVP-0 logical backup is verified.

-- ---------------------------------------------------------------------------
-- 1. Add outlet_id to every outlet-scoped operational table.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','orders','order_items','shifts','cash_flows','petty_cash',
    'void_records','stock_mutations','suppliers','purchase_orders','promos',
    'vouchers','loyalty_transactions','store_settings','pos_products'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS outlet_id uuid', t);
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = 'created_at'
      ) THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(outlet_id, created_at DESC)', 'idx_' || t || '_outlet_created', t);
      ELSE
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(outlet_id)', 'idx_' || t || '_outlet', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Every outlet-scoped row belongs to the business outlet chosen for its owner.
DO $$
DECLARE
  t text;
  default_outlet uuid;
BEGIN
  SELECT o.id INTO default_outlet
  FROM public.outlets o
  WHERE o.is_default AND o.is_active
  ORDER BY o.created_at
  LIMIT 1;

  IF default_outlet IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY[
      'customers','orders','order_items','shifts','cash_flows','petty_cash',
      'void_records','stock_mutations','suppliers','purchase_orders','promos',
      'vouchers','loyalty_transactions','store_settings','pos_products'
    ] LOOP
      IF to_regclass('public.' || t) IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET outlet_id = $1 WHERE outlet_id IS NULL', t)
        USING default_outlet;
      END IF;
    END LOOP;
  END IF;
END $$;

-- Product identity is outlet-local in MVP-2. Existing global uniqueness is
-- retained for compatibility; the outlet-scoped index supports future cleanup.
CREATE INDEX IF NOT EXISTS idx_pos_products_outlet_sku
  ON public.pos_products(outlet_id, sku);
CREATE INDEX IF NOT EXISTS idx_pos_products_outlet_barcode
  ON public.pos_products(outlet_id, barcode)
  WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status
  ON public.orders(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_outlet_status
  ON public.shifts(outlet_id, status);

-- ---------------------------------------------------------------------------
-- 2. Outlet FK and parent-child consistency.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','orders','order_items','shifts','cash_flows','petty_cash',
    'void_records','stock_mutations','suppliers','purchase_orders','promos',
    'vouchers','loyalty_transactions','store_settings','pos_products'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint c
         WHERE c.conrelid = ('public.' || t)::regclass
           AND c.conname = t || '_outlet_id_fkey'
       ) THEN
      -- Skip tables where an earlier migration already owns the FK name.
      -- The constraint is added only when every existing value is valid.
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = ('public.' || t)::regclass
          AND c.contype = 'f'
          AND pg_get_constraintdef(c.oid) ILIKE '%outlet_id%'
      ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (outlet_id) REFERENCES public.outlets(id) ON DELETE RESTRICT', t, t || '_outlet_id_fkey');
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_outlet_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.outlet_id IS DISTINCT FROM NEW.outlet_id THEN
    RAISE EXCEPTION 'outlet_id is immutable for %', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_same_outlet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE parent_outlet uuid;
BEGIN
  IF TG_ARGV[0] = 'order_items' THEN
    SELECT outlet_id INTO parent_outlet FROM public.orders WHERE id = NEW.order_id;
  ELSIF TG_ARGV[0] = 'cash_flows' OR TG_ARGV[0] = 'petty_cash' THEN
    SELECT outlet_id INTO parent_outlet FROM public.shifts WHERE id = NEW.shift_id;
  ELSIF TG_ARGV[0] = 'void_records' THEN
    SELECT outlet_id INTO parent_outlet FROM public.orders WHERE id = NEW.order_id;
  ELSIF TG_ARGV[0] = 'stock_mutations' THEN
    -- stock_mutations.product_id historically references legacy products;
    -- only compare when the canonical POS row exists.
    IF to_regclass('public.pos_products') IS NOT NULL THEN
      SELECT outlet_id INTO parent_outlet FROM public.pos_products WHERE id = NEW.product_id;
    END IF;
  ELSIF TG_ARGV[0] = 'vouchers' THEN
    IF to_regclass('public.promos') IS NOT NULL THEN
      SELECT outlet_id INTO parent_outlet FROM public.promos WHERE id = NEW.promo_id;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF parent_outlet IS NOT NULL AND NEW.outlet_id IS DISTINCT FROM parent_outlet THEN
    RAISE EXCEPTION 'outlet_id mismatch for %: parent=% child=%', TG_ARGV[0], parent_outlet, NEW.outlet_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','orders','order_items','shifts','cash_flows','petty_cash',
    'void_records','stock_mutations','suppliers','purchase_orders','promos',
    'vouchers','loyalty_transactions','store_settings','pos_products'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_outlet_immutable', t);
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF outlet_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_outlet_change()', 'trg_' || t || '_outlet_immutable', t);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT 'order_items'::text AS table_name, 'order_id'::text AS parent_col WHERE to_regclass('public.order_items') IS NOT NULL
           UNION ALL SELECT 'cash_flows', 'shift_id' WHERE to_regclass('public.cash_flows') IS NOT NULL
           UNION ALL SELECT 'petty_cash', 'shift_id' WHERE to_regclass('public.petty_cash') IS NOT NULL
           UNION ALL SELECT 'void_records', 'order_id' WHERE to_regclass('public.void_records') IS NOT NULL
           UNION ALL SELECT 'stock_mutations', 'product_id' WHERE to_regclass('public.stock_mutations') IS NOT NULL
           UNION ALL SELECT 'vouchers', 'promo_id' WHERE to_regclass('public.vouchers') IS NOT NULL
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || r.table_name || '_same_outlet', r.table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF outlet_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assert_same_outlet(%L)', 'trg_' || r.table_name || '_same_outlet', r.table_name, r.table_name);
  END LOOP;
END $$;

-- Do not make nullable columns NOT NULL until all production writers have been
-- observed with zero null writes. This check is intentionally report-only.
CREATE OR REPLACE VIEW public.mvp2_outlet_contract_check AS
SELECT table_name, row_count, null_outlet_count
FROM (
  SELECT 'orders'::text table_name, count(*) row_count, count(*) FILTER (WHERE outlet_id IS NULL) null_outlet_count FROM public.orders
  UNION ALL SELECT 'order_items', count(*), count(*) FILTER (WHERE outlet_id IS NULL) FROM public.order_items
  UNION ALL SELECT 'shifts', count(*), count(*) FILTER (WHERE outlet_id IS NULL) FROM public.shifts
  UNION ALL SELECT 'cash_flows', count(*), count(*) FILTER (WHERE outlet_id IS NULL) FROM public.cash_flows
  UNION ALL SELECT 'stock_mutations', count(*), count(*) FILTER (WHERE outlet_id IS NULL) FROM public.stock_mutations
  UNION ALL SELECT 'pos_products', count(*), count(*) FILTER (WHERE outlet_id IS NULL) FROM public.pos_products
) q;

-- ---------------------------------------------------------------------------
-- 3. Strict outlet RLS. Null outlet rows are no longer visible to clients.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','orders','order_items','shifts','cash_flows','petty_cash',
    'void_records','stock_mutations','suppliers','purchase_orders','promos',
    'vouchers','loyalty_transactions','store_settings','pos_products'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "mvp2_select_membership" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "mvp2_insert_membership" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "mvp2_update_membership" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "mvp2_delete_membership" ON public.%I', t);
      EXECUTE format('CREATE POLICY "mvp2_select_membership" ON public.%I FOR SELECT USING (public.can_access_outlet(outlet_id))', t);
      EXECUTE format('CREATE POLICY "mvp2_insert_membership" ON public.%I FOR INSERT WITH CHECK (public.can_manage_outlet(outlet_id) OR (public.can_access_outlet(outlet_id) AND public.has_role(ARRAY[''owner'',''manager'',''cashier'',''stock''])))', t);
      EXECUTE format('CREATE POLICY "mvp2_update_membership" ON public.%I FOR UPDATE USING (public.can_access_outlet(outlet_id)) WITH CHECK (public.can_access_outlet(outlet_id))', t);
      EXECUTE format('CREATE POLICY "mvp2_delete_membership" ON public.%I FOR DELETE USING (public.can_manage_outlet(outlet_id))', t);
    END IF;
  END LOOP;
END $$;
