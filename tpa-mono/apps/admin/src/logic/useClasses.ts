import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { useAuth } from '@shared/hooks/useAuth';
import { getClasses, createClass, updateClass as svcUpdateClass, deleteClass as svcDeleteClass } from '@shared/data/service';
import type { Class } from '@shared/types';

const PAGE_SIZE = 20;
const DEMO_LOCATION_ID = '00000000-0000-0000-0000-000000000001';

export function useClasses() {
  const { user } = useAuth();
  const [classs, setClasss] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const locationId = user?.location_id || DEMO_LOCATION_ID;

  const loadClasss = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await getClasses(locationId);
      const filtered = search
        ? all.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
        : all;
      setTotal(filtered.length);
      const start = (page - 1) * PAGE_SIZE;
      setClasss(filtered.slice(start, start + PAGE_SIZE));
    } catch (err) {
      console.error('[useClasses] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [locationId, search, page]);

  useEffect(() => { loadClasss(); }, [loadClasss]);

  const addClass = useCallback(async (data: any) => {
    await createClass({ ...data, location_id: locationId });
    await loadClasss();
  }, [locationId, loadClasss]);

  const updateClass = useCallback(async (id: string, data: any) => {
    await svcUpdateClass(id, data);
    await loadClasss();
  }, [loadClasss]);

  const deleteClass = useCallback(async (id: string) => {
    await svcDeleteClass(id);
    await loadClasss();
  }, [loadClasss]);

  const pagination = useMemo(() => ({
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    onPageChange: setPage,
  }), [page, total]);

  return {
    classs, isLoading, search, setSearch,
    addClass, updateClass, deleteClass,
    pagination, reload: loadClasss,
  };
}
