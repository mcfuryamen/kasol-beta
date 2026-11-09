-- Stage 2: harden business, outlet, membership identity and RLS.
-- This migration is intentionally additive and must be applied to staging first.

-- ---------------------------------------------------------------------------
-- Membership identity: business_id must agree with outlet.business_id.
-- ---------------------------------------------------------------------------
ALTER TABLE public.outlet_memberships
  ADD COLUMN IF NOT EXISTS business_id uuid;

UPDATE public.outlet_memberships m
SET business_id = o.business_id
FROM public.outlets o
WHERE o.id = m.outlet_id
  AND m.business_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.outlet_memberships WHERE business_id IS NULL) THEN
    RAISE EXCEPTION 'Stage 2 blocked: outlet_memberships contains NULL business_id';
  END IF;
END $$;

ALTER TABLE public.outlet_memberships
  ALTER COLUMN business_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_outlet_memberships_business_outlet_user
  ON public.outlet_memberships(business_id, outlet_id, user_id);
CREATE INDEX IF NOT EXISTS idx_outlet_memberships_outlet_user
  ON public.outlet_memberships(outlet_id, user_id);
CREATE INDEX IF NOT EXISTS idx_outlet_memberships_business_user
  ON public.outlet_memberships(business_id, user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outlet_memberships_business_fk'
      AND conrelid = 'public.outlet_memberships'::regclass
  ) THEN
    ALTER TABLE public.outlet_memberships
      ADD CONSTRAINT outlet_memberships_business_fk
      FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assert_membership_business_matches_outlet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE actual_business uuid;
BEGIN
  SELECT business_id INTO actual_business FROM public.outlets WHERE id = NEW.outlet_id;
  IF actual_business IS NULL OR actual_business <> NEW.business_id THEN
    RAISE EXCEPTION 'membership business_id does not match outlet business_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_membership_business_matches_outlet ON public.outlet_memberships;
CREATE TRIGGER trg_membership_business_matches_outlet
BEFORE INSERT OR UPDATE OF business_id, outlet_id ON public.outlet_memberships
FOR EACH ROW EXECUTE FUNCTION public.assert_membership_business_matches_outlet();

