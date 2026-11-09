-- Data keuangan SPP naik ke Supabase.
-- Alasan audit: data keuangan tidak boleh device-only (sebelumnya hanya IndexedDB perangkat).
-- Akses: admin SELECT/INSERT/UPDATE per location-nya; ustadz tanpa akses finansial;
-- wali hanya SELECT tagihan & pembayaran untuk anak sendiri (pola guardian 20261013);
-- tanpa DELETE (penonaktifan hanya via is_active = false).
BEGIN;

CREATE TABLE IF NOT EXISTS public.tpa_spp_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tpa_spp_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  student_id UUID NOT NULL REFERENCES public.tpa_students(id),
  spp_type_id UUID NOT NULL REFERENCES public.tpa_spp_types(id),
  bill_month DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tpa_spp_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT,
  location_id UUID NOT NULL,
  bill_id UUID NOT NULL REFERENCES public.tpa_spp_bills(id),
  student_id UUID NOT NULL REFERENCES public.tpa_students(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tpa_cash_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT,
  location_id UUID NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('masuk','keluar')),
  category TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  transaction_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpa_spp_types_location ON public.tpa_spp_types(location_id);
CREATE INDEX IF NOT EXISTS idx_tpa_spp_bills_location ON public.tpa_spp_bills(location_id);
CREATE INDEX IF NOT EXISTS idx_tpa_spp_bills_student ON public.tpa_spp_bills(student_id);
CREATE INDEX IF NOT EXISTS idx_tpa_spp_payments_location ON public.tpa_spp_payments(location_id);
CREATE INDEX IF NOT EXISTS idx_tpa_spp_payments_student ON public.tpa_spp_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_tpa_spp_payments_bill ON public.tpa_spp_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_tpa_cash_flows_location ON public.tpa_cash_flows(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tpa_spp_bills_student_type_month
  ON public.tpa_spp_bills(student_id, spp_type_id, bill_month) WHERE is_active = true;

-- Trigger updated_at memakai helper yang sudah ada (20261016).
DROP TRIGGER IF EXISTS tpa_spp_types_updated_at ON public.tpa_spp_types;
CREATE TRIGGER tpa_spp_types_updated_at BEFORE UPDATE ON public.tpa_spp_types
  FOR EACH ROW EXECUTE FUNCTION public.tpa_set_updated_at();
DROP TRIGGER IF EXISTS tpa_spp_bills_updated_at ON public.tpa_spp_bills;
CREATE TRIGGER tpa_spp_bills_updated_at BEFORE UPDATE ON public.tpa_spp_bills
  FOR EACH ROW EXECUTE FUNCTION public.tpa_set_updated_at();
DROP TRIGGER IF EXISTS tpa_spp_payments_updated_at ON public.tpa_spp_payments;
CREATE TRIGGER tpa_spp_payments_updated_at BEFORE UPDATE ON public.tpa_spp_payments
  FOR EACH ROW EXECUTE FUNCTION public.tpa_set_updated_at();
DROP TRIGGER IF EXISTS tpa_cash_flows_updated_at ON public.tpa_cash_flows;
CREATE TRIGGER tpa_cash_flows_updated_at BEFORE UPDATE ON public.tpa_cash_flows
  FOR EACH ROW EXECUTE FUNCTION public.tpa_set_updated_at();

ALTER TABLE public.tpa_spp_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_spp_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_spp_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_cash_flows ENABLE ROW LEVEL SECURITY;

-- Admin: SELECT/INSERT/UPDATE semua 4 tabel untuk location-nya (helper 20261013).
DROP POLICY IF EXISTS tpa_spp_types_admin_select ON public.tpa_spp_types;
CREATE POLICY tpa_spp_types_admin_select ON public.tpa_spp_types FOR SELECT TO authenticated
  USING (public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_spp_types_admin_insert ON public.tpa_spp_types;
CREATE POLICY tpa_spp_types_admin_insert ON public.tpa_spp_types FOR INSERT TO authenticated
  WITH CHECK (public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_spp_types_admin_update ON public.tpa_spp_types;
CREATE POLICY tpa_spp_types_admin_update ON public.tpa_spp_types FOR UPDATE TO authenticated
  USING (public.tpa_is_admin_for_location(location_id))
  WITH CHECK (public.tpa_is_admin_for_location(location_id));

DROP POLICY IF EXISTS tpa_spp_bills_admin_select ON public.tpa_spp_bills;
CREATE POLICY tpa_spp_bills_admin_select ON public.tpa_spp_bills FOR SELECT TO authenticated
  USING (public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_spp_bills_admin_insert ON public.tpa_spp_bills;
CREATE POLICY tpa_spp_bills_admin_insert ON public.tpa_spp_bills FOR INSERT TO authenticated
  WITH CHECK (public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_spp_bills_admin_update ON public.tpa_spp_bills;
CREATE POLICY tpa_spp_bills_admin_update ON public.tpa_spp_bills FOR UPDATE TO authenticated
  USING (public.tpa_is_admin_for_location(location_id))
  WITH CHECK (public.tpa_is_admin_for_location(location_id));

-- Wali: SELECT tagihan hanya untuk student yang guardian-nya milik wali tsb
-- (pola policy SELECT tpa_students di 20261013; tanpa INSERT/UPDATE).
DROP POLICY IF EXISTS tpa_spp_bills_wali_select ON public.tpa_spp_bills;
CREATE POLICY tpa_spp_bills_wali_select ON public.tpa_spp_bills FOR SELECT TO authenticated
  USING (
    public.tpa_can_access_location(location_id)
    AND EXISTS (
      SELECT 1 FROM public.tpa_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active
        AND m.location_id = tpa_spp_bills.location_id
        AND m.role = 'wali'
        AND EXISTS (
          SELECT 1 FROM public.tpa_students st
          WHERE st.id = tpa_spp_bills.student_id AND st.guardian_id = m.guardian_id
        )
    )
  );

DROP POLICY IF EXISTS tpa_spp_payments_admin_select ON public.tpa_spp_payments;
CREATE POLICY tpa_spp_payments_admin_select ON public.tpa_spp_payments FOR SELECT TO authenticated
  USING (public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_spp_payments_admin_insert ON public.tpa_spp_payments;
CREATE POLICY tpa_spp_payments_admin_insert ON public.tpa_spp_payments FOR INSERT TO authenticated
  WITH CHECK (public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_spp_payments_admin_update ON public.tpa_spp_payments;
CREATE POLICY tpa_spp_payments_admin_update ON public.tpa_spp_payments FOR UPDATE TO authenticated
  USING (public.tpa_is_admin_for_location(location_id))
  WITH CHECK (public.tpa_is_admin_for_location(location_id));

DROP POLICY IF EXISTS tpa_spp_payments_wali_select ON public.tpa_spp_payments;
CREATE POLICY tpa_spp_payments_wali_select ON public.tpa_spp_payments FOR SELECT TO authenticated
  USING (
    public.tpa_can_access_location(location_id)
    AND EXISTS (
      SELECT 1 FROM public.tpa_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active
        AND m.location_id = tpa_spp_payments.location_id
        AND m.role = 'wali'
        AND EXISTS (
          SELECT 1 FROM public.tpa_students st
          WHERE st.id = tpa_spp_payments.student_id AND st.guardian_id = m.guardian_id
        )
    )
  );

DROP POLICY IF EXISTS tpa_cash_flows_admin_select ON public.tpa_cash_flows;
CREATE POLICY tpa_cash_flows_admin_select ON public.tpa_cash_flows FOR SELECT TO authenticated
  USING (public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_cash_flows_admin_insert ON public.tpa_cash_flows;
CREATE POLICY tpa_cash_flows_admin_insert ON public.tpa_cash_flows FOR INSERT TO authenticated
  WITH CHECK (public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_cash_flows_admin_update ON public.tpa_cash_flows;
CREATE POLICY tpa_cash_flows_admin_update ON public.tpa_cash_flows FOR UPDATE TO authenticated
  USING (public.tpa_is_admin_for_location(location_id))
  WITH CHECK (public.tpa_is_admin_for_location(location_id));

-- Grants (pola 20261017): tanpa DELETE dan tanpa akses anon sama sekali.
REVOKE ALL ON public.tpa_spp_types, public.tpa_spp_bills, public.tpa_spp_payments, public.tpa_cash_flows FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tpa_spp_types, public.tpa_spp_bills, public.tpa_spp_payments, public.tpa_cash_flows TO authenticated;

COMMIT;
