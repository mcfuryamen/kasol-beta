import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { useAuth } from '@shared/hooks/useAuth';
import { getTeachers, createTeacher, updateTeacher as svcUpdateTeacher, deleteTeacher as svcDeleteTeacher } from '@shared/data/service';
import type { Teacher } from '@shared/types';

const PAGE_SIZE = 20;
const DEMO_LOCATION_ID = '00000000-0000-0000-0000-000000000001';

export function useTeachers() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const locationId = user?.location_id || DEMO_LOCATION_ID;

  const loadTeachers = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await getTeachers(locationId);
      const filtered = search
        ? all.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
        : all;
      setTotal(filtered.length);
      const start = (page - 1) * PAGE_SIZE;
      setTeachers(filtered.slice(start, start + PAGE_SIZE));
    } catch (err) {
      console.error('[useTeachers] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [locationId, search, page]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const addTeacher = useCallback(async (data: any) => {
    await createTeacher({ ...data, location_id: locationId });
    await loadTeachers();
  }, [locationId, loadTeachers]);

  const updateTeacher = useCallback(async (id: string, data: any) => {
    await svcUpdateTeacher(id, data);
    await loadTeachers();
  }, [loadTeachers]);

  const deleteTeacher = useCallback(async (id: string) => {
    await svcDeleteTeacher(id);
    await loadTeachers();
  }, [loadTeachers]);

  const pagination = useMemo(() => ({
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    onPageChange: setPage,
  }), [page, total]);

  return {
    teachers, isLoading, search, setSearch,
    addTeacher, updateTeacher, deleteTeacher,
    pagination, reload: loadTeachers,
  };
}
