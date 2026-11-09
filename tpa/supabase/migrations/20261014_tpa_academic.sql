BEGIN;

CREATE TABLE IF NOT EXISTS public.tpa_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('iqro_1','iqro_2','iqro_3','iqro_4','iqro_5','iqro_6','juz_amma','al_quran','tahfidz')),
  max_students INTEGER NOT NULL DEFAULT 30 CHECK (max_students > 0),
  room TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, legacy_id)
);

CREATE TABLE IF NOT EXISTS public.tpa_class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  class_id UUID NOT NULL REFERENCES public.tpa_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.tpa_students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, legacy_id),
  UNIQUE (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.tpa_class_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  class_id UUID NOT NULL REFERENCES public.tpa_classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.tpa_teachers(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, legacy_id),
  UNIQUE (class_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS public.tpa_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.tpa_locations(id),
  class_id UUID NOT NULL REFERENCES public.tpa_classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.tpa_teachers(id),
  day TEXT NOT NULL CHECK (day IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  UNIQUE (location_id, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_tpa_classes_location_active ON public.tpa_classes(location_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tpa_class_students_class ON public.tpa_class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_tpa_class_students_student ON public.tpa_class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_tpa_class_teachers_class ON public.tpa_class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_tpa_class_teachers_teacher ON public.tpa_class_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tpa_schedules_location_active ON public.tpa_schedules(location_id, is_active);

CREATE OR REPLACE FUNCTION public.tpa_validate_academic_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_location UUID;
DECLARE related_location UUID;
BEGIN
  IF TG_TABLE_NAME = 'tpa_class_students' THEN
    SELECT location_id INTO parent_location FROM public.tpa_classes WHERE id = NEW.class_id;
    SELECT location_id INTO related_location FROM public.tpa_students WHERE id = NEW.student_id;
  ELSIF TG_TABLE_NAME = 'tpa_class_teachers' THEN
    SELECT location_id INTO parent_location FROM public.tpa_classes WHERE id = NEW.class_id;
    SELECT location_id INTO related_location FROM public.tpa_teachers WHERE id = NEW.teacher_id;
  ELSE
    SELECT location_id INTO parent_location FROM public.tpa_classes WHERE id = NEW.class_id;
    IF NEW.teacher_id IS NOT NULL THEN SELECT location_id INTO related_location FROM public.tpa_teachers WHERE id = NEW.teacher_id; END IF;
  END IF;
  IF parent_location IS NULL OR parent_location <> NEW.location_id OR (related_location IS NOT NULL AND related_location <> NEW.location_id) THEN
    RAISE EXCEPTION 'academic tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tpa_class_students_tenant ON public.tpa_class_students;
CREATE TRIGGER tpa_class_students_tenant BEFORE INSERT OR UPDATE ON public.tpa_class_students FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_academic_tenant();
DROP TRIGGER IF EXISTS tpa_class_teachers_tenant ON public.tpa_class_teachers;
CREATE TRIGGER tpa_class_teachers_tenant BEFORE INSERT OR UPDATE ON public.tpa_class_teachers FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_academic_tenant();
DROP TRIGGER IF EXISTS tpa_schedules_tenant ON public.tpa_schedules;
CREATE TRIGGER tpa_schedules_tenant BEFORE INSERT OR UPDATE ON public.tpa_schedules FOR EACH ROW EXECUTE FUNCTION public.tpa_validate_academic_tenant();

ALTER TABLE public.tpa_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpa_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY tpa_classes_member_select ON public.tpa_classes FOR SELECT TO authenticated USING (
  public.tpa_can_access_location(location_id) AND (
    EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.location_id = tpa_classes.location_id AND m.is_active AND m.role IN ('admin','ustadz') AND (m.role = 'admin' OR EXISTS (SELECT 1 FROM public.tpa_class_teachers ct WHERE ct.class_id = tpa_classes.id AND ct.teacher_id = m.teacher_id)))
  )
);
CREATE POLICY tpa_classes_admin_write ON public.tpa_classes FOR ALL TO authenticated USING (public.tpa_is_admin_for_location(location_id)) WITH CHECK (public.tpa_is_admin_for_location(location_id));

CREATE POLICY tpa_class_students_member_select ON public.tpa_class_students FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tpa_classes c WHERE c.id = class_id) AND public.tpa_can_access_location(location_id) AND EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.location_id = location_id AND m.is_active AND (m.role = 'admin' OR EXISTS (SELECT 1 FROM public.tpa_class_teachers ct WHERE ct.class_id = class_id AND ct.teacher_id = m.teacher_id))));
CREATE POLICY tpa_class_students_admin_write ON public.tpa_class_students FOR ALL TO authenticated USING (public.tpa_is_admin_for_location(location_id)) WITH CHECK (public.tpa_is_admin_for_location(location_id));

CREATE POLICY tpa_class_teachers_member_select ON public.tpa_class_teachers FOR SELECT TO authenticated USING (public.tpa_can_access_location(location_id));
CREATE POLICY tpa_class_teachers_admin_write ON public.tpa_class_teachers FOR ALL TO authenticated USING (public.tpa_is_admin_for_location(location_id)) WITH CHECK (public.tpa_is_admin_for_location(location_id));

CREATE POLICY tpa_schedules_member_select ON public.tpa_schedules FOR SELECT TO authenticated USING (public.tpa_can_access_location(location_id) AND EXISTS (SELECT 1 FROM public.tpa_memberships m WHERE m.user_id = auth.uid() AND m.location_id = location_id AND m.is_active AND (m.role = 'admin' OR m.teacher_id = teacher_id)));
CREATE POLICY tpa_schedules_admin_write ON public.tpa_schedules FOR ALL TO authenticated USING (public.tpa_is_admin_for_location(location_id)) WITH CHECK (public.tpa_is_admin_for_location(location_id));

REVOKE ALL ON public.tpa_classes, public.tpa_class_students, public.tpa_class_teachers, public.tpa_schedules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tpa_classes, public.tpa_class_students, public.tpa_class_teachers, public.tpa_schedules TO authenticated;
COMMIT;