-- ---------------------------------------------------------------------------
-- Helpers used by all Stage 2 policies. Explicit row_security=off avoids the
-- businesses <-> outlets <-> memberships recursion fixed in migration 012.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_business(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.outlet_memberships m
    WHERE m.business_id = p_business_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_outlet(p_outlet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlets o
    JOIN public.businesses b ON b.id = o.business_id
    WHERE o.id = p_outlet_id AND b.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.outlet_memberships m
    WHERE m.outlet_id = p_outlet_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_outlet(p_outlet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlets o
    JOIN public.businesses b ON b.id = o.business_id
    WHERE o.id = p_outlet_id AND b.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.outlet_memberships m
    WHERE m.outlet_id = p_outlet_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_business(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_outlet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_outlet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_outlet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_outlet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_business(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Archive-only outlet lifecycle and minimum-one-operational-outlet guard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_outlet_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'outlets are archive-only; set is_active=false and archived_at instead';
  END IF;
  IF NEW.business_id <> OLD.business_id THEN
    RAISE EXCEPTION 'outlet business_id is immutable';
  END IF;
  IF OLD.is_active AND NOT NEW.is_active AND NOT EXISTS (
    SELECT 1 FROM public.outlets o
    WHERE o.business_id = OLD.business_id
      AND o.id <> OLD.id
      AND o.is_active = true
      AND o.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'business must retain at least one active outlet';
  END IF;
  IF NEW.is_active AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'active outlet cannot have archived_at';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_outlet_lifecycle ON public.outlets;
CREATE TRIGGER trg_guard_outlet_lifecycle
BEFORE UPDATE OR DELETE ON public.outlets
FOR EACH ROW EXECUTE FUNCTION public.guard_outlet_lifecycle();

-- ---------------------------------------------------------------------------
-- Remove every prior policy on identity tables and operational tables. RLS
-- policies are permissive by default and combine with OR; leaving a legacy
-- authenticated policy would bypass the Stage 2 membership boundary.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'businesses','outlets','outlet_memberships','profiles',
    'products','customers','orders','order_items','shifts','cash_flows',
    'petty_cash','void_records','stock_mutations','suppliers',
    'purchase_orders','promos','vouchers','loyalty_transactions','pos_products'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Identity table policies.
CREATE POLICY stage2_business_select ON public.businesses
FOR SELECT USING (public.can_access_business(id));
CREATE POLICY stage2_business_update ON public.businesses
FOR UPDATE USING (public.can_manage_business(id))
WITH CHECK (public.can_manage_business(id));

CREATE POLICY stage2_outlet_select ON public.outlets
FOR SELECT USING (public.can_view_outlet(id));
CREATE POLICY stage2_outlet_insert ON public.outlets
FOR INSERT WITH CHECK (public.can_manage_business(business_id));
CREATE POLICY stage2_outlet_update ON public.outlets
FOR UPDATE USING (public.can_manage_business(business_id))
WITH CHECK (public.can_manage_business(business_id));
-- No DELETE policy: lifecycle is archive-only.

CREATE POLICY stage2_membership_select ON public.outlet_memberships
FOR SELECT USING (user_id = auth.uid() OR public.can_view_outlet(outlet_id));
CREATE POLICY stage2_membership_insert ON public.outlet_memberships
FOR INSERT WITH CHECK (public.can_manage_business(business_id));
CREATE POLICY stage2_membership_update ON public.outlet_memberships
FOR UPDATE USING (public.can_manage_business(business_id))
WITH CHECK (public.can_manage_business(business_id));
CREATE POLICY stage2_membership_delete ON public.outlet_memberships
FOR DELETE USING (public.can_manage_business(business_id));

-- Profiles: own profile plus users assigned to an outlet visible to caller.
CREATE POLICY stage2_profiles_select ON public.profiles
FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.outlet_memberships m
    WHERE m.user_id = profiles.id AND public.can_view_outlet(m.outlet_id)
  )
);
CREATE POLICY stage2_profiles_update_self ON public.profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY stage2_profiles_update_manager ON public.profiles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.outlet_memberships m
    WHERE m.user_id = profiles.id AND public.can_manage_outlet(m.outlet_id)
  )
) WITH CHECK (true);
CREATE POLICY stage2_profiles_insert ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid() OR public.can_manage_business((SELECT business_id FROM public.outlet_memberships WHERE user_id = auth.uid() LIMIT 1)));
CREATE POLICY stage2_profiles_delete ON public.profiles
FOR DELETE USING (public.can_manage_business((SELECT business_id FROM public.outlet_memberships WHERE user_id = profiles.id LIMIT 1)));

-- Operational tables: membership-scoped access, with manager/owner writes and
-- role membership required for insert. Existing domain writer validation stays
-- in the client; RLS is the server-side boundary.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','orders','order_items','shifts','cash_flows','petty_cash',
    'void_records','stock_mutations','suppliers','purchase_orders','promos',
    'vouchers','loyalty_transactions','pos_products'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY stage2_%s_select ON public.%I FOR SELECT USING (public.can_view_outlet(outlet_id))', t, t);
      EXECUTE format('CREATE POLICY stage2_%s_insert ON public.%I FOR INSERT WITH CHECK (public.can_view_outlet(outlet_id))', t, t);
      EXECUTE format('CREATE POLICY stage2_%s_update ON public.%I FOR UPDATE USING (public.can_manage_outlet(outlet_id)) WITH CHECK (public.can_manage_outlet(outlet_id))', t, t);
      EXECUTE format('CREATE POLICY stage2_%s_delete ON public.%I FOR DELETE USING (public.can_manage_outlet(outlet_id))', t, t);
    END IF;
  END LOOP;
END $$;

-- Keep timestamp changes automatic on identity rows.
CREATE OR REPLACE FUNCTION public.stage2_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON public.businesses;
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.stage2_touch_updated_at();
DROP TRIGGER IF EXISTS trg_outlets_updated_at ON public.outlets;
CREATE TRIGGER trg_outlets_updated_at BEFORE UPDATE ON public.outlets
FOR EACH ROW EXECUTE FUNCTION public.stage2_touch_updated_at();

COMMENT ON TABLE public.outlet_memberships IS 'Stage 2: membership is bound to business_id + outlet_id; cross-business assignments are rejected.';
COMMENT ON TABLE public.outlets IS 'Stage 2: outlets are archive-only; direct DELETE is intentionally unavailable.';
