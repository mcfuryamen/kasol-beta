BEGIN;

CREATE OR REPLACE VIEW public.tpa_student_detail_directory
WITH (security_invoker = true) AS
SELECT id, legacy_id, location_id, guardian_id, nis, name, gender, is_active
FROM public.tpa_students;

REVOKE ALL ON public.tpa_student_detail_directory FROM anon;
GRANT SELECT ON public.tpa_student_detail_directory TO authenticated;

COMMIT;
