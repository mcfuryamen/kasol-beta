-- TPA domain foundation: tenant, people, membership, and RLS.
-- TPA roles intentionally live in tpa_memberships, not profiles.role.
BEGIN;

CREATE TABLE IF NOT EXISTS public.tpa_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  head_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (legacy_id)
);

CREATE TABLE IF NOT EXISTS public.tpa_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  name TEXT NOT NULL,
  relation TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, legacy_id)
);

CREATE TABLE IF NOT EXISTS public.tpa_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  name TEXT NOT NULL,
  gender TEXT,
  phone TEXT,
  specialization TEXT,
  qualification TEXT,
  tartil TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, legacy_id)
);

CREATE TABLE IF NOT EXISTS public.tpa_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'ustadz', 'wali')),
  teacher_id UUID REFERENCES public.tpa_teachers(id),
  guardian_id UUID REFERENCES public.tpa_guardians(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role = 'ustadz' AND teacher_id IS NOT NULL AND guardian_id IS NULL)
      OR (role = 'wali' AND guardian_id IS NOT NULL AND teacher_id IS NULL)
      OR (role = 'admin' AND teacher_id IS NULL AND guardian_id IS NULL)),
  UNIQUE (user_id, location_id)
);

CREATE TABLE IF NOT EXISTS public.tpa_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  guardian_id UUID REFERENCES public.tpa_guardians(id),
  nis TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  address TEXT,
  phone TEXT,
  join_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  consent_at TIMESTAMPTZ,
  consent_by UUID REFERENCES auth.users(id),
  consent_guardian_id UUID REFERENCES public.tpa_guardians(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, nis),
  UNIQUE (location_id, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_tpa_memberships_user_active ON public.tpa_memberships(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tpa_memberships_location_active ON public.tpa_memberships(location_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tpa_students_location_active ON public.tpa_students(location_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tpa_students_guardian ON public.tpa_students(guardian_id);

CREATE OR REPLACE FUNCTION public.tpa_membership_for_current_user(p_location_id UUID DEFAULT NULL)
RETURNS public.tpa_memberships
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m FROM public.tpa_memberships m
  WHERE m.user_id = auth.uid()
    AND m.is_active
    AND (p_location_id IS NULL OR m.location_id = p_location_id)
  ORDER BY m.created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tpa_can_access_location(p_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tpa_memberships m
    WHERE m.user_id = auth.uid() AND m.location_id = p_location_id AND m.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.tpa_is_admin_for_location(p_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tpa_memberships m
    WHERE m.user_id = auth.uid() AND m.location_id = p_location_id
      AND m.role = 'admin' AND m.is_active
  )
$$;

ALTER TABLE public.tpa_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tpa_locations_member_select ON public.tpa_locations;
CREATE POLICY tpa_locations_member_select ON public.tpa_locations FOR SELECT TO authenticated
  USING (public.tpa_can_access_location(id));
DROP POLICY IF EXISTS tpa_locations_admin_write ON public.tpa_locations;
CREATE POLICY tpa_locations_admin_write ON public.tpa_locations FOR ALL TO authenticated
  USING (public.tpa_is_admin_for_location(id))
  WITH CHECK (public.tpa_is_admin_for_location(id));

DROP POLICY IF EXISTS tpa_guardians_member_select ON public.tpa_guardians;
CREATE POLICY tpa_guardians_member_select ON public.tpa_guardians FOR SELECT TO authenticated
  USING (public.tpa_can_access_location(location_id));
DROP POLICY IF EXISTS tpa_guardians_admin_write ON public.tpa_guardians;
CREATE POLICY tpa_guardians_admin_write ON public.tpa_guardians FOR ALL TO authenticated
  USING (public.tpa_is_admin_for_location(location_id))
  WITH CHECK (public.tpa_is_admin_for_location(location_id));

DROP POLICY IF EXISTS tpa_teachers_member_select ON public.tpa_teachers;
CREATE POLICY tpa_teachers_member_select ON public.tpa_teachers FOR SELECT TO authenticated
  USING (public.tpa_can_access_location(location_id));
DROP POLICY IF EXISTS tpa_teachers_admin_write ON public.tpa_teachers;
CREATE POLICY tpa_teachers_admin_write ON public.tpa_teachers FOR ALL TO authenticated
  USING (public.tpa_is_admin_for_location(location_id))
  WITH CHECK (public.tpa_is_admin_for_location(location_id));

DROP POLICY IF EXISTS tpa_memberships_self_select ON public.tpa_memberships;
CREATE POLICY tpa_memberships_self_select ON public.tpa_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.tpa_is_admin_for_location(location_id));
DROP POLICY IF EXISTS tpa_memberships_admin_write ON public.tpa_memberships;
CREATE POLICY tpa_memberships_admin_write ON public.tpa_memberships FOR ALL TO authenticated
  USING (public.tpa_is_admin_for_location(location_id))
  WITH CHECK (public.tpa_is_admin_for_location(location_id));

DROP POLICY IF EXISTS tpa_students_member_select ON public.tpa_students;
CREATE POLICY tpa_students_member_select ON public.tpa_students FOR SELECT TO authenticated
  USING (
    public.tpa_can_access_location(location_id)
    AND EXISTS (
      SELECT 1 FROM public.tpa_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active
        AND m.location_id = tpa_students.location_id
        AND (m.role IN ('admin', 'ustadz') OR (m.role = 'wali' AND m.guardian_id = tpa_students.guardian_id))
    )
  );
DROP POLICY IF EXISTS tpa_students_admin_write ON public.tpa_students;
CREATE POLICY tpa_students_admin_write ON public.tpa_students FOR ALL TO authenticated
  USING (public.tpa_is_admin_for_location(location_id))
  WITH CHECK (public.tpa_is_admin_for_location(location_id));

REVOKE ALL ON public.tpa_locations, public.tpa_guardians, public.tpa_teachers, public.tpa_memberships, public.tpa_students FROM anon;
GRANT SELECT ON public.tpa_locations, public.tpa_guardians, public.tpa_teachers, public.tpa_memberships, public.tpa_students TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tpa_locations, public.tpa_guardians, public.tpa_teachers, public.tpa_memberships, public.tpa_students TO authenticated;

COMMIT;
