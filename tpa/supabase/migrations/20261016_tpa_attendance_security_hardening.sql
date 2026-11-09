BEGIN;

CREATE OR REPLACE FUNCTION public.tpa_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tpa_validate_attendance_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.recorded_by <> auth.uid() THEN RAISE EXCEPTION 'recorded_by must match current user'; END IF;
  ELSE
    IF NEW.session_id <> OLD.session_id OR NEW.student_id <> OLD.student_id OR NEW.location_id <> OLD.location_id THEN
      RAISE EXCEPTION 'attendance identity fields are immutable';
    END IF;
    IF NEW.recorded_by <> OLD.recorded_by OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'attendance audit fields are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tpa_validate_session_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by <> auth.uid() THEN RAISE EXCEPTION 'created_by must match current user'; END IF;
  ELSE
    IF NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'session audit fields are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tpa_sessions_updated_at ON public.tpa_class_sessions;
CREATE TRIGGER tpa_sessions_updated_at BEFORE UPDATE ON public.tpa_class_sessions FOR EACH ROW EXECUTE FUNCTION public.tpa_set_updated_at();
DROP TRIGGER IF EXISTS tpa_attendances_updated_at ON public.tpa_attendances;
CREATE TRIGGER tpa_attendances_updated_at BEFORE UPDATE ON public.tpa_attendances FOR EACH ROW EXECUTE FUNCTION public.tpa_set_updated_at();
DROP TRIGGER IF EXISTS tpa_sessions_audit ON public.tpa_class_sessions;
CREATE TRIGGER tpa_sessions_audit BEFORE INSERT OR UPDATE ON public.tpa_class_sessions FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_session_audit();
DROP TRIGGER IF EXISTS tpa_attendances_audit ON public.tpa_attendances;
CREATE TRIGGER tpa_attendances_audit BEFORE INSERT OR UPDATE ON public.tpa_attendances FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_attendance_audit();

DROP POLICY IF EXISTS tpa_sessions_member_select ON public.tpa_class_sessions;
CREATE POLICY tpa_sessions_member_select ON public.tpa_class_sessions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.location_id = tpa_class_sessions.location_id AND m.is_active AND (
    m.role = 'admin'
    OR (m.role = 'ustadz' AND EXISTS (SELECT 1 FROM public.tpa_class_teachers ct WHERE ct.class_id = tpa_class_sessions.class_id AND ct.teacher_id = m.teacher_id AND ct.location_id = tpa_class_sessions.location_id))
    OR (m.role = 'wali' AND EXISTS (SELECT 1 FROM public.tpa_attendances a JOIN public.tpa_students st ON st.id = a.student_id WHERE a.session_id = tpa_class_sessions.id AND st.guardian_id = m.guardian_id AND st.location_id = tpa_class_sessions.location_id))
  ))
);

DROP POLICY IF EXISTS tpa_sessions_insert ON public.tpa_class_sessions;
CREATE POLICY tpa_sessions_insert ON public.tpa_class_sessions FOR INSERT TO authenticated
  WITH CHECK ((created_by = auth.uid()) AND (public.tpa_is_admin_for_location(tpa_class_sessions.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = tpa_class_sessions.teacher_id AND m.location_id = tpa_class_sessions.location_id AND m.is_active)));
DROP POLICY IF EXISTS tpa_sessions_update ON public.tpa_class_sessions;
CREATE POLICY tpa_sessions_update ON public.tpa_class_sessions FOR UPDATE TO authenticated
  USING (public.tpa_is_admin_for_location(tpa_class_sessions.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = tpa_class_sessions.teacher_id AND m.location_id = tpa_class_sessions.location_id AND m.is_active))
  WITH CHECK (public.tpa_is_admin_for_location(tpa_class_sessions.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = tpa_class_sessions.teacher_id AND m.location_id = tpa_class_sessions.location_id AND m.is_active));

DROP POLICY IF EXISTS tpa_attendance_member_select ON public.tpa_attendances;
CREATE POLICY tpa_attendance_member_select ON public.tpa_attendances FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tpa_class_sessions s JOIN public.tpa_memberships m ON m.user_id = auth.uid() AND m.location_id = s.location_id AND m.is_active WHERE s.id = tpa_attendances.session_id AND (
    m.role = 'admin'
    OR (m.role = 'ustadz' AND EXISTS (SELECT 1 FROM public.tpa_class_teachers ct WHERE ct.class_id = s.class_id AND ct.teacher_id = m.teacher_id AND ct.location_id = s.location_id))
    OR (m.role = 'wali' AND EXISTS (SELECT 1 FROM public.tpa_students st WHERE st.id = tpa_attendances.student_id AND st.guardian_id = m.guardian_id AND st.location_id = s.location_id))
  ))
);
DROP POLICY IF EXISTS tpa_attendance_insert ON public.tpa_attendances;
CREATE POLICY tpa_attendance_insert ON public.tpa_attendances FOR INSERT TO authenticated
  WITH CHECK ((recorded_by = auth.uid()) AND EXISTS (SELECT 1 FROM public.tpa_class_sessions s WHERE s.id = tpa_attendances.session_id AND (public.tpa_is_admin_for_location(s.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = s.teacher_id AND m.location_id = s.location_id AND m.is_active))));
DROP POLICY IF EXISTS tpa_attendance_update ON public.tpa_attendances;
CREATE POLICY tpa_attendance_update ON public.tpa_attendances FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tpa_class_sessions s WHERE s.id = tpa_attendances.session_id AND (public.tpa_is_admin_for_location(s.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = s.teacher_id AND m.location_id = s.location_id AND m.is_active))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tpa_class_sessions s WHERE s.id = tpa_attendances.session_id AND (public.tpa_is_admin_for_location(s.location_id) OR EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.role = 'ustadz' AND m.teacher_id = s.teacher_id AND m.location_id = s.location_id AND m.is_active))));

REVOKE EXECUTE ON FUNCTION public.tpa_set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tpa_validate_attendance_audit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tpa_validate_session_audit() FROM PUBLIC;

COMMIT;
