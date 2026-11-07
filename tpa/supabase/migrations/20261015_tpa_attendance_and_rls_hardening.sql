BEGIN;

-- Fix academic read policies with explicit outer-row aliases and role boundaries.
DROP POLICY IF EXISTS tpa_class_students_member_select ON public.tpa_class_students;
CREATE POLICY tpa_class_students_member_select ON public.tpa_class_students
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tpa_classes c WHERE c.id = tpa_class_students.class_id AND c.location_id = tpa_class_students.location_id)
    AND EXISTS (
      SELECT 1 FROM public.tpa_memberships m
      WHERE m.user_id = auth.uid()
        AND m.location_id = tpa_class_students.location_id
        AND m.is_active
        AND (
          m.role = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.tpa_class_teachers ct
            WHERE ct.class_id = tpa_class_students.class_id
              AND ct.teacher_id = m.teacher_id
              AND ct.location_id = tpa_class_students.location_id
          )
        )
    )
  );

DROP POLICY IF EXISTS tpa_schedules_member_select ON public.tpa_schedules;
CREATE POLICY tpa_schedules_member_select ON public.tpa_schedules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tpa_memberships m
      WHERE m.user_id = auth.uid()
        AND m.location_id = tpa_schedules.location_id
        AND m.is_active
        AND (m.role = 'admin' OR (m.role = 'ustadz' AND m.teacher_id = tpa_schedules.teacher_id))
    )
  );

CREATE OR REPLACE FUNCTION public.tpa_validate_subject_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE subject_location UUID;
BEGIN
  IF TG_TABLE_NAME = 'tpa_students' AND NEW.guardian_id IS NOT NULL THEN
    SELECT location_id INTO subject_location FROM public.tpa_guardians WHERE id = NEW.guardian_id;
    IF subject_location IS NULL OR subject_location <> NEW.location_id THEN RAISE EXCEPTION 'student guardian tenant mismatch'; END IF;
  ELSIF TG_TABLE_NAME = 'tpa_memberships' AND NEW.teacher_id IS NOT NULL THEN
    SELECT location_id INTO subject_location FROM public.tpa_teachers WHERE id = NEW.teacher_id;
    IF subject_location IS NULL OR subject_location <> NEW.location_id THEN RAISE EXCEPTION 'membership teacher tenant mismatch'; END IF;
  ELSIF TG_TABLE_NAME = 'tpa_memberships' AND NEW.guardian_id IS NOT NULL THEN
    SELECT location_id INTO subject_location FROM public.tpa_guardians WHERE id = NEW.guardian_id;
    IF subject_location IS NULL OR subject_location <> NEW.location_id THEN RAISE EXCEPTION 'membership guardian tenant mismatch'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tpa_students_subject_tenant ON public.tpa_students;
CREATE TRIGGER tpa_students_subject_tenant BEFORE INSERT OR UPDATE ON public.tpa_students
  FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_subject_tenant();
DROP TRIGGER IF EXISTS tpa_memberships_subject_tenant ON public.tpa_memberships;
CREATE TRIGGER tpa_memberships_subject_tenant BEFORE INSERT OR UPDATE ON public.tpa_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_subject_tenant();

CREATE TABLE IF NOT EXISTS public.tpa_class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  class_id UUID NOT NULL REFERENCES public.tpa_classes(id),
  teacher_id UUID NOT NULL REFERENCES public.tpa_teachers(id),
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','completed','cancelled')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, teacher_id, session_date, start_time)
);

CREATE TABLE IF NOT EXISTS public.tpa_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  session_id UUID NOT NULL REFERENCES public.tpa_class_sessions(id),
  student_id UUID NOT NULL REFERENCES public.tpa_students(id),
  status TEXT NOT NULL CHECK (status IN ('hadir','izin','sakit','alpha')),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE OR REPLACE FUNCTION public.tpa_validate_attendance_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s_location UUID; s_class UUID; student_location UUID; enrolled BOOLEAN;
BEGIN
  SELECT location_id, class_id INTO s_location, s_class FROM public.tpa_class_sessions WHERE id = NEW.session_id;
  SELECT location_id INTO student_location FROM public.tpa_students WHERE id = NEW.student_id;
  SELECT EXISTS (SELECT 1 FROM public.tpa_class_students cs WHERE cs.class_id = s_class AND cs.student_id = NEW.student_id AND cs.location_id = s_location) INTO enrolled;
  IF s_location IS NULL OR student_location IS NULL OR NEW.location_id <> s_location OR student_location <> s_location OR NOT enrolled THEN
    RAISE EXCEPTION 'attendance tenant or enrollment mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tpa_validate_session_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE class_location UUID; teacher_location UUID; assigned BOOLEAN;
