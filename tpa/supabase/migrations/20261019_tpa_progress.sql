BEGIN;

CREATE TABLE IF NOT EXISTS public.tpa_hafalan_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  student_id UUID NOT NULL REFERENCES public.tpa_students(id),
  teacher_id UUID NOT NULL REFERENCES public.tpa_teachers(id),
  surah_number INTEGER NOT NULL CHECK (surah_number BETWEEN 1 AND 114),
  surah_name TEXT,
  ayat_from INTEGER CHECK (ayat_from IS NULL OR ayat_from >= 1),
  ayat_to INTEGER CHECK (ayat_to IS NULL OR ayat_to >= 1),
  juz INTEGER CHECK (juz IS NULL OR juz BETWEEN 1 AND 30),
  type TEXT NOT NULL CHECK (type IN ('ziyadah','murajaah','tasmi')),
  grade TEXT NOT NULL CHECK (grade IN ('mumtaz','jayyid_jiddan','jayyid','maqbul','belum_lulus')),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, legacy_id)
);

CREATE TABLE IF NOT EXISTS public.tpa_iqro_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  student_id UUID NOT NULL REFERENCES public.tpa_students(id),
  teacher_id UUID NOT NULL REFERENCES public.tpa_teachers(id),
  jilid INTEGER NOT NULL CHECK (jilid BETWEEN 1 AND 6),
  page INTEGER NOT NULL CHECK (page >= 1),
  grade TEXT NOT NULL CHECK (grade IN ('lancar','cukup','mengulang')),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_tpa_hafalan_location_date ON public.tpa_hafalan_progress(location_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_hafalan_student_date ON public.tpa_hafalan_progress(student_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_hafalan_teacher_date ON public.tpa_hafalan_progress(teacher_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_iqro_location_date ON public.tpa_iqro_progress(location_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_iqro_student_date ON public.tpa_iqro_progress(student_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_iqro_teacher_date ON public.tpa_iqro_progress(teacher_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION public.tpa_validate_progress_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE student_location UUID;
DECLARE teacher_location UUID;
BEGIN
  SELECT location_id INTO student_location FROM public.tpa_students WHERE id = NEW.student_id;
  SELECT location_id INTO teacher_location FROM public.tpa_teachers WHERE id = NEW.teacher_id AND is_active;
  IF student_location IS NULL OR teacher_location IS NULL OR student_location <> NEW.location_id OR teacher_location <> NEW.location_id THEN
    RAISE EXCEPTION 'progress tenant mismatch';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.location_id <> OLD.location_id OR NEW.student_id <> OLD.student_id) THEN
    RAISE EXCEPTION 'progress identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tpa_validate_progress_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.recorded_by <> auth.uid() THEN RAISE EXCEPTION 'recorded_by must match current user'; END IF;
  ELSE
    IF NEW.recorded_by <> OLD.recorded_by OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'progress audit fields are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tpa_hafalan_tenant ON public.tpa_hafalan_progress;
CREATE TRIGGER tpa_hafalan_tenant BEFORE INSERT OR UPDATE ON public.tpa_hafalan_progress
  FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_progress_tenant();
DROP TRIGGER IF EXISTS tpa_iqro_tenant ON public.tpa_iqro_progress;
CREATE TRIGGER tpa_iqro_tenant BEFORE INSERT OR UPDATE ON public.tpa_iqro_progress
  FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_progress_tenant();
DROP TRIGGER IF EXISTS tpa_hafalan_audit ON public.tpa_hafalan_progress;
CREATE TRIGGER tpa_hafalan_audit BEFORE INSERT OR UPDATE ON public.tpa_hafalan_progress
  FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_progress_audit();
DROP TRIGGER IF EXISTS tpa_iqro_audit ON public.tpa_iqro_progress;
CREATE TRIGGER tpa_iqro_audit BEFORE INSERT OR UPDATE ON public.tpa_iqro_progress
  FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_progress_audit();
DROP TRIGGER IF EXISTS tpa_hafalan_updated_at ON public.tpa_hafalan_progress;
CREATE TRIGGER tpa_hafalan_updated_at BEFORE UPDATE ON public.tpa_hafalan_progress
  FOR EACH ROW EXECUTE FUNCTION public.tpa_set_updated_at();
DROP TRIGGER IF EXISTS tpa_iqro_updated_at ON public.tpa_iqro_progress;
CREATE TRIGGER tpa_iqro_updated_at BEFORE UPDATE ON public.tpa_iqro_progress
  FOR EACH ROW EXECUTE FUNCTION public.tpa_set_updated_at();

ALTER TABLE public.tpa_hafalan_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_iqro_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tpa_hafalan_member_select ON public.tpa_hafalan_progress;
CREATE POLICY tpa_hafalan_member_select ON public.tpa_hafalan_progress FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tpa_memberships m
    WHERE m.user_id = auth.uid()
      AND m.is_active
      AND m.location_id = tpa_hafalan_progress.location_id
      AND (
        m.role = 'admin'
        OR (
          m.role = 'ustadz'
          AND EXISTS (
            SELECT 1 FROM public.tpa_class_students cs
            JOIN public.tpa_class_teachers ct ON ct.class_id = cs.class_id AND ct.teacher_id = m.teacher_id
            WHERE cs.student_id = tpa_hafalan_progress.student_id AND cs.location_id = tpa_hafalan_progress.location_id
          )
        )
        OR (
          m.role = 'wali'
          AND EXISTS (
            SELECT 1 FROM public.tpa_students st
            WHERE st.id = tpa_hafalan_progress.student_id AND st.guardian_id = m.guardian_id
          )
        )
      )
  )
);
DROP POLICY IF EXISTS tpa_hafalan_write ON public.tpa_hafalan_progress;
CREATE POLICY tpa_hafalan_insert ON public.tpa_hafalan_progress FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = auth.uid()
    AND (
      public.tpa_is_admin_for_location(tpa_hafalan_progress.location_id)
      OR EXISTS (
        SELECT 1 FROM public.tpa_memberships m
        WHERE m.user_id = auth.uid() AND m.is_active AND m.role = 'ustadz'
          AND m.location_id = tpa_hafalan_progress.location_id
          AND m.teacher_id = tpa_hafalan_progress.teacher_id
          AND EXISTS (
            SELECT 1 FROM public.tpa_class_students cs
            JOIN public.tpa_class_teachers ct ON ct.class_id = cs.class_id AND ct.teacher_id = m.teacher_id
            WHERE cs.student_id = tpa_hafalan_progress.student_id AND cs.location_id = tpa_hafalan_progress.location_id
          )
      )
    )
  );
CREATE POLICY tpa_hafalan_update ON public.tpa_hafalan_progress FOR UPDATE TO authenticated
  USING (public.tpa_is_admin_for_location(tpa_hafalan_progress.location_id))
  WITH CHECK (public.tpa_is_admin_for_location(tpa_hafalan_progress.location_id));

DROP POLICY IF EXISTS tpa_iqro_member_select ON public.tpa_iqro_progress;
CREATE POLICY tpa_iqro_member_select ON public.tpa_iqro_progress FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tpa_memberships m
    WHERE m.user_id = auth.uid()
      AND m.is_active
      AND m.location_id = tpa_iqro_progress.location_id
      AND (
        m.role = 'admin'
        OR (
          m.role = 'ustadz'
          AND EXISTS (
            SELECT 1 FROM public.tpa_class_students cs
            JOIN public.tpa_class_teachers ct ON ct.class_id = cs.class_id AND ct.teacher_id = m.teacher_id
            WHERE cs.student_id = tpa_iqro_progress.student_id AND cs.location_id = tpa_iqro_progress.location_id
          )
        )
        OR (
          m.role = 'wali'
          AND EXISTS (
            SELECT 1 FROM public.tpa_students st
            WHERE st.id = tpa_iqro_progress.student_id AND st.guardian_id = m.guardian_id
          )
        )
      )
  )
);
DROP POLICY IF EXISTS tpa_iqro_write ON public.tpa_iqro_progress;
CREATE POLICY tpa_iqro_insert ON public.tpa_iqro_progress FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = auth.uid()
    AND (
      public.tpa_is_admin_for_location(tpa_iqro_progress.location_id)
      OR EXISTS (
        SELECT 1 FROM public.tpa_memberships m
        WHERE m.user_id = auth.uid() AND m.is_active AND m.role = 'ustadz'
          AND m.location_id = tpa_iqro_progress.location_id
          AND m.teacher_id = tpa_iqro_progress.teacher_id
          AND EXISTS (
            SELECT 1 FROM public.tpa_class_students cs
            JOIN public.tpa_class_teachers ct ON ct.class_id = cs.class_id AND ct.teacher_id = m.teacher_id
            WHERE cs.student_id = tpa_iqro_progress.student_id AND cs.location_id = tpa_iqro_progress.location_id
          )
      )
    )
  );
CREATE POLICY tpa_iqro_update ON public.tpa_iqro_progress FOR UPDATE TO authenticated
  USING (public.tpa_is_admin_for_location(tpa_iqro_progress.location_id))
  WITH CHECK (public.tpa_is_admin_for_location(tpa_iqro_progress.location_id));

REVOKE ALL ON public.tpa_hafalan_progress, public.tpa_iqro_progress FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.tpa_hafalan_progress, public.tpa_iqro_progress TO authenticated;

COMMIT;
