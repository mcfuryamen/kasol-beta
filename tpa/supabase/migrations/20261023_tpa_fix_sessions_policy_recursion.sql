-- 20261023: Fix infinite recursion (42P17) pada RLS tpa_class_sessions.
-- Akar: tpa_sessions_member_select (cabang wali) membaca tpa_attendances,
-- sementara tpa_attendance_member_select membaca tpa_class_sessions.
-- INSERT ... RETURNING pada sessions mengevaluasi policy SELECT sessions,
-- yang menarik policy attendances yang kembali membaca sessions -> siklus.
-- Fix: cabang wali kini membaca tpa_class_students + tpa_students
-- (anak wali terdaftar pada kelas sesi), memutus siklus sessions<->attendances.
BEGIN;

DROP POLICY IF EXISTS tpa_sessions_member_select ON public.tpa_class_sessions;
CREATE POLICY tpa_sessions_member_select ON public.tpa_class_sessions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.location_id = tpa_class_sessions.location_id AND m.is_active AND (
    m.role = 'admin'
    OR (m.role = 'ustadz' AND EXISTS (SELECT 1 FROM public.tpa_class_teachers ct WHERE ct.class_id = tpa_class_sessions.class_id AND ct.teacher_id = m.teacher_id AND ct.location_id = tpa_class_sessions.location_id))
    OR (m.role = 'wali' AND EXISTS (
      SELECT 1 FROM public.tpa_class_students cs
      JOIN public.tpa_students st ON st.id = cs.student_id
      WHERE cs.class_id = tpa_class_sessions.class_id
        AND cs.location_id = tpa_class_sessions.location_id
        AND st.guardian_id = m.guardian_id
        AND st.location_id = tpa_class_sessions.location_id
    ))
  ))
);

COMMIT;