BEGIN
  SELECT location_id INTO class_location FROM public.tpa_classes WHERE id = NEW.class_id AND is_active;
  SELECT location_id INTO teacher_location FROM public.tpa_teachers WHERE id = NEW.teacher_id AND is_active;
  SELECT EXISTS (SELECT 1 FROM public.tpa_class_teachers ct WHERE ct.class_id = NEW.class_id AND ct.teacher_id = NEW.teacher_id AND ct.location_id = NEW.location_id) INTO assigned;
  IF class_location IS NULL OR teacher_location IS NULL OR class_location <> NEW.location_id OR teacher_location <> NEW.location_id OR NOT assigned THEN
    RAISE EXCEPTION 'session tenant or teacher assignment mismatch';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.location_id <> OLD.location_id OR NEW.class_id <> OLD.class_id OR NEW.teacher_id <> OLD.teacher_id) THEN
    RAISE EXCEPTION 'session identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tpa_class_sessions_tenant ON public.tpa_class_sessions;
CREATE TRIGGER tpa_class_sessions_tenant BEFORE INSERT OR UPDATE ON public.tpa_class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_session_tenant();
DROP TRIGGER IF EXISTS tpa_attendances_tenant ON public.tpa_attendances;
CREATE TRIGGER tpa_attendances_tenant BEFORE INSERT OR UPDATE ON public.tpa_attendances
  FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_attendance_tenant();

CREATE INDEX IF NOT EXISTS idx_tpa_sessions_location_date ON public.tpa_class_sessions(location_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_sessions_teacher ON public.tpa_class_sessions(teacher_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_attendance_student ON public.tpa_attendances(student_id, created_at DESC);

ALTER TABLE public.tpa_class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY tpa_sessions_member_select ON public.tpa_class_sessions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.location_id = tpa_class_sessions.location_id AND m.is_active AND (m.role = 'admin' OR (m.role = 'ustadz' AND EXISTS (SELECT 1 FROM public.tpa_class_teachers ct WHERE ct.class_id = tpa_class_sessions.class_id AND ct.teacher_id = m.teacher_id AND ct.location_id = tpa_class_sessions.location_id))))
);
CREATE POLICY tpa_sessions_insert ON public.tpa_class_sessions FOR INSERT TO authenticated
  WITH CHECK (public.tpa_is_admin_for_location(tpa_class_sessions.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = tpa_class_sessions.teacher_id AND m.location_id = tpa_class_sessions.location_id AND m.is_active));
CREATE POLICY tpa_sessions_update ON public.tpa_class_sessions FOR UPDATE TO authenticated
  USING (public.tpa_is_admin_for_location(tpa_class_sessions.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = tpa_class_sessions.teacher_id AND m.location_id = tpa_class_sessions.location_id AND m.is_active))
  WITH CHECK (public.tpa_is_admin_for_location(tpa_class_sessions.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = tpa_class_sessions.teacher_id AND m.location_id = tpa_class_sessions.location_id AND m.is_active));

CREATE POLICY tpa_attendance_member_select ON public.tpa_attendances FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tpa_class_sessions s JOIN public.tpa_memberships m ON m.user_id = auth.uid() AND m.location_id = s.location_id AND m.is_active WHERE s.id = tpa_attendances.session_id AND (m.role = 'admin' OR (m.role = 'ustadz' AND EXISTS (SELECT 1 FROM public.tpa_class_teachers ct WHERE ct.class_id = s.class_id AND ct.teacher_id = m.teacher_id AND ct.location_id = s.location_id)) OR (m.role = 'wali' AND EXISTS (SELECT 1 FROM public.tpa_students st WHERE st.id = tpa_attendances.student_id AND st.guardian_id = m.guardian_id AND st.location_id = s.location_id))))
);
CREATE POLICY tpa_attendance_insert ON public.tpa_attendances FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tpa_class_sessions s WHERE s.id = tpa_attendances.session_id AND (public.tpa_is_admin_for_location(s.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = s.teacher_id AND m.location_id = s.location_id AND m.is_active))));
CREATE POLICY tpa_attendance_update ON public.tpa_attendances FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tpa_class_sessions s WHERE s.id = tpa_attendances.session_id AND (public.tpa_is_admin_for_location(s.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = s.teacher_id AND m.location_id = s.location_id AND m.is_active))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tpa_class_sessions s WHERE s.id = tpa_attendances.session_id AND (public.tpa_is_admin_for_location(s.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = s.teacher_id AND m.location_id = s.location_id AND m.is_active))));

REVOKE ALL ON public.tpa_class_sessions, public.tpa_attendances FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.tpa_class_sessions, public.tpa_attendances TO authenticated;

COMMIT;
