BEGIN;

CREATE OR REPLACE VIEW public.tpa_teacher_directory
WITH (security_invoker = true) AS
SELECT id, legacy_id, location_id, name, gender, specialization, qualification, tartil, is_active
FROM public.tpa_teachers;

CREATE OR REPLACE VIEW public.tpa_guardian_directory
WITH (security_invoker = true) AS
SELECT id, legacy_id, location_id, name, relation, is_active
FROM public.tpa_guardians;

CREATE OR REPLACE VIEW public.tpa_student_directory
WITH (security_invoker = true) AS
SELECT id, legacy_id, location_id, guardian_id, nis, name, gender, is_active
FROM public.tpa_students;

REVOKE ALL ON public.tpa_teacher_directory, public.tpa_guardian_directory, public.tpa_student_directory FROM anon;
GRANT SELECT ON public.tpa_teacher_directory, public.tpa_guardian_directory, public.tpa_student_directory TO authenticated;

-- Raw people tables remain writable only through existing admin RLS policies;
-- application list reads must use the minimal directory views above.
REVOKE SELECT ON public.tpa_teachers, public.tpa_guardians, public.tpa_students FROM authenticated;
GRANT SELECT (id, legacy_id, location_id, name, gender, specialization, qualification, tartil, is_active) ON public.tpa_teachers TO authenticated;
GRANT SELECT (id, legacy_id, location_id, name, relation, is_active) ON public.tpa_guardians TO authenticated;
GRANT SELECT (id, legacy_id, location_id, guardian_id, nis, name, gender, is_active) ON public.tpa_students TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tpa_teachers, public.tpa_guardians, public.tpa_students TO authenticated;

COMMIT;
