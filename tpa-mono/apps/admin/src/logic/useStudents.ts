import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { useAuth } from '@shared/hooks/useAuth';
import { getStudents, createStudent, updateStudent as svcUpdateStudent, deleteStudent as svcDeleteStudent } from '@shared/data/service';
import type { Student } from '@shared/types';

const PAGE_SIZE = 20;
const DEMO_LOCATION_ID = '00000000-0000-0000-0000-000000000001';

export function useStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const locationId = user?.location_id || DEMO_LOCATION_ID;

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await getStudents(locationId);
      const filtered = search
        ? all.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
        : all;
      setTotal(filtered.length);
      const start = (page - 1) * PAGE_SIZE;
      setStudents(filtered.slice(start, start + PAGE_SIZE));
    } catch (err) {
      console.error('[useStudents] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [locationId, search, page]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const addStudent = useCallback(async (data: any) => {
    await createStudent({ ...data, location_id: locationId });
    await loadStudents();
  }, [locationId, loadStudents]);

  const updateStudent = useCallback(async (id: string, data: any) => {
    await svcUpdateStudent(id, data);
    await loadStudents();
  }, [loadStudents]);

  const deleteStudent = useCallback(async (id: string) => {
    await svcDeleteStudent(id);
    await loadStudents();
  }, [loadStudents]);

  const pagination = useMemo(() => ({
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    onPageChange: setPage,
  }), [page, total]);

  return {
    students, isLoading, search, setSearch,
    addStudent, updateStudent, deleteStudent,
    pagination, reload: loadStudents,
  };
}
